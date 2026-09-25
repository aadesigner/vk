import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";
import type { Language } from "@/i18n/context";
import {
  buildMarketChartPoints,
  formatMarketCurrency,
  marketCurrencySymbol,
  marketValuesAreKrw,
  type MarketChartPoint,
} from "@/lib/market-chart-data";

type MarketDataSlice = {
  estimatedValue?: number | null;
  currency?: string | null;
  lastAuctionPrice?: number | null;
  lastAuctionDate?: string | null;
};

type AuctionSlice = {
  date?: string | null;
  finalPrice?: number | null;
};

type MarketValueChartProps = {
  marketData: MarketDataSlice | null | undefined;
  auctionHistory?: AuctionSlice[] | null;
  t: (key: string) => string;
  language: Language;
  vehicleCountry?: string | null;
  krwPerUsd?: number | null;
  className?: string;
  /** Richer bars / tooltip for the premium market section. */
  premium?: boolean;
};

function tooltipLabel(kind: MarketChartPoint["kind"], t: (key: string) => string): string {
  if (kind === "estimated") return t("estimated_value");
  return t("last_auction_price");
}

export function MarketValueChart({
  marketData,
  auctionHistory,
  t,
  language,
  vehicleCountry,
  krwPerUsd,
  className,
  premium = false,
}: MarketValueChartProps) {
  const points = buildMarketChartPoints(
    marketData,
    auctionHistory,
    t,
    language,
    vehicleCountry,
    krwPerUsd,
  );
  if (points.length === 0) return null;

  const sample =
    marketData?.estimatedValue
    ?? marketData?.lastAuctionPrice
    ?? auctionHistory?.find((a) => a.finalPrice != null)?.finalPrice
    ?? null;
  // Korean market figures are converted to USD for the chart.
  const displayCurrency = marketValuesAreKrw(marketData?.currency, vehicleCountry, sample)
    ? "USD"
    : (marketData?.currency ?? "USD");
  const symbol = marketCurrencySymbol(displayCurrency);

  return (
    <div className={cn(premium ? "h-36 sm:h-40" : "h-36", "print-hide-chart", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 6, left: -16, bottom: 0 }}>
          {premium ? (
            <defs>
              <linearGradient id="mktBarEst" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#64748b" stopOpacity={0.85} />
              </linearGradient>
              <linearGradient id="mktBarAuction" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#059669" stopOpacity={0.85} />
              </linearGradient>
              <linearGradient id="mktBarHistory" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6ee7b7" stopOpacity={0.85} />
                <stop offset="100%" stopColor="#00a5fd" stopOpacity={0.75} />
              </linearGradient>
            </defs>
          ) : null}
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            strokeOpacity={0.4}
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${symbol}${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--foreground) / 0.07)" }}
            formatter={(v: number, _name, item) => {
              const kind = (item.payload as MarketChartPoint).kind;
              return [formatMarketCurrency(v, displayCurrency), tooltipLabel(kind, t)];
            }}
            contentStyle={{
              fontSize: 11,
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--popover))",
              color: "hsl(var(--foreground))",
              boxShadow: "0 10px 28px -14px rgba(0,0,0,0.45)",
            }}
            labelStyle={{ color: "hsl(var(--muted-foreground))" }}
            itemStyle={{ color: "hsl(var(--foreground))" }}
          />
          <Bar
            dataKey="value"
            fill="hsl(var(--muted-foreground) / 0.55)"
            radius={[4, 4, 0, 0]}
            maxBarSize={premium ? 40 : 36}
          >
            {premium
              ? points.map((p, i) => (
                  <Cell
                    key={`${p.kind}-${i}`}
                    fill={
                      p.kind === "estimated"
                        ? "url(#mktBarEst)"
                        : p.kind === "last_auction"
                          ? "url(#mktBarAuction)"
                          : "url(#mktBarHistory)"
                    }
                  />
                ))
              : points.map((p, i) => (
                  <Cell
                    key={`${p.kind}-${i}`}
                    fill={
                      p.kind === "estimated"
                        ? "hsl(215 16% 52%)"
                        : "hsl(var(--primary))"
                    }
                  />
                ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
