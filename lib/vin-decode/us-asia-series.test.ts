import { describe, it, expect } from "vitest";
import {
  decodeVin,
  decodeVinLocalFree,
  decodeLocalSeries,
  decodeLocalTrim,
  decodeUsVdsModel,
  decodePremiumEuropean,
} from "./index";

describe("series vs trim separation", () => {
  it("Touareg chassis goes to series, not trim", () => {
    const vin = "WVGZZZ7PZAD000001";
    expect(decodeLocalSeries(vin)).toBe("7P");
    expect(decodeLocalTrim(vin)).toBeNull();
    const free = decodeVinLocalFree(vin)!;
    expect(free.series).toBe("7P");
    expect(free.trim).toBeNull();
    expect(free.model).toMatch(/Touareg/);
  });

  it("BMW chassis is series", () => {
    const vin = "WBA3V7106FJ995387";
    expect(decodeLocalSeries(vin)).toBe("F33 Convertible");
    expect(decodeLocalTrim(vin)).toBeNull();
  });
});

describe("VAG Multivan / Caddy / Cupra platforms", () => {
  it("WV2 Multivan T7", () => {
    const r = decodeVin("WV2ZZZSFZMD000001");
    expect(r.make).toBe("Volkswagen");
    expect(r.model).toMatch(/Multivan/);
    expect(decodePremiumEuropean("WV2ZZZSFZMD000001")?.chassis).toBe("T7");
  });

  it("Cupra Formentor series KM", () => {
    const vin = "VSSZZZKM7MR123456";
    const free = decodeVinLocalFree(vin)!;
    expect(free.make).toBe("Cupra");
    expect(free.model).toBe("Formentor");
    expect(free.series).toBe("KM");
    expect(free.trim).toBeNull();
  });

  it("Škoda Octavia exposes platform as series", () => {
    const vin = "TMBJP7NX0L3123456";
    const free = decodeVinLocalFree(vin)!;
    expect(free.model).toBe("Octavia");
    expect(free.series).toBe("NX");
  });
});

describe("US Detroit / Asia VDS depth", () => {
  it("Ford F-150 from prefix", () => {
    expect(decodeUsVdsModel("1FTFW1E50MFA12345")).toBe("F-150");
    expect(decodeVin("1FTFW1E50MFA12345").model).toBe("F-150");
  });

  it("Jeep Grand Cherokee", () => {
    expect(decodeVin("1C4RJFBG0MC123456").model).toBe("Grand Cherokee");
  });

  it("Honda Accord US gen as series", () => {
    const vin = "1HGCV1F34LA123456";
    expect(decodeVin(vin).model).toBe("Accord");
    expect(decodeLocalSeries(vin)).toBe("10th gen");
  });

  it("Toyota Camry US", () => {
    expect(decodeVin("4T1B11HK5JU123456").model).toBe("Camry");
    expect(decodeLocalSeries("4T1B11HK5JU123456")).toBe("XV70");
  });
});
