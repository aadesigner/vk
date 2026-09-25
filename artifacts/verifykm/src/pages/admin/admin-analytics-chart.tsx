import { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { fmtEuro, fmtCompact } from "@/lib/admin-dashboard-stats";

type ChartPoint = { label: string; value: number };

type Props = {
  height: number;
  data: ChartPoint[];
  metric: "revenue" | "checks" | "signups";
  strokeColor: string;
  gradId: string;
  seriesLabel: string;
};

function ChartTooltip({
  active,
  payload,
  label,
  metric,
  seriesLabel,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  metric: "revenue" | "checks" | "signups";
  seriesLabel: string;
}) {
  if (!active || !payload?.[0]) return null;
  const value = Number(payload[0].value);
  return (
    <div className="rounded-lg border border-border/60 bg-popover/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-foreground">
        {metric === "revenue" ? fmtEuro(value) : value.toLocaleString()}
        <span className="ml-1.5 text-[10px] font-medium text-muted-foreground">{seriesLabel}</span>
      </p>
    </div>
  );
}

export default function AdminAnalyticsChart({
  height,
  data,
  metric,
  strokeColor,
  gradId,
  seriesLabel,
}: Props) {
  const average = useMemo(() => {
    if (!data.length) return 0;
    return data.reduce((s, d) => s + d.value, 0) / data.length;
  }, [data]);

  const interval = data.length > 40 ? 13 : data.length > 14 ? 4 : 0;

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
            tickLine={false}
            axisLine={false}
            interval={interval}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis
            width={metric === "revenue" ? 44 : 36}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(v) => (metric === "revenue" ? fmtCompact(Number(v)) : String(v))}
          />
          <Tooltip
            content={<ChartTooltip metric={metric} seriesLabel={seriesLabel} />}
          />
          {average > 0 ? (
            <ReferenceLine y={average} stroke="hsl(var(--border))" strokeDasharray="3 4" />
          ) : null}
          <Area
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
