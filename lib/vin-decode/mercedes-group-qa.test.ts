/**
 * Mercedes-Benz free-decoder QA — compact / coupe / roadster line disambiguation.
 *
 * Contract:
 * - pos-4 letters are reused; model lines must be resolved at pos 4–5 (2-char VDS).
 * - Verified against NHTSA vPIC: SJ/5J = CLA, PK = SLK/SLC, JK = SL, LJ = CLS.
 * - Regression: a CLA (WDDSJ…) must NEVER decode as SLK.
 */
import { describe, expect, it } from "vitest";
import { decodeVin, decodePremiumEuropean } from "./index";

describe("Mercedes QA — CLA vs SLK regression", () => {
  it("WDDSJ… is CLA (C117), never SLK", () => {
    const vin = "WDDSJ5CB0EN016022"; // real C117 CLA
    const r = decodeVin(vin);
    expect(r.make).toBe("Mercedes-Benz");
    expect(r.model).toMatch(/CLA/i);
    expect(r.model).not.toMatch(/SLK|SLC/i);
    expect(decodePremiumEuropean(vin)?.chassis).toBe("C117");
  });

  it("W1K5J… is CLA (C118), never SLK", () => {
    const vin = "W1K5J4GB1LV095893"; // real C118 CLA
    const r = decodeVin(vin);
    expect(r.make).toBe("Mercedes-Benz");
    expect(r.model).toMatch(/CLA/i);
    expect(r.model).not.toMatch(/SLK|SLC/i);
    expect(decodePremiumEuropean(vin)?.chassis).toBe("C118");
  });

  it("WDDPK… is SLK/SLC (R172), never CLA", () => {
    const vin = "WDDPK5HA6CF014835"; // real R172 SLK 350
    const r = decodeVin(vin);
    expect(r.make).toBe("Mercedes-Benz");
    expect(r.model).toMatch(/SLK|SLC/i);
    expect(r.model).not.toMatch(/CLA/i);
    expect(decodePremiumEuropean(vin)?.chassis).toBe("R172");
  });

  it("WDD118… (EU chassis-digit CLA) still resolves CLA C118", () => {
    const r = decodeVin("WDD118087KA123456");
    expect(r.make).toBe("Mercedes-Benz");
    expect(r.model).toMatch(/CLA/i);
  });
});

describe("Mercedes QA — SL / CLS letter lines", () => {
  it("WDDLJ… is CLS, not GLE", () => {
    const r = decodeVin("WDDLJ7EB0GA123456");
    expect(r.make).toBe("Mercedes-Benz");
    expect(r.model).toMatch(/CLS/i);
    expect(r.model).not.toMatch(/GLE/i);
  });

  it("WDDJK… (year 2014) is SL, not E-Class", () => {
    const r = decodeVin("WDDJK7DA5EA123456");
    expect(r.make).toBe("Mercedes-Benz");
    expect(r.model).toMatch(/SL/i);
    expect(r.model).not.toMatch(/SLK|SLC/i);
  });
});
