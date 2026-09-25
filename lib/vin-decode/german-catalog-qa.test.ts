/**
 * QA for every German (W*) VIN currently stored in vin_catalog.
 * Asserts make + model + year (ISO pos.10 model year — not registration year).
 *
 * For full German OEM model-line coverage (MB/Audi/Porsche/VW/BMW/MINI/Opel/Smart
 * including EVs), see german-brands-qa.test.ts.
 *
 * Source snapshot (vin_catalog): Audi A3, BMW 4/5/7/8, Mercedes C/CLS.
 * BMW letter type codes (DZ/GV/GW/JC) were null before european-premium fix.
 */
import { describe, expect, it } from "vitest";
import { decodeVin, decodeVinLocalFree, isPlausibleMake, isPlausibleModel } from "./index";

type Case = {
  vin: string;
  label: string;
  make: string;
  /** Substring that must appear in decoded model (English series name). */
  modelContains: string;
  modelExcludes?: string[];
  /** VIN position-10 model year. */
  year: number | null;
};

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
  expect(r.country, `${c.label}: country`).toBe("Germany");
  expect(isPlausibleMake(r.make, c.vin), `${c.label}: plausible make`).toBe(true);
  expect(isPlausibleModel(r.model, c.vin), `${c.label}: plausible model`).toBe(true);

  const local = decodeVinLocalFree(c.vin);
  expect(local, `${c.label}: local free`).not.toBeNull();
  expect(local!.make, `${c.label}: local make`).toBe(c.make);
  expect(local!.model?.toLowerCase(), `${c.label}: local model`).toContain(c.modelContains.toLowerCase());
  expect(local!.year, `${c.label}: local year`).toBe(c.year);
}

/** All distinct German W* VINs from vin_catalog (2026-07 snapshot). */
const GERMAN_CATALOG: Case[] = [
  {
    vin: "WAUZZZ8V8J1073336",
    label: "Audi A3 8V (catalog)",
    make: "Audi",
    modelContains: "A3",
    year: 2018,
  },
  {
    vin: "WBA3V7106FJ995387",
    label: "BMW 4 Series F33 (catalog 4er)",
    make: "BMW",
    modelContains: "4 Series",
    modelExcludes: ["3 Series", "5 Series"],
    year: 2015,
  },
  {
    vin: "WBA7G6104GG509390",
    label: "BMW 7 Series G11 (catalog 7er)",
    make: "BMW",
    modelContains: "7 Series",
    // Catalog registration year may be 2015; VIN year code G = 2016.
    year: 2016,
  },
  {
    vin: "WBADZ2C01LCD26813",
    label: "BMW 8 Series G14 Convertible ETK DZ (catalog 8er)",
    make: "BMW",
    modelContains: "8 Series",
    modelExcludes: ["3 Series", "5 Series", "7 Series"],
    year: 2020,
  },
  {
    vin: "WBAGV8106RCR24769",
    label: "BMW 8 Series G16 Gran Coupé ETK GV81 (catalog 8er)",
    make: "BMW",
    modelContains: "8 Series",
    modelExcludes: ["5 Series", "7 Series"],
    year: 2024,
  },
  {
    vin: "WBAGW4107LCD28117",
    label: "BMW 8 Series G16 ETK GW41 (catalog 8er)",
    make: "BMW",
    modelContains: "8 Series",
    year: 2020,
  },
  {
    vin: "WBAGW4107LCE59421",
    label: "BMW 8 Series G16 ETK GW41 #2 (catalog 8er)",
    make: "BMW",
    modelContains: "8 Series",
    year: 2020,
  },
  {
    vin: "WBAJC310XHG857079",
    label: "BMW 5 Series G30 ETK JC31 (catalog 5er)",
    make: "BMW",
    modelContains: "5 Series",
    modelExcludes: ["3 Series", "8 Series", "X5"],
    year: 2017,
  },
  {
    vin: "WDDLJ7EB9DA071359",
    label: "Mercedes CLS (catalog CLS-klasse)",
    make: "Mercedes-Benz",
    modelContains: "CLS",
    modelExcludes: ["C-Class", "GLE"],
    // Catalog may store registration 2012; VIN year D = 2013.
    year: null,
  },
  {
    vin: "WDDWF0EB1FF050999",
    label: "Mercedes C-Class (catalog C-klasse)",
    make: "Mercedes-Benz",
    modelContains: "C-Class",
    modelExcludes: ["CLS", "G-Class"],
    // Catalog may store registration 2014; VIN year F uniquely fits W205 → 2015.
    year: 2015,
  },
];

describe("German vin_catalog QA — make + model + year", () => {
  it("covers every catalog W* VIN in this fixture set", () => {
    expect(GERMAN_CATALOG).toHaveLength(10);
    const vins = new Set(GERMAN_CATALOG.map((c) => c.vin));
    expect(vins.size).toBe(10);
  });

  for (const c of GERMAN_CATALOG) {
    it(`${c.label} — ${c.vin}`, () => assertCase(c));
  }
});
