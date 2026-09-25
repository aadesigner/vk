/**
 * Hyundai, Toyota, and related EU/regional plant decoders.
 * Complements MODEL_MAP_4 with longer prefix rules.
 */

import { compilePrefixRules, matchLongestPrefix, type PrefixRule } from "./prefix-match";
import { decodeHyundaiModel, isHyundaiVin, matchHyundaiRule } from "./hyundai";

const TOYOTA_RULES: PrefixRule[] = compilePrefixRules([
  { prefix: "JTDKB3", model: "Prius", chassis: "XW50" },
  { prefix: "JTDKN3", model: "Prius", chassis: "XW30" },
  { prefix: "JTDKB2", model: "Prius", chassis: "XW20" },
  { prefix: "JTDKAR", model: "Prius", chassis: "XW60" },
  { prefix: "JTMB1R", model: "RAV4", chassis: "XA50" },
  { prefix: "JTMBF3", model: "RAV4", chassis: "XA40" },
  { prefix: "JTMC1R", model: "Highlander", chassis: "XU70" },
  { prefix: "JTMCF3", model: "Highlander", chassis: "XU50" },
  { prefix: "JTMAB3", model: "Yaris", chassis: "XP210" },
  { prefix: "JTMAF3", model: "Yaris", chassis: "XP130" },
  { prefix: "JTME1R", model: "bZ4X" },
  { prefix: "JTMW1R", model: "Corolla Cross", chassis: "XG10", yearFrom: 2020, yearTo: 2099 },
  { prefix: "JTMDH3", model: "Corolla Cross", chassis: "XG10", yearFrom: 2020, yearTo: 2099 },
  // MTM Alabama (7MU) — Corolla Cross only
  { prefix: "7MUCAA", model: "Corolla Cross", chassis: "XG10", yearFrom: 2022, yearTo: 2099 },
  { prefix: "7MUAAA", model: "Corolla Cross", chassis: "XG10", yearFrom: 2022, yearTo: 2099 },
  { prefix: "7MU", model: "Corolla Cross", chassis: "XG10", yearFrom: 2022, yearTo: 2099 },
  { prefix: "JTMDA3", model: "Corolla", chassis: "E210" },
  { prefix: "JTMDF3", model: "Corolla", chassis: "E170" },
  { prefix: "JTNB11", model: "Mirai", chassis: "JPD20" },
  { prefix: "JTNBMR", model: "bZ4X" },
  { prefix: "JTEBU5", model: "4Runner", chassis: "N280" },
  { prefix: "JTEBX9", model: "Land Cruiser Prado", chassis: "J150" },
  { prefix: "JTJBG1", model: "Land Cruiser", chassis: "J300" },
  { prefix: "JTJBT9", model: "Land Cruiser", chassis: "J200" },
  { prefix: "WZ1ZZZ", model: "GR Supra", chassis: "A90 EU" },
  { prefix: "JT1ABA", model: "GR Supra", chassis: "A90" },
  { prefix: "SB1KB3", model: "Corolla", chassis: "E210 UK" },
  { prefix: "SB1K93", model: "Corolla Touring Sports" },
  { prefix: "SB1B93", model: "C-HR", chassis: "AX10" },
  { prefix: "SB1B83", model: "C-HR", chassis: "AX20" },
  { prefix: "SB1Y93", model: "Yaris", chassis: "XP210 UK" },
  { prefix: "SB1F93", model: "RAV4", chassis: "XA50 UK" },
  { prefix: "SB1J93", model: "Aygo X" },
  { prefix: "SB1ZR", model: "Yaris Cross", chassis: "XP210 UK" },
  { prefix: "JTDAGN", model: "Aygo", chassis: "AB40" },
  { prefix: "JTDAGC", model: "Aygo", chassis: "AB10" },
  { prefix: "YARKA3", model: "Yaris", chassis: "XP210 FR" },
  { prefix: "VF1BT9", model: "Toyota Proace" },
  { prefix: "VF1BT8", model: "Toyota Proace City" },
  // Toyota France Valenciennes (VNK) — plant builds the Yaris family only
  { prefix: "VNKKAB", model: "Yaris Cross", chassis: "XP210" },
  { prefix: "VNKKZ", model: "Yaris Cross", chassis: "XP210" },
  { prefix: "VNKKC", model: "Yaris" },
  { prefix: "VNKKG", model: "Yaris" },
  { prefix: "VNKKH", model: "Yaris" },
  { prefix: "VNKKJ", model: "Yaris" },
  { prefix: "VNKJG", model: "Yaris" },
  // Toyota Turkey Sakarya (NMT) — C-HR + Corolla lines
  { prefix: "NMTKHM", model: "C-HR", chassis: "AX10" },
  { prefix: "NMTKKC", model: "C-HR", chassis: "AX20" },
  { prefix: "NMTBB", model: "Corolla", chassis: "E210" },
  { prefix: "NMTBR", model: "Corolla Touring Sports", chassis: "E210" },
  // Toyota Thailand / South Africa / Indonesia — verified regional VDS families
  { prefix: "MR0BA3", model: "Hilux" },
  { prefix: "MR0FR", model: "Hilux" },
  { prefix: "AHTFR", model: "Hilux" },
  { prefix: "AHTFZ", model: "Hilux" },
  { prefix: "MHFKW", model: "Innova" },
  { prefix: "MHFFXW", model: "Innova" },
  { prefix: "MHFFXR", model: "Innova" },
  { prefix: "MHFZR", model: "Fortuner" },
  // Mexico plants
  { prefix: "3TM", model: "Tacoma" },
  { prefix: "3MY", model: "Yaris" },
  // Toyota USA Mississippi (5YF* — Corolla sedan/hatch)
  { prefix: "5YFS4", model: "Corolla", chassis: "E210 2.0L" },
  { prefix: "5YFT4", model: "Corolla", chassis: "E210" },
  { prefix: "5YFB4", model: "Corolla", chassis: "E210" },
  { prefix: "5YFP4", model: "Corolla", chassis: "E210" },
  { prefix: "5YFBU", model: "Corolla", chassis: "E170" },
  { prefix: "5YFB", model: "Corolla" },
  { prefix: "5YFS", model: "Corolla" },
  { prefix: "5YFT", model: "Corolla" },
  // Toyota USA Kentucky / Indiana / Texas plants
  { prefix: "4T1B11", model: "Camry", chassis: "XV70" },
  { prefix: "4T1K61", model: "Camry", chassis: "XV70 Hybrid" },
  { prefix: "4T1G11", model: "Camry", chassis: "XV70" },
  { prefix: "4T1DAA", model: "Camry", chassis: "XV50" },
  { prefix: "4T1BF1", model: "Camry", chassis: "XV50" },
  { prefix: "5TDZAR", model: "Sienna", chassis: "XL30" },
  { prefix: "5TDYZ3", model: "Sienna", chassis: "XL40" },
  { prefix: "5TDBK3", model: "Highlander", chassis: "XU50" },
  { prefix: "5TDDZ3", model: "Highlander", chassis: "XU70" },
  { prefix: "5TDBR3", model: "Sequoia", chassis: "XK60" },
  { prefix: "5TFLA5", model: "Tacoma", chassis: "N300" },
  { prefix: "5TFAX5", model: "Tacoma", chassis: "N300" },
  { prefix: "5TFJA5", model: "Tundra", chassis: "XK70" },
  { prefix: "5TFDY5", model: "Tundra", chassis: "XK50" },
  { prefix: "JTDACAA", model: "Crown", chassis: "S220" },
]);

// Honda EU / UK Swindon (SHH) — plant closed 2021; Type R era still common in EU VINs.
const HONDA_EU_RULES: PrefixRule[] = compilePrefixRules([
  { prefix: "SHHFK", model: "Civic", chassis: "EP3" },
  { prefix: "SHHFN", model: "Civic", chassis: "FN2" },
  { prefix: "SHHFR", model: "Civic", chassis: "FK2/FK8" },
  { prefix: "SHHFE", model: "Civic", chassis: "FK" },
  { prefix: "SHHCR", model: "CR-V" },
  { prefix: "SHHRE", model: "CR-V", chassis: "RW" },
]);

/**
 * Single-family Toyota plants: when no specific VDS rule matches, fall back to the
 * models that plant actually builds (family label, never a guess between marques).
 */
const TOYOTA_PLANT_FAMILY: Record<string, string> = {
  VNK: "Yaris / Yaris Cross", // Toyota Valenciennes (France)
  YAR: "Yaris", // Legacy Valenciennes Yaris WMI
  WZ1: "GR Supra", // Magna Steyr Austria — single Toyota product
  NMT: "Corolla / Auris / C-HR", // Toyota Sakarya (Turkey; varies by era)
  SB1: "Corolla / Auris / Avensis", // Toyota Burnaston (UK; varies by era)
  MR0: "Hilux / Fortuner / Yaris / Camry", // Toyota Thailand
  MR1: "Toyota Thailand passenger vehicle",
  MR2: "Toyota Thailand passenger vehicle",
  MHF: "Innova / Fortuner / Avanza / Rush", // Toyota Indonesia
  MBJ: "Innova / Fortuner / Etios / Corolla / Camry", // Toyota India
  "8AJ": "Hilux / Fortuner", // Toyota Argentina
  "9BR": "Corolla / Etios / Yaris", // Toyota Brazil
  AHT: "Hilux / Fortuner / Corolla", // Toyota South Africa
  "6T1": "Camry / Aurion", // Toyota Australia (historical production)
};

function isToyotaExtendedVin(vin: string): boolean {
  const wmi = vin.slice(0, 3);
  return vin.startsWith("JT")
    || vin.startsWith("VF1BT")
    || [
      "SB1", "YAR", "WZ1", "5YF", "4T1", "4T3", "4T4", "5TD", "5TF",
      "2T1", "2T3", "3TM", "3MY", "VNK", "NMT", "MR0", "MR1", "MR2",
      "MHF", "MBJ", "8AJ", "9BR", "AHT", "6T1", "LFM", "LVG", "7MU",
    ].includes(wmi);
}

function isHondaEuVin(vin: string): boolean {
  return vin.startsWith("SHH");
}

export function isHyundaiToyotaVin(vin: string): boolean {
  const u = vin.toUpperCase();
  return isHyundaiVin(u) || isToyotaExtendedVin(u) || isHondaEuVin(u);
}

/** Full rule hit (model + optional chassis) for series/generation. */
export function matchHyundaiToyotaRule(vin: string): PrefixRule | null {
  const u = vin.toUpperCase().trim();
  if (u.length < 9) return null;

  if (isHondaEuVin(u)) {
    const hondaEu = matchLongestPrefix(u, HONDA_EU_RULES);
    if (hondaEu) return hondaEu;
  }
  if (isHyundaiVin(u)) {
    const hyundai = matchHyundaiRule(u);
    if (hyundai) return hyundai;
  }
  if (isToyotaExtendedVin(u)) {
    const toyota = matchLongestPrefix(u, TOYOTA_RULES);
    if (toyota) return toyota;
    // Single-family plant fallback (VNK Yaris, NMT C-HR/Corolla) — no VDS guess.
    const family = TOYOTA_PLANT_FAMILY[u.slice(0, 3)];
    if (family) return { prefix: u.slice(0, 3), model: family };
  }

  return null;
}

export function decodeHyundaiToyotaModel(vin: string): string | null {
  const u = vin.toUpperCase().trim();
  if (isHyundaiVin(u)) return decodeHyundaiModel(u);
  return matchHyundaiToyotaRule(vin)?.model ?? null;
}

export { isHyundaiVin, matchHyundaiRule, decodeHyundaiModel, decodeHyundaiEngine } from "./hyundai";

