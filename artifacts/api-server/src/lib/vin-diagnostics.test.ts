import { describe, it, expect } from "vitest";
import { decodeVin, decodeVinDiagnostics, decodeVinLocalFree } from "@workspace/vin-decode";

function diagValues(vin: string, labelKey: string): string[] {
  const base = decodeVin(vin);
  return decodeVinDiagnostics(vin, base)
    .filter((d) => d.labelKey === labelKey)
    .map((d) => d.value);
}

describe("decodeVinDiagnostics", () => {
  it("always includes VIN structure breakdown", () => {
    const vin = "WBA3V7106FJ995387";
    const items = decodeVinDiagnostics(vin, decodeVin(vin));
    expect(items.some((d) => d.category === "structure" && d.labelKey === "wmi")).toBe(true);
    expect(items.some((d) => d.labelKey === "vds" && d.value === "3V710")).toBe(true);
    expect(items.some((d) => d.labelKey === "check_digit")).toBe(true);
  });

  it("BMW 4 Series F33 gets correct body (3V71 ETK code)", () => {
    const vin = "WBA3V7106FJ995387";
    expect(diagValues(vin, "series")).toContain("4 Series");
    expect(diagValues(vin, "model_line")).toContain("4 Series (F33 Convertible)");
    expect(diagValues(vin, "manufacturer_family")).toContain("BMW");
  });

  it("Honda Civic gets market line and VDS", () => {
    const vin = "1HGBH41JXMN109186";
    const items = decodeVinDiagnostics(vin, decodeVin(vin));
    expect(items.some((d) => d.labelKey === "market_line")).toBe(true);
    expect(items.some((d) => d.labelKey === "vds_descriptor")).toBe(true);
  });

  it("Hyundai Elantra gets Korean model line hints", () => {
    const vin = "KMHD35LE1JA103867";
    const items = decodeVinDiagnostics(vin, decodeVin(vin));
    expect(items.some((d) => d.category === "identity")).toBe(true);
    expect(items.length).toBeGreaterThan(5);
  });

  it("decodeVinLocalFree includes diagnostics", () => {
    const result = decodeVinLocalFree("WBA3V7106FJ995387");
    expect(result).not.toBeNull();
    expect(result!.diagnostics.length).toBeGreaterThan(8);
    expect(result!.diagnostics.some((d) => d.category === "options" || d.category === "safety")).toBe(true);
  });

  it("dedupes identical diagnostic rows", () => {
    const vin = "WBA3V7106FJ995387";
    const items = decodeVinDiagnostics(vin, decodeVin(vin));
    const keys = items.map((d) => `${d.category}|${d.labelKey}|${d.value}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
