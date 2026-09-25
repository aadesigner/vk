/** Miles → km for US provider PDFs (Carfax / AutoCheck). */

export const KM_PER_MILE = 1.609344;

export function milesToKm(miles: number): number {
  if (!Number.isFinite(miles) || miles < 0) return 0;
  return Math.round(miles * KM_PER_MILE);
}

/** Parse a numeric odometer token that may include commas. */
export function parseOdometerNumber(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").replace(/\s+/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Convert a reading to km.
 * Default assumes miles (US reports) unless unit clearly indicates km.
 */
export function readingToKm(value: number, unitHint?: string | null): number {
  const u = (unitHint ?? "").toLowerCase();
  if (/\b(km|kilomet)/.test(u)) return Math.round(value);
  if (/\b(mi|mile)/.test(u)) return milesToKm(value);
  // Bare number on Carfax/AutoCheck → miles
  return milesToKm(value);
}

/** Extract unit hint from nearby text (e.g. "45,230 miles" or "72800 km"). */
export function unitHintFromSnippet(snippet: string): string | null {
  const s = snippet.toLowerCase();
  if (/\b(kilometers?|kilometres?|\bkm\b)/.test(s)) return "km";
  if (/\b(miles?|\bmi\b)/.test(s)) return "mi";
  return null;
}
