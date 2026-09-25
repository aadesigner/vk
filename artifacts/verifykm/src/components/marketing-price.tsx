import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Inline €19.99 with smaller, faded cents — same treatment as pricing pages. */
export function PriceAmount({
  amount,
  currencySymbol,
  className,
  centsClassName,
}: {
  amount: number;
  currencySymbol: string;
  className?: string;
  centsClassName?: string;
}) {
  const [whole, fraction] = amount.toFixed(2).split(".");
  return (
    <span className={cn("inline-flex items-baseline tabular-nums tracking-tight", className)}>
      <span>
        {currencySymbol}
        {whole}
      </span>
      <span className={cn("text-[0.55em] font-bold text-current/70", centsClassName)}>
        .{fraction}
      </span>
    </span>
  );
}

type MarketingPriceProps = {
  amount: number;
  currencySymbol: string;
  loading?: boolean;
  compareAmount?: number | null;
  /** md = compact cards; lg = pricing hero */
  size?: "md" | "lg";
  align?: "center" | "start";
  className?: string;
};

/** Customer-facing price — symbol smaller than amount, avoids oversized single-line labels. */
export function MarketingPrice({
  amount,
  currencySymbol,
  loading,
  compareAmount,
  size = "lg",
  align = "center",
  className,
}: MarketingPriceProps) {
  const [whole, fraction] = amount.toFixed(2).split(".");

  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        align === "center" ? "items-center" : "items-start",
        className,
      )}
    >
      {compareAmount != null && compareAmount > amount && (
        <span className="text-base sm:text-lg font-medium text-muted-foreground/55 line-through tabular-nums">
          {currencySymbol}
          {compareAmount.toFixed(2)}
        </span>
      )}
      {loading ? (
        <Skeleton className={cn(size === "lg" ? "h-14 w-32" : "h-8 w-20", "rounded-md")} />
      ) : (
        <div
          className={cn(
            "inline-flex items-baseline tabular-nums leading-none",
            align === "center" ? "justify-center" : "justify-start",
          )}
        >
          <span
            className={cn(
              "font-semibold text-primary/80 pr-0.5",
              size === "lg" ? "text-2xl sm:text-3xl" : "text-base sm:text-lg",
            )}
          >
            {currencySymbol}
          </span>
          <span
            className={cn(
              "font-extrabold text-primary tracking-tight",
              size === "lg" ? "text-[2.75rem] sm:text-[3.25rem] md:text-[3.5rem]" : "text-2xl sm:text-[1.65rem]",
            )}
          >
            {whole}
            <span className="text-[0.55em] font-bold text-primary/90">.{fraction}</span>
          </span>
        </div>
      )}
    </div>
  );
}
