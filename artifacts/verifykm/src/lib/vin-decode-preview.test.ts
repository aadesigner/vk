import { describe, it, expect } from "vitest";
import { decodeVin } from "@workspace/vin-decode";
import { formatVehicleTitle, isTrustworthyVinDecode, peekMatchesVin } from "./vin-decode-preview";

describe("peekMatchesVin", () => {
  it("matches same VIN case-insensitively", () => {
    expect(peekMatchesVin({ vin: "1nxbr32e77z123456" }, "1NXBR32E77Z123456")).toBe(true);
  });

  it("rejects stale peek from a different VIN", () => {
    expect(peekMatchesVin({ vin: "5YJSA1E47HF000001" }, "2T1BURHE0JC123456")).toBe(false);
  });
});

describe("formatVehicleTitle", () => {
  it("shows make + year when year decodes", () => {
    const vin = "WBA21EM00P9R09775";
    const r = decodeVin(vin);
    const peek = { vin, make: r.make, model: r.model, year: r.year };
    expect(isTrustworthyVinDecode(peek)).toBe(true);
    expect(formatVehicleTitle(peek)).toBe("BMW 2023");
  });

  it("shows make + year even when model is known", () => {
    const peek = { vin: "WAUZZZ4H1FN034894", make: "Audi", model: "A8", year: 2015 };
    expect(formatVehicleTitle(peek)).toBe("Audi 2015");
  });

  it("shows make alone when year is missing — never model", () => {
    const vin = "WBY7E21050V123456";
    const r = decodeVin(vin);
    const peek = { vin, make: r.make, model: r.model, year: r.year };
    expect(r.year).toBeNull();
    expect(formatVehicleTitle(peek)).toBe("BMW");
  });

  it("shows make alone for Baumuster without year — never ranges", () => {
    const peek = {
      vin: "WDB2110222B056667",
      make: "Mercedes-Benz",
      model: "E-Class",
      year: null,
      modelYearRange: "2002–2009 (W211)",
    };
    expect(formatVehicleTitle(peek)).toBe("Mercedes-Benz");
  });

  it("rejects garbage make", () => {
    const peek = { vin: "WAUZZZ4H1FN034894", make: "BCDFGHJK", model: null, year: 2015 };
    expect(isTrustworthyVinDecode(peek)).toBe(false);
    expect(formatVehicleTitle(peek)).toBeNull();
  });
});
