/**
 * BYD model / body / fuel / drive decoding from VDS prefix tables.
 * WMIs: LGX (primary passenger), LC0, LFP, LBV, LPE.
 * Sources: 17vin.com model registries, Carlytics BYD VIN guide.
 */

import { compilePrefixRules, matchLongestPrefix } from "./prefix-match";
import type { BrandVinSpec } from "./brand-vin-spec";

export const BYD_WMIS = new Set(["LGX", "LC0", "LFP", "LBV", "LPE"]);

const BYD_PREFIX_RULES = compilePrefixRules([
  // Atto 3 / Yuan Plus
  { prefix: "LGXCE4", model: "Atto 3", body: "SUV" },
  { prefix: "LC0C5G", model: "Atto 3", body: "SUV" },
  { prefix: "LFPAA", model: "Atto 3", body: "SUV" },
  // Seal
  { prefix: "LGXCH6", model: "Seal", body: "Sedan" },
  { prefix: "LC0DE", model: "Seal", body: "Sedan" },
  // Dolphin
  { prefix: "LC0CE4", model: "Dolphin", body: "Hatchback" },
  { prefix: "LC0CE", model: "Dolphin", body: "Hatchback" },
  // Han
  { prefix: "LC0CE6", model: "Han", body: "Sedan" },
  { prefix: "LFPBB", model: "Han", body: "Sedan" },
  // Tang
  { prefix: "LFPBC", model: "Tang", body: "SUV" },
  // Seagull
  { prefix: "LC0CF", model: "Seagull", body: "Hatchback" },
  // Song Plus
  { prefix: "LBVYA", model: "Song Plus", body: "SUV" },
  // Sealion 7 / Seal U (common LC0 family)
  { prefix: "LC0DG", model: "Sealion 7", body: "SUV" },
  { prefix: "LC0DH", model: "Seal U", body: "SUV" },
  // Song / Qin family fallbacks
  { prefix: "LC0D", model: "Song", body: "SUV" },
  { prefix: "LC0B", model: "Qin", body: "Sedan" },
]);

const MODEL_META: Record<string, { body: string; fuel: string }> = {
  "Atto 3": { body: "SUV", fuel: "Electric" },
  Seal: { body: "Sedan", fuel: "Electric" },
  Dolphin: { body: "Hatchback", fuel: "Electric" },
  Han: { body: "Sedan", fuel: "Electric" },
  Tang: { body: "SUV", fuel: "Electric" },
  Seagull: { body: "Hatchback", fuel: "Electric" },
  "Song Plus": { body: "SUV", fuel: "Electric" },
  "Sealion 7": { body: "SUV", fuel: "Electric" },
  "Seal U": { body: "SUV", fuel: "Electric" },
  Song: { body: "SUV", fuel: "Electric" },
  Qin: { body: "Sedan", fuel: "Electric" },
};

const BYD_PLANTS: Record<string, { city: string; country: string }> = {
  "1": { city: "Shenzhen (Pingshan)", country: "China" },
  "2": { city: "Xi'an", country: "China" },
  "3": { city: "Changsha", country: "China" },
  A: { city: "Shenzhen", country: "China" },
  B: { city: "Xi'an", country: "China" },
  C: { city: "Changsha", country: "China" },
};

export function isBydVin(vin: string): boolean {
  return BYD_WMIS.has(vin.slice(0, 3).toUpperCase());
}

export function decodeBydSpec(vin: string): BrandVinSpec | null {
  const upper = vin.toUpperCase().trim();
  if (!isBydVin(upper)) return null;

  const hit = matchLongestPrefix(upper, BYD_PREFIX_RULES);
  if (!hit) return null;

  const meta = MODEL_META[hit.model];
  const plant = BYD_PLANTS[upper[10]] ?? { city: null, country: "China" };

  return {
    make: "BYD",
    model: hit.model,
    bodyStyle: hit.body ?? meta?.body ?? null,
    fuelType: meta?.fuel ?? "Electric",
    driveType: hit.drive ?? null,
    engineDecoded: "Blade Battery (LFP) · Electric Motor",
    transmissionDecoded: "Single-Speed Automatic",
    plantCity: plant.city,
    plantCountry: plant.country,
  };
}

export function decodeBydModel(vin: string): string | null {
  return decodeBydSpec(vin)?.model ?? null;
}
