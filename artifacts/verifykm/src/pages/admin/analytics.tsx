import { useMemo, useState, useCallback, Suspense, type ElementType, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminQueryFallback } from "@/components/admin-query-fallback";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  RefreshCw, DollarSign, Search, UserPlus, Users, Activity,
  Database, Megaphone, Globe, CreditCard, BarChart3, Target,
  MousePointerClick, Link2, Filter, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
  PAYMENT_METHOD_LABELS,
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
  channels: Array<{
    channel: string;
    signups: number;
    buyers: number;
    revenue: number;
    checks: number;
    conversionPct: number | null;
    signupSharePct: number;
    revenueSharePct: number;
    revenuePerSignup: number;
  }>;
  buckets: DimRow[];
  sources: DimRow[];
  mediums: DimRow[];
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

function PillTabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-0.5 -mx-1 px-1 scrollbar-none">
      {options.map((opt) => (
        <button
          key={String(opt.id)}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "shrink-0 rounded-md px-2.5 py-1.5 text-[11px] md:text-xs font-medium transition-colors",
            value === opt.id
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function KpiTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  icon: ElementType;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-card px-3 py-2.5 md:px-3.5 md:py-3 min-w-0">
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <span className="text-[10px] md:text-[11px] text-muted-foreground truncate">{label}</span>
        <Icon className="h-3.5 w-3.5 text-primary/60 shrink-0" />
      </div>
      <p className="text-base md:text-xl font-bold tabular-nums mt-1 leading-none truncate">{value}</p>
    </div>
  );
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border/50 bg-card overflow-hidden", className)}>
      {children}
    </div>
  );
}

function ShareBar({ pct, className }: { pct: number; className?: string }) {
  const width = Math.min(100, Math.max(0, pct));
  return (
    <div className="h-1.5 w-full rounded-full bg-muted/80 overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-[width] duration-300", className ?? "bg-primary")}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function MixBar({ parts }: { parts: Array<{ key: string; pct: number; className: string; label: string }> }) {
  const visible = parts.filter((p) => p.pct > 0);
  if (visible.length === 0) {
    return <div className="h-2.5 w-full rounded-full bg-muted/80" />;
  }
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted/80">
      {visible.map((p) => (
        <div
          key={p.key}
          className={cn("h-full", p.className)}
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
}: {
  icon?: ElementType;
  title: string;
  hint?: string;
}) {
  return (
    <div className="px-3.5 py-3 md:px-4 border-b border-border/40">
      <h2 className="text-xs md:text-sm font-semibold flex items-center gap-2">
        {Icon ? <Icon className="h-3.5 w-3.5 text-primary/70" /> : null}
        {title}
      </h2>
      {hint ? <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p> : null}
    </div>
  );
}

function DimList({
  rows,
  empty,
  colorKey,
}: {
  rows: DimRow[];
  empty: string;
  colorKey?: (row: DimRow) => string;
}) {
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground px-3.5 py-8 text-center">{empty}</p>;
  }
  return (
    <ul className="divide-y divide-border/30">
      {rows.map((row) => {
        const label = prettyDimLabel(row.key);
        const color = colorKey ? colorKey(row) : row.key;
        return (
          <li key={row.key} className="px-3.5 py-2.5 space-y-1.5">
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
            <ShareBar pct={row.signupSharePct} className={acquisitionChannelBarClass(color)} />
          </li>
        );
      })}
    </ul>
  );
}

export default function AdminAnalytics() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<DashboardPeriod>("week");
  const [chartMetric, setChartMetric] = useState<ChartMetric>("revenue");
  const [refreshing, setRefreshing] = useState(false);

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
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-56 rounded-lg" />
        </div>
      )}
    >
      <div className="space-y-4 md:space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary shrink-0" />
              Analytics
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              Acquisition, conversion &amp; ops
              {lastUpdated ? ` · updated ${lastUpdated}` : ""}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { void handleRefresh(); }}
            disabled={busy}
            className="h-9 gap-1.5 px-3 text-xs shrink-0"
          >
            <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>

        <PillTabs
          value={period}
          options={PERIODS.map((p) => ({ id: p, label: PERIOD_LABELS[p] }))}
          onChange={setPeriod}
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-2.5">
          <KpiTile label="Revenue" value={fmtCompact(summary?.revenue ?? 0)} icon={DollarSign} />
          <KpiTile label="Checks" value={(summary?.checks ?? 0).toLocaleString()} icon={Search} />
          <KpiTile label="Signups" value={(summary?.signups ?? 0).toLocaleString()} icon={UserPlus} />
          <KpiTile label="Paying users" value={(summary?.payingUsers ?? 0).toLocaleString()} icon={Users} />
          <KpiTile label="AOV" value={fmtEuro(summary?.aov ?? 0)} icon={DollarSign} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-px rounded-lg border border-border/50 bg-border/40 overflow-hidden">
          {strip.map((item) => (
            <div key={item.label} className="bg-card px-3 py-2 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] text-muted-foreground truncate">{item.label}</span>
                <item.icon className="h-3 w-3 text-muted-foreground/70 shrink-0" />
              </div>
              <p className="text-sm font-semibold tabular-nums mt-0.5 truncate">{item.value}</p>
            </div>
          ))}
        </div>

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

        <Panel>
          <div className="px-3.5 py-3 md:px-4 md:py-3.5 border-b border-border/40 space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xs md:text-sm font-semibold flex items-center gap-2">
                  <Megaphone className="h-3.5 w-3.5 text-primary/70" />
                  Acquisition
                </h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  First-touch channel, source, medium &amp; campaign for {PERIOD_LABELS[period].toLowerCase()}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Coverage</p>
                <p className="text-sm font-semibold tabular-nums">{fmtPct(summary?.attributedPct)}</p>
              </div>
            </div>
            <MixBar parts={mixParts} />
            {(data?.buckets.length ?? 0) > 0 ? (
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {data!.buckets.map((b) => (
                  <span key={b.key} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className={cn("h-1.5 w-1.5 rounded-full", acquisitionChannelBarClass(b.key))} />
                    <span className={acquisitionChannelTextClass(b.key)}>{prettyDimLabel(b.key)}</span>
                    <span className="tabular-nums">{fmtPct(b.signupSharePct)}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          {(data?.channels.length ?? 0) === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-10 px-4">
              No channel data yet (legacy users show as Other once attribution columns are live).
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm min-w-[40rem]">
                <thead>
                  <tr className="border-b border-border/40 text-[10px] md:text-[11px] text-muted-foreground uppercase tracking-wide">
                    <th className="px-3.5 py-2.5 md:px-4 font-medium">Channel</th>
                    <th className="px-2 py-2.5 font-medium text-right tabular-nums">Signups</th>
                    <th className="px-2 py-2.5 font-medium text-right tabular-nums">Buyers</th>
                    <th className="px-2 py-2.5 font-medium text-right tabular-nums">Conv.</th>
                    <th className="px-2 py-2.5 font-medium text-right tabular-nums">€ / su</th>
                    <th className="px-2 py-2.5 font-medium text-right tabular-nums">Revenue</th>
                    <th className="px-3.5 py-2.5 md:px-4 font-medium text-right tabular-nums">Checks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {data!.channels.map((row) => {
                    const label = acquisitionChannelShortLabel(row.channel);
                    const color = acquisitionChannelTextClass(row.channel);
                    return (
                      <tr key={row.channel} className="hover:bg-muted/30">
                        <td className="px-3.5 py-2 md:px-4 min-w-[9rem]">
                          <div className={cn("font-medium", color)}>{label}</div>
                          <div className="mt-1 flex items-center gap-2">
                            <ShareBar pct={row.revenueSharePct} className={acquisitionChannelBarClass(row.channel)} />
                            <span className="text-[10px] tabular-nums text-muted-foreground shrink-0 w-9 text-right">
                              {fmtPct(row.revenueSharePct)}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {row.signups.toLocaleString()}
                          <div className="text-[10px] text-muted-foreground">{fmtPct(row.signupSharePct)}</div>
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{row.buyers.toLocaleString()}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                          {fmtPct(row.conversionPct)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                          {fmtEuro(row.revenuePerSignup)}
                        </td>
                        <td className={cn("px-2 py-2 text-right tabular-nums font-semibold", color)}>
                          {fmtCompact(row.revenue)}
                        </td>
                        <td className="px-3.5 py-2 md:px-4 text-right tabular-nums text-muted-foreground">
                          {row.checks.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <Panel>
            <PanelHeading icon={Megaphone} title="Campaigns" hint="UTM campaign · signups & buyers" />
            {(data?.campaigns.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground px-3.5 py-8 text-center">No campaign tags</p>
            ) : (
              <ul className="divide-y divide-border/30">
                {data!.campaigns.map((c) => (
                  <li key={c.campaign} className="px-3.5 py-2.5 space-y-1.5">
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
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeading icon={Globe} title="Sources" hint="utm_source / click source" />
            <DimList rows={data?.sources ?? []} empty="No source tags" />
          </Panel>

          <Panel>
            <PanelHeading icon={Filter} title="Mediums" hint="utm_medium" />
            <DimList rows={data?.mediums ?? []} empty="No medium tags" />
          </Panel>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <Panel>
            <PanelHeading icon={Link2} title="Referrers" hint="External hostname at first touch" />
            {(data?.referrers.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground px-3.5 py-8 text-center">No referrers</p>
            ) : (
              <ul className="divide-y divide-border/30">
                {data!.referrers.map((r) => (
                  <li key={r.referrer} className="px-3.5 py-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span className="text-xs font-medium truncate" title={r.referrer}>{r.referrer}</span>
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
            )}
          </Panel>

          <Panel>
            <PanelHeading icon={Globe} title="Signups by country" />
            {(data?.countries.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground px-3.5 py-8 text-center">No country data</p>
            ) : (
              <ul className="divide-y divide-border/30">
                {data!.countries.map((c) => {
                  const code = c.countryCode.trim();
                  const name = (!code || code === "—")
                    ? "No country"
                    : (userCountryLabel(code) ?? code);
                  const flag = code.length === 2 ? code.toLowerCase() : null;
                  const share = countryTotal > 0 ? Math.round((c.count / countryTotal) * 1000) / 10 : 0;
                  return (
                    <li key={c.countryCode} className="px-3.5 py-2.5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        {flag ? <FlagImg code={flag} size={14} className="rounded-[2px] shrink-0" /> : (
                          <span className="h-3.5 w-5 shrink-0 rounded-sm bg-muted" />
                        )}
                        <span className="text-xs font-medium truncate flex-1 min-w-0">{name}</span>
                        <span className="text-[11px] tabular-nums text-muted-foreground">{c.count}</span>
                      </div>
                      <ShareBar pct={share} className="bg-primary/70" />
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeading icon={CreditCard} title="Payment mix" />
            {(data?.paymentMethods.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground px-3.5 py-8 text-center">No payments</p>
            ) : (
              <ul className="divide-y divide-border/30">
                {data!.paymentMethods.map((m) => {
                  const share = payTotal > 0 ? Math.round((m.revenue / payTotal) * 1000) / 10 : 0;
                  return (
                    <li key={m.method} className="px-3.5 py-2.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium">{PAYMENT_METHOD_LABELS[m.method] ?? m.method}</span>
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          {fmtCompact(m.revenue)}
                          <span className="text-muted-foreground/50"> · </span>
                          {m.count}
                        </span>
                      </div>
                      <ShareBar pct={share} className="bg-primary/70" />
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </AdminQueryFallback>
  );
}
