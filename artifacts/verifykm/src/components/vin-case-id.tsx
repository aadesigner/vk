import { cn } from "@/lib/utils";

/** Segmented VIN “case ID” — boxes are visual only; the full VIN stays one string. */
export function VinCaseId({
  vin,
  className,
  size = "md",
  oneLine = false,
  onDark = false,
}: {
  vin: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  /** Stay on a single row, even on a narrow report column. */
  oneLine?: boolean;
  /** Light cells for navy file rails. */
  onDark?: boolean;
}) {
  const chars = String(vin || "").toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17);
  const sizeCls = oneLine
    ? "h-8 min-w-0 flex-1 basis-0 px-0 text-xs leading-none sm:h-9 sm:text-sm"
    : size === "lg"
      ? "h-9 min-w-[1.65rem] text-sm sm:h-10 sm:min-w-[1.85rem] sm:text-base"
      : size === "sm"
        ? "h-6 min-w-[1.15rem] text-[10px]"
        : "h-7 min-w-[1.35rem] text-xs sm:h-8 sm:min-w-[1.5rem] sm:text-sm";

  return (
    <div className={cn("min-w-0", className)}>
      <div
        className={cn(
          "items-center",
          oneLine ? "flex w-full max-w-full flex-nowrap gap-px sm:gap-0.5" : "inline-flex flex-wrap gap-0.5 sm:gap-1",
        )}
        aria-hidden
      >
        {chars.split("").map((ch, i) => (
          <span
            key={`${i}-${ch}`}
            className={cn(
              "inline-flex items-center justify-center rounded-sm font-mono font-bold tracking-wide",
              onDark
                ? "border border-white/20 bg-white/10 text-white print:border-[#00a5fd]/30 print:bg-[#eef8fd] print:text-slate-900"
                : "border border-[#00a5fd]/30 bg-[#00a5fd]/[0.07] text-foreground dark:bg-[#00a5fd]/10 dark:text-[#e0f4ff]",
              sizeCls,
              (i === 2 || i === 8) && "mr-0.5 sm:mr-1",
            )}
          >
            {ch}
          </span>
        ))}
      </div>
      <p className="sr-only">{chars}</p>
    </div>
  );
}
