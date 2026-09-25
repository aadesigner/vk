/**
 * Lightweight US VDS prefix → model (+ optional generation) for common
 * Stellantis / Honda / Toyota North America VINs.
 * Ford NA → ford-na.ts; GM NA → gm-na.ts (MID + NHTSA).
 * Complements coarse MODEL_MAP_4; NHTSA still enriches trim when available.
 */

import { compilePrefixRules, matchLongestPrefix, type PrefixRule } from "./prefix-match";
import { decodeFordNaModel, matchFordNaRule } from "./ford-na";
import { decodeGmNaModel, matchGmNaRule } from "./gm-na";

const US_VDS_RULES = compilePrefixRules([
  // Stellantis — Jeep / Ram / Dodge / Chrysler (modern floors only)
  { prefix: "1C4RJ", model: "Grand Cherokee", yearFrom: 2011, yearTo: 2099 },
  { prefix: "1C4HJ", model: "Wrangler", yearFrom: 2018, yearTo: 2099 },
  { prefix: "1C4BJ", model: "Wrangler", yearFrom: 2018, yearTo: 2099 },
  { prefix: "1C4NJ", model: "Compass", yearFrom: 2017, yearTo: 2099 },
  { prefix: "3C4NJ", model: "Compass", yearFrom: 2017, yearTo: 2099 },
  { prefix: "1C4PJ", model: "Cherokee", yearFrom: 2014, yearTo: 2099 },
  { prefix: "1C6SR", model: "Ram 1500" },
  { prefix: "1C6RR", model: "Ram 1500" },
  { prefix: "2C3CD", model: "Charger" },
  { prefix: "2C3CM", model: "Challenger" },
  { prefix: "3C4PD", model: "Pacifica", yearFrom: 2017, yearTo: 2099 },
  { prefix: "3C6UR", model: "Ram 2500/3500" },
  // Honda / Acura US
  { prefix: "1HGCV1", model: "Accord", chassis: "10th gen" },
  { prefix: "1HGCV2", model: "Accord", chassis: "10th gen" },
  { prefix: "1HGCY", model: "Accord", chassis: "11th gen" },
  { prefix: "1HGCV3", model: "Accord", chassis: "11th gen Hybrid" },
  { prefix: "2HGFC2", model: "Civic", chassis: "10th gen" },
  { prefix: "2HGFE2", model: "Civic", chassis: "11th gen" },
  { prefix: "2HGFC1", model: "Civic", chassis: "10th gen" },
  { prefix: "19XFC2", model: "Civic" },
  { prefix: "19XFL2", model: "Civic", chassis: "11th gen" },
  { prefix: "5J6RM4", model: "CR-V", chassis: "5th gen" },
  { prefix: "5J6RW2", model: "CR-V", chassis: "6th gen" },
  { prefix: "5J6RT", model: "CR-V", chassis: "5th gen Hybrid" },
  { prefix: "2HKRS4", model: "CR-V", chassis: "5th gen CA" },
  { prefix: "3CZRU5", model: "HR-V", chassis: "HR-V 3rd gen" },
  { prefix: "3CZRU6", model: "HR-V" },
  { prefix: "5FNRL6", model: "Odyssey" },
  { prefix: "5J8YD", model: "Pilot" },
  { prefix: "5FNYF8", model: "Pilot" },
  { prefix: "5FNYF6", model: "Passport" },
  { prefix: "5FNYF5", model: "Ridgeline", yearFrom: 2017, yearTo: 2099 },
  { prefix: "19UUB", model: "Acura TLX" },
  { prefix: "5J8TB", model: "Acura MDX" },
  { prefix: "JHMFD", model: "Fit", chassis: "Fit 3rd gen" },
  { prefix: "JHMGE", model: "Fit", chassis: "Fit 2nd gen" },
  { prefix: "JHMZF", model: "Insight" },
  // Toyota / Lexus USA / Canada
  { prefix: "4T1B11", model: "Camry", chassis: "XV70" },
  { prefix: "4T1K61", model: "Camry", chassis: "XV70 Hybrid" },
  { prefix: "4T1G11", model: "Camry", chassis: "XV70" },
  { prefix: "4T1C11", model: "Camry", chassis: "XV40" },
  { prefix: "4T1BF1", model: "Camry", chassis: "XV50" },
  { prefix: "2T1BUR", model: "Corolla", chassis: "E170" },
  { prefix: "2T3BF1", model: "RAV4", chassis: "XA40" },
  { prefix: "2T3P1R", model: "RAV4", chassis: "XA50" },
  { prefix: "5TDZA3", model: "Sienna", chassis: "XL30" },
  { prefix: "5TDYZ3", model: "Sienna", chassis: "XL40" },
  { prefix: "5TFDY5", model: "Tundra", chassis: "XK50" },
  { prefix: "5TFJA5", model: "Tundra", chassis: "XK70" },
  { prefix: "5TFAX5", model: "Tacoma", chassis: "N300" },
  { prefix: "5TFLA5", model: "Tacoma", chassis: "N300" },
  { prefix: "5TDBK3", model: "Highlander", chassis: "XU50" },
  { prefix: "5TDDZ3", model: "Highlander", chassis: "XU70" },
  { prefix: "5TDBR3", model: "Sequoia", chassis: "XK60" },
  { prefix: "2T2BZM", model: "Lexus RX" },
  { prefix: "2T2AUD", model: "Lexus NX" },
  { prefix: "JTJBAR", model: "Lexus NX", chassis: "AZ20" },
  // Lexus ES — Japan (JTH*) + Kentucky TMMK (58A*)
  { prefix: "58ABK", model: "ES", chassis: "XZ10", yearFrom: 2019, yearTo: 2099 },
  { prefix: "58AB", model: "ES", chassis: "XZ10", yearFrom: 2019, yearTo: 2099 },
  { prefix: "JTHBZ", model: "ES 350", chassis: "XZ10", yearFrom: 2019, yearTo: 2099 },
  { prefix: "JTHB1", model: "ES 300h", chassis: "XZ10", yearFrom: 2019, yearTo: 2099 },
  { prefix: "JTHB2", model: "ES 300h", chassis: "XZ10", yearFrom: 2019, yearTo: 2099 },
]);

export function matchUsVdsRule(vin: string): PrefixRule | null {
  const u = vin.toUpperCase().trim();
  if (u.length < 8) return null;
  return matchFordNaRule(u) ?? matchGmNaRule(u) ?? matchLongestPrefix(u, US_VDS_RULES);
}

export function decodeUsVdsModel(vin: string): string | null {
  const u = vin.toUpperCase().trim();
  return (
    decodeFordNaModel(u) ??
    decodeGmNaModel(u) ??
    matchLongestPrefix(u, US_VDS_RULES)?.model ??
    null
  );
}

/** Stellantis 1C4 WMI is shared; badge Jeep when VDS maps to a Jeep line. */
const JEEP_VDS_MODELS = new Set([
  "Wrangler",
  "Grand Cherokee",
  "Compass",
  "Cherokee",
  "Renegade",
  "Gladiator",
  "Wagoneer",
  "Grand Wagoneer",
]);

export function resolveUsVdsMake(vin: string): string | null {
  const upper = vin.toUpperCase().trim();
  // HMMA Alabama Genesis SUV line — verified NHTSA (5NMMCET… → Genesis GV70).
  // Sibling 5NMJ*/5NMS* stay Hyundai Tucson/Santa Fe via WMI_MAP.
  if (upper.startsWith("5NMM")) return "Genesis";

  const hit = matchUsVdsRule(upper);
  if (!hit) return null;
  if (JEEP_VDS_MODELS.has(hit.model)) return "Jeep";
  return null;
}
