/**
 * NA + EU WMI make QA for BMW / Mercedes / Land Rover / Tesla (+ Kia Georgia gap).
 *
 * Sources: NHTSA DecodeWMI + GetWMIsForManufacturer (2026 audit).
 * Contract: make must resolve for payment-peek identity; models only when verified.
 * Do not invent Optima/K5 from bare 5XXG — use longer verified prefixes.
 */
import { describe, expect, it } from "vitest";
import { decodeVin, decodeVinLocalFree } from "./index";

type Case = {
  vin: string;
  label: string;
  make: string;
  modelContains?: string | RegExp;
  modelExcludes?: string[];
  year?: number;
};

function assertCase(c: Case) {
  const r = decodeVin(c.vin);
  expect(r.make, c.label).toBe(c.make);
  if (c.modelContains) {
    expect(r.model, c.label).toMatch(c.modelContains);
  }
  for (const ex of c.modelExcludes ?? []) {
    expect(r.model ?? "", c.label).not.toMatch(new RegExp(ex, "i"));
  }
  if (c.year != null) expect(r.year, c.label).toBe(c.year);

  const free = decodeVinLocalFree(c.vin);
  expect(free?.make, `${c.label} free`).toBe(c.make);
}

describe("NA/EU premium WMI QA — Kia Georgia / Mexico (checkout-critical)", () => {
  const cases: Case[] = [
    {
      vin: "5XXG44J80MG053557",
      label: "Kia K5 Georgia (NHTSA ErrorCode 0)",
      make: "Kia",
      modelContains: /^K5$/,
    },
    {
      vin: "5XYP3DHC0LG045000",
      label: "Kia Telluride Georgia",
      make: "Kia",
      modelContains: /Telluride/i,
      modelExcludes: ["Santa Fe", "Hyundai"],
    },
    {
      vin: "5XYRG4LC5PG123456",
      label: "Kia Sorento Georgia",
      make: "Kia",
      modelContains: /Sorento/i,
      modelExcludes: ["Santa Fe"],
    },
    {
      vin: "3KPFL4A79HE123456",
      label: "Kia Forte Mexico",
      make: "Kia",
      modelContains: /Forte/i,
    },
    {
      vin: "3KMC35LC5KE123456",
      label: "Kia Mexico MPV WMI make-only",
      make: "Kia",
    },
  ];
  for (const c of cases) it(c.label, () => assertCase(c));

  it("5XY is never forced to Hyundai Santa Fe", () => {
    const r = decodeVin("5XYP3DHC0LG045000");
    expect(r.make).toBe("Kia");
    expect(r.model).not.toMatch(/Santa Fe/i);
  });
});

describe("NA/EU premium WMI QA — BMW US / MX / EU", () => {
  const cases: Case[] = [
    {
      vin: "5UXCR6C05L9C12345",
      label: "BMW X7 / SAV USA 5UX",
      make: "BMW",
      year: 2020,
    },
    {
      vin: "5UMBT93506CL12345",
      label: "BMW Z4 legacy 5UM (NHTSA)",
      make: "BMW",
      modelContains: /Z4/i,
      year: 2006,
    },
    {
      vin: "3MW5R7J04M8C12345",
      label: "BMW 3 Series Mexico 3MW",
      make: "BMW",
      modelContains: /3 Series/i,
      year: 2021,
    },
    {
      vin: "WBA3V1100FJ123456",
      label: "BMW 3/4 Series EU WBA",
      make: "BMW",
      modelContains: /3 Series|4 Series/i,
      year: 2015,
    },
    {
      vin: "WBS8M9C50J5G12345",
      label: "BMW M WBS make",
      make: "BMW M",
    },
    {
      vin: "5YM23EC05N9C12345",
      label: "BMW USA MPV 5YM make",
      make: "BMW",
    },
  ];
  for (const c of cases) it(c.label, () => assertCase(c));
});

describe("NA/EU premium WMI QA — Mercedes US / EU", () => {
  const cases: Case[] = [
    {
      vin: "4JGDA5HB6HA123456",
      label: "MB GLE USA 4JG",
      make: "Mercedes-Benz",
      modelContains: /GLE/i,
      year: 2017,
    },
    {
      vin: "W1K5J4GB1LV095893",
      label: "MB CLA EU W1K (real)",
      make: "Mercedes-Benz",
      modelContains: /CLA/i,
    },
    {
      vin: "WDDSJ5CB0EN016022",
      label: "MB CLA EU WDD (real)",
      make: "Mercedes-Benz",
      modelContains: /CLA/i,
    },
    {
      vin: "W1NYC7HJ0LX340589",
      label: "MB G-Class W1N",
      make: "Mercedes-Benz",
      modelContains: /G-Class|G Class|G 6/i,
    },
    {
      vin: "55SWF4KB0FU123456",
      label: "MB USA 55S make-only (no invented model)",
      make: "Mercedes-Benz",
    },
    {
      vin: "W1L1830451A123456",
      label: "MB W1L make-only (NHTSA MB AG; VDS not assumed)",
      make: "Mercedes-Benz",
    },
    {
      vin: "WDB2030041A182692",
      label: "MB classic WDB EU",
      make: "Mercedes-Benz",
    },
  ];
  for (const c of cases) it(c.label, () => assertCase(c));

  it("55S / W1L resolve make without inventing a model from WDD letter VDS", () => {
    expect(decodeVin("55SWF4KB0FU123456").model).toBeNull();
    expect(decodeVin("W1L1830451A123456").model).toBeNull();
  });
});

describe("NA/EU premium WMI QA — Land Rover / Range Rover", () => {
  const cases: Case[] = [
    {
      vin: "SALGS2SE0MA123456",
      label: "Range Rover L405 SAL",
      make: "Land Rover",
      modelContains: /Range Rover/i,
      year: 2021,
    },
    {
      vin: "SALWA2BKGJA402093",
      label: "Range Rover Sport SAL (catalog sample)",
      make: "Land Rover",
      modelContains: /Range Rover|Sport/i,
    },
    {
      vin: "SAJZZZBG1MA123456",
      label: "Jaguar F-Pace sibling SAJ still Jaguar",
      make: "Jaguar",
      modelContains: /F-Pace/i,
    },
  ];
  for (const c of cases) it(c.label, () => assertCase(c));
});

describe("NA/EU premium WMI QA — Tesla US / EU / CN", () => {
  const cases: Case[] = [
    {
      vin: "5YJ3E1EA0KF123456",
      label: "Tesla Model 3 Fremont 5YJ",
      make: "Tesla",
      modelContains: /Model 3/i,
      year: 2019,
    },
    {
      vin: "7SAYGFEF0PF123456",
      label: "Tesla Model Y 7SA",
      make: "Tesla",
      modelContains: /Model Y/i,
      year: 2023,
    },
    {
      vin: "5YJSA1E26HF123456",
      label: "Tesla Model S 5YJ",
      make: "Tesla",
      modelContains: /Model S/i,
      year: 2017,
    },
    {
      vin: "LRW3E7EK0NC123456",
      label: "Tesla Model 3 Shanghai LRW",
      make: "Tesla",
      modelContains: /Model 3/i,
      year: 2022,
    },
    {
      vin: "XP7YGCEE0NB123456",
      label: "Tesla Model Y Berlin XP7",
      make: "Tesla",
      modelContains: /Model Y/i,
      year: 2022,
    },
    {
      vin: "SFZRE2B15B0012345",
      label: "Tesla SFZ WMI make (NHTSA)",
      make: "Tesla",
      year: 2011,
    },
  ];
  for (const c of cases) it(c.label, () => assertCase(c));
});
