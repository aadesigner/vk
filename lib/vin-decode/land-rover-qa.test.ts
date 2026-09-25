/**
 * Land Rover / Range Rover free-decoder QA.
 *
 * Contract:
 * - Model + chassis only from longest prefix + production-year gate.
 * - Ambiguous / out-of-window → model null (never invent).
 * - Engine, fuel, drive, trim stay null (no generic SAL pos.8 / AWD guesses).
 * - Real regressions: SALGA2JF… = Range Rover L405; SALWA2BK… = Sport L494.
 */
import { describe, expect, it } from "vitest";
import { decodeVin, decodeVinLocalFree, decodeLocalSeries, decodeLocalTrim } from "./index";

type Case = {
  vin: string;
  label: string;
  modelContains: string;
  year: number;
  chassisContains?: string;
  modelExcludes?: string[];
};

function pad(prefix: string, yearChar: string): string {
  const base = (prefix.toUpperCase() + "00000000000000000").slice(0, 17).split("");
  base[9] = yearChar;
  return base.join("");
}

function assertConservativePowertrain(vin: string, label: string): void {
  const r = decodeVin(vin);
  expect(r.engineDecoded, `${label}: engine null`).toBeNull();
  expect(r.fuelType, `${label}: fuel null`).toBeNull();
  expect(r.driveType, `${label}: drive null`).toBeNull();
  expect(decodeLocalTrim(vin), `${label}: trim null`).toBeNull();

  const local = decodeVinLocalFree(vin);
  expect(local, `${label}: local free`).not.toBeNull();
  expect(local!.engineDecoded, `${label}: local engine null`).toBeNull();
  expect(local!.fuelType, `${label}: local fuel null`).toBeNull();
  expect(local!.driveType, `${label}: local drive null`).toBeNull();
  expect(local!.trim, `${label}: local trim null`).toBeNull();
}

function assertCase(c: Case): void {
  expect(c.vin, `${c.label}: length`).toHaveLength(17);
  const r = decodeVin(c.vin);
  expect(r.make, `${c.label}: make`).toBe("Land Rover");
  expect(r.model, `${c.label}: model present`).toBeTruthy();
  expect(r.model!.toLowerCase(), `${c.label}: model`).toContain(c.modelContains.toLowerCase());
  for (const bad of c.modelExcludes ?? []) {
    expect(r.model!.toLowerCase(), `${c.label}: exclude ${bad}`).not.toContain(bad.toLowerCase());
  }
  expect(r.year, `${c.label}: year`).toBe(c.year);
  if (c.chassisContains) {
    const series = decodeLocalSeries(c.vin, r.model);
    expect(series, `${c.label}: chassis present`).toBeTruthy();
    expect(series!.toLowerCase(), `${c.label}: chassis`).toContain(c.chassisContains.toLowerCase());
  }
  assertConservativePowertrain(c.vin, c.label);
}

const MATRIX: Case[] = [
  // Real regressions
  {
    vin: "SALGA2JFSFA226427",
    label: "REGRESSION Range Rover L405 SALGA2JF 2015",
    modelContains: "Range Rover",
    year: 2015,
    chassisContains: "L405",
    modelExcludes: ["Velar", "Sport", "Evoque", "Freelander", "Defender"],
  },
  {
    vin: "SALWA2BKGJA402093",
    label: "REGRESSION Range Rover Sport L494 SALWA2BK 2018",
    modelContains: "Range Rover Sport",
    year: 2018,
    chassisContains: "L494",
    modelExcludes: ["Freelander", "Velar", "Evoque", "Defender"],
  },

  // Range Rover generations
  {
    vin: pad("SALLH", "S"),
    label: "Range Rover Classic SALLH 1995",
    modelContains: "Range Rover",
    year: 1995,
    chassisContains: "Classic",
    modelExcludes: ["Sport", "Velar"],
  },
  {
    vin: pad("SALLP", "X"),
    label: "Range Rover P38 SALLP 1999",
    modelContains: "Range Rover",
    year: 1999,
    chassisContains: "P38",
    modelExcludes: ["Sport"],
  },
  {
    vin: pad("SALP", "1"),
    label: "Range Rover P38 SALP NAS 2001",
    modelContains: "Range Rover",
    year: 2001,
    chassisContains: "P38",
    modelExcludes: ["Sport"],
  },
  {
    vin: pad("SALLM", "6"),
    label: "Range Rover L322 SALLM 2006",
    modelContains: "Range Rover",
    year: 2006,
    chassisContains: "L322",
    modelExcludes: ["Sport", "Velar"],
  },
  {
    vin: pad("SALG", "F"),
    label: "Range Rover L405 SALG 2015",
    modelContains: "Range Rover",
    year: 2015,
    chassisContains: "L405",
    modelExcludes: ["Velar", "Sport"],
  },
  {
    vin: pad("SALK", "P"),
    label: "Range Rover L460 SALK 2023",
    modelContains: "Range Rover",
    year: 2023,
    chassisContains: "L460",
    modelExcludes: ["Sport", "Velar"],
  },

  // Range Rover Sport generations
  {
    vin: pad("SALLS", "A"),
    label: "Range Rover Sport L320 SALLS 2010",
    modelContains: "Range Rover Sport",
    year: 2010,
    chassisContains: "L320",
    modelExcludes: ["Freelander", "Velar"],
  },
  {
    vin: pad("SALS", "C"),
    label: "Range Rover Sport L320 SALS 2012",
    modelContains: "Range Rover Sport",
    year: 2012,
    chassisContains: "L320",
  },
  {
    vin: pad("SALW", "G"),
    label: "Range Rover Sport L494 SALW 2016",
    modelContains: "Range Rover Sport",
    year: 2016,
    chassisContains: "L494",
    modelExcludes: ["Freelander"],
  },
  {
    vin: pad("SALWA", "J"),
    label: "Range Rover Sport L494 SALWA 2018",
    modelContains: "Range Rover Sport",
    year: 2018,
    chassisContains: "L494",
    modelExcludes: ["Freelander"],
  },
  {
    vin: pad("SAL1", "P"),
    label: "Range Rover Sport L461 SAL1 2023",
    modelContains: "Range Rover Sport",
    year: 2023,
    chassisContains: "L461",
  },

  // Velar (SALY only — never SALG)
  {
    vin: pad("SALY", "J"),
    label: "Range Rover Velar SALY 2018",
    modelContains: "Velar",
    year: 2018,
    chassisContains: "L560",
    modelExcludes: ["Sport"],
  },
  {
    vin: pad("SALYA2", "N"),
    label: "Range Rover Velar SALYA2 2022",
    modelContains: "Velar",
    year: 2022,
    chassisContains: "L560",
  },

  // Evoque
  {
    vin: pad("SALV", "D"),
    label: "Range Rover Evoque L538 SALV 2013",
    modelContains: "Evoque",
    year: 2013,
    chassisContains: "L538",
    modelExcludes: ["Velar", "Sport"],
  },
  {
    vin: pad("SALZ", "L"),
    label: "Range Rover Evoque L551 SALZ 2020",
    modelContains: "Evoque",
    year: 2020,
    chassisContains: "L551",
  },
  {
    vin: pad("SALFA", "M"),
    label: "Range Rover Evoque L551 SALFA 2021",
    modelContains: "Evoque",
    year: 2021,
    chassisContains: "L551",
  },

  // Defender
  {
    vin: pad("SALLDH", "9"),
    label: "Classic Defender SALLDH 2009",
    modelContains: "Defender",
    year: 2009,
    chassisContains: "L316",
    modelExcludes: ["Evoque", "Discovery"],
  },
  {
    vin: pad("SALD", "R"),
    label: "Classic Defender SALD NAS 1994",
    modelContains: "Defender",
    year: 1994,
    chassisContains: "L316",
  },
  {
    vin: "SALEX7EU0L2000152",
    label: "Defender L663 US SALE 2020",
    modelContains: "Defender",
    year: 2020,
    chassisContains: "L663",
    modelExcludes: ["Evoque"],
  },
  {
    vin: pad("SALE", "L"),
    label: "Defender L663 SALE 2020",
    modelContains: "Defender",
    year: 2020,
    chassisContains: "L663",
    modelExcludes: ["Evoque"],
  },

  // Discovery
  {
    vin: pad("SALLJ", "P"),
    label: "Discovery I SALLJ 1993",
    modelContains: "Discovery",
    year: 1993,
    modelExcludes: ["Sport"],
  },
  {
    vin: pad("SALLT", "2"),
    label: "Discovery II SALLT 2002",
    modelContains: "Discovery",
    year: 2002,
    modelExcludes: ["Sport"],
  },
  {
    vin: pad("SALA", "8"),
    label: "Discovery III SALA 2008",
    modelContains: "Discovery",
    year: 2008,
    chassisContains: "Discovery 3",
    modelExcludes: ["Sport"],
  },
  {
    vin: pad("SALA", "B"),
    label: "Discovery IV SALA 2011",
    modelContains: "Discovery",
    year: 2011,
    chassisContains: "Discovery 4",
    modelExcludes: ["Sport"],
  },
  {
    vin: pad("SALR", "J"),
    label: "Discovery V SALR 2018",
    modelContains: "Discovery",
    year: 2018,
    chassisContains: "L462",
    modelExcludes: ["Sport"],
  },
  {
    vin: pad("SALC", "G"),
    label: "Discovery Sport SALC 2016",
    modelContains: "Discovery Sport",
    year: 2016,
    chassisContains: "L550",
  },

  // Freelander
  {
    vin: pad("SALLN", "2"),
    label: "Freelander 1 SALLN 2002",
    modelContains: "Freelander",
    year: 2002,
    chassisContains: "L314",
    modelExcludes: ["Sport"],
  },
  {
    vin: pad("SALF", "A"),
    label: "Freelander 2 SALF 2010",
    modelContains: "Freelander",
    year: 2010,
    chassisContains: "L359",
    modelExcludes: ["Sport"],
  },
  {
    vin: pad("SALLNB", "D"),
    label: "Freelander 2 SALLNB 2013",
    modelContains: "Freelander",
    year: 2013,
    chassisContains: "L359",
  },

  // EU ZZZ homologation
  {
    vin: "SALZZZBN1MA123456",
    label: "EU ZZZ Range Rover BN",
    modelContains: "Range Rover",
    year: 2021,
    modelExcludes: ["Sport", "Velar", "Evoque"],
  },
  {
    vin: "SALZZZBG1MA123456",
    label: "EU ZZZ Range Rover Sport BG",
    modelContains: "Range Rover Sport",
    year: 2021,
    modelExcludes: ["Velar", "Evoque"],
  },
  {
    vin: "SALZZZKJ1MA123456",
    label: "EU ZZZ Velar KJ",
    modelContains: "Velar",
    year: 2021,
  },
  {
    vin: "SALZZZEV1MA123456",
    label: "EU ZZZ Evoque EV",
    modelContains: "Evoque",
    year: 2021,
  },
  {
    vin: "SALZZZLM1MA123456",
    label: "EU ZZZ Defender LM",
    modelContains: "Defender",
    year: 2021,
  },
  {
    vin: "SALZZZJA1MA123456",
    label: "EU ZZZ Discovery Sport JA",
    modelContains: "Discovery Sport",
    year: 2021,
  },
  {
    vin: "SALZZZKV1MA123456",
    label: "EU ZZZ Discovery KV",
    modelContains: "Discovery",
    year: 2021,
    modelExcludes: ["Sport"],
  },
];

describe("Land Rover QA — model / generation / year matrix", () => {
  for (const c of MATRIX) {
    it(c.label, () => assertCase(c));
  }
});

describe("Land Rover QA — year gates reject wrong generations", () => {
  it("SALG before L405 era does not become Velar or L405", () => {
    const r = decodeVin(pad("SALG", "A")); // 2010 — before L405
    expect(r.make).toBe("Land Rover");
    expect(r.model).toBeNull();
  });

  it("SALW before L494 era does not become Freelander", () => {
    const r = decodeVin(pad("SALW", "A")); // 2010
    expect(r.make).toBe("Land Rover");
    expect(r.model).toBeNull();
  });

  it("SALY before Velar era is unresolved", () => {
    const r = decodeVin(pad("SALY", "F")); // 2015
    expect(r.make).toBe("Land Rover");
    expect(r.model).toBeNull();
  });

  it("SALE before Defender L663 era is unresolved (not Evoque guess)", () => {
    const r = decodeVin(pad("SALE", "F")); // 2015
    expect(r.make).toBe("Land Rover");
    expect(r.model).toBeNull();
  });

  it("SALF after Freelander 2 era is unresolved", () => {
    const r = decodeVin(pad("SALF", "J")); // 2018
    expect(r.make).toBe("Land Rover");
    expect(r.model).toBeNull();
  });

  it("SALV after Evoque L538 era is unresolved", () => {
    const r = decodeVin(pad("SALV", "L")); // 2020
    expect(r.make).toBe("Land Rover");
    expect(r.model).toBeNull();
  });

  it("unknown homologation stays make-only", () => {
    // Use valid VIN charset (no I/O/Q) — unknown type code XX.
    const vin = "SALZZZXX1MA123456";
    const r = decodeVin(vin);
    expect(r.make).toBe("Land Rover");
    expect(r.model).toBeNull();
    assertConservativePowertrain(vin, "unknown homologation");
  });
});

describe("Land Rover QA — sibling negatives", () => {
  it("SALGA is Range Rover never Velar", () => {
    const r = decodeVin("SALGA2JFSFA226427");
    expect(r.model).toMatch(/Range Rover/i);
    expect(r.model).not.toMatch(/Velar/i);
  });

  it("SALWA is Sport never Freelander", () => {
    const r = decodeVin("SALWA2BKGJA402093");
    expect(r.model).toMatch(/Range Rover Sport/i);
    expect(r.model).not.toMatch(/Freelander/i);
  });

  it("SALY Velar is not Sport / not L405 Range Rover alone", () => {
    const r = decodeVin(pad("SALY", "J"));
    expect(r.model).toMatch(/Velar/i);
    expect(r.model).not.toMatch(/Sport/i);
  });
});

describe("Jaguar regression — shared JLR path unchanged", () => {
  it("EU ZZZ F-Pace / I-Pace / XF", () => {
    expect(decodeVin("SAJZZZBG1MA123456").model).toContain("F-Pace");
    const ipace = decodeVin("SAJZZZBM1MA123456");
    expect(ipace.make).toBe("Jaguar");
    expect(ipace.model).toContain("I-Pace");
    expect(ipace.fuelType).toBe("Electric");
    expect(decodeVin("SAJZZZBN1MA123456").model).toContain("XF");
  });

  it("US F-Pace prefix", () => {
    const fp = decodeVin(pad("SAJXA4", "N"));
    expect(fp.make).toBe("Jaguar");
    expect(fp.model).toContain("F-Pace");
  });
});
