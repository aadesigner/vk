export type DaySeries = { date: string; count?: number; revenue?: number };

export type DashboardPeriod = "today" | "yesterday" | "week" | "month" | "lastMonth" | "quarter" | "year";

export type ChartMetric = "revenue" | "checks" | "signups";

export type ChartRange = 7 | 30 | 90;

export type CountryCountRow = { countryCode: string; count: number };

export type PaymentMethodStat = {
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

export type SalesBySourceStat = {
  bucket: AcquisitionBucket;
  count: number;
  revenue: number;
};

export type SalesByChannelStat = {
  channel: string;
  count: number;
  revenue: number;
};

export type SignupsByChannelStat = {
  channel: string;
  count: number;
};

export type ExtendedStats = {
  totalUsers: number;
  totalVinChecks: number;
  totalRevenue: number;
  qualifyingPaymentCount?: number;
  avgOrderValue?: number;
  revenueThisWeek?: number;
  revenueLastWeek?: number;
  revenueThisMonth?: number;
  revenueLastMonth?: number;
  revenueThisYear?: number;
  revenueToday?: number;
  revenueYesterday?: number;
  signupsThisWeek?: number;
  signupsLastWeek?: number;
  signupsThisMonth?: number;
  signupsLastMonth?: number;
  signupsThisYear?: number;
  signupsToday?: number;
  signupsYesterday?: number;
  checksToday: number;
  checksYesterday?: number;
  checksThisWeek?: number;
  checksLastWeek?: number;
  checksThisMonth?: number;
  checksLastMonth?: number;
  checksThisYear?: number;
  cacheHitRate: number;
  activeProviders: number;
  checksByDay: DaySeries[];
  revenueByDay: DaySeries[];
  checksByDay30?: DaySeries[];
  revenueByDay30?: DaySeries[];
  checksByDay90?: DaySeries[];
  revenueByDay90?: DaySeries[];
  usersByDay?: DaySeries[];
  usersByDay90?: DaySeries[];
  paymentStatusCounts?: Array<{ status: string; count: number }>;
  recentPayments: Array<{
    id: number;
    user_id: string;
    vin: string | null;
    amount: number;
    currency: string;
    status: string;
    created_at: string;
    email: string | null;
    name: string | null;
  }>;
  pendingVinChecksOpen?: number;
  recentPendingVinChecks?: Array<{
    id: number;
    vin: string;
    createdAt: string;
    updatedAt: string;
    requestCount: number;
    year?: number | null;
    make?: string | null;
    model?: string | null;
  }>;
  onlinePresence?: {
    onlineNow: number;
    activeToday: number;
    activeYesterday: number;
  };
  signupsByCountry?: Record<DashboardPeriod, CountryCountRow[]>;
  purchasesByCountry?: Record<DashboardPeriod, CountryCountRow[]>;
  paymentsByMethod?: Record<DashboardPeriod, PaymentMethodStat[]>;
  salesBySource?: Record<DashboardPeriod, SalesBySourceStat[]>;
  salesByChannel?: Record<DashboardPeriod, SalesByChannelStat[]>;
  signupsByChannel?: Record<DashboardPeriod, SignupsByChannelStat[]>;
};

export function slicePeriodBreakdown<T>(
  maps: Record<DashboardPeriod, T[]> | undefined,
  period: DashboardPeriod,
): T[] {
  if (!maps) return [];
  return maps[period] ?? [];
}

/** Prior period used for country / method Δ on the dashboard breakdowns. */
export function previousComparePeriod(period: DashboardPeriod): DashboardPeriod | null {
  switch (period) {
    case "today":
      return "yesterday";
    case "month":
      return "lastMonth";
    default:
      return null;
  }
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodStat["method"], string> = {
  paypal: "PayPal",
  pok: "POK",
  credit: "Credit",
  free: "Free",
};

export const ACQUISITION_BUCKET_LABELS: Record<AcquisitionBucket, string> = {
  paid_ads: "Paid ads",
  organic_social: "Organic social",
  google: "Google",
  referral: "Referral sites",
  direct: "Direct",
  unknown: "Unknown",
};

/** Short labels for the Revenue card footnote. */
export const ACQUISITION_CHANNEL_SHORT: Record<string, string> = {
  meta_ads: "FB ads",
  facebook_ads: "FB ads",
  instagram_ads: "Insta ads",
  facebook_social: "FB social",
  instagram_social: "Insta social",
  meta_social: "Meta social",
  threads_social: "Threads",
  messenger_social: "Messenger",
  tiktok_ads: "TikTok ads",
  tiktok_social: "TikTok",
  google_ads: "Google ads",
  google_organic: "Google",
  google: "Google",
  bing_ads: "Bing ads",
  x_ads: "X ads",
  x_social: "X social",
  linkedin_ads: "LinkedIn ads",
  linkedin_social: "LinkedIn",
  youtube_social: "YouTube",
  youtube_ads: "YouTube ads",
  whatsapp_social: "WhatsApp",
  telegram_social: "Telegram",
  reddit_social: "Reddit",
  pinterest_social: "Pinterest",
  snapchat_social: "Snapchat",
  referral: "Referral",
  direct: "Direct",
  paid_ads: "Ads",
  organic_social: "Social",
  unknown: "Other",
};

export function acquisitionChannelShortLabel(channel: string): string {
  const key = channel.trim().toLowerCase();
  if (ACQUISITION_CHANNEL_SHORT[key]) return ACQUISITION_CHANNEL_SHORT[key];
  if (key.endsWith("_ads")) return key.replace(/_ads$/, " ads").replace(/_/g, " ");
  if (key.endsWith("_social")) return key.replace(/_social$/, " social").replace(/_/g, " ");
  return key.replace(/_/g, " ") || "Other";
}

/** True for unknown / rolled-up “Other” — always sorted last, never by size. */
export function isOtherAcquisitionChannel(channel: string | null | undefined): boolean {
  const key = (channel ?? "").trim().toLowerCase();
  return !key || key === "unknown" || key === "other";
}

/**
 * Brand-aligned acquisition colors (shared by online badges + metric cards).
 * Soft fills for badges; solid text for card attribution lines.
 */
const ACQ_BRAND: Record<string, { text: string; tint: string }> = {
  // Meta / Facebook — #1877F2
  meta: {
    text: "text-[#1877F2]",
    tint: "bg-[#1877F2]/10 text-[#166FE5] border-[#1877F2]/25",
  },
  // Instagram — #E4405F
  instagram: {
    text: "text-[#E4405F]",
    tint: "bg-[#E4405F]/10 text-[#D62956] border-[#E4405F]/25",
  },
  // Google — #4285F4
  google: {
    text: "text-[#4285F4]",
    tint: "bg-[#4285F4]/10 text-[#3367D6] border-[#4285F4]/25",
  },
  // TikTok — ink + brand red accent
  tiktok: {
    text: "text-[#FE2C55]",
    tint: "bg-[#FE2C55]/10 text-[#E11D48] border-[#FE2C55]/25",
  },
  // LinkedIn — #0A66C2
  linkedin: {
    text: "text-[#0A66C2]",
    tint: "bg-[#0A66C2]/10 text-[#004182] border-[#0A66C2]/25",
  },
  // X / Twitter — near-black
  x: {
    text: "text-[#0F1419]",
    tint: "bg-zinc-900/5 text-zinc-800 border-zinc-900/15",
  },
  // Bing — #00809D
  bing: {
    text: "text-[#00809D]",
    tint: "bg-[#00809D]/10 text-[#006F8A] border-[#00809D]/25",
  },
  // Messenger — #006AFF (ready if/when channel is added)
  messenger: {
    text: "text-[#006AFF]",
    tint: "bg-[#006AFF]/10 text-[#005AE0] border-[#006AFF]/25",
  },
  youtube: {
    text: "text-[#FF0000]",
    tint: "bg-[#FF0000]/10 text-[#CC0000] border-[#FF0000]/25",
  },
  whatsapp: {
    text: "text-[#25D366]",
    tint: "bg-[#25D366]/10 text-[#128C7E] border-[#25D366]/25",
  },
  telegram: {
    text: "text-[#229ED9]",
    tint: "bg-[#229ED9]/10 text-[#1A7AA8] border-[#229ED9]/25",
  },
  reddit: {
    text: "text-[#FF4500]",
    tint: "bg-[#FF4500]/10 text-[#CC3700] border-[#FF4500]/25",
  },
  pinterest: {
    text: "text-[#E60023]",
    tint: "bg-[#E60023]/10 text-[#B8001C] border-[#E60023]/25",
  },
  snapchat: {
    text: "text-[#C9A227]",
    tint: "bg-[#FFFC00]/30 text-[#7A6A00] border-[#C9A227]/40",
  },
  threads: {
    text: "text-[#0F1419]",
    tint: "bg-zinc-900/5 text-zinc-800 border-zinc-900/15",
  },
  referral: {
    text: "text-amber-700",
    tint: "bg-amber-50 text-amber-800 border-amber-200/80",
  },
  direct: {
    text: "text-slate-600",
    tint: "bg-slate-100 text-slate-700 border-slate-200/80",
  },
  paid_ads: {
    text: "text-orange-700",
    tint: "bg-orange-50 text-orange-800 border-orange-200/80",
  },
  organic_social: {
    text: "text-rose-600",
    tint: "bg-rose-50 text-rose-700 border-rose-200/80",
  },
  other: {
    text: "text-slate-500",
    tint: "bg-slate-100 text-slate-600 border-slate-200/80",
  },
};

function acquisitionBrandKey(channel: string | null | undefined): keyof typeof ACQ_BRAND {
  const key = (channel ?? "").trim().toLowerCase();
  if (!key || key === "unknown" || key === "other") return "other";
  if (key === "meta_ads" || key === "facebook_ads" || key === "facebook_social" || key.startsWith("facebook") || key.startsWith("meta")) {
    return "meta";
  }
  if (key === "instagram_ads" || key === "instagram_social" || key.startsWith("instagram") || key === "ig") {
    return "instagram";
  }
  if (key === "google_ads" || key === "google_organic" || key === "google" || key.startsWith("google")) {
    return "google";
  }
  if (key === "tiktok_ads" || key === "tiktok_social" || key.startsWith("tiktok")) {
    return "tiktok";
  }
  if (key === "linkedin_ads" || key === "linkedin_social" || key.startsWith("linkedin")) {
    return "linkedin";
  }
  if (key === "x_ads" || key === "x_social" || key.startsWith("x_") || key === "twitter" || key.startsWith("twitter")) {
    return "x";
  }
  if (key === "bing_ads" || key.startsWith("bing")) return "bing";
  if (key === "messenger" || key.startsWith("messenger") || key === "msg") return "messenger";
  if (key.startsWith("youtube")) return "youtube";
  if (key.startsWith("whatsapp")) return "whatsapp";
  if (key.startsWith("telegram")) return "telegram";
  if (key.startsWith("reddit")) return "reddit";
  if (key.startsWith("pinterest")) return "pinterest";
  if (key.startsWith("snapchat")) return "snapchat";
  if (key.startsWith("threads")) return "threads";
  if (key === "referral") return "referral";
  if (key === "direct") return "direct";
  if (key === "paid_ads") return "paid_ads";
  if (key === "organic_social") return "organic_social";
  return "other";
}

/** Soft brand text colors for metric cards (amount + channel name). */
export function acquisitionChannelTextClass(channel: string | null | undefined): string {
  return ACQ_BRAND[acquisitionBrandKey(channel)].text;
}

/** Soft brand fills for online-user channel badges. */
export function acquisitionChannelTintClass(channel: string | null | undefined): string {
  return ACQ_BRAND[acquisitionBrandKey(channel)].tint;
}

/** Compact “€120 FB ads · €20 Insta social” line for the Revenue metric. */
export function formatRevenueSourceFootnote(
  rows: SalesByChannelStat[] | undefined,
  maxParts = 4,
): string | null {
  const parts = revenueSourceParts(rows, maxParts);
  if (!parts?.length) return null;
  return parts.map((p) => `${p.value} ${p.label}`).join(" · ");
}

/** Structured chips for Revenue card — amount + channel. Other always last. */
export function revenueSourceParts(
  rows: SalesByChannelStat[] | undefined,
  maxParts = 4,
): SourceBreakdownPart[] | null {
  if (!rows?.length) return null;
  const withRev = rows.filter((r) => (r.revenue ?? 0) > 0);
  if (withRev.length === 0) return null;

  const named = withRev.filter((r) => !isOtherAcquisitionChannel(r.channel));
  const otherRows = withRev.filter((r) => isOtherAcquisitionChannel(r.channel));
  named.sort((a, b) => b.revenue - a.revenue);

  const otherBudget = otherRows.length > 0 || named.length > maxParts ? 1 : 0;
  const namedSlots = Math.max(0, maxParts - otherBudget);
  const topNamed = named.slice(0, namedSlots);
  const overflowNamed = named.slice(namedSlots);
  const otherRev =
    otherRows.reduce((s, r) => s + r.revenue, 0)
    + overflowNamed.reduce((s, r) => s + r.revenue, 0);

  const parts: SourceBreakdownPart[] = topNamed.map((r) => ({
    label: acquisitionChannelShortLabel(r.channel),
    value: fmtCompact(r.revenue),
    channel: r.channel,
  }));
  if (otherRev > 0.009) {
    parts.push({ label: "Other", value: fmtCompact(otherRev), channel: "other" });
  }
  return parts.length ? parts : null;
}

/** Compact “31 FB ads · 10 Google · 10 Insta social” for the Signups metric. */
export function formatSignupSourceFootnote(
  rows: SignupsByChannelStat[] | undefined,
  maxParts = 4,
): string | null {
  const parts = signupSourceParts(rows, maxParts);
  if (!parts?.length) return null;
  return parts.map((p) => `${p.value} ${p.label}`).join(" · ");
}

/** Structured chips for Signups card — count + channel. Other always last. */
export function signupSourceParts(
  rows: SignupsByChannelStat[] | undefined,
  maxParts = 4,
): SourceBreakdownPart[] | null {
  if (!rows?.length) return null;
  const withCount = rows.filter((r) => r.count > 0);
  if (withCount.length === 0) return null;

  const named = withCount.filter((r) => !isOtherAcquisitionChannel(r.channel));
  const otherRows = withCount.filter((r) => isOtherAcquisitionChannel(r.channel));
  named.sort((a, b) => b.count - a.count);

  const otherBudget = otherRows.length > 0 || named.length > maxParts ? 1 : 0;
  const namedSlots = Math.max(0, maxParts - otherBudget);
  const topNamed = named.slice(0, namedSlots);
  const overflowNamed = named.slice(namedSlots);
  const otherCount =
    otherRows.reduce((s, r) => s + r.count, 0)
    + overflowNamed.reduce((s, r) => s + r.count, 0);

  const parts: SourceBreakdownPart[] = topNamed.map((r) => ({
    label: acquisitionChannelShortLabel(r.channel),
    value: r.count.toLocaleString(),
    channel: r.channel,
  }));
  if (otherCount > 0) {
    parts.push({ label: "Other", value: otherCount.toLocaleString(), channel: "other" });
  }
  return parts.length ? parts : null;
}

export type SourceBreakdownPart = {
  label: string;
  value: string;
  channel: string;
};

export function utcDateKeyDaysAgo(daysAgo: number): string {
  const dt = new Date();
  dt.setUTCDate(dt.getUTCDate() - daysAgo);
  return dt.toISOString().substring(0, 10);
}

/** ISO week Monday (UTC) for the calendar week containing `now`. */
export function utcMondayWeekStartIso(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d.toISOString().substring(0, 10);
}

export function utcYearStartIso(now = new Date()): string {
  return `${now.getUTCFullYear()}-01-01`;
}

export function fmtEuro(amount: number): string {
  return `€${amount.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtCompact(amount: number): string {
  if (amount >= 1000) return `€${(amount / 1000).toFixed(1)}k`;
  return fmtEuro(amount);
}

export function trendPct(current: number, prev: number): number | null {
  if (prev === 0) return current > 0 ? 100 : null;
  return Math.round(((current - prev) / prev) * 100);
}

export function normalizeDayKey(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().substring(0, 10);
  return String(value).substring(0, 10);
}

export function fillDays(
  data: DaySeries[],
  days: number,
  key: "count" | "revenue",
): Array<{ date: string; label: string; value: number }> {
  const map = new Map<string, number>();
  data.forEach((row) => {
    const d = normalizeDayKey(row.date);
    if (!d) return;
    map.set(d, Number((row as Record<string, unknown>)[key] ?? 0));
  });
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const iso = utcDateKeyDaysAgo(i);
    const dt = new Date(`${iso}T12:00:00Z`);
    result.push({
      date: iso,
      label: dt.toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" }),
      value: map.get(iso) ?? 0,
    });
  }
  return result;
}

export function sumSeriesInUtcWindow(
  source: DaySeries[],
  key: "count" | "revenue",
  fromIsoInclusive: string,
  toIsoExclusive?: string,
): number {
  let total = 0;
  for (const row of source) {
    const d = normalizeDayKey(row.date);
    if (!d || d < fromIsoInclusive) continue;
    if (toIsoExclusive && d >= toIsoExclusive) continue;
    total += Number((row as Record<string, unknown>)[key] ?? 0);
  }
  return total;
}

export type PeriodMetrics = {
  revenue: number;
  checks: number;
  signups: number;
  revenueTrend: number | null;
  checksTrend: number | null;
  signupsTrend: number | null;
};

export function derivePeriodMetrics(stats: ExtendedStats, period: DashboardPeriod): PeriodMetrics {
  const checksSeries = stats.checksByDay90 ?? stats.checksByDay30 ?? [];
  const revenueSeries = stats.revenueByDay90 ?? stats.revenueByDay30 ?? [];
  const usersSeries = stats.usersByDay90 ?? stats.usersByDay ?? [];

  const todayIso = utcDateKeyDaysAgo(0);
  const yesterdayIso = utcDateKeyDaysAgo(1);
  const weekStartIso = utcMondayWeekStartIso();
  const monthStartIso = (() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  })();
  const lastMonthStartIso = (() => {
    const now = new Date();
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    return d.toISOString().substring(0, 10);
  })();
  const quarterStartIso = utcDateKeyDaysAgo(89);
  const yearStartIso = utcYearStartIso();

  switch (period) {
    case "today":
      return {
        revenue: stats.revenueToday ?? sumSeriesInUtcWindow(revenueSeries, "revenue", todayIso),
        checks: stats.checksToday ?? sumSeriesInUtcWindow(checksSeries, "count", todayIso),
        signups: stats.signupsToday ?? sumSeriesInUtcWindow(usersSeries, "count", todayIso),
        revenueTrend: trendPct(
          stats.revenueToday ?? 0,
          stats.revenueYesterday ?? 0,
        ),
        checksTrend: trendPct(stats.checksToday ?? 0, stats.checksYesterday ?? 0),
        signupsTrend: trendPct(stats.signupsToday ?? 0, stats.signupsYesterday ?? 0),
      };
    case "yesterday":
      return {
        revenue: stats.revenueYesterday ?? sumSeriesInUtcWindow(
          revenueSeries, "revenue", yesterdayIso, todayIso,
        ),
        checks: stats.checksYesterday ?? sumSeriesInUtcWindow(
          checksSeries, "count", yesterdayIso, todayIso,
        ),
        signups: stats.signupsYesterday ?? sumSeriesInUtcWindow(
          usersSeries, "count", yesterdayIso, todayIso,
        ),
        revenueTrend: null,
        checksTrend: null,
        signupsTrend: null,
      };
    case "week":
      return {
        revenue: stats.revenueThisWeek ?? sumSeriesInUtcWindow(revenueSeries, "revenue", weekStartIso),
        checks: stats.checksThisWeek ?? sumSeriesInUtcWindow(checksSeries, "count", weekStartIso),
        signups: stats.signupsThisWeek ?? sumSeriesInUtcWindow(usersSeries, "count", weekStartIso),
        revenueTrend: trendPct(stats.revenueThisWeek ?? 0, stats.revenueLastWeek ?? 0),
        checksTrend: trendPct(stats.checksThisWeek ?? 0, stats.checksLastWeek ?? 0),
        signupsTrend: trendPct(stats.signupsThisWeek ?? 0, stats.signupsLastWeek ?? 0),
      };
    case "month":
      return {
        revenue: stats.revenueThisMonth ?? sumSeriesInUtcWindow(revenueSeries, "revenue", monthStartIso),
        checks: stats.checksThisMonth ?? sumSeriesInUtcWindow(checksSeries, "count", monthStartIso),
        signups: stats.signupsThisMonth ?? sumSeriesInUtcWindow(usersSeries, "count", monthStartIso),
        revenueTrend: trendPct(stats.revenueThisMonth ?? 0, stats.revenueLastMonth ?? 0),
        checksTrend: trendPct(stats.checksThisMonth ?? 0, stats.checksLastMonth ?? 0),
        signupsTrend: trendPct(stats.signupsThisMonth ?? 0, stats.signupsLastMonth ?? 0),
      };
    case "lastMonth":
      return {
        revenue: stats.revenueLastMonth ?? sumSeriesInUtcWindow(
          revenueSeries, "revenue", lastMonthStartIso, monthStartIso,
        ),
        checks: stats.checksLastMonth ?? sumSeriesInUtcWindow(
          checksSeries, "count", lastMonthStartIso, monthStartIso,
        ),
        signups: stats.signupsLastMonth ?? sumSeriesInUtcWindow(
          usersSeries, "count", lastMonthStartIso, monthStartIso,
        ),
        revenueTrend: null,
        checksTrend: null,
        signupsTrend: null,
      };
    case "quarter":
      return {
        revenue: sumSeriesInUtcWindow(revenueSeries, "revenue", quarterStartIso),
        checks: sumSeriesInUtcWindow(checksSeries, "count", quarterStartIso),
        signups: sumSeriesInUtcWindow(usersSeries, "count", quarterStartIso),
        revenueTrend: null,
        checksTrend: null,
        signupsTrend: null,
      };
    case "year":
      return {
        revenue: stats.revenueThisYear ?? sumSeriesInUtcWindow(revenueSeries, "revenue", yearStartIso),
        checks: stats.checksThisYear ?? sumSeriesInUtcWindow(checksSeries, "count", yearStartIso),
        signups: stats.signupsThisYear ?? sumSeriesInUtcWindow(usersSeries, "count", yearStartIso),
        revenueTrend: null,
        checksTrend: null,
        signupsTrend: null,
      };
  }
}

export const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "This week",
  month: "This month",
  lastMonth: "Last month",
  quarter: "Last 90 days",
  year: String(new Date().getUTCFullYear()),
};

export const PERIOD_COMPARE_LABEL: Partial<Record<DashboardPeriod, string>> = {
  today: "vs yesterday",
  week: "vs last week",
  month: "vs last month",
};
