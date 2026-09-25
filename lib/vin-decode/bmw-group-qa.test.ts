/**
 * BMW Group free-decoder QA — BMW / M / i / MINI / Rolls-Royce.
 *
 * Contract:
 * - Classic EU ETK type codes (pos. 4–7) when modern prefixes miss.
 * - Pos.10 = "0" → year null + generation range (never invent 2000).
 * - Engine/fuel/drive stay null on ETK FINs.
 * - Regression: WBANC71020B644072 → 5 Series (E60).
 */
import { describe, expect, it } from "vitest";
import {
  decodeVin,
  decodeVinLocalFree,
  decodeLocalSeries,
  decodePremiumEuropean,
  isBmwEuroEtkVin,
  bmwEtkOmitsIsoYear,
} from "./index";

describe("BMW Group QA — classic ETK regression", () => {
  it("WBANC71020B644072 → 5 Series E60, year null, range, Dingolfing, no engine", () => {
    const vin = "WBANC71020B644072";
    expect(isBmwEuroEtkVin(vin)).toBe(true);
    expect(bmwEtkOmitsIsoYear(vin)).toBe(true);

    const r = decodeVin(vin);
    expect(r.make).toBe("BMW");
    expect(r.model).toMatch(/5 Series/i);
    expect(r.model).toMatch(/E60/);
    expect(r.year).toBeNull();
    expect(r.plantCity).toBe("Dingolfing");
    expect(r.engineDecoded).toBeNull();
    expect(r.fuelType).toBeNull();
    expect(r.driveType).toBeNull();

    const free = decodeVinLocalFree(vin)!;
    expect(free.series).toBe("E60");
    expect(free.modelYearRange).toBe("2003\u20132010 (E60)");
    expect(free.engineDecoded).toBeNull();
    expect(decodeLocalSeries(vin)).toBe("E60");
  });

  it("does not invent year 2000 from pos.10 = 0", () => {
    expect(decodeVin("WBANC71020B644072").year).not.toBe(2000);
    expect(decodeVin("WBANC71020B644072").year).toBeNull();
  });

  it("NC71 is never 7 Series / X1 / Velar", () => {
    const m = decodeVin("WBANC71020B644072").model!;
    expect(m).not.toMatch(/7 Series/i);
    expect(m).not.toMatch(/X1/i);
    expect(m).not.toMatch(/Velar/i);
  });
});

describe("BMW Group QA — classic ETK families", () => {
  it.each([
    ["WBADT53010B123456", /5 Series/i, "E39"],
    // Compound E90/E91 omitted without a unique ISO year (pos.10 is plant on this fixture).
    ["WBAVA51010B123456", /3 Series/i, null],
    ["WBXPC71010A123456", /X3/i, "E83"],
  ])("%s → model + chassis", (vin, modelRe, chassis) => {
    const r = decodeVin(vin);
    expect(r.make).toMatch(/BMW/i);
    expect(r.model).toMatch(modelRe);
    expect(decodePremiumEuropean(vin)?.chassis).toBe(chassis);
  });

  it("WBAAV110X0FU03083 → 320i E46 Munich (RealOEM AV11), no invented ISO year", () => {
    const vin = "WBAAV110X0FU03083";
    expect(isBmwEuroEtkVin(vin)).toBe(true);
    expect(bmwEtkOmitsIsoYear(vin)).toBe(true);

    const r = decodeVin(vin);
    expect(r.make).toBe("BMW");
    expect(r.model).toMatch(/320i/i);
    expect(r.model).toMatch(/E46/);
    expect(r.year).toBeNull();
    expect(r.plantCity).toBe("Munich");
    expect(r.engineDecoded).toBeNull();

    const free = decodeVinLocalFree(vin)!;
    expect(free.series).toBe("E46");
    expect(free.modelYearRange).toBe("1998\u20132006 (E46)");
    expect(decodePremiumEuropean(vin)?.chassis).toBe("E46");
  });
});

describe("BMW Group QA — modern prefixes still win", () => {
  it("F30 sedan WBA3V1 keeps modern path", () => {
    const vin = "WBA3V1100FJ123456";
    const r = decodeVin(vin);
    expect(r.make).toBe("BMW");
    expect(r.model).toMatch(/3 Series/i);
    expect(decodePremiumEuropean(vin)?.chassis).toMatch(/F30/i);
  });

  it("WBAXA71 F10 stays 5 Series via modern/ETK", () => {
    // Pos.10 must be a real year code (not plant).
    const vin = "WBAXA7100GJ123456"; // G = 2016 within F10
    const r = decodeVin(vin);
    expect(r.model).toMatch(/5 Series/i);
    expect(r.year).toBe(2016);
    expect(decodePremiumEuropean(vin)?.chassis).toMatch(/F10/i);
  });

  it("i4 / iX / M3 still resolve", () => {
    expect(decodeVin("WBY51CF00NF123456").model).toMatch(/i4/i);
    expect(decodeVin("WBY7E2105NV123456").model).toMatch(/iX/i);
    expect(decodeVin("WBS3A0000FK123456").model).toMatch(/M3/i);
  });
});

describe("BMW Group QA — MINI", () => {
  it("F56 Cooper is not Clubman", () => {
    const r = decodeVin("WMWXP7C55N2123456");
    expect(r.make).toBe("MINI");
    expect(r.model).toMatch(/Cooper/i);
    expect(r.model).not.toMatch(/Clubman/i);
    expect(decodePremiumEuropean("WMWXP7C55N2123456")?.chassis).toBe("F56");
  });

  it("F54 Clubman is not Countryman", () => {
    const r = decodeVin("WMWXS7C55N2123456");
    expect(r.model).toMatch(/Clubman/i);
    expect(r.model).not.toMatch(/Countryman/i);
  });

  it("ambiguous WMWX alone does not invent Clubman", () => {
    // Shorter than XP7/XS7 — should not force a body from WMWX alone.
    const r = decodeVin("WMWX00000N0123456");
    expect(r.make).toBe("MINI");
    // Model may be null or coarse Cooper from MODEL_MAP — never Clubman from WMWX alone.
    if (r.model) expect(r.model).not.toMatch(/Clubman/i);
  });
});

describe("BMW Group QA — Rolls-Royce", () => {
  it("Spectre is not Wraith", () => {
    const r = decodeVin("SCAF6WU09PUX12345");
    expect(r.make).toBe("Rolls-Royce");
    expect(r.model).toMatch(/Spectre/i);
    expect(r.model).not.toMatch(/Wraith/i);
  });

  it("Ghost / Cullinan resolve", () => {
    expect(decodeVin("SCAA664S0NUX12345").model).toMatch(/Ghost/i);
    expect(decodeVin("SCAC664S0NUX12345").model).toMatch(/Cullinan/i);
  });
});

describe("BMW Group QA — plant", () => {
  it("WBA plant B is Dingolfing", () => {
    expect(decodeVin("WBANC71020B644072").plantCity).toBe("Dingolfing");
    expect(decodeVin("WBA3V7106FB123456").plantCity).toBe("Dingolfing");
  });

  it("WBA plant A remains Munich", () => {
    expect(decodeVin("WBA3V7106FA123456").plantCity).toBe("Munich");
  });
});
