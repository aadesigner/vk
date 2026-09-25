/**
 * Model + make resolution for popular global brands outside premium EU / US core tables.
 * WMI-gated, prefix-only (no fuzzy guesses) — one pass returns model + make override.
 */

import { compilePrefixRules, matchLongestPrefix, type PrefixRule } from "./prefix-match";

// ── Dacia — position 4 model family (UU1 / UU6, Romania) ─────────────────────
const DACIA_MODEL_AT_4: Record<string, string> = {
  B: "Sandero",
  D: "Duster",
  H: "Logan",
  J: "Jogger",
  S: "Spring",
  L: "Lodgy",
  M: "Dokker",
};

const DACIA_PREFIX_RULES = compilePrefixRules([
  { prefix: "UU1DJF", model: "Duster" },
  { prefix: "UU1HDR", model: "Logan" },
  { prefix: "UU1BFB", model: "Sandero" },
  { prefix: "UU1JDJ", model: "Jogger" },
  { prefix: "UU1SDJ", model: "Spring" },
]);

function isDaciaVin(vin: string): boolean {
  return vin.startsWith("UU1") || vin.startsWith("UU6");
}

function decodeDaciaModel(vin: string): string | null {
  const prefixHit = matchLongestPrefix(vin, DACIA_PREFIX_RULES);
  if (prefixHit) return prefixHit.model;
  return DACIA_MODEL_AT_4[vin[3]] ?? null;
}

// ── Suzuki ───────────────────────────────────────────────────────────────────
// Type codes at positions 4–5 are well-documented for HU/JP plants (cariffy / MMC).
const SUZUKI_PREFIX_RULES = compilePrefixRules([
  { prefix: "JS2ZC", model: "Swift" },
  { prefix: "JS2YB", model: "Baleno" },
  { prefix: "JS3JB", model: "Jimny" },
  { prefix: "JS3TE", model: "Vitara" },
  { prefix: "JS3TD", model: "Vitara" },
  { prefix: "JS3JT", model: "Grand Vitara" },
  { prefix: "JS3FT", model: "Grand Vitara" },
  { prefix: "TSMLY", model: "Vitara" },
  { prefix: "TSMYD", model: "Vitara" },
  { prefix: "TSMNZ", model: "S-Cross" },
  { prefix: "TSMKY", model: "SX4 S-Cross" },
  { prefix: "TSMJY", model: "SX4 S-Cross" },
  { prefix: "TSMJB", model: "Jimny" },
  { prefix: "TSMMH", model: "Ignis", yearFrom: 2016, yearTo: 2099 },
  { prefix: "TSMEX", model: "Splash" },
  { prefix: "TSMMA", model: "Swift" },
  { prefix: "TSMRB", model: "Across", chassis: "XA50", yearFrom: 2020, yearTo: 2099 },
  { prefix: "TSMYA", model: "Swace", chassis: "E210", yearFrom: 2020, yearTo: 2099 },
  { prefix: "JSAFH", model: "Ignis", yearFrom: 2016, yearTo: 2099 },
  { prefix: "MA3E", model: "Swift" },
  { prefix: "MA3C", model: "Dzire" },
  { prefix: "MA3F", model: "Brezza" },
  { prefix: "MA3J", model: "Fronx", yearFrom: 2023, yearTo: 2099 },
  { prefix: "2S3TC", model: "Vitara" },
]);

function isSuzukiWmi(wmi: string): boolean {
  return (
    wmi.startsWith("JS2")
    || wmi.startsWith("JS3")
    || wmi.startsWith("JS4")
    || wmi.startsWith("TSM")
    || wmi.startsWith("2S2")
    || wmi.startsWith("2S3")
    || wmi === "MA3"
    || wmi.startsWith("JSA")
    || wmi.startsWith("JST")
  );
}

// ── MG / BYD / Haval ─────────────────────────────────────────────────────────
const MG_PREFIX_RULES = compilePrefixRules([
  { prefix: "LSJWP", model: "ZS" },
  { prefix: "LSJWH", model: "HS" },
  { prefix: "LSJW5", model: "MG4" },
  { prefix: "LSJWR", model: "MG5" },
  { prefix: "LSJWE", model: "Marvel R" },
  { prefix: "LSJWF", model: "Cyberster" },
]);

const BYD_PREFIX_RULES = compilePrefixRules([
  { prefix: "LFPAA", model: "Atto 3" },
  { prefix: "LFPBB", model: "Han" },
  { prefix: "LFPBC", model: "Tang" },
  { prefix: "LC0CE", model: "Dolphin" },
  { prefix: "LC0DE", model: "Seal" },
  { prefix: "LC0CF", model: "Seagull" },
  { prefix: "LBVYA", model: "Song Plus" },
]);

const HAVAL_PREFIX_RULES = compilePrefixRules([
  { prefix: "LGWFF", model: "H6" },
  { prefix: "LGWEF", model: "Jolion" },
  { prefix: "LGWDA", model: "Dargo" },
  { prefix: "LGWDB", model: "F7" },
]);

// ── Polestar / VinFast / Lucid ───────────────────────────────────────────────
const POLESTAR_PREFIX_RULES = compilePrefixRules([
  { prefix: "LPSVSE", model: "Polestar 2" },
  { prefix: "LPSVS", model: "Polestar 2" },
  { prefix: "LPSVY", model: "Polestar 4" },
  { prefix: "LYVSE", model: "Polestar 2" },
  { prefix: "YSMRH", model: "Polestar 1" },
  // NA/EU Polestar 3 — NHTSA: motor EJ/EA/EE + vehicle Y + trim B (YSR Sweden / 7SY USA)
  { prefix: "YSREJ3YB", model: "Polestar 3" },
  { prefix: "YSREA3YB", model: "Polestar 3" },
  { prefix: "YSREE3YB", model: "Polestar 3" },
  { prefix: "7SYEJ3YB", model: "Polestar 3" },
  { prefix: "7SYEA3YB", model: "Polestar 3" },
  { prefix: "7SYEE3YB", model: "Polestar 3" },
]);

const VINFAST_PREFIX_RULES = compilePrefixRules([
  { prefix: "RLLVC", model: "VF8" },
  { prefix: "RLLVD", model: "VF9" },
  { prefix: "RLNVF", model: "VF e34" },
  { prefix: "RLNV8", model: "VF8" },
  // 5VF* US WMI: NHTSA still maps the code to AEVC and NC volume production is not online —
  // keep make-only (no invented VF8/VF9 descriptors).
]);

const LUCID_PREFIX_RULES = compilePrefixRules([
  // Legacy 5LA* Air descriptors (pre-NHTSA 50E/7UU reassignment in some datasets)
  { prefix: "5LABP", model: "Air" },
  { prefix: "5LAA1", model: "Air" },
  { prefix: "5LAC1", model: "Air" },
  // NHTSA: 50E = Lucid passenger (Air); 7UUG* = Gravity (pos.4 G) — verified ErrorCode 0 samples
  { prefix: "50E", model: "Air" },
  { prefix: "7UUG", model: "Gravity" },
]);

/**
 * JN1 is Nissan Motor Co. Japan PC WMI — used by both Nissan and Infiniti.
 * Default make is Nissan (WMI_MAP). Override to Infiniti only on verified VDS prefixes
 * (Bumper / NHTSA vehicle descriptors). Never map bare JN1 / JN1A / JN1B.
 */
const INFINITI_JN1_PREFIX_RULES = compilePrefixRules([
  // Q50 — known VDS (JN1 + 5-char VDS)
  { prefix: "JN1AV7AP", model: "Q50" },
  { prefix: "JN1AV7AR", model: "Q50" },
  { prefix: "JN1BV7AP", model: "Q50" },
  { prefix: "JN1BV7AR", model: "Q50" },
  { prefix: "JN1CV7AP", model: "Q50" },
  { prefix: "JN1CV7AR", model: "Q50" },
  { prefix: "JN1EV7AP", model: "Q50" },
  { prefix: "JN1EV7AR", model: "Q50" },
  { prefix: "JN1EV7BP", model: "Q50" },
  { prefix: "JN1EV7BR", model: "Q50" },
  { prefix: "JN1EV7CP", model: "Q50" },
  { prefix: "JN1EV7CR", model: "Q50" },
  { prefix: "JN1FV7AP", model: "Q50" },
  { prefix: "JN1FV7AR", model: "Q50" },
  { prefix: "JN1FV7DP", model: "Q50" },
  { prefix: "JN1FV7DR", model: "Q50" },
  // Q60 — known VDS
  { prefix: "JN1CV6EK", model: "Q60" },
  { prefix: "JN1CV6EL", model: "Q60" },
  { prefix: "JN1CV6FE", model: "Q60" },
  { prefix: "JN1CV7EK", model: "Q60" },
  { prefix: "JN1CV7EL", model: "Q60" },
  { prefix: "JN1EV7EK", model: "Q60" },
  { prefix: "JN1EV7EL", model: "Q60" },
  { prefix: "JN1EV7JK", model: "Q60" },
  { prefix: "JN1EV7JL", model: "Q60" },
  { prefix: "JN1EV7KK", model: "Q60" },
  { prefix: "JN1EV7KL", model: "Q60" },
  { prefix: "JN1FV7EK", model: "Q60" },
  { prefix: "JN1FV7EL", model: "Q60" },
  { prefix: "JN1FV7LK", model: "Q60" },
  { prefix: "JN1FV7LL", model: "Q60" },
]);

const NISSAN_JN1_PREFIX_RULES = compilePrefixRules([
  // Japan-built Leaf (NHTSA: JN1AZ0CP* → Leaf); US Leaf uses 1N4*
  { prefix: "JN1AZ0", model: "Leaf" },
]);

// ── Isuzu / Tata / KGM ───────────────────────────────────────────────────────
const ISUZU_PREFIX_RULES = compilePrefixRules([
  { prefix: "MPATF", model: "D-Max" },
  { prefix: "MPAU0", model: "MU-X" },
  { prefix: "JACST", model: "MU-X" },
  { prefix: "JAADS", model: "D-Max" },
  { prefix: "M3GTF", model: "D-Max" },
  { prefix: "4S2CK", model: "Rodeo" },
  { prefix: "4S1CK", model: "H-Series" },
]);

const TATA_PREFIX_RULES = compilePrefixRules([
  { prefix: "MAT612", model: "Nexon" },
  { prefix: "MAT813", model: "Harrier" },
  { prefix: "MAT823", model: "Safari" },
  { prefix: "MAT31", model: "Punch" },
  { prefix: "MAT61", model: "Nexon" },
]);

const KGM_PREFIX_RULES = compilePrefixRules([
  { prefix: "KPT20", model: "Rexton" },
  { prefix: "KPTB0", model: "Torres" },
  { prefix: "KPTB2", model: "Torres" },
  { prefix: "KPTG0", model: "Tivoli" },
  { prefix: "KPTG2", model: "Tivoli" },
  { prefix: "KPAJ0", model: "Musso" },
  { prefix: "KPAJ2", model: "Musso" },
]);

// ── Cupra / DS — prefix rules only (avoid SEAT/Citroën ZZZ overlap) ───────────
const CUPRA_PREFIX_RULES = compilePrefixRules([
  { prefix: "VSSZZZKM", model: "Formentor", chassis: "KM" },
  { prefix: "VSSZZZK1", model: "Born", chassis: "K1" },
  { prefix: "VSSZZZKP", model: "Born", chassis: "MEB" },
  // KC = Cupra Born (MEB) — Cupra-exclusive homologation; not used by SEAT.
  { prefix: "VSSZZZKC", model: "Born", chassis: "KC" },
  // KN = SEAT Tarraco (not Cupra León). Cupra León shares KL with SEAT — leave as SEAT.
  { prefix: "VS7ZZZKM", model: "Terramar", chassis: "KM" },
]);

const DS_VR1_RULES = compilePrefixRules([
  { prefix: "VR1RHR", model: "DS 7" },
  { prefix: "VR1JAL", model: "DS 3" },
  { prefix: "VR1JCL", model: "DS 4" },
  { prefix: "VR1JCH", model: "DS 4" },
]);

const DS_VF7_RULES = compilePrefixRules([
  { prefix: "VF7RHR", model: "DS 7" },
  { prefix: "VF7SAJ", model: "DS 3" },
  { prefix: "VF7SCL", model: "DS 4" },
]);

// ── Smart / Lancia / Mahindra / Lada ─────────────────────────────────────────
// WME45x = classic MCC/Daimler era; HES* = Smart Automobile (Geely × MB) China.
// HESXR / HESCR confirmed via 17vin model plates (HESXR1C4 → #1, HESCR1C4 → #3).
const SMART_PREFIX_RULES = compilePrefixRules([
  { prefix: "HESXR", model: "#1", chassis: "HX11" },
  { prefix: "HESCR", model: "#3", chassis: "HC11" },
  { prefix: "WME450", model: "fortwo", chassis: "450" },
  { prefix: "WME451", model: "fortwo", chassis: "451" },
  { prefix: "WME452", model: "Roadster", chassis: "452" },
  { prefix: "WME453", model: "forfour", chassis: "453" },
  { prefix: "WME454", model: "#1", chassis: "HX11" },
  // W1A = Mercedes-Benz AG Smart (from late 2019); series codes mirror WME*
  { prefix: "W1A450", model: "fortwo", chassis: "450" },
  { prefix: "W1A451", model: "fortwo", chassis: "451" },
  { prefix: "W1A452", model: "Roadster", chassis: "452" },
  { prefix: "W1A453", model: "forfour", chassis: "453" },
  { prefix: "W1A454", model: "#1", chassis: "HX11" },
]);

const LANCIA_PREFIX_RULES = compilePrefixRules([
  { prefix: "ZLA334", model: "Ypsilon" },
  { prefix: "ZLA312", model: "Ypsilon" },
]);

const MAHINDRA_PREFIX_RULES = compilePrefixRules([
  { prefix: "MA1FC", model: "XUV700" },
  { prefix: "MA1XA", model: "Scorpio" },
  { prefix: "MA1TA", model: "Thar" },
]);

const LADA_PREFIX_RULES = compilePrefixRules([
  { prefix: "XTA219", model: "Granta" },
  { prefix: "XTA217", model: "Vesta" },
  { prefix: "XTA212", model: "Niva" },
]);

function isVinFastVin(vin: string): boolean {
  const wmi = vin.slice(0, 3);
  return wmi === "RLL" || wmi === "RLN" || wmi === "5VF";
}

function isIsuzuWmi(wmi: string): boolean {
  return (
    wmi === "JAA"
    || wmi === "JAC"
    || wmi === "JAL"
    || wmi === "MP1"
    || wmi === "MPA"
    || wmi === "M3G"
    || wmi === "4S1"
    || wmi === "4S2"
    || wmi === "J87"
    || wmi === "J8Z"
  );
}

export type GlobalBrandDecode = {
  model: string | null;
  makeOverride: string | null;
  /** Platform / chassis / generation when the prefix rule encodes one. */
  chassis: string | null;
  yearFrom?: number;
  yearTo?: number;
};

const EMPTY_GLOBAL: GlobalBrandDecode = { model: null, makeOverride: null, chassis: null };

function hitToGlobal(
  hit: PrefixRule | null,
  makeOverride: string | null,
): GlobalBrandDecode {
  if (!hit) return { model: null, makeOverride, chassis: null };
  return {
    model: hit.model,
    makeOverride,
    chassis: hit.chassis ?? null,
    yearFrom: hit.yearFrom,
    yearTo: hit.yearTo,
  };
}

/**
 * Single WMI-gated pass — only runs decoders relevant to the VIN prefix.
 * Returns null model when no confident prefix match (no guessing).
 */
export function decodeGlobalBrand(vin: string): GlobalBrandDecode {
  const upper = vin.toUpperCase().trim();
  if (upper.length !== 17) return EMPTY_GLOBAL;

  const wmi = upper.slice(0, 3);

  if (isDaciaVin(upper)) {
    const model = decodeDaciaModel(upper);
    const hit = matchLongestPrefix(upper, DACIA_PREFIX_RULES);
    return {
      model,
      makeOverride: "Dacia",
      chassis: hit?.chassis ?? null,
    };
  }

  if (upper.startsWith("VSS") || upper.startsWith("VS7") || upper.startsWith("VSX")) {
    const hit = matchLongestPrefix(upper, CUPRA_PREFIX_RULES);
    if (hit) return hitToGlobal(hit, "Cupra");
    return EMPTY_GLOBAL;
  }

  if (upper.startsWith("VR1")) {
    const hit = matchLongestPrefix(upper, DS_VR1_RULES);
    return hit ? hitToGlobal(hit, "DS Automobiles") : EMPTY_GLOBAL;
  }

  if (upper.startsWith("VF7")) {
    const hit = matchLongestPrefix(upper, DS_VF7_RULES);
    return hit ? hitToGlobal(hit, "DS Automobiles") : EMPTY_GLOBAL;
  }

  if (wmi === "LPS" || wmi === "YSM" || wmi === "YSR" || wmi === "7SY") {
    const hit = matchLongestPrefix(upper, POLESTAR_PREFIX_RULES);
    return {
      model: hit?.model ?? null,
      makeOverride: "Polestar",
      chassis: hit?.chassis ?? null,
    };
  }

  if (wmi === "LYV") {
    const hit = matchLongestPrefix(upper, POLESTAR_PREFIX_RULES);
    return hit ? hitToGlobal(hit, "Polestar") : EMPTY_GLOBAL;
  }

  if (isVinFastVin(upper)) {
    return hitToGlobal(matchLongestPrefix(upper, VINFAST_PREFIX_RULES), "VinFast");
  }

  if (wmi === "MAT") {
    return hitToGlobal(matchLongestPrefix(upper, TATA_PREFIX_RULES), "Tata");
  }

  if (isIsuzuWmi(wmi)) {
    return hitToGlobal(matchLongestPrefix(upper, ISUZU_PREFIX_RULES), "Isuzu");
  }

  if (wmi === "KPT" || wmi === "KPA") {
    return hitToGlobal(matchLongestPrefix(upper, KGM_PREFIX_RULES), null);
  }

  if (wmi.startsWith("LSJ")) {
    return hitToGlobal(matchLongestPrefix(upper, MG_PREFIX_RULES), null);
  }

  if (wmi === "LFP" || wmi === "LC0" || wmi === "LBV" || wmi === "LGX") {
    return hitToGlobal(matchLongestPrefix(upper, BYD_PREFIX_RULES), null);
  }

  if (wmi.startsWith("LGW")) {
    return hitToGlobal(matchLongestPrefix(upper, HAVAL_PREFIX_RULES), null);
  }

  if (isSuzukiWmi(wmi)) {
    return hitToGlobal(matchLongestPrefix(upper, SUZUKI_PREFIX_RULES), null);
  }

  if (wmi === "5LA" || wmi === "50E" || wmi === "7UU") {
    return hitToGlobal(matchLongestPrefix(upper, LUCID_PREFIX_RULES), "Lucid");
  }

  // JN1 shared Nissan / Infiniti Japan PC — Infiniti only on verified VDS.
  if (wmi === "JN1") {
    const infiniti = matchLongestPrefix(upper, INFINITI_JN1_PREFIX_RULES);
    if (infiniti) return hitToGlobal(infiniti, "Infiniti");
    const nissan = matchLongestPrefix(upper, NISSAN_JN1_PREFIX_RULES);
    if (nissan) return hitToGlobal(nissan, null);
    return EMPTY_GLOBAL;
  }

  // WME (EU classic) + W1A (MB AG from 2019) + HES (China Smart Automobile JV)
  if (wmi === "WME" || wmi === "W1A" || wmi === "HES") {
    return hitToGlobal(
      matchLongestPrefix(upper, SMART_PREFIX_RULES),
      wmi === "HES" || wmi === "W1A" ? "Smart" : null,
    );
  }

  if (wmi.startsWith("ZLA")) {
    return hitToGlobal(matchLongestPrefix(upper, LANCIA_PREFIX_RULES), null);
  }

  if (wmi.startsWith("MA1")) {
    return hitToGlobal(matchLongestPrefix(upper, MAHINDRA_PREFIX_RULES), null);
  }

  if (wmi.startsWith("XTA")) {
    return hitToGlobal(matchLongestPrefix(upper, LADA_PREFIX_RULES), null);
  }

  return EMPTY_GLOBAL;
}

/** @deprecated Use decodeGlobalBrand — kept for callers that only need model. */
export function decodeGlobalBrandModel(vin: string): string | null {
  return decodeGlobalBrand(vin).model;
}

/** Apply make override from global brand tables after WMI lookup. */
export function resolveGlobalBrandMake(
  vin: string,
  wmiMake: string | null,
  global?: GlobalBrandDecode,
): string | null {
  const decoded = global ?? decodeGlobalBrand(vin);
  return decoded.makeOverride ?? wmiMake;
}

export {
  isDaciaVin,
  isVinFastVin,
  isIsuzuWmi,
  isSuzukiWmi,
  decodeDaciaModel,
  matchLongestPrefix,
  CUPRA_PREFIX_RULES,
};
