/**
 * Premium-brand coherence QA: never claim a generation that couldn't exist in that year.
 * Prefer model-only over a wrong chassis.
 */
import { describe, expect, it } from "vitest";
import { decodePremiumEuropean, premiumVinModelYear } from "./european-premium";
import { decodeVin } from "./vinDecoder";

describe("premium chassis year coherence", () => {
  it("BMW WBA3A + letter year without chassis does not invent 2015", () => {
    const vin = "WBA3A5C55FK123456"; // year F = 1985/2015 ambiguous
    expect(premiumVinModelYear(vin)).toBeNull();
    const prem = decodePremiumEuropean(vin);
    expect(prem?.model).toBe("3 Series");
    expect(prem?.chassis).toBeNull();
    expect(prem?.displayModel).not.toMatch(/E90/i);
    expect(decodeVin(vin).model).not.toMatch(/E90/i);
    expect(decodeVin(vin).year).toBeNull();
  });

  it("BMW WBA3A + 2008 may omit chassis rather than invent E90", () => {
    const vin = "WBA3A5C558K123456"; // year 8 = 2008
    const prem = decodePremiumEuropean(vin);
    expect(prem?.model).toBe("3 Series");
    // Ambiguous prefix — never ship E90 just because the VIN is old.
    expect(prem?.displayModel).not.toMatch(/E90|E91|E92|E93/i);
  });

  it("Mercedes Baumuster FIN does not treat steering digit as year 2001", () => {
    // Classic Euro layout: 213042 = Baumuster, 1 = LHD — year is NOT in the VIN.
    const vin = "WDD2130421A123456";
    expect(premiumVinModelYear(vin)).toBeNull();
    const prem = decodePremiumEuropean(vin);
    expect(prem?.model).toBe("E-Class");
    // Chassis digits are authoritative even without ISO year.
    expect(prem?.chassis).toBe("W213");
    expect(decodeVin(vin).year).toBeNull();
    expect(decodeVin(vin).model).toMatch(/E-Class/i);
  });

  it("Mercedes WDD213 + ISO year letter resolves via W213 production window", () => {
    const vin = "WDD213042GA123456"; // pos.10 = G → 1986/2016; W213 window → 2016
    expect(vin).toHaveLength(17);
    expect(premiumVinModelYear(vin, { from: 2016, to: 2023 })).toBe(2016);
    const prem = decodePremiumEuropean(vin);
    expect(prem?.chassis).toBe("W213");
    expect(prem?.displayModel).toContain("W213");
    expect(decodeVin(vin).year).toBe(2016);
  });

  it("real W203 Baumuster VIN has no invented year", () => {
    const vin = "WDB2030081A880979";
    expect(premiumVinModelYear(vin)).toBeNull();
    expect(decodeVin(vin).year).toBeNull();
    expect(decodeVin(vin).make).toBe("Mercedes-Benz");
    expect(decodeVin(vin).model).toMatch(/C-Class/i);
    const prem = decodePremiumEuropean(vin);
    expect(prem?.chassis).toBe("W203");
  });

  it("Mercedes WDD243 is EQA/EQB, not B-Class W246", () => {
    const vin = "WDD243000MA123456";
    expect(vin).toHaveLength(17);
    const prem = decodePremiumEuropean(vin);
    expect(prem?.model).toMatch(/EQA|EQB/);
    expect(prem?.displayModel).not.toMatch(/B-Class|W246/i);
    expect(decodeVin(vin).model).toMatch(/EQA|EQB/i);
  });

  it("Mercedes WDD296 is EQS SUV, not EQE SUV", () => {
    const vin = "WDD296087NA123456";
    const prem = decodePremiumEuropean(vin);
    expect(prem?.model).toBe("EQS SUV");
    expect(prem?.chassis).toBe("X296");
    expect(decodeVin(vin).model).toMatch(/EQS SUV/i);
  });

  it("Mercedes letter-series G without unique year omits model (no C/S guess)", () => {
    const vin = "WDDGF8HB6LA123456"; // L = 1990/2020 ambiguous
    expect(decodeVin(vin).year).toBeNull();
    const prem = decodePremiumEuropean(vin);
    // Letter G needs a year to choose C-Class vs S-Class — omit rather than guess.
    expect(prem?.model ?? null).toBeNull();
    expect(decodeVin(vin).model).toBeNull();
  });

  it("Mercedes letter-series H resolves via W212 window (F→2015)", () => {
    const vin = "WDDHF5KB6FA123456"; // F = 1985/2015 → unique inside W212
    expect(decodeVin(vin).year).toBe(2015);
    const prem = decodePremiumEuropean(vin);
    expect(prem?.model).toBe("E-Class");
    expect(decodeVin(vin).model).toMatch(/E-Class/i);
  });

  it("Mercedes letter-series H with digit year 2009 is E-Class (W212 era)", () => {
    const vin = "WDDHF5KB69A123456"; // 9 = 2009 (unique until 2039)
    expect(decodeVin(vin).year).toBe(2009);
    const prem = decodePremiumEuropean(vin);
    expect(prem?.model).toBe("E-Class");
    expect(decodeVin(vin).model).toMatch(/E-Class/i);
  });

  it("Mercedes letter-series G with digit year 2008 is C-Class (W204)", () => {
    // Digit 8 = 2008 (unique until 2038) → G letter maps to C-Class + W204 window
    const vin = "WDDGF8HB68A123456";
    expect(decodeVin(vin).year).toBe(2008);
    const prem = decodePremiumEuropean(vin);
    expect(prem?.model).toBe("C-Class");
    expect(prem?.displayModel).toMatch(/W204/i);
  });

  it("Mercedes letter-series Z (W213) is E-Class with unique year", () => {
    const vin = "WDDZF4JB0LA123456"; // L = 2020 inside W213
    const prem = decodePremiumEuropean(vin);
    expect(prem?.model).toBe("E-Class");
    expect(decodeVin(vin).model).toMatch(/E-Class/i);
    expect(decodeVin(vin).year).toBe(2020);
  });

  it("Porsche WP0ZZZ99 is 911 without hardcoded 992", () => {
    const vin = "WP0ZZZ99ZPS123456";
    const prem = decodePremiumEuropean(vin);
    expect(prem?.model).toBe("911");
    expect(prem?.chassis).toBeNull();
    expect(prem?.displayModel).not.toMatch(/992/i);
  });

  it("VW Typ 1K is Golf Mk5, not Mk7/8", () => {
    const vin = "WVWZZZ1KZ5W123456"; // year 5 = 2005
    const prem = decodePremiumEuropean(vin);
    expect(prem?.model).toBe("Golf");
    expect(prem?.chassis).toBe("Mk5");
    expect(prem?.displayModel).not.toMatch(/Mk7|Mk8/i);
  });

  it("VW Typ AU is Golf Mk7 when year fits", () => {
    const vin = "WVWZZZAUZFW123456"; // F = 2015
    const prem = decodePremiumEuropean(vin);
    expect(prem?.model).toBe("Golf");
    expect(prem?.chassis).toBe("Mk7");
  });

  it("BMW G30 chassis is dropped when year is before 2017", () => {
    const vin = "WBA5E1105FG123456"; // F = 2015
    const prem = decodePremiumEuropean(vin);
    expect(prem?.model).toBe("5 Series");
    expect(prem?.chassis).toBeNull();
    expect(prem?.displayModel).not.toMatch(/G30/i);
  });

  it("MINI F56 Cooper does not claim Clubman from ambiguous WMWX alone", () => {
    const vin = "WMWXP7C55F2123456";
    const prem = decodePremiumEuropean(vin);
    expect(prem?.model).toMatch(/Cooper/i);
    expect(prem?.chassis).toBe("F56");
    expect(decodeVin(vin).model?.toLowerCase()).not.toContain("clubman");
  });
});
