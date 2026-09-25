import { AlertTriangle, CheckCircle2, Droplets, ShieldCheck, XCircle } from "lucide-react";
import { VinReportSection, VinReportSectionHeader, type VinReportSectionAccent } from "@/components/vin-report-section";
import { KoreanWonAmount } from "@/components/korean-won-amount";
import { formatAmountPlain, resolveAmountDisplayCurrency } from "@/lib/korean-currency";
import { cn } from "@/lib/utils";
import type { Language } from "@/i18n/context";

type Props = {
  /** true = flood found, false = assessed clear, null/undefined = unknown (hide). */
  isFlooded: boolean | null | undefined;
  floodCount?: number | null;
  floodLossAmount?: number | null;
  country?: string | null;
  krwPerUsd?: number | null;
  t: (key: string) => string;
  language: Language;
  variant?: "report" | "public";
  className?: string;
};

function floodSectionAccent(isFlooded: boolean): VinReportSectionAccent {
  return isFlooded ? "rose" : "sky";
}

function StatusPill({ ok, labelOk, labelFail }: { ok: boolean; labelOk: string; labelFail: string }) {
  return ok ? (
    <div className="inline-flex items-center gap-1 sm:gap-1.5 rounded-full bg-[#e6f6ff] dark:bg-[#003a5c]/40/60 border border-[#b3e3fe] dark:border-[#006aa8] px-2.5 py-0.5 sm:px-3 sm:py-1">
      <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#0088d4] shrink-0" />
      <span className="text-[11px] sm:text-xs font-semibold text-[#0369a1] dark:text-[#33bbfd]">{labelOk}</span>
    </div>
  ) : (
    <div className="inline-flex items-center gap-1 sm:gap-1.5 rounded-full bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 px-2.5 py-0.5 sm:px-3 sm:py-1">
      <XCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-red-600 shrink-0" />
      <span className="text-[11px] sm:text-xs font-semibold text-red-700 dark:text-red-400">{labelFail}</span>
    </div>
  );
}

/** Flood status card — same VinReportSection + status-box pattern as Safety Status. */
export function FloodDamageSection({
  isFlooded,
  floodCount,
  floodLossAmount,
  country,
  krwPerUsd,
  t,
  language: _language,
  variant = "report",
  className,
}: Props) {
  if (isFlooded == null) return null;

  const flooded = isFlooded === true;
  const accent = floodSectionAccent(flooded);
  const count = floodCount != null && floodCount > 0 ? floodCount : 1;
  const code = resolveAmountDisplayCurrency({
    currency: "KRW",
    vehicleCountry: country,
    accidentType: "flood",
  });

  return (
    <VinReportSection accent={accent} className={className}>
      <VinReportSectionHeader
        icon={Droplets}
        accent={accent}
        title={t("report_flood_section")}
        variant={variant === "public" ? "public" : "report"}
        trailing={
          <StatusPill
            ok={!flooded}
            labelOk={t("all_clear")}
            labelFail={t("issue_found")}
          />
        }
      />
      <div className="px-6 py-5">
        <div
          className={cn(
            "rounded-xl p-4 flex items-start gap-3",
            flooded
              ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40"
              : "bg-[#e6f6ff] dark:bg-[#003a5c]/40/30 border border-[#b3e3fe] dark:border-[#006aa8]/40",
          )}
        >
          <div
            className={cn(
              "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
              flooded ? "bg-red-100 dark:bg-red-900/40" : "bg-[#ccebfe] dark:bg-[#004d7a]/40/40",
            )}
          >
            {flooded
              ? <AlertTriangle className="h-4 w-4 text-red-600" />
              : <ShieldCheck className="h-4 w-4 text-[#0088d4]" />}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("report_flood")}
            </p>
            <p
              className={cn(
                "text-sm font-bold mt-0.5",
                flooded ? "text-red-700 dark:text-red-400" : "text-[#0369a1] dark:text-[#33bbfd]",
              )}
            >
              {flooded ? t("flood_flagged") : t("report_not_flooded")}
            </p>
            <p className="text-xs text-muted-foreground/80 mt-0.5 leading-snug">
              {flooded ? t("report_flood_body") : t("flood_clear_desc")}
            </p>
            {flooded && floodLossAmount != null && floodLossAmount > 0 ? (
              <p className="mt-2 text-sm font-semibold tabular-nums">
                <span className="text-muted-foreground font-normal mr-2">{t("loss_amount")}:</span>
                {code === "KRW" ? (
                  <KoreanWonAmount krw={floodLossAmount} krwPerUsd={krwPerUsd} />
                ) : (
                  formatAmountPlain(floodLossAmount, code)
                )}
              </p>
            ) : null}
            {flooded && count > 0 ? (
              <p className="mt-1 text-xs font-semibold text-muted-foreground tabular-nums">
                {t("report_flood_count").replace("{count}", String(count))}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </VinReportSection>
  );
}
