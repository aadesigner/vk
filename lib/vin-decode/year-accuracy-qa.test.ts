/**
 * Year / WMI accuracy — no 30-year cycle guessing, no invented makes.
 */
import { describe, expect, it } from "vitest";
import {
  decodeVin,
  decodeVinLocalFree,
  isoModelYearCandidates,
  resolveIsoModelYear,
} from "./index";

describe("iso year — unique cycle only", () => {
  it("lists both letter cycles (oldest first)", () => {
    expect(isoModelYearCandidates("N")).toEqual([1992, 2022]);
    expect(isoModelYearCandidates("P")).toEqual([1993, 2023]);
    expect(isoModelYearCandidates("4")).toEqual([2004, 2034]);
  });

  it("never prefers recent when both cycles are plausible", () => {
    expect(resolveIsoModelYear("N")).toBeNull();
    expect(resolveIsoModelYear("W")).toBeNull();
    expect(resolveIsoModelYear("P")).toBeNull();
  });

  it("emits digit years when the +30 cycle is still in the future", () => {
    expect(resolveIsoModelYear("4")).toBe(2004);
    expect(resolveIsoModelYear("9")).toBe(2009);
  });

  it("uses a verified production window only when exactly one cycle remains", () => {
    expect(resolveIsoModelYear("P", { from: 2018, to: 2099 })).toBe(2023);
    expect(resolveIsoModelYear("N", { from: 1988, to: 1995 })).toBe(1992);
    // Wide window spanning both cycles → omit (do not prefer newest)
    expect(resolveIsoModelYear("D", { from: 1983, to: 2016 })).toBeNull();
  });
});

describe("WSD — unmapped German WMI", () => {
  it("does not invent make, model, or year", () => {
    // Letter at pos.10 would be ambiguous under ISO; with unknown make we omit year entirely.
    const r = decodeVin("WSD20A123AN123456");
    expect(r.make).toBeNull();
    expect(r.model).toBeNull();
    expect(r.year).toBeNull();
    expect(r.country).toBe("Germany");
    expect(r.wmi).toBe("WSD");

    const free = decodeVinLocalFree("WSD20A123AN123456");
    expect(free!.make).toBeNull();
    expect(free!.year).toBeNull();
  });

  it("does not invent year from a digit at pos.10 either", () => {
    // pos.10 = '4' would uniquely be 2004 under ISO — still omitted without a known make
    const r = decodeVin("WSD20A12344123456");
    expect(r.make).toBeNull();
    expect(r.year).toBeNull();
  });
});

describe("known makes — year only with evidence", () => {
  it("BMW X7 (G07) resolves 2023 via chassis window, not prefer-recent", () => {
    const r = decodeVin("WBA21EM00P9R09775");
    expect(r.make).toBe("BMW");
    expect(r.model).toMatch(/X7/);
    expect(r.year).toBe(2023);
  });

  it("Hyundai IONIQ 5 resolves year via verified platform window", () => {
    const r = decodeVin("KMHL341BGM1234567");
    expect(r.make).toBe("Hyundai");
    expect(r.model).toBe("IONIQ 5");
    expect(r.year).toBe(2021);
  });

  it("does not invent Passat year 2028 from letter W when chassis window rejects both cycles", () => {
    const r = decodeVin("WVWZZZ3CZWE123456");
    expect(r.make).toBe("Volkswagen");
    // B6–B8 window is 2005–2023; W → 1998/2028 both out → omit year
    expect(r.year).toBeNull();
  });

  it("known make without chassis window does not invent letter-year via prefer-recent", () => {
    // WBA3A = 3 Series model only — letter F is 1985/2015 ambiguous without chassis
    const r = decodeVin("WBA3A5C55FK123456");
    expect(r.make).toBe("BMW");
    expect(r.model).toMatch(/3 Series/i);
    expect(r.year).toBeNull();
  });
});
