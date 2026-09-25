/**
 * Exhaustive German OEM QA — Mercedes-Benz, Audi, Porsche, Volkswagen, BMW,
 * MINI, Opel, Smart.
 *
 * Every case asserts make + model + year (ISO VIN pos.10).
 * Includes ICE and electric lines the decoder claims to support.
 * Sibling negatives prevent Range Rover-style contamination (EQS vs EQE, ID.3 vs ID.4, etc.).
 */
import { describe, expect, it } from "vitest";
import { decodeVin, decodeVinLocalFree, isPlausibleMake, isPlausibleModel } from "./index";

type Case = {
  vin: string;
  label: string;
  make: string;
  modelContains: string;
  /** ISO year when uniquely resolved; null when letter cycle is ambiguous (no guessing). */
  year: number | null;
  modelExcludes?: string[];
  /** Skip Germany country assert (e.g. Smart China JV HES*). */
  countryGermany?: boolean;
};

/** EU ZZZ typed VIN: WMI + ZZZ + type78 + check + year + plant + serial. */
function zzz(wmi: string, type78: string, yearChar: string): string {
  return `${wmi}ZZZ${type78}A${yearChar}A123456`;
}

function pad(prefix: string, yearChar: string): string {
  const base = (prefix.toUpperCase() + "00000000000000000").slice(0, 17).split("");
  base[9] = yearChar;
  return base.join("");
}

function porsche(wmi: "WP0" | "WP1", type78: string, type12: string, yearChar: string): string {
  return `${wmi}ZZZ${type78}A${yearChar}A${type12}12345`;
}

function assertCase(c: Case): void {
  expect(c.vin, `${c.label}: length`).toHaveLength(17);

  const r = decodeVin(c.vin);
  expect(r.make, `${c.label}: make`).toBe(c.make);
  expect(r.model, `${c.label}: model present`).toBeTruthy();
  expect(r.model!.toLowerCase(), `${c.label}: model`).toContain(c.modelContains.toLowerCase());
  for (const bad of c.modelExcludes ?? []) {
    expect(r.model!.toLowerCase(), `${c.label}: exclude ${bad}`).not.toContain(bad.toLowerCase());
  }
  expect(r.year, `${c.label}: year`).toBe(c.year);
  if (c.countryGermany !== false && c.vin.startsWith("W")) {
    expect(r.country, `${c.label}: country`).toBe("Germany");
  }
  expect(isPlausibleMake(r.make, c.vin), `${c.label}: plausible make`).toBe(true);
  expect(isPlausibleModel(r.model, c.vin), `${c.label}: plausible model`).toBe(true);

  const local = decodeVinLocalFree(c.vin);
  expect(local, `${c.label}: local`).not.toBeNull();
  expect(local!.make).toBe(c.make);
  expect(local!.model?.toLowerCase()).toContain(c.modelContains.toLowerCase());
  expect(local!.year).toBe(c.year);
}

// ── Mercedes-Benz (ICE + EQ) ─────────────────────────────────────────────────
const MERCEDES: Case[] = [
  { vin: "WDD177087KA123456", label: "MB A-Class W177", make: "Mercedes-Benz", modelContains: "A-Class", year: 2019 },
  { vin: "WDD118087KA123456", label: "MB CLA C118", make: "Mercedes-Benz", modelContains: "CLA", year: 2019 },
  { vin: "WDD246087JA123456", label: "MB B-Class W246", make: "Mercedes-Benz", modelContains: "B-Class", year: 2018 },
  { vin: "WDD205037FA123456", label: "MB C-Class W205", make: "Mercedes-Benz", modelContains: "C-Class", year: 2015 },
  { vin: "WDD206087MA123456", label: "MB C-Class W206", make: "Mercedes-Benz", modelContains: "C-Class", year: 2021 },
  { vin: "WDD213042GA123456", label: "MB E-Class W213", make: "Mercedes-Benz", modelContains: "E-Class", year: 2016, modelExcludes: ["C-Class"] },
  { vin: "WDD214087PA123456", label: "MB E-Class W214", make: "Mercedes-Benz", modelContains: "E-Class", year: 2023, modelExcludes: ["C-Class"] },
  { vin: "WDD222087HA123456", label: "MB S-Class W222", make: "Mercedes-Benz", modelContains: "S-Class", year: 2017 },
  { vin: "WDD223087LA123456", label: "MB S-Class W223", make: "Mercedes-Benz", modelContains: "S-Class", year: 2020 },
  { vin: "WDDLJ7EB5KA123456", label: "MB CLS C257", make: "Mercedes-Benz", modelContains: "CLS", year: 2019, modelExcludes: ["GLE"] },
  { vin: "WDD236087PA123456", label: "MB CLE C236", make: "Mercedes-Benz", modelContains: "CLE", year: 2023 },
  { vin: "WDD253149GA123456", label: "MB GLC X253", make: "Mercedes-Benz", modelContains: "GLC", year: 2016 },
  { vin: "WDD254087NA123456", label: "MB GLC X254", make: "Mercedes-Benz", modelContains: "GLC", year: 2022 },
  { vin: "WDD166087GA123456", label: "MB GLE W166", make: "Mercedes-Benz", modelContains: "GLE", year: 2016 },
  { vin: "WDD167087KA123456", label: "MB GLE/GLS 167", make: "Mercedes-Benz", modelContains: "GLE", year: 2019 },
  { vin: "WDD247087LA123456", label: "MB GLA/GLB 247", make: "Mercedes-Benz", modelContains: "GLA", year: 2020 },
  { vin: "WDD251087AA123456", label: "MB GLK", make: "Mercedes-Benz", modelContains: "GLK", year: 2010 },
  { vin: "WDD463276LA123456", label: "MB G-Class", make: "Mercedes-Benz", modelContains: "G-Class", year: null },
  { vin: "WDD192087PA123456", label: "MB AMG GT", make: "Mercedes-Benz", modelContains: "AMG GT", year: 2023 },
  { vin: "WDD197087NA123456", label: "MB SL R232", make: "Mercedes-Benz", modelContains: "SL", year: 2022 },
  // Electric EQ line
  { vin: "WDD290087MA123456", label: "MB EQS sedan", make: "Mercedes-Benz", modelContains: "EQS", year: 2021, modelExcludes: ["EQE", "SUV"] },
  { vin: "WDD294087NA123456", label: "MB EQE sedan", make: "Mercedes-Benz", modelContains: "EQE", year: 2022, modelExcludes: ["EQS"] },
  { vin: "WDD296087NA123456", label: "MB EQS SUV", make: "Mercedes-Benz", modelContains: "EQS SUV", year: 2022, modelExcludes: ["EQE"] },
  { vin: "WDD243000MA123456", label: "MB EQA/EQB", make: "Mercedes-Benz", modelContains: "EQ", year: 2021, modelExcludes: ["B-Class", "EQS", "EQE", "EQC"] },
  { vin: "WDD293087KA123456", label: "MB EQC", make: "Mercedes-Benz", modelContains: "EQC", year: 2019, modelExcludes: ["EQS", "EQE"] },
  { vin: pad("WDC9A5HB6", "N"), label: "MB EQB letter 9", make: "Mercedes-Benz", modelContains: "EQB", year: 2022, modelExcludes: ["EQA", "EQS"] },
  // Letter G = EQE SUV when year uniquely fits X294 window (N → 2022).
  { vin: pad("WDCG4JB0N", "N"), label: "MB EQE SUV letter G", make: "Mercedes-Benz", modelContains: "EQE SUV", year: 2022, modelExcludes: ["EQS"] },
  // EU ZZZ + W1K
  { vin: "WDDZZZ213GAA12345", label: "MB E-Class EU ZZZ", make: "Mercedes-Benz", modelContains: "E-Class", year: 2016 },
  { vin: "WDDZZZ296NAA12345", label: "MB EQS SUV EU ZZZ", make: "Mercedes-Benz", modelContains: "EQS SUV", year: 2022 },
  { vin: "W1K177087KA123456", label: "MB A-Class W1K", make: "Mercedes-Benz", modelContains: "A-Class", year: 2019 },
];

// ── Audi (ICE + e-tron) ──────────────────────────────────────────────────────
const AUDI: Case[] = [
  { vin: zzz("WAU", "8V", "J"), label: "Audi A3 8V", make: "Audi", modelContains: "A3", year: 2018 },
  { vin: zzz("WAU", "FF", "N"), label: "Audi A3 FF", make: "Audi", modelContains: "A3", year: 2022 },
  // Typ 8X ended ~2018; letter K is outside the verified window — omit year.
  { vin: zzz("WAU", "8X", "K"), label: "Audi A1", make: "Audi", modelContains: "A1", year: null },
  { vin: zzz("WAU", "F4", "N"), label: "Audi A4 B9", make: "Audi", modelContains: "A4", year: 2022, modelExcludes: ["A5"] },
  { vin: zzz("WAU", "F5", "N"), label: "Audi A5", make: "Audi", modelContains: "A5", year: 2022, modelExcludes: ["A4"] },
  { vin: zzz("WAU", "FN", "P"), label: "Audi A6 C9", make: "Audi", modelContains: "A6", year: 2023 },
  { vin: "WAUZZZ4G2DN123456", label: "Audi A6 C7", make: "Audi", modelContains: "A6", year: 2013, modelExcludes: ["A7"] },
  { vin: "WAUZZZ4G5DN123456", label: "Audi A6 Avant C7", make: "Audi", modelContains: "A6", year: 2013, modelExcludes: ["A7"] },
  { vin: zzz("WAU", "F8", "L"), label: "Audi A8", make: "Audi", modelContains: "A8", year: 2020 },
  { vin: zzz("WAU", "F3", "N"), label: "Audi Q3", make: "Audi", modelContains: "Q3", year: 2022 },
  { vin: zzz("WAU", "FY", "N"), label: "Audi Q5 FY", make: "Audi", modelContains: "Q5", year: 2022, modelExcludes: ["e-tron"] },
  { vin: zzz("WAU", "F7", "N"), label: "Audi Q7", make: "Audi", modelContains: "Q7", year: 2022 },
  { vin: zzz("WAU", "F1", "N"), label: "Audi Q8", make: "Audi", modelContains: "Q8", year: 2022, modelExcludes: ["e-tron"] },
  { vin: zzz("WAU", "FG", "K"), label: "Audi R8", make: "Audi", modelContains: "R8", year: 2019 },
  { vin: zzz("WAU", "FV", "K"), label: "Audi TT", make: "Audi", modelContains: "TT", year: 2019 },
  // Electric e-tron line
  { vin: zzz("WAU", "GB", "N"), label: "Audi Q4 e-tron", make: "Audi", modelContains: "Q4 e-tron", year: 2022 },
  { vin: zzz("WAU", "FZ", "N"), label: "Audi Q4 e-tron FZ", make: "Audi", modelContains: "Q4 e-tron", year: 2022 },
  { vin: zzz("WAU", "GF", "P"), label: "Audi Q6 e-tron", make: "Audi", modelContains: "Q6 e-tron", year: 2023 },
  { vin: zzz("WAU", "GH", "P"), label: "Audi A6 e-tron", make: "Audi", modelContains: "A6 e-tron", year: 2023 },
  { vin: zzz("WAU", "FW", "N"), label: "Audi e-tron GT", make: "Audi", modelContains: "e-tron GT", year: 2022 },
  { vin: zzz("WAU", "GE", "N"), label: "Audi e-tron / Q8 e-tron (pre-2024)", make: "Audi", modelContains: "e-tron", year: 2022 },
  { vin: zzz("WAU", "GE", "R"), label: "Audi Q8 e-tron 2024+", make: "Audi", modelContains: "Q8 e-tron", year: 2024 },
  { vin: "WA1LFAFP5HA123456", label: "Audi Q5 US", make: "Audi", modelContains: "Q5", year: 2017 },
];

// ── Porsche (ICE + EV) ───────────────────────────────────────────────────────
const PORSCHE: Case[] = [
  // 911 type "99" spans many generations — year omitted without a generation window.
  { vin: zzz("WP0", "99", "N"), label: "Porsche 911", make: "Porsche", modelContains: "911", year: null },
  { vin: zzz("WP0", "97", "N"), label: "Porsche Panamera 97", make: "Porsche", modelContains: "Panamera", year: 2022, modelExcludes: ["911"] },
  { vin: zzz("WP0", "98", "N"), label: "Porsche Boxster/Cayman", make: "Porsche", modelContains: "Boxster", year: 2022 },
  { vin: zzz("WP0", "92", "N"), label: "Porsche Cayenne WP0", make: "Porsche", modelContains: "Cayenne", year: 2022 },
  { vin: zzz("WP1", "9Z", "N"), label: "Porsche Macan ICE", make: "Porsche", modelContains: "Macan", year: 2022, modelExcludes: ["Electric"] },
  // Electric
  { vin: zzz("WP0", "9Y", "N"), label: "Porsche Taycan", make: "Porsche", modelContains: "Taycan", year: 2022 },
  { vin: porsche("WP0", "Y1", "A", "N"), label: "Porsche Taycan Y1A", make: "Porsche", modelContains: "Taycan", year: 2022 },
  { vin: porsche("WP1", "XA", "0", "P"), label: "Porsche Macan Electric XA0", make: "Porsche", modelContains: "Macan Electric", year: 2023 },
  { vin: porsche("WP1", "XA", "1", "P"), label: "Porsche Macan Electric XA1", make: "Porsche", modelContains: "Macan Electric", year: 2023 },
  { vin: porsche("WP1", "XA", "2", "R"), label: "Porsche Macan Electric XA2", make: "Porsche", modelContains: "Macan Electric", year: 2024 },
];

// ── Volkswagen (ICE + ID.) ───────────────────────────────────────────────────
const VOLKSWAGEN: Case[] = [
  { vin: zzz("WVW", "AU", "K"), label: "VW Golf Mk7", make: "Volkswagen", modelContains: "Golf", year: 2019 },
  { vin: zzz("WVW", "CD", "N"), label: "VW Golf Mk8", make: "Volkswagen", modelContains: "Golf", year: 2022 },
  { vin: zzz("WVW", "AW", "N"), label: "VW Polo", make: "Volkswagen", modelContains: "Polo", year: 2022 },
  { vin: zzz("WVW", "3C", "J"), label: "VW Passat", make: "Volkswagen", modelContains: "Passat", year: 2018 },
  // Passat B9 (CJ) from MY2023/24 — letter N=2022 is outside the verified window.
  { vin: zzz("WVW", "CJ", "N"), label: "VW Passat Variant B9", make: "Volkswagen", modelContains: "Passat", year: null },
  { vin: zzz("WVW", "3H", "N"), label: "VW Arteon", make: "Volkswagen", modelContains: "Arteon", year: 2022 },
  // Typ 5N production ended before MY2022 — omit year rather than invent.
  { vin: zzz("WVW", "5N", "N"), label: "VW Tiguan", make: "Volkswagen", modelContains: "Tiguan", year: null },
  { vin: zzz("WVW", "CT", "P"), label: "VW Tiguan CT", make: "Volkswagen", modelContains: "Tiguan", year: 2023 },
  { vin: zzz("WVW", "A1", "N"), label: "VW T-Roc", make: "Volkswagen", modelContains: "T-Roc", year: 2022 },
  { vin: zzz("WVW", "C1", "N"), label: "VW T-Cross", make: "Volkswagen", modelContains: "T-Cross", year: 2022 },
  { vin: zzz("WVW", "R4", "P"), label: "VW Tayron", make: "Volkswagen", modelContains: "Tayron", year: 2023 },
  { vin: zzz("WVW", "CR", "N"), label: "VW Touareg CR", make: "Volkswagen", modelContains: "Touareg", year: 2022 },
  { vin: zzz("WVG", "CR", "N"), label: "VW Touareg Bratislava", make: "Volkswagen", modelContains: "Touareg", year: 2022, modelExcludes: ["Q7"] },
  // Typ 1T ended ~2015; MY2019 Touran is 5T.
  { vin: zzz("WVW", "1T", "K"), label: "VW Touran", make: "Volkswagen", modelContains: "Touran", year: null },
  { vin: zzz("WVW", "5T", "K"), label: "VW Touran 5T", make: "Volkswagen", modelContains: "Touran", year: 2019 },
  { vin: "WVWZZZ9NZ8D029780", label: "VW Polo 9N (not Touran)", make: "Volkswagen", modelContains: "Polo", year: 2008, modelExcludes: ["Touran"] },
  { vin: zzz("WVW", "2H", "N"), label: "VW Amarok", make: "Volkswagen", modelContains: "Amarok", year: 2022 },
  { vin: zzz("WVW", "SK", "N"), label: "VW Caddy", make: "Volkswagen", modelContains: "Caddy", year: 2022 },
  { vin: zzz("WV2", "SF", "N"), label: "VW Multivan T7", make: "Volkswagen", modelContains: "Multivan", year: 2022 },
  // Electric ID. line
  { vin: zzz("WVW", "E1", "N"), label: "VW ID.3", make: "Volkswagen", modelContains: "ID.3", year: 2022, modelExcludes: ["ID.4", "ID.5", "ID.7"] },
  { vin: zzz("WVW", "E2", "N"), label: "VW ID.4", make: "Volkswagen", modelContains: "ID.4", year: 2022, modelExcludes: ["ID.3", "ID.5"] },
  { vin: zzz("WVW", "E3", "N"), label: "VW ID.5", make: "Volkswagen", modelContains: "ID.5", year: 2022, modelExcludes: ["ID.4"] },
  { vin: zzz("WVW", "E4", "P"), label: "VW ID.7", make: "Volkswagen", modelContains: "ID.7", year: 2023, modelExcludes: ["ID.3"] },
  { vin: zzz("WVG", "EB", "N"), label: "VW ID. Buzz", make: "Volkswagen", modelContains: "ID. Buzz", year: 2022 },
];

// ── BMW (ICE + i*) ───────────────────────────────────────────────────────────
const BMW: Case[] = [
  { vin: "WBA1C1105FK123456", label: "BMW 1 Series F20", make: "BMW", modelContains: "1 Series", year: 2015 },
  { vin: "WBA1H1105LK123456", label: "BMW 1 Series F40", make: "BMW", modelContains: "1 Series", year: 2020 },
  { vin: "WBA2T1105MK123456", label: "BMW 2 Series G42", make: "BMW", modelContains: "2 Series", year: 2021 },
  { vin: "WBA3W1105LK123456", label: "BMW 3 Series G20", make: "BMW", modelContains: "3 Series", year: 2020, modelExcludes: ["4 Series"] },
  { vin: "WBA3V7106FJ995387", label: "BMW 4 Series F33", make: "BMW", modelContains: "4 Series", year: 2015, modelExcludes: ["3 Series"] },
  { vin: "WBA5E1105HJ123456", label: "BMW 5 Series G30", make: "BMW", modelContains: "5 Series", year: 2017 },
  { vin: "WBAJC310XHG857079", label: "BMW 5 Series ETK JC", make: "BMW", modelContains: "5 Series", year: 2017 },
  { vin: "WBA5U1105RK123456", label: "BMW 5 Series G60", make: "BMW", modelContains: "5 Series", year: 2024 },
  { vin: "WBA6D6C53HG388222", label: "BMW 6 Series", make: "BMW", modelContains: "6 Series", year: 2017 },
  { vin: "WBA7G6104GG509390", label: "BMW 7 Series", make: "BMW", modelContains: "7 Series", year: 2016 },
  { vin: "WBADZ2C01LCD26813", label: "BMW 8 Series ETK DZ", make: "BMW", modelContains: "8 Series", year: 2020 },
  { vin: "WBAGV8106RCR24769", label: "BMW 8 Series ETK GV", make: "BMW", modelContains: "8 Series", year: 2024 },
  // WBA71 is shared F48/U11 — year omitted without a unique chassis window.
  { vin: "WBA71BX03P9R09775", label: "BMW X1", make: "BMW", modelContains: "X1", year: null, modelExcludes: ["7 Series"] },
  { vin: "WBA72BX03K9R09775", label: "BMW X2", make: "BMW", modelContains: "X2", year: 2019, modelExcludes: ["7 Series"] },
  { vin: "WBA31BH00P9R09775", label: "BMW X3", make: "BMW", modelContains: "X3", year: 2023, modelExcludes: ["3 Series"] },
  { vin: "WBA13A000P9R09775", label: "BMW X4", make: "BMW", modelContains: "X4", year: 2023 },
  { vin: "WBA53A000P9R09775", label: "BMW X5", make: "BMW", modelContains: "X5", year: 2023, modelExcludes: ["5 Series"] },
  { vin: "WBA11A000P9R09775", label: "BMW X6", make: "BMW", modelContains: "X6", year: 2023 },
  { vin: "WBA21EM00P9R09775", label: "BMW X7", make: "BMW", modelContains: "X7", year: 2023, modelExcludes: ["2 Series"] },
  { vin: "WBS3A0000FK123456", label: "BMW M3", make: "BMW M", modelContains: "M3", year: 2015 },
  { vin: "WBS4A0000FK123456", label: "BMW M4", make: "BMW M", modelContains: "M4", year: 2015 },
  { vin: "WBS5A0000FK123456", label: "BMW M5", make: "BMW M", modelContains: "M5", year: 2015 },
  // Electric / electrified i*
  { vin: "WBY1Z4100F0123456", label: "BMW i3", make: "BMW", modelContains: "i3", year: 2015, modelExcludes: ["i4", "i7", "iX"] },
  { vin: "WBY51CF00NF123456", label: "BMW i4", make: "BMW", modelContains: "i4", year: 2022, modelExcludes: ["i3", "i7"] },
  { vin: "WBY2Z4100N0123456", label: "BMW i7", make: "BMW", modelContains: "i7", year: 2022, modelExcludes: ["i3", "i4"] },
  { vin: "WBY7E2105NV123456", label: "BMW iX", make: "BMW", modelContains: "iX", year: 2022, modelExcludes: ["i3", "i4", "i7", "i8"] },
  { vin: "WBY8Z4100F0123456", label: "BMW i8", make: "BMW", modelContains: "i8", year: 2015, modelExcludes: ["i3", "iX"] },
];

// ── MINI ─────────────────────────────────────────────────────────────────────
const MINI: Case[] = [
  { vin: pad("WMWXP7", "N"), label: "MINI Cooper F56", make: "MINI", modelContains: "Cooper", year: 2022, modelExcludes: ["Clubman", "Countryman"] },
  { vin: pad("WMWXP9", "M"), label: "MINI Cooper F55", make: "MINI", modelContains: "Cooper", year: 2021, modelExcludes: ["Clubman"] },
  { vin: pad("WMWXS7", "N"), label: "MINI Clubman", make: "MINI", modelContains: "Clubman", year: 2022, modelExcludes: ["Countryman"] },
  { vin: pad("WMWXS1", "N"), label: "MINI Countryman", make: "MINI", modelContains: "Countryman", year: 2022, modelExcludes: ["Clubman"] },
  { vin: pad("WMWZP7", "P"), label: "MINI Cooper SE Electric", make: "MINI", modelContains: "Cooper SE", year: 2023 },
];

// ── Opel ─────────────────────────────────────────────────────────────────────
const OPEL: Case[] = [
  // W0LP/W0LB/W0LT span multiple generations — letter years stay null.
  { vin: pad("W0LP", "N"), label: "Opel Astra", make: "Opel", modelContains: "Astra", year: null },
  { vin: pad("W0L0ADF", "P"), label: "Opel Astra L", make: "Opel", modelContains: "Astra", year: 2023 },
  { vin: pad("W0LB", "N"), label: "Opel Corsa", make: "Opel", modelContains: "Corsa", year: null, modelExcludes: ["Corsa-e"] },
  { vin: pad("W0L0ZEC", "N"), label: "Opel Corsa-e", make: "Opel", modelContains: "Corsa-e", year: 2022 },
  // W0LM Mokka window ends 2019 — letter N=2022 omitted.
  { vin: pad("W0LM", "N"), label: "Opel Mokka", make: "Opel", modelContains: "Mokka", year: null },
  { vin: pad("W0LN", "N"), label: "Opel Grandland", make: "Opel", modelContains: "Grandland", year: 2022 },
  { vin: pad("W0LT", "K"), label: "Opel Insignia", make: "Opel", modelContains: "Insignia", year: null },
  // Frontera (2024+) — letter P=2023 is before verified window.
  { vin: pad("W0LF", "P"), label: "Opel Frontera", make: "Opel", modelContains: "Frontera", year: null },
  { vin: pad("W0L4", "N"), label: "Opel Crossland", make: "Opel", modelContains: "Crossland", year: 2022 },
  { vin: pad("W0LV", "N"), label: "Opel Vivaro", make: "Opel", modelContains: "Vivaro", year: 2022 },
  { vin: pad("W0LC", "N"), label: "Opel Combo", make: "Opel", modelContains: "Combo", year: 2022 },
];

// ── Smart ────────────────────────────────────────────────────────────────────
const SMART: Case[] = [
  // Chassis 451 ended ~2015 — letter K=2019 omitted.
  { vin: pad("WME451", "K"), label: "Smart fortwo 451", make: "Smart", modelContains: "fortwo", year: null },
  { vin: pad("WME453", "K"), label: "Smart forfour", make: "Smart", modelContains: "forfour", year: 2019 },
  { vin: pad("WME450", "9"), label: "Smart fortwo 450", make: "Smart", modelContains: "fortwo", year: 2009 },
  // Chassis 453 ended ~2019 — letter L=2020 omitted.
  { vin: pad("W1A453", "L"), label: "Smart forfour W1A", make: "Smart", modelContains: "forfour", year: null },
  { vin: "HESXR1C49PS069265", label: "Smart #1 EV", make: "Smart", modelContains: "#1", year: 2023, countryGermany: false },
  { vin: "HESCR1C43PS131354", label: "Smart #3 EV", make: "Smart", modelContains: "#3", year: 2023, countryGermany: false },
];

describe("German brands QA — Mercedes-Benz (ICE + EQ)", () => {
  for (const c of MERCEDES) it(`${c.label}`, () => assertCase(c));
});

describe("German brands QA — Audi (ICE + e-tron)", () => {
  for (const c of AUDI) it(`${c.label}`, () => assertCase(c));
});

describe("German brands QA — Porsche (ICE + EV)", () => {
  for (const c of PORSCHE) it(`${c.label}`, () => assertCase(c));
});

describe("German brands QA — Volkswagen (ICE + ID.)", () => {
  for (const c of VOLKSWAGEN) it(`${c.label}`, () => assertCase(c));
});

describe("German brands QA — BMW (ICE + i*)", () => {
  for (const c of BMW) it(`${c.label}`, () => assertCase(c));
});

describe("German brands QA — MINI", () => {
  for (const c of MINI) it(`${c.label}`, () => assertCase(c));
});

describe("German brands QA — Opel (ICE + Corsa-e)", () => {
  for (const c of OPEL) it(`${c.label}`, () => assertCase(c));
});

describe("German brands QA — Smart (ICE + EV)", () => {
  for (const c of SMART) it(`${c.label}`, () => assertCase(c));
});

describe("German brands QA — EV fuel flags", () => {
  it("VW ID.4 is Electric", () => {
    const r = decodeVin(zzz("WVW", "E2", "N"));
    expect(r.fuelType).toBe("Electric");
  });
  it("Porsche Taycan is Electric", () => {
    const r = decodeVin(zzz("WP0", "9Y", "N"));
    expect(r.fuelType).toBe("Electric");
  });
  it("Audi Q4 e-tron is Electric", () => {
    const r = decodeVin(zzz("WAU", "GB", "N"));
    expect(r.fuelType).toBe("Electric");
  });
  it("Porsche Macan Electric is Electric", () => {
    const r = decodeVin(porsche("WP1", "XA", "0", "P"));
    expect(r.fuelType).toBe("Electric");
  });
});
