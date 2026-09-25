/**
 * Model decoding for popular EU brands outside the premium (BMW/MB/Audi/Porsche) tables.
 * Škoda, Renault, Fiat, Peugeot/Citroën (ZZZ), and SEAT.
 */

import { compilePrefixRules, matchLongestPrefix, type PrefixRule } from "./prefix-match";
import {
  decodeSeatEuHomologation,
  decodeSeatEuModel,
  formatSeatDisplay,
  SEAT_EU_WMIS,
} from "./seat-eu";
import { decodeVolvoModel, isVolvoVin } from "./volvo";
import { decodeOpelVauxhallModel, isOpelVauxhallVin } from "./opel-vauxhall";
import { decodeSkodaModern, isSkodaVin } from "./vag-modern";

const SKODA_MODEL_78: Record<string, string> = {
  NJ: "Fabia",
  "6H": "Fabia",
  "6Y": "Fabia",
  NX: "Octavia",
  NE: "Octavia",
  "5E": "Octavia",
  "1Z": "Octavia",
  "1U": "Octavia",
  NP: "Superb",
  "3V": "Superb",
  "3T": "Superb",
  "3U": "Superb",
  "55": "Kodiaq",
  NS: "Kodiaq",
  NW: "Scala",
  NU: "Karoq",
  NZ: "Superb",
  "5L": "Yeti",
  "5J": "Rapid",
  NG: "Rapid",
  NH: "Rapid",
  NK: "Rapid",
  NF: "Citigo",
  "0G": "Rapid Spaceback",
  NM: "Enyaq",
  NY: "Enyaq Coupé",
  PS: "Kamiq",
  PX: "Kamiq",
  RV: "Enyaq iV",
};

const SKODA_PREFIX_RULES = compilePrefixRules([
  { prefix: "TMBJP7NX", model: "Octavia", chassis: "NX" },
  { prefix: "TMBJJ7NX", model: "Octavia", chassis: "NX" },
  { prefix: "TMBJW7NP", model: "Superb", chassis: "NP" },
  { prefix: "TMBER7NW", model: "Scala", chassis: "NW" },
  { prefix: "TMBEP6NJ", model: "Fabia", chassis: "NJ" },
  { prefix: "TMBAG6NE", model: "Octavia", chassis: "NE" },
  { prefix: "TMBAC6NX", model: "Octavia", chassis: "NX" },
  { prefix: "TMBLK7NU", model: "Karoq", chassis: "NU" },
  { prefix: "TMBLK7NZ", model: "Superb", chassis: "NZ" },
  { prefix: "TMBLK6NZ", model: "Superb", chassis: "NZ" },
  { prefix: "TMBDK6XK", model: "Kodiaq", chassis: "NS" },
  { prefix: "TMBER6NM", model: "Enyaq", chassis: "NM" },
  { prefix: "TMBER6NY", model: "Enyaq Coupé", chassis: "NY" },
  { prefix: "TMBLK7PS", model: "Kamiq", chassis: "PS" },
  { prefix: "TMBLK7PX", model: "Kamiq", chassis: "PX" },
  { prefix: "TMBAG7NW", model: "Scala", chassis: "NW" },
  { prefix: "TMBJG7NS", model: "Kodiaq", chassis: "NS" },
  { prefix: "TMBJK7NS", model: "Kodiaq", chassis: "NS" },
  { prefix: "TMBEC6NF", model: "Citigo", chassis: "NF" },
  { prefix: "TMBJB7NU", model: "Karoq", chassis: "NU" },
]);

function decodeSkodaModel(vin: string): string | null {
  return matchSkodaRule(vin)?.model ?? null;
}

/** Full Skoda rule hit for series/generation. */
export function matchSkodaRule(vin: string): PrefixRule | null {
  if (!isSkodaVin(vin)) return null;
  const modern = decodeSkodaModern(vin);
  if (modern) {
    return {
      prefix: vin.slice(0, 8),
      model: modern.model,
      ...(modern.chassis ? { chassis: modern.chassis } : {}),
    };
  }
  const prefixHit = matchLongestPrefix(vin, SKODA_PREFIX_RULES);
  if (prefixHit) return prefixHit;
  if (vin.length < 8) return null;
  const code78 = vin.slice(6, 8);
  const model = SKODA_MODEL_78[code78];
  if (!model) return null;
  return { prefix: vin.slice(0, 8), model, chassis: code78 };
}

// ── Renault — longer VDS prefix rules (4-char MODEL_MAP_4 handles WMI + pos 4) ─
// Longest-prefix first via compilePrefixRules. Prefer specific line codes over VF1R → Zoe.
const RENAULT_PREFIX_RULES = compilePrefixRules([
  { prefix: "VF1RFK", model: "Captur" },
  { prefix: "VF1RJK", model: "Captur" },
  { prefix: "VF1RJH", model: "Captur" },
  { prefix: "VF1RJA", model: "Clio" },
  { prefix: "VF1RJF", model: "Duster" },
  { prefix: "VF1RFB", model: "Austral" },
  { prefix: "VF1RFA", model: "Scenic" },
  { prefix: "VF1RFD", model: "Espace" },
  { prefix: "VF1RF", model: "Clio" },
  { prefix: "VF1R5", model: "Clio" },
  { prefix: "VF1RJ", model: "Clio" },
  { prefix: "VF1LB", model: "Megane" },
  { prefix: "VF1LM", model: "Megane" },
  { prefix: "VF1AG", model: "Arkana" },
  { prefix: "VF1BA", model: "Twingo" },
  { prefix: "VF1BB", model: "Twingo" },
  { prefix: "VF1R", model: "Zoe" },
  // Spanish Renault plants reuse the same VDS family letters as VF1.
  { prefix: "VF2RFK", model: "Captur" },
  { prefix: "VF2RJA", model: "Clio" },
  { prefix: "VF2RF", model: "Clio" },
  { prefix: "VF2RJ", model: "Clio" },
  { prefix: "VF2LB", model: "Megane" },
]);

function isRenaultWmi(wmi: string): boolean {
  return (
    wmi.startsWith("VF1")
    || wmi.startsWith("VF2")
    || wmi.startsWith("VF6")
    || wmi.startsWith("VF8")
  );
}

function decodeRenaultModel(vin: string): string | null {
  const wmi = vin.slice(0, 3);
  if (!isRenaultWmi(wmi)) return null;
  return matchLongestPrefix(vin, RENAULT_PREFIX_RULES)?.model ?? null;
}

// ── Fiat — EU type-approval VIN formats (Fiat Technical Information, Apr 2024)
// https://www.technicalinformation.fiat.com/tech-info-web/web/pageLarge.do?id=467
// Platform at positions 4–6; some lines share a platform and split on position 11.

/** Unambiguous platform → model (official table only). */
const FIAT_PLATFORM_456: Record<string, string> = {
  "169": "Panda",
  "198": "Bravo",
  // Platform 225 is shared Qubo/Fiorino — omit rather than guess.
  "250": "Ducato",
  "263": "Doblo",
  "270": "Scudo",
  "278": "Strada",
  "334": "500X",
  "350": "Idea",
  "356": "Tipo",
};

/** Longer fixed prefixes from the same official VIN-format table. */
const FIAT_PREFIX_RULES = compilePrefixRules([
  { prefix: "ZFA0FA", model: "500e" },
  { prefix: "ZFB0FA", model: "500e" },
  { prefix: "ZFANF6", model: "124 Spider" },
  { prefix: "ZFAFLJ", model: "Talento" },
  { prefix: "ZFAFFL", model: "Talento" },
  // ZFABF1… = 500 / Abarth 500; ZFABF5… / ZFABF6… = Nuova Panda
  { prefix: "ZFABF1", model: "500" },
  { prefix: "ZFABF5", model: "Panda" },
  { prefix: "ZFABF6", model: "Panda" },
]);

function isFiatWmi(wmi: string): boolean {
  return (
    wmi.startsWith("ZFA")
    || wmi.startsWith("ZFB")
    || wmi.startsWith("ZFC")
    || wmi.startsWith("ZCG")
  );
}

/**
 * Position 11 (index 10) discriminators from Fiat type-approval masks:
 * - 312 + "3" → Nuova Panda; otherwise 312 → 500 (mask …0000 vs …00003…)
 * - 199 + "5"|"Z" → 500L; otherwise 199 → Punto / Grande Punto (…00005… / …0000Z… vs …0000 / …0000P…)
 */
function decodeFiatSharedPlatform(vin: string): string | null {
  const platform = vin.slice(3, 6);
  const plantOrLine = vin[10];
  if (platform === "312") {
    return plantOrLine === "3" ? "Panda" : "500";
  }
  if (platform === "199") {
    if (plantOrLine === "5" || plantOrLine === "Z") return "500L";
    return "Punto";
  }
  return null;
}

function decodeFiatModel(vin: string): string | null {
  const wmi = vin.slice(0, 3);
  if (!isFiatWmi(wmi)) return null;
  const prefixHit = matchLongestPrefix(vin, FIAT_PREFIX_RULES);
  if (prefixHit) return prefixHit.model;
  if (vin.length < 11) return null;
  const shared = decodeFiatSharedPlatform(vin);
  if (shared) return shared;
  return FIAT_PLATFORM_456[vin.slice(3, 6)] ?? null;
}

// ── Peugeot / Citroën — EU ZZZ format, model at position 7 ───────────────────
const PEUGEOT_ZZZ_AT_7: Record<string, string> = {
  A: "208",
  B: "208",
  C: "208",
  D: "308",
  E: "2008",
  F: "308",
  G: "208",
  H: "308",
  J: "308",
  K: "2008",
  L: "508",
  M: "3008",
  N: "5008",
  P: "Partner / Rifter",
  R: "3008",
  S: "508",
  T: "Traveller",
  U: "2008",
  V: "208",
  W: "508",
  X: "408",
  Y: "5008",
};

const CITROEN_ZZZ_AT_7: Record<string, string> = {
  A: "C3",
  B: "C3",
  C: "C3",
  D: "C4",
  E: "C3 Aircross",
  F: "C4",
  G: "C5",
  H: "C4 Cactus",
  J: "C5 Aircross",
  K: "Berlingo",
  L: "C5",
  M: "C5 Aircross",
  N: "C3",
  P: "Berlingo",
  R: "C4",
  S: "C5",
  T: "Spacetourer",
  U: "C4",
  V: "C3",
  W: "C5",
  X: "C4",
  Y: "C5 Aircross",
};

/** Modern Stellantis / PSA Citroën (VR7*) — non-ZZZ VDS, Berlingo III / K9 era. */
const CITROEN_PREFIX_RULES = compilePrefixRules([
  { prefix: "VR7EDYH", model: "Berlingo", yearFrom: 2018, yearTo: 2099 },
  { prefix: "VR7EFYH", model: "Berlingo", yearFrom: 2018, yearTo: 2099 },
  { prefix: "VR7EDY", model: "Berlingo", yearFrom: 2018, yearTo: 2099 },
  { prefix: "VR7EFY", model: "Berlingo", yearFrom: 2018, yearTo: 2099 },
  { prefix: "VR7E", model: "Berlingo", yearFrom: 2018, yearTo: 2099 },
]);

function decodeZzzEuropeanModel(
  vin: string,
  _wmi: string,
  table: Record<string, string>,
): string | null {
  if (vin.length < 7 || vin.slice(3, 6) !== "ZZZ") return null;
  return table[vin[6]] ?? null;
}

function decodeSeatModel(vin: string): string | null {
  return decodeSeatEuModel(vin);
}

function decodePeugeotModel(vin: string): string | null {
  if (!vin.startsWith("VF3")) return null;
  const zzz = decodeZzzEuropeanModel(vin, "VF3", PEUGEOT_ZZZ_AT_7);
  if (zzz) return zzz;
  return null;
}

export function matchCitroenRule(vin: string): PrefixRule | null {
  const upper = vin.toUpperCase().trim();
  if (!upper.startsWith("VF7") && !upper.startsWith("VR7")) return null;
  return matchLongestPrefix(upper, CITROEN_PREFIX_RULES);
}

function decodeCitroenModel(vin: string): string | null {
  if (vin.startsWith("VF7")) {
    const zzz = decodeZzzEuropeanModel(vin, "VF7", CITROEN_ZZZ_AT_7);
    if (zzz) return zzz;
  }
  return matchCitroenRule(vin)?.model ?? null;
}

/** Decode model for Škoda, Renault, Fiat, Peugeot, Citroën, and SEAT. */
export function decodeEuropeanBrandModel(vin: string): string | null {
  const upper = vin.toUpperCase().trim();
  if (upper.length !== 17) return null;

  const wmi = upper.slice(0, 3);
  if (isSkodaVin(upper)) return decodeSkodaModel(upper);
  if (isRenaultWmi(wmi)) return decodeRenaultModel(upper);
  if (isFiatWmi(wmi)) return decodeFiatModel(upper);
  if (wmi === "VF3") return decodePeugeotModel(upper);
  if (wmi === "VF7" || wmi === "VR7") return decodeCitroenModel(upper);
  if ((SEAT_EU_WMIS as readonly string[]).includes(wmi)) return decodeSeatModel(upper);
  if (isVolvoVin(upper)) return decodeVolvoModel(upper);
  if (isOpelVauxhallVin(upper)) return decodeOpelVauxhallModel(upper);
  return null;
}
