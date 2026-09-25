/** @deprecated Prefer vehicle-attr-options — kept for older imports. */
export {
  ADMIN_COUNTRY_CODES as ADMIN_COUNTRY_SUGGESTIONS,
  ADMIN_TRANSMISSION_OPTIONS,
  ADMIN_FUEL_OPTIONS,
  ADMIN_BODY_OPTIONS,
  ADMIN_COLOR_OPTIONS,
} from "@/lib/vehicle-attr-options";

export const ADMIN_MILEAGE_UNITS = ["km", "mi", "miles"];

/** Canonical damage locations — keys match `damage_val_*` i18n suffixes. */
export const ADMIN_DAMAGE_VALUES = [
  "front_end",
  "rear_end",
  "side",
  "minor_dent_scratches",
  "all_over",
  "mechanical",
  "hail",
  "water_flood",
  "burn",
  "rollover",
  "undercarriage",
  "frame_damage",
  "unknown",
] as const;

/** Flat value lists for legacy datalist sync / tests. */
export const ADMIN_TRANSMISSION_SUGGESTIONS = [
  "automatic", "manual", "cvt", "dct", "amt", "semi-automatic",
];
export const ADMIN_FUEL_SUGGESTIONS = [
  "gasoline", "diesel", "electric", "hybrid", "plug-in hybrid", "lpg", "cng", "hydrogen", "flex", "biodiesel", "e85",
];
export const ADMIN_BODY_SUGGESTIONS = [
  "sedan", "suv", "hatchback", "coupe", "convertible", "wagon", "van", "minivan", "pickup", "truck", "crossover",
];
