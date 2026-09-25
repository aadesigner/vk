/**
 * Opel vs Vauxhall — shared Stellantis/GM platforms, separate market badges.
 * WMI W0L serves both; VXK and W0V are UK-market identifiers.
 *
 * Pre-~1998 passenger VINs use a padded numeric type block:
 *   W0L + 0000 + TT + year + plant + serial
 * (e.g. W0L000052N2586893 = Astra F Caravan, 1992, Bochum).
 * Those must NOT use the modern pos.4 platform letter map or the ISO +30 year cycle.
 */

import { compilePrefixRules, matchLongestPrefix, type PrefixRule } from "./prefix-match";

export const OPEL_VAUXHALL_WMIS = ["W0L", "W0V", "VXK"] as const;

/** UK assembly plants → Vauxhall badge (position 11 / index 10). */
const VAUXHALL_PLANT_CODES = new Set(["8", "E", "L", "U"]);

const OPEL_VAUXHALL_PLANTS: Record<string, { city: string; country: string }> = {
  "1": { city: "Rüsselsheim", country: "Germany" },
  "2": { city: "Bochum", country: "Germany" },
  "3": { city: "Saint Petersburg", country: "Russia" },
  "8": { city: "Ellesmere Port", country: "United Kingdom" },
  B: { city: "Zaragoza", country: "Spain" },
  E: { city: "Ellesmere Port", country: "United Kingdom" },
  G: { city: "Gliwice", country: "Poland" },
  L: { city: "Luton", country: "United Kingdom" },
  S: { city: "Bochum", country: "Germany" },
  T: { city: "Rüsselsheim", country: "Germany" },
  U: { city: "Luton", country: "United Kingdom" },
  A: { city: "Rüsselsheim", country: "Germany" },
};

/**
 * Old Opel 2-digit type codes (positions 8–9) after the 0000 filler.
 * Sources: Opel VIN tables (opel-infos / PNG / period documentation).
 */
const OLD_PADDED_TYPE_CODES: Record<string, string> = {
  "51": "Astra F Caravan",
  "52": "Astra F Caravan",
  "53": "Astra F",
  "54": "Astra F",
  "55": "Astra F",
  "56": "Astra F",
  "57": "Astra F",
  "58": "Astra F",
  "59": "Astra F",
  "61": "Astra G Caravan",
  "62": "Astra G",
  "63": "Astra G",
  "66": "Astra G",
  "67": "Astra G",
  "71": "Corsa B Combo",
  "73": "Corsa B",
  "78": "Corsa B",
  "79": "Corsa B",
  "91": "Corsa A",
  "92": "Corsa A",
  "93": "Corsa A",
  "94": "Corsa A",
  "96": "Corsa A",
  "97": "Corsa A",
  "98": "Corsa A",
  "99": "Corsa A",
};

/** First ISO year cycle only — used by old padded Opel VINs (no +30 roll-forward). */
const OLD_PADDED_YEAR_MAP: Record<string, number> = {
  A: 1980, B: 1981, C: 1982, D: 1983, E: 1984,
  F: 1985, G: 1986, H: 1987, J: 1988, K: 1989,
  L: 1990, M: 1991, N: 1992, P: 1993, R: 1994,
  S: 1995, T: 1996, V: 1997, W: 1998, X: 1999, Y: 2000,
  "1": 2001, "2": 2002, "3": 2003, "4": 2004, "5": 2005,
  "6": 2006, "7": 2007, "8": 2008, "9": 2009,
};

/** Platform letter at VIN position 4 (index 3) — GM/Stellantis era. */
const PLATFORM_AT_4: Record<string, string> = {
  "0": "Corsa",
  B: "Corsa",
  G: "Insignia",
  P: "Astra",
  S: "Meriva",
  W: "Cascada",
  M: "Mokka",
  N: "Grandland",
  "4": "Crossland",
  F: "Frontera",
  V: "Vivaro",
  C: "Combo",
  J: "Mokka",
  D: "Astra",
  T: "Insignia",
};

const PREFIX_RULES = compilePrefixRules([
  { prefix: "W0L0ZEL", model: "Corsa F", yearFrom: 2019, yearTo: 2099 },
  { prefix: "W0L0ZEC", model: "Corsa-e", yearFrom: 2019, yearTo: 2099 },
  { prefix: "W0L0ADF", model: "Astra L", yearFrom: 2021, yearTo: 2099 },
  { prefix: "W0L0AD", model: "Astra L", yearFrom: 2021, yearTo: 2099 },
  { prefix: "W0LJD", model: "Mokka", yearFrom: 2020, yearTo: 2099 },
  { prefix: "W0L4", model: "Crossland", yearFrom: 2017, yearTo: 2099 },
  // W0LP/W0LS span multiple Astra generations — no yearFrom (letter years stay null).
  { prefix: "W0LP", model: "Astra" },
  { prefix: "W0LS", model: "Astra" },
  { prefix: "W0LB", model: "Corsa" },
  { prefix: "W0LT", model: "Insignia" },
  { prefix: "W0LG", model: "Insignia" },
  { prefix: "W0LM", model: "Mokka", yearFrom: 2012, yearTo: 2019 },
  { prefix: "W0LN", model: "Grandland", yearFrom: 2017, yearTo: 2099 },
  { prefix: "W0LF", model: "Frontera", yearFrom: 2024, yearTo: 2099 },
  { prefix: "W0LV", model: "Vivaro", yearFrom: 2019, yearTo: 2099 },
  { prefix: "W0LC", model: "Combo", yearFrom: 2018, yearTo: 2099 },
  { prefix: "W0V", model: "Vivaro", yearFrom: 2019, yearTo: 2099 },
  { prefix: "VXKP", model: "Astra" },
  { prefix: "VXKB", model: "Corsa" },
  { prefix: "VXK", model: "Astra" },
]);

export function isOpelVauxhallVin(vin: string): boolean {
  const wmi = vin.toUpperCase().slice(0, 3);
  return (OPEL_VAUXHALL_WMIS as readonly string[]).includes(wmi);
}

/** Longest verified Opel/Vauxhall prefix hit (may include yearFrom/yearTo). */
export function matchOpelVauxhallRule(vin: string): PrefixRule | null {
  if (!isOpelVauxhallVin(vin)) return null;
  const upper = vin.toUpperCase().trim();
  if (isOpelOldPaddedTypeVin(upper)) return null;
  return matchLongestPrefix(upper, PREFIX_RULES);
}

/**
 * Pre-~1998 Opel layout: W0L/W0V + 0000 filler + 2-digit type + year + plant + serial.
 * Modern Stellantis codes (W0L0ZEC, W0L0ADF, W0LP…) do not match.
 */
export function isOpelOldPaddedTypeVin(vin: string): boolean {
  const upper = vin.toUpperCase().trim();
  if (upper.length !== 17) return false;
  const wmi = upper.slice(0, 3);
  if (wmi !== "W0L" && wmi !== "W0V") return false;
  return upper.slice(3, 7) === "0000" && /^\d{2}$/.test(upper.slice(7, 9));
}

/** Model year for old padded Opel VINs — first cycle only (N = 1992, not 2022). */
export function decodeOpelOldPaddedYear(vin: string): number | null {
  if (!isOpelOldPaddedTypeVin(vin)) return null;
  return OLD_PADDED_YEAR_MAP[vin[9]?.toUpperCase() ?? ""] ?? null;
}

function decodeOpelOldPaddedModel(vin: string): string | null {
  if (!isOpelOldPaddedTypeVin(vin)) return null;
  return OLD_PADDED_TYPE_CODES[vin.slice(7, 9)] ?? null;
}

export function decodeOpelVauxhallPlant(vin: string): { city: string; country: string } | null {
  if (!isOpelVauxhallVin(vin) || vin.length < 11) return null;
  return OPEL_VAUXHALL_PLANTS[vin[10].toUpperCase()] ?? null;
}

/** Split Opel (continental) vs Vauxhall (UK badge). */
export function decodeOpelVauxhallMake(vin: string): "Opel" | "Vauxhall" | null {
  if (!isOpelVauxhallVin(vin)) return null;
  const wmi = vin.toUpperCase().slice(0, 3);
  if (wmi === "VXK" || wmi === "W0V") return "Vauxhall";
  if (wmi === "W0L" && vin.length >= 11) {
    const plant = vin[10].toUpperCase();
    if (VAUXHALL_PLANT_CODES.has(plant)) return "Vauxhall";
    const plantInfo = OPEL_VAUXHALL_PLANTS[plant];
    if (plantInfo?.country === "United Kingdom") return "Vauxhall";
  }
  return "Opel";
}

export function decodeOpelVauxhallModel(vin: string): string | null {
  if (!isOpelVauxhallVin(vin)) return null;
  const upper = vin.toUpperCase();
  // Old padded type codes before modern pos.4="0"→Corsa fallback.
  const oldModel = decodeOpelOldPaddedModel(upper);
  if (oldModel) return oldModel;
  if (isOpelOldPaddedTypeVin(upper)) return null;
  const prefixHit = matchLongestPrefix(upper, PREFIX_RULES);
  if (prefixHit) return prefixHit.model;
  if (upper.length >= 4) {
    const fromPlatform = PLATFORM_AT_4[upper[3]];
    if (fromPlatform) return fromPlatform;
    const FOUR_CHAR: Record<string, string> = {
      W0LS: "Astra",
      W0LB: "Corsa",
      W0LT: "Insignia",
      W0LM: "Mokka",
      W0LN: "Grandland",
    };
    const fromFour = FOUR_CHAR[upper.slice(0, 4)];
    if (fromFour) return fromFour;
  }
  return null;
}
