import {
  fmtEuro,
  fmtCompact,
  trendPct,
  PAYMENT_METHOD_LABELS,
  ACQUISITION_BUCKET_LABELS,
  type CountryCountRow,
  type PaymentMethodStat,
  type SalesBySourceStat,
} from "@/lib/admin-dashboard-stats";
import { userCountryLabel } from "@/lib/user-countries";
import { FlagImg } from "@/components/flag-img";
import { cn } from "@/lib/utils";

function countryDisplayName(countryCode: string): string {
  const code = countryCode.trim();
  if (!code || code === "—" || code === "-" || code.toLowerCase() === "unknown") {
    return "No country set";
  }
  return userCountryLabel(code) ?? code;
}

function flagCodeFor(countryCode: string): string | null {
  const code = countryCode.trim().toLowerCase();
  if (code.length === 2) return code;
  return null;
}

type RankRow = {
  key: string;
  name: string;
  codeHint: string | null;
  count: number;
  share: number;
  deltaPct: number | null;
  revenue?: number;
};

function buildCountryRows(
  data: CountryCountRow[],
  previousData: CountryCountRow[] | undefined,
): RankRow[] {
  const prevMap = new Map(
    (previousData ?? []).map((r) => [r.countryCode.trim().toUpperCase(), r.count]),
  );
  const hasCompare = Boolean(previousData);
  const top = data.slice(0, 7);
  const total = top.reduce((s, r) => s + r.count, 0) || 1;

  return top.map((row, i) => {
    const code = row.countryCode.trim();
    const name = countryDisplayName(code);
    const prevCount = prevMap.get(code.toUpperCase()) ?? 0;
    return {
      key: code || `row-${i}`,
      name,
      codeHint: flagCodeFor(code),
      count: row.count,
      share: Math.round((row.count / total) * 100),
      deltaPct: hasCompare ? trendPct(row.count, prevCount) : null,
    };
  });
}

function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct == null) return null;
  const up = pct > 0;
  const down = pct < 0;
  return (
    <span
      className={cn(
        "inline-flex min-w-[2.4rem] justify-end text-[10px] font-semibold tabular-nums",
        up && "text-[#0088d4] dark:text-[#00a5fd]",
        down && "text-rose-600 dark:text-rose-400",
        !up && !down && "text-muted-foreground",
      )}
    >
      {pct === 0 ? "0%" : `${up ? "+" : ""}${pct}%`}
    </span>
  );
}

/** Lightweight ranked list — no Recharts, Stripe/Linear style. */
function RankList({
  rows,
  valueLabel,
  accentClass,
  showRevenue,
  emptyLabel,
}: {
  rows: RankRow[];
  valueLabel: string;
  accentClass: string;
  showRevenue?: boolean;
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex min-h-[9rem] items-center justify-center text-xs text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  const max = Math.max(...rows.map((r) => r.count), 1);

  return (
    <ul className="flex flex-col gap-2.5" aria-label={valueLabel}>
      {rows.map((row, i) => {
        const widthPct = Math.max(4, Math.round((row.count / max) * 100));
        return (
          <li key={row.key} className="group min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <span className="w-3.5 shrink-0 text-[10px] font-medium tabular-nums text-muted-foreground/70">
                {i + 1}
              </span>
              {row.codeHint ? (
                <FlagImg code={row.codeHint} size={14} className="rounded-[2px]" />
              ) : (
                <span className="h-3.5 w-[14px] shrink-0 rounded-[2px] bg-muted" />
              )}
              <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground">
                {row.name}
              </p>
              <span className="shrink-0 text-[12px] font-semibold tabular-nums text-foreground">
                {row.count.toLocaleString()}
              </span>
              <DeltaBadge pct={row.deltaPct} />
            </div>
            <div className="ml-[1.35rem] flex items-center gap-2">
              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted/60">
                <div
                  className={cn("h-full rounded-full transition-[width] duration-500 ease-out", accentClass)}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                {row.share}%
              </span>
              {showRevenue && row.revenue != null && row.revenue > 0 ? (
                <span className="hidden w-14 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground sm:inline">
                  {fmtCompact(row.revenue)}
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

type CountryProps = {
  height?: number;
  data: CountryCountRow[];
  previousData?: CountryCountRow[];
  compareHint?: string | null;
  emptyLabel?: string;
  valueLabel?: string;
};

export function AdminCountrySignupsChart({
  data,
  previousData,
  emptyLabel = "No signups in this period",
  valueLabel = "signups",
}: CountryProps) {
  return (
    <RankList
      rows={buildCountryRows(data, previousData)}
      valueLabel={valueLabel}
      accentClass="bg-primary/80"
      emptyLabel={emptyLabel}
    />
  );
}

export function AdminCountryPurchasesChart({
  data,
  previousData,
  emptyLabel = "No purchases in this period",
  valueLabel = "purchases",
}: CountryProps) {
  return (
    <RankList
      rows={buildCountryRows(data, previousData)}
      valueLabel={valueLabel}
      accentClass="bg-[hsl(var(--chart-2))]"
      emptyLabel={emptyLabel}
    />
  );
}

type MethodProps = {
  height?: number;
  data: PaymentMethodStat[];
  previousData?: PaymentMethodStat[];
  compareHint?: string | null;
};

const METHOD_TONE: Record<PaymentMethodStat["method"], string> = {
  paypal: "bg-[hsl(207,72%,42%)]",
  pok: "bg-[hsl(173,48%,36%)]",
  credit: "bg-primary/75",
  free: "bg-muted-foreground/45",
};

export function AdminPaymentMethodsChart({
  data,
  previousData,
}: MethodProps) {
  if (data.length === 0) {
    return (
      <div className="flex min-h-[7rem] items-center justify-center text-xs text-muted-foreground">
        No payments in this period
      </div>
    );
  }

  const prevMap = new Map((previousData ?? []).map((r) => [r.method, r.count]));
  const hasCompare = Boolean(previousData);
  const sorted = [...data].sort((a, b) => b.count - a.count);
  const total = sorted.reduce((s, r) => s + r.count, 0) || 1;
  const totalRev = sorted.reduce((s, r) => s + (r.revenue ?? 0), 0);

  const rows: RankRow[] = sorted.map((row) => {
    const prevCount = prevMap.get(row.method) ?? 0;
    return {
      key: row.method,
      name: PAYMENT_METHOD_LABELS[row.method],
      codeHint: null,
      count: row.count,
      share: Math.round((row.count / total) * 100),
      deltaPct: hasCompare ? trendPct(row.count, prevCount) : null,
      revenue: row.revenue,
    };
  });

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">Mix of paid checkouts</p>
        {totalRev > 0 ? (
          <p className="text-[11px] tabular-nums text-muted-foreground">
            Collected{" "}
            <span className="font-semibold text-foreground">{fmtCompact(totalRev)}</span>
          </p>
        ) : null}
      </div>

      {/* Segmented share — one glance */}
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted/50"
        title="Payment method share"
      >
        {rows.map((row) => (
          <div
            key={row.key}
            className={cn("h-full first:rounded-l-full last:rounded-r-full", METHOD_TONE[row.key as PaymentMethodStat["method"]])}
            style={{ width: `${Math.max(row.share, row.count > 0 ? 2 : 0)}%` }}
            title={`${row.name}: ${row.share}%`}
          />
        ))}
      </div>

      <ul className="grid gap-2">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-muted/15 px-2.5 py-2"
          >
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                METHOD_TONE[row.key as PaymentMethodStat["method"]],
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-foreground">{row.name}</p>
              <p className="text-[10px] tabular-nums text-muted-foreground">
                {row.count.toLocaleString()} · {row.share}%
                {row.revenue != null && row.revenue > 0 ? ` · ${fmtEuro(row.revenue)}` : ""}
              </p>
            </div>
            <DeltaBadge pct={row.deltaPct} />
          </li>
        ))}
      </ul>
    </div>
  );
}

type SourceProps = {
  data: SalesBySourceStat[];
  previousData?: SalesBySourceStat[];
};

const SOURCE_TONE: Record<SalesBySourceStat["bucket"], string> = {
  paid_ads: "bg-[hsl(12,76%,48%)]",
  organic_social: "bg-[hsl(280,45%,48%)]",
  google: "bg-[hsl(207,72%,42%)]",
  referral: "bg-[hsl(173,48%,36%)]",
  direct: "bg-muted-foreground/55",
  unknown: "bg-muted-foreground/30",
};

export function AdminSalesBySourceChart({ data, previousData }: SourceProps) {
  if (data.length === 0) {
    return (
      <div className="flex min-h-[7rem] items-center justify-center text-xs text-muted-foreground">
        No attributed sales in this period
      </div>
    );
  }

  const prevMap = new Map((previousData ?? []).map((r) => [r.bucket, r.count]));
  const hasCompare = Boolean(previousData);
  const sorted = [...data].sort((a, b) => b.count - a.count);
  const total = sorted.reduce((s, r) => s + r.count, 0) || 1;
  const totalRev = sorted.reduce((s, r) => s + (r.revenue ?? 0), 0);

  const rows: RankRow[] = sorted.map((row) => {
    const prevCount = prevMap.get(row.bucket) ?? 0;
    return {
      key: row.bucket,
      name: ACQUISITION_BUCKET_LABELS[row.bucket],
      codeHint: null,
      count: row.count,
      share: Math.round((row.count / total) * 100),
      deltaPct: hasCompare ? trendPct(row.count, prevCount) : null,
      revenue: row.revenue,
    };
  });

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          Payments by first-touch source (user signup attribution)
        </p>
        {totalRev > 0 ? (
          <p className="text-[11px] tabular-nums text-muted-foreground">
            Collected{" "}
            <span className="font-semibold text-foreground">{fmtCompact(totalRev)}</span>
          </p>
        ) : null}
      </div>

      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted/50"
        title="Acquisition source share"
      >
        {rows.map((row) => (
          <div
            key={row.key}
            className={cn(
              "h-full first:rounded-l-full last:rounded-r-full",
              SOURCE_TONE[row.key as SalesBySourceStat["bucket"]],
            )}
            style={{ width: `${Math.max(row.share, row.count > 0 ? 2 : 0)}%` }}
            title={`${row.name}: ${row.share}%`}
          />
        ))}
      </div>

      <ul className="grid gap-2">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-muted/15 px-2.5 py-2"
          >
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                SOURCE_TONE[row.key as SalesBySourceStat["bucket"]],
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-foreground">{row.name}</p>
              <p className="text-[10px] tabular-nums text-muted-foreground">
                {row.count.toLocaleString()} · {row.share}%
                {row.revenue != null && row.revenue > 0 ? ` · ${fmtEuro(row.revenue)}` : ""}
              </p>
            </div>
            <DeltaBadge pct={row.deltaPct} />
          </li>
        ))}
      </ul>
    </div>
  );
}
