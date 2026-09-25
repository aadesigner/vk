/**
 * Expanded make/model/year QA for Hyundai, Toyota, Honda, Suzuki, Tesla.
 * Prefer omit over invent — every case locks make + model + year.
 */
import { describe, expect, it } from "vitest";
import { decodeVin, decodeVinLocalFree } from "./index";

type Case = {
  vin: string;
  label: string;
  make: string;
  modelContains: string;
  year: number | null;
  modelExcludes?: string[];
};

function pad(prefix: string, yearChar = "N"): string {
  // Build a 17-char VIN: prefix + filler, year at index 9.
  const base = (prefix.toUpperCase() + "00000000000000000").slice(0, 17).split("");
  base[9] = yearChar;
  return base.join("");
}

function assertCase(c: Case): void {
  expect(c.vin).toHaveLength(17);
  const r = decodeVin(c.vin);
  expect(r.make, `${c.label}: make`).toBe(c.make);
  expect(r.model, `${c.label}: model`).toBeTruthy();
  expect(r.model!.toLowerCase()).toContain(c.modelContains.toLowerCase());
  for (const bad of c.modelExcludes ?? []) {
    expect(r.model!.toLowerCase()).not.toContain(bad.toLowerCase());
  }
  expect(r.year, `${c.label}: year`).toBe(c.year);

  const local = decodeVinLocalFree(c.vin);
  expect(local).not.toBeNull();
  expect(local!.make).toBe(c.make);
  expect(local!.model?.toLowerCase()).toContain(c.modelContains.toLowerCase());
  expect(local!.year).toBe(c.year);
}

const HYUNDAI: Case[] = [
  { vin: pad("KM8J3CA46", "N"), label: "Hyundai Tucson NX4 US", make: "Hyundai", modelContains: "Tucson", year: 2022 },
  { vin: pad("KMHL341BG", "N"), label: "Hyundai IONIQ 5", make: "Hyundai", modelContains: "IONIQ 5", year: 2022 },
  { vin: pad("KMHM341BG", "P"), label: "Hyundai IONIQ 6", make: "Hyundai", modelContains: "IONIQ 6", year: 2023 },
  { vin: pad("5NMS4DAE0", "R"), label: "Hyundai Santa Fe MX5 US", make: "Hyundai", modelContains: "Santa Fe", year: 2024 },
  { vin: pad("KMFWBA7AB", "N"), label: "Hyundai Staria", make: "Hyundai", modelContains: "Staria", year: 2022 },
  { vin: pad("MALA51ABN", "N"), label: "Hyundai Creta IN", make: "Hyundai", modelContains: "Creta", year: 2022 },
  { vin: pad("TMAJ581BG", "P"), label: "Hyundai Kona SX2 EU", make: "Hyundai", modelContains: "Kona", year: 2023 },
];

const TOYOTA: Case[] = [
  { vin: pad("JTMB1RFV0", "K"), label: "Toyota RAV4 XA50", make: "Toyota", modelContains: "RAV4", year: 2019 },
  { vin: pad("4T1BF1FK5", "G"), label: "Toyota Camry XV50 US", make: "Toyota", modelContains: "Camry", year: 2016 },
  { vin: pad("4T1G11FK5", "N"), label: "Toyota Camry XV70 US", make: "Toyota", modelContains: "Camry", year: 2022 },
  { vin: pad("5TFLA5AN0", "N"), label: "Toyota Tacoma N300", make: "Toyota", modelContains: "Tacoma", year: 2022 },
  { vin: pad("5TFJA5DB0", "P"), label: "Toyota Tundra XK70", make: "Toyota", modelContains: "Tundra", year: 2023 },
  { vin: pad("JTEBU5JR0", "N"), label: "Toyota 4Runner", make: "Toyota", modelContains: "4Runner", year: 2022 },
  { vin: pad("JTNB11HK0", "N"), label: "Toyota Mirai", make: "Toyota", modelContains: "Mirai", year: 2022 },
  { vin: pad("SB1ZR3EE0", "N"), label: "Toyota Yaris Cross UK", make: "Toyota", modelContains: "Yaris Cross", year: 2022 },
  { vin: pad("WZ1ZZZSY0", "L"), label: "Toyota GR Supra EU", make: "Toyota", modelContains: "Supra", year: 2020 },
];

const HONDA: Case[] = [
  { vin: "1HGCV1F34LA123456", label: "Honda Accord 10th US", make: "Honda", modelContains: "Accord", year: 2020 },
  { vin: pad("2HGFE2F59", "N"), label: "Honda Civic 11th US", make: "Honda", modelContains: "Civic", year: 2022 },
  // 6th-gen CR-V / 3rd-gen HR-V floors are 2023 — N=2022 stays null (no prefer-recent).
  { vin: pad("5J6RW2H85", "N"), label: "Honda CR-V 6th US", make: "Honda", modelContains: "CR-V", year: null },
  { vin: pad("3CZRU5H5X", "N"), label: "Honda HR-V US", make: "Honda", modelContains: "HR-V", year: null },
  { vin: "SHHFN2000PA123456", label: "Honda Civic FN2 UK", make: "Honda", modelContains: "Civic", year: null },
  { vin: pad("SHHRE4850", "K"), label: "Honda CR-V RW UK", make: "Honda", modelContains: "CR-V", year: 2019 },
  { vin: pad("5FNYF5H9X", "N"), label: "Honda Ridgeline", make: "Honda", modelContains: "Ridgeline", year: 2022 },
];

const SUZUKI: Case[] = [
  { vin: "JS2ZC33S7C4116148", label: "Suzuki Swift JP", make: "Suzuki", modelContains: "Swift", year: null },
  { vin: pad("TSMMH5A5A", "N"), label: "Suzuki Ignis HU", make: "Suzuki", modelContains: "Ignis", year: 2022 },
  { vin: pad("TSMRB5A5A", "N"), label: "Suzuki Across HU", make: "Suzuki", modelContains: "Across", year: 2022 },
  { vin: pad("TSMYA5A5A", "N"), label: "Suzuki Swace HU", make: "Suzuki", modelContains: "Swace", year: 2022 },
  // Fronx floor is 2023 — N=2022 stays null.
  { vin: pad("MA3JEC31S", "N"), label: "Suzuki Fronx IN", make: "Suzuki India", modelContains: "Fronx", year: null },
  { vin: pad("TSMYD5A5A", "P"), label: "Suzuki Vitara HU", make: "Suzuki", modelContains: "Vitara", year: null },
];

const TESLA: Case[] = [
  { vin: "5YJ3E1EA0KF123456", label: "Tesla Model 3 Fremont", make: "Tesla", modelContains: "Model 3", year: 2019 },
  { vin: "7SAYGFEF0PF123456", label: "Tesla Model Y Austin", make: "Tesla", modelContains: "Model Y", year: 2023 },
  { vin: "LRW3E7EK0NC123456", label: "Tesla Model 3 Shanghai", make: "Tesla", modelContains: "Model 3", year: 2022 },
  { vin: "XP7YGCEE0NB123456", label: "Tesla Model Y Berlin", make: "Tesla", modelContains: "Model Y", year: 2022 },
  { vin: "5YJSA1E26HF123456", label: "Tesla Model S", make: "Tesla", modelContains: "Model S", year: 2017 },
  { vin: pad("7G2CEDED0", "P"), label: "Tesla Cybertruck", make: "Tesla", modelContains: "Cybertruck", year: 2023 },
];

describe("focus expand QA — Hyundai make/model/year", () => {
  for (const c of HYUNDAI) it(`${c.label}`, () => assertCase(c));
});

describe("focus expand QA — Toyota make/model/year", () => {
  for (const c of TOYOTA) it(`${c.label}`, () => assertCase(c));
});

describe("focus expand QA — Honda make/model/year", () => {
  for (const c of HONDA) it(`${c.label}`, () => assertCase(c));
});

describe("focus expand QA — Suzuki make/model/year", () => {
  for (const c of SUZUKI) it(`${c.label}`, () => assertCase(c));
});

describe("focus expand QA — Tesla make/model/year", () => {
  for (const c of TESLA) it(`${c.label}`, () => assertCase(c));
});
