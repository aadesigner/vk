import { describe, expect, it } from "vitest";
import { decodeVin } from "./vinDecoder";
import { decodePremiumEuropean } from "./european-premium";

describe("Mercedes VDS decoding", () => {
  it("decodes WDD chassis-digit C-Class and G-Class", () => {
    expect(decodeVin("WDD2050371A123456").model).toMatch(/C-Class/i);
    expect(decodeVin("WDD4632761A123456").model).toMatch(/G-Class/i);
    expect(decodeVin("WDD2040491A123456").model).toMatch(/C-Class/i);
  });

  it("aliases WDB/WDC WMI to the same chassis codes as WDD", () => {
    expect(decodeVin("WDB4632361A123456").model).toMatch(/G-Class/i);
    expect(decodeVin("WDC4632761A123456").model).toMatch(/G-Class/i);
    expect(decodeVin("WDB2040491A123456").model).toMatch(/C-Class/i);
  });

  it("decodes letter-series C-Class (WDDG = W204, not G-Class)", () => {
    // Digit year uniquely resolves; letter years stay null → omit year-gated model.
    const r = decodeVin("WDDGF8HB68A123456"); // 8 = 2008
    expect(r.make).toBe("Mercedes-Benz");
    expect(r.model).toMatch(/C-Class/i);
    expect(r.model).not.toMatch(/G-Class/i);
    expect(decodeVin("WDDGF8HB6LA123456").model).toBeNull();
  });

  it("decodes letter-series E-Class W212 (WDDH) — not C-Class", () => {
    // Digit 9 = 2009 uniquely; letter F resolves via W212 window → 2015.
    const r = decodeVin("WDDHF5KB69A123456");
    expect(r.make).toBe("Mercedes-Benz");
    expect(r.model).toMatch(/E-Class/i);
    expect(r.model).not.toMatch(/C-Class/i);
    const f = decodeVin("WDDHF5KB6FA123456");
    expect(f.model).toMatch(/E-Class/i);
    expect(f.year).toBe(2015);
  });

  it("decodes letter-series E-Class W213 (WDDZ)", () => {
    const r = decodeVin("WDDZF4JB0LA123456"); // Z + W213 window → 2020
    expect(r.make).toBe("Mercedes-Benz");
    expect(r.model).toMatch(/E-Class/i);
    expect(r.model).not.toMatch(/C-Class/i);
    expect(r.year).toBe(2020);
  });

  it("decodes letter-series E-Class W214 (WDDL) for recent years", () => {
    // Letter P uniquely fits W214 (2023–) → E-Class; chassis-digit W214 still works.
    const letter = decodeVin("WDDLF4JB0PA123456");
    expect(letter.model).toMatch(/E-Class/i);
    expect(letter.year).toBe(2023);
    const r = decodeVin("WDD214087PA123456");
    expect(r.make).toBe("Mercedes-Benz");
    expect(r.model).toMatch(/E-Class/i);
    expect(r.model).not.toMatch(/GLE|C-Class/i);
  });

  it("decodes W1N / WDC SUV letter-series G-Class", () => {
    expect(decodeVin("W1NYC7HJ0LX340589").model).toMatch(/G-Class/i);
    expect(decodeVin("WDCYF8HB6LA123456").model).toMatch(/G-Class/i);
  });

  it("recognizes W1N WMI as Mercedes-Benz", () => {
    expect(decodeVin("W1NYC7HJ0LX340589").make).toBe("Mercedes-Benz");
  });

  it("W166 chassis is ML before 2016 and GLE from 2016", () => {
    expect(decodeVin("WDD166087FA123456").model).toMatch(/ML/i); // F = 2015
    expect(decodeVin("WDD166087GA123456").model).toMatch(/GLE/i); // G = 2016
    expect(decodeVin("WDD166087GA123456").model).not.toMatch(/ML/i);
  });

  it("decodes W163 ML-Class", () => {
    expect(decodeVin("WDD1630871A123456").model).toMatch(/ML/i);
  });

  it("decodes NA SUV letter VDS for ML / GLE / GLC / GLS / GLA", () => {
    // D+A W166 wagon — 2015 = ML, 2017 = GLE
    expect(decodeVin("WDCDA5HB6FA123456").model).toMatch(/ML/i);
    expect(decodeVin("WDCDA5HB6HA123456").model).toMatch(/GLE/i);
    // D+F X166 GL/GLS
    expect(decodeVin("WDCDF5HB6HA123456").model).toMatch(/GLS/i);
    // F+B W167 GLE, F+F X167 GLS
    expect(decodeVin("WDCFB5HB6LA123456").model).toMatch(/GLE/i);
    expect(decodeVin("WDCFB5HB6LA123456").model).not.toMatch(/GLS/i);
    expect(decodeVin("WDCFF5HB6LA123456").model).toMatch(/GLS/i);
    // 0+G X253 GLC, K+M X254 GLC
    expect(decodeVin("WDC0G4JB0GA123456").model).toMatch(/GLC/i);
    expect(decodeVin("WDCKM4JB0PA123456").model).toMatch(/GLC/i);
    // T = X156 GLA; 4+N = H247 GLA; 4+M = X247 GLB
    expect(decodeVin("WDCTE4JB0FA123456").model).toMatch(/GLA/i);
    expect(decodeVin("WDC4N4JB0MA123456").model).toMatch(/GLA/i);
    expect(decodeVin("WDC4M4JB0LA123456").model).toMatch(/GLB/i);
  });

  it("decodes 4JG Tuscaloosa and W1N SUV letter VDS", () => {
    expect(decodeVin("4JGDA5HB6HA123456").make).toBe("Mercedes-Benz");
    expect(decodeVin("4JGDA5HB6HA123456").model).toMatch(/GLE/i);
    expect(decodeVin("4JGFF5HB6LA123456").model).toMatch(/GLS/i);
    expect(decodeVin("W1NFB5HB6LA123456").model).toMatch(/GLE/i);
    expect(decodeVin("W1N0G4JB0GA123456").model).toMatch(/GLC/i);
  });

  it("premium display keeps chassis when year fits", () => {
    const gle = decodePremiumEuropean("WDCDA5HB6HA123456"); // 2017
    expect(gle?.model).toBe("GLE");
    expect(gle?.chassis).toBe("W166");
    const glc = decodePremiumEuropean("WDC0G4JB0GA123456"); // 2016
    expect(glc?.model).toBe("GLC");
    expect(glc?.chassis).toBe("X253");
  });
});
