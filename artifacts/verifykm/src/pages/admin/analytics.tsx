import { useMemo, useState, useCallback, Suspense, type ElementType, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminQueryFallback } from "@/components/admin-query-fallback";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  RefreshCw, DollarSign, Search, UserPlus, Users, Activity,
  Database, Megaphone, Globe, CreditCard, BarChart3, Target,
  MousePointerClick, Link2, Filter, Sparkles,
  ExternalLink, ArrowUpDown, TrendingUp, Zap, QrCode,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { RisingCompactEuro, RisingEuro, RisingInteger } from "@/hooks/use-rising-number";
import { lazyWithRetry } from "@/lib/lazy-with-retry";
import { FlagImg } from "@/components/flag-img";
import { userCountryLabel } from "@/lib/user-countries";
import {
  type DashboardPeriod,
  type AcquisitionBucket,
  PERIOD_LABELS,
  fmtCompact,
  fmtEuro,
  ACQUISITION_BUCKET_LABELS,
  ACQUISITION_CHANNEL_SHORT,
  acquisitionChannelShortLabel,
  acquisitionChannelTextClass,
  acquisitionChannelBarClass,
  acquisitionChannelTintClass,
  PAYMENT_METHOD_LABELS,
  isOtherAcquisitionChannel,
} from "@/lib/admin-dashboard-stats";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const AdminAnalyticsChart = lazyWithRetry(() => import("@/pages/admin/admin-analytics-chart"));

const PERIODS: DashboardPeriod[] = ["today", "yesterday", "week", "month", "lastMonth", "quarter", "year"];

const MEDIUM_LABELS: Record<string, string> = {
  cpc: "CPC",
  ppc: "PPC",
  paid: "Paid",
  paidsocial: "Paid social",
  paid_social: "Paid social",
  "paid-social": "Paid social",
  display: "Display",
  retargeting: "Retargeting",
  remarketing: "Remarketing",
  organic: "Organic",
  social: "Social",
  referral: "Referral",
  email: "Email",
  qr: "QR",
  offline: "Offline",
  none: "None",
  unknown: "Unknown",
};

type DimRow = {
  key: string;
  signups: number;
  buyers: number;
  revenue: number;
  conversionPct: number | null;
  signupSharePct: number;
  revenueSharePct: number;
};

type ChannelRow = {
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

type AnalyticsPayload = {
  period: DashboardPeriod;
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
    signupToBuyerPct: number | null;
    revenuePerSignup: number;
    checksPerSignup: number;
    attributedPct: number;
    clickIdPct: number;
  };
  channels: ChannelRow[];
  buckets: DimRow[];
  sources: DimRow[];
  mediums: DimRow[];
  contents?: DimRow[];
  terms?: DimRow[];
  landings?: DimRow[];
  devices?: DimRow[];
  clickIdTypes?: DimRow[];
  campaigns: Array<{
    campaign: string;
    signups: number;
    buyers: number;
    revenue: number;
    conversionPct: number | null;
  }>;
  referrers: Array<{ referrer: string; signups: number; signupSharePct: number }>;
  daily: Array<{ date: string; revenue: number; signups: number; checks: number }>;
  countries: Array<{ countryCode: string; count: number }>;
  paymentMethods: Array<{ method: "paypal" | "pok" | "credit" | "free"; count: number; revenue: number }>;
};

type ChartMetric = "revenue" | "checks" | "signups";
type ChannelSort = "revenue" | "signups" | "conversion" | "efficiency";
type DimTab =
  | "campaigns"
  | "sources"
  | "mediums"
  | "contents"
  | "terms"
  | "landings"
  | "devices"
  | "clickIds"
  | "referrers";

async function fetchAnalytics(period: DashboardPeriod, refresh = false): Promise<AnalyticsPayload> {
  const qs = new URLSearchParams({ period });
  if (refresh) qs.set("refresh", "1");
  const res = await fetch(`${basePath}/api/admin/analytics?${qs}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load analytics");
  return res.json() as Promise<AnalyticsPayload>;
}

function prettyDimLabel(key: string): string {
  const k = key.trim().toLowerCase();
  if (ACQUISITION_CHANNEL_SHORT[k]) return ACQUISITION_CHANNEL_SHORT[k];
  if (k in ACQUISITION_BUCKET_LABELS) return ACQUISITION_BUCKET_LABELS[k as AcquisitionBucket];
  if (MEDIUM_LABELS[k]) return MEDIUM_LABELS[k];
  return k.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Other";
}

function fmtPct(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value.toLocaleString("en", { maximumFractionDigits: 1 })}%`;
}

function formatWindow(from: string, toExclusive: string | null): string {
  const start = new Date(`${from}T00:00:00Z`);
  const end = toExclusive
    ? new Date(new Date(`${toExclusive}T00:00:00Z`).getTime() - 86_400_000)
    : new Date();
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
  const a = start.toLocaleDateString("en", opts);
  const b = end.toLocaleDateString("en", { ...opts, year: start.getUTCFullYear() !== end.getUTCFullYear() ? "numeric" : undefined });
  return a === b ? a : `${a} – ${b}`;
}

function isOfflineChannel(channel: string): boolean {
  const k = channel.trim().toLowerCase();
  return k === "offline" || k === "qr" || k.startsWith("qr_") || k.startsWith("offline_") || k === "van";
}

function PillTabs<T extends string>({
  value,
  options,
  onChange,
  size = "md",
}: {
  value: T;
  options: Array<{ id: T; label: string; count?: number }>;
  onChange: (id: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-0.5 -mx-1 px-1 scrollbar-none">
      {options.map((opt) => (
        <button
          key={String(opt.id)}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "shrink-0 rounded-md font-medium transition-colors inline-flex items-center gap-1.5",
            size === "sm" ? "px-2 py-1 text-[10px]" : "px-2.5 py-1.5 text-[11px] md:text-xs",
            value === opt.id
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {opt.label}
          {opt.count != null ? (
            <span
              className={cn(
                "tabular-nums rounded px-1 py-px text-[9px] font-semibold",
                value === opt.id ? "bg-primary-foreground/20" : "bg-background/60 text-muted-foreground",
              )}
            >
              {opt.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function KpiTile({
  label,
  value,
  icon: Icon,
  hint,
  accent,
}: {
  label: string;
  value: ReactNode;
  icon: ElementType;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="group relative rounded-xl border border-border/40 bg-gradient-to-b from-card via-card to-card/70 px-3 py-2.5 md:px-3.5 md:py-3 min-w-0 overflow-hidden shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] hover:border-border/70 transition-colors">
      <div
        className={cn("absolute inset-x-0 top-0 h-px opacity-70", accent ?? "bg-gradient-to-r from-transparent via-primary/40 to-transparent")}
      />
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <span className="text-[10px] md:text-[11px] text-muted-foreground truncate tracking-wide uppercase">{label}</span>
        <span className="h-6 w-6 rounded-md bg-primary/8 flex items-center justify-center shrink-0">
          <Icon className="h-3.5 w-3.5 text-primary/70" />
        </span>
      </div>
      <p className="text-base md:text-xl font-bold tabular-nums mt-1.5 leading-none truncate tracking-tight">{value}</p>
      {hint ? <p className="text-[10px] text-muted-foreground/80 mt-1 truncate">{hint}</p> : null}
    </div>
  );
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/40 bg-card overflow-hidden",
        "shadow-[0_10px_28px_-20px_rgba(0,0,0,0.45)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function ShareBar({ pct, className, height = "md" }: { pct: number; className?: string; height?: "sm" | "md" }) {
  const width = Math.min(100, Math.max(0, pct));
  return (
    <div className={cn("w-full rounded-full bg-muted/80 overflow-hidden", height === "sm" ? "h-1" : "h-1.5")}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-300", className ?? "bg-primary")}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function DualShare({
  signupPct,
  revenuePct,
  colorKey,
}: {
  signupPct: number;
  revenuePct: number;
  colorKey: string;
}) {
  return (
    <div className="space-y-1 min-w-[5.5rem]">
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] uppercase tracking-wide text-muted-foreground/70 w-5 shrink-0">su</span>
        <ShareBar pct={signupPct} height="sm" className={cn(acquisitionChannelBarClass(colorKey), "opacity-55")} />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] uppercase tracking-wide text-muted-foreground/70 w-5 shrink-0">€</span>
        <ShareBar pct={revenuePct} height="sm" className={acquisitionChannelBarClass(colorKey)} />
      </div>
    </div>
  );
}

function MixBar({ parts }: { parts: Array<{ key: string; pct: number; className: string; label: string }> }) {
  const visible = parts.filter((p) => p.pct > 0);
  if (visible.length === 0) {
    return <div className="h-3 w-full rounded-full bg-muted/80" />;
  }
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/80 ring-1 ring-border/30">
      {visible.map((p) => (
        <div
          key={p.key}
          className={cn("h-full first:rounded-l-full last:rounded-r-full", p.className)}
          style={{ width: `${p.pct}%` }}
          title={`${p.label} ${fmtPct(p.pct)}`}
        />
      ))}
    </div>
  );
}

function PanelHeading({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon?: ElementType;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-3.5 py-3 md:px-4 border-b border-border/40 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-xs md:text-sm font-semibold flex items-center gap-2">
          {Icon ? <Icon className="h-3.5 w-3.5 text-primary/70" /> : null}
          {title}
        </h2>
        {hint ? <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

function InsightCard({
  label,
  title,
  meta,
  colorKey,
  icon: Icon,
}: {
  label: string;
  title: string;
  meta: string;
  colorKey?: string;
  icon: ElementType;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-gradient-to-br from-muted/30 to-transparent px-3 py-2.5 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground/70" />
      </div>
      <p
        className={cn(
          "text-sm font-semibold mt-1 truncate",
          colorKey ? acquisitionChannelTextClass(colorKey) : "text-foreground",
        )}
        title={title}
      >
        {title}
      </p>
      <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5 truncate">{meta}</p>
    </div>
  );
}

function DimList({
  rows,
  empty,
  colorKey,
  limit = 8,
}: {
  rows: DimRow[];
  empty: string;
  colorKey?: (row: DimRow) => string;
  limit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground px-3.5 py-10 text-center">{empty}</p>;
  }
  const visible = expanded ? rows : rows.slice(0, limit);
  const hidden = rows.length - visible.length;
  return (
    <div>
      <ul className="divide-y divide-border/30">
        {visible.map((row) => {
          const label = prettyDimLabel(row.key);
          const color = colorKey ? colorKey(row) : row.key;
          return (
            <li key={row.key} className="px-3.5 py-2.5 space-y-1.5 hover:bg-muted/20 transition-colors">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className={cn("text-xs font-medium truncate", acquisitionChannelTextClass(color))} title={row.key}>
                  {label}
                </span>
                <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">
                  {fmtCompact(row.revenue)}
                  <span className="text-muted-foreground/50"> · </span>
                  {row.signups.toLocaleString()} su
                  {row.conversionPct != null ? (
                    <>
                      <span className="text-muted-foreground/50"> · </span>
                      {fmtPct(row.conversionPct)}
                    </>
                  ) : null}
                </span>
              </div>
              <DualShare signupPct={row.signupSharePct} revenuePct={row.revenueSharePct} colorKey={color} />
            </li>
          );
        })}
      </ul>
      {hidden > 0 || expanded ? (
        <div className="px-3.5 py-2 border-t border-border/30">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] font-medium text-primary hover:underline underline-offset-2"
          >
            {expanded ? "Show less" : `Show ${hidden} more`}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SortButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
      <ArrowUpDown className="h-3 w-3 opacity-60" />
    </button>
  );
}

export default function AdminAnalytics() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<DashboardPeriod>("week");
  const [chartMetric, setChartMetric] = useState<ChartMetric>("revenue");
  const [refreshing, setRefreshing] = useState(false);
  const [channelSort, setChannelSort] = useState<ChannelSort>("revenue");
  const [bucketFilter, setBucketFilter] = useState<string>("all");
  const [dimTab, setDimTab] = useState<DimTab>("campaigns");

  const { data, isLoading, isError, error, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: ["admin", "analytics", period],
    queryFn: () => fetchAnalytics(period),
    staleTime: 60_000,
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.fetchQuery({
        queryKey: ["admin", "analytics", period],
        queryFn: () => fetchAnalytics(period, true),
      });
    } finally {
      setRefreshing(false);
    }
  }, [period, queryClient]);

  const chartData = useMemo(() => {
    const rows = data?.daily ?? [];
    return rows.map((r) => ({
      label: r.date.slice(5),
      value: chartMetric === "revenue" ? r.revenue : chartMetric === "checks" ? r.checks : r.signups,
    }));
  }, [data?.daily, chartMetric]);

  const chartMeta = {
    revenue: { color: "hsl(var(--primary))", label: "Revenue", grad: "analyticsRev" },
    checks: { color: "#0d9488", label: "Checks", grad: "analyticsChecks" },
    signups: { color: "#7c3aed", label: "Signups", grad: "analyticsSignups" },
  }[chartMetric];

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })
    : null;

  const busy = isFetching || refreshing;
  const summary = data?.summary;
  const countryTotal = data?.countries.reduce((s, c) => s + c.count, 0) ?? 0;
  const payTotal = data?.paymentMethods.reduce((s, m) => s + m.revenue, 0) ?? 0;

  const mixParts = (data?.buckets ?? []).map((b) => ({
    key: b.key,
    pct: b.signupSharePct,
    className: acquisitionChannelBarClass(b.key),
    label: prettyDimLabel(b.key),
  }));

  const insights = useMemo(() => {
    const channels = (data?.channels ?? []).filter((c) => !isOtherAcquisitionChannel(c.channel) && c.signups > 0);
    if (!channels.length) return null;
    const byRevenue = [...channels].sort((a, b) => b.revenue - a.revenue)[0];
    const byConv = [...channels]
      .filter((c) => c.signups >= 2 && c.conversionPct != null)
      .sort((a, b) => (b.conversionPct ?? 0) - (a.conversionPct ?? 0))[0];
    const byEff = [...channels]
      .filter((c) => c.signups >= 2)
      .sort((a, b) => b.revenuePerSignup - a.revenuePerSignup)[0];
    const under = [...channels]
      .filter((c) => c.signups >= 2)
      .map((c) => ({ ...c, gap: c.signupSharePct - c.revenueSharePct }))
      .sort((a, b) => b.gap - a.gap)[0];
    const offline = channels.filter((c) => isOfflineChannel(c.channel));
    const offlineSignups = offline.reduce((s, c) => s + c.signups, 0);
    const offlineRevenue = offline.reduce((s, c) => s + c.revenue, 0);
    return { byRevenue, byConv, byEff, under, offlineSignups, offlineRevenue, offlineCount: offline.length };
  }, [data?.channels]);

  const sortedChannels = useMemo(() => {
    const rows = [...(data?.channels ?? [])];
    const filtered =
      bucketFilter === "all"
        ? rows
        : bucketFilter === "offline"
          ? rows.filter((r) => isOfflineChannel(r.channel) || r.channel === "offline")
          : rows.filter((r) => {
              // Soft match: channel id or parent bucket key in mix
              const k = r.channel.toLowerCase();
              if (bucketFilter === "paid_ads") return k.includes("ads") || k === "paid_ads";
              if (bucketFilter === "organic_social") {
                return k.includes("social") || k === "messenger" || k.includes("whatsapp") || k === "organic_social";
              }
              if (bucketFilter === "google") return k.startsWith("google") || k === "google";
              if (bucketFilter === "referral") return k === "referral";
              if (bucketFilter === "direct") return k === "direct";
              if (bucketFilter === "unknown") return isOtherAcquisitionChannel(r.channel);
              return k === bucketFilter || k.startsWith(`${bucketFilter}_`);
            });

    filtered.sort((a, b) => {
      if (isOtherAcquisitionChannel(a.channel) !== isOtherAcquisitionChannel(b.channel)) {
        return isOtherAcquisitionChannel(a.channel) ? 1 : -1;
      }
      if (channelSort === "signups") return b.signups - a.signups || b.revenue - a.revenue;
      if (channelSort === "conversion") return (b.conversionPct ?? -1) - (a.conversionPct ?? -1) || b.revenue - a.revenue;
      if (channelSort === "efficiency") return b.revenuePerSignup - a.revenuePerSignup || b.revenue - a.revenue;
      return b.revenue - a.revenue || b.signups - a.signups;
    });
    return filtered;
  }, [data?.channels, channelSort, bucketFilter]);

  const dimTabs: Array<{ id: DimTab; label: string; count: number }> = [
    { id: "campaigns", label: "Campaigns", count: data?.campaigns.length ?? 0 },
    { id: "sources", label: "Sources", count: data?.sources.length ?? 0 },
    { id: "mediums", label: "Mediums", count: data?.mediums.length ?? 0 },
    { id: "contents", label: "Content", count: (data?.contents ?? []).filter((r) => r.key !== "untagged").length },
    { id: "terms", label: "Terms", count: data?.terms?.length ?? 0 },
    { id: "landings", label: "Landings", count: data?.landings?.length ?? 0 },
    { id: "devices", label: "Devices", count: data?.devices?.length ?? 0 },
    { id: "clickIds", label: "Click IDs", count: data?.clickIdTypes?.length ?? 0 },
    { id: "referrers", label: "Referrers", count: data?.referrers.length ?? 0 },
  ];

  const strip = [
    { label: "Signup → buyer", value: fmtPct(summary?.signupToBuyerPct), icon: Target },
    { label: "€ / signup", value: fmtEuro(summary?.revenuePerSignup ?? 0), icon: DollarSign },
    { label: "Checks / signup", value: (summary?.checksPerSignup ?? 0).toLocaleString("en", { maximumFractionDigits: 2 }), icon: Search },
    { label: "Attributed", value: fmtPct(summary?.attributedPct), icon: Sparkles },
    { label: "Click IDs", value: fmtPct(summary?.clickIdPct), icon: MousePointerClick },
    { label: "Cache hit", value: fmtPct(Number(summary?.cacheHitRate ?? 0)), icon: Database },
    { label: "Online now", value: (summary?.onlineNow ?? 0).toLocaleString(), icon: Activity },
  ];

  return (
    <AdminQueryFallback
      isLoading={isLoading}
      isError={isError}
      isFetching={busy}
      error={error}
      refetch={() => { void refetch(); }}
      hasData={!!data}
      message="Failed to load analytics"
      skeleton={(
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-56 rounded-lg" />
        </div>
      )}
    >
      <div className="space-y-4 md:space-y-5">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-xl border border-border/40 bg-gradient-to-br from-card via-card to-primary/[0.04] px-3.5 py-3.5 md:px-5 md:py-4 shadow-[0_10px_28px_-20px_rgba(0,0,0,0.45)]">
          <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="h-9 w-9 rounded-xl bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center shrink-0">
                  <BarChart3 className="h-4 w-4 text-primary" />
                </span>
                <div className="min-w-0">
                  <h1 className="text-xl md:text-2xl font-bold tracking-tight">Acquisition</h1>
                  <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                    First-touch channels · conversion · efficiency
                    {data ? ` · ${formatWindow(data.from, data.toExclusive)}` : ""}
                    {lastUpdated ? ` · ${lastUpdated}` : ""}
                  </p>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { void handleRefresh(); }}
              disabled={busy}
              className="h-9 gap-1.5 px-3 text-xs shrink-0 bg-background/60 backdrop-blur-sm"
            >
              <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
          <div className="relative mt-3.5">
            <PillTabs
              value={period}
              options={PERIODS.map((p) => ({ id: p, label: PERIOD_LABELS[p] }))}
              onChange={(p) => {
                setPeriod(p);
                setBucketFilter("all");
              }}
            />
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-2.5">
          <KpiTile label="Revenue" value={<RisingCompactEuro value={summary?.revenue ?? 0} replayKey={period} />} icon={DollarSign} />
          <KpiTile label="Checks" value={<RisingInteger value={summary?.checks ?? 0} replayKey={period} />} icon={Search} />
          <KpiTile label="Signups" value={<RisingInteger value={summary?.signups ?? 0} replayKey={period} />} icon={UserPlus} />
          <KpiTile label="Paying users" value={<RisingInteger value={summary?.payingUsers ?? 0} replayKey={period} />} icon={Users} />
          <KpiTile label="AOV" value={<RisingEuro value={summary?.aov ?? 0} replayKey={period} />} icon={DollarSign} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-px rounded-xl border border-border/50 bg-border/40 overflow-hidden">
          {strip.map((item) => (
            <div key={item.label} className="bg-card/95 px-3 py-2 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] text-muted-foreground truncate">{item.label}</span>
                <item.icon className="h-3 w-3 text-muted-foreground/70 shrink-0" />
              </div>
              <p className="text-sm font-semibold tabular-nums mt-0.5 truncate">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Trend */}
        <Panel>
          <div className="px-3.5 py-3 md:px-4 md:py-3.5 border-b border-border/40 flex items-center justify-between gap-2">
            <h2 className="text-xs md:text-sm font-semibold">Trend</h2>
            <PillTabs
              value={chartMetric}
              options={[
                { id: "revenue" as const, label: "Revenue" },
                { id: "checks" as const, label: "Checks" },
                { id: "signups" as const, label: "Signups" },
              ]}
              onChange={setChartMetric}
              size="sm"
            />
          </div>
          <div className="px-2 py-3 md:px-3 md:py-4">
            {chartData.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-10">No data in this period</p>
            ) : (
              <Suspense fallback={<Skeleton className="h-[200px] w-full rounded-md" />}>
                <AdminAnalyticsChart
                  height={200}
                  data={chartData}
                  metric={chartMetric}
                  strokeColor={chartMeta.color}
                  gradId={chartMeta.grad}
                  seriesLabel={chartMeta.label}
                />
              </Suspense>
            )}
          </div>
        </Panel>

        {/* Acquisition command center */}
        <Panel>
          <div className="px-3.5 py-3.5 md:px-4 md:py-4 border-b border-border/40 space-y-3.5 bg-gradient-to-b from-muted/20 to-transparent">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xs md:text-sm font-semibold flex items-center gap-2">
                  <Megaphone className="h-3.5 w-3.5 text-primary/70" />
                  Channel performance
                </h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Sort, filter by bucket, open users · dual bars = signup share vs revenue share
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Attributed</p>
                  <p className="text-sm font-semibold tabular-nums">{fmtPct(summary?.attributedPct)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Click IDs</p>
                  <p className="text-sm font-semibold tabular-nums">{fmtPct(summary?.clickIdPct)}</p>
                </div>
              </div>
            </div>

            {insights ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <InsightCard
                  label="Top revenue"
                  title={acquisitionChannelShortLabel(insights.byRevenue.channel)}
                  meta={`${fmtCompact(insights.byRevenue.revenue)} · ${insights.byRevenue.signups} su`}
                  colorKey={insights.byRevenue.channel}
                  icon={TrendingUp}
                />
                <InsightCard
                  label="Best converter"
                  title={insights.byConv ? acquisitionChannelShortLabel(insights.byConv.channel) : "—"}
                  meta={insights.byConv ? `${fmtPct(insights.byConv.conversionPct)} · ${insights.byConv.buyers} buyers` : "Need ≥2 signups"}
                  colorKey={insights.byConv?.channel}
                  icon={Target}
                />
                <InsightCard
                  label="Best € / signup"
                  title={insights.byEff ? acquisitionChannelShortLabel(insights.byEff.channel) : "—"}
                  meta={insights.byEff ? `${fmtEuro(insights.byEff.revenuePerSignup)} · ${insights.byEff.signups} su` : "Need ≥2 signups"}
                  colorKey={insights.byEff?.channel}
                  icon={Zap}
                />
                {insights.offlineCount > 0 ? (
                  <InsightCard
                    label="QR / offline"
                    title={`${insights.offlineSignups.toLocaleString()} signups`}
                    meta={`${fmtCompact(insights.offlineRevenue)} · ${insights.offlineCount} channel${insights.offlineCount === 1 ? "" : "s"}`}
                    colorKey="qr_van"
                    icon={QrCode}
                  />
                ) : (
                  <InsightCard
                    label="Watch"
                    title={insights.under && insights.under.gap > 2 ? acquisitionChannelShortLabel(insights.under.channel) : "Balanced mix"}
                    meta={
                      insights.under && insights.under.gap > 2
                        ? `${fmtPct(insights.under.signupSharePct)} su vs ${fmtPct(insights.under.revenueSharePct)} €`
                        : "Signup share ≈ revenue share"
                    }
                    colorKey={insights.under && insights.under.gap > 2 ? insights.under.channel : undefined}
                    icon={Activity}
                  />
                )}
              </div>
            ) : null}

            <MixBar parts={mixParts} />

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setBucketFilter("all")}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  bucketFilter === "all"
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/60 text-muted-foreground hover:bg-muted/50",
                )}
              >
                All
              </button>
              {(data?.buckets ?? []).map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setBucketFilter(b.key === bucketFilter ? "all" : b.key)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors inline-flex items-center gap-1.5",
                    bucketFilter === b.key
                      ? acquisitionChannelTintClass(b.key)
                      : "border-border/60 text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", acquisitionChannelBarClass(b.key))} />
                  {prettyDimLabel(b.key)}
                  <span className="tabular-nums opacity-70">{fmtPct(b.signupSharePct)}</span>
                </button>
              ))}
            </div>
          </div>

          {(data?.channels.length ?? 0) === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-10 px-4">
              No channel data yet (legacy users show as Other once attribution columns are live).
            </p>
          ) : (
            <>
              <div className="px-3.5 py-2 border-b border-border/30 flex items-center gap-1 overflow-x-auto scrollbar-none">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-1 shrink-0">Sort</span>
                <SortButton active={channelSort === "revenue"} label="Revenue" onClick={() => setChannelSort("revenue")} />
                <SortButton active={channelSort === "signups"} label="Signups" onClick={() => setChannelSort("signups")} />
                <SortButton active={channelSort === "conversion"} label="Conv." onClick={() => setChannelSort("conversion")} />
                <SortButton active={channelSort === "efficiency"} label="€ / su" onClick={() => setChannelSort("efficiency")} />
                <span className="ml-auto text-[10px] tabular-nums text-muted-foreground shrink-0">
                  {sortedChannels.length} channel{sortedChannels.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs md:text-sm min-w-[44rem]">
                  <thead>
                    <tr className="border-b border-border/40 text-[10px] md:text-[11px] text-muted-foreground uppercase tracking-wide bg-muted/20">
                      <th className="px-3.5 py-2.5 md:px-4 font-medium">Channel</th>
                      <th className="px-2 py-2.5 font-medium min-w-[7rem]">Share</th>
                      <th className="px-2 py-2.5 font-medium text-right tabular-nums">Signups</th>
                      <th className="px-2 py-2.5 font-medium text-right tabular-nums">Buyers</th>
                      <th className="px-2 py-2.5 font-medium text-right tabular-nums">Conv.</th>
                      <th className="px-2 py-2.5 font-medium text-right tabular-nums">€ / su</th>
                      <th className="px-2 py-2.5 font-medium text-right tabular-nums">Revenue</th>
                      <th className="px-3.5 py-2.5 md:px-4 font-medium text-right tabular-nums">Checks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {sortedChannels.map((row) => {
                      const label = acquisitionChannelShortLabel(row.channel);
                      const color = acquisitionChannelTextClass(row.channel);
                      const refer = encodeURIComponent(row.channel);
                      const offline = isOfflineChannel(row.channel);
                      return (
                        <tr key={row.channel} className="hover:bg-muted/25 transition-colors">
                          <td className="px-3.5 py-2.5 md:px-4 min-w-[9rem]">
                            <Link
                              href={`/adminx/users?refer=${refer}`}
                              className={cn("font-medium inline-flex items-center gap-1.5 hover:underline underline-offset-2", color)}
                            >
                              {offline ? <QrCode className="h-3 w-3 opacity-70" /> : null}
                              {label}
                              <ExternalLink className="h-3 w-3 opacity-40" />
                            </Link>
                          </td>
                          <td className="px-2 py-2.5">
                            <DualShare
                              signupPct={row.signupSharePct}
                              revenuePct={row.revenueSharePct}
                              colorKey={row.channel}
                            />
                          </td>
                          <td className="px-2 py-2.5 text-right tabular-nums">
                            {row.signups.toLocaleString()}
                            <div className="text-[10px] text-muted-foreground">{fmtPct(row.signupSharePct)}</div>
                          </td>
                          <td className="px-2 py-2.5 text-right tabular-nums">{row.buyers.toLocaleString()}</td>
                          <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                            {fmtPct(row.conversionPct)}
                          </td>
                          <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                            {fmtEuro(row.revenuePerSignup)}
                          </td>
                          <td className={cn("px-2 py-2.5 text-right tabular-nums font-semibold", color)}>
                            {fmtCompact(row.revenue)}
                            <div className="text-[10px] font-normal text-muted-foreground">{fmtPct(row.revenueSharePct)}</div>
                          </td>
                          <td className="px-3.5 py-2.5 md:px-4 text-right tabular-nums text-muted-foreground">
                            {row.checks.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {sortedChannels.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-8 px-4">No channels in this bucket for the period.</p>
              ) : null}
            </>
          )}
        </Panel>

        {/* Dimensions explorer — one panel, tabbed */}
        <Panel>
          <PanelHeading
            icon={Filter}
            title="UTM & touch details"
            hint="Campaign tags, creatives, landings, devices — switch tabs instead of scrolling"
            action={
              <span className="text-[10px] tabular-nums text-muted-foreground hidden sm:inline">
                {dimTabs.find((t) => t.id === dimTab)?.count ?? 0} rows
              </span>
            }
          />
          <div className="px-3.5 py-2.5 border-b border-border/30">
            <PillTabs value={dimTab} options={dimTabs} onChange={setDimTab} size="sm" />
          </div>
          <div className="min-h-[12rem]">
            {dimTab === "campaigns" ? (
              (data?.campaigns.length ?? 0) === 0 ? (
                <p className="text-xs text-muted-foreground px-3.5 py-10 text-center">
                  No campaign tags — add <code className="text-[10px]">utm_campaign</code> to ad / QR URLs
                </p>
              ) : (
                <ul className="divide-y divide-border/30">
                  {data!.campaigns.map((c) => (
                    <li key={c.campaign} className="px-3.5 py-2.5 space-y-1.5 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <span className="text-xs font-medium truncate" title={c.campaign}>{c.campaign}</span>
                        <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">
                          {fmtCompact(c.revenue)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[10px] tabular-nums text-muted-foreground">
                        <span>{c.signups.toLocaleString()} su · {c.buyers.toLocaleString()} buyers</span>
                        <span>{fmtPct(c.conversionPct)}</span>
                      </div>
                      <ShareBar
                        pct={summary?.signups ? (c.signups / Math.max(1, summary.signups)) * 100 : 0}
                        className="bg-violet-500/80"
                      />
                    </li>
                  ))}
                </ul>
              )
            ) : null}

            {dimTab === "sources" ? (
              <DimList rows={data?.sources ?? []} empty="No source tags" />
            ) : null}
            {dimTab === "mediums" ? (
              <DimList rows={data?.mediums ?? []} empty="No medium tags" />
            ) : null}
            {dimTab === "contents" ? (
              <DimList
                rows={(data?.contents ?? []).filter((r) => r.key !== "untagged")}
                empty="Tag creatives with utm_content"
              />
            ) : null}
            {dimTab === "terms" ? (
              <DimList rows={data?.terms ?? []} empty="Tag audiences with utm_term" />
            ) : null}
            {dimTab === "landings" ? (
              <DimList rows={data?.landings ?? []} empty="No landing paths yet" colorKey={() => "direct"} />
            ) : null}
            {dimTab === "devices" ? (
              <DimList rows={data?.devices ?? []} empty="No device data" colorKey={() => "direct"} />
            ) : null}
            {dimTab === "clickIds" ? (
              <DimList rows={data?.clickIdTypes ?? []} empty="No click IDs in period" colorKey={() => "paid_ads"} />
            ) : null}

            {dimTab === "referrers" ? (
              (data?.referrers.length ?? 0) === 0 ? (
                <p className="text-xs text-muted-foreground px-3.5 py-10 text-center">No referrers</p>
              ) : (
                <ul className="divide-y divide-border/30">
                  {data!.referrers.map((r) => (
                    <li key={r.referrer} className="px-3.5 py-2.5 space-y-1.5 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <span className="text-xs font-medium truncate inline-flex items-center gap-1.5" title={r.referrer}>
                          <Link2 className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                          {r.referrer}
                        </span>
                        <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">
                          {r.signups.toLocaleString()}
                          <span className="text-muted-foreground/50"> · </span>
                          {fmtPct(r.signupSharePct)}
                        </span>
                      </div>
                      <ShareBar pct={r.signupSharePct} className="bg-slate-500" />
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </div>
        </Panel>

        {/* Geography + payments */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
          <Panel>
            <PanelHeading icon={Globe} title="Signups by country" hint="First-touch geography in period" />
            {(data?.countries.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground px-3.5 py-8 text-center">No country data</p>
            ) : (
              <ul className="divide-y divide-border/30 max-h-[22rem] overflow-y-auto">
                {data!.countries.map((c) => {
                  const code = c.countryCode.trim();
                  const name = (!code || code === "—")
                    ? "No country"
                    : (userCountryLabel(code) ?? code);
                  const flag = code.length === 2 ? code.toLowerCase() : null;
                  const share = countryTotal > 0 ? Math.round((c.count / countryTotal) * 1000) / 10 : 0;
                  return (
                    <li key={c.countryCode} className="px-3.5 py-2.5 space-y-1.5 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-2">
                        {flag ? <FlagImg code={flag} size={14} className="rounded-[2px] shrink-0" /> : (
                          <span className="h-3.5 w-5 shrink-0 rounded-sm bg-muted" />
                        )}
                        <span className="text-xs font-medium truncate flex-1 min-w-0">{name}</span>
                        <span className="text-[11px] tabular-nums text-muted-foreground">{c.count}</span>
                        <span className="text-[10px] tabular-nums text-muted-foreground/70 w-10 text-right">{fmtPct(share)}</span>
                      </div>
                      <ShareBar pct={share} className="bg-primary/70" />
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeading icon={CreditCard} title="Payment mix" hint="Collected revenue by method" />
            {(data?.paymentMethods.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground px-3.5 py-8 text-center">No payments</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border/30">
                {data!.paymentMethods.map((m) => {
                  const share = payTotal > 0 ? Math.round((m.revenue / payTotal) * 1000) / 10 : 0;
                  return (
                    <div key={m.method} className="px-3.5 py-3.5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold">{PAYMENT_METHOD_LABELS[m.method] ?? m.method}</span>
                        <span className="text-[11px] tabular-nums text-muted-foreground">{fmtPct(share)}</span>
                      </div>
                      <p className="text-lg font-bold tabular-nums tracking-tight">{fmtCompact(m.revenue)}</p>
                      <p className="text-[10px] text-muted-foreground tabular-nums">{m.count.toLocaleString()} txns</p>
                      <ShareBar pct={share} className="bg-primary/70" />
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

      </div>
    </AdminQueryFallback>
  );
}
