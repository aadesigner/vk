import { useState } from "react";
import {
  Table2,
  Wrench,
  ClipboardList,
  Shield,
  ScrollText,
  Package,
  Ship,
  Hammer,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { VinReportSection, VinReportSectionHeader } from "@/components/vin-report-section";
import { ReportReveal } from "@/components/report-reveal";
import { HistoryShowAllButton } from "@/components/history-show-all-button";
import { sliceForHistoryPreview } from "@/lib/history-section-limit";
import { cleanDisplayText } from "@/lib/report-display";
import { dedupeVehicleExtras } from "@/lib/history-dedupe";
import { localizeProviderDate, translateKoreanProviderText } from "@/lib/korean-provider-text";
import {
  partitionVehicleExtras,
  VEHICLE_EXTRA_SECTION_META,
  isAffirmativeFeatureValue,
  isNegativeFeatureValue,
  splitOptionList,
  groupEquipmentFeatureChips,
  type VehicleExtraCategoryId,
  type CategorizedVehicleExtra,
} from "@/lib/vehicle-extra-categories";
import type { Language } from "@/i18n/context";
import type { VinReportSectionAccent } from "@/components/vin-report-section";
import { cn } from "@/lib/utils";
import { CarDamageDiagram } from "@/components/car-damage-diagram";
import { KoreanRepairPartsList } from "@/components/korean-repair-parts-list";
import { KoreanWonAmount, textContainsWon } from "@/components/korean-won-amount";
import { resolveKoreanDisplayKrw } from "@workspace/korean-registry";

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
  /** Render only these categories (in CATEGORY_ORDER). */
  onlyCategories?: VehicleExtraCategoryId[];
  /** Skip these categories (ignored when onlyCategories is set). */
  excludeCategories?: VehicleExtraCategoryId[];
  /** Admin KRW→USD rate for Korean insurance / repair amounts. */
  krwPerUsd?: number | null;
};

type DisplayRow = { label: string; value: string; observedAt: string | null };

const CATEGORY_ORDER: VehicleExtraCategoryId[] = [
  "equipment",
  "listing",
  "inspection",
  "korean_repairs",
  "korean",
  "korean_export",
  "history",
  "other",
];

export type { VehicleExtraCategoryId };

const CATEGORY_ICON: Record<VehicleExtraCategoryId, LucideIcon> = {
  equipment: Package,
  listing: ClipboardList,
  inspection: Wrench,
  korean_repairs: Hammer,
  korean: Shield,
  korean_export: Ship,
  history: ScrollText,
  other: Table2,
};

function sanitizeCategoryRows(
  rows: CategorizedVehicleExtra[],
  t: (key: string) => string,
  language: Language,
  vehicleYear?: number | null,
  vehicleCountry?: string | null,
): DisplayRow[] {
  const cleaned: Array<{
    key?: string | null;
    label: string;
    value: string;
    observedAt: string | null;
  }> = [];
  for (const row of rows) {
    const rawLabel = cleanDisplayText(row.label);
    const rawValue = cleanDisplayText(row.value);
    if (!rawLabel || !rawValue) continue;
    // Provider placeholders like "-" are noise in attribute tables.
    if (rawValue === "-" || rawValue === "—") continue;
    const translatedLabel = translateKoreanProviderText(t, rawLabel);
    const label =
      translatedLabel && translatedLabel !== rawLabel ? translatedLabel : rawLabel;
    const translatedValue = translateKoreanProviderText(t, rawValue);
    let value =
      translatedValue && translatedValue !== rawValue ? translatedValue : rawValue;
    const localizedDate = localizeProviderDate(rawValue, language, vehicleYear, vehicleCountry);
    if (localizedDate) value = localizedDate;
    cleaned.push({
      key: row.key,
      label,
      value,
      observedAt: cleanDisplayText(row.observedAt),
    });
  }
  return dedupeVehicleExtras(cleaned, vehicleYear).map((row) => ({
    label: row.label,
    value: row.value,
    observedAt: row.observedAt ?? null,
  }));
}

function ExtraAttributeValue({
  label,
  value,
  krwPerUsd,
}: {
  label: string;
  value: string;
  krwPerUsd?: number | null;
}) {
  if (textContainsWon(value) && resolveKoreanDisplayKrw(value, label) != null) {
    return <KoreanWonAmount text={value} amountLabel={label} krwPerUsd={krwPerUsd} />;
  }
  return <>{value}</>;
}

function ExtraAttributeTable({
  rows,
  vehicleYear,
  vehicleCountry,
  t,
  language,
  krwPerUsd,
}: {
  rows: DisplayRow[];
  vehicleYear?: number | null;
  vehicleCountry?: string | null;
  t: (key: string) => string;
  language: Language;
  krwPerUsd?: number | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = sliceForHistoryPreview(rows, expanded);

  if (!rows.length) return null;

  return (
    <div className="px-4 py-3">
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
                    <ExtraAttributeValue
                      label={row.label}
                      value={row.value}
                      krwPerUsd={krwPerUsd}
                    />
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
  );
}

function FeatureChips({ labels, alignEnd = false }: { labels: string[]; alignEnd?: boolean }) {
  if (!labels.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", alignEnd && "sm:justify-end")}>
      {labels.map((label) => (
        <span
          key={label}
          className="inline-flex items-center rounded-md border border-border/70 bg-muted/40 px-2 py-1 text-[11px] font-medium text-foreground"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

/** Equipment: grouped feature chips (category left, chips right); other rows in a table. */
function EquipmentExtrasBody({
  rows,
  vehicleYear,
  vehicleCountry,
  t,
  language,
  krwPerUsd,
}: {
  rows: DisplayRow[];
  vehicleYear?: number | null;
  vehicleCountry?: string | null;
  t: (key: string) => string;
  language: Language;
  krwPerUsd?: number | null;
}) {
  const chips: string[] = [];
  const detailRows: DisplayRow[] = [];

  for (const row of rows) {
    if (isNegativeFeatureValue(row.value)) continue;

    if (isAffirmativeFeatureValue(row.value)) {
      chips.push(row.label);
      continue;
    }

    // Trim / option group lists → chips
    if (/option/i.test(row.label) || /,/u.test(row.value)) {
      const parts = splitOptionList(row.value);
      if (parts.length > 1) {
        chips.push(...parts);
        continue;
      }
    }

    // Numeric sensor counts still useful as chips ("Parking Sensors · 2")
    if (/^\d+$/.test(row.value.trim())) {
      chips.push(`${row.label} · ${row.value.trim()}`);
      continue;
    }

    detailRows.push(row);
  }

  const uniqueChips = [...new Set(chips.map((c) => c.trim()).filter(Boolean))];
  const groups = groupEquipmentFeatureChips(uniqueChips);

  if (!groups.length && !detailRows.length) return null;

  return (
    <div className="px-4 py-3 space-y-3">
      {groups.length ? (
        <div className="space-y-2.5">
          {groups.map((group) => (
            <div
              key={group.id}
              className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-4 rounded-lg border border-border/50 bg-muted/15 px-3 py-2.5"
            >
              <div className="sm:w-28 shrink-0 pt-0.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t(group.titleKey)}
              </div>
              <div className="min-w-0 flex-1">
                <FeatureChips labels={group.labels} alignEnd />
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <ExtraAttributeTable
        rows={detailRows}
        vehicleYear={vehicleYear}
        vehicleCountry={vehicleCountry}
        t={t}
        language={language}
        krwPerUsd={krwPerUsd}
      />
    </div>
  );
}

/** Provider extras split into purpose-built report sections (hidden when empty). */
export function VehicleExtrasSection({
  extras,
  vehicleYear,
  vehicleCountry,
  t,
  language,
  variant = "report",
  className,
  delay = 0.1,
  onlyCategories,
  excludeCategories,
  krwPerUsd,
}: Props) {
  const partitioned = partitionVehicleExtras(extras);
  const allowed = onlyCategories?.length
    ? CATEGORY_ORDER.filter((id) => onlyCategories.includes(id))
    : CATEGORY_ORDER.filter((id) => !excludeCategories?.includes(id));
  const sections = allowed
    .map((id) => {
      const rows = sanitizeCategoryRows(partitioned[id], t, language, vehicleYear, vehicleCountry);
      if (!rows.length) return null;
      // Equipment may collapse to empty after hiding "No" flags
      if (id === "equipment") {
        const hasVisible = rows.some((row) => !isNegativeFeatureValue(row.value));
        if (!hasVisible) return null;
      }
      return { id, rows, meta: VEHICLE_EXTRA_SECTION_META[id] };
    })
    .filter(Boolean) as Array<{
      id: VehicleExtraCategoryId;
      rows: DisplayRow[];
      meta: (typeof VEHICLE_EXTRA_SECTION_META)[VehicleExtraCategoryId];
    }>;

  if (!sections.length) return null;

  return (
    <>
      {sections.map((section, index) => {
        const Icon = CATEGORY_ICON[section.id];
        const accent = section.meta.accent as VinReportSectionAccent;
        const count =
          section.id === "equipment"
            ? section.rows.filter((row) => !isNegativeFeatureValue(row.value)).length
            : section.rows.length;

        const body = (
          <VinReportSection className={className} accent={accent}>
            <VinReportSectionHeader
              variant={variant === "public" ? "public" : "report"}
              icon={Icon}
              accent={accent}
              title={t(section.meta.titleKey)}
              subtitle={variant === "report" ? t(section.meta.noteKey) : undefined}
              trailing={
                <Badge variant="secondary" className="text-xs shrink-0 font-normal">
                  {count}
                </Badge>
              }
            />
            {variant === "public" ? (
              <p className="px-4 pt-2 text-[11px] text-muted-foreground leading-snug">
                {t(section.meta.noteKey)}
              </p>
            ) : null}
            {section.id === "equipment" ? (
              <EquipmentExtrasBody
                rows={section.rows}
                vehicleYear={vehicleYear}
                vehicleCountry={vehicleCountry}
                t={t}
                language={language}
                krwPerUsd={krwPerUsd}
              />
            ) : section.id === "korean_repairs" ? (
              <div className="space-y-1">
                <div className="px-4 pt-3">
                  <CarDamageDiagram extras={partitioned.korean_repairs} t={t} />
                </div>
                <KoreanRepairPartsList rows={section.rows} t={t} />
              </div>
            ) : (
              <ExtraAttributeTable
                rows={section.rows}
                vehicleYear={vehicleYear}
                vehicleCountry={vehicleCountry}
                t={t}
                language={language}
                krwPerUsd={krwPerUsd}
              />
            )}
          </VinReportSection>
        );

        const sectionDelay = delay + index * 0.02;
        if (variant === "public") {
          return (
            <ReportReveal key={section.id} delay={sectionDelay} y={12}>
              {body}
            </ReportReveal>
          );
        }
        return (
          <ReportReveal key={section.id} delay={sectionDelay} y={16} inView>
            {body}
          </ReportReveal>
        );
      })}
    </>
  );
}
