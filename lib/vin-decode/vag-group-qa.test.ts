/**
 * Volkswagen Group free-decoder QA — VW / Audi / Škoda / SEAT / Cupra.
 *
 * Contract:
 * - EU ZZZ type codes are 2-char (or longer) only — never invent from pos.7.
 * - Year-reused Typ 16: early Jetta / 2012+ Beetle (never Golf).
 * - Touran is 1T/5T; 9N is Polo.
 * - No engine invent on ZZZ homologation VINs.
 */
import { describe, expect, it } from "vitest";
import { decodeVin, decodeVinLocalFree, decodePremiumEuropean, decodeVolkswagenModern } from "./index";

function zzz(wmi: string, type78: string, year = "E"): string {
  return `${wmi}ZZZ${type78}Z${year}M043873`.slice(0, 17);
}

describe("VAG Group QA — Typ 16 regression", () => {
  it("letter E is ambiguous (1984 Jetta vs 2014 Beetle) → omit model", () => {
    const vin = "WVWZZZ16ZEM043873";
    const r = decodeVin(vin);
    expect(r.make).toBe("Volkswagen");
    // Both Typ 16 generations fit an ISO cycle of E — do not guess Beetle vs Jetta.
    expect(r.year).toBeNull();
    expect(r.model).toBeNull();
    expect(decodeVolkswagenModern(vin)).toBeNull();
  });

  it("early Typ 16 uniquely resolves to Jetta when only the old cycle fits", () => {
    // A → 1980/2010; Beetle window starts 2012 → only Jetta 1980 remains.
    const vin = "WVWZZZ16ZAM043873";
    expect(decodeVolkswagenModern(vin)?.model).toBe("Jetta");
    expect(decodeVolkswagenModern(vin)?.chassis).toBe("Typ 16");
    expect(decodeVin(vin).model).toMatch(/Jetta/i);
    expect(decodeVin(vin).year).toBe(1980);
  });

  it("Typ 16 outside known windows → null (no invent)", () => {
    // Digit 5 = 2005 sits between Jetta (≤1992) and Beetle (≥2012).
    expect(decodeVolkswagenModern("WVWZZZ16Z5M043873")).toBeNull();
    // P → 1993/2023 — neither generation window.
    expect(decodeVolkswagenModern("WVWZZZ16ZPM043873")).toBeNull();
  });
});

describe("VAG Group QA — sibling negatives", () => {
  it("16 ≠ Golf; 9N ≠ Touran; Touran stays 1T/5T", () => {
    // Ambiguous Typ 16 letter → null model (never invent Golf).
    expect(decodeVin("WVWZZZ16ZEM043873").model).toBeNull();
    expect(decodeVin(zzz("WVW", "9N")).model).toMatch(/Polo/i);
    expect(decodeVin(zzz("WVW", "9N")).model).not.toMatch(/Touran/i);
    expect(decodeVin(zzz("WVW", "1T")).model).toMatch(/Touran/i);
    expect(decodeVin(zzz("WVW", "5T")).model).toMatch(/Touran/i);
  });

  it("does not invent Golf from bare pos-7 on unknown type", () => {
    // Unknown 2-char starting with 1 must not become Golf via single-char invent
    const r = decodeVin("WVWZZZ1XZEM043873");
    expect(r.make).toBe("Volkswagen");
    expect(r.model).toBeNull();
  });
});

describe("VAG Group QA — modern lines stay green", () => {
  it.each([
    [zzz("WVW", "AU", "K"), /Golf/i],
    [zzz("WVW", "CD", "N"), /Golf/i],
    [zzz("WVW", "3C"), /Passat/i],
    [zzz("WVW", "5N"), /Tiguan/i],
    [zzz("WVW", "CT", "S"), /Tiguan/i],
    [zzz("WVW", "E1", "S"), /ID\.3/i],
    [zzz("WVW", "E2", "S"), /ID\.4/i],
    [zzz("WVG", "CR", "S"), /Touareg/i],
    [zzz("WVW", "2K"), /Caddy/i],
    [zzz("WVW", "5M"), /Golf Plus/i],
    [zzz("WVW", "6R"), /Polo/i],
    [zzz("WVW", "SY"), /Crafter/i],
  ])("%s → %s", (vin, modelRe) => {
    expect(decodeVin(vin).model).toMatch(modelRe);
  });
});

describe("VAG Group QA — Škoda / SEAT / Audi / Cupra", () => {
  it("Škoda NZ is Superb (not Karoq)", () => {
    const r = decodeVin("TMBLK7NZZLR123456");
    expect(r.make).toMatch(/Škoda|Skoda/i);
    expect(r.model).toMatch(/Superb/i);
    expect(r.model).not.toMatch(/Karoq/i);
  });

  it("SEAT unknown type stays null; León 5F still works", () => {
    expect(decodeVin("VSSZZZ2FZFR123456").model).toBeNull();
    expect(decodeVin("VSSZZZ5FZFR123456").model).toMatch(/León/i);
  });

  it("Audi EU homologation still resolves without pos-7 invent", () => {
    const r = decodeVin("WAUZZZ8V9KA123456");
    expect(r.make).toBe("Audi");
    // Either a real homologation hit or null — never a single-char invent
    if (r.model) {
      expect(r.model.length).toBeGreaterThan(1);
    }
  });

  it("Cupra Formentor stays Cupra", () => {
    const r = decodeVin("VSSZZZKM7MR123456");
    expect(r.make).toBe("Cupra");
    expect(r.model).toMatch(/Formentor/i);
  });
});
