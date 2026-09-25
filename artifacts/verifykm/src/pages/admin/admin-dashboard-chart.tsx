import { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  fmtEuro,
  type ChartMetric,
  type ChartRange,
} from "@/lib/admin-dashboard-stats";

type ChartPoint = { label: string; value: number };

type Props = {
  height: number;
  data: ChartPoint[];
  chartMetric: ChartMetric;
  chartRange: ChartRange;
  strokeColor: string;
  gradId: string;
  seriesLabel: string;
};

function ChartTooltip({
  active,
  payload,
  label,
  chartMetric,
  seriesLabel,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  chartMetric: ChartMetric;
  seriesLabel: string;
}) {
  if (!active || !payload?.[0]) return null;
  const value = Number(payload[0].value);
  return (
    <div className="rounded-lg border border-border/60 bg-popover/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-foreground">
        {chartMetric === "revenue" ? fmtEuro(value) : value.toLocaleString()}
        <span className="ml-1.5 text-[10px] font-medium text-muted-foreground">
          {seriesLabel}
        </span>
      </p>
    </div>
  );
}

/** Slim performance trend — soft fill, hairline axes, average guide. */
export default function AdminDashboardChart({
  height,
  data,
  chartMetric,
  chartRange,
  strokeColor,
  gradId,
  seriesLabel,
}: Props) {
  const average = useMemo(() => {
    if (!data.length) return 0;
    return data.reduce((s, d) => s + d.value, 0) / data.length;
  }, [data]);

  const interval = chartRange === 90 ? 13 : chartRange === 30 ? 4 : 0;

  return (
    <div className="w-full min-w-0" style={{ minHeight: height }}>
      <ResponsiveContainer width="100%" height={height} minWidth={1}>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.22} />
              <stop offset="55%" stopColor={strokeColor} stopOpacity={0.06} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            interval={interval}
            dy={4}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            width={chartMetric === "revenue" ? 40 : 26}
            tickFormatter={(v) =>
              chartMetric === "revenue"
                ? (v >= 1000 ? `€${(v / 1000).toFixed(1)}k` : `€${v}`)
                : String(v)
            }
            allowDecimals={false}
          />
          {average > 0 ? (
            <ReferenceLine
              y={average}
              stroke="hsl(var(--muted-foreground))"
              strokeOpacity={0.35}
              strokeDasharray="4 4"
            />
          ) : null}
          <Tooltip
            cursor={{ stroke: strokeColor, strokeOpacity: 0.25, strokeWidth: 1 }}
            content={
              <ChartTooltip chartMetric={chartMetric} seriesLabel={seriesLabel} />
            }
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={1.75}
            fill={`url(#${gradId})`}
            dot={false}
            activeDot={{
              r: 3.5,
              strokeWidth: 2,
              stroke: "hsl(var(--background))",
              fill: strokeColor,
            }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
