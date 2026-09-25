import { useMemo, useState, useCallback, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminQueryFallback } from "@/components/admin-query-fallback";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  RefreshCw, DollarSign, Search, UserPlus, Users, Activity,
  Database, Megaphone, Globe, CreditCard, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { lazyWithRetry } from "@/lib/lazy-with-retry";
import { FlagImg } from "@/components/flag-img";
import { userCountryLabel } from "@/lib/user-countries";
import {
  type DashboardPeriod,
  PERIOD_LABELS,
  fmtCompact,
  fmtEuro,
  acquisitionChannelShortLabel,
  acquisitionChannelTextClass,
  PAYMENT_METHOD_LABELS,
} from "@/lib/admin-dashboard-stats";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const AdminAnalyticsChart = lazyWithRetry(() => import("@/pages/admin/admin-analytics-chart"));

const PERIODS: DashboardPeriod[] = ["today", "yesterday", "week", "month", "lastMonth", "quarter", "year"];

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
  };
  channels: Array<{
    channel: string;
    signups: number;
    buyers: number;
    revenue: number;
    checks: number;
    conversionPct: number | null;
  }>;
  campaigns: Array<{ campaign: string; buyers: number; revenue: number }>;
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
  value: string;
  icon: React.ElementType;
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

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border/50 bg-card overflow-hidden", className)}>
      {children}
    </div>
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
            {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
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
              Acquisition &amp; ops monitoring
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

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2 md:gap-2.5">
          <KpiTile label="Revenue" value={fmtCompact(data?.summary.revenue ?? 0)} icon={DollarSign} />
          <KpiTile label="Checks" value={String(data?.summary.checks ?? 0)} icon={Search} />
          <KpiTile label="Signups" value={String(data?.summary.signups ?? 0)} icon={UserPlus} />
          <KpiTile label="Paying users" value={String(data?.summary.payingUsers ?? 0)} icon={Users} />
          <KpiTile label="AOV" value={fmtEuro(data?.summary.aov ?? 0)} icon={DollarSign} />
          <KpiTile
            label="Cache hit"
            value={`${Number(data?.summary.cacheHitRate ?? 0).toFixed(1)}%`}
            icon={Database}
          />
          <KpiTile label="Online now" value={String(data?.summary.onlineNow ?? 0)} icon={Activity} />
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
          <div className="px-3.5 py-3 md:px-4 md:py-3.5 border-b border-border/40">
            <h2 className="text-xs md:text-sm font-semibold flex items-center gap-2">
              <Megaphone className="h-3.5 w-3.5 text-primary/70" />
              Acquisition channels
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Signups → buyers for {PERIOD_LABELS[period].toLowerCase()}
            </p>
          </div>
          {(data?.channels.length ?? 0) === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-10 px-4">
              No channel data yet (legacy users show as Other once attribution columns are live).
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm min-w-[36rem]">
                <thead>
                  <tr className="border-b border-border/40 text-[10px] md:text-[11px] text-muted-foreground uppercase tracking-wide">
                    <th className="px-3.5 py-2.5 md:px-4 font-medium">Channel</th>
                    <th className="px-2 py-2.5 font-medium text-right tabular-nums">Signups</th>
                    <th className="px-2 py-2.5 font-medium text-right tabular-nums">Buyers</th>
                    <th className="px-2 py-2.5 font-medium text-right tabular-nums">Conv.</th>
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
                        <td className={cn("px-3.5 py-2 md:px-4 font-medium", color)}>{label}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{row.signups.toLocaleString()}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{row.buyers.toLocaleString()}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                          {row.conversionPct == null ? "—" : `${row.conversionPct}%`}
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
          <Panel className="md:col-span-1">
            <div className="px-3.5 py-3 border-b border-border/40">
              <h2 className="text-xs md:text-sm font-semibold">Top campaigns</h2>
            </div>
            {(data?.campaigns.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground px-3.5 py-8 text-center">No campaign tags</p>
            ) : (
              <ul className="divide-y divide-border/30">
                {data!.campaigns.map((c) => (
                  <li key={c.campaign} className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                    <span className="text-xs font-medium truncate min-w-0" title={c.campaign}>{c.campaign}</span>
                    <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                      {fmtCompact(c.revenue)}
                      <span className="text-muted-foreground/50"> · </span>
                      {c.buyers} buyer{c.buyers === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <div className="px-3.5 py-3 border-b border-border/40 flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 text-primary/70" />
              <h2 className="text-xs md:text-sm font-semibold">Signups by country</h2>
            </div>
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
                  return (
                    <li key={c.countryCode} className="flex items-center gap-2 px-3.5 py-2.5">
                      {flag ? <FlagImg code={flag} size={14} className="rounded-[2px] shrink-0" /> : (
                        <span className="h-3.5 w-5 shrink-0 rounded-sm bg-muted" />
                      )}
                      <span className="text-xs font-medium truncate flex-1 min-w-0">{name}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">{c.count}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel>
            <div className="px-3.5 py-3 border-b border-border/40 flex items-center gap-2">
              <CreditCard className="h-3.5 w-3.5 text-primary/70" />
              <h2 className="text-xs md:text-sm font-semibold">Payment mix</h2>
            </div>
            {(data?.paymentMethods.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground px-3.5 py-8 text-center">No payments</p>
            ) : (
              <ul className="divide-y divide-border/30">
                {data!.paymentMethods.map((m) => (
                  <li key={m.method} className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                    <span className="text-xs font-medium">{PAYMENT_METHOD_LABELS[m.method] ?? m.method}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {fmtCompact(m.revenue)}
                      <span className="text-muted-foreground/50"> · </span>
                      {m.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </AdminQueryFallback>
  );
}
