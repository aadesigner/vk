/**
 * Canonical vehicle attribute values for admin selects.
 * Stored as stable English tokens; UI/report labels come from i18n.
 */

import { resolveCountryIso2 } from "./format-country-name";

export type SelectOption = { value: string; label: string };

export const ADMIN_FUEL_OPTIONS: { value: string; i18nKey: string }[] = [
  { value: "gasoline", i18nKey: "fuel_petrol" },
  { value: "diesel", i18nKey: "fuel_diesel" },
  { value: "electric", i18nKey: "fuel_electric" },
  { value: "hybrid", i18nKey: "fuel_hybrid" },
  { value: "plug-in hybrid", i18nKey: "fuel_phev" },
  { value: "lpg", i18nKey: "fuel_lpg" },
  { value: "cng", i18nKey: "fuel_cng" },
  { value: "hydrogen", i18nKey: "fuel_hydrogen" },
  { value: "flex", i18nKey: "fuel_flex" },
  { value: "biodiesel", i18nKey: "fuel_biodiesel" },
  { value: "e85", i18nKey: "fuel_e85" },
];

export const ADMIN_TRANSMISSION_OPTIONS: { value: string; i18nKey: string }[] = [
  { value: "automatic", i18nKey: "trans_automatic" },
  { value: "manual", i18nKey: "trans_manual" },
  { value: "cvt", i18nKey: "trans_cvt" },
  { value: "dct", i18nKey: "trans_dct" },
  { value: "amt", i18nKey: "trans_amt" },
  { value: "semi-automatic", i18nKey: "trans_semi" },
];

export const ADMIN_BODY_OPTIONS: { value: string; i18nKey: string }[] = [
  { value: "sedan", i18nKey: "body_sedan" },
  { value: "suv", i18nKey: "body_suv" },
  { value: "hatchback", i18nKey: "body_hatchback" },
  { value: "coupe", i18nKey: "body_coupe" },
  { value: "convertible", i18nKey: "body_convertible" },
  { value: "wagon", i18nKey: "body_wagon" },
  { value: "van", i18nKey: "body_van" },
  { value: "minivan", i18nKey: "body_minivan" },
  { value: "pickup", i18nKey: "body_pickup" },
  { value: "truck", i18nKey: "body_truck" },
  { value: "crossover", i18nKey: "body_crossover" },
];

export const ADMIN_COLOR_OPTIONS: { value: string; i18nKey: string }[] = [
  { value: "white", i18nKey: "color_white" },
  { value: "black", i18nKey: "color_black" },
  { value: "silver", i18nKey: "color_silver" },
  { value: "gray", i18nKey: "color_gray" },
  { value: "blue", i18nKey: "color_blue" },
  { value: "red", i18nKey: "color_red" },
  { value: "green", i18nKey: "color_green" },
  { value: "brown", i18nKey: "color_brown" },
  { value: "beige", i18nKey: "color_beige" },
  { value: "gold", i18nKey: "color_gold" },
  { value: "orange", i18nKey: "color_orange" },
  { value: "yellow", i18nKey: "color_yellow" },
  { value: "purple", i18nKey: "color_purple" },
  { value: "pink", i18nKey: "color_pink" },
  { value: "bronze", i18nKey: "color_bronze" },
  { value: "maroon", i18nKey: "color_maroon" },
];

/** ISO / region codes stored on catalog `country`. */
export const ADMIN_COUNTRY_CODES = [
  "kr", "us", "ca", "de", "jp", "gb", "fr", "it", "es", "nl", "au",
  "pl", "ro", "ua", "ru", "cn", "mx", "ae", "se", "no", "dk", "fi",
  "at", "be", "ch", "pt", "gr", "tr", "br", "in", "th", "tw", "za",
] as const;

export const TRANSMISSION_I18N_KEYS: Record<string, string> = {
  automatic: "trans_automatic",
  manual: "trans_manual",
  cvt: "trans_cvt",
  "dual-clutch": "trans_dct",
  dct: "trans_dct",
  amt: "trans_amt",
  "semi-automatic": "trans_semi",
  "semi automatic": "trans_semi",
};

export const BODY_I18N_KEYS: Record<string, string> = {
  sedan: "body_sedan",
  saloon: "body_sedan",
  suv: "body_suv",
  hatchback: "body_hatchback",
  coupe: "body_coupe",
  convertible: "body_convertible",
  cabriolet: "body_convertible",
  wagon: "body_wagon",
  estate: "body_wagon",
  van: "body_van",
  minivan: "body_minivan",
  pickup: "body_pickup",
  truck: "body_truck",
  crossover: "body_crossover",
};

export const COLOR_I18N_KEYS: Record<string, string> = Object.fromEntries(
  ADMIN_COLOR_OPTIONS.map((o) => [o.value, o.i18nKey]),
);

/** Map a stored value onto the closest canonical option (case / alias insensitive). */
export function resolveCanonicalSelectValue(
  raw: string,
  defs: { value: string }[],
  aliases: Record<string, string> = {},
): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  const aliased = aliases[lower] ?? lower;
  const hit = defs.find((d) => d.value.toLowerCase() === aliased);
  return hit?.value ?? trimmed;
}

const FUEL_ALIASES: Record<string, string> = {
  petrol: "gasoline",
  gas: "gasoline",
  benzin: "gasoline",
  phev: "plug-in hybrid",
  "plug in hybrid": "plug-in hybrid",
  hev: "hybrid",
  ev: "electric",
  bev: "electric",
  "natural gas": "cng",
  "flex fuel": "flex",
  ethanol: "e85",
};

const TRANSMISSION_ALIASES: Record<string, string> = {
  "dual-clutch": "dct",
  "dual clutch": "dct",
  "semi automatic": "semi-automatic",
  auto: "automatic",
};

const BODY_ALIASES: Record<string, string> = {
  saloon: "sedan",
  cabriolet: "convertible",
  estate: "wagon",
};

const COLOR_ALIASES: Record<string, string> = {
  grey: "gray",
  "dark gray": "gray",
  "dark grey": "gray",
  "light gray": "silver",
  "light grey": "silver",
};

export function resolveFuelSelectValue(raw: string): string {
  return resolveCanonicalSelectValue(raw, ADMIN_FUEL_OPTIONS, FUEL_ALIASES);
}

export function resolveTransmissionSelectValue(raw: string): string {
  return resolveCanonicalSelectValue(raw, ADMIN_TRANSMISSION_OPTIONS, TRANSMISSION_ALIASES);
}

export function resolveBodySelectValue(raw: string): string {
  return resolveCanonicalSelectValue(raw, ADMIN_BODY_OPTIONS, BODY_ALIASES);
}

export function resolveColorSelectValue(raw: string): string {
  return resolveCanonicalSelectValue(raw, ADMIN_COLOR_OPTIONS, COLOR_ALIASES);
}

export function resolveCountrySelectValue(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  const hit = ADMIN_COUNTRY_CODES.find((c) => c === lower);
  if (hit) return hit;
  const iso = resolveCountryIso2(trimmed)?.toLowerCase();
  if (iso && (ADMIN_COUNTRY_CODES as readonly string[]).includes(iso)) return iso;
  return trimmed;
}

/** Build select options; keep an unknown current value so edits don't wipe provider data. */
export function buildAttrSelectOptions(
  t: (key: string) => string,
  defs: { value: string; i18nKey: string }[],
  currentValue: string,
  emptyLabel = "—",
  resolveCurrent: (raw: string) => string = (raw) => resolveCanonicalSelectValue(raw, defs),
): SelectOption[] {
  const options: SelectOption[] = [{ value: "", label: emptyLabel }];
  const seen = new Set<string>();

  for (const def of defs) {
    const label = t(def.i18nKey);
    options.push({ value: def.value, label: label !== def.i18nKey ? label : def.value });
    seen.add(def.value.toLowerCase());
  }

  const cur = currentValue.trim();
  if (!cur) return options;
  const resolved = resolveCurrent(cur);
  if (!seen.has(resolved.toLowerCase())) {
    options.push({ value: resolved, label: `${resolved} (current)` });
  }

  return options;
}

export function buildCountrySelectOptions(
  formatCountry: (code: string) => string,
  currentValue: string,
  emptyLabel = "—",
): SelectOption[] {
  const options: SelectOption[] = [{ value: "", label: emptyLabel }];
  const seen = new Set<string>();

  for (const code of ADMIN_COUNTRY_CODES) {
    options.push({ value: code, label: formatCountry(code) || code.toUpperCase() });
    seen.add(code.toLowerCase());
  }

  const cur = currentValue.trim();
  if (cur && !seen.has(cur.toLowerCase())) {
    options.push({ value: cur, label: `${formatCountry(cur) || cur} (current)` });
  }

  return options;
}

export function translateMappedValue(
  raw: string | null | undefined,
  map: Record<string, string>,
  t: (key: string) => string,
): string | null {
  if (!raw) return null;
  const key = map[raw.toLowerCase().trim()];
  if (!key) return null;
  const translated = t(key);
  return translated !== key ? translated : raw;
}

export function translateColor(
  t: (key: string) => string,
  value: string | null | undefined,
): string | null {
  return translateMappedValue(value, COLOR_I18N_KEYS, t) ?? (value?.trim() || null);
}
