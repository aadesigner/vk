/**
 * Ford North America VIN model decode (US / Canada / Mexico plants).
 *
 * Sources (no guessing):
 * - NHTSA vPIC DecodeVinValues for each prefix below
 * - Ford NA VDS patterns already locked in multi-brand QA
 *
 * Ambiguous / unknown → null. Ford Europe stays in ford-eu.ts.
 */

import { compilePrefixRules, matchLongestPrefix, type PrefixRule } from "./prefix-match";

const FORD_NA_WMI = new Set([
  "1FA", "1FB", "1FC", "1FD", "1FM", "1FT",
  "2FA", "2FM", "2FT",
  "3FA", "3FE", "3FM", "3FT",
]);

/**
 * Longest-prefix VDS rules. Prefer 6–7 char prefixes when a shorter stem
 * would collide across model lines (e.g. 1FT7 vs 1FTFW).
 */
const FORD_NA_RULES: PrefixRule[] = compilePrefixRules([
  // F-150
  { prefix: "1FTFW1", model: "F-150", chassis: "P702" },
  { prefix: "1FTFW2", model: "F-150", chassis: "P702" },
  { prefix: "1FTEW1", model: "F-150", chassis: "P702" },
  { prefix: "1FTEX1", model: "F-150", chassis: "P415/P552" },
  { prefix: "1FTFX1", model: "F-150", chassis: "P415" },
  { prefix: "1FTMF1", model: "F-150", chassis: "P415" },
  { prefix: "1FTRX1", model: "F-150", chassis: "P415" },
  { prefix: "1FTNX1", model: "F-150" },
  { prefix: "1FTPW1", model: "F-150", chassis: "P702" },
  { prefix: "3FTFW1", model: "F-150", chassis: "P702" },
  // Super Duty — NHTSA series distinguishes F-250 / F-350
  { prefix: "1FT7W2", model: "F-250", chassis: "Super Duty" },
  { prefix: "1FT7W3", model: "F-350", chassis: "Super Duty" },
  { prefix: "1FT8W2", model: "F-250", chassis: "Super Duty" },
  { prefix: "1FT8W3", model: "F-350", chassis: "Super Duty" },
  { prefix: "1FTBF2", model: "F-250", chassis: "Super Duty" },
  { prefix: "1FTBF3", model: "F-350", chassis: "Super Duty" },
  { prefix: "1FTRF2", model: "F-250", chassis: "Super Duty" },
  { prefix: "1FTRF3", model: "F-350", chassis: "Super Duty" },
  { prefix: "1FTBW2", model: "Transit", chassis: "V363" },
  { prefix: "1FTBW3", model: "Transit", chassis: "V363" },
  // Escape / Kuga twin NA
  { prefix: "1FMCU0", model: "Escape", chassis: "CX482" },
  { prefix: "1FMCU9", model: "Escape" },
  { prefix: "1FMCU2", model: "Escape" },
  { prefix: "1FMCU3", model: "Escape" },
  { prefix: "1FMCU4", model: "Escape" },
  { prefix: "1FMCU5", model: "Escape" },
  { prefix: "1FMCU6", model: "Escape" },
  { prefix: "1FMCU7", model: "Escape" },
  { prefix: "1FMCU8", model: "Escape" },
  // Explorer
  { prefix: "1FM5K8", model: "Explorer", chassis: "U625" },
  { prefix: "1FMSK8", model: "Explorer", chassis: "U625" },
  { prefix: "1FM5K7", model: "Explorer" },
  { prefix: "1FMHK7", model: "Edge" },
  { prefix: "1FMHK8", model: "Edge" },
  { prefix: "2FMPK3", model: "Edge" },
  { prefix: "2FMPK4", model: "Edge" },
  // Expedition
  { prefix: "1FMJK1", model: "Expedition MAX", chassis: "U553" },
  { prefix: "1FMJK2", model: "Expedition MAX", chassis: "U553" },
  { prefix: "1FMJU1", model: "Expedition", chassis: "U553" },
  { prefix: "1FMJU2", model: "Expedition", chassis: "U553" },
  { prefix: "1FMEU1", model: "Expedition" },
  { prefix: "1FMEU2", model: "Expedition" },
  // Mustang (ICE) — exclude Mach-E (3FMT / 1FMF)
  { prefix: "1FA6P8", model: "Mustang", chassis: "S550" },
  { prefix: "1FA6P5", model: "Mustang", chassis: "S650" },
  { prefix: "1FATP8", model: "Mustang", chassis: "S550" },
  { prefix: "1FATP5", model: "Mustang", chassis: "S650" },
  { prefix: "1ZVBP8", model: "Mustang", chassis: "S197" },
  // Mach-E / Maverick / Bronco
  { prefix: "3FMTK1", model: "Mustang Mach-E", chassis: "Mach-E" },
  { prefix: "3FMTK2", model: "Mustang Mach-E", chassis: "Mach-E" },
  { prefix: "1FMFE5", model: "Mustang Mach-E", chassis: "Mach-E" },
  { prefix: "3FTTW8", model: "Maverick", chassis: "Maverick" },
  { prefix: "3FTTW9", model: "Maverick", chassis: "Maverick" },
  { prefix: "1FMEE5", model: "Bronco", chassis: "U725" },
  { prefix: "1FMEE6", model: "Bronco", chassis: "U725" },
  { prefix: "1FMDE5", model: "Bronco Sport", chassis: "CX430" },
  { prefix: "1FMDE6", model: "Bronco Sport", chassis: "CX430" },
  // Focus / Fusion (legacy NA)
  { prefix: "1FADP3", model: "Focus", chassis: "Mk3 US" },
  { prefix: "1FADP5", model: "Focus" },
  { prefix: "1FAHP3", model: "Focus" },
  { prefix: "3FA6P0", model: "Fusion" },
  { prefix: "3FAHP0", model: "Fusion" },
  // Ranger
  { prefix: "1FTER1", model: "Ranger", chassis: "T6" },
  { prefix: "1FTER2", model: "Ranger", chassis: "T6" },
  { prefix: "1FTYR1", model: "Ranger" },
  { prefix: "1FTKR1", model: "Ranger" },
]);

export function isFordNaVin(vin: string): boolean {
  const wmi = vin.slice(0, 3).toUpperCase();
  if (FORD_NA_WMI.has(wmi)) return true;
  // Flat Rock Mustang (AutoAlliance) — NHTSA-verified 1ZV*
  return wmi === "1ZV";
}

export function matchFordNaRule(vin: string): PrefixRule | null {
  const u = vin.toUpperCase().trim();
  if (u.length < 8) return null;
  if (!isFordNaVin(u)) return null;
  return matchLongestPrefix(u, FORD_NA_RULES);
}

export function decodeFordNaModel(vin: string): string | null {
  return matchFordNaRule(vin)?.model ?? null;
}
