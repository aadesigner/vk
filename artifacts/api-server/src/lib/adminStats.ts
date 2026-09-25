/** UTC calendar helpers — admin dashboard stats use these consistently. */

export function utcTodayIso(now = new Date()): string {
  return now.toISOString().substring(0, 10);
}

export function utcDateIsoDaysAgo(daysAgo: number, now = new Date()): string {
  const dt = new Date(now);
  dt.setUTCDate(dt.getUTCDate() - daysAgo);
  return dt.toISOString().substring(0, 10);
}

export function utcMonthStartIso(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function utcPrevMonthStartIso(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return d.toISOString().substring(0, 10);
}

/** ISO week: Monday 00:00 UTC of the week containing `now`. */
export function utcMondayWeekStartIso(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay(); // 0=Sun … 6=Sat
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d.toISOString().substring(0, 10);
}

/** Previous ISO week Monday (7 days before this week's Monday). */
export function utcPrevMondayWeekStartIso(now = new Date()): string {
  const thisMon = new Date(`${utcMondayWeekStartIso(now)}T00:00:00.000Z`);
  thisMon.setUTCDate(thisMon.getUTCDate() - 7);
  return thisMon.toISOString().substring(0, 10);
}

/** Calendar year start YYYY-01-01 (UTC). */
export function utcYearStartIso(now = new Date()): string {
  return `${now.getUTCFullYear()}-01-01`;
}

/** Normalize PG date / timestamp to YYYY-MM-DD (UTC). */
export function normalizeDayKey(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().substring(0, 10);
  const s = String(value);
  return s.substring(0, 10);
}

export type DailyCountRow = { date: string; count: number };
export type DailyRevenueRow = { date: string; revenue: number };

export function normalizeDailyCounts(rows: Array<{ date: unknown; count: unknown }>): DailyCountRow[] {
  return rows.map((row) => ({
    date: normalizeDayKey(row.date),
    count: Number(row.count ?? 0),
  }));
}

export function normalizeDailyRevenue(rows: Array<{ date: unknown; revenue: unknown }>): DailyRevenueRow[] {
  return rows.map((row) => ({
    date: normalizeDayKey(row.date),
    revenue: Number(row.revenue ?? 0),
  }));
}

export type RecentPaymentRow = {
  id: number;
  user_id: string;
  vin: string | null;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  email: string | null;
  name: string | null;
};

export function normalizeRecentPayments(rows: Array<Record<string, unknown>>): RecentPaymentRow[] {
  return rows.map((row) => ({
    id: Number(row.id),
    user_id: String(row.user_id ?? ""),
    vin: row.vin != null ? String(row.vin) : null,
    amount: Number(row.amount ?? 0),
    currency: String(row.currency ?? "EUR"),
    status: String(row.status ?? ""),
    created_at: String(row.created_at ?? ""),
    email: row.email != null ? String(row.email) : null,
    name: row.name != null ? String(row.name) : null,
  }));
}

export function normalizePaymentStatusCounts(
  rows: Array<{ status: unknown; count: unknown }>,
): Array<{ status: string; count: number }> {
  return rows.map((row) => ({
    status: String(row.status ?? "unknown"),
    count: Number(row.count ?? 0),
  }));
}

export function sliceSeriesFrom<T extends { date: string }>(rows: T[], fromIsoInclusive: string): T[] {
  return rows.filter((r) => r.date >= fromIsoInclusive);
}

export function sumDailyCounts(rows: DailyCountRow[], fromIso: string, toIsoExclusive?: string): number {
  let total = 0;
  for (const row of rows) {
    if (row.date < fromIso) continue;
    if (toIsoExclusive && row.date >= toIsoExclusive) continue;
    total += row.count;
  }
  return total;
}

export function sumDailyRevenue(rows: DailyRevenueRow[], fromIso: string, toIsoExclusive?: string): number {
  let total = 0;
  for (const row of rows) {
    if (row.date < fromIso) continue;
    if (toIsoExclusive && row.date >= toIsoExclusive) continue;
    total += row.revenue;
  }
  return total;
}

export function trendPct(current: number, prev: number): number | null {
  if (prev === 0) return current > 0 ? 100 : null;
  return Math.round(((current - prev) / prev) * 100);
}

export type DashboardPeriodKey = "today" | "yesterday" | "week" | "month" | "lastMonth" | "quarter" | "year";

export type CountryCountRow = { countryCode: string; count: number };
export type PaymentMethodRow = {
  method: "paypal" | "pok" | "credit" | "free";
  count: number;
  revenue: number;
};

export type AcquisitionBucket =
  | "paid_ads"
  | "organic_social"
  | "google"
  | "referral"
  | "direct"
  | "unknown";

export type SalesBySourceRow = {
  bucket: AcquisitionBucket;
  count: number;
  revenue: number;
};

export type SalesByChannelRow = {
  channel: string;
  count: number;
  revenue: number;
};

export type SignupsByChannelRow = {
  channel: string;
  count: number;
};

export type PeriodBreakdownMaps = {
  signupsByCountry: Record<DashboardPeriodKey, CountryCountRow[]>;
  purchasesByCountry: Record<DashboardPeriodKey, CountryCountRow[]>;
  paymentsByMethod: Record<DashboardPeriodKey, PaymentMethodRow[]>;
  salesBySource: Record<DashboardPeriodKey, SalesBySourceRow[]>;
  salesByChannel: Record<DashboardPeriodKey, SalesByChannelRow[]>;
  signupsByChannel: Record<DashboardPeriodKey, SignupsByChannelRow[]>;
};

const PERIOD_KEYS: DashboardPeriodKey[] = ["today", "yesterday", "week", "month", "lastMonth", "quarter", "year"];
const METHOD_ORDER: Array<PaymentMethodRow["method"]> = ["paypal", "pok", "credit", "free"];
const SOURCE_ORDER: AcquisitionBucket[] = [
  "paid_ads",
  "organic_social",
  "google",
  "referral",
  "direct",
  "unknown",
];

function emptyCountryMaps(): Record<DashboardPeriodKey, CountryCountRow[]> {
  return { today: [], yesterday: [], week: [], month: [], lastMonth: [], quarter: [], year: [] };
}

function emptyMethodMaps(): Record<DashboardPeriodKey, PaymentMethodRow[]> {
  return { today: [], yesterday: [], week: [], month: [], lastMonth: [], quarter: [], year: [] };
}

function emptySourceMaps(): Record<DashboardPeriodKey, SalesBySourceRow[]> {
  return { today: [], yesterday: [], week: [], month: [], lastMonth: [], quarter: [], year: [] };
}

function emptyChannelMaps(): Record<DashboardPeriodKey, SalesByChannelRow[]> {
  return { today: [], yesterday: [], week: [], month: [], lastMonth: [], quarter: [], year: [] };
}

function emptySignupChannelMaps(): Record<DashboardPeriodKey, SignupsByChannelRow[]> {
  return { today: [], yesterday: [], week: [], month: [], lastMonth: [], quarter: [], year: [] };
}

function periodWindows(now = new Date()): Record<DashboardPeriodKey, { from: string; toExclusive?: string }> {
  const today = utcTodayIso(now);
  const yesterday = utcDateIsoDaysAgo(1, now);
  const weekFrom = utcMondayWeekStartIso(now);
  const monthFrom = utcMonthStartIso(now);
  const lastMonthFrom = utcPrevMonthStartIso(now);
  const quarterFrom = utcDateIsoDaysAgo(89, now);
  const yearFrom = utcYearStartIso(now);
  return {
    today: { from: today },
    yesterday: { from: yesterday, toExclusive: today },
    week: { from: weekFrom },
    month: { from: monthFrom },
    lastMonth: { from: lastMonthFrom, toExclusive: monthFrom },
    quarter: { from: quarterFrom },
    year: { from: yearFrom },
  };
}

/** Single period window for analytics monitoring (one SQL scope, not all keys). */
export function periodWindowFor(
  period: DashboardPeriodKey,
  now = new Date(),
): { from: string; toExclusive?: string } {
  return periodWindows(now)[period];
}

export function isDashboardPeriodKey(raw: string): raw is DashboardPeriodKey {
  return (PERIOD_KEYS as readonly string[]).includes(raw);
}

function inWindow(date: string, from: string, toExclusive?: string): boolean {
  if (!date || date < from) return false;
  if (toExclusive && date >= toExclusive) return false;
  return true;
}

function topCountries(
  counts: Map<string, number>,
  limit = 10,
): CountryCountRow[] {
  return [...counts.entries()]
    .map(([countryCode, count]) => ({ countryCode, count }))
    .sort((a, b) => b.count - a.count || a.countryCode.localeCompare(b.countryCode))
    .slice(0, limit);
}

function normalizeMethod(raw: unknown): PaymentMethodRow["method"] {
  const m = String(raw ?? "").toLowerCase();
  if (m === "pok" || m === "credit" || m === "free" || m === "paypal") return m;
  return "paypal";
}

/** Bucket daily country count rows into dashboard periods (top 10 each). */
export function buildCountryCountPeriods(
  rows: Array<{ date: unknown; country_code?: unknown; countryCode?: unknown; count: unknown }>,
  now = new Date(),
): Record<DashboardPeriodKey, CountryCountRow[]> {
  const windows = periodWindows(now);
  const maps: Record<DashboardPeriodKey, Map<string, number>> = {
    today: new Map(),
    yesterday: new Map(),
    week: new Map(),
    month: new Map(),
    lastMonth: new Map(),
    quarter: new Map(),
    year: new Map(),
  };

  for (const row of rows) {
    const date = normalizeDayKey(row.date);
    const country = String(row.country_code ?? row.countryCode ?? "—").trim() || "—";
    const count = Number(row.count ?? 0);
    if (!date || count <= 0) continue;
    for (const key of PERIOD_KEYS) {
      const w = windows[key];
      if (!inWindow(date, w.from, w.toExclusive)) continue;
      maps[key].set(country, (maps[key].get(country) ?? 0) + count);
    }
  }

  const out = emptyCountryMaps();
  for (const key of PERIOD_KEYS) out[key] = topCountries(maps[key]);
  return out;
}

/** @deprecated alias — prefer buildCountryCountPeriods */
export const buildSignupsByCountryPeriods = buildCountryCountPeriods;

/** Bucket daily payment-method rows into dashboard periods. */
export function buildPaymentsByMethodPeriods(
  rows: Array<{ date: unknown; method: unknown; count: unknown; revenue: unknown }>,
  now = new Date(),
): Record<DashboardPeriodKey, PaymentMethodRow[]> {
  const windows = periodWindows(now);
  const maps: Record<DashboardPeriodKey, Map<PaymentMethodRow["method"], { count: number; revenue: number }>> = {
    today: new Map(),
    yesterday: new Map(),
    week: new Map(),
    month: new Map(),
    lastMonth: new Map(),
    quarter: new Map(),
    year: new Map(),
  };

  for (const row of rows) {
    const date = normalizeDayKey(row.date);
    const method = normalizeMethod(row.method);
    const count = Number(row.count ?? 0);
    const revenue = Number(row.revenue ?? 0);
    if (!date || count <= 0) continue;
    for (const key of PERIOD_KEYS) {
      const w = windows[key];
      if (!inWindow(date, w.from, w.toExclusive)) continue;
      const prev = maps[key].get(method) ?? { count: 0, revenue: 0 };
      maps[key].set(method, { count: prev.count + count, revenue: prev.revenue + revenue });
    }
  }

  const out = emptyMethodMaps();
  for (const key of PERIOD_KEYS) {
    out[key] = METHOD_ORDER
      .map((method) => {
        const v = maps[key].get(method);
        return { method, count: v?.count ?? 0, revenue: v?.revenue ?? 0 };
      })
      .filter((r) => r.count > 0);
  }
  return out;
}

function normalizeAcquisitionBucket(raw: unknown): AcquisitionBucket {
  const b = String(raw ?? "").toLowerCase().trim();
  if (
    b === "paid_ads"
    || b === "organic_social"
    || b === "google"
    || b === "referral"
    || b === "direct"
    || b === "unknown"
  ) {
    return b;
  }
  return "unknown";
}

/** Map fine channel → coarse dashboard bucket. */
export function channelToAcquisitionBucket(channel: unknown): AcquisitionBucket {
  const c = String(channel ?? "").toLowerCase().trim();
  if (!c || c === "unknown") return "unknown";
  if (c === "direct") return "direct";
  if (c === "referral") return "referral";
  if (c === "google" || c === "google_organic") return "google";
  if (c.includes("_ads") || c === "paid_ads") return "paid_ads";
  if (c.includes("_social") || c === "organic_social") return "organic_social";
  if (c === "google_ads") return "paid_ads";
  return normalizeAcquisitionBucket(c);
}

function normalizeChannel(raw: unknown): string {
  const c = String(raw ?? "").toLowerCase().trim().slice(0, 48);
  return c || "unknown";
}

/**
 * One pass over daily channel rows → per-period channel list + rolled-up buckets.
 * Keeps admin stats to a single acquisition SQL query.
 */
export function buildSalesAttributionPeriods(
  rows: Array<{ date: unknown; channel: unknown; count: unknown; revenue: unknown }>,
  now = new Date(),
): {
  salesByChannel: Record<DashboardPeriodKey, SalesByChannelRow[]>;
  salesBySource: Record<DashboardPeriodKey, SalesBySourceRow[]>;
} {
  const windows = periodWindows(now);
  const channelMaps: Record<DashboardPeriodKey, Map<string, { count: number; revenue: number }>> = {
    today: new Map(),
    yesterday: new Map(),
    week: new Map(),
    month: new Map(),
    lastMonth: new Map(),
    quarter: new Map(),
    year: new Map(),
  };
  const bucketMaps: Record<DashboardPeriodKey, Map<AcquisitionBucket, { count: number; revenue: number }>> = {
    today: new Map(),
    yesterday: new Map(),
    week: new Map(),
    month: new Map(),
    lastMonth: new Map(),
    quarter: new Map(),
    year: new Map(),
  };

  for (const row of rows) {
    const date = normalizeDayKey(row.date);
    const channel = normalizeChannel(row.channel);
    const bucket = channelToAcquisitionBucket(channel);
    const count = Number(row.count ?? 0);
    const revenue = Number(row.revenue ?? 0);
    if (!date || count <= 0) continue;
    for (const key of PERIOD_KEYS) {
      const w = windows[key];
      if (!inWindow(date, w.from, w.toExclusive)) continue;
      const prevC = channelMaps[key].get(channel) ?? { count: 0, revenue: 0 };
      channelMaps[key].set(channel, { count: prevC.count + count, revenue: prevC.revenue + revenue });
      const prevB = bucketMaps[key].get(bucket) ?? { count: 0, revenue: 0 };
      bucketMaps[key].set(bucket, { count: prevB.count + count, revenue: prevB.revenue + revenue });
    }
  }

  const salesByChannel = emptyChannelMaps();
  const salesBySource = emptySourceMaps();
  for (const key of PERIOD_KEYS) {
    salesByChannel[key] = [...channelMaps[key].entries()]
      .map(([channel, v]) => ({ channel, count: v.count, revenue: v.revenue }))
      .sort((a, b) => b.revenue - a.revenue || b.count - a.count)
      .slice(0, 12);
    salesBySource[key] = SOURCE_ORDER
      .map((bucket) => {
        const v = bucketMaps[key].get(bucket);
        return { bucket, count: v?.count ?? 0, revenue: v?.revenue ?? 0 };
      })
      .filter((r) => r.count > 0);
  }
  return { salesByChannel, salesBySource };
}

/** @deprecated — prefer buildSalesAttributionPeriods */
export function buildSalesBySourcePeriods(
  rows: Array<{ date: unknown; bucket: unknown; count: unknown; revenue: unknown }>,
  now = new Date(),
): Record<DashboardPeriodKey, SalesBySourceRow[]> {
  return buildSalesAttributionPeriods(
    rows.map((r) => ({
      date: r.date,
      channel: r.bucket,
      count: r.count,
      revenue: r.revenue,
    })),
    now,
  ).salesBySource;
}

/** Daily signup counts by acquisition channel → dashboard periods. */
export function buildSignupsByChannelPeriods(
  rows: Array<{ date: unknown; channel: unknown; count: unknown }>,
  now = new Date(),
): Record<DashboardPeriodKey, SignupsByChannelRow[]> {
  const windows = periodWindows(now);
  const maps: Record<DashboardPeriodKey, Map<string, number>> = {
    today: new Map(),
    yesterday: new Map(),
    week: new Map(),
    month: new Map(),
    lastMonth: new Map(),
    quarter: new Map(),
    year: new Map(),
  };

  for (const row of rows) {
    const date = normalizeDayKey(row.date);
    const channel = normalizeChannel(row.channel);
    const count = Number(row.count ?? 0);
    if (!date || count <= 0) continue;
    for (const key of PERIOD_KEYS) {
      const w = windows[key];
      if (!inWindow(date, w.from, w.toExclusive)) continue;
      maps[key].set(channel, (maps[key].get(channel) ?? 0) + count);
    }
  }

  const out = emptySignupChannelMaps();
  for (const key of PERIOD_KEYS) {
    out[key] = [...maps[key].entries()]
      .map(([channel, count]) => ({ channel, count }))
      .sort((a, b) => b.count - a.count || a.channel.localeCompare(b.channel))
      .slice(0, 12);
  }
  return out;
}
