/**
 * Verified VW Group model/type decoding shared by Volkswagen, Audi, Škoda and Porsche.
 *
 * EU VAG VINs normally put the model type at positions 7–8 after ZZZ filler.
 * North-American VW/Audi VINs also expose a model type at positions 7–8, but the
 * code set can differ (for example E8 = Chattanooga-built ID.4).
 *
 * Keep this resolver conservative: a type code may identify a product line, but
 * usually not an exact trim, battery, drivetrain or body variant.
 */

import { resolveIsoModelYear } from "./iso-year";

export type VagModernHit = {
  model: string;
  chassis: string | null;
  electric?: boolean;
};

export function vagModelYear(vin: string, window?: { from: number; to: number } | null): number | null {
  // Unique ISO cycle only — never prefer-recent when both 30-year twins remain.
  return resolveIsoModelYear(vin.trim().toUpperCase()[9] ?? "", window ?? null);
}

const VW_WMIS = new Set([
  "WVW", "WVG", "WV1", "WV2", "WV3",
  "1VW", "1V2", "3VW", "3VV",
  "9BW", "8AP", "LFV", "LSV",
]);

const AUDI_WMIS = new Set(["WAU", "WA1", "WUA", "TRU"]);
const PORSCHE_WMIS = new Set(["WP0", "WP1"]);
const SKODA_WMIS = new Set(["TMB", "TM8", "TMP", "TMS", "TNL", "XW8", "XWW", "Y6U"]);

export function isVolkswagenVin(vin: string): boolean {
  return VW_WMIS.has(vin.trim().toUpperCase().slice(0, 3));
}

export function isAudiVin(vin: string): boolean {
  return AUDI_WMIS.has(vin.trim().toUpperCase().slice(0, 3));
}

export function isPorscheVin(vin: string): boolean {
  return PORSCHE_WMIS.has(vin.trim().toUpperCase().slice(0, 3));
}

export function isSkodaVin(vin: string): boolean {
  return SKODA_WMIS.has(vin.trim().toUpperCase().slice(0, 3));
}

/**
 * China joint-venture WMIs (LFV/LSV) are shared across VAG brands.
 * Only return a marque when the VDS prefix is verified.
 */
export function resolveChinaJointVentureMake(vin: string): string | null {
  const u = vin.trim().toUpperCase();
  if (u.startsWith("LFVVB9E") || u.startsWith("LSV1C6E")) return "Volkswagen";
  if (u.startsWith("LFV") || u.startsWith("LSV")) return "Volkswagen Group (China JV)";
  return null;
}

type StaticHit = Omit<VagModernHit, "chassis"> & { chassis?: string };

/** Year-reused EU type codes — year required; no match → null (never invent). */
type YearGatedEuType = StaticHit & {
  code: string;
  yearFrom?: number;
  yearTo?: number;
};

const VW_EU_YEAR_GATED: YearGatedEuType[] = [
  // Typ 16: early Jetta 1/2, then A5 Beetle from ~2012 (Club VeeDub / VW type lists)
  { code: "16", model: "Jetta", chassis: "Typ 16", yearFrom: 1979, yearTo: 1992 },
  { code: "16", model: "Beetle", chassis: "A5", yearFrom: 2012, yearTo: 2019 },
];

function matchVwYearGated(code: string, yearCode: string): VagModernHit | null {
  const candidates = VW_EU_YEAR_GATED.filter((r) => r.code === code);
  if (candidates.length === 0) return null;
  // Resolve year against each production window — emit only when exactly one rule matches.
  const hits = candidates.filter((r) => {
    const y = resolveIsoModelYear(yearCode, {
      from: r.yearFrom ?? 1980,
      to: r.yearTo ?? 2099,
    });
    return y != null;
  });
  return hits.length === 1 ? materialize(hits[0]!) : null;
}

const VW_EU_TYPE_78: Record<string, StaticHit> = {
  // MEB electric family
  E1: { model: "ID.3", chassis: "E1 (MEB)", electric: true },
  E2: { model: "ID.4", chassis: "E2 (MEB)", electric: true },
  E3: { model: "ID.5", chassis: "E3 (MEB)", electric: true },
  E4: { model: "ID.7", chassis: "E4 (MEB)", electric: true },
  EB: { model: "ID. Buzz", chassis: "EB (MEB)", electric: true },
  ST: { model: "ID. Buzz Cargo", chassis: "ST (MEB)", electric: true },

  // Current and recent passenger/SUV lines
  CD: { model: "Golf", chassis: "Mk8" },
  AU: { model: "Golf", chassis: "Mk7" },
  AW: { model: "Polo", chassis: "AW" },
  "6R": { model: "Polo", chassis: "6R" },
  "6C": { model: "Polo", chassis: "6C" },
  "6N": { model: "Polo", chassis: "6N" },
  "9N": { model: "Polo", chassis: "9N" },
  CJ: { model: "Passat Variant", chassis: "B9/CJ" },
  "3C": { model: "Passat / CC", chassis: "B6-B8/3C" },
  "3H": { model: "Arteon", chassis: "3H" },
  "3D": { model: "Arteon", chassis: "3D" },
  BP: { model: "Arteon", chassis: "BP" },
  CT: { model: "Tiguan", chassis: "CT1" },
  "5N": { model: "Tiguan / Tiguan Allspace", chassis: "5N" },
  R4: { model: "Tayron", chassis: "R4" },
  A1: { model: "T-Roc", chassis: "A1" },
  SH: { model: "T-Roc", chassis: "A1/SH" },
  C1: { model: "T-Cross", chassis: "C1" },
  "6J": { model: "Taigo", chassis: "6J" },
  AA: { model: "Up!", chassis: "AA" },
  "7L": { model: "Touareg", chassis: "7L" },
  "7P": { model: "Touareg", chassis: "7P" },
  CR: { model: "Touareg", chassis: "CR" },
  SK: { model: "Caddy", chassis: "SK" },
  "2K": { model: "Caddy / Caddy Maxi", chassis: "2K" },
  "2D": { model: "Caddy", chassis: "2D" },
  "2F": { model: "Caddy Maxi", chassis: "2F" },
  "7E": { model: "Caddy", chassis: "7E" },
  SY: { model: "Crafter", chassis: "SY" },
  "2E": { model: "Crafter", chassis: "2E" },
  "2H": { model: "Amarok", chassis: "2H" },
  "1T": { model: "Touran", chassis: "1T" },
  "5T": { model: "Touran", chassis: "5T" },
  "7N": { model: "Sharan", chassis: "7N" },
  DF: { model: "Sharan", chassis: "DF" },
  "7H": { model: "Transporter / Multivan", chassis: "T5/T6" },
  "7J": { model: "Transporter / Multivan", chassis: "T6" },
  SF: { model: "Multivan", chassis: "T7" },
  SG: { model: "California", chassis: "T6.1/T7" },

  // Classic / Golf-family codes (2-char only — never invent from bare "1")
  "1G": { model: "Golf / Jetta", chassis: "1G" },
  "1H": { model: "Golf / Vento", chassis: "1H" },
  "1J": { model: "Golf / Jetta", chassis: "1J" },
  "1K": { model: "Golf", chassis: "Mk5" },
  "5K": { model: "Golf / Jetta", chassis: "5K" },
  "5M": { model: "Golf Plus", chassis: "5M" },
  "1Y": { model: "New Beetle Cabriolet", chassis: "1Y" },
  "9C": { model: "New Beetle", chassis: "9C" },
};

const VW_NON_EU_TYPE_78: Record<string, StaticHit> = {
  A3: { model: "Passat", chassis: "NMS/A3" },
  E2: { model: "ID.4", chassis: "E2 (MEB)", electric: true },
  E8: { model: "ID.4", chassis: "E8 (MEB)", electric: true },
  EB: { model: "ID. Buzz", chassis: "EB (MEB)", electric: true },
  B2: { model: "Taos", chassis: "B2" },
  CA: { model: "Atlas / Atlas Cross Sport", chassis: "CA" },
  RM: { model: "Tiguan", chassis: "RM" },
  AX: { model: "Tiguan / Tiguan Limited", chassis: "5N/BW" },
};

function materialize(hit: StaticHit | undefined): VagModernHit | null {
  if (!hit) return null;
  return { model: hit.model, chassis: hit.chassis ?? null, ...(hit.electric ? { electric: true } : {}) };
}

export function decodeVolkswagenModern(vin: string, _year?: number | null): VagModernHit | null {
  const u = vin.trim().toUpperCase();
  if (u.length !== 17 || !isVolkswagenVin(u)) return null;
  // China-only ID.6 uses joint-venture-specific VDS prefixes rather than the
  // European ZZZ/type-code layout.
  if (u.startsWith("LFVVB9E")) {
    return { model: "ID.6 CROZZ", chassis: "MEB", electric: true };
  }
  if (u.startsWith("LSV1C6E")) {
    return { model: "ID.6 X", chassis: "MEB", electric: true };
  }
  const type78 = u.slice(6, 8);
  const wmi = u.slice(0, 3);
  const yearCode = u[9] ?? "";
  const isEuZzz =
    u.slice(3, 6) === "ZZZ"
    && (wmi === "WVW" || wmi === "WVG" || wmi === "WV1" || wmi === "WV2" || wmi === "WV3");
  if (isEuZzz) {
    const gated = matchVwYearGated(type78, yearCode);
    if (gated) return gated;
    // Reused codes with no unique window match stay null (do not invent).
    if (VW_EU_YEAR_GATED.some((r) => r.code === type78)) return null;
    return materialize(VW_EU_TYPE_78[type78]);
  }
  return materialize(VW_NON_EU_TYPE_78[type78]);
}

const AUDI_TYPE_78: Record<string, StaticHit> = {
  // Current PPE/MEB/J1 electric lines — base product only (no S/RS slash guesses).
  GH: { model: "A6 e-tron", chassis: "GH (PPE)", electric: true },
  GF: { model: "Q6 e-tron", chassis: "GF (PPE)", electric: true },
  FZ: { model: "Q4 e-tron", chassis: "FZ/F4 (MEB)", electric: true },
  FW: { model: "e-tron GT", chassis: "J1", electric: true },
  GU: { model: "Q5", chassis: "GU" },
  FN: { model: "A6", chassis: "C9/FN" },
  FJ: { model: "Q3", chassis: "FJ" },
  FY: { model: "Q5", chassis: "FY" },
  FP: { model: "Q5", chassis: "8R/FP" },
  F7: { model: "Q7", chassis: "4M/F7" },
  F1: { model: "Q8", chassis: "4M/F1" },
  FS: { model: "Q3", chassis: "8U/FS" },
  F3: { model: "Q3", chassis: "F3" },
  F4: { model: "A4", chassis: "B9/8W" },
  F5: { model: "A5", chassis: "F5" },
  // F2 is shared A6(C8/4A)+A7(C8/4K) — NA split via pos.4; EU ZZZ stays null.
  F8: { model: "A8", chassis: "4N/F8" },
  FF: { model: "A3", chassis: "FF" },
  // GY = A3 Typ 8Y (Wikibooks) — never Q7.
  GY: { model: "A3 / S3 / RS3", chassis: "8Y" },
  GA: { model: "Q2", chassis: "GA" },
  FG: { model: "R8", chassis: "42" },
  FX: { model: "R8", chassis: "4S" },
  FV: { model: "TT", chassis: "8S" },
};

/**
 * Shared Audi platform codes at positions 7–8 (NHTSA US VIN Breakdown + EU Typ).
 * Used for North-American non-ZZZ VINs and as a fallback alignment with EU homologation.
 */
/** NHTSA-verified pos.4 splits for letter platforms that encode both A6 and A7. */
const AUDI_FC_POS4_A6 = new Set(["A", "B", "C", "D", "F", "G", "H", "J"]);
const AUDI_FC_POS4_A7 = new Set(["S", "W", "Y", "2", "3"]);
const AUDI_F2_POS4_A6 = new Set(["D", "E", "K", "L", "M"]);
const AUDI_F2_POS4_A7 = new Set(["P", "R", "S", "T", "U", "V"]);
const AUDI_F2_POS4_ALLROAD = new Set(["7", "9"]);

function resolveAudiA6A7ByPos4(vin: string, type78: string): VagModernHit | null {
  const pos4 = vin[3] ?? "";
  if (type78 === "FC") {
    if (AUDI_FC_POS4_A6.has(pos4)) return { model: "A6", chassis: "C7 4G" };
    if (AUDI_FC_POS4_A7.has(pos4)) return { model: "A7 Sportback", chassis: "C7 4G" };
    return null;
  }
  if (type78 === "F2") {
    if (AUDI_F2_POS4_ALLROAD.has(pos4)) return { model: "A6 allroad", chassis: "C8/4A" };
    if (AUDI_F2_POS4_A6.has(pos4)) return { model: "A6", chassis: "C8/4A" };
    if (AUDI_F2_POS4_A7.has(pos4)) return { model: "A7 Sportback", chassis: "C8/4K" };
    return null;
  }
  return null;
}

/**
 * WA1 is Audi’s NA SUV WMI. Model comes from positions 7–8 only.
 * Do not apply passenger-car platforms (A3/A4/TT/R8/…) that can collide on the same letters.
 */
const WA1_SUV_TYPE_78 = new Set([
  // Q3
  "8U", "F3", "FJ", "FS", "GS",
  // Q5 / SQ5 (Sportback is not reliably separable from VIN alone)
  "8R", "FY", "FP", "GU",
  // Q7 / SQ7
  "4L", "F7", "FE",
  // Q8 / SQ8 / RS Q8
  "F1",
  // Shared MLB Evo SUV family — keep ambiguous label
  "4M",
  // Q2 (rare on WA1; safe if present)
  "GA",
  // Electrified SUV / crossover lines sold under WA1
  "GE", "GF", "GH", "FZ", "GB", "FW",
]);

function resolveWa1SuvPlatform(type78: string): StaticHit | null {
  if (!WA1_SUV_TYPE_78.has(type78)) return null;
  return AUDI_TYPE_78[type78] ?? AUDI_PLATFORM_78[type78] ?? null;
}

const AUDI_PLATFORM_78: Record<string, StaticHit> = {
  // A3 family
  "8P": { model: "A3", chassis: "8P" },
  "8V": { model: "A3", chassis: "8V" },
  "8L": { model: "A3", chassis: "8L" },
  FF: { model: "A3", chassis: "FF" },
  FM: { model: "A3", chassis: "8P" },
  // A4 family
  "8E": { model: "A4 / S4 / RS4", chassis: "8E" },
  "8K": { model: "A4 / S4 / RS4", chassis: "8K" },
  "8H": { model: "A4 / S4 Cabrio", chassis: "8H" },
  FL: { model: "A4", chassis: "8K" },
  F4: { model: "A4 / S4 / RS4", chassis: "B9/8W" },
  // A5 family
  "8T": { model: "A5 / S5", chassis: "8T" },
  "8F": { model: "A5 / S5 Cabrio", chassis: "8F" },
  F5: { model: "A5 / S5 / RS5", chassis: "F5" },
  FR: { model: "A5", chassis: "8T" },
  FH: { model: "A5 Cabrio", chassis: "8F" },
  // A3 — include Typ 8Y and its NA letter code GY (was wrongly Q7).
  "8Y": { model: "A3 / S3 / RS3", chassis: "8Y" },
  GY: { model: "A3 / S3 / RS3", chassis: "8Y" },
  // A4 / A5
  "8W": { model: "A4 / S4 / RS4", chassis: "B9/8W" },
  // A6 / A7 — 4H is A8 D4 (never A7). C8 A6 = Typ 4A; C8 A7 = Typ 4K.
  // Bare 4G / F2 / FC are shared — never emit "A6 / A7".
  "4F": { model: "A6 / S6", chassis: "4F" },
  "4B": { model: "A6 / S6 / RS6", chassis: "4B" },
  "4K": { model: "A7 Sportback", chassis: "C8/4K" },
  // C4 100 / early A6 and C8 A6 (NOT A8 — A8 uses 4D/4E/4H/4N).
  "4A": { model: "A6", chassis: "4A" },
  FN: { model: "A6", chassis: "C9/FN" },
  FB: { model: "A6", chassis: "C6 4F" },
  // A8 — Typ 4H is D4 (2010–2017). FD is the NA letter alias for 4H.
  "4D": { model: "A8 / S8", chassis: "4D" },
  "4E": { model: "A8 / S8", chassis: "4E" },
  "4H": { model: "A8 / S8", chassis: "4H" },
  FA: { model: "A8", chassis: "4E" },
  FD: { model: "A8 / S8", chassis: "4H" },
  F8: { model: "A8 / S8", chassis: "4N/F8" },
  // Q2 / Q3 / Q5 / Q7 / Q8 — Typ GA is Q2 (was wrongly Q5).
  GA: { model: "Q2", chassis: "GA" },
  "8U": { model: "Q3", chassis: "8U" },
  F3: { model: "Q3", chassis: "F3" },
  FJ: { model: "Q3", chassis: "FJ" },
  FS: { model: "Q3", chassis: "8U/FS" },
  GS: { model: "Q3" },
  "8R": { model: "Q5", chassis: "8R" },
  FY: { model: "Q5 / SQ5", chassis: "FY" },
  FP: { model: "Q5 / SQ5", chassis: "8R/FP" },
  GU: { model: "Q5 / SQ5", chassis: "GU" },
  "4L": { model: "Q7", chassis: "4L" },
  "4M": { model: "Q7 / Q8", chassis: "4M" },
  F7: { model: "Q7 / SQ7", chassis: "4M/F7" },
  FE: { model: "Q7", chassis: "4L" },
  F1: { model: "Q8", chassis: "4M/F1" },
  // TT / R8 / e-tron
  "8N": { model: "TT", chassis: "8N" },
  "8J": { model: "TT", chassis: "8J" },
  "8S": { model: "TT", chassis: "8S" },
  FK: { model: "TT", chassis: "8J" },
  FV: { model: "TT", chassis: "8S" },
  "42": { model: "R8", chassis: "42" },
  "4S": { model: "R8", chassis: "4S" },
  FG: { model: "R8", chassis: "42" },
  FX: { model: "R8", chassis: "4S" },
  GE: { model: "e-tron / Q8 e-tron", chassis: "GE", electric: true },
  FZ: { model: "Q4 e-tron", chassis: "MEB", electric: true },
  GB: { model: "Q4 e-tron", chassis: "MEB", electric: true },
  FW: { model: "e-tron GT", chassis: "J1", electric: true },
  GH: { model: "A6 e-tron / S6 e-tron", chassis: "PPE", electric: true },
  GF: { model: "Q6 e-tron / SQ6 e-tron", chassis: "PPE", electric: true },
  // A1 / A2
  "8X": { model: "A1", chassis: "8X" },
  "8Z": { model: "A2", chassis: "8Z" },
};

export function decodeAudiModern(vin: string, _year?: number | null): VagModernHit | null {
  const u = vin.trim().toUpperCase();
  if (u.length !== 17 || !isAudiVin(u)) return null;
  const type78 = u.slice(6, 8);
  const isEuZzz = u.slice(3, 6) === "ZZZ";

  // Year-gated e-tron rename (GE platform) — windows only, never prefer-recent.
  if (type78 === "GE") {
    const yearCode = u[9] ?? "";
    const yQ8 = resolveIsoModelYear(yearCode, { from: 2024, to: 2099 });
    const yEt = resolveIsoModelYear(yearCode, { from: 2019, to: 2023 });
    if (yQ8 != null && yEt == null) {
      return { model: "Q8 e-tron", chassis: "GE", electric: true };
    }
    if (yEt != null && yQ8 == null) {
      return { model: "e-tron", chassis: "GE", electric: true };
    }
    // Ambiguous or unknown year — omit model rather than guess the rename.
    return null;
  }

  // North-American / non-ZZZ passenger (WAU/WUA/TRU): positions 7–8 = platform.
  // WA1 SUV WMI: model is also at positions 7–8 (NHTSA). Position 4 is trim tier
  // (A/B/C/F ≈ Premium / Plus / Prestige / S line) — never the model line.
  // Example: WA1FVAF1… = Q8 (F1), not “Q5 Sportback” from letter F.
  if (!isEuZzz) {
    if (type78 === "F2" || type78 === "FC") {
      return resolveAudiA6A7ByPos4(u, type78);
    }
    if (u.startsWith("WA1")) {
      return materialize(resolveWa1SuvPlatform(type78));
    }
    return materialize(AUDI_PLATFORM_78[type78] ?? AUDI_TYPE_78[type78]);
  }

  // EU ZZZ: prefer modern type table, then shared platform map.
  // F2/FC are intentionally absent — letter alone cannot separate A6 from A7.
  return materialize(AUDI_TYPE_78[type78] ?? AUDI_PLATFORM_78[type78]);
}

const SKODA_TYPE_78: Record<string, StaticHit> = {
  // Current electric lines
  "5A": { model: "Enyaq", chassis: "5A (MEB)", electric: true },
  PY: { model: "Elroq", chassis: "PY (MEB)", electric: true },

  // Current generations
  NX: { model: "Octavia", chassis: "NX" },
  PV: { model: "Octavia", chassis: "PV" },
  NZ: { model: "Superb", chassis: "NZ" },
  PS: { model: "Kodiaq", chassis: "PS" },
  PJ: { model: "Fabia", chassis: "PJ" },
  NU: { model: "Karoq", chassis: "NU" },
  NW: { model: "Scala / Kamiq", chassis: "NW" },

  // Older/reused codes retained where the model line is stable
  NJ: { model: "Fabia", chassis: "NJ" },
  NE: { model: "Octavia", chassis: "NE" },
  "5E": { model: "Octavia", chassis: "5E" },
  "1Z": { model: "Octavia", chassis: "1Z" },
  NP: { model: "Superb", chassis: "NP" },
  "3V": { model: "Superb", chassis: "3V" },
  NS: { model: "Kodiaq", chassis: "NS" },
  "55": { model: "Kodiaq", chassis: "55" },
  "5L": { model: "Yeti", chassis: "5L" },
  NF: { model: "Citigo / Citigoe iV", chassis: "NF" },

  // Legacy aliases found in existing production data
  NM: { model: "Enyaq", chassis: "NM (MEB)", electric: true },
  NY: { model: "Enyaq Coupé", chassis: "NY (MEB)", electric: true },
  RV: { model: "Enyaq", chassis: "RV (MEB)", electric: true },
};

export function decodeSkodaModern(vin: string, _year?: number | null): VagModernHit | null {
  const u = vin.trim().toUpperCase();
  if (u.length !== 17 || !isSkodaVin(u)) return null;
  const type78 = u.slice(6, 8);
  const yearCode = u[9] ?? "";
  // PS was Kamiq, then reused for second-gen Kodiaq — resolve via production windows only.
  if (type78 === "PS") {
    const yKamiq = resolveIsoModelYear(yearCode, { from: 2019, to: 2023 });
    const yKodiaq = resolveIsoModelYear(yearCode, { from: 2024, to: 2099 });
    if (yKamiq != null && yKodiaq == null) return { model: "Kamiq", chassis: "PS" };
    if (yKodiaq != null && yKamiq == null) return { model: "Kodiaq", chassis: "PS" };
    return null;
  }
  // NY is shared by Enyaq Coupé and Elroq — Elroq only with plant prefix + MY window.
  if (type78 === "NY" && u.startsWith("TMBNC")) {
    const yElroq = resolveIsoModelYear(yearCode, { from: 2025, to: 2099 });
    if (yElroq != null) {
      return { model: "Elroq", chassis: "PY (MEB)", electric: true };
    }
  }
  return materialize(SKODA_TYPE_78[type78]);
}

export function decodePorscheModern(vin: string, year = vagModelYear(vin)): VagModernHit | null {
  const u = vin.trim().toUpperCase();
  if (u.length !== 17 || !isPorscheVin(u)) return null;

  // Porsche MY2020+ uses VIN positions 7, 8 and 12 as a three-character type.
  const type3 = `${u.slice(6, 8)}${u[11]}`;
  if (type3 === "Y1A") return { model: "Taycan", chassis: "J1", electric: true };
  if (type3 === "YA0") return { model: "Panamera", chassis: "976" };
  if (type3 === "XA0" || type3 === "XA1" || type3 === "XA2") {
    return { model: "Macan Electric", chassis: "XAB (PPE)", electric: true };
  }

  const type78 = u.slice(6, 8);
  switch (type78) {
    case "99":
      // 99 is the long-running 911 family type; generation is not unique in the VIN alone.
      // Omit chassis so year stays null unless another verified window applies.
      return { model: "911", chassis: null };
    case "97":
      return { model: "Panamera", chassis: "970/971" };
    case "98":
      return { model: "718 Boxster / Cayman", chassis: "981/982" };
    case "92":
      return { model: "Cayenne", chassis: "92A/E3" };
    case "95":
      return { model: "Panamera", chassis: "970/971" };
    case "9Y":
      return { model: "Taycan", chassis: "J1", electric: true };
    case "9Z":
      return { model: "Macan", chassis: "95B" };
    case "XA":
      return { model: "Macan Electric", chassis: "XAB (PPE)", electric: true };
    case "Y1":
      return { model: "Taycan", chassis: "J1", electric: true };
    case "YA":
      return { model: "Panamera", chassis: year != null && year >= 2024 ? "976" : null };
    default:
      return null;
  }
}
