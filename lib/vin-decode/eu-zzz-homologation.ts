/**
 * EU type-approval homologation codes (VIN positions 7–9 after ZZZ filler).
 * Sources: Audi Wikibooks VIN codes, NHTSA Audi MY2024 sheet, EU KBA type-approval tables.
 */

import { compilePrefixRules, matchLongestPrefix, type PrefixRule } from "./prefix-match";

export type EuHomologationHit = { model: string; chassis: string | null };

type CodeRule = { code: string; model: string; chassis?: string };

function rulesForWmi(wmi: string, codes: CodeRule[]): PrefixRule[] {
  return codes.map(({ code, model, chassis }) => ({
    prefix: `${wmi}ZZZ${code}`,
    model: chassis ? `${model} (${chassis})` : model,
  }));
}

/** Audi / TRU / WVG (Bratislava) — same homologation alphabet. */
const AUDI_HOMOLOGATION_CODES: CodeRule[] = [
  // SUVs — most common decoder gaps
  { code: "F7", model: "Q7", chassis: "4M" },
  { code: "FE", model: "Q7", chassis: "4L" },
  { code: "4L", model: "Q7", chassis: "4L" },
  { code: "4M", model: "Q7", chassis: "4M" },
  { code: "FY", model: "Q5", chassis: "GJ/FY" },
  { code: "FP", model: "Q5", chassis: "8R" },
  { code: "8R", model: "Q5", chassis: "8R" },
  { code: "F1", model: "Q8", chassis: "4M" },
  { code: "GE", model: "Q8 e-tron / e-tron" },
  { code: "GF", model: "Q6 e-tron / SQ6 e-tron", chassis: "PPE" },
  { code: "GH", model: "A6 e-tron / S6 e-tron", chassis: "PPE" },
  { code: "GU", model: "Q5 / SQ5", chassis: "GU" },
  { code: "FS", model: "Q3", chassis: "8U" },
  { code: "F3", model: "Q3", chassis: "F3" },
  { code: "FJ", model: "Q3", chassis: "FJ" },
  { code: "FZ", model: "Q4 e-tron", chassis: "MEB" },
  { code: "GB", model: "Q4 e-tron", chassis: "MEB" },
  // Letter codes at pos 7–8 (NA-style / modern EU type-approval).
  // GY = A3 Typ 8Y (Wikibooks) — was wrongly Q7. GA = Q2 Typ — was wrongly Q5.
  { code: "GY", model: "A3 / S3 / RS3", chassis: "8Y" },
  { code: "GA", model: "Q2", chassis: "GA" },
  { code: "GS", model: "Q3" },
  // Sedans / sport — FC/F2 alone are shared A6+A7 (NA splits via pos.4 in vag-modern).
  { code: "FN", model: "A6", chassis: "C9" },
  { code: "FB", model: "A6", chassis: "C6 4F" },
  { code: "F4", model: "A4", chassis: "B9 8W" },
  { code: "FL", model: "A4", chassis: "B8 8K" },
  { code: "F5", model: "A5", chassis: "F5" },
  { code: "FR", model: "A5", chassis: "8T" },
  { code: "FH", model: "A5", chassis: "8F Cabriolet" },
  { code: "FU", model: "A5", chassis: "FU" },
  { code: "FA", model: "A8", chassis: "4E" },
  { code: "FD", model: "A8 / S8", chassis: "4H" },
  { code: "F8", model: "A8", chassis: "4N" },
  { code: "FF", model: "A3", chassis: "8V" },
  { code: "FM", model: "A3", chassis: "8P" },
  { code: "8X", model: "A1" },
  { code: "8Z", model: "A2", chassis: "8Z" },
  { code: "FW", model: "e-tron GT", chassis: "J1" },
  { code: "FG", model: "R8", chassis: "42" },
  { code: "FX", model: "R8", chassis: "4S" },
  { code: "FK", model: "TT", chassis: "8J" },
  { code: "FV", model: "TT", chassis: "8S" },
  // C7 — ETKA typcodes: 4G2/4GC sedan, 4G5/4GD Avant, 4G8/4GA/4GF A7.
  // Never emit "A6 / A7"; unknown 4G* stays null.
  { code: "4G8", model: "A7 Sportback", chassis: "C7" },
  { code: "4GA", model: "A7 Sportback", chassis: "C7" },
  { code: "4GF", model: "A7 Sportback", chassis: "C7" },
  { code: "4G2", model: "A6", chassis: "C7" },
  { code: "4GC", model: "A6", chassis: "C7" },
  { code: "4G5", model: "A6 Avant", chassis: "C7" },
  { code: "4GD", model: "A6 Avant", chassis: "C7" },
  { code: "4GH", model: "A6 allroad", chassis: "C7" },
  { code: "4GJ", model: "A6 allroad", chassis: "C7" },
  { code: "4F", model: "A6 Avant" },
  // A8 Typ codes — 4H is D4 (never A7).
  // C8 A6 reuses Typ 4A (4A2/4A5/4AH); C8 A7 is Typ 4K (4KA/4K8) — never A6.
  { code: "4H", model: "A8 / S8", chassis: "4H" },
  { code: "4D", model: "A8 / S8", chassis: "4D" },
  { code: "4A5", model: "A6 Avant", chassis: "4A" },
  { code: "4A2", model: "A6", chassis: "4A" },
  { code: "4AH", model: "A6 allroad", chassis: "4A" },
  { code: "4A", model: "A6", chassis: "4A" },
  { code: "4KA", model: "A7 Sportback", chassis: "C8" },
  { code: "4K8", model: "A7 Sportback", chassis: "C8" },
  { code: "4K", model: "A7 Sportback", chassis: "C8" },
  { code: "8Y", model: "A3 / S3 / RS3", chassis: "8Y" },
  { code: "8V", model: "A3" },
  { code: "8P", model: "A3", chassis: "8P" },
  { code: "8L", model: "A3", chassis: "8L" },
  { code: "8W", model: "A4 / S4 / RS4", chassis: "B9" },
  { code: "8K", model: "A4" },
  { code: "8E", model: "A4 / S4 / RS4", chassis: "8E" },
  { code: "8H", model: "A4 / S4 Cabrio", chassis: "8H" },
  { code: "8T", model: "A5" },
  { code: "8F", model: "A5 / S5 Cabrio", chassis: "8F" },
  { code: "8U", model: "Q3" },
  { code: "8N", model: "TT", chassis: "8N" },
  { code: "8J", model: "TT", chassis: "8J" },
  { code: "8S", model: "TT", chassis: "8S" },
  { code: "8X", model: "A1" },
  { code: "4B", model: "A6 / S6 / RS6", chassis: "4B" },
  { code: "4E", model: "A8 / S8", chassis: "4E" },
  { code: "4L", model: "Q7", chassis: "4L" },
  { code: "42", model: "R8", chassis: "42" },
  { code: "4S", model: "R8", chassis: "4S" },
];

const AUDI_WMIS = ["WAU", "WA1", "WUA", "TRU", "WVG"] as const;

const AUDI_EU_RULES = compilePrefixRules(
  AUDI_WMIS.flatMap((wmi) => rulesForWmi(wmi, AUDI_HOMOLOGATION_CODES)),
);

/** True when a WVG (Bratislava) VIN carries an Audi homologation code, not VW. */
export function isAudiHomologationVin(vin: string): boolean {
  const u = vin.toUpperCase();
  if (!u.startsWith("WVG") || u.slice(3, 6) !== "ZZZ" || u.length < 9) return false;
  return decodeAudiEuHomologation(u) != null;
}

export function decodeAudiEuHomologation(vin: string): EuHomologationHit | null {
  const u = vin.toUpperCase();
  if (u.length < 9 || u.slice(3, 6) !== "ZZZ") return null;
  const wmi = u.slice(0, 3);
  if (!(AUDI_WMIS as readonly string[]).includes(wmi)) return null;
  const hit = matchLongestPrefix(u, AUDI_EU_RULES);
  if (!hit) return null;
  const paren = hit.model.match(/^(.+?) \((.+)\)$/);
  if (paren) return { model: paren[1], chassis: paren[2] };
  return { model: hit.model, chassis: null };
}

/** BMW EU ZZZ — homologation at 7–9; first digit often encodes series. */
const BMW_EU_SERIES: Record<string, string> = {
  "1": "1 Series",
  "2": "2 Series",
  "3": "3 Series",
  "4": "4 Series",
  "5": "5 Series",
  "6": "6 Series",
  "7": "7 Series",
  "8": "8 Series",
};

const BMW_EU_SPECIFIC: CodeRule[] = [
  { code: "310", model: "3 Series" },
  { code: "3A0", model: "3 Series" },
  { code: "3W0", model: "3 Series", chassis: "G20/G21" },
  { code: "5A0", model: "5 Series" },
  { code: "5E0", model: "5 Series", chassis: "G30/G31" },
  { code: "5J0", model: "5 Series", chassis: "F10/F11" },
  { code: "6C0", model: "6 Series", chassis: "F12/F13" },
  { code: "6D0", model: "6 Series", chassis: "F06 Gran Coupé" },
  { code: "6F0", model: "6 Series", chassis: "F12/F13" },
  { code: "7C0", model: "7 Series", chassis: "G11/G12" },
  { code: "7L0", model: "7 Series", chassis: "G70" },
  { code: "4C0", model: "4 Series" },
  { code: "4S0", model: "4 Series", chassis: "G22/G26" },
  { code: "1C0", model: "1 Series", chassis: "F20/F21" },
  { code: "1H0", model: "1 Series", chassis: "F40" },
  { code: "2A0", model: "2 Series", chassis: "F45 Active Tourer" },
  { code: "2T0", model: "2 Series", chassis: "G42 Coupé" },
  { code: "8C0", model: "8 Series", chassis: "G14/G15/G16" },
  { code: "XF3", model: "X3", chassis: "G01" },
  { code: "XF5", model: "X5", chassis: "G05" },
  { code: "XF6", model: "X6", chassis: "G06" },
  { code: "XF7", model: "X7", chassis: "G07" },
];

const BMW_EU_WMIS = ["WBA", "WBS", "WBY"] as const;
const BMW_EU_RULES = compilePrefixRules(
  BMW_EU_WMIS.flatMap((wmi) => rulesForWmi(wmi, BMW_EU_SPECIFIC)),
);

export function decodeBmwEuHomologation(vin: string): EuHomologationHit | null {
  const u = vin.toUpperCase();
  if (u.length < 9 || u.slice(3, 6) !== "ZZZ") return null;
  const wmi = u.slice(0, 3);
  if (!wmi.startsWith("WBA") && !wmi.startsWith("WBS") && !wmi.startsWith("WBY")) return null;

  const specific = matchLongestPrefix(u, BMW_EU_RULES);
  if (specific) {
    const paren = specific.model.match(/^(.+?) \((.+)\)$/);
    if (paren) return { model: paren[1], chassis: paren[2] };
    return { model: specific.model, chassis: null };
  }

  const series = BMW_EU_SERIES[u[6]];
  if (series) return { model: series, chassis: null };
  return null;
}

/** Mercedes EU ZZZ — homologation embeds chassis digits (177, 213, 205, …). */
const MERCEDES_EU_CODES: CodeRule[] = [
  { code: "177", model: "A-Class", chassis: "W177" },
  { code: "176", model: "A-Class", chassis: "W176" },
  { code: "169", model: "A-Class", chassis: "W169" },
  { code: "168", model: "A-Class", chassis: "W168" },
  { code: "118", model: "CLA", chassis: "C118" },
  { code: "117", model: "CLA", chassis: "C117" },
  { code: "205", model: "C-Class", chassis: "W205" },
  { code: "206", model: "C-Class", chassis: "W206" },
  { code: "204", model: "C-Class", chassis: "W204" },
  { code: "203", model: "C-Class", chassis: "W203" },
  { code: "202", model: "C-Class", chassis: "W202" },
  { code: "213", model: "E-Class", chassis: "W213" },
  { code: "214", model: "E-Class", chassis: "W214" },
  { code: "212", model: "E-Class", chassis: "W212" },
  { code: "211", model: "E-Class", chassis: "W211" },
  { code: "210", model: "E-Class", chassis: "W210" },
  { code: "207", model: "E-Class Coupé/Cabrio", chassis: "C207" },
  { code: "218", model: "CLS", chassis: "C218" },
  { code: "222", model: "S-Class", chassis: "W222" },
  { code: "223", model: "S-Class", chassis: "W223" },
  { code: "221", model: "S-Class", chassis: "W221" },
  { code: "220", model: "S-Class", chassis: "W220" },
  { code: "253", model: "GLC", chassis: "X253" },
  { code: "254", model: "GLC", chassis: "X254" },
  // W166: ML through MY2015 / GLE from MY2016 — refined in european-premium.
  { code: "166", model: "GLE", chassis: "W166" },
  { code: "167", model: "GLE / GLS", chassis: "W167/X167" },
  { code: "156", model: "GLA", chassis: "X156" },
  { code: "247", model: "GLA / GLB", chassis: "H247/X247" },
  { code: "246", model: "B-Class", chassis: "W246" },
  { code: "245", model: "B-Class", chassis: "W245" },
  { code: "243", model: "EQA / EQB", chassis: "H243/X243" },
  { code: "163", model: "ML-Class", chassis: "W163" },
  { code: "164", model: "ML-Class", chassis: "W164" },
  { code: "251", model: "GLK", chassis: "X204" },
  { code: "292", model: "GLE Coupé", chassis: "C292" },
  { code: "463", model: "G-Class", chassis: "W463" },
  { code: "465", model: "G-Class", chassis: "W465" },
  { code: "290", model: "EQS", chassis: "V297" },
  { code: "294", model: "EQE", chassis: "V294" },
  { code: "296", model: "EQS SUV", chassis: "X296" },
  { code: "293", model: "EQC", chassis: "N293" },
  { code: "236", model: "CLE", chassis: "C236" },
  { code: "238", model: "E-Class Coupé/Cabrio", chassis: "C238" },
  { code: "257", model: "CLS", chassis: "C257" },
  { code: "172", model: "SLK / SLC", chassis: "R172" },
  { code: "231", model: "SL", chassis: "R231" },
  { code: "190", model: "AMG GT", chassis: "C190" },
  { code: "192", model: "AMG GT", chassis: "C192" },
  { code: "197", model: "SL", chassis: "R232" },
];

const MERCEDES_WMIS = ["WDD", "WDB", "WDC", "W1K", "W1N", "4JG"] as const;
const MERCEDES_EU_RULES = compilePrefixRules(
  MERCEDES_WMIS.flatMap((wmi) => rulesForWmi(wmi, MERCEDES_EU_CODES)),
);

export function decodeMercedesEuHomologation(vin: string): EuHomologationHit | null {
  const u = vin.toUpperCase();
  if (u.length < 9 || u.slice(3, 6) !== "ZZZ") return null;
  const wmi = u.slice(0, 3);
  if (!MERCEDES_WMIS.some((p) => wmi.startsWith(p))) return null;
  const hit = matchLongestPrefix(u, MERCEDES_EU_RULES);
  if (!hit) return null;
  const paren = hit.model.match(/^(.+?) \((.+)\)$/);
  if (paren) return { model: paren[1], chassis: paren[2] };
  return { model: hit.model, chassis: null };
}

export function homologationToDisplay(hit: EuHomologationHit): string {
  if (!hit.chassis) return hit.model;
  if (hit.chassis.startsWith(hit.model)) return hit.chassis;
  return `${hit.model} (${hit.chassis})`;
}
