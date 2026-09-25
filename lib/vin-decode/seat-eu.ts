/**
 * SEAT / CUPRA (VSS, VS6, VS7, VSX) — EU type-approval codes after ZZZ filler.
 * Positions 7–8 encode the VAG platform / model line.
 * Model year stays ISO position 10 (no Ford-XX-style exception).
 * @see https://www.carmotospecs.com/vin/seat/
 */

import { compilePrefixRules, matchLongestPrefix, type PrefixRule } from "./prefix-match";

export type SeatHomologationHit = {
  model: string;
  platform: string | null;
  years: string | null;
};

type CodeRule = {
  code: string;
  model: string;
  platform?: string;
  years?: string;
};

export const SEAT_EU_WMIS = ["VSS", "VS6", "VS7", "VSX"] as const;

/** Legacy VS6/VS7 — model letter at positions 1–4 (e.g. VS6A = Ibiza). */
const SEAT_VS6_VS7_AT_4: Record<string, SeatHomologationHit> = {
  VS6A: { model: "Ibiza", platform: null, years: null },
  VS6B: { model: "Ibiza", platform: null, years: null },
  VS6K: { model: "León", platform: null, years: null },
  VS6L: { model: "León ST", platform: null, years: null },
  VS6M: { model: "Mii", platform: null, years: null },
  VS7A: { model: "Arona", platform: null, years: null },
  VS7B: { model: "Ateca", platform: null, years: null },
  VS7C: { model: "León", platform: null, years: null },
  VS7K: { model: "León", platform: null, years: null },
  VS7T: { model: "Tarraco", platform: null, years: null },
};

/** @deprecated Unused — single-char invent removed. Kept empty for import compatibility. */
export const SEAT_ZZZ_AT_7: Record<string, string> = {};

/**
 * Homologation type codes (positions 7–8 after ZZZ).
 * Years are display-only generation windows (open-ended when production continued).
 * Cupra-only lines (Formentor KM, Born K1/KP) live in global-brands.ts — not here.
 */
const SEAT_HOMOLOGATION_CODES: CodeRule[] = [
  // Ibiza / Cordoba
  { code: "6K", model: "Ibiza / Cordoba", platform: "6K", years: "1993–2009" },
  { code: "6L", model: "Ibiza / Cordoba", platform: "6L", years: "2002–2009" },
  { code: "6J", model: "Ibiza", platform: "6J", years: "2008–2017" },
  { code: "6F", model: "Ibiza", platform: "6F", years: "2017–" },
  { code: "KJ", model: "Ibiza", platform: "KJ", years: "2021–" },
  // León / Toledo (shared platforms)
  { code: "1M", model: "León / Toledo", platform: "1M", years: "1999–2006" },
  { code: "1P", model: "León", platform: "1P", years: "2005–2013" },
  { code: "5F", model: "León", platform: "5F", years: "2012–2020" },
  { code: "KL", model: "León", platform: "KL", years: "2020–" },
  // SUVs / crossovers
  { code: "K7", model: "Arona", platform: "K7", years: "2017–" },
  { code: "KH", model: "Ateca", platform: "KH", years: "2016–" },
  { code: "KN", model: "Tarraco", platform: "KN", years: "2018–" },
  // MPV / family
  { code: "5P", model: "Altea / Toledo", platform: "5P", years: "2004–2015" },
  { code: "7M", model: "Alhambra", platform: "7M", years: "1996–2010" },
  { code: "7N", model: "Alhambra", platform: "7N", years: "2010–2020" },
  // Sedans / city / niche
  { code: "1L", model: "Toledo", platform: "1L", years: "1991–1999" },
  { code: "NH", model: "Toledo", platform: "NH", years: "2012–2019" },
  { code: "3R", model: "Exeo", platform: "3R", years: "2008–2014" },
  { code: "6H", model: "Arosa", platform: "6H", years: "1997–2004" },
  { code: "1S", model: "Mii", platform: "1S", years: "2011–2021" },
  { code: "AA", model: "Mii", platform: "AA", years: "2012–2021" },
];

function rulesForWmi(wmi: string, codes: CodeRule[]): PrefixRule[] {
  return codes.map(({ code, model, platform, years }) => ({
    prefix: `${wmi}ZZZ${code}`,
    model: formatSeatDisplay({ model, platform: platform ?? null, years: years ?? null }),
  }));
}

const SEAT_EU_RULES = compilePrefixRules(
  SEAT_EU_WMIS.flatMap((wmi) => rulesForWmi(wmi, SEAT_HOMOLOGATION_CODES)),
);

export function formatSeatDisplay(hit: SeatHomologationHit): string {
  const meta: string[] = [];
  if (hit.platform) meta.push(hit.platform);
  if (hit.years) meta.push(hit.years);
  if (meta.length === 0) return hit.model;
  return `${hit.model} (${meta.join(", ")})`;
}

function hitFromRule(rule: PrefixRule): SeatHomologationHit {
  const paren = rule.model.match(/^(.+?) \((.+)\)$/);
  if (!paren) return { model: rule.model, platform: null, years: null };
  const inner = paren[2];
  const comma = inner.indexOf(", ");
  if (comma === -1) {
    return { model: paren[1], platform: inner, years: null };
  }
  return {
    model: paren[1],
    platform: inner.slice(0, comma),
    years: inner.slice(comma + 2),
  };
}

export function decodeSeatEuHomologation(vin: string): SeatHomologationHit | null {
  const u = vin.toUpperCase().trim();
  if (u.length < 8) return null;

  const wmi = u.slice(0, 3);
  if (!(SEAT_EU_WMIS as readonly string[]).includes(wmi)) return null;

  if (u.slice(3, 6) === "ZZZ") {
    const hit = matchLongestPrefix(u, SEAT_EU_RULES);
    if (hit) return hitFromRule(hit);
    // No single-char invent — unknown 2-char type stays null.
    return null;
  }

  if (wmi === "VS6" || wmi === "VS7") {
    const key = u.slice(0, 4);
    return SEAT_VS6_VS7_AT_4[key] ?? null;
  }

  return null;
}

export function decodeSeatEuModel(vin: string): string | null {
  const hit = decodeSeatEuHomologation(vin);
  return hit ? formatSeatDisplay(hit) : null;
}
