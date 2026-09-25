/**
 * Lean admin analytics aggregates — one period window, GROUP BY only.
 * Independent from /admin/stats so Overview and Analytics do not share cache pressure.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { SQL_COLLECTED_REVENUE_ROW_FILTER } from "./recordedPayments.js";
import {
  type DashboardPeriodKey,
  isDashboardPeriodKey,
  normalizeDayKey,
  periodWindowFor,
} from "./adminStats.js";
import { fetchOnlinePresenceStats } from "./userPresence.js";
import { logger } from "./logger.js";

export const ANALYTICS_CACHE_MS = 90_000;
export const ANALYTICS_PERIODS: DashboardPeriodKey[] = [
  "today",
  "yesterday",
  "week",
  "month",
  "lastMonth",
  "quarter",
  "year",
];

const CHANNEL_SQL = `COALESCE(
  NULLIF(TRIM(u.acquisition_channel), ''),
  NULLIF(TRIM(u.acquisition_bucket), ''),
  'unknown'
)`;

export type AnalyticsChannelRow = {
  channel: string;
  signups: number;
  buyers: number;
  revenue: number;
  checks: number;
  conversionPct: number | null;
};

export type AnalyticsCampaignRow = {
  campaign: string;
  buyers: number;
  revenue: number;
};

export type AnalyticsDailyRow = {
  date: string;
  revenue: number;
  signups: number;
  checks: number;
};

export type AnalyticsCountryRow = { countryCode: string; count: number };
export type AnalyticsMethodRow = {
  method: "pok" | "paypal" | "credit" | "free";
  count: number;
  revenue: number;
};

export type AdminAnalyticsPayload = {
  period: DashboardPeriodKey;
  from: string;
  toExclusive: string | null;
  summary: {
    revenue: number;
    checks: number;
    signups: number;
    payingUsers: number;
    aov: number;
    cacheHitRate: number;
    onlineNow: number;
  };
  channels: AnalyticsChannelRow[];
  campaigns: AnalyticsCampaignRow[];
  daily: AnalyticsDailyRow[];
  countries: AnalyticsCountryRow[];
  paymentMethods: AnalyticsMethodRow[];
};

function sqlDateFilter(alias: string, from: string, toExclusive?: string): string {
  const col = `(${alias}.created_at AT TIME ZONE 'UTC')::date`;
  if (toExclusive) {
    return `${col} >= '${from}'::date AND ${col} < '${toExclusive}'::date`;
  }
  return `${col} >= '${from}'::date`;
}

function isOtherChannel(channel: string): boolean {
  const c = channel.trim().toLowerCase();
  return !c || c === "unknown" || c === "other";
}

/** Sort named channels by revenue desc; Other/unknown always last. */
export function sortAnalyticsChannels(rows: AnalyticsChannelRow[]): AnalyticsChannelRow[] {
  const named = rows.filter((r) => !isOtherChannel(r.channel));
  const other = rows.filter((r) => isOtherChannel(r.channel));
  named.sort((a, b) => b.revenue - a.revenue || b.signups - a.signups);
  other.sort((a, b) => b.revenue - a.revenue);
  return [...named, ...other];
}

function normalizeMethod(raw: unknown): AnalyticsMethodRow["method"] {
  const m = String(raw ?? "").toLowerCase();
  if (m === "pok" || m === "credit" || m === "free" || m === "paypal") return m;
  return "paypal";
}

type PeriodCache = {
  at: number;
  data: AdminAnalyticsPayload;
};

const periodCaches = new Map<DashboardPeriodKey, PeriodCache>();

export function invalidateAdminAnalyticsCache(): void {
  periodCaches.clear();
}

export function parseAnalyticsPeriod(raw: unknown): DashboardPeriodKey {
  const s = String(raw ?? "week").trim();
  if (isDashboardPeriodKey(s)) return s;
  return "week";
}

function emptyPayload(period: DashboardPeriodKey, from: string, toExclusive?: string): AdminAnalyticsPayload {
  return {
    period,
    from,
    toExclusive: toExclusive ?? null,
    summary: {
      revenue: 0,
      checks: 0,
      signups: 0,
      payingUsers: 0,
      aov: 0,
      cacheHitRate: 0,
      onlineNow: 0,
    },
    channels: [],
    campaigns: [],
    daily: [],
    countries: [],
    paymentMethods: [],
  };
}

async function loadAcquisitionSlices(
  from: string,
  toExclusive: string | undefined,
): Promise<{
  channels: AnalyticsChannelRow[];
  campaigns: AnalyticsCampaignRow[];
}> {
  const userDate = sqlDateFilter("u", from, toExclusive);
  const payDate = sqlDateFilter("p", from, toExclusive);
  const lookupDate = sqlDateFilter("vl", from, toExclusive);

  try {
    const [signupRows, buyerRows, checkRows, campaignRows] = await Promise.all([
      db.execute(sql`
        SELECT ${sql.raw(CHANNEL_SQL)} AS channel, COUNT(*)::int AS signups
        FROM users u
        WHERE u.is_admin = false AND ${sql.raw(userDate)}
        GROUP BY 1
      `),
      db.execute(sql`
        SELECT
          ${sql.raw(CHANNEL_SQL)} AS channel,
          COUNT(DISTINCT p.user_id)::int AS buyers,
          COALESCE(SUM(p.amount), 0)::float AS revenue
        FROM payments p
        LEFT JOIN users u ON u.id = p.user_id
        WHERE ${sql.raw(SQL_COLLECTED_REVENUE_ROW_FILTER)}
          AND ${sql.raw(payDate)}
        GROUP BY 1
      `),
      db.execute(sql`
        SELECT
          ${sql.raw(CHANNEL_SQL)} AS channel,
          COUNT(*)::int AS checks
        FROM vin_lookups vl
        LEFT JOIN users u ON u.id = vl.user_id
        WHERE ${sql.raw(lookupDate)}
        GROUP BY 1
      `),
      db.execute(sql`
        SELECT
          NULLIF(TRIM(u.acquisition_campaign), '') AS campaign,
          COUNT(DISTINCT p.user_id)::int AS buyers,
          COALESCE(SUM(p.amount), 0)::float AS revenue
        FROM payments p
        INNER JOIN users u ON u.id = p.user_id
        WHERE ${sql.raw(SQL_COLLECTED_REVENUE_ROW_FILTER)}
          AND ${sql.raw(payDate)}
          AND NULLIF(TRIM(u.acquisition_campaign), '') IS NOT NULL
        GROUP BY 1
        ORDER BY revenue DESC
        LIMIT 10
      `),
    ]);

    const map = new Map<string, AnalyticsChannelRow>();
    const touch = (channelRaw: unknown) => {
      const channel = String(channelRaw ?? "unknown").toLowerCase().trim().slice(0, 48) || "unknown";
      let row = map.get(channel);
      if (!row) {
        row = { channel, signups: 0, buyers: 0, revenue: 0, checks: 0, conversionPct: null };
        map.set(channel, row);
      }
      return row;
    };

    for (const r of signupRows.rows as Array<{ channel: unknown; signups: unknown }>) {
      touch(r.channel).signups += Number(r.signups ?? 0);
    }
    for (const r of buyerRows.rows as Array<{ channel: unknown; buyers: unknown; revenue: unknown }>) {
      const row = touch(r.channel);
      row.buyers += Number(r.buyers ?? 0);
      row.revenue += Number(r.revenue ?? 0);
    }
    for (const r of checkRows.rows as Array<{ channel: unknown; checks: unknown }>) {
      touch(r.channel).checks += Number(r.checks ?? 0);
    }

    const channels = sortAnalyticsChannels(
      [...map.values()].map((row) => ({
        ...row,
        conversionPct: row.signups > 0 ? Math.round((row.buyers / row.signups) * 1000) / 10 : null,
      })),
    );

    const campaigns: AnalyticsCampaignRow[] = (campaignRows.rows as Array<{
      campaign: unknown;
      buyers: unknown;
      revenue: unknown;
    }>)
      .map((r) => ({
        campaign: String(r.campaign ?? "").slice(0, 80),
        buyers: Number(r.buyers ?? 0),
        revenue: Number(r.revenue ?? 0),
      }))
      .filter((r) => r.campaign && r.revenue > 0);

    return { channels, campaigns };
  } catch (err) {
    logger.warn({ err }, "analytics acquisition slices unavailable");
    return { channels: [], campaigns: [] };
  }
}

export async function loadAdminAnalyticsPayload(
  period: DashboardPeriodKey,
  now = new Date(),
): Promise<AdminAnalyticsPayload> {
  const window = periodWindowFor(period, now);
  const { from, toExclusive } = window;
  const userDate = sqlDateFilter("u", from, toExclusive);
  const payDate = sqlDateFilter("p", from, toExclusive);
  const lookupDate = sqlDateFilter("vl", from, toExclusive);

  try {
    const [
      summaryRaw,
      onlinePresence,
      dailyRevRaw,
      dailySignupRaw,
      dailyChecksRaw,
      countriesRaw,
      methodsRaw,
      acquisition,
      cacheRows,
    ] = await Promise.all([
      db.execute(sql`
        SELECT
          (SELECT COALESCE(SUM(p.amount), 0)::float FROM payments p
            WHERE ${sql.raw(SQL_COLLECTED_REVENUE_ROW_FILTER)} AND ${sql.raw(payDate)}) AS revenue,
          (SELECT COUNT(*)::int FROM vin_lookups vl WHERE ${sql.raw(lookupDate)}) AS checks,
          (SELECT COUNT(*)::int FROM users u WHERE u.is_admin = false AND ${sql.raw(userDate)}) AS signups,
          (SELECT COUNT(DISTINCT p.user_id)::int FROM payments p
            WHERE ${sql.raw(SQL_COLLECTED_REVENUE_ROW_FILTER)} AND ${sql.raw(payDate)}) AS paying_users,
          (SELECT COALESCE(AVG(p.amount), 0)::float FROM payments p
            WHERE ${sql.raw(SQL_COLLECTED_REVENUE_ROW_FILTER)}
              AND p.amount > 0 AND ${sql.raw(payDate)}) AS aov
      `),
      fetchOnlinePresenceStats(),
      db.execute(sql`
        SELECT (p.created_at AT TIME ZONE 'UTC')::date AS date,
               COALESCE(SUM(p.amount), 0)::float AS revenue
        FROM payments p
        WHERE ${sql.raw(SQL_COLLECTED_REVENUE_ROW_FILTER)} AND ${sql.raw(payDate)}
        GROUP BY 1 ORDER BY 1 ASC
      `),
      db.execute(sql`
        SELECT (u.created_at AT TIME ZONE 'UTC')::date AS date, COUNT(*)::int AS count
        FROM users u
        WHERE u.is_admin = false AND ${sql.raw(userDate)}
        GROUP BY 1 ORDER BY 1 ASC
      `),
      db.execute(sql`
        SELECT (vl.created_at AT TIME ZONE 'UTC')::date AS date, COUNT(*)::int AS count
        FROM vin_lookups vl
        WHERE ${sql.raw(lookupDate)}
        GROUP BY 1 ORDER BY 1 ASC
      `),
      db.execute(sql`
        SELECT COALESCE(NULLIF(TRIM(u.country_code), ''), '—') AS country_code,
               COUNT(*)::int AS count
        FROM users u
        WHERE u.is_admin = false AND ${sql.raw(userDate)}
        GROUP BY 1
        ORDER BY count DESC
        LIMIT 10
      `),
      db.execute(sql`
        SELECT
          CASE
            WHEN p.pok_order_id IS NOT NULL AND TRIM(p.pok_order_id) <> '' THEN 'pok'
            WHEN p.paypal_order_id IS NOT NULL AND TRIM(p.paypal_order_id) <> '' THEN 'paypal'
            WHEN p.kind = 'credit_redemption' THEN 'credit'
            WHEN COALESCE(p.amount, 0) = 0 THEN 'free'
            ELSE 'paypal'
          END AS method,
          COUNT(*)::int AS count,
          COALESCE(SUM(p.amount), 0)::float AS revenue
        FROM payments p
        WHERE ${sql.raw(SQL_COLLECTED_REVENUE_ROW_FILTER)} AND ${sql.raw(payDate)}
        GROUP BY 1
        ORDER BY revenue DESC
      `),
      loadAcquisitionSlices(from, toExclusive),
      db.execute(sql`
        SELECT
          COUNT(*)::int AS total,
          COALESCE(SUM(CASE WHEN from_cache THEN 1 ELSE 0 END), 0)::int AS cached
        FROM vin_lookups vl
        WHERE ${sql.raw(lookupDate)}
      `),
    ]);

    const agg = (summaryRaw.rows[0] ?? {}) as Record<string, unknown>;
    const cacheRow = (cacheRows.rows[0] ?? {}) as Record<string, unknown>;
    const total = Number(cacheRow.total ?? 0);
    const cached = Number(cacheRow.cached ?? 0);

    const revByDay = new Map<string, number>();
    for (const r of dailyRevRaw.rows as Array<{ date: unknown; revenue: unknown }>) {
      const d = normalizeDayKey(r.date);
      if (d) revByDay.set(d, Number(r.revenue ?? 0));
    }
    const signupsByDay = new Map<string, number>();
    for (const r of dailySignupRaw.rows as Array<{ date: unknown; count: unknown }>) {
      const d = normalizeDayKey(r.date);
      if (d) signupsByDay.set(d, Number(r.count ?? 0));
    }
    const checksByDay = new Map<string, number>();
    for (const r of dailyChecksRaw.rows as Array<{ date: unknown; count: unknown }>) {
      const d = normalizeDayKey(r.date);
      if (d) checksByDay.set(d, Number(r.count ?? 0));
    }
    const allDates = [...new Set([...revByDay.keys(), ...signupsByDay.keys(), ...checksByDay.keys()])].sort();
    const daily: AnalyticsDailyRow[] = allDates.map((date) => ({
      date,
      revenue: revByDay.get(date) ?? 0,
      signups: signupsByDay.get(date) ?? 0,
      checks: checksByDay.get(date) ?? 0,
    }));

    return {
      period,
      from,
      toExclusive: toExclusive ?? null,
      summary: {
        revenue: Number(agg.revenue ?? 0),
        checks: Number(agg.checks ?? 0),
        signups: Number(agg.signups ?? 0),
        payingUsers: Number(agg.paying_users ?? 0),
        aov: Number(agg.aov ?? 0),
        cacheHitRate: total > 0 ? (cached / total) * 100 : 0,
        onlineNow: onlinePresence.onlineNow,
      },
      channels: acquisition.channels,
      campaigns: acquisition.campaigns,
      daily,
      countries: (countriesRaw.rows as Array<{ country_code: unknown; count: unknown }>).map((r) => ({
        countryCode: String(r.country_code ?? "—"),
        count: Number(r.count ?? 0),
      })),
      paymentMethods: (methodsRaw.rows as Array<{ method: unknown; count: unknown; revenue: unknown }>).map(
        (r) => ({
          method: normalizeMethod(r.method),
          count: Number(r.count ?? 0),
          revenue: Number(r.revenue ?? 0),
        }),
      ),
    };
  } catch (err) {
    logger.error({ err, period }, "admin analytics load failed");
    return emptyPayload(period, from, toExclusive);
  }
}

export async function getAdminAnalyticsCached(
  period: DashboardPeriodKey,
  opts?: { refresh?: boolean },
): Promise<AdminAnalyticsPayload> {
  if (opts?.refresh) periodCaches.delete(period);
  const hit = periodCaches.get(period);
  if (hit && Date.now() - hit.at < ANALYTICS_CACHE_MS) return hit.data;

  const data = await loadAdminAnalyticsPayload(period);
  periodCaches.set(period, { at: Date.now(), data });
  return data;
}
