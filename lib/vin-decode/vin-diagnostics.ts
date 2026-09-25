import type { VinDecodeResult } from "./vinDecoder";
import { decodeModelEuropean, hasEuZzzTypeApprovalDescriptor } from "./vinDecoder-european";
import { decodePremiumEuropean } from "./european-premium";
import { isVagWmi } from "./vag-wmi";
import { decodeSeatEuHomologation, formatSeatDisplay, SEAT_EU_WMIS } from "./seat-eu";
import { isAudiVin, isPorscheVin, isSkodaVin, isVolkswagenVin } from "./vag-modern";

function isRenaultWmiForDiag(wmi: string): boolean {
  return (
    wmi.startsWith("VF1")
    || wmi.startsWith("VF2")
    || wmi.startsWith("VF6")
    || wmi.startsWith("VF8")
  );
}

export type DiagnosticCategory =
  | "structure"
  | "identity"
  | "powertrain"
  | "body"
  | "drivetrain"
  | "safety"
  | "plant"
  | "options";

export type VinDiagnostic = {
  category: DiagnosticCategory;
  /** i18n key under free_decoder_diag_* */
  labelKey: string;
  value: string;
  detail?: string | null;
};

function push(
  out: VinDiagnostic[],
  category: DiagnosticCategory,
  labelKey: string,
  value: string | null | undefined,
  detail?: string | null,
): void {
  const v = value?.trim();
  if (!v) return;
  out.push({ category, labelKey, value: v, detail: detail?.trim() || null });
}

function wmiFamily(wmi: string): string | null {
  const map: Record<string, string> = {
    WBA: "BMW", WBS: "BMW M", WBY: "BMW i", WBR: "BMW",
    "5UX": "BMW USA", "4US": "BMW USA",
    WDD: "Mercedes-Benz", WDB: "Mercedes-Benz", WDC: "Mercedes-Benz", WDF: "Mercedes-Benz",
    W1K: "Mercedes-Benz", W1N: "Mercedes-Benz", "4JG": "Mercedes-Benz USA",
    WAU: "Audi", WA1: "Audi", WUA: "Audi Sport", TRU: "Audi",
    WVW: "Volkswagen", WVG: "Volkswagen", WV1: "VW Commercial", WV2: "VW Commercial",
    WV3: "VW Commercial", "1VW": "Volkswagen USA", "1V2": "Volkswagen USA",
    "3VW": "Volkswagen Mexico", "3VV": "Volkswagen Mexico",
    WP0: "Porsche", WP1: "Porsche",
    TMB: "Škoda", TM8: "Škoda", TMP: "Škoda", TMS: "Škoda",
    JHM: "Honda Japan", "1HG": "Honda USA", "5FN": "Honda USA", "5J6": "Honda USA",
    JT: "Toyota Japan", "4T1": "Toyota USA", "5TD": "Toyota USA", "5TF": "Toyota USA", "2T2": "Lexus",
    KMH: "Hyundai", KNA: "Kia", KND: "Kia", KMT: "Genesis", KMU: "Genesis",
    "5XX": "Kia Georgia", "5XY": "Kia Georgia", "3KP": "Kia Mexico", "3KM": "Kia Mexico",
    "5VF": "VinFast", SBM: "McLaren", VFA: "Alpine", W1A: "Smart",
    YS3: "Saab", YSR: "Polestar", "7SY": "Polestar", YSM: "Polestar",
    "50E": "Lucid", "7UU": "Lucid", "5LA": "Lucid",
    "1FT": "Ford Truck", "1FA": "Ford", "3FA": "Ford",
    "1GC": "Chevrolet", "1G1": "Chevrolet",
    "5YJ": "Tesla", "7SA": "Tesla", "7G2": "Tesla", SFZ: "Tesla",
    LRW: "Tesla Shanghai", XP7: "Tesla Berlin",
    "5UM": "BMW", "5YM": "BMW USA", "3MW": "BMW Mexico", "3MF": "BMW",
    WBX: "BMW", WAP: "BMW",
    "55S": "Mercedes-Benz USA",
    JN1: "Nissan", "1N4": "Nissan USA",
    JF1: "Subaru", "4S3": "Subaru USA",
    YV1: "Volvo", SAL: "Land Rover", SAJ: "Jaguar", SAD: "Jaguar",
  };
  return map[wmi.slice(0, 3)] ?? map[wmi.slice(0, 2)] ?? null;
}

// ── BMW ───────────────────────────────────────────────────────────────────────
const BMW_SERIES: Record<string, string> = {
  "1": "1 Series", "2": "2 Series", "3": "3 Series", "4": "4 Series",
  "5": "5 Series", "6": "6 Series", "7": "7 Series", "8": "8 Series",
  X: "X Series (SAV/SAC)", Z: "Z Series Roadster/Coupé", M: "M Performance / M Division",
};

const BMW_MODEL_5: Record<string, string> = {
  // 4 Series (F32/F33/F36 — ETK type codes at VDS 4–5, e.g. 3V71 = F33 Cabrio)
  WBA3V: "4 Series Convertible (F33)", WBA3T: "4 Series Convertible (F33)", WBA3U: "4 Series Convertible (F33)",
  WBA3N: "4 Series Coupé (F32)", WBA3R: "4 Series Coupé (F32)", WBA3P: "4 Series Coupé (F32)", WBA3S: "4 Series Coupé (F32)",
  WBA4B: "4 Series Gran Coupé (F36)", WBA4D: "4 Series Gran Coupé (F36)",
  "5UX3V": "4 Series Convertible (US F33)", "5UX3N": "4 Series Coupé (US F32)", "5UX3R": "4 Series Coupé (US F32)",
  // 3 Series
  WBA3V1: "3 Series Sedan (F30)", WBA3W: "3 Series (G20/G21)",
  WBA3C: "3 Series Coupé (E92)", WBA3B: "3 Series Convertible",
  "5UX3W": "3 Series (US G20)",
  // 5 Series
  WBA5E: "5 Series (G30/G31)", WBA5J: "5 Series (F10/F11)",
  WBAXA: "5 Series (F10/F11 ETK XA)", WBAJC: "5 Series (G30/G31 ETK JC)",
  WBA7G: "7 Series (G11 LCI)", WBA7C: "7 Series (G11/G12)", WBA7L: "7 Series (G70)",
  "5UX5J": "5 Series (US F10)", "5UX5E": "5 Series (US G30)",
  // X models (digit after X — not WBAXA* F10 ETK)
  WBAX3: "X3 (G01)", WBAX4: "X4 (G02)", WBAX5: "X5 (G05)", WBAX6: "X6 (G06)", WBAX7: "X7 (G07)",
  "5UXWX": "X3 (US)", "5UXKR": "X5 (US)", "5UXKS": "X6 (US)",
  // 1 / 2 / 4 (G-gen)
  WBA1C: "1 Series (F20)", WBA2A: "2 Series Active Tourer", WBA2T: "2 Series Coupé (G42)",
  WBA4S: "4 Series Coupé (G22)", WBA4C: "4 Series Gran Coupé (G26)", WBA4A: "4 Series Convertible (G23)",
};

const BMW_RESTRAINT: Record<string, string> = {
  "0": "Manual belts (front)", "1": "Manual belts + front airbags",
  "2": "Manual belts + front/side airbags", "3": "Manual belts + front/side/curtain airbags",
  "4": "Automatic belts + front airbags", "5": "Automatic belts + front/side airbags",
  "6": "Automatic belts + full airbag set", "7": "Advanced restraint (BMW standard)",
  "8": "Advanced restraint + knee airbag", "9": "Advanced restraint (EU spec)",
};

function bmwDiagnostics(vin: string, base: VinDecodeResult, out: VinDiagnostic[]): void {
  const vds = vin.slice(3, 8);
  const premium = decodePremiumEuropean(vin);

  if (premium) {
    push(out, "identity", "series", premium.model);
    if (premium.chassis) push(out, "identity", "chassis_platform", premium.chassis);
    push(out, "identity", "model_line", premium.displayModel);
  } else {
    const series = BMW_SERIES[vin[3]] ?? null;
    push(out, "identity", "series", series);
    for (const len of [5, 4]) {
      const hit = BMW_MODEL_5[vin.slice(0, len)];
      if (hit) {
        push(out, "identity", "model_line", hit);
        break;
      }
    }
  }

  push(out, "identity", "vds_descriptor", vds, "Positions 4–8 (vehicle descriptor section)");
  push(out, "safety", "restraint_system", BMW_RESTRAINT[vin[6]] ?? `Restraint code ${vin[6]}`);

  const body = base.bodyStyleDecoded;
  if (body) push(out, "body", "body_variant", body);

  if (vin[7] === "D" || vin[7] === "E") {
    push(out, "powertrain", "engine_family", "Diesel (B47/B57 family)");
  } else if (vin[7] === "S" || vin[7] === "U") {
    push(out, "options", "electrification", vin[7] === "S" ? "Battery Electric (BEV)" : "Plug-in Hybrid (PHEV)");
  }

  if (vin.startsWith("WBS") || vin[3] === "M") {
    push(out, "options", "performance_line", "M Performance / Motorsport");
  }
  if (vin.startsWith("WBY")) {
    push(out, "options", "electrification", "BMW i electric sub-brand");
  }
}

// ── Mercedes-Benz ─────────────────────────────────────────────────────────────
const MERCEDES_CHASSIS: Record<string, string> = {
  WDD177: "A-Class (W177)", WDD118: "CLA (C118)", WDD205: "C-Class (W205)", WDD206: "C-Class (W206)",
  WDD204: "C-Class (W204)", WDD203: "C-Class (W203)", WDD202: "C-Class (W202)",
  WDD213: "E-Class (W213)", WDD214: "E-Class (W214)", WDD212: "E-Class (W212)", WDD211: "E-Class (W211)", WDD210: "E-Class (W210)",
  WDD222: "S-Class (W222)", WDD223: "S-Class (W223)", WDD221: "S-Class (W221)", WDD220: "S-Class (W220)",
  WDD253: "GLC (X253)", WDD254: "GLC (X254)", WDD166: "ML / GLE (W166)", WDD167: "GLE / GLS (W167/X167)",
  WDD247: "GLA / GLB (H247/X247)", WDD463: "G-Class (W463/W465)", WDD290: "EQS (V297)",
  WDD243: "EQA / EQB (H243/X243)", WDD238: "E-Class Coupé/Cabrio (C238)",
  WDD296: "EQS SUV (X296)", WDD236: "CLE (C236)", WDD293: "EQC (N293)",
  WDD245: "B-Class (W245)", WDD163: "ML-Class (W163)", WDD164: "ML-Class (W164)",
  WDD251: "GLK (X204)",
  WDD192: "AMG GT (C192)", WDD197: "SL (R232)",
};

const MERCEDES_RESTRAINT: Record<string, string> = {
  A: "Front airbags + belt pretensioners", B: "Front/side airbags", C: "Full airbag package",
  D: "Full airbags + active head restraints", E: "PRE-SAFE + full airbags",
  F: "PRE-SAFE + rear side airbags", G: "Advanced PRE-SAFE system",
};

function mercedesDiagnostics(vin: string, base: VinDecodeResult, out: VinDiagnostic[]): void {
  const premium = decodePremiumEuropean(vin);
  if (premium) {
    push(out, "identity", "model_line", premium.displayModel);
    if (premium.chassis) push(out, "identity", "chassis_platform", premium.chassis);
  } else {
    for (const len of [6, 5, 4]) {
      const chassis = MERCEDES_CHASSIS[vin.slice(0, len)];
      if (chassis) {
        push(out, "identity", "chassis_platform", chassis);
        break;
      }
    }
  }

  push(out, "identity", "vds_descriptor", vin.slice(3, 8));
  push(out, "safety", "restraint_system", MERCEDES_RESTRAINT[vin[6]] ?? `Restraint code ${vin[6]}`);

  if (vin[7] === "N" || vin[7] === "M") {
    push(out, "options", "electrification", "EQ Electric / Hybrid variant");
  }
  if (vin[7] === "K" || vin[7] === "J") {
    push(out, "options", "performance_line", "AMG performance engine");
  }

  const body = base.bodyStyleDecoded;
  if (body) push(out, "body", "body_style", body);
}

// ── VAG (VW / Audi / Škoda / SEAT) ───────────────────────────────────────────
function vagDiagnostics(vin: string, base: VinDecodeResult, out: VinDiagnostic[]): void {
  const premium = decodePremiumEuropean(vin);
  if (premium) {
    push(out, "identity", "model_line", premium.displayModel);
    if (premium.chassis) push(out, "identity", "chassis_platform", premium.chassis);
  } else if (vin.slice(3, 6) === "ZZZ") {
    push(out, "identity", "model_line", base.model);
    const euModel = decodeModelEuropean(vin);
    if (euModel) push(out, "identity", "model_code", euModel, "EU VIN model/type approval code (pos. 7–9)");
    push(out, "identity", "vds_format", "European VAG format (ZZZ filler in positions 4–6)");
  } else {
    push(out, "identity", "model_line", base.model);
    push(out, "identity", "vds_descriptor", vin.slice(3, 8));
  }

  const wmi = vin.slice(0, 3);
  if ((wmi.startsWith("WAU") || wmi.startsWith("TRU")) && !hasEuZzzTypeApprovalDescriptor(vin)) {
    push(out, "options", "drivetrain_badge", vin[7] === "D" ? "quattro / TDI diesel line" : null);
    if (vin[7] === "S") push(out, "options", "electrification", "e-tron electric");
  }
  if (isVagWmi(wmi)) {
    if (vin[7] === "M") push(out, "options", "electrification", "eTSI mild hybrid / BlueMotion");
  }
  if (base.fuelType === "Electric") {
    push(out, "options", "electrification", "Battery Electric Vehicle (BEV)");
  }
  if (base.bodyStyleDecoded) push(out, "body", "body_style", base.bodyStyleDecoded);
}

// ── Toyota / Lexus ────────────────────────────────────────────────────────────
const TOYOTA_RESTRAINT: Record<string, string> = {
  "1": "Driver airbag", "2": "Driver + passenger airbags",
  "3": "Front airbags + front side", "4": "Front/side + curtain airbags",
  "5": "Full SRS airbag system", "6": "SRS + knee airbag", "7": "Toyota Safety Sense era",
};

const TOYOTA_LINE_4: Record<string, string> = {
  JTDB: "Corolla", JTDK: "Yaris / Yaris Cross", JTMC: "RAV4", JTMW: "RAV4 Hybrid",
  JTNB: "Camry", JTDW: "Prius", JTMA: "Highlander / Kluger",
  "4T1B": "Camry (US)", "4T3B": "RAV4 (US)", "4T4B": "RAV4 (US)",
  "5TDY": "Sienna", "5TFD": "Tundra", "5TFW": "Tundra CrewMax",
  "5YFS": "Corolla (US, Mississippi)", "5YFB": "Corolla (US, Mississippi)",
  "5YFT": "Corolla (US, Mississippi)",
  "2T2B": "RX (Lexus)", "2T3B": "NX (Lexus)",
};

function toyotaDiagnostics(vin: string, base: VinDecodeResult, out: VinDiagnostic[]): void {
  for (const len of [4, 5]) {
    const line = TOYOTA_LINE_4[vin.slice(0, len)];
    if (line) {
      push(out, "identity", "model_line", line);
      break;
    }
  }
  push(out, "safety", "restraint_system", TOYOTA_RESTRAINT[vin[6]] ?? `SRS code ${vin[6]}`);
  if (base.engineDecoded?.toLowerCase().includes("hybrid")) {
    push(out, "options", "electrification", "Hybrid (Toyota HSD / Lexus Hybrid Drive)");
  }
  if (base.model?.toLowerCase().includes("prime")) {
    push(out, "options", "electrification", "Plug-in Hybrid (Prime)");
  }
}

// ── Honda / Acura ─────────────────────────────────────────────────────────────
const HONDA_LINE: Record<string, string> = {
  "1HG": "US market sedan/coupé", "5FN": "US market (Ohio)", "5J6": "US market SUV (Alabama)",
  JHMC: "Civic / Accord (Japan)", JHM: "Accord / Civic export",
  "19U": "Acura (US)", JH4: "Acura NSX / performance",
};

function hondaDiagnostics(vin: string, base: VinDecodeResult, out: VinDiagnostic[]): void {
  const prefix = vin.slice(0, 3);
  push(out, "identity", "market_line", HONDA_LINE[prefix] ?? null);
  push(out, "identity", "vds_descriptor", vin.slice(3, 8));

  if (vin[7] === "A" || vin[7] === "C") {
    push(out, "powertrain", "engine_family", "VTEC Turbo (L15B family)");
  }
  if (base.model?.toLowerCase().includes("type r")) {
    push(out, "options", "performance_line", "Type R performance trim");
  }
}

// ── Hyundai / Kia / Genesis ───────────────────────────────────────────────────
const HYUNDAI_TRIM_5: Record<string, string> = {
  KMHNU: "Tucson (NX4)", KMHK38: "Tucson (NX4)", KMHK48: "Tucson (TL)",
  KMHN38: "Tucson (NX4)", KMHS28: "Tucson (NX4)", KMHS48: "Tucson (TL)",
  KM8J3: "Tucson (NX4 US)", KM8J2: "Tucson (NX4 US)", KM8JC: "Tucson (NX4 US)",
  KM8JD: "Tucson", KM8JE: "Tucson", "5NMJB": "Tucson (NX4 US)", "5NMJC": "Tucson (NX4 US)",
  TMAJB: "Tucson (NX4 EU)", TMAJC: "Tucson (NX4 EU)", TMAJD: "Tucson (NX4 EU)",
  TMAJE: "Tucson (NX4 EU)", TMAH38: "Tucson (NX4 EU)",
  KMHL1: "Sonata (DN8)", KMHL2: "Sonata (DN8) / Elantra", KMHM3: "IONIQ 6",
  KMHD2: "Elantra (CN7)", KMHD6: "Elantra (AD)", KMHE1: "Sonata", KMHE2: "Sonata", KMHE3: "Sonata",
  // Note: IONIQ 5 is KMHL341 / KMHLW4 — too long for this 4–5 char trim table
  KMHR58: "Kona (OS)", KMHR68: "Kona (SX2)", KMHK58: "Kona (OS)", KMHK25: "Santa Fe (TM)",
  KM8S3: "Santa Fe", KM8R3: "Santa Cruz", KMHS38: "Santa Fe Sport",
  NLHBW: "Bayon", NLHBR: "i20",
  KNDJ: "Sportage (NQ5)", KNDN: "Sportage", KNAG: "K5 / Optima", KNAF: "Forte / Cerato",
  KMTG: "GV70", KMTN: "GV60 EV", KMTS: "G80",
};

function koreanDiagnostics(vin: string, base: VinDecodeResult, out: VinDiagnostic[]): void {
  for (const len of [5, 4]) {
    const trim = HYUNDAI_TRIM_5[vin.slice(0, len)];
    if (trim) {
      push(out, "identity", "model_line", trim);
      break;
    }
  }
  push(out, "identity", "vds_descriptor", vin.slice(3, 8));

  const eng = vin[7];
  if (["L", "N", "S", "T", "W"].includes(eng)) {
    push(out, "options", "electrification", "Electric vehicle (E-GMP platform)");
  }
  if (["H", "R"].includes(eng)) {
    push(out, "options", "electrification", "Hybrid / HEV");
  }
  if (["K", "P"].includes(eng)) {
    push(out, "options", "performance_line", "Turbo / N-Line / GT performance");
  }
  if (base.bodyStyleDecoded) push(out, "body", "body_style", base.bodyStyleDecoded);
}

// ── Ford / GM ─────────────────────────────────────────────────────────────────
const FORD_LINE: Record<string, string> = {
  "1FT": "F-Series truck", "1FA": "Mustang / passenger car", "1FM": "SUV / Explorer",
  "3FA": "Fusion / sedan", "1FD": "Super Duty",
};

const GM_LINE: Record<string, string> = {
  "1GC": "Silverado / Sierra", "1G1": "Malibu / passenger", "1G6": "Cadillac",
  "1GK": "Yukon / Tahoe", "3GN": "Crossover SUV",
};

function detroitDiagnostics(vin: string, base: VinDecodeResult, out: VinDiagnostic[]): void {
  const p3 = vin.slice(0, 3);
  push(out, "identity", "product_line", FORD_LINE[p3] ?? GM_LINE[p3] ?? null);
  push(out, "identity", "vds_descriptor", vin.slice(3, 8));

  if (vin[7] === "G" || vin[7] === "F") {
    push(out, "options", "performance_line", "V8 performance / Raptor / SS trim class");
  }
  if (vin[7] === "E" || vin[7] === "K") {
    push(out, "options", "electrification", "EcoBoost turbo / hybrid assist");
  }
}

// ── Tesla ─────────────────────────────────────────────────────────────────────
function teslaDiagnostics(vin: string, out: VinDiagnostic[]): void {
  const modelChar = vin[3];
  const models: Record<string, string> = {
    S: "Model S", "3": "Model 3", X: "Model X", Y: "Model Y",
  };
  push(out, "identity", "model_line", models[modelChar] ?? null);

  const battery: Record<string, string> = {
    E: "Long Range battery pack", F: "Standard Range pack", P: "Performance dual-motor",
    R: "Plaid tri-motor", D: "Standard / RWD",
  };
  push(out, "options", "battery_pack", battery[vin[7]] ?? null);
  push(out, "options", "electrification", "All-electric (BEV)");
  push(out, "plant", "assembly_hint", vin[10] === "F" ? "Fremont, California" : vin[10] === "C" ? "Austin, Texas" : null);
}

// ── Nissan / Subaru ───────────────────────────────────────────────────────────
function nissanDiagnostics(vin: string, base: VinDecodeResult, out: VinDiagnostic[]): void {
  push(out, "identity", "vds_descriptor", vin.slice(3, 8));
  if (vin[7] === "H" || vin[7] === "Z") {
    push(out, "options", "electrification", vin[7] === "H" ? "e-POWER / Leaf EV" : "Hybrid");
  }
  if (base.model?.toLowerCase().includes("nismo")) {
    push(out, "options", "performance_line", "NISMO performance");
  }
}

function subaruDiagnostics(vin: string, out: VinDiagnostic[]): void {
  push(out, "drivetrain", "drivetrain_standard", "Symmetrical All-Wheel Drive (AWD)");
  push(out, "identity", "vds_descriptor", vin.slice(3, 8));
  if (vin[7] === "Z") push(out, "options", "electrification", "Hybrid (e-Boxer)");
}

// ── Generic structure (always) ────────────────────────────────────────────────
function structureDiagnostics(vin: string, base: VinDecodeResult, out: VinDiagnostic[]): void {
  push(out, "structure", "wmi", base.wmi, "World Manufacturer Identifier (positions 1–3)");
  push(out, "structure", "vds", vin.slice(3, 8), "Vehicle Descriptor Section (positions 4–8)");
  push(out, "structure", "vis", vin.slice(9), "Vehicle Identifier Section (positions 10–17)");
  push(out, "structure", "serial_number", vin.slice(11), "Production sequence (positions 12–17)");
  push(out, "structure", "model_year_code", base.modelYear, `Encoded year digit (position 10)`);
  push(out, "structure", "check_digit", vin[8], "ISO 3779 check digit (position 9)");
  push(out, "structure", "plant_code", base.plantCode, "Assembly plant code (position 11)");

  const family = wmiFamily(base.wmi);
  if (family) push(out, "identity", "manufacturer_family", family);
}

function porscheDiagnostics(vin: string, base: VinDecodeResult, out: VinDiagnostic[]): void {
  const premium = decodePremiumEuropean(vin);
  if (premium) {
    push(out, "identity", "model_line", premium.displayModel);
    if (premium.chassis) push(out, "identity", "chassis_platform", premium.chassis);
  } else {
    push(out, "identity", "vds_descriptor", vin.slice(3, 8));
  }
  if (base.engineDecoded) push(out, "powertrain", "engine_from_vin", base.engineDecoded);
  if (vin[7] === "T") push(out, "options", "electrification", "Taycan / electric");
  if (base.bodyStyleDecoded) push(out, "body", "body_style", base.bodyStyleDecoded);
}

function routeBrandDiagnostics(vin: string, base: VinDecodeResult, out: VinDiagnostic[]): void {
  const wmi = base.wmi.toUpperCase();
  const make = (base.make ?? "").toLowerCase();

  if (wmi.startsWith("WBA") || wmi.startsWith("WBS") || wmi.startsWith("WBY") || wmi.startsWith("5UX") || wmi.startsWith("4US") || make.includes("bmw")) {
    bmwDiagnostics(vin, base, out);
    return;
  }
  if (
    wmi.startsWith("WDD") || wmi.startsWith("WDB") || wmi.startsWith("WDC")
    || wmi.startsWith("W1K") || wmi === "W1N" || wmi.startsWith("4JG")
    || make.includes("mercedes")
  ) {
    mercedesDiagnostics(vin, base, out);
    return;
  }
  if (isAudiVin(vin)) {
    vagDiagnostics(vin, base, out);
    return;
  }
  if (isPorscheVin(vin) || make.includes("porsche")) {
    porscheDiagnostics(vin, base, out);
    return;
  }
  if (isVolkswagenVin(vin) || make.includes("volkswagen")) {
    vagDiagnostics(vin, base, out);
    return;
  }
  if (wmi.startsWith("JT") || wmi.startsWith("4T") || wmi.startsWith("5T") || wmi.startsWith("2T") || make.includes("toyota") || make.includes("lexus")) {
    toyotaDiagnostics(vin, base, out);
    return;
  }
  if (wmi.startsWith("1HG") || wmi.startsWith("5FN") || wmi.startsWith("5J6") || wmi.startsWith("JHM") || wmi.startsWith("JH4") || make.includes("honda") || make.includes("acura")) {
    hondaDiagnostics(vin, base, out);
    return;
  }
  if (wmi.startsWith("KM") || make.includes("hyundai") || make.includes("kia") || make.includes("genesis")) {
    koreanDiagnostics(vin, base, out);
    return;
  }
  if (wmi.startsWith("1F") || wmi.startsWith("3F") || wmi.startsWith("1G") || wmi.startsWith("3G") || wmi.startsWith("2F") || wmi.startsWith("2G")) {
    detroitDiagnostics(vin, base, out);
    return;
  }
  // EU Ford (WF0/WF1/…) must not inherit Detroit US heuristics via make name alone.
  if (make.includes("chevrolet") || make.includes("gmc") || make.includes("cadillac")) {
    detroitDiagnostics(vin, base, out);
    return;
  }
  if (wmi.startsWith("5YJ") || wmi.startsWith("7SA") || make.includes("tesla")) {
    teslaDiagnostics(vin, out);
    return;
  }
  if (wmi.startsWith("JN") || wmi.startsWith("1N") || wmi.startsWith("3N") || wmi.startsWith("5N") || make.includes("nissan") || make.includes("infiniti")) {
    nissanDiagnostics(vin, base, out);
    return;
  }
  if (wmi.startsWith("JF") || wmi.startsWith("4S") || make.includes("subaru")) {
    subaruDiagnostics(vin, out);
    return;
  }
  if (isSkodaVin(vin) || make.includes("škoda") || make.includes("skoda")) {
    vagDiagnostics(vin, base, out);
    push(out, "identity", "skoda_type_code", vin.slice(6, 8), "Škoda model/type code (pos. 7–8)");
    return;
  }
  if (isRenaultWmiForDiag(wmi) || make.includes("renault")) {
    push(out, "identity", "model_line", base.model);
    if (vin.length >= 5) {
      push(out, "identity", "renault_vds", vin.slice(3, 5), "Renault VDS prefix (pos. 4–5)");
    }
    return;
  }
  if (wmi.startsWith("ZFA") || wmi.startsWith("ZFB") || make.includes("fiat")) {
    push(out, "identity", "model_line", base.model);
    if (vin.length >= 6) {
      push(out, "identity", "fiat_platform", vin.slice(3, 6), "Fiat internal platform code (pos. 4–6)");
    }
    return;
  }
  if (wmi.startsWith("VF3") || make.includes("peugeot")) {
    push(out, "identity", "model_line", base.model);
    return;
  }
  if (wmi.startsWith("VSS") || (SEAT_EU_WMIS as readonly string[]).includes(wmi) || make.includes("seat")) {
    const seat = decodeSeatEuHomologation(vin);
    if (seat) {
      push(out, "identity", "model_line", formatSeatDisplay(seat));
      if (seat.platform) {
        push(out, "identity", "platform_code", seat.platform, "SEAT type-approval / platform code (pos. 7–8)");
      }
      if (seat.years) {
        push(out, "identity", "model_years", seat.years, "Approx. production years for this platform");
      }
    }
    vagDiagnostics(vin, base, out);
    return;
  }

  // Generic fallback for other brands
  push(out, "identity", "vds_descriptor", vin.slice(3, 8), "Vehicle descriptor (positions 4–8)");
  if (base.bodyStyleDecoded) push(out, "body", "body_style", base.bodyStyleDecoded);
  if (base.transmissionDecoded) push(out, "drivetrain", "transmission", base.transmissionDecoded);
}

/** Dedupe diagnostics with same labelKey + value */
function dedupeDiagnostics(items: VinDiagnostic[]): VinDiagnostic[] {
  const seen = new Set<string>();
  const out: VinDiagnostic[] = [];
  for (const item of items) {
    const key = `${item.category}|${item.labelKey}|${item.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function decodeVinDiagnostics(vin: string, base: VinDecodeResult): VinDiagnostic[] {
  const upper = vin.toUpperCase().trim();
  if (upper.length !== 17) return [];

  const out: VinDiagnostic[] = [];
  structureDiagnostics(upper, base, out);
  routeBrandDiagnostics(upper, base, out);

  if (base.engineDecoded) {
    push(out, "powertrain", "engine_from_vin", base.engineDecoded, `Position 8 code: ${base.engineCode ?? "?"}`);
  }
  if (base.fuelType) push(out, "powertrain", "fuel_type", base.fuelType);
  if (base.driveType) push(out, "drivetrain", "drive_type", base.driveType);
  if (base.plantCity || base.plantCountry) {
    push(out, "plant", "assembly_plant", [base.plantCity, base.plantCountry].filter(Boolean).join(", "));
  }

  return dedupeDiagnostics(out);
}
