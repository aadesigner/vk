import { useMemo, useState, useEffect, Suspense, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminGetStats } from "@workspace/api-client-react";
import { ADMIN_QUERY_OPTIONS, adminStatsQuery, refreshAdminDashboard } from "@/lib/admin-query-options";
import { AdminQueryFallback } from "@/components/admin-query-fallback";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users, Search, DollarSign, Server, TrendingUp, TrendingDown,
  RefreshCw, ArrowRight, Clock, Car, ReceiptText, Database,
  Activity, UserPlus, BarChart3, Zap, Globe, CreditCard, Megaphone,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { lazyWithRetry } from "@/lib/lazy-with-retry";
import {
  type ExtendedStats,
  type DashboardPeriod,
  type ChartMetric,
  type ChartRange,
  derivePeriodMetrics,
  fillDays,
  fmtEuro,
  fmtCompact,
  PERIOD_LABELS,
  PERIOD_COMPARE_LABEL,
  previousComparePeriod,
  slicePeriodBreakdown,
  revenueSourceParts,
  signupSourceParts,
  acquisitionChannelShortLabel,
  acquisitionChannelTintClass,
  acquisitionChannelTextClass,
} from "@/lib/admin-dashboard-stats";

/** Recharts stays out of the admin layout / nav graph — load only when Overview paints the chart. */
const AdminDashboardChart = lazyWithRetry(() => import("@/pages/admin/admin-dashboard-chart"));
const AdminCountrySignupsChart = lazyWithRetry(() =>
  import("@/pages/admin/admin-dashboard-breakdown-charts").then((m) => ({
    default: m.AdminCountrySignupsChart,
  })),
);
const AdminCountryPurchasesChart = lazyWithRetry(() =>
  import("@/pages/admin/admin-dashboard-breakdown-charts").then((m) => ({
    default: m.AdminCountryPurchasesChart,
  })),
);
const AdminPaymentMethodsChart = lazyWithRetry(() =>
  import("@/pages/admin/admin-dashboard-breakdown-charts").then((m) => ({
    default: m.AdminPaymentMethodsChart,
  })),
);
const AdminSalesBySourceChart = lazyWithRetry(() =>
  import("@/pages/admin/admin-dashboard-breakdown-charts").then((m) => ({
    default: m.AdminSalesBySourceChart,
  })),
);

const BRAND = "hsl(217, 91%, 50%)";
const BRAND_LIGHT = "hsl(217, 91%, 50%)";
const BRAND_MUTED = "hsl(217, 55%, 55%)";
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const PERIODS: DashboardPeriod[] = ["today", "yesterday", "week", "month", "lastMonth", "quarter", "year"];
const CHART_RANGES: ChartRange[] = [7, 30, 90];
const CHART_METRICS: { id: ChartMetric; label: string; color: string; grad: string }[] = [
  { id: "revenue", label: "Revenue", color: BRAND, grad: "gradRevenue" },
  { id: "checks", label: "Checks", color: BRAND_MUTED, grad: "gradChecks" },
  { id: "signups", label: "Signups", color: BRAND_LIGHT, grad: "gradUsers" },
];

const PAYMENT_STATUS_STYLES: Record<string, { bar: string; dot: string }> = {
  completed: { bar: "bg-primary", dot: "bg-primary" },
  pending: { bar: "bg-amber-500", dot: "bg-amber-500" },
  failed: { bar: "bg-red-500", dot: "bg-red-500" },
  revoked: { bar: "bg-orange-500", dot: "bg-orange-500" },
};

function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-lg md:rounded-xl border border-border/50 bg-card shadow-sm", className)}>
      {children}
    </div>
  );
}

function SectionHead({
  title,
  action,
  icon: Icon,
}: {
  title: string;
  action?: React.ReactNode;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2.5 md:mb-3">
      <div className="flex items-center gap-2 min-w-0">
        {Icon && <Icon className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary/70 shrink-0" />}
        <h2 className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function TrendBadge({ value, compact }: { value: number | null; compact?: boolean }) {
  if (value == null) return null;
  const up = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-medium tabular-nums",
        compact ? "text-[11px] md:text-xs" : "text-xs md:text-sm",
        up ? "text-primary" : "text-red-600 dark:text-red-400",
      )}
    >
      {up ? <TrendingUp className="h-3 w-3 md:h-3.5 md:w-3.5" /> : <TrendingDown className="h-3 w-3 md:h-3.5 md:w-3.5" />}
      {Math.abs(value)}%
    </span>
  );
}

function StatCell({
  label,
  value,
  trend,
  compareLabel,
  footnote,
  sourceParts,
  icon: Icon,
  highlight,
  size = "compact",
  onClick,
  selected,
}: {
  label: string;
  value: string;
  trend?: number | null;
  compareLabel?: string;
  /** Small secondary line (e.g. legacy text footnote). */
  footnote?: string | null;
  /** Where revenue/signups came from — shown between value and label. */
  sourceParts?: Array<{ label: string; value: string; channel?: string }> | null;
  icon?: React.ElementType;
  highlight?: boolean;
  size?: "main" | "compact";
  onClick?: () => void;
  selected?: boolean;
}) {
  const isMain = size === "main";
  const interactive = Boolean(onClick);
  const titleHint = footnote
    ?? (sourceParts?.length
      ? sourceParts.map((p) => `${p.value} ${p.label}`).join(" · ")
      : undefined);

  /** Quiet attribution line: €82 FB | €40 Direct — brand color on amount + name. */
  const renderSourceBreakdown = (opts?: { className?: string }) => {
    if (sourceParts?.length) {
      return (
        <p
          className={cn(
            "text-[10px] md:text-[13px] leading-snug tracking-tight",
            "line-clamp-2 md:line-clamp-none",
            opts?.className,
          )}
          title={titleHint}
        >
          {sourceParts.map((part, i) => {
            const color = acquisitionChannelTextClass(part.channel ?? part.label);
            return (
              <span key={`${part.channel ?? part.label}-${part.value}`} className="inline">
                {i > 0 ? (
                  <span className="text-muted-foreground/30 mx-1.5 md:mx-2 font-light" aria-hidden>
                    |
                  </span>
                ) : null}
                <span className={cn("tabular-nums font-semibold", color)}>{part.value}</span>
                {" "}
                <span className={cn("font-medium opacity-90", color)}>{part.label}</span>
              </span>
            );
          })}
        </p>
      );
    }
    if (footnote) {
      return (
        <p
          className={cn(
            "text-[10px] md:text-xs text-muted-foreground/90 leading-snug line-clamp-2",
            opts?.className,
          )}
          title={footnote}
        >
          {footnote}
        </p>
      );
    }
    return null;
  };

  const panel = (
    <Panel
      className={cn(
        "px-3 py-2.5 sm:px-3.5 sm:py-3",
        isMain && [
          "border-t-[3px] border-t-primary bg-gradient-to-b from-primary/[0.05] to-card",
          "md:px-6 md:py-5 md:rounded-xl md:shadow-sm",
        ],
        !isMain && "md:px-4 md:py-3.5",
        highlight && "border-primary/30 bg-primary/[0.03]",
        selected && "ring-2 ring-primary/50 border-primary/40",
        interactive && !selected && "hover:bg-muted/20",
      )}
    >
      {isMain ? (
        <div className="relative md:hidden">
          <div className="min-w-0 pr-8 pb-6">
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold tabular-nums leading-none">{value}</span>
              <TrendBadge value={trend ?? null} compact />
            </div>
            {renderSourceBreakdown({ className: "mt-1.5" })}
            <p className="text-[11px] text-muted-foreground mt-1.5 truncate leading-tight">{label}</p>
            {compareLabel && trend != null && (
              <p className="text-[10px] text-muted-foreground/80 mt-0.5 truncate">{compareLabel}</p>
            )}
          </div>
          {Icon ? (
            <Icon className="pointer-events-none absolute bottom-0 right-0 h-5 w-5 text-primary/70" />
          ) : null}
        </div>
      ) : null}

      {isMain ? (
        <div className="hidden md:block">
          <div className="flex items-start justify-between gap-3">
            {Icon && (
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 ring-1 ring-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
            )}
            <TrendBadge value={trend ?? null} />
          </div>
          <p className="text-3xl lg:text-[2rem] font-bold tabular-nums tracking-tight mt-4 leading-none">
            {value}
          </p>
          {renderSourceBreakdown({ className: "mt-2.5" })}
          <p className="text-base font-medium text-foreground/80 mt-2">{label}</p>
          {compareLabel && trend != null && (
            <p className="text-sm text-muted-foreground mt-1.5">{compareLabel}</p>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-[11px] md:text-sm text-muted-foreground truncate leading-tight">{label}</span>
            {Icon && <Icon className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary/60 shrink-0" />}
          </div>
          <div className="flex items-baseline gap-1.5 mt-1 md:mt-1.5">
            <span className="text-lg md:text-2xl font-bold tabular-nums leading-none">{value}</span>
            <TrendBadge value={trend ?? null} compact />
          </div>
          {renderSourceBreakdown({ className: "mt-1.5" })}
          {compareLabel && trend != null && (
            <p className="text-[11px] md:text-sm text-muted-foreground mt-1 truncate">{compareLabel}</p>
          )}
        </>
      )}
    </Panel>
  );

  if (!interactive) return panel;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-lg md:rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      aria-pressed={selected}
    >
      {panel}
    </button>
  );
}

function PillTabs<T extends string | number>({
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
            "shrink-0 rounded-md px-3 py-1.5 text-xs md:px-3.5 md:py-2 md:text-sm font-medium transition-colors",
            value === opt.id
              ? "bg-primary text-primary-foreground"
              : "bg-muted/60 text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function PaymentStatusCompact({ counts }: { counts: Array<{ status: string; count: number }> }) {
  const total = counts.reduce((s, r) => s + r.count, 0) || 1;

  return (
    <div className="space-y-2.5 md:space-y-3">
      <div className="flex h-2 md:h-2.5 rounded-full overflow-hidden bg-muted">
        {counts.map((row) => {
          const pct = (row.count / total) * 100;
          if (pct <= 0) return null;
          const style = PAYMENT_STATUS_STYLES[row.status] ?? { bar: "bg-primary" };
          return (
            <div
              key={row.status}
              className={cn("h-full", style.bar)}
              style={{ width: `${pct}%` }}
              title={`${row.status}: ${row.count}`}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {counts.map((row) => {
          const style = PAYMENT_STATUS_STYLES[row.status] ?? { dot: "bg-primary" };
          return (
            <div key={row.status} className="flex items-center justify-between gap-2 text-xs md:text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground capitalize truncate">
                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", style.dot)} />
                {row.status}
              </span>
              <span className="font-semibold tabular-nums shrink-0">{row.count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActionRow({
  href, icon: Icon, label, badge,
}: { href: string; icon: React.ElementType; label: string; badge?: number }) {
  return (
    <Link href={href}>
      <div className="flex items-center gap-2.5 rounded-lg md:rounded-xl border border-border/50 bg-card px-3 py-2.5 md:px-4 md:py-3 hover:border-primary/40 hover:bg-primary/[0.03] transition-colors">
        <Icon className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0" />
        <span className="text-xs md:text-sm font-medium truncate flex-1">{label}</span>
        {badge != null && badge > 0 && (
          <Badge className="h-5 min-w-5 px-1.5 text-[10px] bg-amber-500 hover:bg-amber-500 text-white border-0">
            {badge}
          </Badge>
        )}
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
      </div>
    </Link>
  );
}

function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: "bg-primary/10 text-primary",
    pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    failed: "bg-red-500/10 text-red-700 dark:text-red-400",
    revoked: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  };
  return (
    <span className={cn("text-[10px] md:text-xs font-semibold capitalize px-1.5 py-0.5 rounded", styles[status] ?? "bg-muted text-muted-foreground")}>
      {status}
    </span>
  );
}

function formatLastSeen(iso: string): string {
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

type PresencePeriod = "now" | "today" | "yesterday";

const PRESENCE_LIST_LABELS: Record<PresencePeriod, string> = {
  now: "Currently online",
  today: "Active today",
  yesterday: "Active yesterday",
};

const PRESENCE_EMPTY_LABELS: Record<PresencePeriod, string> = {
  now: "No users online in the last 5 minutes",
  today: "No users were active today",
  yesterday: "No users were active yesterday",
};

function presenceUserInitials(user: { name: string | null; email: string }): string {
  const source = user.name?.trim() || user.email.trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function formatPresenceLastActive(iso: string, period: PresencePeriod): string {
  if (period === "now") return formatLastSeen(iso);
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type PresenceUser = {
  id: string;
  email: string;
  name: string | null;
  lastSeenAt: string;
  acquisitionChannel?: string | null;
  totalReports?: number;
};

type PresenceUsersPage = {
  users: PresenceUser[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

async function fetchPresenceUsersPage(period: PresencePeriod, page: number): Promise<PresenceUsersPage> {
  const res = await fetch(
    `${basePath}/api/admin/presence-users?period=${encodeURIComponent(period)}&page=${page}`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error("Failed to load online users");
  return res.json() as Promise<PresenceUsersPage>;
}

function PresenceUserList({
  users,
  period,
  loading,
}: {
  users: PresenceUser[];
  period: PresencePeriod;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="divide-y divide-border/40">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3.5 py-2.5 md:px-4 md:py-3">
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-44" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 md:py-12 px-4 text-center">
        <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center mb-3">
          <Users className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-xs md:text-sm text-muted-foreground">{PRESENCE_EMPTY_LABELS[period]}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/40">
      {users.map((u) => {
        const channelKey = u.acquisitionChannel?.trim() || null;
        const channelLabel = channelKey
          ? acquisitionChannelShortLabel(channelKey)
          : "No channel";
        const reports = u.totalReports ?? 0;
        const reportsLabel = `${reports} report${reports === 1 ? "" : "s"}`;
        return (
          <Link key={u.id} href={`/adminx/users/${u.id}`}>
            <div className="group flex items-center gap-2 md:gap-3 px-3 py-2 md:px-4 md:py-3 hover:bg-muted/40 transition-colors">
              <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-[10px] md:text-xs font-semibold ring-1 ring-primary/10">
                {presenceUserInitials(u)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs md:text-sm font-medium truncate group-hover:text-primary transition-colors">
                  {u.name || u.email}
                </p>
                {u.name ? (
                  <p className="text-[11px] md:text-xs text-muted-foreground truncate">{u.email}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                <span
                  className={cn(
                    "inline-flex items-center max-w-[4.75rem] sm:max-w-[7.5rem] md:max-w-[9rem] truncate rounded border px-1 py-px md:px-1.5 md:py-0.5 md:rounded-md",
                    "text-[9px] md:text-[11px] font-medium leading-none",
                    acquisitionChannelTintClass(channelKey),
                  )}
                  title={channelLabel}
                >
                  {channelLabel}
                </span>
                <span
                  className="text-[9px] md:text-[11px] text-muted-foreground tabular-nums whitespace-nowrap"
                  title={reportsLabel}
                >
                  {reports}
                  <span className="hidden sm:inline">{` report${reports === 1 ? "" : "s"}`}</span>
                </span>
                <span className="text-[10px] md:text-xs text-muted-foreground tabular-nums whitespace-nowrap ml-0.5">
                  {formatPresenceLastActive(u.lastSeenAt, period)}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary/60 transition-colors hidden sm:block" />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default function AdminOverview() {
  const queryClient = useQueryClient();
  const [dashboardRefreshing, setDashboardRefreshing] = useState(false);
  const { data: rawStats, isLoading, isError, error, isFetching, dataUpdatedAt } = useAdminGetStats({
    query: adminStatsQuery(),
  });
  const stats = rawStats as unknown as ExtendedStats | undefined;
  const [period, setPeriod] = useState<DashboardPeriod>("today");
  const [chartMetric, setChartMetric] = useState<ChartMetric>("revenue");
  const [chartRange, setChartRange] = useState<ChartRange>(30);
  const [presencePeriod, setPresencePeriod] = useState<PresencePeriod>("now");
  const [presencePage, setPresencePage] = useState(1);

  useEffect(() => {
    setPresencePage(1);
  }, [presencePeriod]);

  const { data: presencePageData, isLoading: presenceUsersLoading, isFetching: presenceUsersFetching } = useQuery<PresenceUsersPage>({
    ...ADMIN_QUERY_OPTIONS,
    queryKey: ["admin", "presence-users", presencePeriod, presencePage],
    queryFn: () => fetchPresenceUsersPage(presencePeriod, presencePage),
    enabled: Boolean(stats?.onlinePresence),
    staleTime: 30_000,
  });

  const [chartHeight, setChartHeight] = useState(180);

  useEffect(() => {
    const update = () => {
      if (window.innerWidth < 640) setChartHeight(168);
      else if (window.innerWidth < 1024) setChartHeight(200);
      else setChartHeight(220);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const derived = useMemo(() => {
    if (!stats) return null;

    const periodMetrics = derivePeriodMetrics(stats, period);
    const checksSource = stats.checksByDay90 ?? stats.checksByDay30 ?? [];
    const revenueSource = stats.revenueByDay90 ?? stats.revenueByDay30 ?? [];
    const usersSource = stats.usersByDay90 ?? stats.usersByDay ?? [];

    const chartData = {
      revenue: fillDays(revenueSource, chartRange, "revenue"),
      checks: fillDays(checksSource, chartRange, "count"),
      signups: fillDays(usersSource, chartRange, "count"),
    }[chartMetric];

    const activeChart = CHART_METRICS.find((m) => m.id === chartMetric)!;
    const compareLabel = PERIOD_COMPARE_LABEL[period];
    const chartTotal = chartData.reduce((sum, row) => sum + row.value, 0);
    const comparePeriod = previousComparePeriod(period);
    const countrySignupRows = slicePeriodBreakdown(stats.signupsByCountry, period);
    const countryPurchaseRows = slicePeriodBreakdown(stats.purchasesByCountry, period);
    const methodRows = slicePeriodBreakdown(stats.paymentsByMethod, period);
    const sourceRows = slicePeriodBreakdown(stats.salesBySource, period);
    const channelRows = slicePeriodBreakdown(stats.salesByChannel, period);
    const signupChannelRows = slicePeriodBreakdown(stats.signupsByChannel, period);
    const revenueSourceChips = revenueSourceParts(channelRows);
    const signupSourceChips = signupSourceParts(signupChannelRows);
    const countrySignupPrev = comparePeriod
      ? slicePeriodBreakdown(stats.signupsByCountry, comparePeriod)
      : undefined;
    const countryPurchasePrev = comparePeriod
      ? slicePeriodBreakdown(stats.purchasesByCountry, comparePeriod)
      : undefined;
    const methodPrev = comparePeriod
      ? slicePeriodBreakdown(stats.paymentsByMethod, comparePeriod)
      : undefined;
    const sourcePrev = comparePeriod
      ? slicePeriodBreakdown(stats.salesBySource, comparePeriod)
      : undefined;

    return {
      periodMetrics,
      chartData,
      chartTotal,
      activeChart,
      compareLabel,
      countrySignupRows,
      countryPurchaseRows,
      methodRows,
      sourceRows,
      revenueSourceChips,
      signupSourceChips,
      countrySignupPrev,
      countryPurchasePrev,
      methodPrev,
      sourcePrev,
      pendingOpen: stats.pendingVinChecksOpen ?? 0,
      recentPending: stats.recentPendingVinChecks ?? [],
      totalRevStr: fmtEuro(Number(stats.totalRevenue) || 0),
      cacheStr: `${Number(stats.cacheHitRate || 0).toFixed(1)}%`,
    };
  }, [stats, period, chartMetric, chartRange]);

  const presenceCounts = useMemo(() => ({
    now: stats?.onlinePresence?.onlineNow ?? 0,
    today: stats?.onlinePresence?.activeToday ?? 0,
    yesterday: stats?.onlinePresence?.activeYesterday ?? 0,
  }), [stats?.onlinePresence]);

  const presenceUsers = presencePageData?.users ?? [];
  const presencePageCount = presencePageData?.pageCount ?? 1;
  const presenceTotal = presencePageData?.total ?? 0;
  const presenceRangeStart = presenceTotal === 0
    ? 0
    : ((presencePageData?.page ?? presencePage) - 1) * (presencePageData?.pageSize ?? 10) + 1;
  const presenceRangeEnd = presenceTotal === 0
    ? 0
    : Math.min(presenceRangeStart + presenceUsers.length - 1, presenceTotal);

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })
    : null;

  const statsRefreshing = isFetching || dashboardRefreshing;

  const handleDashboardRefresh = useCallback(async () => {
    setDashboardRefreshing(true);
    try {
      await refreshAdminDashboard(queryClient);
    } finally {
      setDashboardRefreshing(false);
    }
  }, [queryClient]);

  return (
    <AdminQueryFallback
      isLoading={isLoading}
      isError={isError}
      isFetching={statsRefreshing}
      error={error}
      refetch={() => { void handleDashboardRefresh(); }}
      hasData={!!stats}
      message="Failed to load dashboard"
      skeleton={(
        <div className="space-y-3">
          <Skeleton className="h-8 w-40" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
          <Skeleton className="h-44 rounded-lg" />
        </div>
      )}
    >
      <div className="space-y-4 md:space-y-5 lg:space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-1">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Dashboard</h1>
            {lastUpdated && (
              <p className="text-xs md:text-sm text-muted-foreground mt-1.5 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-30" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                Live · updated {lastUpdated}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { void handleDashboardRefresh(); }}
            disabled={statsRefreshing}
            className="h-9 md:h-10 gap-1.5 px-3 text-xs md:text-sm shrink-0"
          >
            <RefreshCw className={cn("h-4 w-4", statsRefreshing && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>

        {/* Pending alert */}
        {(derived?.pendingOpen ?? 0) > 0 && (
          <Link href="/adminx/pending-vin-checks">
            <Panel className="flex items-center gap-3 px-3.5 py-2.5 md:px-4 md:py-3 border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors cursor-pointer">
              <Clock className="h-4 w-4 md:h-5 md:w-5 text-amber-600 shrink-0" />
              <p className="text-xs md:text-sm font-medium flex-1 min-w-0 truncate">
                <span className="font-bold">{derived?.pendingOpen}</span> pending report{derived?.pendingOpen === 1 ? "" : "s"} to publish
              </p>
              <ArrowRight className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            </Panel>
          </Link>
        )}

        {/* Period stats */}
        <section>
          <SectionHead title="Performance" icon={BarChart3} />
          <div className="mb-2.5 md:mb-3">
            <PillTabs<DashboardPeriod> value={period} options={PERIODS.map((p) => ({ id: p, label: PERIOD_LABELS[p] }))} onChange={(id) => setPeriod(id)} />
          </div>
          <div className="grid grid-cols-3 gap-2.5 md:gap-5">
            <StatCell
              size="main"
              label="Revenue"
              value={fmtCompact(derived?.periodMetrics.revenue ?? 0)}
              trend={derived?.periodMetrics.revenueTrend}
              compareLabel={derived?.compareLabel}
              sourceParts={derived?.revenueSourceChips}
              icon={DollarSign}
            />
            <StatCell
              size="main"
              label="Checks"
              value={String(derived?.periodMetrics.checks ?? 0)}
              trend={derived?.periodMetrics.checksTrend}
              compareLabel={derived?.compareLabel}
              icon={Search}
            />
            <StatCell
              size="main"
              label="Signups"
              value={String(derived?.periodMetrics.signups ?? 0)}
              trend={derived?.periodMetrics.signupsTrend}
              compareLabel={derived?.compareLabel}
              sourceParts={derived?.signupSourceChips}
              icon={UserPlus}
            />
          </div>
        </section>

        {/* Online users */}
        {stats?.onlinePresence && (
          <section>
            <SectionHead title="Online users" icon={Activity} />
            <Panel className="overflow-hidden">
              <div className="px-3.5 pt-3.5 pb-2.5 md:px-4 md:pt-4 md:pb-3 border-b border-border/40 bg-muted/20">
                <PillTabs<PresencePeriod>
                  value={presencePeriod}
                  options={([
                    { id: "now" as const, label: `Now · ${presenceCounts.now}` },
                    { id: "today" as const, label: `Today · ${presenceCounts.today}` },
                    { id: "yesterday" as const, label: `Yesterday · ${presenceCounts.yesterday}` },
                  ])}
                  onChange={(id) => setPresencePeriod(id)}
                />
              </div>
              <div className="px-3.5 py-2.5 md:px-4 md:py-3 border-b border-border/40 flex items-center justify-between gap-2 bg-card">
                <h3 className="text-xs md:text-sm font-semibold flex items-center gap-2">
                  {presencePeriod === "now" && presenceCounts.now > 0 && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-40" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </span>
                  )}
                  {PRESENCE_LIST_LABELS[presencePeriod]}
                </h3>
                <span className="text-[11px] md:text-xs text-muted-foreground tabular-nums">
                  {presenceTotal} user{presenceTotal === 1 ? "" : "s"}
                </span>
              </div>
              <PresenceUserList
                users={presenceUsers}
                period={presencePeriod}
                loading={presenceUsersLoading && !presencePageData}
              />
              {presencePageCount > 1 && (
                <div className="border-t border-border/40 px-3.5 py-2.5 md:px-4 md:py-3 bg-muted/10">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                    <p className="text-[11px] md:text-xs text-muted-foreground tabular-nums">
                      {presenceUsersFetching && !presenceUsersLoading ? "Updating… · " : ""}
                      Showing {presenceRangeStart}-{presenceRangeEnd} of {presenceTotal}
                    </p>
                    <PillTabs<number>
                      value={presencePage}
                      options={Array.from({ length: presencePageCount }).map((_, idx) => ({
                        id: idx + 1,
                        label: `Page ${idx + 1}`,
                      }))}
                      onChange={(id) => setPresencePage(id)}
                    />
                  </div>
                </div>
              )}
            </Panel>
          </section>
        )}

        {/* Country + payment breakdowns (same period pills as Performance) */}
        <section>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 md:gap-4">
            <Panel className="overflow-hidden">
              <div className="px-3.5 pt-3 pb-2 md:px-4 md:pt-3.5 md:pb-2 border-b border-border/40 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Globe className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                  <h3 className="text-xs md:text-sm font-semibold truncate">Purchases by country</h3>
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0">{PERIOD_LABELS[period]}</span>
              </div>
              <div className="px-3.5 py-3 md:px-4 md:py-3.5">
                <Suspense fallback={<Skeleton className="h-40 w-full rounded-lg" />}>
                  <AdminCountryPurchasesChart
                    data={derived?.countryPurchaseRows ?? []}
                    previousData={derived?.countryPurchasePrev}
                  />
                </Suspense>
              </div>
            </Panel>

            <Panel className="overflow-hidden">
              <div className="px-3.5 pt-3 pb-2 md:px-4 md:pt-3.5 md:pb-2 border-b border-border/40 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <UserPlus className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                  <h3 className="text-xs md:text-sm font-semibold truncate">Signups by country</h3>
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0">{PERIOD_LABELS[period]}</span>
              </div>
              <div className="px-3.5 py-3 md:px-4 md:py-3.5">
                <Suspense fallback={<Skeleton className="h-40 w-full rounded-lg" />}>
                  <AdminCountrySignupsChart
                    data={derived?.countrySignupRows ?? []}
                    previousData={derived?.countrySignupPrev}
                  />
                </Suspense>
              </div>
            </Panel>

            <Panel className="overflow-hidden">
              <div className="px-3.5 pt-3 pb-2 md:px-4 md:pt-3.5 md:pb-2 border-b border-border/40 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <CreditCard className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                  <h3 className="text-xs md:text-sm font-semibold truncate">Payment mix</h3>
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0">{PERIOD_LABELS[period]}</span>
              </div>
              <div className="px-3.5 py-3 md:px-4 md:py-3.5">
                <Suspense fallback={<Skeleton className="h-28 w-full rounded-lg" />}>
                  <AdminPaymentMethodsChart
                    data={derived?.methodRows ?? []}
                    previousData={derived?.methodPrev}
                  />
                </Suspense>
              </div>
            </Panel>

            <Panel className="overflow-hidden">
              <div className="px-3.5 pt-3 pb-2 md:px-4 md:pt-3.5 md:pb-2 border-b border-border/40 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Megaphone className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                  <h3 className="text-xs md:text-sm font-semibold truncate">Sales by source</h3>
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0">{PERIOD_LABELS[period]}</span>
              </div>
              <div className="px-3.5 py-3 md:px-4 md:py-3.5">
                <Suspense fallback={<Skeleton className="h-28 w-full rounded-lg" />}>
                  <AdminSalesBySourceChart
                    data={derived?.sourceRows ?? []}
                    previousData={derived?.sourcePrev}
                  />
                </Suspense>
              </div>
            </Panel>
          </div>
        </section>

        {/* Lifetime + ops strip */}
        <section>
          <SectionHead title="Totals" icon={Zap} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 md:gap-4">
            <StatCell label="All-time revenue" value={derived?.totalRevStr ?? "—"} icon={DollarSign} />
            <StatCell label="VIN checks" value={String(stats?.totalVinChecks ?? "—")} icon={Zap} />
            <StatCell label="Users" value={String(stats?.totalUsers ?? "—")} icon={Users} />
            <StatCell
              label="Pending queue"
              value={String(derived?.pendingOpen ?? 0)}
              icon={Clock}
              highlight={(derived?.pendingOpen ?? 0) > 0}
            />
          </div>
        </section>

        {/* Chart */}
        <Panel className="overflow-hidden">
          <div className="px-3.5 pt-3.5 pb-2.5 md:px-5 md:pt-4 md:pb-3 border-b border-border/40 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <BarChart3 className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0" />
              <span className="text-sm md:text-base font-semibold truncate">
                {derived?.activeChart.label}
                <span className="text-muted-foreground font-normal">
                  {" · "}{chartRange}d
                  {chartMetric === "revenue"
                    ? ` · ${fmtCompact(derived?.chartTotal ?? 0)}`
                    : ` · ${derived?.chartTotal ?? 0}`}
                </span>
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              <PillTabs<ChartMetric>
                value={chartMetric}
                options={CHART_METRICS.map((m) => ({ id: m.id, label: m.label }))}
                onChange={(id) => setChartMetric(id)}
              />
              <PillTabs<ChartRange>
                value={chartRange}
                options={CHART_RANGES.map((r) => ({ id: r, label: `${r}d` }))}
                onChange={(id) => setChartRange(id)}
              />
            </div>
          </div>
          <div className="pl-0 pr-1 pt-3 pb-4 md:px-2 md:pb-5" style={{ minHeight: chartHeight }}>
            <Suspense fallback={<Skeleton className="w-full rounded-lg" style={{ height: chartHeight }} />}>
              <AdminDashboardChart
                height={chartHeight}
                data={derived?.chartData ?? []}
                chartMetric={chartMetric}
                chartRange={chartRange}
                strokeColor={derived?.activeChart.color ?? BRAND}
                gradId={derived?.activeChart.grad ?? "gradRevenue"}
                seriesLabel={derived?.activeChart.label ?? ""}
              />
            </Suspense>
          </div>
        </Panel>

        {/* Payment + health */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <Panel className="p-3.5 md:p-5">
            <SectionHead title="Payments" />
            {!stats?.paymentStatusCounts?.length ? (
              <p className="text-xs md:text-sm text-muted-foreground py-5 text-center">No payment data</p>
            ) : (
              <PaymentStatusCompact counts={stats.paymentStatusCounts} />
            )}
          </Panel>

          <Panel className="p-3.5 md:p-5">
            <SectionHead title="System" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 md:gap-y-3">
              {[
                { label: "Cache hit", value: derived?.cacheStr ?? "—", ok: (stats?.cacheHitRate ?? 0) >= 50 },
                { label: "Providers", value: String(stats?.activeProviders ?? 0), ok: (stats?.activeProviders ?? 0) > 0 },
                { label: "Avg order", value: fmtEuro(Number(stats?.avgOrderValue) || 0), ok: true },
                { label: "Checks/wk", value: String(stats?.checksThisWeek ?? 0), ok: true },
              ].map(({ label, value, ok }) => (
                <div key={label} className="flex items-center justify-between gap-2 text-xs md:text-sm">
                  <span className="text-muted-foreground flex items-center gap-1 truncate">
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", ok ? "bg-primary" : "bg-amber-500")} />
                    {label}
                  </span>
                  <span className="font-semibold tabular-nums shrink-0">{value}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Quick actions — mobile only (sidebar covers desktop) */}
        <section className="md:hidden">
          <SectionHead title="Quick actions" icon={ArrowRight} />
          <div className="grid grid-cols-2 gap-2.5">
            <ActionRow href="/adminx/pending-vin-checks" icon={Clock} label="Pending checks" badge={derived?.pendingOpen} />
            <ActionRow href="/adminx/vin-catalog" icon={Database} label="VIN catalog" />
            <ActionRow href="/adminx/lookups" icon={Search} label="Lookups" />
            <ActionRow href="/adminx/users" icon={Users} label="Users" />
          </div>
        </section>

        {/* Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
          <Panel className="overflow-hidden">
            <div className="px-3.5 py-2.5 md:px-4 md:py-3 border-b border-border/40 flex items-center justify-between">
              <h3 className="text-xs md:text-sm font-semibold">Recent payments</h3>
              <Link href="/adminx/transactions" className="text-[11px] md:text-xs font-medium text-primary hover:underline">All</Link>
            </div>
            {!stats?.recentPayments?.length ? (
              <p className="text-xs md:text-sm text-muted-foreground text-center py-7">No payments yet</p>
            ) : (
              <div className="divide-y divide-border/40">
                {stats.recentPayments.slice(0, 8).map((p) => (
                  <div key={p.id} className="flex items-center gap-2.5 px-3.5 py-2.5 md:px-4 md:py-3 hover:bg-muted/30">
                    <div className="h-8 w-8 md:h-9 md:w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <DollarSign className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[11px] md:text-xs font-semibold truncate">{p.vin ?? "—"}</p>
                      <p className="text-[11px] md:text-xs text-muted-foreground truncate">{p.email ?? p.user_id}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm md:text-base font-bold tabular-nums">{fmtEuro(Number(p.amount) || 0)}</p>
                      <StatusChip status={p.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel className="overflow-hidden">
            <div className="px-3.5 py-2.5 md:px-4 md:py-3 border-b border-border/40 flex items-center justify-between">
              <h3 className="text-xs md:text-sm font-semibold">Pending queue</h3>
              <Link href="/adminx/pending-vin-checks" className="text-[11px] md:text-xs font-medium text-primary hover:underline">All</Link>
            </div>
            {!derived?.recentPending.length ? (
              <p className="text-xs md:text-sm text-muted-foreground text-center py-7">Queue empty</p>
            ) : (
              <div className="divide-y divide-border/40">
                {derived.recentPending.map((p) => {
                  const title = p.year && p.make && p.model ? `${p.year} ${p.make} ${p.model}` : p.vin;
                  return (
                    <Link key={p.id} href={`/adminx/pending-vin-checks/${p.id}`}>
                      <div className="flex items-center gap-2.5 px-3.5 py-2.5 md:px-4 md:py-3 hover:bg-muted/30">
                        <div className="h-8 w-8 md:h-9 md:w-9 rounded-md bg-amber-500/10 flex items-center justify-center shrink-0">
                          <Car className="h-4 w-4 text-amber-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs md:text-sm font-medium truncate">{title}</p>
                          <p className="font-mono text-[11px] md:text-xs text-muted-foreground truncate">{p.vin}</p>
                        </div>
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">
                          {p.requestCount}
                        </Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        {/* Footer links */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { href: "/adminx/analytics", icon: Activity, label: "Analytics" },
            { href: "/adminx/transactions", icon: ReceiptText, label: "Transactions" },
            { href: "/adminx/security", icon: Server, label: "Security" },
          ].map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href}>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-card px-3 py-2 md:px-3.5 md:py-2.5 text-xs md:text-sm font-medium text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors shrink-0">
                <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                {label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </AdminQueryFallback>
  );
}
