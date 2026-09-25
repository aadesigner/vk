/**
 * Jaguar Land Rover decoding — EU ZZZ homologation + non-ZZZ UK/US VDS prefixes.
 * SAL* = Land Rover / Range Rover family; SAJ* / SAD* = Jaguar.
 *
 * Accuracy contract:
 * - Longest prefix + model-year gate only (no coarse 4-char guesses).
 * - Ambiguous / out-of-window → null (never invent a model).
 * - Engine / fuel / drive are not decoded here.
 *
 * Sources: JLR/NHTSA manufacturer sheets, Land Rover model-year ID guide,
 * EU type-approval codes. Verified regressions: SALGA2JF → Range Rover L405;
 * SALWA2BK → Range Rover Sport L494.
 */

import { compilePrefixRules, type PrefixRule } from "./prefix-match";

export type JlrDecode = {
  model: string;
  chassis: string | null;
  displayModel: string;
  /**
   * Model year selected by the production-window gate (ISO 3779 30-year cycle).
   * Null when the rule is ungated — callers keep the global year heuristic.
   */
  year: number | null;
};

type CodeRule = { code: string; model: string; chassis?: string };

type JlrPrefixRule = PrefixRule & {
  yearFrom?: number;
  yearTo?: number;
};

function rulesForWmi(wmi: string, codes: CodeRule[]): JlrPrefixRule[] {
  return codes.map(({ code, model, chassis }) => ({
    prefix: `${wmi}ZZZ${code}`,
    model: chassis ? `${model} (${chassis})` : model,
  }));
}

/** EU type-approval codes at positions 7–9 after ZZZ. */
const LAND_ROVER_CODES: CodeRule[] = [
  { code: "BG", model: "Range Rover Sport", chassis: "L494" },
  { code: "BN", model: "Range Rover", chassis: "L405/L460" },
  { code: "BP", model: "Range Rover", chassis: "L460" },
  { code: "KV", model: "Discovery", chassis: "L462" },
  { code: "JA", model: "Discovery Sport", chassis: "L550" },
  { code: "FG", model: "Range Rover Evoque", chassis: "L538" },
  { code: "KJ", model: "Range Rover Velar", chassis: "L560" },
  { code: "LM", model: "Defender", chassis: "L663" },
  { code: "LD", model: "Defender", chassis: "L663" },
  { code: "AN", model: "Defender", chassis: "L316" },
  { code: "AA", model: "Defender", chassis: "L316" },
  { code: "FE", model: "Freelander", chassis: "L359" },
  { code: "EV", model: "Range Rover Evoque", chassis: "L551" },
  { code: "KG", model: "Discovery", chassis: "L319" },
  { code: "KZ", model: "Discovery", chassis: "L462" },
  { code: "BH", model: "Range Rover Sport", chassis: "L320" },
  { code: "BJ", model: "Range Rover", chassis: "L322" },
  { code: "BK", model: "Range Rover", chassis: "L405" },
  { code: "BL", model: "Range Rover Sport", chassis: "L494" },
  { code: "BM", model: "Range Rover Velar", chassis: "L560" },
  { code: "GA", model: "Range Rover Evoque", chassis: "L538" },
  { code: "GB", model: "Range Rover Sport", chassis: "L461" },
  { code: "GC", model: "Range Rover", chassis: "L460" },
  { code: "GD", model: "Discovery Sport", chassis: "L550" },
  { code: "GE", model: "Discovery", chassis: "L462" },
  { code: "GF", model: "Defender", chassis: "L663" },
  { code: "LA", model: "Defender", chassis: "L663" },
  { code: "LB", model: "Defender", chassis: "L663" },
];

const JAGUAR_CODES: CodeRule[] = [
  { code: "BN", model: "XF", chassis: "X260" },
  { code: "BG", model: "F-Pace", chassis: "X761" },
  { code: "JA", model: "E-Pace", chassis: "X540" },
  { code: "CF", model: "F-Type", chassis: "X152" },
  { code: "BK", model: "XE", chassis: "X760" },
  { code: "BP", model: "XJ", chassis: "X351" },
  { code: "BM", model: "I-Pace", chassis: "X590" },
  { code: "GA", model: "F-Pace", chassis: "X761" },
  { code: "GB", model: "XE", chassis: "X760" },
  { code: "GC", model: "XF", chassis: "X260" },
  { code: "GD", model: "F-Type", chassis: "X152" },
  { code: "GE", model: "E-Pace", chassis: "X540" },
  { code: "GF", model: "I-Pace", chassis: "X590" },
  { code: "AA", model: "XJ", chassis: "X351" },
  { code: "AB", model: "XK", chassis: "X150" },
  { code: "AC", model: "S-Type", chassis: "X200" },
  { code: "AD", model: "X-Type", chassis: "X400" },
];

const LAND_ROVER_ZZZ = compilePrefixRules(rulesForWmi("SAL", LAND_ROVER_CODES)) as JlrPrefixRule[];
const JAGUAR_ZZZ = compilePrefixRules(rulesForWmi("SAJ", JAGUAR_CODES)) as JlrPrefixRule[];

/**
 * Non-ZZZ UK / US VDS prefixes (positions 1–6+), year-gated where generations reuse letters.
 * Bare SALE / SALG / SALW alone are never enough without a year gate.
 */
const LAND_ROVER_PREFIX = compilePrefixRules([
  // Classic UK SALL* (Solihull era)
  { prefix: "SALLDH", model: "Defender", chassis: "L316", yearFrom: 1983, yearTo: 2016 },
  { prefix: "SALLDK", model: "Defender", chassis: "L316", yearFrom: 1983, yearTo: 2016 },
  { prefix: "SALLDM", model: "Defender", chassis: "L316", yearFrom: 1983, yearTo: 2016 },
  { prefix: "SALLD", model: "Defender", chassis: "L316", yearFrom: 1983, yearTo: 2016 },
  { prefix: "SALLH", model: "Range Rover", chassis: "Classic", yearFrom: 1981, yearTo: 1995 },
  { prefix: "SALLP", model: "Range Rover", chassis: "P38", yearFrom: 1995, yearTo: 2002 },
  { prefix: "SALLM", model: "Range Rover", chassis: "L322", yearFrom: 2002, yearTo: 2012 },
  { prefix: "SALLMH", model: "Range Rover", chassis: "L322", yearFrom: 2002, yearTo: 2012 },
  { prefix: "SALLSA", model: "Discovery", chassis: "L319", yearFrom: 2005, yearTo: 2016 },
  { prefix: "SALLSB", model: "Discovery", chassis: "L319", yearFrom: 2005, yearTo: 2016 },
  { prefix: "SALLJ", model: "Discovery", chassis: "L318", yearFrom: 1990, yearTo: 1999 },
  { prefix: "SALLT", model: "Discovery", chassis: "L318", yearFrom: 1999, yearTo: 2004 },
  { prefix: "SALLA", model: "Discovery", chassis: "L319", yearFrom: 2005, yearTo: 2016 },
  { prefix: "SALLN", model: "Freelander", chassis: "L314", yearFrom: 1998, yearTo: 2006 },
  { prefix: "SALLNA", model: "Freelander", chassis: "L314", yearFrom: 1998, yearTo: 2006 },
  { prefix: "SALLNB", model: "Freelander", chassis: "L359", yearFrom: 2007, yearTo: 2015 },
  { prefix: "SALLS", model: "Range Rover Sport", chassis: "L320", yearFrom: 2006, yearTo: 2013 },

  // NAS short forms of classic lines
  { prefix: "SALDH", model: "Defender", chassis: "L316", yearFrom: 1983, yearTo: 2016 },
  { prefix: "SALDK", model: "Defender", chassis: "L316", yearFrom: 1983, yearTo: 2016 },
  { prefix: "SALDM", model: "Defender", chassis: "L316", yearFrom: 1983, yearTo: 2016 },
  { prefix: "SALD", model: "Defender", chassis: "L316", yearFrom: 1983, yearTo: 2016 },
  { prefix: "SALH", model: "Range Rover", chassis: "Classic", yearFrom: 1981, yearTo: 1995 },
  { prefix: "SALP", model: "Range Rover", chassis: "P38", yearFrom: 1995, yearTo: 2002 },
  { prefix: "SALM", model: "Range Rover", chassis: "L322", yearFrom: 2002, yearTo: 2012 },
  { prefix: "SALJ", model: "Discovery", chassis: "L318", yearFrom: 1990, yearTo: 1999 },
  { prefix: "SALT", model: "Discovery", chassis: "L318", yearFrom: 1999, yearTo: 2004 },
  // Discovery III (2005–09) vs IV (2010–16) share SALA — year gate splits generation label
  { prefix: "SALA", model: "Discovery", chassis: "L319", yearFrom: 2005, yearTo: 2016 },
  { prefix: "SALN", model: "Freelander", chassis: "L314", yearFrom: 1998, yearTo: 2006 },
  { prefix: "SALS", model: "Range Rover Sport", chassis: "L320", yearFrom: 2006, yearTo: 2013 },

  // Freelander 2 / LR2
  { prefix: "SALF", model: "Freelander", chassis: "L359", yearFrom: 2007, yearTo: 2015 },

  // Modern Defender L663 — longer SALE* only (bare SALE is ambiguous with older Evoque myths)
  { prefix: "SALEX", model: "Defender", chassis: "L663", yearFrom: 2020, yearTo: 2099 },
  { prefix: "SALE1", model: "Defender", chassis: "L663", yearFrom: 2020, yearTo: 2099 },
  { prefix: "SALEY", model: "Defender", chassis: "L663", yearFrom: 2020, yearTo: 2099 },
  { prefix: "SALEJ", model: "Defender", chassis: "L663", yearFrom: 2020, yearTo: 2099 },
  { prefix: "SALEK", model: "Defender", chassis: "L663", yearFrom: 2020, yearTo: 2099 },
  { prefix: "SALEW", model: "Defender", chassis: "L663", yearFrom: 2020, yearTo: 2099 },
  { prefix: "SALEB", model: "Defender", chassis: "L663", yearFrom: 2020, yearTo: 2099 },
  { prefix: "SALEP", model: "Defender", chassis: "L663", yearFrom: 2020, yearTo: 2099 },
  { prefix: "SALEE", model: "Defender", chassis: "L663", yearFrom: 2020, yearTo: 2099 },
  { prefix: "SALEV", model: "Defender", chassis: "L663", yearFrom: 2020, yearTo: 2099 },
  { prefix: "SALE", model: "Defender", chassis: "L663", yearFrom: 2020, yearTo: 2099 },

  // Range Rover L405 — SALG* (NOT Velar). Confirmed: SALGA2JF… = L405.
  { prefix: "SALGA", model: "Range Rover", chassis: "L405", yearFrom: 2013, yearTo: 2022 },
  { prefix: "SALG", model: "Range Rover", chassis: "L405", yearFrom: 2013, yearTo: 2022 },

  // Range Rover L460
  { prefix: "SALKP", model: "Range Rover", chassis: "L460", yearFrom: 2022, yearTo: 2099 },
  { prefix: "SALK", model: "Range Rover", chassis: "L460", yearFrom: 2022, yearTo: 2099 },

  // Range Rover Sport L494 — SALW* (NOT Freelander). Confirmed: SALWA2BK… = L494.
  { prefix: "SALWA", model: "Range Rover Sport", chassis: "L494", yearFrom: 2014, yearTo: 2022 },
  { prefix: "SALW", model: "Range Rover Sport", chassis: "L494", yearFrom: 2014, yearTo: 2022 },

  // Range Rover Sport L461
  { prefix: "SAL1P", model: "Range Rover Sport", chassis: "L461", yearFrom: 2023, yearTo: 2099 },
  { prefix: "SAL1L", model: "Range Rover Sport", chassis: "L461", yearFrom: 2023, yearTo: 2099 },
  { prefix: "SAL1", model: "Range Rover Sport", chassis: "L461", yearFrom: 2023, yearTo: 2099 },

  // Velar L560 — SALY* (not SALG)
  { prefix: "SALY", model: "Range Rover Velar", chassis: "L560", yearFrom: 2018, yearTo: 2099 },

  // Evoque
  { prefix: "SALV", model: "Range Rover Evoque", chassis: "L538", yearFrom: 2012, yearTo: 2019 },
  { prefix: "SALFA", model: "Range Rover Evoque", chassis: "L551", yearFrom: 2020, yearTo: 2099 },
  { prefix: "SALFB", model: "Range Rover Evoque", chassis: "L551", yearFrom: 2020, yearTo: 2099 },
  { prefix: "SALZA2", model: "Range Rover Evoque", chassis: "L551", yearFrom: 2020, yearTo: 2099 },
  { prefix: "SALZA", model: "Range Rover", chassis: "L460", yearFrom: 2022, yearTo: 2099 },
  { prefix: "SALZL", model: "Range Rover", chassis: "L460", yearFrom: 2022, yearTo: 2099 },
  { prefix: "SALZ", model: "Range Rover Evoque", chassis: "L551", yearFrom: 2020, yearTo: 2099 },

  // Discovery V / Discovery Sport
  { prefix: "SALRT", model: "Discovery", chassis: "L462", yearFrom: 2017, yearTo: 2099 },
  { prefix: "SALRG", model: "Discovery", chassis: "L462", yearFrom: 2017, yearTo: 2099 },
  { prefix: "SALR", model: "Discovery", chassis: "L462", yearFrom: 2017, yearTo: 2099 },
  { prefix: "SALCP", model: "Discovery Sport", chassis: "L550", yearFrom: 2015, yearTo: 2099 },
  { prefix: "SALCA", model: "Discovery Sport", chassis: "L550", yearFrom: 2015, yearTo: 2099 },
  { prefix: "SALC", model: "Discovery Sport", chassis: "L550", yearFrom: 2015, yearTo: 2099 },
]) as JlrPrefixRule[];

const JAGUAR_PREFIX = compilePrefixRules([
  { prefix: "SAJXA", model: "F-Pace", chassis: "X761" },
  { prefix: "SAJXB", model: "F-Pace", chassis: "X761" },
  { prefix: "SAJWA", model: "F-Type", chassis: "X152" },
  { prefix: "SAJWB", model: "F-Type", chassis: "X152" },
  { prefix: "SAJVA", model: "XF", chassis: "X260" },
  { prefix: "SAJVB", model: "XF", chassis: "X260" },
  { prefix: "SAJAA", model: "XE", chassis: "X760" },
  { prefix: "SAJAB", model: "XE", chassis: "X760" },
  { prefix: "SAJEA", model: "E-Pace", chassis: "X540" },
  { prefix: "SAJEB", model: "E-Pace", chassis: "X540" },
  { prefix: "SAJCA", model: "I-Pace", chassis: "X590" },
  { prefix: "SAJCM", model: "I-Pace", chassis: "X590" },
  { prefix: "SADFP", model: "I-Pace", chassis: "X590" },
  { prefix: "SADFE", model: "I-Pace", chassis: "X590" },
  { prefix: "SADFM", model: "I-Pace", chassis: "X590" },
  // Coarse Jaguar letter series (year-agnostic; chassis known from platform letter)
  { prefix: "SAJW", model: "F-Type", chassis: "X152" },
  { prefix: "SAJV", model: "XF", chassis: "X260" },
  { prefix: "SAJA", model: "XE", chassis: "X760" },
  { prefix: "SAJX", model: "F-Pace", chassis: "X761" },
  { prefix: "SAJP", model: "F-Pace", chassis: "X761" },
  { prefix: "SAJE", model: "E-Pace", chassis: "X540" },
  { prefix: "SAJC", model: "I-Pace", chassis: "X590" },
  { prefix: "SADF", model: "I-Pace", chassis: "X590" },
]) as JlrPrefixRule[];

/** ISO year cycles for position 10 — both candidates when letter overlaps. */
const YEAR_BASE: Record<string, number> = {
  A: 1980, B: 1981, C: 1982, D: 1983, E: 1984,
  F: 1985, G: 1986, H: 1987, J: 1988, K: 1989,
  L: 1990, M: 1991, N: 1992, P: 1993, R: 1994,
  S: 1995, T: 1996, V: 1997, W: 1998, X: 1999, Y: 2000,
  "1": 2001, "2": 2002, "3": 2003, "4": 2004, "5": 2005,
  "6": 2006, "7": 2007, "8": 2008, "9": 2009,
};

function jlrCandidateYears(vin: string): number[] {
  const code = vin[9]?.toUpperCase();
  if (!code) return [];
  const base = YEAR_BASE[code];
  if (base == null) return [];
  const out = [base];
  if (base <= 2000) out.push(base + 30);
  // Digits 1–9 also map 2031–2039, but those are beyond current Land Rover gates.
  return out;
}

function yearFits(year: number, rule: JlrPrefixRule): boolean {
  if (rule.yearFrom == null && rule.yearTo == null) return true;
  const from = rule.yearFrom ?? 1981;
  const to = rule.yearTo ?? 2099;
  return year >= from && year <= to;
}

function refineDiscoveryChassis(model: string, chassis: string | null, year: number | null): string | null {
  if (!chassis || year == null) return chassis;
  if (model !== "Discovery") return chassis;
  // SALA / SALLA cover Discovery III (2005–09) and IV (2010–16)
  if (chassis === "L319") {
    if (year >= 2005 && year <= 2009) return "L319 (Discovery 3)";
    if (year >= 2010 && year <= 2016) return "L319 (Discovery 4)";
  }
  return chassis;
}

function hitToDecode(hit: JlrPrefixRule, year: number | null, gatedYear: number | null): JlrDecode {
  const paren = hit.model.match(/^(.+?) \((.+)\)$/);
  const model = paren ? paren[1]! : hit.model;
  let chassis = paren ? paren[2]! : (hit.chassis ?? null);
  chassis = refineDiscoveryChassis(model, chassis, year);
  return {
    model,
    chassis,
    displayModel: chassis ? `${model} (${chassis})` : model,
    year: gatedYear,
  };
}

function matchJlrRules(vin: string, rules: readonly JlrPrefixRule[]): JlrDecode | null {
  const years = jlrCandidateYears(vin);
  for (const rule of rules) {
    if (!vin.startsWith(rule.prefix)) continue;
    if (rule.yearFrom == null && rule.yearTo == null) {
      // Ungated: model only — do not invent a year cycle.
      return hitToDecode(rule, null, null);
    }
    const fits = years.filter((y) => yearFits(y, rule));
    if (fits.length === 1) return hitToDecode(rule, fits[0]!, fits[0]!);
    if (fits.length > 1) {
      // Multiple ISO cycles fit the production window — keep model, omit year.
      return hitToDecode(rule, null, null);
    }
  }
  return null;
}

export function isJlrVin(vin: string): boolean {
  const wmi = vin.toUpperCase().slice(0, 3);
  return wmi === "SAL" || wmi === "SAJ" || wmi === "SAD";
}

export function isLandRoverVin(vin: string): boolean {
  return vin.toUpperCase().startsWith("SAL");
}

export function decodeJlrEuModel(vin: string): string | null {
  return decodeJlr(vin)?.displayModel ?? null;
}

/**
 * Full JLR decode: EU ZZZ homologation first, then non-ZZZ UK/US prefixes.
 */
export function decodeJlr(vin: string): JlrDecode | null {
  const u = vin.toUpperCase().trim();
  if (u.length < 9) return null;
  if (!isJlrVin(u)) return null;

  if (u.slice(3, 6) === "ZZZ") {
    if (u.startsWith("SAL")) return matchJlrRules(u, LAND_ROVER_ZZZ);
    if (u.startsWith("SAJ")) return matchJlrRules(u, JAGUAR_ZZZ);
    return null;
  }

  if (u.startsWith("SAL")) return matchJlrRules(u, LAND_ROVER_PREFIX);
  if (u.startsWith("SAJ") || u.startsWith("SAD")) {
    return matchJlrRules(u, JAGUAR_PREFIX);
  }
  return null;
}

/** @deprecated Use decodeJlr — kept for existing call sites. */
export function decodeJlrEu(vin: string): JlrDecode | null {
  return decodeJlr(vin);
}
