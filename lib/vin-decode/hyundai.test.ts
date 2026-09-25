/**
 * Hyundai decoder — Tucson and year-gated model lines.
 */
import { describe, expect, it } from "vitest";
import { decodeVin, decodeLocalSeries } from "./index";

describe("Hyundai Tucson identification", () => {
  it("KM8J2 / KM8J3 US Tucson", () => {
    expect(decodeVin("KM8J23A45MU123456").model).toBe("Tucson");
    expect(decodeVin("KM8J3CA46NU123456").model).toBe("Tucson");
    expect(decodeLocalSeries("KM8J3CA46NU123456")).toMatch(/NX4/);
  });

  it("KMHK381 / KMHNU Korea Tucson NX4", () => {
    expect(decodeVin("KMHK381BGBU123456").model).toBe("Tucson");
    expect(decodeVin("KMHNU81BADN123456").model).toBe("Tucson");
    expect(decodeLocalSeries("KMHNU81BADN123456")).toBe("NX4");
  });

  it("TMA Czech plant Tucson", () => {
    expect(decodeVin("TMAH381BGBU123456").model).toBe("Tucson");
    expect(decodeVin("TMAJB81CADN123456").model).toBe("Tucson");
  });

  it("year-gated KMH J-line is Tucson after 2005 (not Elantra/Bayon)", () => {
    // pos10 D is ambiguous without a verified production window (1983/2013)
    const r = decodeVin("KMHJ381AADU123456");
    expect(r.year).toBeNull();
    expect(r.model).toBe("Tucson");
  });

  it("Turkey Bayon keeps NLHB* line B", () => {
    expect(decodeVin("NLHBW51AADN123456").model).toBe("Bayon");
  });

  it("does not call KMHK i10 anymore", () => {
    // Ambiguous short KMHK without platform → Kona OS when year fits, not i10
    const r = decodeVin("KMHK581BGJU123456"); // J=2018
    expect(r.model).toBe("Kona");
    expect(r.model).not.toBe("i10");
  });
});

describe("Hyundai other models + year", () => {
  it("IONIQ 5 / 6 / Santa Fe Sport / Kona / Elantra", () => {
    expect(decodeVin("KMHL341BGBU123456").model).toContain("IONIQ");
    expect(decodeVin("KMHM341BGNU123456").model).toBe("IONIQ 6");
    expect(decodeVin("KMHS381BGBU123456").model).toMatch(/Santa Fe/);
    expect(decodeVin("KMHR681BGBU123456").model).toBe("Kona");
    expect(decodeVin("KMHD281BGBU123456").model).toBe("Elantra");
  });

  it("Alabama Santa Fe / Sonata", () => {
    expect(decodeVin("5NMS2DAE0NH123456").model).toBe("Santa Fe");
    expect(decodeVin("5NPE24AF5FH123456").make).toBe("Hyundai");
    expect(decodeVin("5NPE24AF5FH123456").model).toBe("Sonata");
  });

  it("Korean Sonata MY2020+ (line L / KMHL) is not IONIQ 5", () => {
    // Wikibooks: L = Sonata 2020- (Korean). Year L = 2020.
    const sonata2020 = decodeVin("KMHL24JJ0LA009507");
    expect(sonata2020.make).toBe("Hyundai");
    expect(sonata2020.model).toBe("Sonata");
    expect(sonata2020.year).toBe(2020);
    expect(sonata2020.model).not.toMatch(/IONIQ/i);

    const sonata2019 = decodeVin("KMHE141ABKA123456");
    expect(sonata2019.model).toBe("Sonata");
    // Letter K without a verified window → null (no cycle guess)
    expect(sonata2019.year).toBeNull();
  });

  it("IONIQ 5 still wins on KMHL341 / KMHLW4 platforms", () => {
    expect(decodeVin("KMHL341BGNU123456").model).toBe("IONIQ 5");
    expect(decodeVin("KMHLW41ABNU123456").model).toBe("IONIQ 5");
  });

  it("exposes year + plant for Tucson", () => {
    const r = decodeVin("KM8J3CA46NU123456");
    expect(r.year).toBe(2022);
    expect(r.make).toBe("Hyundai");
    expect(r.model).toBe("Tucson");
    expect(r.plantCity?.toLowerCase()).toMatch(/ulsan/);
  });

  it("does not map Tucson pos.8 L to IONIQ battery", () => {
    // pos.8 (index 7) = L — ICE Theta II on Tucson, not IONIQ pack size
    const r = decodeVin("KM8J3CALANU123456");
    expect(r.model).toBe("Tucson");
    expect(r.engineDecoded?.toLowerCase()).not.toMatch(/ioniq|77\.4/);
    expect(r.engineDecoded?.toLowerCase()).toMatch(/2\.4|theta/);
  });
});
