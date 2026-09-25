/**
 * Audi free-decoder QA — North America platform (pos 7–8) + EU ZZZ.
 *
 * Contract:
 * - Non-ZZZ WAU/WA1/WUA: platform at positions 7–8 (NHTSA sheets).
 * - WAUHJ28P78A092448 → A3 (8P), 2008 — never null model.
 * - EU WAUZZZ* homologation / modern tables stay green.
 * - Typ 4H = A8 D4 (never A7). GY = A3 8Y (never Q7). GA = Q2 (never Q5).
 * - Year stays ISO position 10 for Audi.
 */
import { describe, expect, it } from "vitest";
import { decodeVin, decodeAudiModern, decodePremiumEuropean } from "./index";

/** Build a 17-char NA Audi VIN with the given positions 7–8 platform and year code. */
function na(platform: string, year = "8"): string {
  return `WAUHJ2${platform}7${year}A123456`;
}

describe("Audi NA QA — platform regression", () => {
  it("WAUHJ28P78A092448 → A3 (8P), 2008", () => {
    const vin = "WAUHJ28P78A092448";
    const r = decodeVin(vin);
    expect(r.make).toBe("Audi");
    expect(r.model).toMatch(/A3/i);
    expect(r.year).toBe(2008);
    expect(decodeAudiModern(vin)?.chassis).toBe("8P");
    expect(decodePremiumEuropean(vin)?.model).toMatch(/A3/i);
  });
});

describe("Audi NA QA — NHTSA platform families", () => {
  it.each([
    ["8P", /A3/i],
    ["8V", /A3/i],
    ["8Y", /A3/i],
    ["GY", /A3/i],
    ["8E", /A4/i],
    ["8K", /A4/i],
    ["8W", /A4/i],
    ["8T", /A5/i],
    ["4F", /A6/i],
    ["4K", /A7/i],
    ["4A", /A6/i],
    ["4D", /A8/i],
    ["4E", /A8/i],
    ["4H", /A8/i],
    ["FD", /A8/i],
    ["4L", /Q7/i],
    ["F7", /Q7/i],
    ["GA", /Q2/i],
    ["8J", /TT/i],
    ["8N", /TT/i],
    ["42", /R8/i],
    ["8U", /Q3/i],
    ["8R", /Q5/i],
  ])("platform %s → %s", (platform, modelRe) => {
    const vin = na(platform);
    expect(vin.length).toBe(17);
    expect(decodeVin(vin).make).toBe("Audi");
    expect(decodeVin(vin).model).toMatch(modelRe);
    expect(decodeVin(vin).year).toBe(2008);
  });
  it("WA1FVAF18KD034551 is Q8 2019, never Q5 Sportback", () => {
    const r = decodeVin("WA1FVAF18KD034551");
    expect(r.make).toBe("Audi");
    expect(r.model).toMatch(/Q8/i);
    expect(r.model).not.toMatch(/Q5/i);
    expect(r.year).toBe(2019);
  });

  it("WA1 pos.4 is trim, not model — F1=Q8, FY=Q5, F7=Q7, F3=Q3", () => {
    expect(decodeVin("WA1AVAF17KD123456").model).toMatch(/Q8/i);
    expect(decodeVin("WA1FVAF17KD123456").model).toMatch(/Q8/i);
    expect(decodeVin("WA1AAAFY8M2123456").model).toMatch(/Q5/i);
    expect(decodeVin("WA1FAAFY8M2123456").model).toMatch(/Q5/i);
    expect(decodeVin("WA1BVAF75HD123456").model).toMatch(/Q7/i);
    expect(decodeVin("WA1AVAF31L1123456").model).toMatch(/Q3/i);
  });
});

describe("Audi EU QA — ZZZ / modern still green", () => {
  it("WAUZZZ8V stays A3", () => {
    const vin = "WAUZZZ8V9KA123456";
    const r = decodeVin(vin);
    expect(r.make).toBe("Audi");
    expect(r.model).toMatch(/A3/i);
  });

  it("WAUZZZ4H1FN034894 is A8 D4 2015, never A7", () => {
    const r = decodeVin("WAUZZZ4H1FN034894");
    expect(r.make).toBe("Audi");
    expect(r.model).toMatch(/A8/i);
    expect(r.model).not.toMatch(/A7/i);
    expect(r.year).toBe(2015);
  });

  it("modern GF Q6 e-tron still resolves", () => {
    const vin = "WAUZZZGFZRS123456";
    expect(decodeAudiModern(vin)?.model).toMatch(/Q6 e-tron/i);
    expect(decodeVin(vin).model).toMatch(/Q6 e-tron/i);
  });

  it("Typ collisions stay disambiguated", () => {
    expect(decodeVin("WAUZZZGY1NU123456").model).toMatch(/A3/i);
    expect(decodeVin("WAUZZZGA1BN123456").model).toMatch(/Q2/i);
    expect(decodeVin("WAUZZZ4ADN1234567").model).toMatch(/A6/i);
    expect(decodeVin("WAUZZZ4ADN1234567").model).not.toMatch(/A8/i);
  });
});
