import type { ReactNode } from "react";
import { FolderOpen } from "lucide-react";
import { FlagImg } from "@/components/flag-img";
import { formatImageFlagAlt } from "@/lib/flag-alt";
import { useTranslation } from "@/i18n/context";
import { cn } from "@/lib/utils";

type Props = {
  countryName: string;
  flagCode: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/**
 * Case-file chrome around the country-page demo card.
 *
 * Gives the sample report a dossier frame (cyan rail, file header, stamped
 * label) so it reads as evidence rather than a marketing card.
 */
export function CountryCaseFilePanel({
  countryName,
  flagCode,
  children,
  footer,
  className,
}: Props) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-lg border border-[#00a5fd]/25 bg-card/85 shadow-[0_18px_50px_-30px_rgba(0,165,253,0.55)] backdrop-blur-[2px] dark:border-[#00a5fd]/30 dark:bg-[#060a14]/80",
        className,
      )}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[#00a5fd]" />

      <div className="flex items-center gap-2.5 border-b border-border/60 bg-muted/30 px-3 py-2 pl-4 dark:bg-white/[0.03]">
        <FolderOpen className="h-3.5 w-3.5 shrink-0 text-[#0088d4] dark:text-[#33bbfd]" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-[#0088d4] dark:text-[#33bbfd]">
            {t("country_case_file_eyebrow")}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <FlagImg
              code={flagCode}
              size={14}
              className="rounded-[2px] shadow-sm"
              alt={formatImageFlagAlt(countryName, t)}
            />
            <p className="truncate text-[11px] font-semibold leading-none text-foreground/80">
              {countryName} · {t("country_case_file_sub")}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-sm border border-dashed border-[#00a5fd]/40 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-[#0088d4]/80 dark:text-[#33bbfd]/80">
          {t("what_we_check_sample_badge")}
        </span>
      </div>

      <div className="p-2 pl-3">{children}</div>

      {footer ? (
        <div className="border-t border-dashed border-border/60 bg-muted/20 px-3 py-2.5 pl-4 dark:bg-white/[0.02]">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
