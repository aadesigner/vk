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

export const ANALYTICS_BUCKET_ORDER = [
  "paid_ads",
  "organic_social",
  "google",
  "referral",
  "direct",
  "unknown",
] as const;

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
  signupSharePct: number;
  revenueSharePct: number;
  revenuePerSignup: number;
};

export type AnalyticsCampaignRow = {
  campaign: string;
  signups: number;
  buyers: number;
  revenue: number;
  conversionPct: number | null;
};

export type AnalyticsDimRow = {
  key: string;
  signups: number;
  buyers: number;
  revenue: number;
  conversionPct: number | null;
  signupSharePct: number;
  revenueSharePct: number;
};

export type AnalyticsReferrerRow = {
  referrer: string;
  signups: number;
  signupSharePct: number;
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

export type AnalyticsSummary = {
  revenue: number;
  checks: number;
  signups: number;
  payingUsers: number;
  aov: number;
  cacheHitRate: number;
  onlineNow: number;
  signupToBuyerPct: number | null;
  revenuePerSignup: number;
  checksPerSignup: number;
  attributedPct: number;
  clickIdPct: number;
};

export type AdminAnalyticsPayload = {
  period: DashboardPeriodKey;
  from: string;
  toExclusive: string | null;
  summary: AnalyticsSummary;
  channels: AnalyticsChannelRow[];
  buckets: AnalyticsDimRow[];
  sources: AnalyticsDimRow[];
  mediums: AnalyticsDimRow[];
  campaigns: AnalyticsCampaignRow[];
  referrers: AnalyticsReferrerRow[];
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

export function ratioPct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function conversionPct(buyers: number, signups: number): number | null {
  if (signups <= 0) return null;
  return Math.round((buyers / signups) * 1000) / 10;
}

export function perSignup(amount: number, signups: number): number {
  if (signups <= 0) return 0;
  return Math.round((amount / signups) * 100) / 100;
}

type ChannelScratch = Omit<AnalyticsChannelRow, "signupSharePct" | "revenueSharePct" | "revenuePerSignup">;

export function enrichChannelRows(rows: ChannelScratch[]): AnalyticsChannelRow[] {
  const totalSignups = rows.reduce((s, r) => s + r.signups, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  return rows.map((r) => ({
    ...r,
    signupSharePct: ratioPct(r.signups, totalSignups),
    revenueSharePct: ratioPct(r.revenue, totalRevenue),
    revenuePerSignup: perSignup(r.revenue, r.signups),
  }));
}

type NamedScratch = { key: string; signups: number; buyers: number; revenue: number };

export function finalizeNamedRows(
  rows: NamedScratch[],
  opts?: { limit?: number; order?: readonly string[] },
): AnalyticsDimRow[] {
  const merged = new Map<string, NamedScratch>();
  for (const r of rows) {
    const key = (r.key || "unknown").trim().toLowerCase().slice(0, 80) || "unknown";
    const cur = merged.get(key);
    if (cur) {
      cur.signups += r.signups;
      cur.buyers += r.buyers;
      cur.revenue += r.revenue;
    } else {
      merged.set(key, { key, signups: r.signups, buyers: r.buyers, revenue: r.revenue });
    }
  }
  let list = [...merged.values()].filter((r) => r.signups > 0 || r.buyers > 0 || r.revenue > 0);
  if (opts?.order) {
    const rank = new Map(opts.order.map((k, i) => [k, i]));
    list.sort((a, b) => (rank.get(a.key) ?? 99) - (rank.get(b.key) ?? 99) || b.signups - a.signups);
  } else {
    const named = list.filter((r) => !isOtherChannel(r.key));
    const other = list.filter((r) => isOtherChannel(r.key));
    named.sort((a, b) => b.revenue - a.revenue || b.signups - a.signups);
    other.sort((a, b) => b.signups - a.signups);
    list = [...named, ...other];
  }
  if (opts?.limit && list.length > opts.limit) {
    list = list.slice(0, opts.limit);
  }
  const totalSignups = list.reduce((s, r) => s + r.signups, 0);
  const totalRevenue = list.reduce((s, r) => s + r.revenue, 0);
  return list.map((r) => ({
    key: r.key,
    signups: r.signups,
    buyers: r.buyers,
    revenue: r.revenue,
    conversionPct: conversionPct(r.buyers, r.signups),
    signupSharePct: ratioPct(r.signups, totalSignups),
    revenueSharePct: ratioPct(r.revenue, totalRevenue),
  }));
}

export function normalizeReferrerHost(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s || s === "direct" || s === "unknown" || s === "none") return "";
  try {
    const u = new URL(s.includes("://") ? s : `https://${s}`);
    return u.hostname.replace(/^www\./i, "").slice(0, 80);
  } catch {
    return s.replace(/^www\./, "").slice(0, 80);
  }
}

export function finalizeReferrers(
  rows: Array<{ referrer: string; signups: number }>,
  totalSignups: number,
  limit = 8,
): AnalyticsReferrerRow[] {
  const merged = new Map<string, number>();
  for (const r of rows) {
    const host = normalizeReferrerHost(r.referrer);
    if (!host) continue;
    merged.set(host, (merged.get(host) ?? 0) + r.signups);
  }
  return [...merged.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([referrer, signups]) => ({
      referrer,
      signups,
      signupSharePct: ratioPct(signups, totalSignups),
    }));
}

export function mergeCampaigns(
  signupRows: Array<{ campaign: string; signups: number }>,
  payRows: Array<{ campaign: string; buyers: number; revenue: number }>,
  limit = 12,
): AnalyticsCampaignRow[] {
  const map = new Map<string, AnalyticsCampaignRow>();
  const touch = (name: string) => {
    const campaign = name.trim().slice(0, 80);
    if (!campaign) return null;
    let row = map.get(campaign);
    if (!row) {
      row = { campaign, signups: 0, buyers: 0, revenue: 0, conversionPct: null };
      map.set(campaign, row);
    }
    return row;
  };
  for (const r of signupRows) {
    const row = touch(r.campaign);
    if (row) row.signups += r.signups;
  }
  for (const r of payRows) {
    const row = touch(r.campaign);
    if (row) {
      row.buyers += r.buyers;
      row.revenue += r.revenue;
    }
  }
  return [...map.values()]
    .map((r) => ({ ...r, conversionPct: conversionPct(r.buyers, r.signups) }))
    .sort((a, b) => b.revenue - a.revenue || b.signups - a.signups)
    .slice(0, limit);
}

export function deriveAnalyticsSummaryExtras(input: {
  revenue: number;
  checks: number;
  signups: number;
  payingUsers: number;
  channels: Array<{ channel: string; signups: number }>;
  clickIdSignups: number;
}): Pick<
  AnalyticsSummary,
  "signupToBuyerPct" | "revenuePerSignup" | "checksPerSignup" | "attributedPct" | "clickIdPct"
> {
  const unknownSignups = input.channels
    .filter((c) => isOtherChannel(c.channel))
    .reduce((s, c) => s + c.signups, 0);
  const attributed = Math.max(0, input.signups - unknownSignups);
  return {
    signupToBuyerPct: conversionPct(input.payingUsers, input.signups),
    revenuePerSignup: perSignup(input.revenue, input.signups),
    checksPerSignup: perSignup(input.checks, input.signups),
    attributedPct: ratioPct(attributed, input.signups),
    clickIdPct: ratioPct(input.clickIdSignups, input.signups),
  };
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

const EMPTY_SUMMARY: AnalyticsSummary = {
  revenue: 0,
  checks: 0,
  signups: 0,
  payingUsers: 0,
  aov: 0,
  cacheHitRate: 0,
  onlineNow: 0,
  signupToBuyerPct: null,
  revenuePerSignup: 0,
  checksPerSignup: 0,
  attributedPct: 0,
  clickIdPct: 0,
};

function emptyPayload(period: DashboardPeriodKey, from: string, toExclusive?: string): AdminAnalyticsPayload {
  return {
    period,
    from,
    toExclusive: toExclusive ?? null,
    summary: { ...EMPTY_SUMMARY },
    channels: [],
    buckets: [],
    sources: [],
    mediums: [],
    campaigns: [],
    referrers: [],
    daily: [],
    countries: [],
    paymentMethods: [],
  };
}

type SliceResult = {
  channels: AnalyticsChannelRow[];
  buckets: AnalyticsDimRow[];
  sources: AnalyticsDimRow[];
  mediums: AnalyticsDimRow[];
  campaigns: AnalyticsCampaignRow[];
  referrers: AnalyticsReferrerRow[];
  clickIdSignups: number;
};

const EMPTY_SLICES: SliceResult = {
  channels: [],
  buckets: [],
  sources: [],
  mediums: [],
  campaigns: [],
  referrers: [],
  clickIdSignups: 0,
};

async function loadAcquisitionSlices(from: string, toExclusive: string | undefined): Promise<SliceResult> {
  const userDate = sqlDateFilter("u", from, toExclusive);
  const payDate = sqlDateFilter("p", from, toExclusive);
  const lookupDate = sqlDateFilter("vl", from, toExclusive);

  try {
    const [signupRows, buyerRows, checkRows, dimSignupRows, dimPayRows] = await Promise.all([
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
          COALESCE(NULLIF(TRIM(u.acquisition_bucket), ''), 'unknown') AS bucket,
          COALESCE(NULLIF(TRIM(LOWER(u.acquisition_source)), ''), 'unknown') AS source,
          COALESCE(NULLIF(TRIM(LOWER(u.acquisition_medium)), ''), 'unknown') AS medium,
          COALESCE(NULLIF(TRIM(LOWER(u.acquisition_referrer)), ''), '') AS referrer,
          NULLIF(TRIM(u.acquisition_campaign), '') AS campaign,
          COUNT(*)::int AS signups,
          COALESCE(SUM(CASE WHEN NULLIF(TRIM(u.acquisition_click_id), '') IS NOT NULL THEN 1 ELSE 0 END), 0)::int AS with_click
        FROM users u
        WHERE u.is_admin = false AND ${sql.raw(userDate)}
        GROUP BY 1, 2, 3, 4, 5
      `),
      db.execute(sql`
        SELECT
          COALESCE(NULLIF(TRIM(u.acquisition_bucket), ''), 'unknown') AS bucket,
          COALESCE(NULLIF(TRIM(LOWER(u.acquisition_source)), ''), 'unknown') AS source,
          COALESCE(NULLIF(TRIM(LOWER(u.acquisition_medium)), ''), 'unknown') AS medium,
          NULLIF(TRIM(u.acquisition_campaign), '') AS campaign,
          COUNT(DISTINCT p.user_id)::int AS buyers,
          COALESCE(SUM(p.amount), 0)::float AS revenue
        FROM payments p
        LEFT JOIN users u ON u.id = p.user_id
        WHERE ${sql.raw(SQL_COLLECTED_REVENUE_ROW_FILTER)}
          AND ${sql.raw(payDate)}
        GROUP BY 1, 2, 3, 4
      `),
    ]);

    const map = new Map<string, ChannelScratch>();
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

    const channels = enrichChannelRows(
      sortAnalyticsChannels(
        [...map.values()].map((row) => ({
          ...row,
          conversionPct: conversionPct(row.buyers, row.signups),
          signupSharePct: 0,
          revenueSharePct: 0,
          revenuePerSignup: 0,
        })),
      ),
    );

    type DimSignup = {
      bucket: unknown;
      source: unknown;
      medium: unknown;
      referrer: unknown;
      campaign: unknown;
      signups: unknown;
      with_click: unknown;
    };
    type DimPay = {
      bucket: unknown;
      source: unknown;
      medium: unknown;
      campaign: unknown;
      buyers: unknown;
      revenue: unknown;
    };

    const dimSignups = dimSignupRows.rows as DimSignup[];
    const dimPays = dimPayRows.rows as DimPay[];

    const clickIdSignups = dimSignups.reduce((s, r) => s + Number(r.with_click ?? 0), 0);
    const totalSignups = dimSignups.reduce((s, r) => s + Number(r.signups ?? 0), 0);

    const bucketSignups: NamedScratch[] = dimSignups.map((r) => ({
      key: String(r.bucket ?? "unknown"),
      signups: Number(r.signups ?? 0),
      buyers: 0,
      revenue: 0,
    }));
    const bucketPays: NamedScratch[] = dimPays.map((r) => ({
      key: String(r.bucket ?? "unknown"),
      signups: 0,
      buyers: Number(r.buyers ?? 0),
      revenue: Number(r.revenue ?? 0),
    }));
    const sourceSignups: NamedScratch[] = dimSignups.map((r) => ({
      key: String(r.source ?? "unknown"),
      signups: Number(r.signups ?? 0),
      buyers: 0,
      revenue: 0,
    }));
    const sourcePays: NamedScratch[] = dimPays.map((r) => ({
      key: String(r.source ?? "unknown"),
      signups: 0,
      buyers: Number(r.buyers ?? 0),
      revenue: Number(r.revenue ?? 0),
    }));
    const mediumSignups: NamedScratch[] = dimSignups.map((r) => ({
      key: String(r.medium ?? "unknown"),
      signups: Number(r.signups ?? 0),
      buyers: 0,
      revenue: 0,
    }));
    const mediumPays: NamedScratch[] = dimPays.map((r) => ({
      key: String(r.medium ?? "unknown"),
      signups: 0,
      buyers: Number(r.buyers ?? 0),
      revenue: Number(r.revenue ?? 0),
    }));

    return {
      channels,
      buckets: finalizeNamedRows([...bucketSignups, ...bucketPays], { order: ANALYTICS_BUCKET_ORDER }),
      sources: finalizeNamedRows([...sourceSignups, ...sourcePays], { limit: 10 }),
      mediums: finalizeNamedRows([...mediumSignups, ...mediumPays], { limit: 8 }),
      campaigns: mergeCampaigns(
        dimSignups.map((r) => ({
          campaign: String(r.campaign ?? ""),
          signups: Number(r.signups ?? 0),
        })),
        dimPays.map((r) => ({
          campaign: String(r.campaign ?? ""),
          buyers: Number(r.buyers ?? 0),
          revenue: Number(r.revenue ?? 0),
        })),
      ),
      referrers: finalizeReferrers(
        dimSignups.map((r) => ({
          referrer: String(r.referrer ?? ""),
          signups: Number(r.signups ?? 0),
        })),
        totalSignups,
      ),
      clickIdSignups,
    };
  } catch (err) {
    logger.warn({ err }, "analytics acquisition slices unavailable");
    return EMPTY_SLICES;
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

    const revenue = Number(agg.revenue ?? 0);
    const checks = Number(agg.checks ?? 0);
    const signups = Number(agg.signups ?? 0);
    const payingUsers = Number(agg.paying_users ?? 0);
    const extras = deriveAnalyticsSummaryExtras({
      revenue,
      checks,
      signups,
      payingUsers,
      channels: acquisition.channels,
      clickIdSignups: acquisition.clickIdSignups,
    });

    return {
      period,
      from,
      toExclusive: toExclusive ?? null,
      summary: {
        revenue,
        checks,
        signups,
        payingUsers,
        aov: Number(agg.aov ?? 0),
        cacheHitRate: total > 0 ? (cached / total) * 100 : 0,
        onlineNow: onlinePresence.onlineNow,
        ...extras,
      },
      channels: acquisition.channels,
      buckets: acquisition.buckets,
      sources: acquisition.sources,
      mediums: acquisition.mediums,
      campaigns: acquisition.campaigns,
      referrers: acquisition.referrers,
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
