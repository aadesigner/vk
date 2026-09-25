/**
 * Mazda VIN decode — carline codes at positions 4–5 (Mazda-style VDS).
 * Source: Wikibooks Mazda VIN codes / NHTSA manufacturer filings.
 * Prefer model-only over inventing a generation when the code is ambiguous.
 */

import { compilePrefixRules, matchLongestPrefix, type PrefixRule } from "./prefix-match";

/** WMIs that use Mazda-style carline encoding (not Ford-style Tribute/B-series). */
const MAZDA_CARLINE_WMIS = new Set([
  "JM1", // Japan passenger
  "JM2", // Japan truck
  "JM3", // Japan MPV / crossover
  "JMZ", // Israel / select export
  "1YV", // Flat Rock USA (partial; Ford-era 6 may not match carlines)
  "3MD", // Mexico Mazda2
  "3MJ", // Mexico CX-3 (MX market)
  "3MZ", // Mexico Mazda3
  "3MV", // Mexico CX-30
  "7MM", // Alabama CX-50 (Mazda Toyota Manufacturing)
]);

/**
 * Carline (pos. 4–5) → model. Chassis = the carline token (literal in the VIN).
 * Skip codes that collide with other brands without a Mazda WMI gate (e.g. DL = Toyota Yaris).
 */
const MAZDA_CARLINES: Record<string, { model: string; chassis: string }> = {
  // Mazda3
  BK: { model: "Mazda3", chassis: "BK" },
  BL: { model: "Mazda3", chassis: "BL" },
  BM: { model: "Mazda3", chassis: "BM" },
  BN: { model: "Mazda3", chassis: "BN" },
  BP: { model: "Mazda3", chassis: "BP" },
  // Mazda2 / Mazda5
  DE: { model: "Mazda2", chassis: "DE" },
  DJ: { model: "Mazda2", chassis: "DJ" },
  CR: { model: "Mazda5", chassis: "CR" },
  CW: { model: "Mazda5", chassis: "CW" },
  // Mazda6 (Mazda-structure Japan/EU — US Flat Rock often Ford VDS)
  GG: { model: "Mazdaspeed6", chassis: "GG" },
  GH: { model: "Mazda6", chassis: "GH" },
  GJ: { model: "Mazda6", chassis: "GJ" },
  GL: { model: "Mazda6", chassis: "GL" },
  // Soft-roaders
  DK: { model: "CX-3", chassis: "DK" },
  DM: { model: "CX-30", chassis: "DM" },
  DR: { model: "MX-30", chassis: "DR" },
  ER: { model: "CX-7", chassis: "ER" },
  KE: { model: "CX-5", chassis: "KE" },
  KF: { model: "CX-5", chassis: "KF" },
  KM: { model: "CX-5", chassis: "KM" },
  KJ: { model: "CX-70", chassis: "KJ" },
  KK: { model: "CX-90", chassis: "KK" },
  TB: { model: "CX-9", chassis: "TB" },
  TC: { model: "CX-9", chassis: "TC" },
  VA: { model: "CX-50", chassis: "VA" },
  // MX-5 / RX
  NA: { model: "MX-5", chassis: "NA" },
  NB: { model: "MX-5", chassis: "NB" },
  NC: { model: "MX-5", chassis: "NC" },
  ND: { model: "MX-5", chassis: "ND" },
  FE: { model: "RX-8", chassis: "FE" },
  // MPV
  LW: { model: "MPV", chassis: "LW" },
};

/** Explicit WMI+carline prefixes for Mexico / US plants (same carlines, different WMI). */
const MAZDA_PREFIX_RULES: PrefixRule[] = compilePrefixRules(
  Object.entries(MAZDA_CARLINES).flatMap(([code, { model, chassis }]) =>
    [...MAZDA_CARLINE_WMIS].map((wmi) => ({
      prefix: `${wmi}${code}`,
      model,
      chassis,
    })),
  ),
);

export function isMazdaVin(vin: string): boolean {
  const wmi = vin.slice(0, 3).toUpperCase();
  if (MAZDA_CARLINE_WMIS.has(wmi)) return true;
  // Ford-built Mazda nameplates — make only from WMI table; no carline map.
  return wmi === "4F2" || wmi === "4F4";
}

export function matchMazdaRule(vin: string): PrefixRule | null {
  const u = vin.toUpperCase().trim();
  if (u.length < 5) return null;
  const wmi = u.slice(0, 3);
  if (!MAZDA_CARLINE_WMIS.has(wmi)) return null;
  return matchLongestPrefix(u, MAZDA_PREFIX_RULES);
}

export function decodeMazdaModel(vin: string): string | null {
  return matchMazdaRule(vin)?.model ?? null;
}
