/**
 * Xiaomi Auto model decoding.
 * SU7 is built by BAIC (WMI LNB); Xiaomi also holds WMI HXM.
 * Sources: Wikibooks WMI registry, market VIN listings (LNB prefix).
 */

import { compilePrefixRules, matchLongestPrefix } from "./prefix-match";
import type { BrandVinSpec } from "./brand-vin-spec";

export const XIAOMI_WMIS = new Set(["LNB", "HXM"]);

const XIAOMI_PREFIX_RULES = compilePrefixRules([
  // SU7 sedan (BAIC-built, LNB WMI)
  { prefix: "LNBMS", model: "SU7", body: "Sedan" },
  { prefix: "LNB", model: "SU7", body: "Sedan" },
  // Xiaomi direct WMI
  { prefix: "HXM", model: "SU7", body: "Sedan" },
]);

export function isXiaomiVin(vin: string): boolean {
  return XIAOMI_WMIS.has(vin.slice(0, 3).toUpperCase());
}

export function decodeXiaomiSpec(vin: string): BrandVinSpec | null {
  const upper = vin.toUpperCase().trim();
  if (!isXiaomiVin(upper)) return null;

  const hit = matchLongestPrefix(upper, XIAOMI_PREFIX_RULES);
  if (!hit) return null;

  // Position 8 often encodes RWD vs AWD on Chinese EVs; E/F/G = dual motor hints.
  const driveHint = upper[7];
  const drive =
    hit.drive ??
    (driveHint === "E" || driveHint === "F" || driveHint === "G"
      ? "All-Wheel Drive"
      : "Rear-Wheel Drive");

  return {
    make: "Xiaomi",
    model: hit.model,
    bodyStyle: hit.body ?? "Sedan",
    fuelType: "Electric",
    driveType: drive,
    engineDecoded: "HyperEngine Electric Motor",
    transmissionDecoded: "Single-Speed Automatic",
    plantCity: "Beijing (BAIC)",
    plantCountry: "China",
  };
}

export function decodeXiaomiModel(vin: string): string | null {
  return decodeXiaomiSpec(vin)?.model ?? null;
}
