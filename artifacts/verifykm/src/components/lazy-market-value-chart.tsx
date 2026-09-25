import { Suspense } from "react";
import type { ComponentProps } from "react";
import { lazyWithRetry } from "@/lib/lazy-with-retry";

const MarketValueChart = lazyWithRetry(() =>
  import("./market-value-chart").then((m) => ({ default: m.MarketValueChart })),
);

type Props = ComponentProps<typeof MarketValueChart>;

/** Loads recharts only when market chart is rendered. */
export function LazyMarketValueChart(props: Props) {
  return (
    <Suspense fallback={null}>
      <MarketValueChart {...props} />
    </Suspense>
  );
}
