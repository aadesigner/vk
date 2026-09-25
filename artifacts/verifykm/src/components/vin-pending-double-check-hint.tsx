import { Info } from "lucide-react";
import { useTranslation } from "@/i18n/context";
import { cn } from "@/lib/utils";

type VinPendingDoubleCheckHintProps = {
  className?: string;
  variant?: "default" | "on-dark";
};

/** Info-style nudge when a valid decode is pending manual review — same tone as checkout. */
export function VinPendingDoubleCheckHint({ className, variant = "default" }: VinPendingDoubleCheckHintProps) {
  const { t } = useTranslation();
  const isOnDark = variant === "on-dark";
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2.5",
        isOnDark
          ? "border-sky-300/40 bg-sky-400/15"
          : "border-sky-200/80 bg-sky-50/90 dark:border-sky-800/50 dark:bg-sky-950/30",
        className,
      )}
    >
      <Info className={cn(
        "h-4 w-4 shrink-0 mt-0.5",
        isOnDark ? "text-sky-200" : "text-sky-600 dark:text-sky-400",
      )} />
      <p className={cn(
        "text-sm font-medium",
        isOnDark ? "text-sky-50" : "text-sky-900 dark:text-sky-100",
      )}>
        {t("vin_warning_pending_double_check")}
      </p>
    </div>
  );
}
