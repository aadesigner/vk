import type { VinHeroSummaryItem } from "@/components/vin-report-hero";

type BuildOpts = {
  t: (key: string) => string;
  locked?: boolean;
  odometer?: number | null;
  hasMileage: boolean;
  hasSalvageData: boolean;
  isSalvage?: boolean | null;
  hasTheftData: boolean;
  isStolen?: boolean | null;
  isTaxi?: boolean | null;
};

/** Salvage/theft chips only when the provider returned data; taxi is always shown (admin-set). */
export function buildVinHeroSummaryItems(opts: BuildOpts): VinHeroSummaryItem[] {
  const { t, locked } = opts;

  if (locked) {
    return [];
  }

  const items: VinHeroSummaryItem[] = [];

  // Accidents are shown next to the rating badge in the hero — not in this summary list.

  if (opts.hasMileage && opts.odometer != null) {
    items.push({
      kind: "mileage",
      label: `${opts.odometer.toLocaleString()} km`,
      tone: "neutral",
    });
  }

  if (opts.hasSalvageData) {
    items.push({
      kind: "salvage",
      label: opts.isSalvage ? t("salvage_flagged") : t("report_no_salvage"),
      tone: opts.isSalvage ? "negative" : "positive",
    });
  }

  if (opts.hasTheftData) {
    items.push({
      kind: "theft",
      label: opts.isStolen ? t("theft_flagged") : t("report_not_stolen"),
      tone: opts.isStolen ? "negative" : "positive",
    });
  }

  items.push({
    kind: "taxi",
    label: opts.isTaxi ? t("taxi_flagged") : t("report_not_taxi"),
    tone: opts.isTaxi ? "negative" : "positive",
  });

  return items;
}
