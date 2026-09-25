/**
 * Local VIN decoder — no external API required.
 *
 * Extracts make, year, and country from a 17-character VIN using:
 *   - Position 10 (index 9)  → model year
 *   - Positions 1-3 (WMI)    → world manufacturer identifier → make
 *   - Position 1 (index 0)   → country of origin
 */

import { decodeModelEuropean, hasEuZzzTypeApprovalDescriptor } from "./vinDecoder-european";
import {
  chassisProductionWindow,
  decodePremiumEuropeanModel,
  decodePremiumEuropeanSeries,
} from "./european-premium";
import { isMercedesEuroBaumusterVin } from "./mercedes-baumuster";
import { bmwEtkOmitsIsoYear, isBmwEuroEtkVin } from "./bmw-etk";
import { decodeEuropeanBrandModel, matchCitroenRule } from "./european-brands";
import { resolveBrandVinSpec, resolveBrandVinModel } from "./brand-vin-spec";
import { decodeGlobalBrand, resolveGlobalBrandMake, type GlobalBrandDecode } from "./global-brands";
import { isAudiHomologationVin } from "./eu-zzz-homologation";
import { isVagWmi } from "./vag-wmi";
import { isFordEuWmi, decodeFordEuModel, isFordEuXxLayout, decodeFordEuXxYear } from "./ford-eu";
import { decodeFordNaModel, isFordNaVin } from "./ford-na";
import { decodeGmNaModel, isGmNaVin } from "./gm-na";
import { decodeOpelOldPaddedYear, isOpelOldPaddedTypeVin, isOpelVauxhallVin, matchOpelVauxhallRule } from "./opel-vauxhall";
import { decodeHyundaiToyotaModel, isHyundaiToyotaVin, isHyundaiVin, decodeHyundaiEngine, matchHyundaiRule, matchHyundaiToyotaRule } from "./asian-eu";
import { decodeUsVdsModel, matchUsVdsRule, resolveUsVdsMake } from "./us-vds";
import { decodeMazdaModel, isMazdaVin } from "./mazda";
import {
  inferBodyStyleFromModel,
  inferVagDriveFromModel,
  inferVagTransmissionFromModel,
} from "./vag-infer";
import {
  isAudiVin,
  isPorscheVin,
  isSkodaVin,
  isVolkswagenVin,
  resolveChinaJointVentureMake,
  decodeVolkswagenModern,
  decodeAudiModern,
  decodeSkodaModern,
  decodePorscheModern,
} from "./vag-modern";
import { decodeJlr, isJlrVin } from "./jlr-eu";
import { resolveIsoModelYear, type IsoYearWindow } from "./iso-year";
import { decodeLocalSeries } from "./local-trim";

// ── Model year encoding (position 10) ────────────────────────────────────────
// Letters I, O, Q, U, Z and digit 0 are never used as ISO year codes.
// Codes repeat every 30 years — never "prefer recent"; see iso-year.ts.

/** Layout-specific year (or null when ISO pos.10 is not a year). */
function decodeVinLayoutYear(vin: string): { handled: true; year: number | null } | { handled: false } {
  // Classic European Mercedes Baumuster: pos.10 is LHD/RHD, not ISO model year.
  if (isMercedesEuroBaumusterVin(vin)) return { handled: true, year: null };
  // Classic BMW ETK FINs often put "0" at pos.10 — not a year digit.
  if (bmwEtkOmitsIsoYear(vin)) return { handled: true, year: null };
  // Ford Europe XX layout: production year is at position 11, not ISO pos.10.
  if (isFordEuXxLayout(vin)) return { handled: true, year: decodeFordEuXxYear(vin) };
  // Pre-~1998 Opel W0L0000TT… — first year cycle only (N=1992, not 2022).
  if (isOpelOldPaddedTypeVin(vin)) return { handled: true, year: decodeOpelOldPaddedYear(vin) };
  return { handled: false };
}

/**
 * Resolve model year without inventing data.
 * - Unknown make → null (obscure WMIs like WSD may not use ISO year at pos.10).
 * - Verified production / platform window → unique cycle only.
 * - Known make without window → unique ISO cycle only (digit codes until +30 is plausible);
 *   ambiguous letter codes → null (never prefer-recent).
 */
function resolveVinModelYear(
  vin: string,
  make: string | null,
  model: string | null,
  yearWindow?: IsoYearWindow | null,
): number | null {
  const layout = decodeVinLayoutYear(vin);
  if (layout.handled) return layout.year;
  // Do not invent a year for unmapped manufacturers (e.g. WSD).
  if (!make) return null;
  const code = vin[9] ?? "";
  if (yearWindow) return resolveIsoModelYear(code, yearWindow);

  // Verified platform windows only (VAG type / premium chassis / global chassis).
  // Never invent a cycle without a window that leaves exactly one candidate.
  const vagHit =
    decodeVolkswagenModern(vin, null)
    ?? decodeAudiModern(vin, null)
    ?? decodeSkodaModern(vin, null)
    ?? decodePorscheModern(vin, null);
  const premiumChassis = decodePremiumEuropeanSeries(vin);
  const globalHit = decodeGlobalBrand(vin);
  const globalChassis = globalHit.chassis;
  const hyRule = isHyundaiVin(vin) ? matchHyundaiRule(vin) : null;
  const asiaRule = isHyundaiToyotaVin(vin) ? matchHyundaiToyotaRule(vin) : null;
  const usRule = matchUsVdsRule(vin);
  const series =
    vagHit?.chassis
    ?? premiumChassis
    ?? globalChassis
    ?? hyRule?.chassis
    ?? asiaRule?.chassis
    ?? usRule?.chassis
    ?? decodeLocalSeries(vin, model)
    ?? seriesFromDisplayModel(model);
  const chassisWin = chassisProductionWindow(series);
  if (chassisWin) {
    const gated = resolveIsoModelYear(code, chassisWin);
    if (gated != null) return gated;
    // Window rejects every cycle: allow unambiguous digit years only.
    const digitOnly = resolveIsoModelYear(code, null);
    if (digitOnly != null) return digitOnly;
    return null;
  }

  // Platform / prefix verified window (e.g. Hyundai IONIQ 5 from 2021).
  if (hyRule?.yearFrom != null || hyRule?.yearTo != null) {
    return resolveIsoModelYear(code, {
      from: hyRule.yearFrom ?? 1980,
      to: hyRule.yearTo ?? 2099,
    });
  }
  if (asiaRule?.yearFrom != null || asiaRule?.yearTo != null) {
    return resolveIsoModelYear(code, {
      from: asiaRule.yearFrom ?? 1980,
      to: asiaRule.yearTo ?? 2099,
    });
  }
  if (usRule?.yearFrom != null || usRule?.yearTo != null) {
    return resolveIsoModelYear(code, {
      from: usRule.yearFrom ?? 1980,
      to: usRule.yearTo ?? 2099,
    });
  }
  if (globalHit.yearFrom != null || globalHit.yearTo != null) {
    return resolveIsoModelYear(code, {
      from: globalHit.yearFrom ?? 1980,
      to: globalHit.yearTo ?? 2099,
    });
  }
  if (isOpelVauxhallVin(vin)) {
    const rule = matchOpelVauxhallRule(vin);
    if (rule?.yearFrom != null || rule?.yearTo != null) {
      return resolveIsoModelYear(code, {
        from: rule.yearFrom ?? 1980,
        to: rule.yearTo ?? 2099,
      });
    }
  }
  const citroenRule = matchCitroenRule(vin);
  if (citroenRule?.yearFrom != null || citroenRule?.yearTo != null) {
    return resolveIsoModelYear(code, {
      from: citroenRule.yearFrom ?? 1980,
      to: citroenRule.yearTo ?? 2099,
    });
  }
  // Tesla model lines have verified production floors (no prefer-recent).
  if (make === "Tesla" && model) {
    const teslaWin = teslaModelYearWindow(model);
    if (teslaWin) return resolveIsoModelYear(code, teslaWin);
  }
  // BMW M5 WBS5 spans F10/F90/G90 — verified production floor only (no display chassis).
  if (vin.startsWith("WBS5")) {
    return resolveIsoModelYear(code, chassisProductionWindow("F10/F90/G90"));
  }
  // Known make, no verified window: unique cycle only — never prefer-recent.
  return resolveIsoModelYear(code, null);
}

/** Verified Tesla model-year floors — omit rather than invent a cycle. */
function teslaModelYearWindow(model: string): IsoYearWindow | null {
  const m = model.toLowerCase();
  if (m.includes("cybertruck")) return { from: 2023, to: 2099 };
  if (m.includes("model y")) return { from: 2020, to: 2099 };
  if (m.includes("model 3")) return { from: 2017, to: 2099 };
  if (m.includes("model x")) return { from: 2015, to: 2099 };
  if (m.includes("model s")) return { from: 2012, to: 2099 };
  if (m.includes("semi")) return { from: 2022, to: 2099 };
  if (m.includes("roadster")) return { from: 2008, to: 2012 };
  return null;
}

/** Platform token in parentheses on display models, e.g. "Passat / CC (B6-B8/3C)". */
function seriesFromDisplayModel(model: string | null): string | null {
  if (!model) return null;
  const m = model.match(/\(([^)]+)\)\s*$/);
  if (!m) return null;
  const inner = m[1]!.trim();
  if (!inner || /^\d{4}$/.test(inner)) return null;
  return inner.split(",")[0]?.trim() || inner;
}

// ── Country / region from VIN position 1 ────────────────────────────────────

const COUNTRY_MAP: Record<string, string> = {
  // North America
  "1": "United States", "2": "Canada", "3": "Mexico",
  "4": "United States", "5": "United States",
  // Europe
  S: "United Kingdom", T: "Switzerland", U: "Denmark",
  V: "France/Spain", W: "Germany", X: "Russia",
  Y: "Sweden/Finland", Z: "Italy",
  // Africa
  A: "South Africa", B: "Angola", C: "Benin",
  D: "Egypt", E: "Ethiopia", F: "Ghana", G: "Ivory Coast", H: "Kenya",
  // Asia/Oceania
  J: "Japan", K: "South Korea", L: "China",
  M: "India", N: "Turkey", P: "Philippines", R: "Taiwan",
  // South America / Oceania
  "6": "Australia/New Zealand", "7": "New Zealand",
  "8": "Argentina", "9": "Brazil",
};

/** WMI prefixes that disambiguate shared position-1 country codes (V, Y, …). Longest first. */
const WMI_ORIGIN_COUNTRY_PREFIXES: readonly { prefix: string; country: string }[] = [
  { prefix: "VSX", country: "Spain" },
  { prefix: "VS7", country: "Spain" },
  { prefix: "VS6", country: "Spain" },
  { prefix: "VSS", country: "Spain" },
  { prefix: "VSK", country: "Spain" },
  { prefix: "VR7", country: "France" },
  { prefix: "VR1", country: "France" },
  { prefix: "VNK", country: "France" },
  { prefix: "7MU", country: "United States" },
  { prefix: "58A", country: "United States" },
  { prefix: "7SA", country: "United States" },
  { prefix: "7FC", country: "United States" },
  { prefix: "7MM", country: "United States" },
  { prefix: "7G2", country: "United States" },
  { prefix: "WZ1", country: "Austria" },
  { prefix: "VF8", country: "France" },
  { prefix: "VF7", country: "France" },
  { prefix: "VF6", country: "France" },
  { prefix: "VF5", country: "France" },
  { prefix: "VF4", country: "France" },
  { prefix: "VF3", country: "France" },
  { prefix: "VF2", country: "France" },
  { prefix: "VF1", country: "France" },
  { prefix: "VFA", country: "France" },
  { prefix: "YAR", country: "France" },
  { prefix: "TSM", country: "Hungary" },
  { prefix: "TRU", country: "Hungary" },
  { prefix: "TNL", country: "Czech Republic" },
  { prefix: "TMS", country: "Czech Republic" },
  { prefix: "TMP", country: "Czech Republic" },
  { prefix: "TM8", country: "Czech Republic" },
  { prefix: "TMB", country: "Czech Republic" },
  { prefix: "TMA", country: "Czech Republic" },
  { prefix: "TMC", country: "Czech Republic" },
  { prefix: "MHF", country: "Indonesia" },
  { prefix: "MF3", country: "Indonesia" },
  { prefix: "MR0", country: "Thailand" },
  { prefix: "MR1", country: "Thailand" },
  { prefix: "MR2", country: "Thailand" },
  { prefix: "PFD", country: "Singapore" },
  { prefix: "Z94", country: "Russia" },
  { prefix: "8LG", country: "Ecuador" },
  { prefix: "HES", country: "China" },
  { prefix: "SHH", country: "United Kingdom" },
  { prefix: "SAD", country: "United Kingdom" },
  { prefix: "SAJ", country: "United Kingdom" },
  { prefix: "SAL", country: "United Kingdom" },
  { prefix: "SBM", country: "United Kingdom" },
  { prefix: "YS3", country: "Sweden" },
  { prefix: "YSM", country: "Sweden" },
  { prefix: "YSR", country: "Sweden" },
  { prefix: "YV4", country: "Sweden" },
  { prefix: "YV1", country: "Sweden" },
  { prefix: "YS2", country: "Sweden" },
];

function decodeCountryFromWmi(vin: string): string | null {
  const upper = vin.toUpperCase();
  for (const { prefix, country } of WMI_ORIGIN_COUNTRY_PREFIXES) {
    if (upper.startsWith(prefix)) return country;
  }
  const first = upper[0];
  if (first === "V") {
    const second = upper[1];
    if (second === "S") return "Spain";
    if (second === "F" || second === "R") return "France";
  }
  if (first === "Y") {
    const second = upper[1];
    if (second === "V" || second === "S") return "Sweden";
  }
  return null;
}

export function decodeCountry(vin: string): string | null {
  if (!vin) return null;
  const fromWmi = decodeCountryFromWmi(vin);
  if (fromWmi) return fromWmi;
  return COUNTRY_MAP[vin[0].toUpperCase()] ?? null;
}

// ── WMI → Make (positions 1-3) ───────────────────────────────────────────────
// Ordered longest-match first (3-char WMI beats 2-char prefix)

const WMI_MAP: Record<string, string> = {
  // ── USA ──────────────────────────────────────────────────────────────────
  "1C3": "Chrysler", "1C4": "Chrysler", "1C6": "Ram",
  "3C4": "Chrysler", // Toluca — Jeep Compass / Pacifica
  "1FA": "Ford", "1FB": "Ford", "1FC": "Ford", "1FD": "Ford", "1FM": "Ford",
  "1FT": "Ford",
  "1G1": "Chevrolet", "1G2": "Pontiac", "1G3": "Oldsmobile",
  "1G4": "Buick", "1G6": "Cadillac", "1GC": "Chevrolet",
  "1GD": "GMC", "1GE": "Chevrolet", "1GK": "GMC", "1GT": "GMC",
  "1GN": "Chevrolet",
  "1GY": "Cadillac",
  "1HG": "Honda", "1HJ": "Honda",
  "19X": "Honda",
  "2HG": "Honda", "2HH": "Honda", "2HK": "Honda", "2HM": "Hyundai",
  "3CZ": "Honda", "3HM": "Honda",
  "1J4": "Jeep", "1J8": "Jeep",
  "1L1": "Lincoln", "1LN": "Lincoln",
  "1ME": "Mercury",
  "1N4": "Nissan", "1N6": "Nissan", "1NX": "Toyota",
  "1P3": "Plymouth",
  "1VW": "Volkswagen", "1V2": "Volkswagen",
  "1YV": "Mazda",
  "1ZV": "Mustang",
  "2C3": "Chrysler", "2C4": "Chrysler", "2C8": "Chrysler",
  "2D3": "Dodge", "2D4": "Dodge", "2D8": "Dodge",
  "2FA": "Ford", "2FM": "Ford", "2FT": "Ford",
  "2G1": "Chevrolet", "2G4": "Pontiac",
  "2GN": "Chevrolet", "2GK": "GMC",
  "2T1": "Toyota", "2T2": "Lexus", "2T3": "Toyota",
  "3FA": "Ford", "3FE": "Ford", "3FM": "Ford", "3FT": "Ford",
  "3GN": "Chevrolet", "3GK": "GMC", "3GC": "Chevrolet", "3GT": "GMC",
  "3GY": "Cadillac",
  "3TM": "Toyota", "3MY": "Toyota", "3TY": "Toyota",
  "3N1": "Nissan", "3N6": "Nissan",
  "3VW": "Volkswagen", "3VV": "Volkswagen",
  // Kia Mexico — NHTSA DecodeWMI CommonName Kia / GetWMIsForManufacturer(kia)
  "3KP": "Kia", // passenger (Forte, etc.)
  "3KM": "Kia", // MPV
  // BMW Mexico / EU-linked NA — NHTSA GetWMIsForManufacturer(bmw)
  "3MW": "BMW",
  "3MF": "BMW",
  "4S3": "Subaru", "4S4": "Subaru", "4S6": "Subaru",
  "4T1": "Toyota", "4T3": "Toyota", "4T4": "Toyota",
  "4US": "BMW",
  "4F2": "Mazda", "4F4": "Mazda",
  "3MZ": "Mazda", "3MV": "Mazda", "3MD": "Mazda", "3MJ": "Mazda",
  "7MM": "Mazda",
  "7MU": "Toyota", // MTM Alabama — Corolla Cross
  "58A": "Lexus",  // TMMK Kentucky — ES
  "JMZ": "Mazda",
  "5FN": "Honda", "5FR": "Honda", "5J6": "Honda", "5J8": "Honda",
  "5L1": "Lincoln",
  "5NM": "Hyundai", "5NP": "Hyundai", "5NT": "Hyundai", "5N1": "Nissan",
  // Kia Georgia (KMMG) — NHTSA DecodeWMI / GetWMIsForManufacturer(kia)
  "5XX": "Kia", // passenger (K5 / Optima, etc.)
  "5XY": "Kia", // MPV (Telluride / Sorento, etc.) — was incorrectly Hyundai
  "7YA": "Hyundai",
  "5TD": "Toyota", "5TE": "Toyota", "5TF": "Toyota",
  "5UX": "BMW",
  "5UM": "BMW", // NHTSA: BMW AG passenger (legacy NA / Z4-era)
  "5YM": "BMW",
  "5YJ": "Tesla", "5YF": "Toyota",
  "SFZ": "Tesla", // NHTSA: Tesla Inc. passenger (Roadster-era UK/US listing)
  // ── CANADA ────────────────────────────────────────────────────────────────
  // 2HG / 2HH / 2HK / 2HM already listed under USA-block Honda/Hyundai WMIs
  // ── MEXICO ────────────────────────────────────────────────────────────────
  // 3CZ / 3HM already listed under USA-block Honda WMIs
  // ── JAPAN ─────────────────────────────────────────────────────────────────
  "JA3": "Mitsubishi", "JA4": "Mitsubishi", "JAB": "Mitsubishi",
  "JF1": "Subaru", "JF2": "Subaru",
  "JH4": "Acura", "JHM": "Honda",
  "JM1": "Mazda", "JM3": "Mazda", "JMB": "Mitsubishi",
  "JN1": "Nissan", "JN3": "Nissan", "JN8": "Nissan",
  "JT": "Toyota",  // 2-char prefix catch-all for Toyota Japan
  "JTD": "Toyota", "JTM": "Toyota", "JTN": "Toyota", "JT1": "Toyota",
  // JTE / JTK / JTJ refined later (Toyota trucks / Lexus)
  "JS1": "Suzuki", "JS2": "Suzuki", "JS3": "Suzuki", "JS4": "Suzuki",
  "JSA": "Suzuki", "JST": "Suzuki",
  "2S2": "Suzuki", "2S3": "Suzuki",
  "TSM": "Suzuki",
  // ── SOUTH KOREA ───────────────────────────────────────────────────────────
  "KMH": "Hyundai", "KMF": "Hyundai", "KM8": "Hyundai",
  "TMA": "Hyundai", "TMC": "Hyundai", "NLH": "Hyundai", "NLJ": "Hyundai",
  "KNA": "Kia", "KND": "Kia", "KNJ": "Kia",
  "KNC": "Kia", "KNP": "Kia",
  "KNM": "Renault Samsung",
  "KPT": "SsangYong",
  "KPA": "SsangYong",
  // ── GERMANY ───────────────────────────────────────────────────────────────
  "WAU": "Audi", "WUA": "Audi", "WA1": "Audi",
  // WAP: NHTSA DecodeWMI → BMW (Alpina / BMW NA), not Porsche (Porsche is WP0/WP1)
  "WAP": "BMW",
  "WBA": "BMW", "WBS": "BMW M", "WBR": "BMW", "WBY": "BMW", "WBX": "BMW",
  "WB5": "BMW", // NHTSA: BMW AG MPV
  "WDB": "Mercedes-Benz", "WDC": "Mercedes-Benz", "WDD": "Mercedes-Benz",
  "WDF": "Mercedes-Benz", "W1K": "Mercedes-Benz", "W1N": "Mercedes-Benz",
  // Additional MB AG WMIs from NHTSA GetWMIsForManufacturer(mercedes)
  "W1L": "Mercedes-Benz", "W1M": "Mercedes-Benz",
  "W1P": "Mercedes-Benz", "W1R": "Mercedes-Benz", "W1W": "Mercedes-Benz",
  "55S": "Mercedes-Benz", // US passenger
  "WDZ": "Mercedes-Benz", // Sprinter (bus type in NHTSA)
  "4JG": "Mercedes-Benz", "WME": "Smart", "HES": "Smart",
  "WP0": "Porsche", "WP1": "Porsche",
  "WVW": "Volkswagen", "WVG": "Volkswagen", "WV1": "Volkswagen", "WV2": "Volkswagen",
  "WV3": "Volkswagen",
  "W09": "Porsche",
  // ── UK ────────────────────────────────────────────────────────────────────
  "SAJ": "Jaguar", "SAL": "Land Rover", "SAR": "Rover", "SAD": "Jaguar",
  "SB1": "Toyota",
  "YAR": "Toyota",
  "WZ1": "Toyota", // Magna Steyr — GR Supra A90 EU
  "SHH": "Honda",
  // ── Ford Europe ───────────────────────────────────────────────────────────
  "WF0": "Ford", "WF1": "Ford", "8AF": "Ford", "SA1": "Ford", "SFA": "Ford",
  "SCB": "Bentley", "SCC": "Lotus",
  "SDB": "Aston Martin",
  "SFD": "Alexander Dennis",
  "TRU": "Audi",
  // ── SWEDEN ────────────────────────────────────────────────────────────────
  "YV1": "Volvo", "YV4": "Volvo",
  "7JR": "Volvo", "7JD": "Volvo", "XLB": "Volvo", "PNV": "Volvo",
  "YS2": "Scania",
  // ── FRANCE ────────────────────────────────────────────────────────────────
  "VF1": "Renault", "VF2": "Renault", "VF3": "Peugeot", "VF7": "Citroën",
  "VR7": "Citroën", // Stellantis / PSA modern Citroën (non-ZZZ VDS)
  "VNK": "Toyota", "NMT": "Toyota",
  // ── ITALY ─────────────────────────────────────────────────────────────────
  "ZAM": "Maserati", "ZAP": "Piaggio",
  "ZCG": "Fiat",
  "ZFA": "Fiat", "ZFB": "Fiat", "ZFC": "Fiat",
  "ZFF": "Ferrari",
  "ZHW": "Lamborghini",
  "ZLA": "Lancia",
  // ── SPAIN ─────────────────────────────────────────────────────────────────
  "VSS": "SEAT",
  "VSK": "Nissan Spain",
  // ── NETHERLANDS ───────────────────────────────────────────────────────────
  "XLR": "DAF", "XL9": "Spyker",
  // ── RUSSIA ────────────────────────────────────────────────────────────────
  "XTA": "Lada/AvtoVAZ",
  // ── Dacia (Romania) ───────────────────────────────────────────────────────
  "UU1": "Dacia", "UU6": "Dacia",
  // ── DS Automobiles ────────────────────────────────────────────────────────
  "VR1": "DS Automobiles",
  // ── Saab (Sweden) ─────────────────────────────────────────────────────────
  "YS3": "Saab",
  // ── Polestar / VinFast / Tata / Isuzu ─────────────────────────────────────
  "LPS": "Polestar",
  "YSM": "Polestar", // Sweden passenger
  "YSR": "Polestar", // Sweden MPV (Polestar 3)
  "7SY": "Polestar", // USA MPV (Polestar 3, Charleston)
  "RLL": "VinFast", "RLN": "VinFast",
  "5VF": "VinFast", // US WMI reserved; NC plant not producing volume yet — make only
  "MAT": "Tata",
  "JAA": "Isuzu", "JAC": "Isuzu", "JAL": "Isuzu",
  "MP1": "Isuzu", "MPA": "Isuzu", "M3G": "Isuzu",
  "4S1": "Isuzu", "4S2": "Isuzu", "J87": "Isuzu",
  // ── CHINA ─────────────────────────────────────────────────────────────────
  "LGX": "BYD", "LRW": "Tesla", "XP7": "Tesla",
  "LSG": "General Motors China",
  "LJC": "Chery", "LVR": "Chery", "LVS": "Ford China",
  "LVG": "Toyota", "LYV": "Volvo China", "LVY": "Volvo China",
  "LFP": "BYD", "LBV": "BYD", "LC0": "BYD", "LPE": "BYD",
  "LSJ": "MG", "LUC": "Neta",
  // LE4 = Beijing Benz (WMI registry) — not NIO. NIO uses LJ1 (shared with JAC) / HJN.
  "LE4": "Beijing Benz",
  // Unambiguous Chinese EV WMIs (make only until a verified VDS prefix hits).
  "HJN": "NIO",
  "L1N": "XPeng", "LMV": "XPeng",
  "LW4": "Li Auto", "HLX": "Li Auto",
  "L6T": "Zeekr", "LGW": "Haval / Great Wall",
  "LNB": "Xiaomi", "HXM": "Xiaomi", "LNY": "Yuejin",
  "LTN": "Changan", "LPA": "Changan",
  // LJ1 is shared (JAC + NIO in registries) — keep JAC; do not invent NIO from bare LJ1.
  "LJ1": "JAC", "LHG": "GAC", "LMG": "GAC Trumpchi",
  "LVH": "Dongfeng Honda", "LDN": "Dongfeng Nissan",
  "LDC": "Dongfeng Peugeot-Citroën", "LBE": "Hyundai",
  "LZW": "Wuling / Baojun",
  "LSA": "Maxus", "LJD": "Dongfeng Kia",
  "LTE": "JMC", "LLV": "Lifan", "LTV": "Foton",
  "LFM": "Toyota", "LWV": "GAC Mitsubishi",
  // ── INDIA ─────────────────────────────────────────────────────────────────
  "MA1": "Mahindra", "MA3": "Suzuki India",
  "MAL": "Hyundai", "MB2": "Hyundai", "MF3": "Hyundai",
  "MB8": "Honda India",
  "MBJ": "Toyota", "MHF": "Toyota",
  "MR0": "Toyota", "MR1": "Toyota", "MR2": "Toyota",
  // ── AUSTRALIA ─────────────────────────────────────────────────────────────
  "6FP": "Ford Australia", "6G1": "Chevrolet Australia",
  "6MM": "Mitsubishi Australia", "6T1": "Toyota",
  // ── BRAZIL ────────────────────────────────────────────────────────────────
  "9BF": "Ford Brazil", "9BW": "Volkswagen Brazil",
  "9BG": "GM Brazil", "93H": "Honda Brazil", "9BR": "Toyota",
  "8AJ": "Toyota", "AHT": "Toyota",
  // ── UK (continued) ────────────────────────────────────────────────────────
  "SCA": "Rolls-Royce",
  "SCF": "Aston Martin",
  "SBM": "McLaren",
  // SA9 is a shared UK small-volume WMI (Morgan, Noble, McLaren F1, …) — do not map to one make.
  // ── GERMANY (continued) ───────────────────────────────────────────────────
  "WMW": "MINI",
  "WMZ": "MINI", // NHTSA: MINI MPV
  "W1A": "Smart", // Mercedes-Benz AG Smart since late 2019 (successor to WME)
  "W0L": "Opel",
  "W0V": "Vauxhall",
  "VXK": "Vauxhall",
  // ── ITALY (continued) ─────────────────────────────────────────────────────
  "ZAR": "Alfa Romeo",
  "ZDB": "Alfa Romeo",
  // ── JAPAN – Lexus (override JT catch-all) ─────────────────────────────────
  "JTH": "Lexus",
  "JTJ": "Lexus",
  "JTE": "Toyota",
  "JTK": "Toyota",
  // ── JAPAN – Nissan / Infiniti (continued) ─────────────────────────────────
  "JN4": "Nissan",
  "JN6": "Nissan",
  "JNA": "Infiniti",
  "JNK": "Infiniti",
  // ── SOUTH KOREA (Genesis) ─────────────────────────────────────────────────
  "KMT": "Genesis", // passenger cars
  "KMU": "Genesis", // MPV / SUV
  // ── USA (more brands) ─────────────────────────────────────────────────────
  "19U": "Acura",
  "7FC": "Rivian",
  "5LA": "Lucid", // legacy Air descriptors still seen in the wild
  "50E": "Lucid", // NHTSA passenger-car WMI (Air)
  "7UU": "Lucid", // NHTSA MPV WMI (Gravity)
  "7G2": "Tesla",
  "1B3": "Dodge",
  "1D3": "Dodge",
  // ── CZECH REPUBLIC (Škoda) ────────────────────────────────────────────────
  "TMB": "Škoda", "TM8": "Škoda", "TMP": "Škoda", "TMS": "Škoda",
  "TNL": "Škoda", "XW8": "Škoda", "XWW": "Škoda", "Y6U": "Škoda",
  // ── SPAIN (SEAT, continued) ───────────────────────────────────────────────
  "VS6": "SEAT",
  "VS7": "SEAT",
  "VSX": "SEAT",
  // ── FRANCE (Renault / Alpine, continued) ───────────────────────────────────
  "VF6": "Renault",
  "VF8": "Renault",
  "VFA": "Alpine",
  // VYS = Ampere (Renault 5/4 E-Tech + Alpine A290) — shared; no single-make map.
  // ── BRAZIL (continued) ────────────────────────────────────────────────────
  "9BH": "Hyundai", "95P": "Hyundai", "8LG": "Hyundai",
  "PFD": "Hyundai", "Z94": "Hyundai", "AC5": "Hyundai",
  "8AP": "Volkswagen Argentina",
  // ── GM KOREA / MEXICO (KL*) ───────────────────────────────────────────────
  "KL7": "Chevrolet",    "KL4": "Chevrolet",    "KL8": "Chevrolet",
  // ── Kia EV lineup (KNB*) ─────────────────────────────────────────────────
  "KNB": "Kia",
  // ── Tesla newer builds (7SA*) ─────────────────────────────────────────────
  "7SA": "Tesla",
  // ── Hyundai commercial / bus ─────────────────────────────────────────────
  "KMJ": "Hyundai Commercial",
  // ── Additional Mercedes-Benz WMIs ────────────────────────────────────────
  "WDH": "Mercedes-Benz",
};

function decodeMake(vin: string, wmiMake: string | null, global?: ReturnType<typeof decodeGlobalBrand>): string | null {
  if (isAudiHomologationVin(vin)) return "Audi";
  // Toyota Proace / Proace City are badge-engineered on Renault VF1 plants.
  if (vin.startsWith("VF1BT8") || vin.startsWith("VF1BT9")) return "Toyota";
  const spec = resolveBrandVinSpec(vin);
  if (spec?.make) return spec.make;
  const chinaJv = resolveChinaJointVentureMake(vin);
  if (chinaJv) return chinaJv;
  const usMake = resolveUsVdsMake(vin);
  if (usMake) return usMake;
  return resolveGlobalBrandMake(vin, wmiMake, global);
}

function lookupWmiMake(vin: string): string | null {
  const upper = vin.toUpperCase();
  return WMI_MAP[upper.slice(0, 3)] ?? WMI_MAP[upper.slice(0, 2)] ?? null;
}

// ── Model series (positions 1-4 = first 4 VIN chars) ─────────────────────────
// Key = first 4 chars of VIN (WMI[0-2] + vehicle-line char[3])
// Covers the most common models worldwide; null means "unknown series"

const MODEL_MAP_4: Record<string, string> = {
  // ── Toyota ────────────────────────────────────────────────────────────────
  "4T1B": "Camry",      "4T1G": "Camry Hybrid",
  "2T1B": "Corolla",    "2T1G": "Corolla",
  "5YFB": "Corolla",    "5YFS": "Corolla",    "5YFT": "Corolla",    "5YFP": "Corolla",
  "4T3B": "RAV4",
  "5TDB": "Sienna",     "5TDK": "Sienna",     "5TDY": "Sequoia",
  "5TFR": "Tundra",     "5TFT": "Tundra",     "5TFU": "Tacoma",
  "5TFX": "Tacoma",
  "JTMB": "RAV4",       "JTMC": "Highlander", "JTMG": "4Runner",
  "JTMJ": "Highlander", "JTMH": "Venza",      "JTMA": "Yaris",
  "JTDA": "Prius",      "JTDL": "Prius",      "JTDK": "Prius",
  "JTDE": "Prius",
  // ── Honda ─────────────────────────────────────────────────────────────────
  "1HGC": "Accord",     "1HGA": "Accord",     "1HGE": "Accord",
  "1HGF": "Civic",      "1HGB": "Civic",      "1HGD": "Civic",
  "5FNR": "CR-V",       "5J6R": "CR-V",       "5J6T": "CR-V",
  "5J8Y": "Pilot",      "5J8T": "Pilot",
  "1HGS": "Odyssey",    "5FNRL": "Odyssey",
  "2HGF": "Civic",      "2HGE": "Accord",
  "JHMG": "Accord",     "JHMZ": "Jazz/Fit",   "JHMF": "Civic",
  // ── BMW ───────────────────────────────────────────────────────────────────
  // Series-specific codes live in european-premium.ts (longest-prefix match).
  // Do NOT add WBA1/WBA2/WBA3 here — WBA21=X7, WBA31=X3, etc. would mis-decode.
  "WBS3": "M3",         "WBS5": "M5",         "WBS1": "M2",
  "WBY7": "i3",         "WBY8": "i8",
  "5UXK": "X3",         "5UXZ": "X5",         "5UXW": "X1",
  "5UXU": "X5 M",       "5UXY": "X7",         "5UX3": "X3 M",
  "5YM1": "X1",         "5YM3": "X3 M",
  // ── Mercedes-Benz ─────────────────────────────────────────────────────────
  // Prefer european-premium letter/chassis rules; keep only unambiguous 4-char hints.
  // Do NOT map WDDL→GLE — letter L is CLS (C218) or E-Class (W214) on passenger WDD.
  // pos-4 letters are ambiguous; precise pos-4–5 rules live in european-premium
  // (SJ/5J=CLA, PK=SLK/SLC, JK=SL, LJ=CLS). These 4-char keys are last-resort only.
  // WDDS(J)=CLA and WDDP(K)=SLK were previously swapped (CLA decoded as SLK).
  // Never emit slash/"or" labels here — leave model null rather than guess.
  "WDDC": "C-Class",    "WDDE": "E-Class",    "WDDS": "CLA-Class",
  "WDDA": "A-Class",
  "WDDB": "B-Class",    "WDDF": "E-Class",    "WDDN": "GLA-Class",
  "WDDR": "GLC-Class",  "WDDW": "C-Class",
  "WDDX": "SL-Class",   "WDC0": "GLC-Class",  "WDCG": "GLK",
  "WDCJ": "GLC-Class",  "WDCA": "ML-Class",   "WDCB": "ML-Class",
  "WDCD": "GLE",        "WDCF": "GLE",        "WDCK": "GLC-Class",
  "WDCT": "GLA",
  "4JGD": "GLE",        "4JGF": "GLE",        "4JG0": "GLC-Class",
  "W1ND": "GLE",        "W1NF": "GLE",        "W1N0": "GLC-Class",
  "W1NK": "GLC-Class",  "W1NT": "GLA",
  // ── Audi ──────────────────────────────────────────────────────────────────
  // Ambiguous family buckets (A4/A5, A6/A7, S/RS) removed — use vag-modern / premium.
  "WAUA": "A8",
  "WAUJ": "A3",         "WAUM": "Q8",
  // WA1* SUV lines: do NOT map by pos.4 (A/B/C/F are trim). Use pos.7–8 via premium/modern.
  // ── Volkswagen ────────────────────────────────────────────────────────────
  // Do not map WVWZ/1VWZ — position 4 is ZZZ filler on EU VINs, not a model line.
  "WVWA": "Jetta",      "WVWB": "Polo",
  "WVWH": "Passat",     "1VWB": "Passat",
  "3VWF": "Jetta",      "3VWC": "Jetta",      "3VWS": "Tiguan",
  "3VW4": "Golf",       "3VW1": "Golf",
  // North American VW assembly plant prefixes (1VW*)
  "1VWF": "Golf",       "1VWA": "Eos",
  // ── Porsche ───────────────────────────────────────────────────────────────
  "WP0A": "911",
  "WP0C": "Cayenne",    "WP0Z": "Panamera",   "WP0G": "Taycan",
  "WP1A": "Cayenne",    "WP1Z": "Macan",
  // Boxster/Cayman share WP0B — leave to vag-modern / premium (no slash guess).
  // Land Rover / Range Rover: never use coarse 4-char fallbacks here.
  // Model identity is year-gated in jlr-eu.ts (longest prefix + production window).
  // ── Jaguar (coarse letter series; longer SAJ* rules in jlr-eu win first) ──
  "SAJW": "F-Type",     "SAJV": "XF",         "SAJA": "XE",
  "SAJP": "F-Pace",     "SAJE": "E-Pace",     "SAJC": "I-Pace",
  "SAJX": "F-Pace",
  "SADF": "I-Pace",
  // ── Hyundai: detailed decode in hyundai.ts — keep only safe coarse MPV prefixes here.
  "KM8J": "Tucson",     "KM8S": "Santa Fe",     "KM8L": "Tucson",
  "KM8R": "Santa Cruz",
  // ── Kia ───────────────────────────────────────────────────────────────────
  "KNAD": "Sportage",   "KNAG": "Stinger",    "KNAH": "K900",
  "KNAE": "Cadenza",    "KNAF": "Carnival",
  "KNDJ": "Soul",       "KNDL": "Telluride",  "KNDM": "Niro",
  "KNDN": "Sorento",    "KNDP": "Sportage",   "KNDR": "Stonic",
  // Kia Georgia / Mexico — only prefixes verified via NHTSA DecodeVinValues
  "5XYP": "Telluride",  "5XYR": "Sorento",
  "3KPF": "Forte",
  // ── Tesla ─────────────────────────────────────────────────────────────────
  "5YJ3": "Model 3",    "5YJS": "Model S",    "5YJX": "Model X",
  "7SAY": "Model Y",    "7G2A": "Model Y",
  // ── Volvo ── model comes from the dedicated decoder in volvo.ts (VDS layout
  //    varies EU vs US), so no coarse position-4 fallback lives here.
  // ── Ford ──────────────────────────────────────────────────────────────────
  "1FTF": "F-150",      "1FTE": "F-150",      "1FTW": "F-150",
  "1FMC": "Escape",     "1FMS": "Explorer",   "1FMH": "Edge",
  "1FA6": "Mustang",    "3FA6": "Fusion",
  // ── Chevrolet / GMC ───────────────────────────────────────────────────────
  "1G1F": "Camaro",     "2G1F": "Camaro",
  "1GNS": "Tahoe",      "1GKS": "Yukon",
  "1GCH": "Silverado",  "1GCP": "Silverado",  "2GCH": "Silverado",
  "1GTN": "Sierra",     "1GTG": "Sierra",
  // ── Nissan / Infiniti ─────────────────────────────────────────────────────
  "1N4A": "Altima",     "1N4B": "Maxima",
  "5N1A": "Pathfinder", "5N1D": "Armada",     "5N1Z": "Murano",
  // JN1* is shared Nissan/Infiniti Japan PC WMI — no 4-char make/model guesses
  // (JN1A≠Infiniti, JN1B≠Leaf). Longer verified descriptors live in global-brands.
  // 1N6A Titan vs Frontier is ambiguous — omit coarse fallback.
  // Mazda models: see mazda.ts (carline pos. 4–5). Do not use coarse JM1B/JM3K here —
  // JM1GJ (Mazda6) must not become MX-5 via a JM1G → Miata map.
  // ── Subaru ────────────────────────────────────────────────────────────────
  "JF2S": "Forester",   "JF2T": "Outback",
  "4S3B": "Impreza",    "4S4B": "Outback",
  // JF1V WRX vs STI is ambiguous — omit.
  // ── Mitsubishi ────────────────────────────────────────────────────────────
  "JA3A": "Eclipse",    "JA4A": "Outlander",  "JA4J": "Eclipse Cross",
  // ── Lexus ─────────────────────────────────────────────────────────────────
  "2T2B": "RX",         "2T2H": "NX",         "JTJG": "LX",
  "JTJB": "GX",         "JTJY": "RX",
  // ── Lexus Japan (JTH* / JTJ*) / Kentucky ES (58A*) ────────────────────────
  "JTHB": "ES",         "JTHD": "LS 600h",    "JTHG": "IS 300/350",
  "JTHJ": "RX 450h",    "JTHK": "NX 300h",    "JTHL": "CT 200h",
  "JTHM": "GS 450h",    "JTHN": "RZ 450e",    "JTHE": "IS 500",
  "58AB": "ES",
  // ── Nissan Japan (JN8*) — JN1* models resolved via global-brands (shared Infiniti)
  "JN8A": "X-Trail",     "JN8B": "Patrol",     "JN8D": "Qashqai",
  "JN8E": "Murano",      "JN8G": "Juke",       "JN8J": "Armada",
  // ── Infiniti (JNA* / JNK*) ───────────────────────────────────────────────
  "JNKB": "QX80",       "JNKC": "Q50",
  "JNKN": "Q60",
  "JNAA": "QX60",
  // Ambiguous Q70/M, QX70/FX, Q30/QX30 omitted.
  // ── Acura USA (JH4* / 19U*) ──────────────────────────────────────────────
  "JH4D": "Integra",     "JH4K": "MDX",        "JH4T": "TL",
  "JH4V": "RL",          "JH4Y": "NSX",
  "19UY": "RDX",         "19UA": "ILX",        "19UB": "TLX",
  "19UC": "MDX",         "19UF": "ZDX",
  // ── More Subaru ───────────────────────────────────────────────────────────
  "JF1S": "Impreza",     "JF1B": "BRZ",        "JF2A": "Crosstrek",
  "JF2Z": "Ascent",      "JF2G": "Legacy",
  // ── More Mitsubishi ───────────────────────────────────────────────────────
  "JA3C": "Galant",      "JA4D": "Pajero Sport","JA4W": "ASX",
  "JMBA": "Outlander PHEV", "JMBZ": "Eclipse Cross PHEV",
  // ── More Nissan USA ───────────────────────────────────────────────────────
  "1N4C": "Altima",      "5N1B": "Rogue",       "5N1R": "Xterra",
  "5N1E": "Murano",      "3N6C": "NV Cargo",
  // ── More Toyota USA ───────────────────────────────────────────────────────
  "2T3J": "RAV4",        "4T1C": "Camry",       "5TDZ": "Sequoia",
  // ── MINI ──────────────────────────────────────────────────────────────────
  "WMWZ": "Cooper",      "WMW4": "Countryman",
  // WMWX is shared (Cooper hatch vs Clubman) — leave to MINI_RULES; no 4-char guess.
  "WMWS": "Paceman",     "WMW5": "Cooper S",    "WMW6": "John Cooper Works",
  "WMWN": "Convertible", "WMW3": "Cabrio",
  // ── Alfa Romeo (ZAR*) ─────────────────────────────────────────────────────
  "ZARB": "Giulia",      "ZARE": "Stelvio",     "ZARG": "Giulietta",
  "ZARJ": "Tonale",      "ZARR": "Brera",       "ZARS": "Spider",
  // ── Genesis (KMT* cars / KMU* SUVs — pos.4 letters differ by WMI) ──────────
  "KMTG": "GV80",        "KMTH": "GV70",        "KMTJ": "G90",
  "KMTF": "G70",         "KMTK": "GV60",        "KMTE": "G80",
  // KMU MPV line letters (verified via NHTSA-style descriptors): H=GV80, M=GV70, K=GV60
  "KMUH": "GV80",        "KMUM": "GV70",        "KMUK": "GV60",
  // ── Saab (YS3*) — NHTSA: YS3D*/YS3F* → 9-3, YS3E* → 9-5 ─────────────────
  "YS3D": "9-3",         "YS3F": "9-3",         "YS3E": "9-5",
  // ── Chrysler / Dodge / Jeep / RAM ─────────────────────────────────────────
  "1C3C": "Chrysler 300","2C3C": "Chrysler 300",
  "1C4P": "Jeep Wrangler","1C4R": "Jeep Grand Cherokee",
  "1C4H": "Dodge Durango","1C4B": "Chrysler Pacifica",
  "1C4J": "Jeep Compass", "1C4N": "Jeep Renegade",
  "1C6R": "Ram 1500",     "1C6T": "Ram 2500",   "3C6T": "Ram 2500",
  // ── More Ford USA ─────────────────────────────────────────────────────────
  "1FMJ": "Explorer",    "1FMU": "Escape",      "1FT8": "Super Duty",
  "1FMK": "Edge",        "1FME": "Expedition",  "1FTR": "Ranger",
  // ── Cadillac (1GY*) ───────────────────────────────────────────────────────
  "1GYS": "Escalade",    "1GYA": "ATS",         "1GYB": "CTS",
  "1GYC": "CT6",         "1GYD": "XT5",         "1GYE": "XT6",
  "1GYF": "CT5",
  // ── Lincoln ───────────────────────────────────────────────────────────────
  "1LNH": "Navigator",   "5LMJ": "Navigator",
  // 5LMF MKZ vs Zephyr is ambiguous — omit.
  // ── Rivian (7FC*) ─────────────────────────────────────────────────────────
  "7FCA": "R1T",         "7FCC": "R1S",         "7FCB": "EDV 700",
  // ── More Renault (VF1*) ───────────────────────────────────────────────────
  "VF1J": "Clio",        "VF1L": "Megane",      "VF1K": "Captur",
  "VF1R": "Zoe",         "VF1E": "Kadjar",      "VF1S": "Arkana",
  "VF1B": "Clio",        "VF1M": "Megane",      "VF1H": "Captur",
  "VF1A": "Arkana",
  "VF2R": "Clio",        "VF2L": "Megane",
  // ── More Peugeot (VF3*) ───────────────────────────────────────────────────
  "VF3A": "208",          "VF3D": "308",         "VF3M": "3008",
  "VF3N": "5008",         "VF3E": "2008",
  // ── More Citroën (VF7* / VR7*) ────────────────────────────────────────────
  "VF7A": "C3",           "VF7C": "C5",          "VF7U": "C4",
  "VF7B": "Berlingo",     "VF7R": "C3 Aircross",
  "VR7E": "Berlingo",     "VR7C": "C3",          "VR7A": "C4",
  // ── Opel / Vauxhall (W0L*) ────────────────────────────────────────────────
  "W0LS": "Astra",        "W0LB": "Corsa",       "W0LT": "Insignia",
  "W0LM": "Mokka",        "W0LN": "Grandland",
  // ── Škoda (TMB*) — 4-char fallbacks; precise decode in european-brands.ts ───
  "TMBA": "Octavia",      "TMBJ": "Fabia",       "TMBE": "Superb",
  "TMBG": "Kodiaq",       "TMBK": "Kamiq",       "TMBZ": "Karoq",
  "TMBL": "Karoq",        "TMBD": "Kodiaq",      "TMBR": "Scala",
  // ── SEAT (VS6* / VS7*) — keep in sync with seat-eu SEAT_VS6_VS7_AT_4 ───────
  "VS6A": "Ibiza",        "VS6B": "Ibiza",       "VS6K": "León",
  "VS6L": "León ST",      "VS6M": "Mii",
  "VS7A": "Arona",        "VS7B": "Ateca",       "VS7C": "León",
  "VS7K": "León",         "VS7T": "Tarraco",
  // ── Ferrari (ZFF*) ────────────────────────────────────────────────────────
  "ZFFA": "488 GTB",      "ZFFB": "F8 Tributo",  "ZFFC": "Roma",
  "ZFFD": "SF90 Stradale","ZFFE": "Portofino",   "ZFFG": "296 GTB",
  "ZFFH": "Purosangue",
  // ── Lamborghini (ZHW*) ────────────────────────────────────────────────────
  "ZHWB": "Urus",         "ZHWC": "Huracán",     "ZHWD": "Aventador",
  "ZHWE": "Revuelto",
  // ── Maserati (ZAM*) ───────────────────────────────────────────────────────
  "ZAMA": "Ghibli",       "ZAMB": "Quattroporte","ZAMC": "Levante",
  "ZAMD": "GranTurismo",  "ZAME": "Grecale",
  // ── Rolls-Royce (SCA*) ────────────────────────────────────────────────────
  "SCAA": "Ghost",        "SCAB": "Phantom",     "SCAC": "Cullinan",
  "SCAD": "Wraith",       "SCAF": "Spectre",
  // ── Aston Martin (SCF*) ───────────────────────────────────────────────────
  "SCFB": "DB11",         "SCFC": "Vantage",     "SCFD": "DBS",
  "SCFE": "DBX",          "SCFF": "DB12",
  // ── Bentley (SCB*) ────────────────────────────────────────────────────────
  "SCBB": "Continental GT","SCBC": "Bentayga",   "SCBD": "Flying Spur",
  "SCBE": "Continental GTC",
  // ── Hyundai IONIQ EV — specific platforms only (KMHL alone is also Sonata DN8 KR) ──
  // Coarse "KMHL"→IONIQ 5 removed: Korean Sonata MY2020+ uses line L (KMHL*).
  "KMHM": "IONIQ 6",     "KMHQ": "IONIQ 5 N",
  // ── Kia EV series ─────────────────────────────────────────────────────────
  "KNDC": "EV6",         "KNBC": "EV9",         "KNDE": "Niro EV",
  "KNDF": "Sportage Hybrid",
  // ── Ford: Bronco, Maverick, Mach-E ────────────────────────────────────────
  "1FM5": "Bronco",      "1FMD": "Bronco Sport","3FTT": "Maverick",
  "3FMT": "Mach-E",      "1FMF": "Mach-E",
  // ── Chevrolet Equinox / Trailblazer / Trax (GM Korea) ────────────────────
  "1GNJ": "Equinox",     "2GNA": "Equinox",     "2GNF": "Equinox",
  "KL7J": "Trailblazer", "KL7C": "Trax",        "KL4C": "Trax",
  "KL8J": "Blazer",
  // ── Tesla newer Fremont/Berlin WMIs ──────────────────────────────────────
  "7SA3": "Model 3",     "7SA2": "Model S",
  // ── Toyota bZ4X ───────────────────────────────────────────────────────────
  "JTME": "bZ4X",
  // ── Genesis GV70e / GV60 (EV) ────────────────────────────────────────────
  "KMTN": "GV70e",
  // ── Dacia (4-char fallbacks; precise decode in global-brands.ts) ──────────
  "UU1D": "Duster",     "UU1B": "Sandero",    "UU1H": "Logan",
  "UU1J": "Jogger",     "UU1S": "Spring",
};

// Longer-prefix overrides checked before MODEL_MAP_4 (longest match wins).
// Keys can be 5–7 chars. Add entries here whenever a 4-char prefix is ambiguous.
const MODEL_OVERRIDES: Record<string, string> = {
  // Kia Georgia: 5XXG alone is Optima (legacy) or K5 — disambiguate with pos.5
  "5XXGT":   "Optima",   // NHTSA DecodeVinValues
  "5XXG4":   "K5",       // NHTSA DecodeVinValues (ErrorCode 0 sample)
  "5XXG6":   "K5",
  // BMW legacy NA Z4 — NHTSA DecodeVinValues 5UMBT* → Z4
  "5UMB":    "Z4",
  // Mercedes-Benz CLS (C218/C257) — pos-5 J disambiguates from WDDL→GLE
  "WDDLJ":   "CLS-Class",
  // Mercedes-Benz W1K (2016+ passenger cars) — same chassis codes as WDD*
  "W1K177":  "A-Class",
  "W1K118":  "CLA-Class",
  "W1K205":  "C-Class",
  "W1K206":  "C-Class",
  "W1K213":  "E-Class",
  "W1K214":  "E-Class",
  "W1K222":  "S-Class",
  "W1K223":  "S-Class",
  "W1K253":  "GLC-Class",
  "W1K247":  "GLA / GLB",
  "W1K167":  "GLE / GLS",
  "W1K166":  "GLE",
  "W1K164":  "ML-Class",
  "W1K163":  "ML-Class",
  "W1K290":  "EQS",
  "W1K294":  "EQE",
  // Mercedes-Benz chassis codes (positions 4–6, e.g. WDD213 = E-Class W213)
  "WDD213":  "E-Class",
  "WDD205":  "C-Class",
  "WDD206":  "C-Class",
  "WDD204":  "C-Class",
  "WDD203":  "C-Class",
  "WDD202":  "C-Class",
  "WDD222":  "S-Class",
  "WDD223":  "S-Class",
  "WDD166":  "GLE",
  "WDD163":  "ML-Class",
  "WDD164":  "ML-Class",
  "WDD253":  "GLC-Class",
  "WDD254":  "GLC-Class",
  "WDD247":  "GLA / GLB",
  "WDD463":  "G-Class",
  "WDB463":  "G-Class",
  "WDC463":  "G-Class",
  "WDD167":  "GLE / GLS",
  "WDD177":  "A-Class",
  "WDD118":  "CLA-Class",
  "WDD243":  "EQA / EQB",
  "WDD296":  "EQS SUV",
  "WDD236":  "CLE",
  "WDD293":  "EQC",
  // SUV letter VDS fallbacks (prefer european-premium body+year rules)
  "WDCDA":  "GLE",
  "WDCDF":  "GLS",
  "WDCFB":  "GLE",
  "WDCFF":  "GLS",
  "WDC0G":  "GLC-Class",
  "WDC0J":  "GLC Coupe",
  "WDCKM":  "GLC-Class",
  "WDC4N":  "GLA",
  "WDC4M":  "GLB",
  "4JGDA":  "GLE",
  "4JGDF":  "GLS",
  "4JGFB":  "GLE",
  "4JGFF":  "GLS",
  "W1NDA":  "GLE",
  "W1NDF":  "GLS",
  "W1NFB":  "GLE",
  "W1NFF":  "GLS",
  "W1N0G":  "GLC-Class",
  "W1N4N":  "GLA",
  "W1N4M":  "GLB",
  // Honda Japan — CM chassis = Accord (7th gen, e.g. JHMCM56557C404453)
  "JHMCM":   "Accord",
  "JHMC":    "Accord",
  "JHME":    "Civic",
  "JHMF":    "Civic",
  // Toyota USA Mississippi (5YF* — Corolla)
  "5YFS4":   "Corolla",
  "5YFT4":   "Corolla",
  "5YFB4":   "Corolla",
  "5YFP4":   "Corolla",
  "5YFBU":   "Corolla",
  // Hyundai IONIQ — must stay longer than 4 chars (KMHL is shared with Sonata KR)
  "KMHL341": "IONIQ 5",
  "KMHLW4":  "IONIQ 5",
};

function decodeModel(vin: string, global?: GlobalBrandDecode): string | null {
  const upper = vin.toUpperCase();

  const brandModel = resolveBrandVinModel(upper);
  if (brandModel) return brandModel;

  const premium = decodePremiumEuropeanModel(upper);
  if (premium) return premium;

  for (const len of [7, 6, 5]) {
    const hit = MODEL_OVERRIDES[upper.slice(0, len)];
    if (hit) return hit;
  }
  // Ford / GM NA — dedicated chassis+prefix decoders (before coarse US VDS).
  if (isFordNaVin(upper)) {
    const fordNa = decodeFordNaModel(upper);
    if (fordNa) return fordNa;
  }
  if (isGmNaVin(upper)) {
    const gmNa = decodeGmNaModel(upper);
    if (gmNa) return gmNa;
  }
  const usVds = decodeUsVdsModel(upper);
  if (usVds) return usVds;
  if (global?.model) return global.model;
  if (!global) {
    const discovered = decodeGlobalBrand(upper).model;
    if (discovered) return discovered;
  }
  const euBrand = decodeEuropeanBrandModel(upper);
  if (euBrand) return euBrand;
  // EU ZZZ type-approval VINs — before generic 4-char map
  if (upper.length >= 7 && upper.slice(3, 6) === "ZZZ") {
    const wmi = upper.slice(0, 3);
    if (
      isVagWmi(wmi) ||
      wmi.startsWith("WAU") ||
      wmi.startsWith("TRU") ||
      wmi.startsWith("SAL") ||
      wmi.startsWith("SAJ") ||
      isFordEuWmi(wmi)
    ) {
      const eu = decodeModelEuropean(upper);
      if (eu) return eu;
    }
  }
  const asian = isHyundaiToyotaVin(upper) ? decodeHyundaiToyotaModel(upper) : null;
  if (asian) return asian;
  if (isMazdaVin(upper)) {
    const mazda = decodeMazdaModel(upper);
    if (mazda) return mazda;
  }
  if (isFordEuWmi(upper.slice(0, 3))) {
    const ford = decodeFordEuModel(upper);
    if (ford) return ford;
  }
  const fromFour = MODEL_MAP_4[upper.slice(0, 4)];
  if (fromFour) return fromFour;
  return null;
}

// ── Engine code (position 8, index 7) — manufacturer-specific ─────────────────
// Key = WMI prefix (3-char or 2-char), value = map of engine-char → description

const ENGINE_CODE_MAP: Record<string, Record<string, string>> = {
  // Toyota Japan (JT* prefix)
  JT: {
    A: "1.5L I4 (1NZ/1ZR)", B: "1.8L I4 (2ZR-FE)", D: "2.0L Diesel (1CD)",
    E: "1.8L I4 Hybrid (1ZZ-HSD)", G: "2.0L I4 (3ZR-FAE)", H: "2.5L I4 Hybrid",
    N: "2.0T I4 Turbo", P: "2.4L I4 (2AZ-FE)", U: "2.5L I4 (A25A-FXS)",
    Z: "Electric (e-TNGA)", R: "3.5L V6 (2GR-FXE)",
  },
  // Honda Japan (JHM*)
  JHM: {
    A: "1.3L I4 (L13A)", B: "1.5L I4 (L15B)", C: "1.5T VTEC Turbo (L15C)",
    D: "2.0L DOHC i-VTEC (K20)", F: "2.4L I4 (K24)", G: "3.0L V6 (J30)",
    K: "2.0T DOHC Turbo (K20C)", L: "3.5L V6 (J35)",
  },
  // BMW Germany (WBA)
  WBA: {
    B: "2.0L I4 TwinPower", C: "3.0L I6 TwinPower", D: "2.0L Diesel (B47)",
    E: "3.0L Diesel (B57)", F: "1.5L I3 Hybrid", N: "4.4L V8 Biturbo (S63)",
    S: "Electric (BEV)", U: "Hybrid (PHEV)",
  },
  // BMW USA (5UX* prefix)
  "5UX": {
    B: "2.0L I4 TwinPower", C: "3.0L I6 TwinPower", D: "2.0L Diesel",
    N: "4.4L V8 Biturbo", J: "4.4L V8 Competition",
  },
  // Mercedes-Benz (WDD*)
  WDD: {
    A: "1.33L I4 Turbo (M282)", C: "2.0L I4 Turbo (M264)",
    D: "1.5L Diesel (OM608)", E: "2.0L Diesel (OM654)",
    G: "3.0L I6 Turbo (M256)", J: "4.0L V8 Biturbo (M177)",
    K: "AMG 4.0L V8 (M177 DE 40)", N: "EQ Electric",
  },
  // Audi (WAU*)
  WAU: {
    A: "1.8T TFSI I4", B: "2.0T TFSI I4", C: "3.0 TFSI V6 Supercharged",
    D: "2.0 TDI Diesel", F: "3.2 FSI V6", G: "2.7T Biturbo V6",
    H: "3.0 TDI Diesel", N: "4.2L FSI V8", S: "EV (e-tron)",
  },
  // Volkswagen Germany (WVW*)
  WVW: {
    A: "1.6L MPI I4", B: "1.8T TSI I4", C: "2.0T TSI I4",
    D: "2.0 TDI Diesel", E: "1.4 TSI I4", H: "3.6L VR6",
    K: "1.0 TSI I3", M: "1.5 eTSI Mild Hybrid",
  },
  // Porsche (WP0*)
  WP0: {
    A: "3.0L Flat-6 Biturbo", B: "2.5L Flat-4 Turbo", C: "3.0L V6 Turbo",
    D: "3.0L Diesel V6", G: "2.9L Biturbo V6", T: "Taycan Electric",
  },
  // Hyundai Korea (KMH*)
  KMH: {
    A: "1.4L I4 (G4LC)", B: "1.6L I4 (G4FG)", C: "2.0L I4 (G4NA/G4NC)",
    D: "2.4L I4 (G4KJ)", E: "1.6L CRDi Diesel", F: "3.3L V6 (G6DP)",
    G: "3.8L V6 Lambda", H: "1.6L I4 Hybrid (G4FJ)", K: "2.0L Turbo (G4KH)",
    L: "Electric — 77.4 kWh (IONIQ 5 / IONIQ 6 Long Range)",
    N: "Electric (EV)", P: "2.5L Turbo I4",
    R: "1.6T I4 Hybrid (T-GDi)",
    S: "Electric — 58 kWh (IONIQ 5 Standard Range)",
    T: "Electric — 53 kWh (IONIQ 6 Standard)",
    W: "Electric — 72.6 kWh (IONIQ 5)",
  },
  KM8: {
    A: "2.0L I4 (G4NA)", B: "2.4L I4 (G4KJ)", C: "2.0L Turbo (G4KH)",
    D: "2.5L I4 (G4KM)", E: "1.6L CRDi Diesel", F: "3.3L V6",
    G: "2.5L Turbo I4", H: "1.6T Hybrid", K: "2.0L Turbo",
    L: "Electric", N: "Electric (EV)", P: "2.5T I4", R: "1.6T Hybrid",
  },
  TMA: {
    A: "1.0L T-GDi I3", B: "1.6L I4", C: "2.0L I4", D: "1.6 CRDi",
    E: "1.6T I4", H: "1.6 Hybrid", K: "2.0T I4", P: "2.5L I4",
  },
  "5NM": {
    A: "2.5L I4", B: "2.5T I4", C: "2.0L Turbo", D: "1.6 Hybrid",
    E: "2.5 Hybrid", G: "3.5L V6",
  },
  "5NP": {
    A: "2.0L I4", B: "2.5L I4", C: "1.6T", D: "2.0T", E: "Hybrid",
  },
  // Kia Korea (KNA* / KND*)
  KNA: {
    A: "1.6L I4 (G4FG)", B: "2.0L I4 (G4NA)", C: "2.4L I4 (G4KJ)",
    D: "2.0L Diesel (D4FD)", E: "3.3L V6 (G6DP)", N: "EV",
    P: "1.6T I4 Hybrid", R: "1.6T I4 Turbo",
  },
  KND: {
    A: "1.6L I4 (G4FJ)", B: "2.0L I4 (G4NA)", C: "2.4L I4", D: "1.6L CRDi Diesel",
    E: "3.3L V6 Biturbo (Lambda II TCI)", H: "1.6L I4 Hybrid",
    L: "Electric — 77.4 kWh (EV6 / EV9 Long Range)",
    N: "EV (Niro EV)", P: "1.6T I4 Hybrid",
    R: "Electric — 99.8 kWh (EV9)",
    S: "Electric — 58 kWh (EV6 Standard Range)",
  },
  // Genesis Korea (KMT* / KMU*)
  KMT: {
    A: "2.5T I4 (G4KJ TCI)", B: "3.5T V6 (Lambda II TCI)",
    C: "3.5L V6 (G6DP)", E: "2.0T I4 (T-GDi)",
    G: "2.2L CRDi Diesel", N: "Electric (GV60 / GV70e)",
    P: "2.5T I4 AWD", R: "3.5T V6 AWD",
  },
  KMU: {
    A: "2.5T I4 (G4KJ TCI)", B: "3.5T V6 (Lambda II TCI)",
    C: "3.5L V6 (G6DP)", E: "2.0T I4 (T-GDi)",
    G: "2.2L CRDi Diesel", N: "Electric (GV60 / GV70e)",
    P: "2.5T I4 AWD", R: "3.5T V6 AWD",
  },
  // Honda USA (1HG* / 5FN*)
  "1HG": {
    A: "1.5T VTEC Turbo", B: "2.0L DOHC i-VTEC (K20)", C: "1.5T (L15B7)",
    D: "2.4L I4 (K24)", F: "1.5L I4 (L15B)", R: "3.5L V6 (J35Y)",
  },
  "5FN": {
    A: "1.5T VTEC Turbo", L: "2.0T DOHC (K20C1)", R: "1.5T (L15BE)",
    Y: "3.5L V6 (J35Y5)",
  },
  // Ford USA (1FT* / 1FA*)
  "1FT": {
    E: "2.7L V6 EcoBoost", F: "3.5L V6 EcoBoost", G: "5.0L Coyote V8",
    H: "6.2L V8 (Boss)", W: "3.5L HO EcoBoost", X: "2.3L EcoBoost I4",
    K: "3.0L Powerstroke Diesel V6",
  },
  "1FA": { G: "5.0L Coyote V8", H: "2.3L EcoBoost I4", P: "5.2L Voodoo V8" },
  // Chevrolet (1GC*)
  "1GC": {
    C: "4.3L EcoTec3 V6", E: "5.3L EcoTec3 V8", F: "6.2L EcoTec3 V8",
    H: "6.6L Duramax Diesel V8", K: "2.7T Turbo I4",
  },
  // Tesla: motor/battery decoded in tesla.ts (position 7–8), not position 8 alone.
  // Land Rover (SAL*): no generic pos.8 engine table — era/market mappings conflict.
  // Jaguar (SAJ*): keep Electric only for proven I-Pace codes; no Ingenium guesses.
  SAJ: {
    N: "Electric (I-Pace)",
  },
  SAD: {
    A: "Electric (I-Pace)", E: "Electric (I-Pace)", F: "Electric (I-Pace)",
    N: "Electric (I-Pace)",
  },
  // Nissan Japan (JN1* / JN8*)
  JN1: {
    A: "2.5L V6 (VQ25DE)", B: "3.5L V6 (VQ35DE)", C: "2.0T I4 (MR20DDT)",
    D: "2.0L I4 (MR20DE)", E: "3.7L V6 (VQ37VHR)", H: "Electric (Leaf 40/62 kWh)",
    K: "2.5L I4 (QR25DE)", L: "1.6L I4 Turbo (MR16DDT)", P: "3.0T V6 Biturbo (VR30)",
    R: "2.0T I4 (KR20DDT)", T: "1.5L I4 (HR15)", Z: "Hybrid",
  },
  JN8: {
    A: "3.3L V6 (VQ33DE)", B: "5.6L V8 (VK56VD)", D: "2.5L I4 (QR25DE)",
    E: "3.5L V6 (VQ35DE)", G: "1.6L I4 Turbo (MR16DDT)", J: "3.0T V6 Biturbo",
    Z: "2.0L Diesel (YD20DDT)",
  },
  // Nissan USA (1N4* / 5N1* / 3N1*)
  "1N4": {
    A: "2.5L I4 (QR25DE)", B: "3.5L V6 (VQ35DE)", C: "2.0L I4 (MR20DE)",
    D: "1.6L I4 Turbo (MR16DDT)", L: "2.5L I4 Hybrid (HR25DE)", Z: "Hybrid (e-POWER)",
  },
  "5N1": {
    A: "3.5L V6 (VQ35DE)", B: "5.6L V8 (VK56VD)", D: "3.5L V6 (VQ35)",
    E: "2.5L I4 Hybrid", N: "1.5T I4 (KR15DDT)", Z: "3.5L V6 (VQ35)",
  },
  "3N1": {
    A: "1.6L I4 (HR16DE)", B: "2.0L I4 (MR20DE)", C: "1.6L I4 (GA16DE)",
    D: "1.8L I4 (MR18DE)",
  },
  // Infiniti Japan (JNK* / JNA*)
  JNK: {
    A: "2.5L V6 (VQ25DE)", B: "3.0T V6 Biturbo (VR30DDTT)", C: "3.7L V6 (VQ37VHR)",
    D: "5.0L V8 (VK50VE)", E: "3.5L V6 Hybrid (VQ35)", N: "Electric (Q Inspire)",
    R: "3.5L V6 (VQ35HR)", S: "5.6L V8 (VK56VD)",
  },
  JNA: {
    A: "3.5L V6 (VQ35DE)", B: "2.5L V6 (VQ25DE)", C: "2.5L I4 Hybrid",
    D: "3.7L V6 (VQ37VHR)", N: "Electric", R: "2.0T I4",
  },
  // Toyota USA (4T* / 5TF* / 5TD* / 2T*)
  "4T1": {
    B: "2.5L I4 (A25A-FXS Hybrid)", C: "3.5L V6 (2GR-FXS)", G: "2.5L I4 Hybrid",
    K: "3.5L V6 (2GR-FE)", N: "2.5L I4 Hybrid (A25A-FXS)", R: "2.4T I4 (T24A)",
  },
  "5TF": {
    A: "4.6L V8 (1UR-FE)", E: "5.7L V8 (3UR-FE)", F: "2.7L I4 (1TR-FE)",
    M: "4.0L V6 (1GR-FE)", R: "3.5L V6 (2GR-FE)", S: "2.4T I4 (T24A-FTS)",
  },
  "5TD": {
    A: "3.5L V6 (2GR-FE)", B: "2.7L I4 (2TR-FE)", K: "3.5L V6 Hybrid (2GR-FXE)",
    Y: "3.4L V6 (2GR-FXS)", Z: "3.5L V6 Hybrid",
  },
  "2T1": {
    A: "1.8L I4 (2ZR-FE)", B: "1.8L I4 Hybrid (2ZR-FXE)", R: "2.0L I4 (M20A-FXS)",
  },
  // Toyota USA Mississippi (5YF* — Corolla at Blue Springs)
  "5YF": {
    B: "1.8L I4 (2ZR-FE)", C: "1.8L I4 Hybrid (2ZR-FXE)", E: "2.0L I4 (M20A-FKS)",
    M: "2.0L I4 (M20A-FKS)", R: "2.0L I4 (M20A-FXS Hybrid)",
  },
  // Mazda Japan (JM1* / JM3*)
  JM1: {
    B: "2.0L I4 Skyactiv-G (PE-VPS)", D: "1.5L I4 Skyactiv-G (P5-VP)",
    F: "2.5L I4 Skyactiv-G (PY-VPTS)", G: "1.3L Rotary (13B-MSP)",
    H: "2.5T I4 Skyactiv-G Turbo (PY-VPTS)", K: "1.5L Skyactiv-D Diesel",
    L: "2.2L Skyactiv-D (SH-VPTS)", M: "2.0L Skyactiv-G",
    N: "2.5L Skyactiv-G", P: "Skyactiv-X / e-Skyactiv Hybrid",
  },
  JM3: {
    B: "2.5L I4 Skyactiv-G (PY-VPTS)", D: "2.0L I4 (PE-VPS)",
    F: "2.5T I4 Skyactiv-G Turbo", L: "2.2L Skyactiv-D Diesel",
    M: "2.5L Skyactiv-G", R: "2.5T I4 Turbo",
  },
  // Subaru Japan/USA (JF* / 4S*)
  JF1: {
    A: "2.5L H4 (EJ253)", B: "2.5T H4 (EJ255/EJ257)",
    D: "2.0L H4 Diesel (EE20)", E: "2.0L H4 (FB20)",
    F: "2.5L H4 (EJ25)", G: "2.5L H4 (FB25)",
    H: "Hybrid / PHEV", K: "1.6L H4 (FB16)", L: "2.0T H4 (FA20F)",
    M: "2.4T H4 (FA24F)",
  },
  JF2: {
    B: "2.5L H4 (FB25)", C: "2.0L H4 Diesel (EE20)", D: "2.0T H4 (FB20DIT)",
    E: "2.5L H4 (EJ253)", F: "3.0L H6 (EZ30)", G: "2.5T H4 (EJ257)",
    H: "2.5L H4 Hybrid", M: "2.5L H4 (EJ25)", S: "3.6L H6 (EZ36)",
    T: "2.5T H4 (EJ257 STI)", X: "2.4T H4 (FA24F)",
  },
  "4S3": { A: "2.5L H4 (EJ253)", B: "2.5T H4 (EJ257)", E: "2.0T H4 (FA20F)", G: "2.5L H4 (FB25)" },
  "4S4": { B: "2.5L H4 (FB25)", T: "3.6L H6 (EZ36D)", X: "2.4T H4 (FA24F)" },
  // Mitsubishi Japan (JA3* / JA4*)
  "JA3": {
    A: "2.0T I4 (4G63 EVO Turbo)", B: "1.5L I4 (4A91)", C: "1.8L I4 (4B10)",
    D: "2.4L I4 (4B12)", E: "3.0L V6 (6G72)", F: "1.6L I4 (4G18)",
    G: "2.0L I4 (4G63)", N: "Electric (i-MiEV)", T: "1.2L I3 (3A92)",
  },
  "JA4": {
    A: "2.4L I4 (4B12)", B: "2.0L I4 PHEV (4B11)", C: "3.0L V6 (6G72)",
    D: "1.5T I4 (4B40)", E: "2.2L Diesel (4N14)", M: "2.4L I4 PHEV (4N14+motor)",
    W: "2.0L I4 (4B11)", X: "2.0T I4 (4G63T)",
  },
  // Acura USA (JH4* / 19U*)
  "JH4": {
    A: "2.0L I4 (K20Z3)", B: "3.2L V6 (J32A3)", C: "3.5L V6 (J35Y)",
    D: "3.7L V6 (J37A4)", K: "3.5L V6 PHEV Sport Hybrid", L: "2.0T I4 PHEV",
    T: "3.2L V6 (J32A2)",
  },
  "19U": {
    A: "1.5T I4 (L15B7)", B: "2.0T I4 (K20C4)", C: "3.5L V6 (J35Y)",
    D: "2.5L V6 Hybrid", E: "3.0T V6 Biturbo (J30A)",
    Y: "2.0T I4 (K20C1)",
  },
  // Lexus Japan (JTH* / JTJ*)
  JTH: {
    A: "3.5L V6 Hybrid (2GR-FXS)", B: "2.5L I4 Hybrid (A25A-FXS)",
    C: "2.5L I4 Hybrid", D: "3.5L V6 (2GR-FKS)", E: "5.0L V8 (2UR-GSE)",
    G: "3.5L V6 Hybrid (2GR-FXS)", H: "3.4L V6 Biturbo (V35A-FTS)",
    K: "Electric (RZ 450e)", L: "3.5L V6 Hybrid",
  },
  JTJ: {
    B: "4.6L V8 (1UR-FE)", C: "5.7L V8 (3UR-FE)", D: "4.5L V8 Diesel (V8D)",
    E: "3.5L V6 (2GR-FKS)", F: "4.0L V8 (1UR-FSE)", G: "3.4L V6 Biturbo (V35A)",
  },
  // MINI (WMW*)
  WMW: {
    A: "1.5L I3 TwinPower Turbo (B38)", B: "2.0L I4 TwinPower (B48)",
    C: "2.0T I4 JCW (B48A)", D: "2.0L Diesel (B47)",
    E: "Electric (BEV)", N: "1.4L I4 (N14)", S: "2.0T JCW (B48)",
  },
  // Alfa Romeo (ZAR*)
  ZAR: {
    A: "1.4T MultiAir (940A2)", B: "2.0T I4 GME (AR55205)",
    C: "2.2L Diesel MultiJet (AR78410)", D: "2.9L V6 Biturbo QV (AR B.00)",
    F: "1.5L I4 MHEV (AR50403)", G: "2.0T I4 PHEV", K: "2.0T I4 Tonale",
    L: "1.3T PHEV (AR1330)",
  },
  // Rolls-Royce (SCA*)
  SCA: {
    A: "6.6L V12 Biturbo (N74B66)", C: "6.75L V8 Biturbo",
    E: "Electric (Spectre BEV)", F: "6.6L V12 Twin-Turbo",
  },
  // Aston Martin (SCF*)
  SCF: {
    B: "4.0L V8 Biturbo (AMG M177)", C: "5.2L V12 Biturbo (AM28)",
    D: "3.0L I6 PHEV (Valhalla)", E: "5.2L V12 Twin-Turbo (AM29)",
  },
  // Fiat Italy (ZFA*)
  ZFA: {
    A: "1.2L I4 (169A4)", B: "1.4L I4 (312A1)", C: "0.9L I2 TwinAir (312A2)",
    D: "1.3L I4 Multijet Diesel (199A2)", E: "1.6L I4 Multijet",
    F: "1.4L I4 Turbo Abarth (312A1.000)", G: "1.0L I3 FireFly Mild Hybrid",
  },
  // Renault France (VF1*)
  VF1: {
    A: "1.0L I3 TCe 90 (H4D)", B: "1.3L I4 TCe (H5H)", C: "1.5L dCi Diesel (K9K)",
    D: "1.6L I4 (K4M)", E: "1.2L I4 TCe (H5F)", F: "1.8L I4 RS (F4RT)",
    R: "Electric (Zoe / Megane E-Tech)", S: "2.0L I4 (F4R)",
    H: "1.6L I4 Hybrid E-Tech",
  },
  VF2: {
    A: "1.0L I3 TCe 90 (H4D)", B: "1.3L I4 TCe (H5H)", C: "1.5L dCi Diesel (K9K)",
    R: "Electric",
  },
  // Smart Europe (WME*) — ICE/ED era position-8 codes are sparse; EV China is HES
  WME: {
    A: "0.6L I3 (M160)", B: "0.7L I3 (M160)", C: "0.9L I3 Turbo (M281)",
    D: "1.0L I3 (M281)", E: "Electric Drive (ED)", N: "Electric (EQ)",
  },
  HES: {
    A: "Electric (Smart #1 / #3)", B: "Electric dual-motor (Brabus)",
    C: "Electric (Smart #1 / #3)",
  },
  // Suzuki Japan / Hungary
  JS2: {
    A: "1.2L I4 (K12M)", B: "1.4L Boosterjet (K14C)", C: "1.0L Boosterjet",
    D: "1.5L Hybrid",
  },
  TSM: {
    A: "1.0L Boosterjet", B: "1.4L Boosterjet (K14C)", C: "1.2L DualJet Hybrid",
    D: "1.5L DualJet Hybrid",
  },
  // Ford Europe (WF0*) — EU ZZZ often nulls engine; these apply to non-ZZZ VINs
  WF0: {
    A: "1.0L EcoBoost I3", B: "1.5L EcoBoost I3", C: "1.5L EcoBlue Diesel",
    D: "2.0L EcoBlue Diesel", E: "2.0L EcoBoost I4", F: "Electric (Mach-E)",
  },
  // Honda UK Swindon (SHH*)
  SHH: {
    A: "1.6L I4 (R16A)", B: "2.0L I4 (K20)", C: "2.0T Type R (K20C)",
    D: "1.8L I4 (R18A)",
  },
  // Peugeot France (VF3*)
  VF3: {
    A: "1.2L I3 PureTech (HMZ)", B: "1.6L I4 THP", C: "1.5L BlueHDi Diesel",
    D: "2.0L BlueHDi Diesel (DW10C)", E: "Electric (BEV) e-208/e-2008",
    H: "1.6L THP 200 GTi", M: "1.6L BlueHDi 120",
  },
  // Citroën France (VF7*)
  VF7: {
    A: "1.2L I3 PureTech (HMZ)", B: "1.6L I4 THP",
    C: "1.5L BlueHDi Diesel (DV5)", D: "2.0L BlueHDi (DW10F)",
    E: "Electric (ë-C4 / ë-Berlingo)", U: "1.4L I4 (TU3A)",
  },
};

// ── Plant code (position 11, index 10) — manufacturer-specific ────────────────
// Each entry is { city, country } so they can be reported separately.
export interface PlantInfo { city: string; country: string; }

const TESLA_PLANTS: Record<string, PlantInfo> = {
  F: { city: "Fremont, California", country: "United States" },
  A: { city: "Austin, Texas", country: "United States" },
  C: { city: "Shanghai", country: "China" },
  B: { city: "Grünheide (Berlin)", country: "Germany" },
  N: { city: "Reno, Nevada", country: "United States" },
};

// Volvo factory codes (position 11) — shared across all Volvo WMIs.
const VOLVO_PLANTS: Record<string, PlantInfo> = {
  "1": { city: "Torslanda (Gothenburg)", country: "Sweden"  },
  "2": { city: "Ghent",                  country: "Belgium" },
  A: { city: "Gothenburg",               country: "Sweden"  },
  B: { city: "Chengdu",                  country: "China"   },
  G: { city: "Ridgeville, South Carolina", country: "United States" },
  P: { city: "Daqing",                   country: "China"   },
  Z: { city: "Daqing",                   country: "China"   },
};

const PLANT_CODE_MAP: Record<string, Record<string, PlantInfo>> = {
  // Toyota Japan (JT* prefix)
  JT: {
    A: { city: "Aichi",           country: "Japan" },
    B: { city: "Kyushu (Miyata)", country: "Japan" },
    C: { city: "Nagoya",          country: "Japan" },
    E: { city: "Miyagi",          country: "Japan" },
    G: { city: "Tahara, Aichi",   country: "Japan" },
    H: { city: "Hamura",          country: "Japan" },
    K: { city: "Kyushu",          country: "Japan" },
    T: { city: "Tsutsumi",        country: "Japan" },
    Y: { city: "Toyota City",     country: "Japan" },
    Z: { city: "Fujimatsu",       country: "Japan" },
  },
  // Honda Japan (JHM*)
  JHM: {
    A: { city: "Sayama",   country: "Japan" },
    B: { city: "Suzuka",   country: "Japan" },
    S: { city: "Saitama",  country: "Japan" },
  },
  // BMW Germany (WBA*) — plant letters per BMW VIN guides.
  // B = Dingolfing (not Munich); A = Munich; C/E = Regensburg.
  WBA: {
    A: { city: "Munich",          country: "Germany" },
    B: { city: "Dingolfing",      country: "Germany" },
    C: { city: "Regensburg",      country: "Germany" },
    D: { city: "Dingolfing",      country: "Germany" },
    E: { city: "Regensburg",      country: "Germany" },
    F: { city: "Munich",          country: "Germany" },
    G: { city: "Graz",            country: "Austria" },
    K: { city: "Spartanburg, SC", country: "USA" },
    L: { city: "Spartanburg, SC", country: "USA" },
    S: { city: "Spartanburg, SC", country: "USA" },
  },
  WBX: {
    A: { city: "Graz",       country: "Austria" },
    G: { city: "Graz",       country: "Austria" },
  },
  WBS: {
    A: { city: "Munich",     country: "Germany" },
    B: { city: "Dingolfing", country: "Germany" },
  },
  WBY: {
    A: { city: "Leipzig",    country: "Germany" },
    C: { city: "Leipzig",    country: "Germany" },
    E: { city: "Leipzig",    country: "Germany" },
  },
  "5UX": {
    K: { city: "Spartanburg, SC", country: "USA" },
    L: { city: "Spartanburg, SC", country: "USA" },
  },
  // Mercedes-Benz passenger cars (WDD*, and W1K via alias below).
  // Position 11 plant letters per Mercedes/DaimlerAG mapping. Note: on WDC/W1N
  // (SUV) VINs "A" is Tuscaloosa, USA — handled by the separate WDC table.
  WDD: {
    A: { city: "Sindelfingen",   country: "Germany"      },
    B: { city: "Sindelfingen",   country: "Germany"      },
    C: { city: "Sindelfingen",   country: "Germany"      },
    F: { city: "Bremen",         country: "Germany"      },
    G: { city: "Bremen",         country: "Germany"      },
    H: { city: "Bremen",         country: "Germany"      },
    J: { city: "Rastatt",        country: "Germany"      },
    N: { city: "Kecskemét",      country: "Hungary"      },
    R: { city: "East London",    country: "South Africa" },
    S: { city: "East London",    country: "South Africa" },
  },
  WDC: {
    A: { city: "Vance, AL", country: "USA"     },
    C: { city: "Bremen",    country: "Germany" },
    J: { city: "Graz",      country: "Austria" },
  },
  // Audi (WAU*)
  WAU: {
    A: { city: "Ingolstadt",  country: "Germany" },
    B: { city: "Neckarsulm",  country: "Germany" },
    G: { city: "Györ",        country: "Hungary" },
  },
  "WA1": {
    A: { city: "Ingolstadt",  country: "Germany" },
    B: { city: "Neckarsulm",  country: "Germany" },
    G: { city: "Györ",        country: "Hungary" },
  },
  // Volkswagen (WVW*)
  WVW: {
    E: { city: "Emden",             country: "Germany" },
    H: { city: "Hannover",          country: "Germany" },
    K: { city: "Osnabrück",         country: "Germany" },
    M: { city: "Zwickau (Mosel)",   country: "Germany" },
    P: { city: "Puebla",            country: "Mexico"  },
    W: { city: "Wolfsburg",         country: "Germany" },
    Z: { city: "Poznań",            country: "Poland"  },
  },
  // Porsche (WP0* / WP1*)
  WP0: {
    A: { city: "Stuttgart-Zuffenhausen", country: "Germany" },
    C: { city: "Leipzig",                country: "Germany" },
  },
  "WP1": {
    A: { city: "Stuttgart",    country: "Germany"  },
    C: { city: "Leipzig",      country: "Germany"  },
    D: { city: "Bratislava",   country: "Slovakia" },
  },
  // Hyundai Korea (KMH*)
  KMH: {
    A: { city: "Asan",          country: "South Korea" },
    B: { city: "Ulsan Plant 2", country: "South Korea" },
    C: { city: "Ulsan Plant 3", country: "South Korea" },
    D: { city: "Beijing",       country: "China"       },
    E: { city: "Ulsan Plant 4/5", country: "South Korea" },
    M: { city: "Montgomery, AL",  country: "USA"         },
    N: { city: "Nošovice",        country: "Czech Republic" },
    U: { city: "Ulsan",           country: "South Korea" },
    T: { city: "Jeonju",          country: "South Korea" },
  },
  // Hyundai MPV NA / Czech / Alabama
  KM8: {
    U: { city: "Ulsan", country: "South Korea" },
    A: { city: "Asan", country: "South Korea" },
    T: { city: "Jeonju", country: "South Korea" },
  },
  TMA: {
    J: { city: "Nošovice", country: "Czech Republic" },
    U: { city: "Ulsan", country: "South Korea" },
  },
  TMC: {
    J: { city: "Nošovice", country: "Czech Republic" },
  },
  "5NM": {
    A: { city: "Montgomery, AL", country: "USA" },
    H: { city: "Montgomery, AL", country: "USA" },
  },
  "5NP": {
    A: { city: "Montgomery, AL", country: "USA" },
    B: { city: "Montgomery, AL", country: "USA" },
  },
  "5NT": {
    A: { city: "Montgomery, AL", country: "USA" },
  },
  NLH: {
    A: { city: "İzmit", country: "Turkey" },
    L: { city: "İzmit", country: "Turkey" },
  },
  // Kia Korea (KNA* / KND*)
  KNA: {
    A: { city: "Hwaseong",    country: "South Korea" },
    B: { city: "Gwangju",     country: "South Korea" },
    C: { city: "Sohari",      country: "South Korea" },
    H: { city: "Žilina",      country: "Slovakia"    },
    U: { city: "West Point, GA", country: "USA"      },
  },
  KND: {
    A: { city: "Hwaseong",  country: "South Korea" },
    B: { city: "Gwangju",   country: "South Korea" },
    C: { city: "Sohari",    country: "South Korea" },
    E: { city: "Empalme",   country: "Mexico"      },
  },
  // Honda USA (1HG* / 5FN* / 5J8*)
  "1HG": {
    A: { city: "Marysville, OH",   country: "USA"    },
    B: { city: "Lincoln, AL",      country: "USA"    },
    E: { city: "East Liberty, OH", country: "USA"    },
  },
  "5FN": {
    A: { city: "Marysville, OH", country: "USA"    },
    B: { city: "Lincoln, AL",    country: "USA"    },
    C: { city: "Alliston, ON",   country: "Canada" },
  },
  "5J8": {
    Y: { city: "East Liberty, OH", country: "USA" },
    T: { city: "Lincoln, AL",      country: "USA" },
  },
  // Ford USA (1FT* / 1FA*)
  "1FT": {
    E: { city: "Dearborn, MI",    country: "USA"    },
    F: { city: "Kansas City, MO", country: "USA"    },
    K: { city: "Avon Lake, OH",   country: "USA"    },
    R: { city: "Claycomo, MO",    country: "USA"    },
    X: { city: "Cuautitlán",      country: "Mexico" },
  },
  "1FA": {
    G: { city: "Flat Rock, MI",    country: "USA"    },
    H: { city: "Hermosillo",       country: "Mexico" },
  },
  "3FA": { G: { city: "Hermosillo", country: "Mexico" } },
  // Tesla — position 11 factory code
  "5YJ": TESLA_PLANTS,
  "7SA": TESLA_PLANTS,
  "7G2": TESLA_PLANTS,
  SFZ: TESLA_PLANTS,
  LRW: TESLA_PLANTS,
  XP7: TESLA_PLANTS,
  // Volvo — position 11 factory code (NHTSA MY2019+ decoder)
  YV1: VOLVO_PLANTS,
  YV4: VOLVO_PLANTS,
  LYV: VOLVO_PLANTS,
  LVY: VOLVO_PLANTS,
  "7JR": VOLVO_PLANTS,
  "7JD": VOLVO_PLANTS,
  // Land Rover (SAL*): plant codes vary by era — leave null unless a dedicated table is added.
  // Jaguar (SAJ* / SAD*): keep Graz/Nitra only where I-Pace / modern builds are stable.
  SAJ: {
    C: { city: "Graz",            country: "Austria" },
    G: { city: "Graz",            country: "Austria" },
    "1": { city: "Graz",          country: "Austria" },
    "2": { city: "Nitra",         country: "Slovakia" },
  },
  SAD: {
    A: { city: "Graz",     country: "Austria" },
    "1": { city: "Graz",   country: "Austria" },
    "2": { city: "Nitra",  country: "Slovakia" },
  },
  // Chevrolet/GMC USA (1GC* / 1GT*)
  "1GC": {
    K: { city: "Fort Wayne, IN", country: "USA"    },
    P: { city: "Pontiac, MI",    country: "USA"    },
    T: { city: "Silao",          country: "Mexico" },
  },
  "1GT": {
    G: { city: "Pontiac, MI",    country: "USA"    },
    K: { city: "Fort Wayne, IN", country: "USA"    },
    T: { city: "Silao",          country: "Mexico" },
  },
  // ── Nissan Japan (JN1* / JN8*) ───────────────────────────────────────────
  JN1: {
    A: { city: "Oppama, Kanagawa",   country: "Japan" },
    B: { city: "Tochigi",            country: "Japan" },
    C: { city: "Yokohama",           country: "Japan" },
    E: { city: "Kyushu (Kanda)",     country: "Japan" },
    K: { city: "Fukuoka",            country: "Japan" },
  },
  JN8: {
    A: { city: "Oppama, Kanagawa",   country: "Japan" },
    B: { city: "Kyushu (Kanda)",     country: "Japan" },
    E: { city: "Fukuoka",            country: "Japan" },
  },
  // ── Nissan USA (1N4* / 5N1* / 3N1*) ─────────────────────────────────────
  "1N4": {
    A: { city: "Smyrna, TN",       country: "USA"    },
    B: { city: "Canyon, TX",       country: "USA"    },
    M: { city: "Canton, MS",       country: "USA"    },
    Z: { city: "Smyrna, TN",       country: "USA"    },
  },
  "5N1": {
    A: { city: "Smyrna, TN",       country: "USA"    },
    B: { city: "Canton, MS",       country: "USA"    },
    E: { city: "Kyushu",           country: "Japan"  },
  },
  "3N1": {
    A: { city: "Aguascalientes",   country: "Mexico" },
    B: { city: "Cuernavaca",       country: "Mexico" },
  },
  // ── Mazda Japan (JM1* / JM3*) ────────────────────────────────────────────
  JM1: {
    A: { city: "Hiroshima No.1",   country: "Japan" },
    B: { city: "Hofu",             country: "Japan" },
    K: { city: "Hiroshima No.1",   country: "Japan" },
    M: { city: "Hofu",             country: "Japan" },
    "0": { city: "Hiroshima",      country: "Japan" },
    "1": { city: "Hofu",           country: "Japan" },
  },
  JM3: {
    A: { city: "Hiroshima",        country: "Japan" },
    B: { city: "Hofu",             country: "Japan" },
    R: { city: "Hiroshima No.3",   country: "Japan" },
    "0": { city: "Hiroshima",      country: "Japan" },
    "1": { city: "Hofu",           country: "Japan" },
  },
  "3MZ": {
    M: { city: "Salamanca",        country: "Mexico" },
  },
  "3MV": {
    M: { city: "Salamanca",        country: "Mexico" },
  },
  "3MD": {
    M: { city: "Salamanca",        country: "Mexico" },
  },
  "7MM": {
    A: { city: "Huntsville",       country: "United States" },
  },
  // ── Subaru Japan / USA (JF* / 4S*) ──────────────────────────────────────
  JF1: {
    A: { city: "Ōta, Gunma (Main)",   country: "Japan" },
    B: { city: "Ōta, Gunma (Yajima)", country: "Japan" },
    E: { city: "Ōta, Gunma",          country: "Japan" },
    V: { city: "Ōta, Gunma",          country: "Japan" },
  },
  JF2: {
    A: { city: "Ōta, Gunma",          country: "Japan" },
    B: { city: "Ōta, Gunma (Yajima)", country: "Japan" },
    S: { city: "Ōta, Gunma (Main)",   country: "Japan" },
    T: { city: "Ōta, Gunma",          country: "Japan" },
  },
  "4S3": { B: { city: "Lafayette, IN", country: "USA" } },
  "4S4": { B: { city: "Lafayette, IN", country: "USA" } },
  // ── Mitsubishi Japan (JA3* / JA4*) ───────────────────────────────────────
  "JA3": {
    A: { city: "Nagoya, Aichi",       country: "Japan"       },
    C: { city: "Okazaki, Aichi",      country: "Japan"       },
    N: { city: "Nagoya, Aichi",       country: "Japan"       },
    U: { city: "Born",                country: "Netherlands" },
  },
  "JA4": {
    A: { city: "Okazaki, Aichi",      country: "Japan"       },
    C: { city: "Nagoya, Aichi",       country: "Japan"       },
    E: { city: "Mizushima, Okayama",  country: "Japan"       },
    X: { city: "Born",                country: "Netherlands" },
  },
  // ── Lexus Japan (JTH* / JTJ*) ────────────────────────────────────────────
  JTH: {
    A: { city: "Motomachi, Toyota City", country: "Japan" },
    B: { city: "Tsutsumi, Toyota City",  country: "Japan" },
    C: { city: "Toyota City",            country: "Japan" },
    G: { city: "Tahara, Aichi",          country: "Japan" },
    K: { city: "Motomachi (EV line)",    country: "Japan" },
  },
  JTJ: {
    B: { city: "Tahara, Aichi",          country: "Japan" },
    C: { city: "Tahara, Aichi",          country: "Japan" },
    G: { city: "Toyota City",            country: "Japan" },
  },
  // ── Toyota USA (4T* / 5TF* / 5TD* / 2T*) ────────────────────────────────
  "4T1": {
    B: { city: "Georgetown, KY",       country: "USA"   },
    K: { city: "Georgetown, KY",       country: "USA"   },
    N: { city: "Georgetown, KY",       country: "USA"   },
    P: { city: "Princeton, IN",        country: "USA"   },
    R: { city: "Georgetown, KY",       country: "USA"   },
  },
  "5TF": {
    F: { city: "San Antonio, TX",      country: "USA"   },
    R: { city: "Georgetown, KY",       country: "USA"   },
    S: { city: "Princeton, IN",        country: "USA"   },
  },
  "5TD": {
    A: { city: "Princeton, IN",        country: "USA"   },
    K: { city: "Georgetown, KY",       country: "USA"   },
    Y: { city: "Princeton, IN",        country: "USA"   },
  },
  "2T1": {
    A: { city: "Takaoka, Aichi",       country: "Japan" },
    B: { city: "Blue Springs, MS",     country: "USA"   },
    R: { city: "Ohira, Miyagi",        country: "Japan" },
  },
  // Toyota USA Mississippi (5YF* — Corolla)
  "5YF": {
    P: { city: "Blue Springs, MS",     country: "USA"   },
  },
  // ── Acura USA (JH4* / 19U*) ──────────────────────────────────────────────
  "JH4": {
    A: { city: "Marysville, OH",       country: "USA"   },
    K: { city: "Lincoln, AL",          country: "USA"   },
    T: { city: "Marysville, OH",       country: "USA"   },
  },
  "19U": {
    Y: { city: "East Liberty, OH",     country: "USA"   },
    B: { city: "Marysville, OH",       country: "USA"   },
    C: { city: "Lincoln, AL",          country: "USA"   },
  },
  // ── MINI (WMW*) ───────────────────────────────────────────────────────────
  WMW: {
    A: { city: "Oxford",               country: "UK"          },
    B: { city: "Graz",                 country: "Austria"     },
    C: { city: "Born",                 country: "Netherlands" },
    D: { city: "Leipzig",              country: "Germany"     },
  },
  // ── Rolls-Royce (SCA*) ────────────────────────────────────────────────────
  SCA: {
    A: { city: "Goodwood, West Sussex", country: "UK" },
    B: { city: "Goodwood, West Sussex", country: "UK" },
    C: { city: "Goodwood, West Sussex", country: "UK" },
  },
  // ── Aston Martin (SCF*) ───────────────────────────────────────────────────
  SCF: {
    B: { city: "Gaydon, Warwickshire",  country: "UK" },
    C: { city: "Gaydon, Warwickshire",  country: "UK" },
    D: { city: "Gaydon, Warwickshire",  country: "UK" },
    E: { city: "St Athan, Wales",       country: "UK" },
  },
  // ── Alfa Romeo (ZAR*) ─────────────────────────────────────────────────────
  ZAR: {
    A: { city: "Cassino, Frosinone",    country: "Italy" },
    B: { city: "Cassino, Frosinone",    country: "Italy" },
    E: { city: "Cassino, Frosinone",    country: "Italy" },
    J: { city: "Pomigliano d'Arco",     country: "Italy" },
  },
  // ── Škoda (TMB*) ──────────────────────────────────────────────────────────
  TMB: {
    A: { city: "Mladá Boleslav",        country: "Czech Republic" },
    J: { city: "Kvasiny",               country: "Czech Republic" },
    E: { city: "Vrchlabí",              country: "Czech Republic" },
  },
  // ── SEAT (VS6* / VS7*) ────────────────────────────────────────────────────
  VS6: { A: { city: "Martorell, Barcelona", country: "Spain" } },
  VS7: { A: { city: "Martorell, Barcelona", country: "Spain" } },
  // ── Opel / Vauxhall (W0L*) ────────────────────────────────────────────────
  W0L: {
    "1": { city: "Rüsselsheim",           country: "Germany" },
    "2": { city: "Bochum",                country: "Germany" },
    "8": { city: "Ellesmere Port",        country: "United Kingdom" },
    A: { city: "Rüsselsheim",           country: "Germany" },
    B: { city: "Zaragoza",              country: "Spain"   },
    E: { city: "Ellesmere Port",        country: "United Kingdom" },
    G: { city: "Gliwice",               country: "Poland"  },
    L: { city: "Luton",                 country: "United Kingdom" },
    S: { city: "Bochum",                country: "Germany" },
    T: { city: "Rüsselsheim",           country: "Germany" },
    U: { city: "Luton",                 country: "United Kingdom" },
  },
  W0V: {
    L: { city: "Luton",                 country: "United Kingdom" },
    U: { city: "Luton",                 country: "United Kingdom" },
  },
  VXK: {
    "8": { city: "Ellesmere Port",        country: "United Kingdom" },
    E: { city: "Ellesmere Port",        country: "United Kingdom" },
    L: { city: "Luton",                 country: "United Kingdom" },
  },
  // Smart EU / China
  WME: {
    K: { city: "Hambach", country: "France" },
    Y: { city: "Novo Mesto", country: "Slovenia" },
  },
  HES: {
    A: { city: "Xi'an", country: "China" },
    C: { city: "Xi'an", country: "China" },
    P: { city: "Xi'an", country: "China" },
  },
  // Suzuki Hungary
  TSM: {
    A: { city: "Esztergom", country: "Hungary" },
    B: { city: "Esztergom", country: "Hungary" },
    H: { city: "Esztergom", country: "Hungary" },
    M: { city: "Esztergom", country: "Hungary" },
  },
  // Ford Europe (Cologne / Saarlouis / Valencia)
  WF0: {
    A: { city: "Genk", country: "Belgium" },
    B: { city: "Genk", country: "Belgium" },
    C: { city: "Cologne", country: "Germany" },
    G: { city: "Saarlouis", country: "Germany" },
    L: { city: "Valencia", country: "Spain" },
    M: { city: "Valencia", country: "Spain" },
    N: { city: "Craiova", country: "Romania" },
    P: { city: "Cologne", country: "Germany" },
    R: { city: "Cologne", country: "Germany" },
    W: { city: "Valencia", country: "Spain" },
  },
  // Honda UK Swindon
  SHH: {
    A: { city: "Swindon", country: "United Kingdom" },
    C: { city: "Swindon", country: "United Kingdom" },
    E: { city: "Swindon", country: "United Kingdom" },
  },
  // Toyota France (Valenciennes / Onnaing)
  VNK: {
    A: { city: "Onnaing", country: "France" },
    V: { city: "Onnaing", country: "France" },
  },
  // Toyota Turkey (Sakarya / Arifiye)
  NMT: {
    R: { city: "Arifiye", country: "Turkey" },
    "0": { city: "Arifiye", country: "Turkey" },
  },
  // Toyota France (legacy YAR WMI)
  YAR: {
    A: { city: "Valenciennes", country: "France" },
  },
};

// ── Electric-only WMIs (every vehicle from these manufacturers is battery-electric) ──
const ELECTRIC_ONLY_WMI = new Set([
  "5YJ", "7SA", "7G2", "SFZ", // Tesla US (NHTSA) + Roadster-era SFZ
  "LRW", "XP7",               // Tesla Shanghai / Berlin (kept; not in NHTSA WMI list)
  "HJN",                 // NIO / Firefly (WMI registry)
  "L1N", "LMV",          // XPeng
  "LW4", "HLX",          // Li Auto
  "5LA", "50E", "7UU",  // Lucid (legacy 5LA + NHTSA 50E Air / 7UU Gravity)
  "7FC",                 // Rivian
  "LBV",                 // BYD Electric
  "HES",                 // Smart Automobile (#1 / #3 BEV)
  "YSR", "7SY",          // Polestar 3 MPV WMIs (BEV)
  "LNB", "HXM",          // Xiaomi SU7
  "L6T",                 // Zeekr
]);

// ── AWD-standard WMIs (Subaru symmetrical AWD ships on almost every model) ────
const AWD_STANDARD_WMI = new Set(["JF1", "JF2", "4S3", "4S4"]);

// Models whose names strongly imply AWD (matched as substring of decoded model)
const AWD_MODEL_HINTS = [
  "4runner", "land cruiser", "fj cruiser",
  "outback", "forester", "crosstrek", "ascent",
  // Land Rover / Range Rover omitted — some Freelander / Evoque / Discovery Sport are 2WD.
  "f-pace", "e-pace", "i-pace",
  "wrangler", "gladiator",
  "cayenne", "macan", "touareg",
  "x-trail", "patrol",
  "gv80", "gv70", "gv60",
  "rav4 awd", "highlander awd",
];

// Models that are primarily rear-wheel drive
const RWD_MODEL_HINTS = [
  "mustang", "camaro", "challenger",
  "m3", "m4", "m5", "m2",
  "911", "boxster", "cayman",
  "corvette",
  "f-type",
];

// ── Fuel type inference from engine decoded string and WMI ────────────────────
export function inferFuelType(engineDecoded: string | null, wmi: string): string | null {
  const wmi3 = wmi.slice(0, 3).toUpperCase();

  // Known all-electric manufacturers
  if (ELECTRIC_ONLY_WMI.has(wmi3)) return "Electric";

  if (!engineDecoded) return null;
  const e = engineDecoded.toLowerCase();

  if (
    e.includes("bev") ||
    e.includes("electric") && !e.includes("electrohydraulic") && !e.includes("turbo-electric")
  ) return "Electric";
  if (e.includes("phev") || e.includes("plug-in hybrid")) return "Plug-in Hybrid";
  if (e.includes("hybrid") || e.includes("e-power")) return "Hybrid";
  if (
    e.includes("diesel")   || e.includes(" cdi")      || e.includes(" dci")  ||
    e.includes(" tdi")     || e.includes(" hdi")       || e.includes("duramax") ||
    e.includes("crdi")     || e.includes("bluehdi")    || e.includes("powerstroke") ||
    e.includes("skyactiv-d") || e.includes("multijet") || e.includes("cdti")
  ) return "Diesel";

  return "Gasoline";
}

// ── Drive type inference from WMI, decoded model name, and engine description ─
export function inferDriveType(
  wmi: string,
  model: string | null,
  engineDecoded: string | null,
): string | null {
  const wmi3 = wmi.slice(0, 3).toUpperCase();

  // Subaru → always AWD
  if (AWD_STANDARD_WMI.has(wmi3)) return "All-Wheel Drive";

  const m = (model ?? "").toLowerCase();
  const e = (engineDecoded ?? "").toLowerCase();

  // Model-name hints
  for (const hint of AWD_MODEL_HINTS) {
    if (m.includes(hint)) return "All-Wheel Drive";
  }
  for (const hint of RWD_MODEL_HINTS) {
    if (m.includes(hint)) return "Rear-Wheel Drive";
  }

  // Engine string hints (manufacturer-appended badges)
  if (
    e.includes("symmetrical awd") || e.includes("e-awd") ||
    e.includes("4matic")          || e.includes("xdrive") ||
    e.includes("quattro")         || e.includes("sh-awd") ||
    e.includes(" htrac")          || e.includes("4wd")
  ) return "All-Wheel Drive";

  return null;
}

// ── Transmission (position 7, index 6) — select manufacturers ────────────────
// Where not VIN-standardised, inferTransmission() falls back to engine hints.
// BMW does not encode transmission in position 7 (NHTSA marks VDS unused) — excluded below.
const TRANSMISSION_CODE_MAP: Record<string, Record<string, string>> = {
  // VW Group (US-format VDS) position 7:
  WVW: { A: "Manual (5-Speed)", D: "Automatic (DSG/DCT)", M: "Manual (6-Speed)", S: "7-Speed DSG (Dual-Clutch)" },
  WAU: { A: "Manual (6-Speed)", D: "Automatic (S tronic DCT)", M: "Manual", S: "7-Speed S tronic (DCT)" },
  WDD: { A: "Automatic (9G-TRONIC)", D: "Automatic", M: "Manual", S: "AMG SPEEDSHIFT DCT" },
  // Toyota / Lexus:
  JT:  { A: "Automatic", B: "Manual", C: "CVT", D: "eCVT (Hybrid)", E: "Automatic (6-Speed)", F: "Automatic (8-Speed)" },
  JTH: { A: "Automatic", B: "Manual", C: "CVT", D: "eCVT (Hybrid)", E: "Automatic (8-Speed)" },
  // Honda / Acura:
  JHM: { A: "Automatic", B: "Manual", C: "CVT", D: "DCT", M: "Manual", X: "CVT" },
  "1HG": { A: "Automatic", B: "Manual", C: "CVT", M: "Manual" },
  // Hyundai / Kia:
  KMH: { A: "Automatic", B: "Manual", C: "CVT", D: "DCT", E: "Automatic (8-Speed)" },
  KNA: { A: "Automatic", B: "Manual", C: "CVT", D: "DCT" },
  KND: { A: "Automatic", B: "Manual", C: "CVT", D: "DCT" },
  // Nissan:
  JN1: { A: "Automatic", B: "Manual", C: "CVT", D: "Automatic" },
  JN8: { A: "Automatic", B: "Manual", C: "CVT" },
  // Ford US:
  "1FA": { A: "Automatic", B: "Manual", C: "Automatic (10-Speed)", D: "DCT", E: "Automatic (6-Speed)" },
  "1FT": { A: "Automatic", B: "Manual", C: "Automatic (10-Speed)", E: "Automatic (6-Speed)" },
  "1FM": { A: "Automatic", C: "Automatic (10-Speed)", E: "Automatic (6-Speed)" },
};

// Fallback: infer transmission from the decoded engine description
function inferTransmissionFromEngine(engineDecoded: string | null): string | null {
  if (!engineDecoded) return null;
  const e = engineDecoded.toLowerCase();
  if (e.includes("electric") || e.includes(" ev"))  return "Single-Speed Automatic";
  if (e.includes("hybrid") && e.includes("phev"))   return "Automatic (CVT/AT + Electric)";
  if (e.includes("hybrid"))                          return "Automatic (CVT/AT)";
  if (e.includes("diesel") && e.includes("6.6"))     return "10-Speed Automatic";
  if (e.includes("diesel"))                          return "Automatic or Manual";
  if (e.includes("dsg") || e.includes("dct"))        return "Dual-Clutch (DCT/DSG)";
  if (e.includes("cvt"))                             return "CVT";
  return null;
}

export function decodeTransmission(
  vin: string,
  engineDecoded: string | null,
  model?: string | null,
): string | null {
  const upper = vin.toUpperCase();
  const wmi3 = upper.slice(0, 3);

  // BMW does not encode transmission in position 7 (NHTSA marks VDS positions unused).
  if (
    wmi3 === "WBA" || wmi3 === "WBS" || wmi3 === "WBY" || wmi3 === "WBX" || wmi3 === "WB5"
    || wmi3 === "5UX" || wmi3 === "5UM" || wmi3 === "5YM" || wmi3 === "4US"
    || wmi3 === "3MW" || wmi3 === "3MF" || wmi3 === "WAP"
  ) {
    const m = (model ?? decodePremiumEuropeanModel(upper) ?? "").toLowerCase();
    if (/x[1-7]\b|xm\b|\bix\b|i[3478x]|7 series|8 series/.test(m)) return "Automatic";
    const fromEngine = inferTransmissionFromEngine(engineDecoded);
    if (fromEngine) return fromEngine;
    return null;
  }

  if (isVolkswagenVin(upper) || isAudiVin(upper) || isSkodaVin(upper) || isPorscheVin(upper)) {
    const fromModel = inferVagTransmissionFromModel(model ?? decodePremiumEuropeanModel(upper));
    if (fromModel === "Single-Speed Automatic") return fromModel;
  }

  if (hasEuZzzTypeApprovalDescriptor(upper)) {
    const wmi = upper.slice(0, 3);
    if (isVolkswagenVin(upper) || isAudiVin(upper) || isSkodaVin(upper) || wmi.startsWith("VSS")) {
      const fromModel = inferVagTransmissionFromModel(model ?? decodePremiumEuropeanModel(upper));
      if (fromModel) return fromModel;
    }
    if (wmi.startsWith("WDD") || wmi.startsWith("W1K") || wmi.startsWith("WDC") || wmi.startsWith("WDB")) {
      return "Automatic (typically 7–9G-TRONIC)";
    }
    return inferTransmissionFromEngine(engineDecoded);
  }

  const table = lookupByWmi(upper, TRANSMISSION_CODE_MAP);
  const fromCode = table ? (table[upper[6]] ?? null) : null;
  return fromCode ?? inferTransmissionFromEngine(engineDecoded);
}

// ── Engine spec extraction from decoded string ────────────────────────────────
export interface EngineSpecs { displacement: string | null; cylinders: string | null; }

export function extractEngineSpecs(engineDecoded: string | null): EngineSpecs {
  if (!engineDecoded) return { displacement: null, cylinders: null };
  const dispMatch = engineDecoded.match(/(\d+\.\d+)\s*L/i);
  const cylMatch  = engineDecoded.match(/[IVHFivhf](\d+)/);
  return {
    displacement: dispMatch ? dispMatch[1] : null,
    cylinders:    cylMatch  ? cylMatch[1]  : null,
  };
}

// ── Body style (position 6, index 5) — select manufacturers ──────────────────
// Not universally standardized. Only decode for WMIs with known body mapping.
const BODY_CODE_MAP: Record<string, Record<string, string>> = {
  // BMW — position 6 body variant:
  WBA: { E: "Sedan", G: "Gran Coupé", H: "Touring (Wagon)", K: "Convertible", N: "Coupé", P: "Gran Turismo" },
  WBY: { E: "Hatchback/BEV" },
  "5UX": { E: "SUV", G: "Gran Coupé", H: "Touring (Wagon)", K: "Convertible", N: "Coupé" },
  // Audi:
  WAU: {
    A: "Convertible/Cabriolet", B: "Coupé", C: "Cabriolet", D: "Sedan",
    E: "Avant (Wagon)", F: "Allroad", G: "Sportback", H: "Hatchback",
    J: "Sedan (Limousine)", K: "Coupé", L: "Limousine",
  },
  // VW:
  WVW: { A: "2-Door Hatchback", B: "4-Door Sedan", C: "Cabriolet", E: "4-Door Hatchback", G: "3-Door Hatchback", R: "4-Door Sedan" },
  // Hyundai / Genesis / Kia:
  KMH: { A: "2-Door", B: "Sedan", C: "SUV/Crossover", D: "Coupé", E: "Hatchback", F: "Wagon", G: "SUV", H: "Crossover", J: "SUV", N: "SUV" },
  KM8: { A: "SUV", B: "Crossover", C: "SUV", D: "Compact SUV", J: "SUV", N: "SUV" },
  TMA: { A: "Hatchback", B: "SUV", C: "SUV", D: "Hatchback", E: "Hatchback", H: "SUV", J: "SUV" },
  "5NM": { A: "SUV", B: "SUV", C: "SUV", D: "SUV", E: "SUV", F: "SUV", H: "SUV", J: "SUV" },
  "5NP": { A: "Sedan", B: "Sedan", D: "Sedan", E: "Sedan", H: "Sedan" },
  NLH: { A: "Hatchback", B: "Crossover", R: "Hatchback", V: "Hatchback", W: "Crossover" },
  KMT: { A: "Sedan", B: "Sedan", C: "SUV", D: "Coupé", E: "Hatchback", G: "SUV" },
  KMU: { A: "SUV", B: "SUV", C: "SUV", D: "SUV", E: "SUV", G: "SUV", H: "SUV" },
  KNA: { A: "Sedan", B: "Hatchback", C: "SUV", D: "Wagon" },
  KND: { A: "SUV", B: "Hatchback", C: "Minivan", D: "Crossover SUV", E: "Compact SUV" },
  // Toyota / Lexus Japan:
  JT: { A: "Sedan", B: "2-Door", D: "Sedan", E: "SUV/4WD", F: "Wagon/Touring", G: "SUV", H: "Hatchback", J: "SUV", T: "Sedan", U: "Minivan", V: "Wagon" },
  JTH: { A: "Sedan", B: "Coupé", E: "SUV", F: "Wagon", G: "SUV", H: "Hatchback", J: "SUV" },
  // Honda:
  JHM: { A: "Sedan", B: "Coupé", C: "Hatchback", D: "Wagon", E: "SUV", F: "Minivan", G: "Crossover" },
  "1HG": { A: "Sedan", B: "Coupé", C: "Hatchback", D: "Wagon", E: "SUV" },
  "5FN": { A: "Sedan", C: "Hatchback", E: "SUV", F: "Minivan", G: "Crossover" },
  "5J6": { A: "SUV", B: "Crossover", C: "SUV", E: "Crossover" },
  // Nissan / Infiniti:
  JN1: { A: "Sedan", B: "Coupé", C: "Hatchback", D: "Wagon", E: "SUV", F: "Minivan" },
  JN8: { A: "SUV", B: "Crossover", C: "SUV", D: "Minivan", E: "Crossover" },
  // Mercedes:
  WDD: { A: "Coupé", B: "Sedan", C: "Estate (Wagon)", F: "Sedan/Limousine", G: "Convertible", H: "Coupé", J: "Cabriolet", K: "Hatchback" },
  // Ford US:
  "1FA": { A: "Sedan", B: "Coupé", C: "Hatchback", D: "Wagon", E: "Convertible", F: "Hatchback" },
  "1FM": { A: "SUV", B: "Crossover", C: "SUV", D: "Minivan", E: "SUV" },
  "1FT": { A: "Pickup", B: "Pickup", C: "Chassis Cab", D: "Pickup" },
  // GM:
  "1G1": { A: "Sedan", B: "Coupé", C: "Hatchback", D: "Wagon", E: "Convertible" },
  "1GC": { A: "Pickup", B: "Pickup", C: "Chassis Cab" },
  "1GK": { A: "SUV", B: "SUV", C: "SUV" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function lookupByWmi<T>(vin: string, map: Record<string, Record<string, T>>): Record<string, T> | null {
  const w3 = vin.slice(0, 3);
  // W1K = current passenger (was WDD); W1N = current SUV (was WDC).
  const aliases: Record<string, string> = { W1K: "WDD", W1N: "WDC", WA1: "WAU" };
  const wmiKey = isVagWmi(w3) && map.WVW ? "WVW" : (aliases[w3] ?? w3);
  return map[wmiKey] ?? map[vin.slice(0, 2)] ?? null;
}

export function decodeEngineCode(vin: string): string | null {
  const upper = vin.toUpperCase();
  // EU homologation VINs (ZZZ filler) — never map position 8 to engine; it is part of the type code.
  if (hasEuZzzTypeApprovalDescriptor(upper)) return null;
  // Classic BMW ETK FINs — pos.8 is not a reliable engine letter.
  if (isBmwEuroEtkVin(upper)) return null;
  // Ford Europe XX layout — pos.8 is middle of the type block (e.g. GCC), not an engine code.
  if (isFordEuXxLayout(upper)) return null;
  const table = lookupByWmi(upper, ENGINE_CODE_MAP);
  if (!table) return null;
  return table[upper[7]] ?? null;   // position 8 (index 7)
}

export function decodePlantInfo(vin: string): PlantInfo | null {
  const upper = vin.toUpperCase();
  // Ford Europe XX layout — pos.11 is production year, not plant.
  if (isFordEuXxLayout(upper)) return null;
  const table = lookupByWmi(upper, PLANT_CODE_MAP);
  if (!table) return null;
  return table[upper[10]] ?? null;  // position 11 (index 10)
}

export function decodeBodyStyleLocal(vin: string, model?: string | null): string | null {
  const upper = vin.toUpperCase();
  if (hasEuZzzTypeApprovalDescriptor(upper)) {
    return inferBodyStyleFromModel(model ?? decodePremiumEuropeanModel(upper) ?? decodeModelEuropean(upper));
  }
  const table = lookupByWmi(upper, BODY_CODE_MAP);
  if (!table) {
    return inferBodyStyleFromModel(model ?? decodePremiumEuropeanModel(upper));
  }
  return table[upper[5]] ?? inferBodyStyleFromModel(model ?? decodePremiumEuropeanModel(upper));
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface VinDecodeResult {
  vin: string;
  make: string | null;
  model: string | null;
  /** Model year from VIN position 10 (ISO 3779). Null when not encoded (e.g. Euro Mercedes Baumuster). */
  year: number | null;
  country: string | null;
  wmi: string;
  /** Raw character at position 10 (model-year code, or Mercedes steering 1/2 on Baumuster FINs). */
  modelYear: string;
  /**
   * Calendar / manufacture year is not encoded in a standard VIN.
   * Always null — use plant records or registration data for build date.
   */
  manufactureYear: null;
  engineCode: string | null;
  engineDecoded: string | null;
  engineDisplacement: string | null;
  engineCylinders: string | null;
  plantCode: string | null;
  plantCity: string | null;
  plantCountry: string | null;
  bodyStyleDecoded: string | null;
  transmissionDecoded: string | null;
  fuelType: string | null;
  driveType: string | null;
}

export function decodeVin(vin: string): VinDecodeResult {
  const upper = vin.toUpperCase().trim();
  const global = decodeGlobalBrand(upper);
  const wmi = upper.slice(0, 3);
  const wmiMake = lookupWmiMake(upper);
  const brandSpec = resolveBrandVinSpec(upper);
  const make = brandSpec?.make ?? decodeMake(upper, wmiMake, global);
  // Single JLR pass: model + year-gate (avoid a second decodeJlr via decodeModel→premium).
  const jlr = isJlrVin(upper) ? decodeJlr(upper) : null;
  const model = (brandSpec?.model && brandSpec.model.length > 0)
    ? brandSpec.model
    : (jlr?.displayModel ?? decodeModel(upper, global));
  const year = jlr?.year != null
    ? jlr.year
    : resolveVinModelYear(upper, make, model);
  const hyundaiEngine = isHyundaiVin(upper) ? decodeHyundaiEngine(upper, model, year) : null;
  const engineDecoded = brandSpec?.engineDecoded ?? hyundaiEngine ?? decodeEngineCode(upper);
  const specs = extractEngineSpecs(engineDecoded);
  const plantFromBrand = brandSpec?.plantCity
    ? { city: brandSpec.plantCity, country: brandSpec.plantCountry ?? "" }
    : null;
  const plant = plantFromBrand ?? decodePlantInfo(upper);
  const bodyStyleDecoded = brandSpec?.bodyStyle ?? decodeBodyStyleLocal(upper, model);
  let driveType = brandSpec?.driveType ?? inferDriveType(wmi, model, engineDecoded);
  if (!driveType && (isVolkswagenVin(upper) || isAudiVin(upper) || isSkodaVin(upper) || isPorscheVin(upper))) {
    driveType = inferVagDriveFromModel(model);
  }
  // Ford XX: pos.11 is year letter — do not expose it as a plant code.
  const plantCode = isFordEuXxLayout(upper) ? null : (upper[10] ?? null);
  return {
    vin: upper,
    make,
    model,
    year,
    country: decodeCountry(upper),
    wmi,
    modelYear: upper[9] ?? "",
    manufactureYear: null,
    engineCode: engineDecoded ? (upper[7] ?? null) : null,
    engineDecoded,
    engineDisplacement: specs.displacement,
    engineCylinders: specs.cylinders,
    plantCode,
    plantCity: plant?.city ?? null,
    plantCountry: plant?.country ?? null,
    bodyStyleDecoded,
    transmissionDecoded: brandSpec?.transmissionDecoded ?? decodeTransmission(upper, engineDecoded, model),
    fuelType: brandSpec?.fuelType
      ?? inferFuelFromModel(model)
      ?? inferFuelType(engineDecoded, wmi),
    driveType,
  };
}

/** Model-name fuel fallback when WMI/engine leave fuel empty (e.g. EU ZZZ I-Pace). */
function inferFuelFromModel(model: string | null): string | null {
  if (!model) return null;
  const m = model.toLowerCase();
  if (
    m.includes("i-pace")
    || /\bid\.?\s*[34567]\b/.test(m)
    || m.includes("id. buzz")
    || m.includes("enyaq")
    || m.includes("elroq")
    || m.includes("citigoe")
    || m.includes("e-tron")
    || m.includes("taycan")
    || m.includes("macan electric")
  ) {
    return "Electric";
  }
  return null;
}
