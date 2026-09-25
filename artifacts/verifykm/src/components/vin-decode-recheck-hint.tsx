import { Info } from "lucide-react";
import { useTranslation } from "@/i18n/context";
import { cn } from "@/lib/utils";

type VinDecodeRecheckHintProps = {
  className?: string;
  variant?: "default" | "on-dark";
};

/** Gentle nudge to re-read the VIN — not an error or identification failure message. */
export function VinDecodeRecheckHint({ className, variant = "default" }: VinDecodeRecheckHintProps) {
  const { t } = useTranslation();
  const isOnDark = variant === "on-dark";
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3 py-2.5",
        isOnDark
          ? "border-amber-300/40 bg-amber-400/15"
          : "border-amber-200/80 bg-amber-50/90 dark:border-amber-800/50 dark:bg-amber-950/30",
        className,
      )}
    >
      <Info className={cn(
        "h-4 w-4 shrink-0 mt-0.5",
        isOnDark ? "text-amber-200" : "text-amber-600 dark:text-amber-400",
      )} />
      <p className={cn(
        "text-sm font-medium leading-relaxed",
        isOnDark ? "text-amber-50" : "text-amber-900 dark:text-amber-100",
      )}>
        {t("vin_hint_recheck")}
      </p>
    </div>
  );
}
