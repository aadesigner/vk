import { TrendingUp } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import type { Language } from "@/i18n/context";
import { ReportReveal } from "@/components/report-reveal";
import { VinReportSection, VinReportSectionHeader } from "@/components/vin-report-section";
import { LazyMarketValueChart as MarketValueChart } from "@/components/lazy-market-value-chart";
import { KoreanWonAmount } from "@/components/korean-won-amount";
import { formatAmountPlain, resolveAmountDisplayCurrency } from "@/lib/korean-currency";
import {
  buildMarketChartPoints,
  formatMarketAuctionDate,
  marketValuesAreKrw,
} from "@/lib/market-chart-data";
import { cn } from "@/lib/utils";

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

type Props = {
  marketData: MarketDataSlice;
  auctionHistory?: AuctionSlice[] | null;
  t: (key: string) => string;
  language: Language;
  vehicleCountry?: string | null;
  vehicleYear?: number | null;
  krwPerUsd?: number | null;
  /** Public page uses report_* i18n keys; paid report uses shorter keys. */
  variant?: "public" | "report";
  /** ReportReveal timing — public uses delay; report often uses inView. */
  reveal?: { delay?: number; inView?: boolean };
  className?: string;
};

function MoneyValue({
  amount,
  currency,
  vehicleCountry,
  krwPerUsd,
  className,
}: {
  amount: number;
  currency?: string | null;
  vehicleCountry?: string | null;
  krwPerUsd?: number | null;
  className?: string;
}) {
  if (marketValuesAreKrw(currency, vehicleCountry, amount)) {
    return (
      <KoreanWonAmount
        krw={amount}
        krwPerUsd={krwPerUsd}
        className={cn("tabular-nums tracking-tight text-sm font-semibold", className)}
      />
    );
  }
  return (
    <span className={cn("tabular-nums tracking-tight text-sm font-semibold text-foreground", className)}>
      {formatAmountPlain(
        amount,
        resolveAmountDisplayCurrency({ currency, vehicleCountry }),
      )}
    </span>
  );
}

function Stat({
  label,
  children,
  labelClassName,
}: {
  label: string;
  children: ReactNode;
  labelClassName?: string;
}) {
  return (
    <div className="min-w-0 flex flex-col gap-0.5">
      <span
        className={cn(
          "text-[10px] sm:text-[11px] text-muted-foreground leading-none truncate",
          labelClassName,
        )}
      >
        {label}
      </span>
      <div className="min-w-0 leading-snug">{children}</div>
    </div>
  );
}

export function VinMarketDataSection({
  marketData,
  auctionHistory,
  t,
  language,
  vehicleCountry,
  vehicleYear,
  krwPerUsd,
  variant = "report",
  reveal,
  className,
}: Props) {
  const isPublic = variant === "public";
  const title = t(isPublic ? "report_market_data" : "market_data");
  const estLabel = t(isPublic ? "report_estimated_value" : "estimated_value");
  const auctionLabel = t(isPublic ? "report_last_auction" : "last_auction_price");
  const dateLabel = t(isPublic ? "report_auction_date" : "last_auction_date");

  const hasEstimate = marketData.estimatedValue != null && marketData.estimatedValue > 0;
  const hasAuction = marketData.lastAuctionPrice != null && marketData.lastAuctionPrice > 0;
  const auctionDate = marketData.lastAuctionDate
    ? formatMarketAuctionDate(marketData.lastAuctionDate, language, vehicleYear, vehicleCountry)
    : null;

  const hasStats = hasEstimate || hasAuction || !!auctionDate;

  const hasChart = useMemo(
    () =>
      buildMarketChartPoints(
        marketData,
        auctionHistory,
        t,
        language,
        vehicleCountry,
        krwPerUsd,
      ).length > 0,
    [marketData, auctionHistory, t, language, vehicleCountry, krwPerUsd],
  );

  const stats = hasStats ? (
    <div
      className={cn(
        "flex flex-wrap items-stretch gap-2.5 sm:gap-3",
        hasChart && "pt-3.5 border-t border-border/60",
      )}
    >
      {hasEstimate ? (
        <div className="min-w-0 flex-1 basis-[8.5rem] rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
          <Stat label={estLabel}>
            <MoneyValue
              amount={marketData.estimatedValue!}
              currency={marketData.currency}
              vehicleCountry={vehicleCountry}
              krwPerUsd={krwPerUsd}
            />
          </Stat>
        </div>
      ) : null}
      {hasAuction ? (
        <div className="min-w-0 flex-1 basis-[9.5rem] rounded-xl border border-[#00a5fd]/25 bg-[#00a5fd]/[0.06] px-3 py-2.5 dark:border-[#33bbfd]/20 dark:bg-[#00a5fd]/[0.08]">
          <Stat
            label={auctionLabel}
            labelClassName="font-medium text-[#0077c2] dark:text-[#00a5fd]"
          >
            <MoneyValue
              amount={marketData.lastAuctionPrice!}
              currency={marketData.currency}
              vehicleCountry={vehicleCountry}
              krwPerUsd={krwPerUsd}
              className="text-foreground"
            />
          </Stat>
        </div>
      ) : null}
      {auctionDate ? (
        <div className="min-w-0 flex-1 basis-[8rem] rounded-xl border border-[#00a5fd]/25 bg-[#00a5fd]/[0.06] px-3 py-2.5 dark:border-[#33bbfd]/20 dark:bg-[#00a5fd]/[0.08]">
          <Stat
            label={dateLabel}
            labelClassName="font-medium text-[#0077c2] dark:text-[#00a5fd]"
          >
            <span className="text-sm font-semibold tracking-tight text-foreground">
              {auctionDate}
            </span>
          </Stat>
        </div>
      ) : null}
    </div>
  ) : null;

  const body = (
    <VinReportSection accent="sky" className={className}>
      <VinReportSectionHeader
        variant={isPublic ? "public" : "report"}
        icon={TrendingUp}
        accent="sky"
        title={title}
      />

      <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-0">
        {hasChart ? (
          <MarketValueChart
            marketData={marketData}
            auctionHistory={auctionHistory}
            t={t}
            language={language}
            vehicleCountry={vehicleCountry}
            krwPerUsd={krwPerUsd}
            className="mb-0"
            premium
          />
        ) : null}
        {stats}
      </div>
    </VinReportSection>
  );

  return (
    <ReportReveal
      delay={reveal?.delay}
      inView={reveal?.inView}
      y={reveal?.inView ? 16 : 12}
    >
      {body}
    </ReportReveal>
  );
}
