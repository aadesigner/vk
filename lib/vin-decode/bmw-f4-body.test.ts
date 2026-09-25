import { describe, it, expect } from "vitest";
import { decodeVin, decodePremiumEuropean } from "./index";

describe("BMW F32/F33/F36 ETK type codes", () => {
  it("3V71 → F33 428i Convertible (N26)", () => {
    const vin = "WBA3V7106FJ995387";
    expect(decodeVin(vin).model).toBe("4 Series (F33 Convertible)");
    expect(decodePremiumEuropean(vin)?.chassis).toBe("F33 Convertible");
  });

  it("3N71 → F32 428i Coupé", () => {
    const vin = "WBA3N7106FJ995387";
    expect(decodeVin(vin).model).toContain("F32");
  });

  it("4B11 → F36 Gran Coupé", () => {
    const vin = "WBA4B1C59FG241156";
    expect(decodeVin(vin).model).toContain("F36 Gran Coupé");
  });

  it("US 5UX3V71 → F33 Convertible", () => {
    const vin = "5UX3V7106FJ995387";
    expect(decodeVin(vin).model).toContain("F33 Convertible");
  });
});

describe("BMW F10 ETK XA* type codes", () => {
  it("XA71 → 5 Series F10 (535d), not X7/X1", () => {
    const vin = "WBAXA7109CDX06588";
    const r = decodeVin(vin);
    expect(r.make).toBe("BMW");
    expect(r.year).toBe(2012);
    expect(r.model).toMatch(/5 Series/i);
    expect(r.model).not.toMatch(/X7|X1|X5/i);
    expect(decodePremiumEuropean(vin)?.chassis).toBe("F10/F11");
  });

  it("XA5* → 5 Series F10, not X5", () => {
    const vin = "WBAXA5C56FD691453";
    expect(decodeVin(vin).model).toMatch(/5 Series/i);
    expect(decodeVin(vin).model).not.toMatch(/X5/i);
    expect(decodeVin(vin).year).toBe(2015);
  });

  it("WBAX3 digit SUV still X3 (not swallowed by WBAXA)", () => {
    expect(decodeVin("WBAX31000L0123456").model).toMatch(/X3/i);
  });
});
