/**
 * Volvo Cars model / body / fuel / drive decoding.
 *
 * Volvo uses two VIN layouts for the same descriptor characters:
 *   • EU / rest-of-world (YV1, YV4, LYV, LVY, XLB, PNV …): the vehicle-line
 *     letter sits at position 4 (VIN index 3). Positions 6–7 carry the engine.
 *   • USA / Canada, model-year 2010+ (market code 30/31/39, incl. US-built 7JR /
 *     7JD and US-market YV cars): NHTSA required a position swap, so the same
 *     vehicle-line letter moves to position 7 (VIN index 6). Positions 4–5 carry
 *     the engine and position 6 is the emissions "version divider".
 *
 * The letter → model mapping itself is shared across both layouts (the swap only
 * relocates it), so one table serves both — we just read it from the position
 * that matches the layout. The third WMI character never encodes the model:
 * YV4 = XC / Cross-Country vehicles, YV1 = every other passenger car. That
 * XC-vs-non-XC split is used to validate the decode and reject an engine
 * character that happens to collide with a model letter.
 *
 * Sources: Volvo Car USA 49 CFR Part 565 MY2019–2022 VIN decoders (NHTSA vPIC)
 * and the community Wikibooks Volvo VIN reference.
 */

import { isoModelYearCandidates, resolveIsoModelYear } from "./iso-year";

export const VOLVO_WMIS = new Set<string>([
  "YV1", // Volvo passenger cars (Sweden/Belgium) — non-XC
  "YV4", // Volvo XC & Cross Country (Sweden/Belgium/China)
  "LYV", // Volvo China (Chengdu / Luqiao)
  "LVY", // Volvo China (Daqing) — S90
  "XLB", // Volvo/NedCar (older 300/400 series)
  "PNV", // Volvo Malaysia
  "7JR", // Volvo USA (South Carolina) — S60
  "7JD", // Volvo USA (South Carolina) — MPV/SUV
  "MHA", // Volvo (PT Central Sole Agency, Indonesia assembly)
]);

export function isVolvoVin(vin: string): boolean {
  return VOLVO_WMIS.has(vin.slice(0, 3).toUpperCase());
}

export type VolvoSpec = {
  model: string;
  bodyStyle: string | null;
  fuelType: string | null;
  driveType: string | null;
};

type ModelMeta = {
  body: string | null;
  xc: boolean;
  fuel?: string;
  drive?: string;
};

/** Body / powertrain characteristics per Volvo model line. */
const MODEL_META: Record<string, ModelMeta> = {
  "S40": { body: "Sedan", xc: false },
  "S60": { body: "Sedan", xc: false },
  "S60 Cross Country": { body: "Sedan", xc: true, drive: "All-Wheel Drive" },
  "S80": { body: "Sedan", xc: false },
  "S90": { body: "Sedan", xc: false },
  "V40": { body: "Wagon", xc: false },
  "V50": { body: "Wagon", xc: false },
  "V60": { body: "Wagon", xc: false },
  "V60 Cross Country": { body: "Wagon", xc: true, drive: "All-Wheel Drive" },
  "V70": { body: "Wagon", xc: false },
  "V90": { body: "Wagon", xc: false },
  "V90 Cross Country": { body: "Wagon", xc: true, drive: "All-Wheel Drive" },
  "XC40": { body: "SUV", xc: true },
  "XC60": { body: "SUV", xc: true },
  "XC70": { body: "Wagon", xc: false },
  "XC90": { body: "SUV", xc: true },
  "XC90 Excellence": { body: "SUV", xc: true },
  "C30": { body: "Hatchback", xc: false },
  "C70": { body: "Convertible", xc: false },
  "C40 Recharge": { body: "SUV", xc: true, fuel: "Electric" },
  "EC40": { body: "SUV", xc: true, fuel: "Electric" },
  "EX30": { body: "SUV", xc: true, fuel: "Electric" },
  "EX30 Cross Country": { body: "SUV", xc: true, fuel: "Electric", drive: "All-Wheel Drive" },
  "EX40": { body: "SUV", xc: true, fuel: "Electric" },
  "EX90": { body: "SUV", xc: true, fuel: "Electric" },
};

type Candidate = { model: string; from: number; to: number };

/** Vehicle-line letter → model, for model-year 2010+ (US pos 7 / EU pos 4). */
const MODERN_CODES: Record<string, Candidate[]> = {
  A: [{ model: "S80", from: 2010, to: 2016 }, { model: "S90", from: 2017, to: 2099 }],
  B: [
    { model: "XC70", from: 2010, to: 2016 },
    { model: "C40 Recharge", from: 2024, to: 2024 },
    { model: "EC40", from: 2025, to: 2099 },
  ],
  C: [{ model: "XC90", from: 2010, to: 2099 }, { model: "EX30 Cross Country", from: 2026, to: 2099 }],
  D: [{ model: "XC60", from: 2010, to: 2099 }],
  E: [{ model: "V60", from: 2015, to: 2099 }],
  F: [{ model: "S60", from: 2011, to: 2099 }],
  G: [
    { model: "V90", from: 2018, to: 2021 },
    { model: "C40 Recharge", from: 2022, to: 2024 },
    { model: "S60", from: 2025, to: 2099 },
  ],
  H: [
    { model: "V60 Cross Country", from: 2015, to: 2016 },
    { model: "S60", from: 2017, to: 2018 },
    { model: "XC40", from: 2019, to: 2099 },
  ],
  J: [
    { model: "V60 Cross Country", from: 2015, to: 2019 },
    { model: "XC90", from: 2024, to: 2099 },
  ],
  K: [{ model: "XC90", from: 2016, to: 2023 }, { model: "EX90", from: 2025, to: 2099 }],
  L: [{ model: "XC90", from: 2024, to: 2024 }],
  M: [
    { model: "S40", from: 2010, to: 2011 },
    { model: "S80", from: 2015, to: 2015 },
    { model: "S90", from: 2017, to: 2024 },
  ],
  N: [
    { model: "XC70", from: 2015, to: 2016 },
    { model: "V90 Cross Country", from: 2017, to: 2026 },
  ],
  P: [{ model: "XC90", from: 2016, to: 2099 }],
  R: [{ model: "XC60", from: 2015, to: 2099 }],
  S: [{ model: "V60", from: 2015, to: 2099 }],
  T: [{ model: "S60", from: 2015, to: 2099 }],
  U: [
    { model: "S60 Cross Country", from: 2016, to: 2018 },
    { model: "XC40", from: 2019, to: 2099 },
  ],
  V: [
    { model: "V90", from: 2017, to: 2021 },
    { model: "EX90", from: 2025, to: 2099 },
  ],
  W: [{ model: "V60 Cross Country", from: 2017, to: 2026 }],
  X: [{ model: "XC90", from: 2016, to: 2018 }, { model: "XC40", from: 2019, to: 2099 }],
  Y: [{ model: "EX30", from: 2025, to: 2099 }],
  Z: [{ model: "XC90 Excellence", from: 2017, to: 2019 }, { model: "EX30", from: 2025, to: 2099 }],
  "0": [{ model: "XC90", from: 2020, to: 2023 }],
  "1": [{ model: "XC90", from: 2020, to: 2023 }],
};

/** Vehicle-line letter → model, for model-year ≤2009 (EU pos 4). */
const LEGACY_CODES: Record<string, Candidate[]> = {
  A: [{ model: "S80", from: 2007, to: 2009 }],
  B: [{ model: "V70", from: 2008, to: 2009 }],
  C: [{ model: "XC90", from: 2003, to: 2009 }],
  M: [{ model: "S40", from: 2004, to: 2009 }],
  N: [{ model: "C70", from: 1998, to: 2009 }],
  R: [{ model: "S60", from: 2001, to: 2009 }],
  S: [{ model: "V70", from: 2001, to: 2007 }],
  T: [{ model: "S80", from: 1999, to: 2006 }],
  V: [{ model: "S40", from: 2000, to: 2004 }],
};

function volvoModelYear(vin: string, window?: { from: number; to: number } | null): number | null {
  // Unique ISO cycle only — never prefer-recent.
  return resolveIsoModelYear(vin[9] ?? "", window ?? null);
}

/** Pick the model for a vehicle-line letter, constrained by year and XC-ness. */
function pickModel(
  letter: string | undefined,
  year: number | null,
  xcWmi: boolean | null,
): string | null {
  if (!letter) return null;
  const table = year != null && year <= 2009 ? LEGACY_CODES : MODERN_CODES;
  let cands = table[letter];
  if (!cands || cands.length === 0) return null;

  if (xcWmi != null) {
    cands = cands.filter((c) => (MODEL_META[c.model]?.xc ?? false) === xcWmi);
    if (cands.length === 0) return null;
  }

  if (year != null) {
    const inRange = cands.filter((c) => year >= c.from && year <= c.to);
    if (inRange.length === 0) return null;
    if (inRange.length === 1) return inRange[0]!.model;
    // Multiple rows for the same year span — only emit if they share one model name.
    const names = [...new Set(inRange.map((c) => c.model))];
    return names.length === 1 ? names[0]! : null;
  }

  // Year unknown — emit model only when the VDS letter maps to exactly one name.
  const names = [...new Set(cands.map((c) => c.model))];
  return names.length === 1 ? names[0]! : null;
}

/**
 * When ISO year is ambiguous, try each candidate and keep the model only if unique.
 */
function pickModelAcrossYearCandidates(
  letter: string | undefined,
  xcWmi: boolean | null,
  yearCode: string,
): { model: string; year: number | null } | null {
  if (!letter) return null;
  const maxY = new Date().getFullYear() + 2;
  const years = isoModelYearCandidates(yearCode).filter((y) => y >= 1980 && y <= maxY);
  if (years.length === 0) return null;
  if (years.length === 1) {
    const model = pickModel(letter, years[0]!, xcWmi);
    return model ? { model, year: years[0]! } : null;
  }
  const hits: { model: string; year: number }[] = [];
  for (const y of years) {
    const model = pickModel(letter, y, xcWmi);
    if (model) hits.push({ model, year: y });
  }
  if (hits.length === 0) return null;
  const models = new Set(hits.map((h) => h.model));
  if (models.size !== 1) return null;
  // Same model name across cycles — year still ambiguous.
  return { model: hits[0]!.model, year: null };
}

function specFor(model: string): VolvoSpec {
  const meta = MODEL_META[model];
  return {
    model,
    bodyStyle: meta?.body ?? null,
    fuelType: meta?.fuel ?? null,
    driveType: meta?.drive ?? null,
  };
}

/**
 * Decode Volvo model + body + fuel + drive from a 17-char VIN.
 * Returns null for non-Volvo VINs or when the descriptor can't be resolved.
 */
export function decodeVolvoSpec(vin: string): VolvoSpec | null {
  const upper = vin.toUpperCase().trim();
  if (upper.length !== 17) return null;
  const wmi = upper.slice(0, 3);
  if (!VOLVO_WMIS.has(wmi)) return null;

  const year = volvoModelYear(upper);
  const xcWmi = wmi === "YV4" ? true : wmi === "YV1" ? false : null;

  // Model-specific WMIs decode directly and reliably.
  if (wmi === "LVY") return specFor("S90");
  if (wmi === "7JR") return specFor("S60");

  // US-built VINs (7-prefix) use the NHTSA-swapped layout with the model at
  // position 7; every other market keeps the model at position 4. We do NOT
  // cross-try the opposite position — on the other layout that slot holds the
  // engine code, which can collide with a model letter and mis-decode.
  const usBuilt = wmi.startsWith("7");
  const modelIdx = usBuilt ? 6 : 3;

  if (year != null) {
    const model = pickModel(upper[modelIdx], year, xcWmi);
    return model ? specFor(model) : null;
  }

  const across = pickModelAcrossYearCandidates(upper[modelIdx], xcWmi, upper[9] ?? "");
  return across ? specFor(across.model) : null;
}

/** Model-line string only (used by the shared model resolver). */
export function decodeVolvoModel(vin: string): string | null {
  return decodeVolvoSpec(vin)?.model ?? null;
}
