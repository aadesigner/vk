import { AlertTriangle } from "lucide-react";
import { useTranslation } from "@/i18n/context";
import { useAuth } from "@/lib/auth-context";
import { useVinLookupDisabledForUser } from "@/hooks/use-site-public-flags";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  compact?: boolean;
};

export function VinLookupDisabledBanner({ className, compact = false }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const disabled = useVinLookupDisabledForUser(user?.isAdmin);

  if (!disabled) return null;

  return (
    <div
      role="status"
      className={cn(
        "rounded-xl border border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-100",
        compact ? "px-3 py-2.5" : "px-4 py-3",
        className,
      )}
    >
      <div className="flex gap-2.5 items-start">
        <AlertTriangle className={cn("shrink-0 text-amber-600 dark:text-amber-400", compact ? "h-4 w-4 mt-0.5" : "h-5 w-5")} />
        <div className="min-w-0 space-y-0.5">
          <p className={cn("font-semibold leading-snug", compact ? "text-sm" : "text-[15px]")}>
            {t("vin_lookup_disabled_title")}
          </p>
          <p className={cn("text-amber-900/80 dark:text-amber-100/80", compact ? "text-xs" : "text-sm")}>
            {t("vin_lookup_disabled_body")}
          </p>
        </div>
      </div>
    </div>
  );
}
