/**
 * Mazda free VIN decoder — carline (pos. 4–5) only; no speculative models.
 */
import { describe, expect, it } from "vitest";
import { decodeVin, decodeVinLocalFree, decodeLocalSeries, matchMazdaRule } from "./index";

function pad(prefix: string): string {
  const base = prefix.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "0");
  return (base + "000000000000000").slice(0, 17);
}

describe("Mazda decoder", () => {
  it("JM1BP → Mazda3 with BP series", () => {
    const vin = "JM1BPAM7XK1234567";
    expect(vin).toHaveLength(17);
    const r = decodeVin(vin);
    expect(r.make).toBe("Mazda");
    expect(r.model).toBe("Mazda3");
    expect(decodeLocalSeries(vin)).toBe("BP");
    expect(r.year).toBe(2019);
  });

  it("JM3KF → CX-5; JM1GJ → Mazda6 (not MX-5)", () => {
    expect(decodeVin(pad("JM3KF")).model).toBe("CX-5");
    expect(decodeVin(pad("JM1GJ")).model).toBe("Mazda6");
    expect(decodeVin(pad("JM1ND")).model).toBe("MX-5");
  });

  it("Mexico / US plant WMIs", () => {
    expect(decodeVin(pad("3MZBP")).make).toBe("Mazda");
    expect(decodeVin(pad("3MZBP")).model).toBe("Mazda3");
    expect(decodeVin(pad("3MVDM")).model).toBe("CX-30");
    expect(decodeVin(pad("7MMVA")).model).toBe("CX-50");
  });

  it("local free decode exposes series", () => {
    const local = decodeVinLocalFree(pad("JM3KE"));
    expect(local?.make).toBe("Mazda");
    expect(local?.model).toBe("CX-5");
    expect(local?.series).toBe("KE");
  });

  it("does not invent a model from WMI alone", () => {
    expect(matchMazdaRule(pad("JM1ZZ"))).toBeNull();
    expect(decodeVin(pad("JM1ZZ")).make).toBe("Mazda");
    expect(decodeVin(pad("JM1ZZ")).model).toBeNull();
  });
});
