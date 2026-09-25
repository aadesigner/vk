import { useState } from "react";
import { Table2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { VinReportSection, VinReportSectionHeader } from "@/components/vin-report-section";
import { ReportReveal } from "@/components/report-reveal";
import { HistoryShowAllButton } from "@/components/history-show-all-button";
import { sliceForHistoryPreview } from "@/lib/history-section-limit";
import { cleanDisplayText } from "@/lib/report-display";
import { localizeProviderDate } from "@/lib/korean-provider-text";
import type { Language } from "@/i18n/context";

export type VehicleExtraEntry = {
  key?: string | null;
  label?: string | null;
  value?: string | null;
  observedAt?: string | null;
};

type Props = {
  extras: VehicleExtraEntry[];
  vehicleYear?: number | null;
  vehicleCountry?: string | null;
  t: (key: string) => string;
  language: Language;
  variant?: "report" | "public";
  className?: string;
  delay?: number;
};

function sanitizeExtras(extras: VehicleExtraEntry[]): Array<{
  label: string;
  value: string;
  observedAt: string | null;
}> {
  const out: Array<{ label: string; value: string; observedAt: string | null }> = [];
  const seen = new Set<string>();
  for (const row of extras) {
    const label = cleanDisplayText(row.label) ?? cleanDisplayText(row.key);
    const value = cleanDisplayText(row.value);
    if (!label || !value) continue;
    const key = `${label.toLowerCase()}|${value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      label,
      value,
      observedAt: cleanDisplayText(row.observedAt),
    });
  }
  return out;
}

/** GetCarAPI Extra attribute table — hidden when empty. */
export function VehicleExtrasSection({
  extras,
  vehicleYear,
  vehicleCountry,
  t,
  language,
  variant = "report",
  className,
  delay = 0.1,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const rows = sanitizeExtras(extras);
  if (!rows.length) return null;

  const visible = sliceForHistoryPreview(rows, expanded);

  const body = (
    <VinReportSection className={className} accent="slate">
      <VinReportSectionHeader
        variant={variant === "public" ? "public" : "report"}
        icon={Table2}
        accent="slate"
        title={t("report_vehicle_extras")}
        subtitle={variant === "report" ? t("report_vehicle_extras_note") : undefined}
        trailing={
          <Badge variant="secondary" className="text-xs shrink-0 font-normal">
            {rows.length}
          </Badge>
        }
      />
      <div className="px-4 py-3">
        {variant === "public" && (
          <p className="text-[11px] text-muted-foreground mb-2.5 leading-snug">
            {t("report_vehicle_extras_note")}
          </p>
        )}
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("report_vehicle_extras_attr")}</th>
                <th className="px-3 py-2 font-medium">{t("report_vehicle_extras_value")}</th>
                <th className="px-3 py-2 font-medium hidden sm:table-cell">{t("report_vehicle_extras_seen")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row, i) => {
                const seen = row.observedAt
                  ? localizeProviderDate(row.observedAt, language, vehicleYear, vehicleCountry)
                  : null;
                return (
                  <tr
                    key={`${row.label}-${i}`}
                    className="border-b border-border/40 last:border-0"
                  >
                    <td className="px-3 py-2 align-top text-muted-foreground whitespace-nowrap">
                      {row.label}
                    </td>
                    <td className="px-3 py-2 align-top font-medium text-foreground break-words">
                      {row.value}
                    </td>
                    <td className="px-3 py-2 align-top text-muted-foreground tabular-nums hidden sm:table-cell whitespace-nowrap">
                      {seen ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <HistoryShowAllButton
          total={rows.length}
          expanded={expanded}
          onToggle={() => setExpanded((v) => !v)}
          t={t}
          className="mt-2"
        />
      </div>
    </VinReportSection>
  );

  if (variant === "public") {
    return (
      <ReportReveal delay={delay} y={12}>
        {body}
      </ReportReveal>
    );
  }

  return (
    <ReportReveal delay={delay} y={16} inView>
      {body}
    </ReportReveal>
  );
}
