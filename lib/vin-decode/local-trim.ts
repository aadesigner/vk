/**
 * Local series / generation vs trim / grade.
 * Series = platform / chassis / generation (e.g. Touareg 7P, BMW G20).
 * Trim = equipment grade / package when encoded (rare in VIN; NHTSA preferred).
 */

import { decodePremiumEuropean } from "./european-premium";
import { decodeSeatEuHomologation } from "./seat-eu";
import { matchHyundaiToyotaRule } from "./asian-eu";
import { matchUsVdsRule } from "./us-vds";
import { matchMazdaRule } from "./mazda";
import { matchCupraPlatform } from "./cupra-platform";
import { matchSkodaRule } from "./european-brands";
import { decodeGlobalBrand } from "./global-brands";

/** Extract platform/generation from a display model e.g. "Touareg (CR)". */
function seriesFromModelParen(model: string | null | undefined): string | null {
  if (!model) return null;
  const m = model.match(/\(([^)]+)\)\s*$/);
  if (!m) return null;
  const inner = m[1].trim();
  if (!inner || /^\d{4}$/.test(inner)) return null;
  // Prefer the platform token before year ranges: "5F, 2013–2020" → "5F"
  const first = inner.split(",")[0]?.trim();
  return first || inner;
}

/**
 * Platform / generation / chassis code for the Series field.
 * Prefer structured chassis; fall back to parentheses on display model.
 */
export function decodeLocalSeries(vin: string, model?: string | null): string | null {
  const upper = vin.toUpperCase();

  const premium = decodePremiumEuropean(upper);
  if (premium?.chassis) return premium.chassis;

  const cupra = matchCupraPlatform(upper);
  if (cupra) return cupra;

  const seat = decodeSeatEuHomologation(upper);
  if (seat?.platform) return seat.platform;

  const skoda = matchSkodaRule(upper);
  if (skoda?.chassis) return skoda.chassis;

  const asia = matchHyundaiToyotaRule(upper);
  if (asia?.chassis) return asia.chassis;

  const mazda = matchMazdaRule(upper);
  if (mazda?.chassis) return mazda.chassis;

  const us = matchUsVdsRule(upper);
  if (us?.chassis) return us.chassis;

  const global = decodeGlobalBrand(upper);
  if (global.chassis) return global.chassis;

  return seriesFromModelParen(model);
}

/**
 * Equipment trim / grade / package when the VIN encodes one.
 * Chassis / generation must NOT go here — use decodeLocalSeries.
 * NHTSA Trim remains preferred when the free decoder merges provider data.
 */
export function decodeLocalTrim(vin: string, _model?: string | null): string | null {
  void vin;
  void _model;
  // Public VIN rarely encodes SX/EX/Limited — leave empty for NHTSA to fill.
  return null;
}
