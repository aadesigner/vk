/**
 * Zeekr (Geely premium EV) model decoding via L6T WMI + VDS prefix tables.
 * Sources: 17vin.com Zeekr model registries, NHTSA/Geely L6T WMI.
 */

import { compilePrefixRules, matchLongestPrefix } from "./prefix-match";
import type { BrandVinSpec } from "./brand-vin-spec";

export const ZEEKR_WMIS = new Set(["L6T"]);

const ZEEKR_PREFIX_RULES = compilePrefixRules([
  // Zeekr 009 (shares T2E family with 001 — disambiguate on pos 5–7)
  { prefix: "L6T79T2E9M", model: "009", body: "MPV", drive: "All-Wheel Drive" },
  // Zeekr 001
  { prefix: "L6T79T2", model: "001", body: "Shooting Brake", drive: "All-Wheel Drive" },
  // Zeekr 007
  { prefix: "L6T79ME", model: "007", body: "Sedan", drive: "Rear-Wheel Drive" },
  { prefix: "L6T79NE", model: "007", body: "Sedan", drive: "All-Wheel Drive" },
  // Zeekr X
  { prefix: "L6T79XE", model: "X", body: "SUV", drive: "All-Wheel Drive" },
  // Zeekr 7X
  { prefix: "L6T79AA", model: "7X", body: "SUV", drive: "Rear-Wheel Drive" },
  { prefix: "L6T79NC", model: "7X", body: "SUV", drive: "All-Wheel Drive" },
  // Zeekr MIX
  { prefix: "L6T79MI", model: "MIX", body: "MPV", drive: "All-Wheel Drive" },
  // Broader 79-series fallbacks (year/model disambiguation)
  { prefix: "L6T79T", model: "001", body: "Shooting Brake" },
  { prefix: "L6T79M", model: "007", body: "Sedan" },
  { prefix: "L6T79N", model: "007", body: "Sedan", drive: "All-Wheel Drive" },
  { prefix: "L6T8FD", model: "001", body: "Shooting Brake" },
  { prefix: "L6TWV", model: "001", body: "Shooting Brake" },
  { prefix: "L6TKG", model: "001", body: "Shooting Brake" },
]);

const MODEL_META: Record<string, { body: string }> = {
  "001": { body: "Shooting Brake" },
  "007": { body: "Sedan" },
  "009": { body: "MPV" },
  X: { body: "SUV" },
  "7X": { body: "SUV" },
  MIX: { body: "MPV" },
};

export function isZeekrVin(vin: string): boolean {
  return ZEEKR_WMIS.has(vin.slice(0, 3).toUpperCase());
}

export function decodeZeekrSpec(vin: string): BrandVinSpec | null {
  const upper = vin.toUpperCase().trim();
  if (!isZeekrVin(upper)) return null;

  const hit = matchLongestPrefix(upper, ZEEKR_PREFIX_RULES);
  if (!hit) return null;

  const meta = MODEL_META[hit.model];

  return {
    make: "Zeekr",
    model: hit.model,
    bodyStyle: hit.body ?? meta?.body ?? null,
    fuelType: "Electric",
    driveType: hit.drive ?? "All-Wheel Drive",
    engineDecoded: "Electric Motor",
    transmissionDecoded: "Single-Speed Automatic",
    plantCity: "Hangzhou / Ningbo",
    plantCountry: "China",
  };
}

export function decodeZeekrModel(vin: string): string | null {
  return decodeZeekrSpec(vin)?.model ?? null;
}
