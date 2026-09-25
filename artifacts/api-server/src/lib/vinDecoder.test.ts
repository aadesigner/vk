/**
 * VIN Decoder QA
 *
 * Pure unit tests — no DB, no network. Every MODEL_MAP_4 entry is verified
 * with a padded VIN so a wrong mapping is caught immediately at test time.
 *
 * Regression suite included: KMHSW81UBGU554169 must decode as Santa Fe Sport.
 */

import { describe, it, expect } from "vitest";
import {
  decodeVin,
  decodeEngineCode,
  decodeBodyStyleLocal,
  decodeTransmission,
  extractEngineSpecs,
  decodePlantInfo,
  isNorthAmericanMarketVin,
  resolveCheckDigitValid,
} from "@workspace/vin-decode";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Pad a VIN prefix to exactly 17 chars so the decoder can slice safely. */
function pad(prefix: string): string {
  return (prefix + "AAAAAAAAAAAAAAAAA").slice(0, 17).toUpperCase();
}

/**
 * Build a 17-char VIN with yearChar at index 9 (position 10 = model year).
 * Base: "1HGCM8263" (9 chars, indices 0-8) + yearChar at index 9 + "A004352".
 */
function withYear(yearChar: string): string {
  return ("1HGCM8263" + yearChar + "A004352").toUpperCase();
}

// ── Make decoding ─────────────────────────────────────────────────────────────

describe("make decoding", () => {
  const cases: [string, string][] = [
    // Japan
    ["JHM", "Honda"],
    ["JTM", "Toyota"],
    // Germany
    ["WBA", "BMW"],
    ["WBS", "BMW M"],
    ["WDD", "Mercedes-Benz"],
    ["WAU", "Audi"],
    ["WVW", "Volkswagen"],
    ["WP0", "Porsche"],
    // Korea
    ["KMH", "Hyundai"],
    ["KM8", "Hyundai"],
    ["KNA", "Kia"],
    ["KND", "Kia"],
    // USA
    ["1HG", "Honda"],
    ["1N4", "Nissan"],
    ["1FA", "Ford"],
    ["1FT", "Ford"],
    ["1GC", "Chevrolet"],
    ["5YJ", "Tesla"],
    // UK
    ["SAL", "Land Rover"],
    ["SAJ", "Jaguar"],
    ["SCA", "Rolls-Royce"],
    // Italy
    ["ZFF", "Ferrari"],
    ["ZHW", "Lamborghini"],
    ["ZAR", "Alfa Romeo"],
    ["ZAM", "Maserati"],
    // Sweden
    ["YV1", "Volvo"],
    ["YV4", "Volvo"],
    // Czech Republic
    ["TMB", "Škoda"],
  ];

  for (const [wmi, expectedMake] of cases) {
    it(`${wmi}*** → ${expectedMake}`, () => {
      const result = decodeVin(pad(wmi));
      expect(result.make).toBe(expectedMake);
    });
  }
});

// ── Model decoding: every MODEL_MAP_4 entry ───────────────────────────────────
// This is the critical table — any mapping error is caught here.

describe("model decoding — every MODEL_MAP_4 entry", () => {
  const cases: [string, string][] = [
    // Toyota
    ["4T1B", "Camry"],
    ["4T1G", "Camry Hybrid"],
    ["2T1B", "Corolla"],
    ["2T1G", "Corolla"],
    ["4T3B", "RAV4"],
    ["5TDB", "Sienna"],
    ["5TDK", "Sienna"],
    ["5TDY", "Sequoia"],
    ["5TFR", "Tundra"],
    ["5TFT", "Tundra"],
    ["5TFU", "Tacoma"],
    ["5TFX", "Tacoma"],
    ["JTMB", "RAV4"],
    ["JTMC", "Highlander"],
    ["JTMG", "4Runner"],
    ["JTMJ", "Highlander"],
    ["JTMH", "Venza"],
    ["JTMA", "Yaris"],
    ["JTDA", "Prius"],
    ["JTDL", "Prius"],
    ["JTDK", "Prius"],
    ["JTDE", "Prius"],
    ["2T3J", "RAV4"],
    ["4T1C", "Camry"],
    ["5TDZ", "Sequoia"],
    // Honda
    ["1HGC", "Accord"],
    ["1HGA", "Accord"],
    ["1HGE", "Accord"],
    ["1HGF", "Civic"],
    ["1HGB", "Civic"],
    ["1HGD", "Civic"],
    ["5FNR", "CR-V"],
    ["5J6R", "CR-V"],
    ["5J6T", "CR-V"],
    ["5J8Y", "Pilot"],
    ["5J8T", "Pilot"],
    ["1HGS", "Odyssey"],
    ["2HGF", "Civic"],
    ["2HGE", "Accord"],
    ["JHMG", "Accord"],
    ["JHMZ", "Jazz/Fit"],
    ["JHMF", "Civic"],
    // BMW — series/SUV decoding is in european-premium.ts (see dedicated tests below)
    ["5UXK", "X3"],
    ["5UXZ", "X5"],
    ["5UXW", "X1"],
    ["5UXU", "X5 M"],
    ["5UXY", "X7"],
    ["5UX3", "X3 M"],
    ["5YM1", "X1"],
    ["5YM3", "X3 M"],
    // Mercedes-Benz — coarse 4-char pads use year letter A (=2010) at pos.10.
    // Year-sensitive letter VDS is covered in mercedes-vds / premium QA tests.
    ["WDDC", "C-Class"],
    ["WDDE", "E-Class"],
    ["WDDS", "CLA-Class"],
    // Letter-series passenger VINs (premium resolver; not unique chassis gen).
    ["WDDG", "C-Class"],
    ["WDDA", "A-Class"],
    ["WDDB", "B-Class"],
    ["WDDF", "E-Class"],
    ["WDDN", "GLA-Class"],
    ["WDDP", "SLK/SLC"],
    ["WDDR", "GLC-Class"],
    ["WDDW", "SLK/SLC"],
    ["WDDX", "SL-Class"],
    ["WDC0", "GLC"],
    ["WDCG", "GLK (X204)"],
    ["WDCJ", "GLC Coupe"],
    ["WDCA", "ML-Class"],
    ["WDCB", "ML-Class (W164)"],
    ["WDCT", "GLA"],
    // Audi
    ["WAUC", "A4/A5"],
    ["WAUE", "A6/A7"],
    ["WAUA", "A8"],
    ["WAUJ", "A3"],
    ["WAUM", "Q8"],
    ["WAUS", "S/RS Series"],
    ["WA1L", "Q5"],
    ["WA1B", "Q7"],
    ["WA1A", "Q3"],
    ["WA1C", "Q5"],
    ["WA1F", "Q5 Sportback"],
    // Volkswagen — avoid WVWZ/1VWZ (ZZZ filler at position 4)
    ["WVWA", "Jetta"],
    ["WVWB", "Polo"],
    ["WVWH", "Passat"],
    ["1VWB", "Passat"],
    ["3VWF", "Jetta"],
    ["3VWC", "Jetta"],
    ["3VWS", "Tiguan"],
    ["3VW4", "Golf"],
    ["3VW1", "Golf"],
    // Porsche
    ["WP0A", "911"],
    ["WP0B", "Boxster/Cayman"],
    ["WP0C", "Cayenne"],
    ["WP0Z", "Panamera"],
    ["WP0G", "Taycan"],
    ["WP1A", "Cayenne"],
    ["WP1Z", "Macan"],
    // Land Rover — year-gated in jlr-eu (not MODEL_MAP_4). Covered by land-rover-qa.test.ts.
    // Jaguar
    ["SAJW", "F-Type (X152)"],
    ["SAJV", "XF (X260)"],
    ["SAJA", "XE (X760)"],
    ["SAJP", "F-Pace (X761)"],
    ["SAJE", "E-Pace (X540)"],
    ["SAJC", "I-Pace (X590)"],
    // Hyundai — CRITICAL: these were the source of the regression
    ["KMHS", "Santa Fe Sport"],   // regression fix: was "Sonata"
    // Bare KMHR is deliberately unmapped — KMHR28=Venue, KMHR58/68=Kona.
    ["KMHD", "Elantra"],
    ["KM8J", "Tucson"],
    ["KM8S", "Santa Fe"],
    ["KM8R", "Santa Cruz"],
    ["KMHM", "IONIQ 6"],
    // KMHL alone is ambiguous (Sonata DN8 KR MY2020+ vs IONIQ) — use KMHL341 below
    // Coarse KMHK→i10 removed (was wrong for Kona / Tucson platforms)
    // Kia
    ["KNAD", "Sportage"],
    ["KNAG", "Stinger"],
    ["KNAH", "K900"],
    ["KNAE", "Cadenza"],
    ["KNAF", "Carnival"],
    ["KNDJ", "Soul"],
    ["KNDL", "Telluride"],
    ["KNDM", "Niro"],
    ["KNDN", "Sorento"],
    ["KNDP", "Sportage"],
    ["KNDR", "Stonic"],
    // Tesla
    ["5YJ3", "Model 3"],
    ["5YJS", "Model S"],
    ["5YJX", "Model X"],
    ["7SAY", "Model Y"],
    ["7G2A", "Model Y"],
    // Volvo — dedicated decoder (padded prefixes use letter at pos.4)
    ["YV1A", "S80"],
    ["YV1B", "XC70"],
    // YV1C / YV4* need year-disambiguation; bare pads omit model rather than guess.
    ["YV4C", "XC90"],
    // Ford
    ["1FTF", "F-150"],
    ["1FTE", "F-150"],
    ["1FTW", "F-150"],
    ["1FMC", "Escape"],
    ["1FMS", "Explorer"],
    ["1FMH", "Edge"],
    ["1FA6", "Mustang"],
    ["3FA6", "Fusion"],
    ["1FMJ", "Explorer"],
    ["1FMU", "Escape"],
    ["1FT8", "Super Duty"],
    ["1FMK", "Edge"],
    ["1FME", "Expedition"],
    ["1FTR", "Ranger"],
    // Chevrolet / GMC
    ["1G1F", "Camaro"],
    ["2G1F", "Camaro"],
    ["1GNS", "Tahoe"],
    ["1GKS", "Yukon"],
    ["1GCH", "Silverado"],
    ["1GCP", "Silverado"],
    ["2GCH", "Silverado"],
    ["1GTN", "Sierra"],
    ["1GTG", "Sierra"],
    // Nissan / Infiniti
    ["1N4A", "Altima"],
    ["1N4B", "Maxima"],
    ["1N6A", "Titan/Frontier"],
    ["5N1A", "Pathfinder"],
    ["5N1D", "Armada"],
    ["5N1Z", "Murano"],
    ["1N4C", "Altima"],
    ["5N1B", "Rogue"],
    ["5N1R", "Xterra"],
    ["5N1E", "Murano"],
    // Mazda — carline at positions 4–5 (see mazda.ts)
    ["JM1BP", "Mazda3"],
    ["JM3KF", "CX-5"],
    ["JM3TC", "CX-9"],
    ["JM1ND", "MX-5"],
    ["JM1GJ", "Mazda6"],
    ["JM3DK", "CX-3"],
    ["JM3DM", "CX-30"],
    ["7MMVA", "CX-50"],
    ["3MVDM", "CX-30"],
    ["3MZBP", "Mazda3"],
    // Subaru
    ["JF1V", "WRX/STI"],
    ["JF2S", "Forester"],
    ["JF2T", "Outback"],
    ["4S3B", "Impreza"],
    ["4S4B", "Outback"],
    ["JF1S", "Impreza"],
    ["JF1B", "BRZ"],
    ["JF2A", "Crosstrek"],
    ["JF2Z", "Ascent"],
    ["JF2G", "Legacy"],
    // Mitsubishi
    ["JA3A", "Eclipse"],
    ["JA4A", "Outlander"],
    ["JA4J", "Eclipse Cross"],
    ["JA3C", "Galant"],
    ["JA4D", "Pajero Sport"],
    ["JA4W", "ASX"],
    ["JMBA", "Outlander PHEV"],
    ["JMBZ", "Eclipse Cross PHEV"],
    // Lexus
    ["2T2B", "RX"],
    ["2T2H", "NX"],
    ["JTJG", "LX"],
    ["JTJB", "GX"],
    ["JTJY", "RX"],
    ["JTHB", "ES 300h"],
    ["JTHD", "LS 600h"],
    ["JTHG", "IS 300/350"],
    ["JTHJ", "RX 450h"],
    ["JTHK", "NX 300h"],
    ["JTHL", "CT 200h"],
    ["JTHM", "GS 450h"],
    ["JTHN", "RZ 450e"],
    ["JTHE", "IS 500"],
    // Infiniti Japan (JNK* / JNA*)
    ["JNKB", "QX80"],
    ["JNKC", "Q50"],
    ["JNKN", "Q60"],
    ["JNAA", "QX60"],
    // Nissan Japan JN8*
    ["JN8A", "X-Trail"],
    ["JN8B", "Patrol"],
    ["JN8D", "Qashqai"],
    ["JN8E", "Murano"],
    ["JN8G", "Juke"],
    ["JN8J", "Armada"],
    // Acura USA
    ["JH4D", "Integra"],
    ["JH4K", "MDX"],
    ["JH4T", "TL"],
    ["JH4V", "RL"],
    ["JH4Y", "NSX"],
    ["19UY", "RDX"],
    ["19UA", "ILX"],
    ["19UB", "TLX"],
    ["19UC", "MDX"],
    ["19UF", "ZDX"],
    // Genesis
    ["KMTG", "GV80"],
    ["KMTH", "GV70"],
    ["KMTJ", "G90"],
    ["KMTF", "G70"],
    ["KMTK", "GV60"],
    ["KMTE", "G80"],
    // Chrysler / Dodge / Jeep / RAM
    ["1C3C", "Chrysler 300"],
    ["2C3C", "Chrysler 300"],
    ["1C4P", "Jeep Wrangler"],
    ["1C4R", "Jeep Grand Cherokee"],
    ["1C4H", "Dodge Durango"],
    ["1C4B", "Chrysler Pacifica"],
    ["1C4J", "Jeep Compass"],
    ["1C4N", "Jeep Renegade"],
    ["1C6R", "Ram 1500"],
    ["1C6T", "Ram 2500"],
    ["3C6T", "Ram 2500"],
    // Cadillac
    ["1GYS", "Escalade"],
    ["1GYA", "ATS"],
    ["1GYB", "CTS"],
    ["1GYC", "CT6"],
    ["1GYD", "XT5"],
    ["1GYE", "XT6"],
    ["1GYF", "CT5"],
    // Lincoln
    ["1LNH", "Navigator"],
    ["5LMJ", "Navigator"],
    ["5LMF", "MKZ / Zephyr"],
    // Rivian
    ["7FCA", "R1T"],
    ["7FCC", "R1S"],
    ["7FCB", "EDV 700"],
    // MINI
    ["WMWZ", "Cooper"],
    // WMWX is ambiguous (Cooper hatch vs Clubman) — no MODEL_MAP_4 guess.
    ["WMW4", "Countryman"],
    ["WMWS", "Paceman"],
    ["WMW5", "Cooper S"],
    ["WMW6", "John Cooper Works"],
    ["WMWN", "Convertible"],
    ["WMW3", "Cabrio"],
    // Alfa Romeo
    ["ZARB", "Giulia"],
    ["ZARE", "Stelvio"],
    ["ZARG", "Giulietta"],
    ["ZARJ", "Tonale"],
    ["ZARR", "Brera"],
    ["ZARS", "Spider"],
    // Ferrari
    ["ZFFA", "488 GTB"],
    ["ZFFB", "F8 Tributo"],
    ["ZFFC", "Roma"],
    ["ZFFD", "SF90 Stradale"],
    ["ZFFE", "Portofino"],
    ["ZFFG", "296 GTB"],
    ["ZFFH", "Purosangue"],
    // Lamborghini
    ["ZHWB", "Urus"],
    ["ZHWC", "Huracán"],
    ["ZHWD", "Aventador"],
    ["ZHWE", "Revuelto"],
    // Maserati
    ["ZAMA", "Ghibli"],
    ["ZAMB", "Quattroporte"],
    ["ZAMC", "Levante"],
    ["ZAMD", "GranTurismo"],
    ["ZAME", "Grecale"],
    // Rolls-Royce
    ["SCAA", "Ghost"],
    ["SCAB", "Phantom"],
    ["SCAC", "Cullinan"],
    ["SCAD", "Wraith"],
    ["SCAF", "Spectre"],
    // Aston Martin
    ["SCFB", "DB11"],
    ["SCFC", "Vantage"],
    ["SCFD", "DBS"],
    ["SCFE", "DBX"],
    ["SCFF", "DB12"],
    // Bentley
    ["SCBB", "Continental GT"],
    ["SCBC", "Bentayga"],
    ["SCBD", "Flying Spur"],
    ["SCBE", "Continental GTC"],
    // Renault
    ["VF1J", "Clio"],
    ["VF1L", "Megane"],
    ["VF1K", "Captur"],
    ["VF1R", "Zoe"],
    ["VF1E", "Kadjar"],
    ["VF1S", "Arkana"],
    // Peugeot
    ["VF3A", "208"],
    ["VF3D", "308"],
    ["VF3M", "3008"],
    ["VF3N", "5008"],
    ["VF3E", "2008"],
    // Citroën
    ["VF7A", "C3"],
    ["VF7C", "C5"],
    ["VF7U", "C4"],
    ["VF7B", "Berlingo"],
    ["VF7R", "C3 Aircross"],
    // Opel / Vauxhall
    ["W0LS", "Astra"],
    ["W0LB", "Corsa"],
    ["W0LT", "Insignia"],
    ["W0LM", "Mokka"],
    ["W0LN", "Grandland"],
    // Škoda
    ["TMBA", "Octavia"],
    ["TMBJ", "Fabia"],
    ["TMBE", "Superb"],
    ["TMBG", "Kodiaq"],
    ["TMBK", "Kamiq"],
    ["TMBZ", "Karoq"],
    // SEAT
    ["VS6A", "Ibiza"],
    ["VS6K", "León"],
    ["VS7A", "Arona"],
    ["VS7B", "Ateca"],
    ["VS7T", "Tarraco"],
  ];

  for (const [prefix, expectedModel] of cases) {
    it(`${prefix}*** → ${expectedModel}`, () => {
      const result = decodeVin(pad(prefix));
      expect(result.model).toBe(expectedModel);
    });
  }
});

describe("BMW premium model decoding", () => {
  it("Spartanburg X7 (WBA21) is not 2 Series", () => {
    const r = decodeVin("WBA21EM00P9R09775");
    expect(r.model).toContain("X7");
    expect(r.transmissionDecoded).toBe("Automatic");
  });

  it("WBA3V71 → 4 Series F33 Convertible", () => {
    const r = decodeVin("WBA3V7106FJ995387");
    expect(r.model).toContain("4 Series");
    expect(r.model).toContain("F33");
  });

  it("WBA4B1 → 4 Series F36 Gran Coupé", () => {
    const r = decodeVin("WBA4B1C59FG241156");
    expect(r.model).toContain("4 Series");
    expect(r.model).toContain("F36");
  });

  it("WBA7G → 7 Series", () => {
    const r = decodeVin("WBA7G6104GG509390");
    expect(r.model).toContain("7 Series");
  });

  it("WBY7 prefix → iX", () => {
    const r = decodeVin(pad("WBY7"));
    expect(r.model).toContain("iX");
  });
});

// ── Year decoding ─────────────────────────────────────────────────────────────
// The decoder adds 30 to base years < 2010 when the result is ≤ currentYear+2.
// As of 2026: W=2028 is the last +30 that fits; X=2029 and Y=2030 fall back
// to their base values (1999, 2000). Letter 'E'=1984 → 2014 (not unmapped).

describe("year decoding — all valid model-year codes", () => {
  const yearCodes: [string, number][] = [
    ["A", 2010], ["B", 2011], ["C", 2012], ["D", 2013],
    ["E", 2014], ["F", 2015], ["G", 2016], ["H", 2017],
    ["J", 2018], ["K", 2019], ["L", 2020], ["M", 2021],
    ["N", 2022], ["P", 2023], ["R", 2024], ["S", 2025],
    ["T", 2026], ["V", 2027], ["W", 2028],
    // X and Y: base+30 exceeds currentYear+2, so decoder returns the base year
    ["X", 1999], ["Y", 2000],
    // Numeric codes 2001–2009 (base+30 also exceeds currentYear+2)
    ["1", 2001], ["2", 2002], ["3", 2003], ["4", 2004],
    ["5", 2005], ["6", 2006], ["7", 2007], ["8", 2008],
    ["9", 2009],
  ];

  for (const [code, expectedYear] of yearCodes) {
    it(`position-10 '${code}' → ${expectedYear}`, () => {
      const result = decodeVin(withYear(code));
      expect(result.year).toBe(expectedYear);
    });
  }

  it("unmapped year code 'I' returns null", () => {
    // I, O, Q, U, Z are excluded from the VIN standard and not in YEAR_MAP
    const result = decodeVin(withYear("I"));
    expect(result.year).toBeNull();
  });
});

// ── Country decoding ──────────────────────────────────────────────────────────
// Country is decoded from position 1, refined by WMI when V/Y prefixes are shared.
describe("country decoding from first VIN character", () => {
  const cases: [string, string][] = [
    ["1HG", "United States"],
    ["4T1", "United States"],
    ["KMH", "South Korea"],
    ["WBA", "Germany"],
    ["JHM", "Japan"],
    ["SAL", "United Kingdom"],
    ["VF1", "France"],
    ["ZFF", "Italy"],
    ["YV1", "Sweden"],
    ["TMB", "Czech Republic"],
    ["VS6", "Spain"],
    ["VF3", "France"],
    ["VSS", "Spain"],
  ];

  for (const [wmi, expectedCountry] of cases) {
    it(`${wmi}*** → ${expectedCountry}`, () => {
      const result = decodeVin(pad(wmi));
      expect(result.country).toBe(expectedCountry);
    });
  }
});

// ── Engine code decoding ──────────────────────────────────────────────────────

describe("engine code decoding", () => {
  it("Hyundai KMH position-8 'C' → contains '2.0L'", () => {
    // Build VIN with 'C' at index 7 (position 8 = engine code)
    // "KMHSW81" = 7 chars → 'C' at index 7
    const vin = "KMHSW81" + "C" + "BGU554169";
    expect(decodeEngineCode(vin)).toContain("2.0L");
  });

  it("BMW WBA position-8 'B' → contains '2.0L'", () => {
    // "WBA3A0E" = 7 chars → 'B' at index 7
    const vin = "WBA3A0E" + "B" + "000000000";
    const result = decodeEngineCode(vin);
    expect(result).not.toBeNull();
    expect(result).toContain("2.0L");
  });

  it("unknown WMI → null", () => {
    expect(decodeEngineCode(pad("ZZZ"))).toBeNull();
  });

  it("does not treat EU Audi ZZZ type-approval letter G as 2.7T Biturbo", () => {
    // 2014 A6 allroad 3.0 TDI — positions 7–9 are platform code 4G6 (shared A6/A7 C7).
    const vin = "WAUZZZ4G6EN191357";
    expect(decodeEngineCode(vin)).toBeNull();
    const decoded = decodeVin(vin);
    expect(decoded.make).toBe("Audi");
    // 4G6 (A6 allroad C7) has no series mapping yet; null is correct, A7 would not be.
    expect(decoded.model == null || /A6/.test(decoded.model)).toBe(true);
    expect(decoded.year).toBe(2014);
    expect(decoded.engineDecoded).toBeNull();
    expect(decoded.engineCode).toBeNull();
  });

  it("WAUZZZ4G5 EU type code → A6 Avant C7 (4G8 is the A7 Sportback)", () => {
    const vin = "WAUZZZ4G5GN050914";
    const decoded = decodeVin(vin);
    expect(decoded.make).toBe("Audi");
    expect(decoded.model).toMatch(/A6 Avant/);
    expect(decoded.year).toBe(2016);
    expect(decodeEngineCode(vin)).toBeNull();
  });

  it("does not guess engine from EU ZZZ homologation codes (BMW, Mercedes, JLR, Porsche)", () => {
    const cases = [
      { vin: "WDDZZZ4JB1AA12345", make: "Mercedes-Benz" },
      { vin: "WBAZZZ310X0A12345", make: "BMW" },
      { vin: "SALZZZBG8HA123456", make: "Land Rover" },
      { vin: "SAJZZZBN5LCU12345", make: "Jaguar" },
      { vin: "WP0ZZZ99ZPS123456", make: "Porsche" },
      { vin: "WVWZZZ1KZAW123456", make: "Volkswagen" },
    ];
    for (const { vin, make } of cases) {
      expect(decodeEngineCode(vin), vin).toBeNull();
      expect(decodeVin(vin).make, vin).toBe(make);
      expect(decodeVin(vin).engineDecoded, vin).toBeNull();
    }
  });

  it("still decodes US-style BMW engine char when VDS is not ZZZ homologation", () => {
    const vin = "WBA3A0E" + "B" + "000000000";
    expect(decodeEngineCode(vin)).toContain("2.0L");
  });
});

// ── Body style decoding ───────────────────────────────────────────────────────

describe("body style decoding", () => {
  it("Hyundai KMH position-6 'C' → SUV/Crossover", () => {
    // "KMHSW" = 5 chars → 'C' at index 5 (position 6)
    const vin = "KMHSW" + "C" + "1UBGU554169";
    expect(decodeBodyStyleLocal(vin)).toBe("SUV/Crossover");
  });

  it("BMW WBA position-6 'E' → Sedan", () => {
    // "WBA3A" = 5 chars → 'E' at index 5 (position 6)
    const vin = pad("WBA3A" + "E");
    expect(decodeBodyStyleLocal(vin)).toBe("Sedan");
  });

  it("unknown WMI → null", () => {
    expect(decodeBodyStyleLocal(pad("ZZZ"))).toBeNull();
  });
});

// ── Engine spec extraction ────────────────────────────────────────────────────

describe("extractEngineSpecs", () => {
  it("parses displacement and cylinders from '2.0L I4 Turbo'", () => {
    const specs = extractEngineSpecs("2.0L I4 Turbo");
    expect(specs.displacement).toBe("2.0");
    expect(specs.cylinders).toBe("4");
  });

  it("parses V8 correctly", () => {
    const specs = extractEngineSpecs("4.4L V8 Biturbo");
    expect(specs.displacement).toBe("4.4");
    expect(specs.cylinders).toBe("8");
  });

  it("returns nulls for null input", () => {
    const specs = extractEngineSpecs(null);
    expect(specs.displacement).toBeNull();
    expect(specs.cylinders).toBeNull();
  });
});

// ── Plant info decoding ───────────────────────────────────────────────────────

describe("plant info decoding", () => {
  it("Hyundai KMH position-11 'A' → Asan, South Korea", () => {
    // "KMHSW81UBG" = 10 chars → 'A' at index 10 (position 11 = plant)
    const vin = "KMHSW81UBG" + "A" + "000000";
    const plant = decodePlantInfo(vin);
    expect(plant?.city).toBe("Asan");
    expect(plant?.country).toBe("South Korea");
  });

  it("WMI not in plant table → null", () => {
    // ZZZ is not a real WMI and won't appear in PLANT_CODE_MAP
    expect(decodePlantInfo(pad("ZZZ"))).toBeNull();
  });
});

// ── Full decode integration ───────────────────────────────────────────────────

describe("full decodeVin integration", () => {
  it("real Honda Accord — 1HGCM82633A004352", () => {
    const r = decodeVin("1HGCM82633A004352");
    expect(r.make).toBe("Honda");
    expect(r.model).toBe("Accord");
    expect(r.year).toBe(2003);
    expect(r.country).toBe("United States");
    expect(r.wmi).toBe("1HG");
  });

  it("Toyota Prius — JTDKB20U797867720", () => {
    const r = decodeVin("JTDKB20U797867720");
    expect(r.make).toBe("Toyota");
    expect(r.model).toBe("Prius");
    expect(r.year).toBe(2009);
  });

  it("BMW 3-Series — WBA3A5C55FK123456", () => {
    const r = decodeVin("WBA3A5C55FK123456");
    expect(r.make).toBe("BMW");
    expect(r.model).toContain("3 Series");
  });

  it("Kia Sorento — KNDNB2A28F7123456", () => {
    const r = decodeVin("KNDNB2A28F7123456");
    expect(r.make).toBe("Kia");
    expect(r.model).toBe("Sorento");
  });
});

// ── REGRESSION TESTS ─────────────────────────────────────────────────────────
// Keep these locked. They document bugs that were once live in production.

describe("regressions", () => {
  it("[REG-001] KMHSW81UBGU554169 must decode as Santa Fe Sport, NOT Sonata", () => {
    const r = decodeVin("KMHSW81UBGU554169");
    expect(r.make).toBe("Hyundai");
    expect(r.model).toBe("Santa Fe Sport");
    expect(r.model).not.toBe("Sonata");
  });

  it("[REG-002] Korean Sonata MY2020 KMHL* must not decode as IONIQ 5", () => {
    const r = decodeVin("KMHL24JJ0LA009507");
    expect(r.make).toBe("Hyundai");
    expect(r.model).toBe("Sonata");
    expect(r.year).toBe(2020);
    expect(r.model).not.toMatch(/IONIQ/i);
  });

  it("[REG-002] IONIQ 5 platform KMHL341 still decodes as IONIQ 5", () => {
    const r = decodeVin("KMHL341BGNU123456");
    expect(r.model).toBe("IONIQ 5");
  });

  it("[REG-001] any KMHS-prefixed VIN must resolve to Santa Fe Sport", () => {
    const r = decodeVin(pad("KMHS"));
    expect(r.model).toBe("Santa Fe Sport");
  });

  it("[REG-001] bare KMHR stays unresolved instead of guessing Santa Fe", () => {
    const r = decodeVin(pad("KMHR"));
    expect(r.model).toBeNull();
    expect(decodeVin("KMHR281BGNU123456").model).toBe("Venue");
    expect(decodeVin("KMHR681BGNU123456").model).toBe("Kona");
  });

  it("[REG-002] 1VWZZZA3ZDC050213 must decode as Volkswagen Passat NMS without throwing", () => {
    const r = decodeVin("1VWZZZA3ZDC050213");
    expect(r.make).toBe("Volkswagen");
    expect(r.model).toContain("Passat");
    expect(r.vin).toBe("1VWZZZA3ZDC050213");
  });

  it("[REG-002] generic 1VWZ prefix does not force Jetta", () => {
    const r = decodeVin(pad("1VWZ"));
    expect(r.make).toBe("Volkswagen");
    expect(r.model).not.toBe("Jetta");
  });

  it("[REG-002] 1VWF prefix resolves to Volkswagen Golf", () => {
    const r = decodeVin(pad("1VWF"));
    expect(r.make).toBe("Volkswagen");
    expect(r.model).toBe("Golf");
  });

  it("[REG-004] WVGZZZ5NZDW535045 → Volkswagen Tiguan (VAG plant WMI)", () => {
    const r = decodeVin("WVGZZZ5NZDW535045");
    expect(r.make).toBe("Volkswagen");
    expect(r.model).toContain("Tiguan");
    expect(r.year).toBe(2013);
    expect(isNorthAmericanMarketVin("WVGZZZ5NZDW535045")).toBe(false);
    expect(resolveCheckDigitValid("WVGZZZ5NZDW535045")).toBe(true);
  });

  it("[REG-003] JHMCM56557C404453 → Honda Accord (Japan export)", () => {
    const r = decodeVin("JHMCM56557C404453");
    expect(r.make).toBe("Honda");
    expect(r.model).toBe("Accord");
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("lowercase VIN is normalised and decoded correctly", () => {
    const r = decodeVin("1hgcm82633a004352");
    expect(r.make).toBe("Honda");
    expect(r.vin).toBe("1HGCM82633A004352");
  });

  it("VIN with leading/trailing spaces is trimmed", () => {
    const r = decodeVin("  1HGCM82633A004352  ");
    expect(r.make).toBe("Honda");
  });

  it("completely unknown WMI returns null make and null model", () => {
    const r = decodeVin(pad("ZZZ"));
    expect(r.make).toBeNull();
    expect(r.model).toBeNull();
  });

  it("unmapped year code 'I' returns null year", () => {
    const r = decodeVin(withYear("I"));
    expect(r.year).toBeNull();
  });

  it("decodeVin always returns a 17-char uppercased vin field", () => {
    const r = decodeVin("1hgcm82633a004352");
    expect(r.vin).toHaveLength(17);
    expect(r.vin).toBe(r.vin.toUpperCase());
  });

  it("wmi field is always the first 3 chars of the normalised VIN", () => {
    const r = decodeVin("KMHSW81UBGU554169");
    expect(r.wmi).toBe("KMH");
  });
});
