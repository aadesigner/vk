export type VehicleExtraCategoryId =
  | "equipment"
  | "listing"
  | "inspection"
  | "korean_repairs"
  | "korean"
  | "korean_export"
  | "history"
  | "other";

export type VehicleExtraEntryLike = {
  key?: string | null;
  label?: string | null;
  value?: string | null;
  observedAt?: string | null;
};

export type CategorizedVehicleExtra = {
  key?: string | null;
  label: string;
  value: string;
  observedAt?: string | null;
};

/** Identity fields already shown in Vehicle Info — drop from extras sections. */
const IDENTITY_LABELS = new Set([
  "fuel",
  "body",
  "transmission",
  "color",
  "cylinders",
  "horsepower",
  "vehicle type",
  "make",
  "model",
  "year",
  "trim",
  "engine",
  "country",
]);

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function matchesAny(hay: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(hay));
}

export function categorizeVehicleExtra(
  entry: Pick<VehicleExtraEntryLike, "key" | "label">,
): VehicleExtraCategoryId | "skip" {
  const key = norm(entry.key);
  const label = norm(entry.label);
  const blob = `${key} ${label}`;

  if (IDENTITY_LABELS.has(label) || IDENTITY_LABELS.has(key)) return "skip";

  // Never show upstream history provider domains or listing/lot identifiers.
  if (
    matchesAny(blob, [
      /^history_source(_domain)?$/,
      /\bhistory source\b/,
      /\bautobellglobal\b/,
      /^history_listing_id$/,
      /^listing_id(_|$)/,
      /\bhistory listing id\b/,
      /\blisting id\b/,
    ])
  ) {
    return "skip";
  }

  // Korea equipment / safety options (before catch-all kr_)
  if (
    matchesAny(blob, [
      /^kr_spec_/,
      /^kr_options_/,
      /^kr_trim_options\b/,
      /\btrim options\b/,
    ])
  ) {
    return "equipment";
  }

  // Korea repair parts lists
  if (
    matchesAny(blob, [
      /^kr_parts_/,
      /\brepair parts\b/,
      /\ball repaired\b/,
      /\bparts ·/,
    ])
  ) {
    return "korean_repairs";
  }

  // Korea export declaration
  if (
    matchesAny(blob, [
      /^kr_export_/,
      /\bexport date\b/,
      /\bexport fuel\b/,
      /\bexport color\b/,
      /\bexport total loss\b/,
      /\bexport\b/,
    ])
  ) {
    return "korean_export";
  }

  // Korea usage flags → history coverage
  if (
    matchesAny(blob, [
      /^kr_usage_/,
      /\bgovernment\b/,
      /\bbusiness\b/,
      /\brent\b/,
      /\brental\b/,
      /\bspecial usage\b/,
    ])
  ) {
    return "history";
  }

  // Korea market price bands are shown inside Market Data — not as listing extras
  if (
    matchesAny(blob, [
      /^kr_market_/,
      /\bkorean market price\b/,
      /\bmarket low\b/,
      /\bmarket high\b/,
    ])
  ) {
    return "skip";
  }

  // Remaining Korea insurance / registry summary fields
  if (
    matchesAny(blob, [
      /^kr_/,
      /\bkorean\b/,
      /\buninsured\b/,
      /\bown damage\b/,
      /\bother-party\b/,
      /\bother party\b/,
      /\binsurance plate\b/,
      /\bregistration number\b/,
      /\bflood events\b/,
      /\btheft events\b/,
      /\btotal loss events\b/,
      /\binsurance report date\b/,
      /\brecall campaigns\b/,
      /\bowners\b/,
      /\binitial registration\b/,
      /\bfirst registration\b/,
      /\btermination of information\b/,
    ])
  ) {
    return "korean";
  }

  if (
    matchesAny(blob, [
      /^insp_/,
      /^meas_/,
      /^marker_/,
      /\binspection\b/,
      /\bemissions?\b/,
      /\bpercent\b/,
      /\bppm\b/,
      /\bvisual marker\b/,
      /\baccident history\b/,
      /\bsimple repair\b/,
      /\bspecial history\b/,
      /\brecall completion\b/,
      /\bexterior\b/,
      /\bpowertrain\b/,
      /\bmechanical\b/,
      /\bbrakes\b/,
      /\belectrical\b/,
      /\bdocuments\b/,
      /\bequipment operation\b/,
    ])
  ) {
    return "inspection";
  }

  if (
    matchesAny(blob, [
      /^history_/,
      /\bhistory coverage\b/,
      /\bhistory limitation\b/,
      /\bhistory listing\b/,
      /\bhistory source\b/,
    ])
  ) {
    return "history";
  }

  if (
    matchesAny(blob, [
      /^listing_/,
      /^acv_/,
      /^pre_accident/,
      /^repair_est/,
      /^price_/,
      /^odo_/,
      /^archived_/,
      /^first_seen/,
      /^last_seen/,
      /^seller_/,
      /^days_to_sell/,
      /\bfirst seen\b/,
      /\blast seen\b/,
      /\bactual cash value\b/,
      /\bpre-accident\b/,
      /\bestimated repair\b/,
      /\baverage price\b/,
      /\bprice without tax\b/,
      /\bseller type\b/,
      /\bdays to sell\b/,
      /\blisting archived\b/,
      /\blisting notes\b/,
      /\blisting damage\b/,
      /\bcondition class\b/,
      /\bodometer \(miles\)\b/,
      /\bodometer status\b/,
      /\bodometer \(mi/,
    ])
  ) {
    return "listing";
  }

  if (
    matchesAny(blob, [
      /^equip_/,
      /\bkeys\b/,
      /\bwarranty\b/,
      /\bsafety\b/,
      /\bcomfort\b/,
      /\binfotainment\b/,
      /\bmultimedia\b/,
      /\bseats\b/,
      /\bdoors\b/,
      /\bdrive\b/,
      /\bemission standard\b/,
      /\bco₂\b/,
      /\bco2\b/,
      /\binterior\b/,
      /\bextra wheels\b/,
      /\bbattery\b/,
      /\bgears\b/,
      /\bdimensions\b/,
      /\bcurb weight\b/,
      /\badaptive cruise\b/,
      /\bblind spot\b/,
      /\bsunroof\b/,
      /\bparking\b/,
      /\bcamera\b/,
      /\bcarplay\b/,
      /\bandroid auto\b/,
      /\bkeyless\b/,
      /\bheadlights\b/,
      /\bheated\b/,
    ])
  ) {
    return "equipment";
  }

  return "other";
}

/** Drop the redundant “all parts” rollup when individual part groups exist. */
function shouldDropRedundantAllParts(
  entry: VehicleExtraEntryLike,
  hasPartGroups: boolean,
): boolean {
  if (!hasPartGroups) return false;
  const key = norm(entry.key);
  const label = norm(entry.label);
  return key === "kr_parts_all" || label === "all repaired parts";
}

export function partitionVehicleExtras(
  extras: VehicleExtraEntryLike[],
): Record<VehicleExtraCategoryId, CategorizedVehicleExtra[]> {
  const out: Record<VehicleExtraCategoryId, CategorizedVehicleExtra[]> = {
    equipment: [],
    listing: [],
    inspection: [],
    korean_repairs: [],
    korean: [],
    korean_export: [],
    history: [],
    other: [],
  };

  const hasPartGroups = extras.some((row) => {
    const key = norm(row.key);
    return key.startsWith("kr_parts_") && key !== "kr_parts_all";
  });

  for (const row of extras) {
    const label = (row.label ?? row.key ?? "").trim();
    const value = (row.value ?? "").trim();
    if (!label || !value) continue;
    if (shouldDropRedundantAllParts(row, hasPartGroups)) continue;
    const cat = categorizeVehicleExtra(row);
    if (cat === "skip") continue;
    out[cat].push({
      key: row.key,
      label,
      value,
      observedAt: row.observedAt ?? null,
    });
  }

  return out;
}

export const VEHICLE_EXTRA_SECTION_META: Record<
  VehicleExtraCategoryId,
  {
    titleKey: string;
    noteKey: string;
    accent: "purple" | "slate" | "amber" | "emerald" | "sky" | "rose" | "orange";
  }
> = {
  equipment: {
    titleKey: "report_equipment_options",
    noteKey: "report_equipment_options_note",
    accent: "purple",
  },
  listing: {
    titleKey: "report_listing_market_details",
    noteKey: "report_listing_market_details_note",
    accent: "slate",
  },
  inspection: {
    titleKey: "report_inspection_details",
    noteKey: "report_inspection_details_note",
    accent: "amber",
  },
  korean_repairs: {
    titleKey: "report_korean_repair_parts",
    noteKey: "report_korean_repair_parts_note",
    accent: "orange",
  },
  korean: {
    titleKey: "report_korean_insurance_details",
    noteKey: "report_korean_insurance_details_note",
    accent: "emerald",
  },
  korean_export: {
    titleKey: "report_korean_export_record",
    noteKey: "report_korean_export_record_note",
    accent: "sky",
  },
  history: {
    titleKey: "report_history_notes",
    noteKey: "report_history_notes_note",
    accent: "slate",
  },
  other: {
    titleKey: "report_vehicle_extras",
    noteKey: "report_vehicle_extras_note",
    accent: "rose",
  },
};

/** True/yes-style feature values suitable for chip display. */
/** Includes localized Yes/No after extras phrase translation. */
const AFFIRMATIVE_FEATURE_VALUES = new Set([
  "yes",
  "true",
  "y",
  "1",
  "po", // sq
  "ja", // de
  "oui", // fr
  "sí",
  "si", // es
  "tak", // pl
  "da", // ro/bg
  "да", // ru/bg
  "так", // uk
  "نعم", // ar
  "是", // zh
  "კი", // ka
]);

const NEGATIVE_FEATURE_VALUES = new Set([
  "no",
  "false",
  "n",
  "0",
  "-",
  "—",
  "none",
  "none recorded",
  "not present",
  "jo", // sq
  "nein", // de
  "non", // fr
  "nie", // pl
  "nu", // ro
  "не", // bg/ru
  "ні", // uk
  "لا", // ar
  "否", // zh
  "არა", // ka
  "asnjë e regjistruar",
  "keine erfasst",
  "aucun enregistré",
  "ninguno registrado",
  "brak zapisów",
  "niciuna înregistrată",
  "няма записани",
  "не зафиксировано",
  "не зафіксовано",
  "لا يوجد مسجّل",
  "无记录",
  "არ არის ჩაწერილი",
]);

export function isAffirmativeFeatureValue(value: string | null | undefined): boolean {
  return AFFIRMATIVE_FEATURE_VALUES.has(norm(value));
}

export function isNegativeFeatureValue(value: string | null | undefined): boolean {
  return NEGATIVE_FEATURE_VALUES.has(norm(value));
}

/** Split comma/semicolon option lists into individual chip labels. */
export function splitOptionList(value: string): string[] {
  return value
    .split(/[,;/|]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export type EquipmentFeatureGroupId =
  | "safety"
  | "driver_assist"
  | "comfort"
  | "lighting"
  | "other";

export const EQUIPMENT_FEATURE_GROUP_META: Record<
  EquipmentFeatureGroupId,
  { titleKey: string; order: number }
> = {
  safety: { titleKey: "report_equip_group_safety", order: 0 },
  driver_assist: { titleKey: "report_equip_group_driver_assist", order: 1 },
  comfort: { titleKey: "report_equip_group_comfort", order: 2 },
  lighting: { titleKey: "report_equip_group_lighting", order: 3 },
  other: { titleKey: "report_equip_group_other", order: 4 },
};

export function classifyEquipmentFeatureLabel(label: string): EquipmentFeatureGroupId {
  const l = norm(label);
  if (
    matchesAny(l, [
      /\babs\b/,
      /\baeb\b/,
      /\bairbag/,
      /\btpms\b/,
      /\bbrake/,
      /\bfcw/,
      /\blane keep/,
      /\bblind spot/,
      /\besp\b/,
      /\besc\b/,
      /\bsafety\b/,
    ])
  ) {
    return "safety";
  }
  if (
    matchesAny(l, [
      /\bcruise/,
      /\bparking/,
      /\bcamera/,
      /\bsensor/,
      /\bwiper/,
      /\bassist/,
      /\baround view/,
      /\bnavigation/,
      /\binfotainment/,
      /\bmultimedia/,
      /\bcarplay/,
      /\bandroid/,
    ])
  ) {
    return "driver_assist";
  }
  if (
    matchesAny(l, [
      /\blight/,
      /\bheadlight/,
      /\bled\b/,
      /\bdaytime/,
    ])
  ) {
    return "lighting";
  }
  if (
    matchesAny(l, [
      /\bkey/,
      /\bheat/,
      /\bseat/,
      /\bclimate/,
      /\bair conditioning/,
      /\ba\/c\b/,
      /\bac\b/,
      /\bcomfort/,
      /\bsunroof/,
      /\bprestige/,
      /\bauto\b/,
      /\bp\/s\b/,
      /\bair-d\b/,
      /\bim\b/,
    ])
  ) {
    return "comfort";
  }
  return "other";
}

/** Group chip labels for the equipment section (label left → chips right). */
export function groupEquipmentFeatureChips(
  labels: string[],
): Array<{ id: EquipmentFeatureGroupId; titleKey: string; labels: string[] }> {
  const buckets: Record<EquipmentFeatureGroupId, string[]> = {
    safety: [],
    driver_assist: [],
    comfort: [],
    lighting: [],
    other: [],
  };
  for (const label of labels) {
    const clean = label.trim();
    if (!clean) continue;
    buckets[classifyEquipmentFeatureLabel(clean)].push(clean);
  }
  return (Object.keys(EQUIPMENT_FEATURE_GROUP_META) as EquipmentFeatureGroupId[])
    .sort((a, b) => EQUIPMENT_FEATURE_GROUP_META[a].order - EQUIPMENT_FEATURE_GROUP_META[b].order)
    .filter((id) => buckets[id].length > 0)
    .map((id) => ({
      id,
      titleKey: EQUIPMENT_FEATURE_GROUP_META[id].titleKey,
      labels: [...new Set(buckets[id])],
    }));
}
