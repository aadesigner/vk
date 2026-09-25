/**
 * Coverage enhancements — verified WMIs / ETK only. No invented models.
 */
import { describe, expect, it } from "vitest";
import { decodeVin, decodeVinLocalFree, decodePremiumEuropean } from "./index";

function pad(prefix: string, yearChar = "P"): string {
  const base = (prefix.toUpperCase() + "00000000000000000").slice(0, 17).split("");
  base[9] = yearChar;
  return base.join("");
}

describe("Chinese WMI make corrections (no model invent)", () => {
  it("LE4 is Beijing Benz, not NIO (WMI registry)", () => {
    const r = decodeVin(pad("LE4AAAA", "P"));
    expect(r.make).toBe("Beijing Benz");
    expect(r.model).toBeNull();
    expect(r.fuelType).not.toBe("Electric");
  });

  it("HJN → NIO make-only", () => {
    const r = decodeVin(pad("HJNAAAA", "P"));
    expect(r.make).toBe("NIO");
    expect(r.model).toBeNull();
    expect(r.fuelType).toBe("Electric");
  });

  it("L1N / LMV → XPeng make-only", () => {
    expect(decodeVin(pad("L1NAAAA", "R")).make).toBe("XPeng");
    expect(decodeVin(pad("LMVAAAA", "N")).make).toBe("XPeng");
    expect(decodeVin(pad("L1NAAAA", "R")).model).toBeNull();
  });

  it("LW4 / HLX → Li Auto make-only", () => {
    expect(decodeVin(pad("LW4AAAA", "P")).make).toBe("Li Auto");
    expect(decodeVin(pad("HLXAAAA", "P")).make).toBe("Li Auto");
    expect(decodeVin(pad("LW4AAAA", "P")).model).toBeNull();
  });

  it("LJ1 stays JAC (shared with NIO — no NIO invent from bare WMI)", () => {
    const r = decodeVin(pad("LJ1AAAA", "P"));
    expect(r.make).toBe("JAC");
    expect(r.model).toBeNull();
  });
});

describe("BMW ETK verified type expansions", () => {
  it("WBAUA71010A123456 → 1 Series E81, year null + range", () => {
    const vin = "WBAUA71010A123456";
    const r = decodeVin(vin);
    expect(r.make).toBe("BMW");
    expect(r.model).toMatch(/1 Series/i);
    expect(r.year).toBeNull();
    expect(decodePremiumEuropean(vin)?.chassis).toBe("E81");
    expect(decodeVinLocalFree(vin)!.modelYearRange).toBe("2007\u20132012 (E81)");
  });

  it("WBAVN71010A123456 → X1 E84", () => {
    const vin = "WBAVN71010A123456";
    const r = decodeVin(vin);
    expect(r.make).toBe("BMW");
    expect(r.model).toMatch(/X1/i);
    expect(decodePremiumEuropean(vin)?.chassis).toBe("E84");
    expect(decodeVinLocalFree(vin)!.modelYearRange).toBe("2009\u20132015 (E84)");
  });

  it("WBAWX73100B123456 → X3 F25", () => {
    const vin = "WBAWX73100B123456";
    const r = decodeVin(vin);
    expect(r.make).toBe("BMW");
    expect(r.model).toMatch(/X3/i);
    expect(decodePremiumEuropean(vin)?.chassis).toBe("F25");
    expect(decodeVinLocalFree(vin)!.modelYearRange).toBe("2010\u20132017 (F25)");
  });
});

describe("Existing regressions still hold", () => {
  it("WBANC71020B644072 → E60 5 Series", () => {
    const r = decodeVin("WBANC71020B644072");
    expect(r.model).toMatch(/5 Series/i);
    expect(r.year).toBeNull();
  });

  it("WBAAV110X0FU03083 → 320i E46", () => {
    const r = decodeVin("WBAAV110X0FU03083");
    expect(r.model).toMatch(/320i/i);
    expect(r.year).toBeNull();
  });

  it("Tesla LRW still Tesla", () => {
    expect(decodeVin(pad("LRWYGCE", "N")).make).toBe("Tesla");
  });
});
