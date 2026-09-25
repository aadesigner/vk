/**
 * Ford Europe free-decoder QA — XX layout + ZZZ homologation.
 *
 * Contract:
 * - Legacy Saarlouis XX (WF0[digit]XXGC…): year from position 11.
 * - Modern XX (Galaxy, Mondeo, …): ISO year at position 10; pos.11 = plant.
 * - WF05XXGCC5FD58410 → Focus, year 2015 (not 2005).
 * - WF0LXXGCBLBT76866 → Galaxy, year 2020 (not 2011 from plant code B).
 * - ZZZ homologation lines stay green.
 * - Ambiguous / unknown → null (no invent).
 */
import { describe, expect, it } from "vitest";
import {
  decodeVin,
  isFordEuXxLayout,
  decodeFordEuXxYear,
  decodeFordEuModel,
  isFordEuLegacyXxYearAtPos11,
  fordEuXxUsesIsoYearAtPos10,
} from "./index";

describe("Ford Europe QA — XX layout regression", () => {
  it("WF05XXGCC5FD58410 → Focus, year 2015 (not ISO 2005)", () => {
    const vin = "WF05XXGCC5FD58410";
    expect(isFordEuXxLayout(vin)).toBe(true);
    expect(decodeFordEuXxYear(vin)).toBe(2015);
    expect(decodeFordEuModel(vin)).toBe("Focus");

    const r = decodeVin(vin);
    expect(r.make).toBe("Ford");
    expect(r.model).toMatch(/Focus/i);
    expect(r.year).toBe(2015);
    expect(r.year).not.toBe(2005);
    // XX layout: pos.8 is type, pos.11 is year — never invent engine/plant from those.
    expect(r.engineDecoded).toBeNull();
    expect(r.engineCode).toBeNull();
    expect(r.plantCode).toBeNull();
    expect(r.plantCity).toBeNull();
    expect(r.fuelType).toBeNull();
  });

  it("XX-layout never uses ISO position 10 as year", () => {
    // pos.10 = 5 would be ISO 2005; pos.11 = H → 2017
    const vin = "WF05XXGCC5HD56957";
    expect(isFordEuXxLayout(vin)).toBe(true);
    expect(decodeVin(vin).year).toBe(2017);
    expect(decodeVin(vin).model).toMatch(/Focus/i);
  });

  it("classic letter XX prefixes still resolve", () => {
    expect(decodeFordEuModel("WF0EXXGCDM4E44162")).toBe("Focus");
    expect(decodeFordEuModel("WF0FXXGAJD8S12345")).toBe("Fiesta");
    expect(decodeFordEuModel("WF0JXXGAJD8S12345")).toBe("C-Max");
  });

  it("WF0LXXGCBLBT76866 → Galaxy, year 2020 (pos.10 L, not plant B at pos.11)", () => {
    const vin = "WF0LXXGCBLBT76866";
    expect(isFordEuXxLayout(vin)).toBe(true);
    expect(fordEuXxUsesIsoYearAtPos10(vin)).toBe(true);
    expect(decodeFordEuXxYear(vin)).toBe(2020);

    const r = decodeVin(vin);
    expect(r.make).toBe("Ford");
    expect(r.model).toMatch(/Galaxy/i);
    expect(r.year).toBe(2020);
    expect(r.year).not.toBe(2011);
  });

  it("Galaxy with year letter W does not invent 2028 while calendar is still 2026", () => {
    // pos.10 = W → ISO candidates 1998 / 2028; both invalid for Mk3+ Galaxy in 2026
    const vin = "WF0LXXGCBWBT76866";
    expect(fordEuXxUsesIsoYearAtPos10(vin)).toBe(true);
    expect(decodeFordEuXxYear(vin)).toBeNull();
    const r = decodeVin(vin);
    expect(r.make).toBe("Ford");
    expect(r.model).toMatch(/Galaxy/i);
    expect(r.year).toBeNull();
    expect(r.year).not.toBe(2028);
  });

  it.each([
    ["WF0KXXWPCKLB71430", 2020],
    ["WF0KXXWPCKMJ44715", 2021],
    ["WF0KXXWPCKHM77066", 2017],
  ])("%s → year %i (Mondeo-platform XX, calendar at pos.11)", (vin, year) => {
    expect(fordEuXxUsesIsoYearAtPos10(vin)).toBe(false);
    expect(decodeVin(vin).year).toBe(year);
  });
});

describe("Ford Europe QA — ZZZ homologation stays green", () => {
  it.each([
    ["WF0ZZZGBJNW123456", /Focus/i, 2022],
    ["WF0ZZZFFJNW123456", /Fiesta/i, 2022],
    ["WF0ZZZNUGNW123456", /Puma/i, 2022],
    ["WF0ZZZU5JMW123456", /Kuga/i, 2021],
  ])("%s → %s / %s", (vin, modelRe, year) => {
    const r = decodeVin(vin);
    expect(r.make).toBe("Ford");
    expect(r.model).toMatch(modelRe);
    expect(r.year).toBe(year);
    expect(isFordEuXxLayout(vin)).toBe(false);
  });
});

describe("Ford Europe QA — SEAT VS6 untouched", () => {
  it("VS6 SEAT León is not claimed as Ford", () => {
    const r = decodeVin("VS6A1Z7E5MR123456");
    expect(r.make).toBe("SEAT");
    expect(r.model).toMatch(/Ibiza|León/i);
  });
});
