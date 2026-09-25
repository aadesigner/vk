/**
 * Make / model / year QA for Fiat, Ferrari, Lamborghini, Rolls-Royce, MINI,
 * Land Rover, Jeep, and Ford.
 *
 * Rules:
 * - Every case asserts make + model + year (ISO VIN pos.10).
 * - Prefix / homologation only — no speculative VINs that invent models.
 * - Sibling negatives where lines collide (Range Rover vs Sport, Cooper vs Clubman).
 */
import { describe, expect, it } from "vitest";
import { decodeVin, decodeVinLocalFree, isPlausibleMake, isPlausibleModel } from "./index";

type Case = {
  vin: string;
  label: string;
  make: string;
  modelContains: string;
  year: number | null;
  modelExcludes?: string[];
};

function pad(prefix: string, yearChar = "N"): string {
  const base = (prefix.toUpperCase() + "00000000000000000").slice(0, 17).split("");
  base[9] = yearChar;
  return base.join("");
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
  expect(isPlausibleMake(r.make, c.vin), `${c.label}: plausible make`).toBe(true);
  expect(isPlausibleModel(r.model, c.vin), `${c.label}: plausible model`).toBe(true);

  const local = decodeVinLocalFree(c.vin);
  expect(local, `${c.label}: local free`).not.toBeNull();
  expect(local!.make, `${c.label}: local make`).toBe(c.make);
  expect(local!.model?.toLowerCase(), `${c.label}: local model`).toContain(c.modelContains.toLowerCase());
  expect(local!.year, `${c.label}: local year`).toBe(c.year);
}

const FIAT: Case[] = [
  // Official Fiat type-approval formats — platform 312 splits 500 vs Nuova Panda on pos.11
  { vin: pad("ZFA312", "K"), label: "Fiat 500 (312, pos.11≠3)", make: "Fiat", modelContains: "500", year: null, modelExcludes: ["500X", "500L", "Panda"] },
  { vin: "ZFA312000L3974827", label: "Fiat Nuova Panda (312 + pos.11=3)", make: "Fiat", modelContains: "Panda", year: null, modelExcludes: ["500"] },
  { vin: pad("ZFA169", "L"), label: "Fiat Panda (169)", make: "Fiat", modelContains: "Panda", year: null },
  { vin: pad("ZFA199", "J"), label: "Fiat Punto (199, pos.11≠5/Z)", make: "Fiat", modelContains: "Punto", year: null, modelExcludes: ["500L"] },
  { vin: "ZFA199000M5000000", label: "Fiat 500L (199 + pos.11=5)", make: "Fiat", modelContains: "500L", year: null, modelExcludes: ["500X", "Punto"] },
  { vin: pad("ZFA334", "N"), label: "Fiat 500X (334)", make: "Fiat", modelContains: "500X", year: null, modelExcludes: ["500L", "Tipo"] },
  { vin: pad("ZFA356", "N"), label: "Fiat Tipo (356)", make: "Fiat", modelContains: "Tipo", year: null, modelExcludes: ["500X"] },
  { vin: pad("ZFA270", "K"), label: "Fiat Scudo (270)", make: "Fiat", modelContains: "Scudo", year: null },
  // Platform 225 is shared Qubo/Fiorino — omit model rather than guess (see european-brands).
  // { vin: pad("ZFA225", "K"), label: "Fiat Qubo/Fiorino (225)", ... },
  { vin: pad("ZFA263", "K"), label: "Fiat Doblo", make: "Fiat", modelContains: "Doblo", year: null },
  { vin: pad("ZFA250", "L"), label: "Fiat Ducato 250", make: "Fiat", modelContains: "Ducato", year: null },
  { vin: pad("ZFA0FA", "N"), label: "Fiat 500e", make: "Fiat", modelContains: "500e", year: null },
  { vin: pad("ZCG312", "N"), label: "Fiat 500 ZCG", make: "Fiat", modelContains: "500", year: null, modelExcludes: ["500X", "Panda"] },
];

const FERRARI: Case[] = [
  { vin: pad("ZFFA", "J"), label: "Ferrari 488 GTB", make: "Ferrari", modelContains: "488", year: null, modelExcludes: ["F8", "Roma"] },
  { vin: pad("ZFFB", "L"), label: "Ferrari F8 Tributo", make: "Ferrari", modelContains: "F8", year: null, modelExcludes: ["488"] },
  { vin: pad("ZFFC", "N"), label: "Ferrari Roma", make: "Ferrari", modelContains: "Roma", year: null },
  { vin: pad("ZFFD", "N"), label: "Ferrari SF90 Stradale", make: "Ferrari", modelContains: "SF90", year: null },
  { vin: pad("ZFFE", "K"), label: "Ferrari Portofino", make: "Ferrari", modelContains: "Portofino", year: null },
  { vin: pad("ZFFG", "P"), label: "Ferrari 296 GTB", make: "Ferrari", modelContains: "296", year: null },
  { vin: pad("ZFFH", "P"), label: "Ferrari Purosangue", make: "Ferrari", modelContains: "Purosangue", year: null },
];

const LAMBORGHINI: Case[] = [
  { vin: pad("ZHWB", "N"), label: "Lamborghini Urus", make: "Lamborghini", modelContains: "Urus", year: null, modelExcludes: ["Huracán", "Aventador"] },
  { vin: pad("ZHWC", "L"), label: "Lamborghini Huracán", make: "Lamborghini", modelContains: "Huracán", year: null, modelExcludes: ["Urus"] },
  { vin: pad("ZHWD", "K"), label: "Lamborghini Aventador", make: "Lamborghini", modelContains: "Aventador", year: null, modelExcludes: ["Revuelto"] },
  { vin: pad("ZHWE", "R"), label: "Lamborghini Revuelto", make: "Lamborghini", modelContains: "Revuelto", year: null, modelExcludes: ["Aventador"] },
];

const ROLLS_ROYCE: Case[] = [
  { vin: pad("SCAA", "N"), label: "Rolls-Royce Ghost", make: "Rolls-Royce", modelContains: "Ghost", year: 2022, modelExcludes: ["Phantom", "Cullinan"] },
  { vin: pad("SCAB", "L"), label: "Rolls-Royce Phantom", make: "Rolls-Royce", modelContains: "Phantom", year: 2020, modelExcludes: ["Ghost"] },
  { vin: pad("SCAC", "N"), label: "Rolls-Royce Cullinan", make: "Rolls-Royce", modelContains: "Cullinan", year: 2022 },
  { vin: pad("SCAD", "J"), label: "Rolls-Royce Wraith", make: "Rolls-Royce", modelContains: "Wraith", year: 2018, modelExcludes: ["Spectre"] },
  { vin: pad("SCAF", "P"), label: "Rolls-Royce Spectre", make: "Rolls-Royce", modelContains: "Spectre", year: 2023, modelExcludes: ["Wraith"] },
];

const MINI: Case[] = [
  { vin: pad("WMWXP7", "N"), label: "MINI Cooper F56", make: "MINI", modelContains: "Cooper", year: 2022, modelExcludes: ["Clubman", "Countryman"] },
  { vin: pad("WMWXP9", "M"), label: "MINI Cooper F55", make: "MINI", modelContains: "Cooper", year: 2021, modelExcludes: ["Clubman", "Countryman"] },
  { vin: pad("WMWXS7", "N"), label: "MINI Clubman F54", make: "MINI", modelContains: "Clubman", year: 2022, modelExcludes: ["Countryman"] },
  { vin: pad("WMWXS1", "N"), label: "MINI Countryman F60", make: "MINI", modelContains: "Countryman", year: 2022, modelExcludes: ["Clubman"] },
  { vin: pad("WMWZP7", "P"), label: "MINI Cooper SE Electric", make: "MINI", modelContains: "Cooper SE", year: 2023 },
];

const LAND_ROVER: Case[] = [
  {
    vin: "SALZZZBN1MA123456",
    label: "Land Rover Range Rover EU ZZZ BN",
    make: "Land Rover",
    modelContains: "Range Rover",
    year: 2021,
    modelExcludes: ["Sport", "Evoque", "Velar", "Defender"],
  },
  {
    vin: "SALZZZBG1MA123456",
    label: "Land Rover Range Rover Sport EU ZZZ BG",
    make: "Land Rover",
    modelContains: "Range Rover Sport",
    year: 2021,
    modelExcludes: ["Evoque", "Velar", "Defender"],
  },
  {
    vin: "SALZZZKJ1MA123456",
    label: "Land Rover Range Rover Velar EU ZZZ KJ",
    make: "Land Rover",
    modelContains: "Velar",
    year: 2021,
    modelExcludes: ["Sport", "Evoque", "Defender"],
  },
  {
    vin: "SALZZZEV1MA123456",
    label: "Land Rover Range Rover Evoque EU ZZZ EV",
    make: "Land Rover",
    modelContains: "Evoque",
    year: 2021,
    modelExcludes: ["Sport", "Velar", "Defender"],
  },
  {
    vin: "SALZZZLM1MA123456",
    label: "Land Rover Defender EU ZZZ LM",
    make: "Land Rover",
    modelContains: "Defender",
    year: 2021,
    modelExcludes: ["Discovery", "Evoque"],
  },
  {
    vin: "SALZZZJA1MA123456",
    label: "Land Rover Discovery Sport EU ZZZ JA",
    make: "Land Rover",
    modelContains: "Discovery Sport",
    year: 2021,
    modelExcludes: ["Defender", "Velar"],
  },
  {
    vin: "SALZZZKV1MA123456",
    label: "Land Rover Discovery EU ZZZ KV",
    make: "Land Rover",
    modelContains: "Discovery",
    year: 2021,
    modelExcludes: ["Sport", "Defender"],
  },
  {
    vin: "SALEX7EU0L2000152",
    label: "Land Rover Defender US SALE*",
    make: "Land Rover",
    modelContains: "Defender",
    year: 2020,
    modelExcludes: ["Evoque"],
  },
  {
    vin: pad("SALY", "N"),
    label: "Land Rover Velar US SALY",
    make: "Land Rover",
    modelContains: "Velar",
    year: 2022,
  },
  {
    vin: "SALGA2JFSFA226427",
    label: "Land Rover Range Rover L405 SALGA2JF",
    make: "Land Rover",
    modelContains: "Range Rover",
    year: 2015,
    modelExcludes: ["Velar", "Sport"],
  },
  {
    vin: "SALWA2BKGJA402093",
    label: "Land Rover Range Rover Sport L494 SALWA2BK",
    make: "Land Rover",
    modelContains: "Range Rover Sport",
    year: 2018,
    modelExcludes: ["Freelander"],
  },
  {
    vin: pad("SALLDH", "9"),
    label: "Land Rover classic Defender SALLDH",
    make: "Land Rover",
    modelContains: "Defender",
    year: 2009,
  },
];

const JEEP: Case[] = [
  // 1C4 is a shared Stellantis WMI — make must resolve to Jeep via VDS model line.
  { vin: pad("1C4RJ", "N"), label: "Jeep Grand Cherokee 1C4RJ", make: "Jeep", modelContains: "Grand Cherokee", year: 2022, modelExcludes: ["Wrangler"] },
  { vin: pad("1C4HJ", "M"), label: "Jeep Wrangler 1C4HJ", make: "Jeep", modelContains: "Wrangler", year: 2021, modelExcludes: ["Grand Cherokee"] },
  { vin: pad("1C4BJ", "P"), label: "Jeep Wrangler 1C4BJ", make: "Jeep", modelContains: "Wrangler", year: 2023 },
  { vin: pad("1C4NJ", "N"), label: "Jeep Compass 1C4NJ", make: "Jeep", modelContains: "Compass", year: 2022, modelExcludes: ["Cherokee"] },
  { vin: pad("1C4PJ", "L"), label: "Jeep Cherokee 1C4PJ", make: "Jeep", modelContains: "Cherokee", year: 2020, modelExcludes: ["Grand Cherokee", "Compass"] },
];

const FORD: Case[] = [
  // Europe (WF0 ZZZ homologation)
  { vin: "WF0ZZZGBJNW123456", label: "Ford Focus Mk4 EU", make: "Ford", modelContains: "Focus", year: 2022, modelExcludes: ["Fiesta"] },
  { vin: pad("WF0ZZZFFJ", "N"), label: "Ford Fiesta EU", make: "Ford", modelContains: "Fiesta", year: 2022, modelExcludes: ["Focus"] },
  { vin: pad("WF0ZZZNUG", "N"), label: "Ford Puma EU", make: "Ford", modelContains: "Puma", year: 2022, modelExcludes: ["ST"] },
  { vin: pad("WF0ZZZNGC", "P"), label: "Ford Puma ST EU", make: "Ford", modelContains: "Puma ST", year: 2023 },
  { vin: pad("WF0ZZZU5J", "M"), label: "Ford Kuga EU", make: "Ford", modelContains: "Kuga", year: 2021 },
  { vin: pad("WF0ZZZM7G", "N"), label: "Ford Mustang Mach-E EU", make: "Ford", modelContains: "Mach-E", year: 2022 },
  { vin: pad("WF0ZZZTKD", "K"), label: "Ford Mondeo EU", make: "Ford", modelContains: "Mondeo", year: 2019 },
  { vin: pad("WF0ZZZCXB", "N"), label: "Ford Ranger EU", make: "Ford", modelContains: "Ranger", year: 2022 },
  // USA / Mexico
  { vin: "1FTFW1E50MFA12345", label: "Ford F-150 US", make: "Ford", modelContains: "F-150", year: 2021 },
  { vin: pad("1FMCU0", "N"), label: "Ford Escape US", make: "Ford", modelContains: "Escape", year: 2022 },
  { vin: pad("1FM5K8", "N"), label: "Ford Explorer US", make: "Ford", modelContains: "Explorer", year: 2022 },
  { vin: pad("1FA6P8", "J"), label: "Ford Mustang S550", make: "Ford", modelContains: "Mustang", year: 2018, modelExcludes: ["Mach-E"] },
  { vin: pad("1FA6P5", "P"), label: "Ford Mustang S650", make: "Ford", modelContains: "Mustang", year: null, modelExcludes: ["Mach-E"] },
  { vin: pad("1FMEE5", "N"), label: "Ford Bronco", make: "Ford", modelContains: "Bronco", year: 2022, modelExcludes: ["Sport"] },
  { vin: pad("1FMDE5", "N"), label: "Ford Bronco Sport", make: "Ford", modelContains: "Bronco Sport", year: 2022 },
  { vin: pad("3FMTK1", "N"), label: "Ford Mustang Mach-E MX", make: "Ford", modelContains: "Mach-E", year: 2022 },
  { vin: pad("3FTTW8", "N"), label: "Ford Maverick MX", make: "Ford", modelContains: "Maverick", year: 2022 },
];

describe("multi-brand QA — Fiat make/model/year", () => {
  for (const c of FIAT) it(`${c.label} — ${c.vin}`, () => assertCase(c));
});

describe("multi-brand QA — Ferrari make/model/year", () => {
  for (const c of FERRARI) it(`${c.label} — ${c.vin}`, () => assertCase(c));
});

describe("multi-brand QA — Lamborghini make/model/year", () => {
  for (const c of LAMBORGHINI) it(`${c.label} — ${c.vin}`, () => assertCase(c));
});

describe("multi-brand QA — Rolls-Royce make/model/year", () => {
  for (const c of ROLLS_ROYCE) it(`${c.label} — ${c.vin}`, () => assertCase(c));
});

describe("multi-brand QA — MINI make/model/year", () => {
  for (const c of MINI) it(`${c.label} — ${c.vin}`, () => assertCase(c));
});

describe("multi-brand QA — Land Rover make/model/year", () => {
  for (const c of LAND_ROVER) it(`${c.label} — ${c.vin}`, () => assertCase(c));
});

describe("multi-brand QA — Jeep make/model/year", () => {
  for (const c of JEEP) it(`${c.label} — ${c.vin}`, () => assertCase(c));
});

describe("multi-brand QA — Ford make/model/year", () => {
  for (const c of FORD) it(`${c.label} — ${c.vin}`, () => assertCase(c));
});

describe("multi-brand QA — no invent on bare WMI", () => {
  it("Ferrari ZFF with unknown line stays make-only", () => {
    const r = decodeVin(pad("ZFFZ", "N"));
    expect(r.make).toBe("Ferrari");
    expect(r.model).toBeNull();
    expect(r.year).toBeNull();
  });

  it("Land Rover unknown homologation stays make-only", () => {
    const r = decodeVin("SALZZZXX1MA123456");
    expect(r.make).toBe("Land Rover");
    expect(r.model).toBeNull();
    expect(r.year).toBeNull();
  });

  it("MINI unknown prefix stays make-only", () => {
    const r = decodeVin(pad("WMWQQQ", "N"));
    expect(r.make).toBe("MINI");
    expect(r.model).toBeNull();
  });

  it("McLaren SBM stays make-only without inventing model", () => {
    const r = decodeVin(pad("SBMZ", "R"));
    expect(r.make).toBe("McLaren");
    expect(r.model).toBeNull();
    expect(r.year).toBeNull();
  });

  it("Alpine VFA stays make-only without inventing model", () => {
    const r = decodeVin(pad("VFAZ", "R"));
    expect(r.make).toBe("Alpine");
    expect(r.model).toBeNull();
  });

  it("VinFast US 5VF resolves make", () => {
    const r = decodeVin(pad("5VFZ", "R"));
    expect(r.make).toBe("VinFast");
    expect(r.model).toBeNull();
  });

  it("Genesis KMU SUV WMI resolves make + known lines", () => {
    expect(decodeVin(pad("KMUH", "P")).make).toBe("Genesis");
    expect(decodeVin(pad("KMUH", "P")).model).toBe("GV80");
    expect(decodeVin(pad("KMUM", "N")).model).toBe("GV70");
    expect(decodeVin(pad("KMUK", "P")).model).toBe("GV60");
  });
});
