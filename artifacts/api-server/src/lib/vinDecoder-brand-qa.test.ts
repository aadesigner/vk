/**
 * Brand coverage QA — locks decode accuracy for popular makes/models.
 * Uses public VIN patterns; padded suffixes are fine for WMI/VDS checks.
 */
import { describe, it, expect } from "vitest";
import { decodeVin, decodeVinLocalFree, isPlausibleMake, isPlausibleModel } from "@workspace/vin-decode";

type BrandCase = {
  vin: string;
  label: string;
  make: string;
  modelContains: string;
  year?: number;
};

const CASES: BrandCase[] = [
  // ── Volkswagen Group ──────────────────────────────────────────────────────
  { vin: "WVGZZZ5NZDW535045", label: "VW Tiguan (WVG plant)", make: "Volkswagen", modelContains: "Tiguan", year: 2013 },
  { vin: "WVWZZZ3CZCE064077", label: "VW Passat (Typ 3C)", make: "Volkswagen", modelContains: "Passat" },
  { vin: "WVWZZZ1KZAW123456", label: "VW Golf (Typ 1K)", make: "Volkswagen", modelContains: "Golf" },
  { vin: "WVWZZZ5NZBW123456", label: "VW Tiguan (WVW)", make: "Volkswagen", modelContains: "Tiguan" },
  { vin: "WVWZZZE1ZSW123456", label: "VW ID.3", make: "Volkswagen", modelContains: "ID.3" },
  { vin: "1VWZZZA3ZDC050213", label: "VW Passat NMS", make: "Volkswagen", modelContains: "Passat" },
  { vin: "3VWS17AU0FM123456", label: "VW Tiguan US", make: "Volkswagen", modelContains: "Tiguan" },
  { vin: "WVWZZZ1TZBW123456", label: "VW Touran 1T", make: "Volkswagen", modelContains: "Touran" },
  { vin: "WVWZZZ9NZBW123456", label: "VW Polo 9N", make: "Volkswagen", modelContains: "Polo" },
  { vin: "WVWZZZ5MNW1234567", label: "VW Golf Plus 5M", make: "Volkswagen", modelContains: "Golf Plus" },
  { vin: "WVWZZZ2HNW1234567", label: "VW Amarok", make: "Volkswagen", modelContains: "Amarok" },
  { vin: "WVGZZZEBSNW123456", label: "VW ID. Buzz", make: "Volkswagen", modelContains: "ID. Buzz" },

  // ── Audi ──────────────────────────────────────────────────────────────────
  { vin: "WAUZZZ8K1BN123456", label: "Audi A4 EU", make: "Audi", modelContains: "A4" },
  { vin: "WAUZZZ4G5DN123456", label: "Audi A6 Avant C7 EU (4G5)", make: "Audi", modelContains: "A6" },
  { vin: "WAUZZZGY1NU123456", label: "Audi A3 EU (GY / 8Y)", make: "Audi", modelContains: "A3" },
  { vin: "WAUZZZGA1BN123456", label: "Audi Q2 EU (GA)", make: "Audi", modelContains: "Q2" },
  { vin: "WAUZZZF7BN1234567", label: "Audi Q7 EU (F7)", make: "Audi", modelContains: "Q7" },
  { vin: "WAUZZZFYBN1234567", label: "Audi Q5 EU (FY)", make: "Audi", modelContains: "Q5" },
  { vin: "WAUZZZF1ZAN123456", label: "Audi Q8 EU (F1)", make: "Audi", modelContains: "Q8" },
  { vin: "WAUZZZ4LBAN123456", label: "Audi Q7 EU (4L)", make: "Audi", modelContains: "Q7" },
  { vin: "WVGZZZF7BN1234567", label: "Audi Q7 Bratislava (WVG)", make: "Audi", modelContains: "Q7" },
  { vin: "WA1LFAFP5HA123456", label: "Audi Q5 US (WA1)", make: "Audi", modelContains: "Q5" },
  { vin: "WA1AAAFV5KA123456", label: "Audi Q3 US (WA1)", make: "Audi", modelContains: "Q3" },
  { vin: "WA1MFAFP5HA123456", label: "Audi Q8 US (WA1)", make: "Audi", modelContains: "Q8" },
  { vin: "WAUZZZFFVAN123456", label: "Audi A3 EU", make: "Audi", modelContains: "A3" },
  { vin: "WAUZZZF4XGN123456", label: "Audi A4 B9 EU", make: "Audi", modelContains: "A4" },
  { vin: "WAUZZZGEAN1234567", label: "Audi Q8 e-tron EU", make: "Audi", modelContains: "Q8" },

  // ── Porsche ───────────────────────────────────────────────────────────────
  { vin: "WP0ZZZ99ZPS123456", label: "Porsche 911", make: "Porsche", modelContains: "911" },
  { vin: "WP0ZZZ92ZLA123456", label: "Porsche Cayenne", make: "Porsche", modelContains: "Cayenne" },
  { vin: "WP1ZZZ9ZPR1234567", label: "Porsche Macan", make: "Porsche", modelContains: "Macan" },
  { vin: "WP0ZZZ9YZLS123456", label: "Porsche Taycan", make: "Porsche", modelContains: "Taycan" },

  // ── BMW ───────────────────────────────────────────────────────────────────
  { vin: "WBA3A5C55FK123456", label: "BMW 3 Series (ambiguous prefix)", make: "BMW", modelContains: "3 Series" },
  { vin: "WBA5E1105HJ123456", label: "BMW 5 Series G30", make: "BMW", modelContains: "5 Series" },
  { vin: "WBA21EM00P9R09775", label: "BMW X7 G07", make: "BMW", modelContains: "X7" },
  { vin: "WBA31BH00P9R09775", label: "BMW X3 G01", make: "BMW", modelContains: "X3" },
  { vin: "WBY7E21050V123456", label: "BMW iX", make: "BMW", modelContains: "iX" },
  { vin: "WBA6D6C53HG388222", label: "BMW 6 Series F06", make: "BMW", modelContains: "6 Series" },
  { vin: "WBAZZZ6C0X0A12345", label: "BMW 6 Series EU ZZZ", make: "BMW", modelContains: "6 Series" },
  { vin: "WBAZZZ310X0A12345", label: "BMW 3 Series EU ZZZ", make: "BMW", modelContains: "3 Series" },
  { vin: "WBA71BX03P9R09775", label: "BMW X1 F48", make: "BMW", modelContains: "X1" },
  { vin: "5YM81KX02M0123456", label: "BMW X1 US (5YM)", make: "BMW", modelContains: "X1" },
  { vin: "WBY51CF00NF123456", label: "BMW i4", make: "BMW", modelContains: "i4" },
  { vin: "5UX3V7106FJ995387", label: "BMW 4 Series US", make: "BMW", modelContains: "4 Series" },

  // ── Mercedes-Benz ─────────────────────────────────────────────────────────
  // Year is VIN position 10 — replace that char; do not insert (must stay 17 chars).
  { vin: "WDD213042GA123456", label: "Mercedes E-Class W213", make: "Mercedes-Benz", modelContains: "E-Class", year: 2016 },
  { vin: "WDD205037FA123456", label: "Mercedes C-Class W205", make: "Mercedes-Benz", modelContains: "C-Class", year: 2015 },
  { vin: "WDD177087KA123456", label: "Mercedes A-Class W177", make: "Mercedes-Benz", modelContains: "A-Class", year: 2019 },
  { vin: "WDD253149GA123456", label: "Mercedes GLC X253", make: "Mercedes-Benz", modelContains: "GLC", year: 2016 },
  { vin: "WDD463276LA123456", label: "Mercedes G-Class", make: "Mercedes-Benz", modelContains: "G-Class" },
  { vin: "WDDZZZ213GAA12345", label: "Mercedes E-Class EU ZZZ", make: "Mercedes-Benz", modelContains: "E-Class", year: 2016 },
  { vin: "W1K213046GA123456", label: "Mercedes E-Class W1K", make: "Mercedes-Benz", modelContains: "E-Class", year: 2016 },
  { vin: "W1K177087KA123456", label: "Mercedes A-Class W1K", make: "Mercedes-Benz", modelContains: "A-Class", year: 2019 },
  { vin: "WDDZZZ167KAA12345", label: "Mercedes GLE/GLS EU ZZZ", make: "Mercedes-Benz", modelContains: "GLE", year: 2019 },
  { vin: "WDD214087PA123456", label: "Mercedes E-Class W214", make: "Mercedes-Benz", modelContains: "E-Class", year: 2023 },
  { vin: "WDD206087MA123456", label: "Mercedes C-Class W206", make: "Mercedes-Benz", modelContains: "C-Class", year: 2021 },
  { vin: "WDD204049AA123456", label: "Mercedes C-Class W204", make: "Mercedes-Benz", modelContains: "C-Class", year: 2010 },
  { vin: "WDB463236LA123456", label: "Mercedes G-Class WDB", make: "Mercedes-Benz", modelContains: "G-Class" },
  { vin: "WDDGF8HB6LA123456", label: "Mercedes C-Class letter VDS (no false gen)", make: "Mercedes-Benz", modelContains: "C-Class" },
  { vin: "WDDHF5KB6FA123456", label: "Mercedes E-Class letter H W212 (not C-Class)", make: "Mercedes-Benz", modelContains: "E-Class" },
  { vin: "WDDZF4JB0LA123456", label: "Mercedes E-Class letter Z W213", make: "Mercedes-Benz", modelContains: "E-Class" },
  { vin: "W1NYC7HJ0LX340589", label: "Mercedes G-Class W1N", make: "Mercedes-Benz", modelContains: "G-Class" },
  { vin: "WDD243000MA123456", label: "Mercedes EQA/EQB 243", make: "Mercedes-Benz", modelContains: "EQ", year: 2021 },

  // ── Škoda ─────────────────────────────────────────────────────────────────
  { vin: "TMBEP6NJ3MZ012345", label: "Škoda Fabia III", make: "Škoda", modelContains: "Fabia" },
  { vin: "TMBJP7NX5MY012345", label: "Škoda Octavia IV", make: "Škoda", modelContains: "Octavia" },
  { vin: "TMBJW7NP0M7012345", label: "Škoda Superb III", make: "Škoda", modelContains: "Superb" },
  { vin: "TMBER7NW5M3123456", label: "Škoda Scala", make: "Škoda", modelContains: "Scala" },
  { vin: "TMBDK6XK5MS012345", label: "Škoda Kodiaq", make: "Škoda", modelContains: "Kodiaq" },
  { vin: "TMBER6NM5MS012345", label: "Škoda Enyaq", make: "Škoda", modelContains: "Enyaq" },
  { vin: "TMBLK7PS5MS012345", label: "Škoda Kamiq", make: "Škoda", modelContains: "Kamiq" },

  // ── Land Rover / Jaguar ───────────────────────────────────────────────────
  { vin: "SALZZZBN1MA123456", label: "Range Rover L460", make: "Land Rover", modelContains: "Range Rover" },
  { vin: "SALZZZLM1MA123456", label: "Defender L663", make: "Land Rover", modelContains: "Defender" },
  { vin: "SALZZZJA1MA123456", label: "Discovery Sport", make: "Land Rover", modelContains: "Discovery Sport" },
  { vin: "SALZZZGB1MA123456", label: "Range Rover Sport L461", make: "Land Rover", modelContains: "Range Rover Sport" },
  { vin: "SALZZZEV1MA123456", label: "Evoque L551", make: "Land Rover", modelContains: "Evoque" },
  { vin: "SALEX7EU0L2000152", label: "Defender US SALE", make: "Land Rover", modelContains: "Defender" },
  { vin: "SAJZZZBG1MA123456", label: "Jaguar F-Pace", make: "Jaguar", modelContains: "F-Pace" },
  { vin: "SAJZZZBM1MA123456", label: "Jaguar I-Pace", make: "Jaguar", modelContains: "I-Pace" },
  { vin: "SAJZZZBN1MA123456", label: "Jaguar XF", make: "Jaguar", modelContains: "XF" },
  { vin: "SAJZZZBK1MA123456", label: "Jaguar XE", make: "Jaguar", modelContains: "XE" },
  { vin: "SAJZZZJA1MA123456", label: "Jaguar E-Pace", make: "Jaguar", modelContains: "E-Pace" },

  // ── Ford Europe ───────────────────────────────────────────────────────────
  { vin: "WF0ZZZGBJNW123456", label: "Ford Focus Mk4 EU", make: "Ford", modelContains: "Focus" },
  { vin: "WF0ZZZU5JNW123456", label: "Ford Kuga EU", make: "Ford", modelContains: "Kuga" },
  { vin: "WF0ZZZNUGNW123456", label: "Ford Puma EU", make: "Ford", modelContains: "Puma" },
  { vin: "WF0ZZZM7GNW123456", label: "Ford Mustang Mach-E EU", make: "Ford", modelContains: "Mach-E" },
  { vin: "WF0EXXWP1W1234567", label: "Ford Focus (legacy EU)", make: "Ford", modelContains: "Focus" },

  // ── Renault ───────────────────────────────────────────────────────────────
  { vin: "VF1RJA00012345678", label: "Renault Clio", make: "Renault", modelContains: "Clio" },
  { vin: "VF1LB0A0H12345678", label: "Renault Megane", make: "Renault", modelContains: "Megane" },
  { vin: "VF1RFK0A0H1234567", label: "Renault Captur", make: "Renault", modelContains: "Captur" },
  { vin: "VF1AG000012345678", label: "Renault Arkana", make: "Renault", modelContains: "Arkana" },

  // ── Fiat (official type-approval VIN formats) ─────────────────────────────
  { vin: "ZFA31200000745586", label: "Fiat 500", make: "Fiat", modelContains: "500" },
  { vin: "ZFA31200003974827", label: "Fiat Nuova Panda", make: "Fiat", modelContains: "Panda" },
  { vin: "ZFA16900001234567", label: "Fiat Panda", make: "Fiat", modelContains: "Panda" },
  { vin: "ZFA33400001234567", label: "Fiat 500X", make: "Fiat", modelContains: "500X" },
  { vin: "ZFA35600001234567", label: "Fiat Tipo", make: "Fiat", modelContains: "Tipo" },
  { vin: "ZFA19900005000000", label: "Fiat 500L", make: "Fiat", modelContains: "500L" },
  { vin: "ZFA1990000P000000", label: "Fiat Punto", make: "Fiat", modelContains: "Punto" },

  // ── Peugeot / Citroën ─────────────────────────────────────────────────────
  { vin: "VF3MRHPYWR1234567", label: "Peugeot 3008", make: "Peugeot", modelContains: "3008" },
  { vin: "VF3ZZZABGR1234567", label: "Peugeot 208 EU ZZZ", make: "Peugeot", modelContains: "208" },
  { vin: "VF7ZZZABGR1234567", label: "Citroën C3 EU ZZZ", make: "Citroën", modelContains: "C3" },
  { vin: "VR7EDYHT3TJ786461", label: "Citroën Berlingo 2026 VR7", make: "Citroën", modelContains: "Berlingo", year: 2026 },

  // ── SEAT ──────────────────────────────────────────────────────────────────
  { vin: "VSSZZZ7NZFR123456", label: "SEAT Alhambra EU (7N)", make: "SEAT", modelContains: "Alhambra" },
  { vin: "VSSZZZ5FZFR123456", label: "SEAT León Mk3", make: "SEAT", modelContains: "5F" },
  { vin: "VSSZZZKHZFR123456", label: "SEAT Ateca KH", make: "SEAT", modelContains: "KH" },
  { vin: "VSSZZZ5PZCR025966", label: "SEAT Altea XL", make: "SEAT", modelContains: "Altea" },

  // ── Hyundai / Toyota / Kia ────────────────────────────────────────────────
  { vin: "KM8J23A45MU123456", label: "Hyundai Tucson US", make: "Hyundai", modelContains: "Tucson", year: 2021 },
  { vin: "KM8J3CA46NU123456", label: "Hyundai Tucson NX4 US", make: "Hyundai", modelContains: "Tucson", year: 2022 },
  { vin: "KMHNU81BADN123456", label: "Hyundai Tucson NX4 KR", make: "Hyundai", modelContains: "Tucson" },
  { vin: "KMHK381BGBU123456", label: "Hyundai Tucson KMHK", make: "Hyundai", modelContains: "Tucson" },
  { vin: "TMAH381BGBU123456", label: "Hyundai Tucson EU plant", make: "Hyundai", modelContains: "Tucson" },
  { vin: "TMAJB81CADN123456", label: "Hyundai Tucson Czech TMAJ", make: "Hyundai", modelContains: "Tucson" },
  { vin: "KMHL341BGBU123456", label: "Hyundai IONIQ 5", make: "Hyundai", modelContains: "IONIQ" },
  { vin: "KMHS381BGBU123456", label: "Hyundai Santa Fe Sport", make: "Hyundai", modelContains: "Santa Fe" },
  { vin: "KMHR681BGBU123456", label: "Hyundai Kona SX2", make: "Hyundai", modelContains: "Kona" },
  { vin: "KMHD281BGBU123456", label: "Hyundai Elantra CN7", make: "Hyundai", modelContains: "Elantra" },
  { vin: "5NPE24AF5FH123456", label: "Hyundai Sonata US", make: "Hyundai", modelContains: "Sonata" },
  { vin: "JTDKN3DU0A0123456", label: "Toyota Prius", make: "Toyota", modelContains: "Prius" },
  { vin: "JTMB1RFV0KD123456", label: "Toyota RAV4", make: "Toyota", modelContains: "RAV4" },
  { vin: "SB1KB3B00MA123456", label: "Toyota Corolla UK", make: "Toyota", modelContains: "Corolla" },
  { vin: "SB1B93B00MA123456", label: "Toyota C-HR UK", make: "Toyota", modelContains: "C-HR" },
  { vin: "7MUCAAAG0PV065309", label: "Toyota Corolla Cross US 7MU", make: "Toyota", modelContains: "Corolla Cross", year: 2023 },
  { vin: "3C4NJDCB6LT149558", label: "Jeep Compass Mexico 2020", make: "Jeep", modelContains: "Compass", year: 2020 },
  { vin: "KL77LHEP3SC238871", label: "Chevrolet Trax 2025", make: "Chevrolet", modelContains: "Trax", year: 2025 },
  { vin: "58ABK1GG0GU001619", label: "Lexus ES Kentucky 58A", make: "Lexus", modelContains: "ES" },
  { vin: "JTHBZ1B14K2003273", label: "Lexus ES 350 Japan", make: "Lexus", modelContains: "ES", year: 2019 },
  { vin: "KNDNB2A28F7123456", label: "Kia Sorento", make: "Kia", modelContains: "Sorento" },
  { vin: "KNDC34LA5P5123456", label: "Kia EV6", make: "Kia", modelContains: "EV6" },

  // ── Dacia ─────────────────────────────────────────────────────────────────
  { vin: "UU1DJF11065848712", label: "Dacia Duster", make: "Dacia", modelContains: "Duster" },
  { vin: "UU1BFB11061234567", label: "Dacia Sandero", make: "Dacia", modelContains: "Sandero" },
  { vin: "UU1HDR11061234567", label: "Dacia Logan", make: "Dacia", modelContains: "Logan" },

  // ── Renault Duster (Renault-badged) ───────────────────────────────────────
  { vin: "VF1RJF00261234567", label: "Renault Duster", make: "Renault", modelContains: "Duster" },

  // ── Suzuki ────────────────────────────────────────────────────────────────
  { vin: "JS2ZC33S7C4116148", label: "Suzuki Swift", make: "Suzuki", modelContains: "Swift" },
  { vin: "JS3JB74V5P7123456", label: "Suzuki Jimny", make: "Suzuki", modelContains: "Jimny" },
  { vin: "TSMLY8V3XKA123456", label: "Suzuki Vitara HU", make: "Suzuki", modelContains: "Vitara" },

  // ── Mazda ─────────────────────────────────────────────────────────────────
  { vin: "JM1BPAM7XK1234567", label: "Mazda3 (BP)", make: "Mazda", modelContains: "Mazda3", year: 2019 },
  { vin: "JM3KFBM7MK1234567", label: "Mazda CX-5 (KF)", make: "Mazda", modelContains: "CX-5" },
  { vin: "JM1NDAM7MK1234567", label: "Mazda MX-5 (ND)", make: "Mazda", modelContains: "MX-5" },
  { vin: "JM1GJAM7FK1234567", label: "Mazda6 (GJ not MX-5)", make: "Mazda", modelContains: "Mazda6" },
  { vin: "3MZBPAM7MM1234567", label: "Mazda3 Mexico", make: "Mazda", modelContains: "Mazda3" },
  { vin: "3MVDMAD7MM1234567", label: "Mazda CX-30 Mexico", make: "Mazda", modelContains: "CX-30" },
  { vin: "7MMVAAD7PA1234567", label: "Mazda CX-50 US", make: "Mazda", modelContains: "CX-50" },

  // ── MG / BYD / Haval ──────────────────────────────────────────────────────
  { vin: "LSJWP4U21NG123456", label: "MG ZS", make: "MG", modelContains: "ZS" },
  { vin: "LSJW5E14P1N123456", label: "MG4", make: "MG", modelContains: "MG4" },
  { vin: "LFPAA3A24P4123456", label: "BYD Atto 3", make: "BYD", modelContains: "Atto 3" },
  { vin: "LGWFF4A55PM123456", label: "Haval H6", make: "Haval / Great Wall", modelContains: "H6" },

  // ── Polestar / VinFast / Lucid ────────────────────────────────────────────
  { vin: "LPSVSEXT0N1234567", label: "Polestar 2", make: "Polestar", modelContains: "2" },
  { vin: "RLLVCE1A0N1234567", label: "VinFast VF8", make: "VinFast", modelContains: "VF8" },
  { vin: "5LAA1BAA0N0123456", label: "Lucid Air", make: "Lucid", modelContains: "Air" },

  // ── Isuzu / Tata / KGM ────────────────────────────────────────────────────
  { vin: "MPATFS40JKT123456", label: "Isuzu D-Max TH", make: "Isuzu", modelContains: "D-Max" },
  { vin: "MAT612AK1P8123456", label: "Tata Nexon", make: "Tata", modelContains: "Nexon" },
  { vin: "KPTB2A1A0P8123456", label: "KGM Torres", make: "SsangYong", modelContains: "Torres" },

  // ── Cupra / DS ────────────────────────────────────────────────────────────
  { vin: "VSSZZZKM7MR123456", label: "Cupra Formentor", make: "Cupra", modelContains: "Formentor" },
  { vin: "VSSZZZK1ZMR123456", label: "Cupra Born", make: "Cupra", modelContains: "Born" },
  { vin: "VR1RHRHVP5L123456", label: "DS 7", make: "DS Automobiles", modelContains: "DS 7" },
];

function assertDecode(c: BrandCase): void {
  const r = decodeVin(c.vin);
  expect(r.make, `${c.label}: make`).toBe(c.make);
  expect(r.model?.toLowerCase(), `${c.label}: model`).toContain(c.modelContains.toLowerCase());
  if (c.year != null) {
    expect(r.year, `${c.label}: year`).toBe(c.year);
  }
  expect(isPlausibleMake(r.make, c.vin), `${c.label}: plausible make`).toBe(true);
  expect(isPlausibleModel(r.model, c.vin), `${c.label}: plausible model`).toBe(true);

  const local = decodeVinLocalFree(c.vin);
  expect(local, `${c.label}: local decode`).not.toBeNull();
  expect(local!.make, `${c.label}: local make`).toBe(c.make);
  expect(local!.model?.toLowerCase(), `${c.label}: local model`).toContain(c.modelContains.toLowerCase());
}

describe("brand coverage QA", () => {
  for (const c of CASES) {
    it(`${c.label} — ${c.vin}`, () => assertDecode(c));
  }
});

describe("brand coverage — no cross-brand contamination", () => {
  it("BMW VIN never decodes as Mercedes", () => {
    const r = decodeVin("WBA3A5C55FK123456");
    expect(r.make).toBe("BMW");
    expect(r.model?.toLowerCase()).not.toContain("mercedes");
    expect(r.model?.toLowerCase()).not.toContain("class");
  });

  it("BMW X1 WBA71 never decodes as 7 Series", () => {
    const r = decodeVin("WBA71BX03P9R09775");
    expect(r.make).toBe("BMW");
    expect(r.model?.toLowerCase()).toContain("x1");
    expect(r.model?.toLowerCase()).not.toContain("7 series");
  });

  it("Mercedes W1K decodes as Mercedes-Benz with chassis model", () => {
    const r = decodeVin("W1K213046GA123456");
    expect(r.make).toBe("Mercedes-Benz");
    expect(r.model?.toLowerCase()).toContain("e-class");
  });

  it("US Audi WA1 never returns null make", () => {
    const r = decodeVin("WA1LFAFP5HA123456");
    expect(r.make).toBe("Audi");
    expect(r.model?.toLowerCase()).toContain("q5");
  });

  it("VW Tiguan WVG never returns null make", () => {
    const r = decodeVin("WVGZZZ5NZDW535045");
    expect(r.make).toBe("Volkswagen");
    expect(r.model?.toLowerCase()).toContain("tiguan");
  });

  it("Fiat 500 platform 312 never decodes as Punto", () => {
    const r = decodeVin("ZFA31200000745586");
    expect(r.model).toBe("500");
  });

  it("Škoda Octavia NX code not decoded as Fabia", () => {
    const r = decodeVin("TMBJP7NX5MY012345");
    expect(r.model?.toLowerCase()).toContain("octavia");
    expect(r.model?.toLowerCase()).not.toContain("fabia");
  });

  it("Dacia Duster never decodes as Renault", () => {
    const r = decodeVin("UU1DJF11065848712");
    expect(r.make).toBe("Dacia");
    expect(r.model?.toLowerCase()).toContain("duster");
  });

  it("Cupra Formentor never decodes as SEAT", () => {
    const r = decodeVin("VSSZZZKM7MR123456");
    expect(r.make).toBe("Cupra");
    expect(r.model?.toLowerCase()).toContain("formentor");
  });

  it("SEAT León still decodes as SEAT not Cupra", () => {
    const r = decodeVin("VSSZZZ5FZFR123456");
    expect(r.make).toBe("SEAT");
    expect(r.model?.toLowerCase()).toContain("león");
  });

  it("Citroën C3 EU ZZZ is not mislabeled as DS", () => {
    const r = decodeVin("VF7ZZZABGR1234567");
    expect(r.make).toBe("Citroën");
    expect(r.model?.toLowerCase()).toContain("c3");
  });

  it("LYV VIN without Polestar prefix does not force Polestar make", () => {
    const r = decodeVin("LYVXZE1A0N0123456");
    expect(r.make).not.toBe("Polestar");
    // Letter X + MY2022 is a valid Volvo China line decode (XC40), not a Polestar invent.
    expect(r.make).toBe("Volvo");
  });

  it("VR1 without DS prefix does not guess DS 7 model", () => {
    const r = decodeVin("VR1AAAA0001234567");
    expect(r.make).toBe("DS Automobiles");
    expect(r.model).toBeNull();
  });
});
