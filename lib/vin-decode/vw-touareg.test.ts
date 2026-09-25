import { describe, it, expect } from "vitest";
import {
  decodeVin,
  decodePremiumEuropean,
  decodeVinLocalFree,
  decodeLocalSeries,
  decodeLocalTrim,
} from "./index";

describe("VW Group Touareg identification", () => {
  it("WVGZZZ7P Bratislava → Volkswagen Touareg (7P)", () => {
    const vin = "WVGZZZ7PZAD000001";
    const r = decodeVin(vin);
    expect(r.make).toBe("Volkswagen");
    expect(r.model).toMatch(/Touareg/);
    expect(decodePremiumEuropean(vin)?.chassis).toBe("7P");
    expect(r.bodyStyleDecoded).toMatch(/SUV/i);
    expect(r.driveType).toBe("All-Wheel Drive");
    expect(r.transmissionDecoded).toMatch(/Automatic/i);
    expect(r.manufactureYear).toBeNull();
  });

  it("WVWZZZ7P Wolfsburg-format → Touareg", () => {
    const vin = "WVWZZZ7PZAD123456";
    expect(decodeVin(vin).model).toMatch(/Touareg/);
    expect(decodeLocalSeries(vin)).toBe("7P");
    expect(decodeLocalTrim(vin)).toBeNull();
  });

  it("WVGZZZCR Gen3 platform → Touareg CR", () => {
    const vin = "WVGZZZCRZMD000001";
    const r = decodeVin(vin);
    expect(r.make).toBe("Volkswagen");
    expect(r.model).toMatch(/Touareg/);
    expect(decodePremiumEuropean(vin)?.chassis).toBe("CR");
  });

  it("WVWZZZ7L Gen1 → Touareg (not Tiguan Allspace)", () => {
    const vin = "WVWZZZ7LZ9D123456";
    const r = decodeVin(vin);
    expect(r.model).toMatch(/Touareg/);
    expect(r.model).not.toMatch(/Tiguan/i);
    expect(decodePremiumEuropean(vin)?.chassis).toBe("7L");
  });

  it("WVGZZZF7 Audi Q7 still resolves as Audi (not Touareg)", () => {
    const vin = "WVGZZZF7ZMD000001";
    const r = decodeVin(vin);
    expect(r.make).toBe("Audi");
    expect(r.model).toMatch(/Q7/);
  });

  it("local free decode exposes model year vs manufacture year", () => {
    const free = decodeVinLocalFree("WVGZZZ7PZAD000001");
    expect(free).not.toBeNull();
    expect(free!.year).toBe(2010);
    expect(free!.manufactureYear).toBeNull();
    expect(free!.series).toBe("7P");
    expect(free!.trim).toBeNull();
    expect(free!.bodyStyle).toMatch(/SUV/i);
  });

  it("existing WVG Tiguan still works", () => {
    const r = decodeVin("WVGZZZ5NZDW535045");
    expect(r.make).toBe("Volkswagen");
    expect(r.model).toMatch(/Tiguan/);
  });
});
