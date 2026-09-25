/**
 * Mercedes model + year QA — Baumuster vs ISO year encoding.
 */
import { describe, expect, it } from "vitest";
import {
  decodePremiumEuropean,
  decodeVin,
  decodeVinLocalFree,
  isMercedesEuroBaumusterVin,
  premiumVinModelYear,
  chassisProductionWindow,
} from "./index";

describe("Mercedes Euro Baumuster year encoding", () => {
  const baumuster = [
    "WDB2030081A880979", // real C 220 CDI
    "WDB2030081A559171", // known LastVIN C 220 CDI (2003 build — year NOT in VIN)
    "WDD2030491A123456",
    "WDD2020491A123456",
    "WDD2100651A123456", // E-Class W210-style
    "WDB2201751A432136",
    "WDD2130421A123456",
    "WDD4632761A123456",
    "WDD2452071J281870", // real B 180 CDI W245 — NHTSA invents MY2001 from steering "1"
  ];

  const isoYear = [
    { vin: "WDD205037FA123456", year: 2015, model: /C-Class/i, chassis: "W205" },
    { vin: "WDD204049AA123456", year: 2010, model: /C-Class/i, chassis: "W204" },
    { vin: "WDD213042GA123456", year: 2016, model: /E-Class/i, chassis: "W213" },
    { vin: "WDD206087MA123456", year: 2021, model: /C-Class/i, chassis: "W206" },
    { vin: "WDD177087KA123456", year: 2019, model: /A-Class/i, chassis: "W177" },
    // Letter-series (no chassis digits): year only when ISO cycle is unique (digit codes).
    { vin: "WDDGF8HB68A123456", year: 2008, model: /C-Class/i },
    { vin: "WDDHF5KB69A123456", year: 2009, model: /E-Class/i },
    { vin: "WDDZF4JB05A123456", year: 2005, model: /E-Class/i },
    { vin: "WDCDA5HB6HA123456", year: 2017, model: /GLE|ML/i, chassis: "W166" },
    { vin: "WDDZZZ213GAA12345", year: 2016, model: /E-Class/i },
  ];

  it("letter-series resolves year only via verified chassis windows", () => {
    // G+L: L∉W204 window → omit year (and model)
    expect(decodeVin("WDDGF8HB6LA123456").year).toBeNull();
    expect(decodeVin("WDDGF8HB6LA123456").model).toBeNull();
    // H+F: F→2015 uniquely inside W212 2009–2016
    expect(decodeVin("WDDHF5KB6FA123456").year).toBe(2015);
    expect(decodeVin("WDDHF5KB6FA123456").model).toMatch(/E-Class/i);
    // Z+L: L→2020 uniquely inside W213 2016–2023
    expect(decodeVin("WDDZF4JB0LA123456").year).toBe(2020);
    expect(decodeVin("WDDZF4JB0LA123456").model).toMatch(/E-Class/i);
  });

  it.each(baumuster)("does not invent year for Baumuster %s", (vin) => {
    expect(vin).toHaveLength(17);
    expect(isMercedesEuroBaumusterVin(vin)).toBe(true);
    expect(premiumVinModelYear(vin)).toBeNull();
    expect(decodeVin(vin).year).toBeNull();
    expect(decodeVin(vin).make).toBe("Mercedes-Benz");
  });

  it.each(isoYear)("keeps ISO year for $vin", ({ vin, year, model, chassis }) => {
    expect(isMercedesEuroBaumusterVin(vin)).toBe(false);
    const prem = decodePremiumEuropean(vin);
    const win = chassisProductionWindow(chassis ?? prem?.chassis ?? null);
    expect(premiumVinModelYear(vin, win)).toBe(year);
    expect(decodeVin(vin).year).toBe(year);
    expect(decodeVin(vin).model).toMatch(model);
    if (chassis) {
      expect(prem?.chassis).toBe(chassis);
    }
  });

  it("keeps W203 chassis when year is unknown", () => {
    const prem = decodePremiumEuropean("WDB2030081A880979");
    expect(prem?.model).toMatch(/C-Class/i);
    expect(prem?.chassis).toBe("W203");
    expect(prem?.displayModel).toMatch(/W203/);
  });

  it("ML→GLE rename still year-gated on ISO VINs", () => {
    expect(decodeVin("WDD166087FA123456").model).toMatch(/ML/i);
    expect(decodeVin("WDD166087GA123456").model).toMatch(/GLE/i);
  });
});

describe("Mercedes generation year range (exact year not in VIN)", () => {
  it("Baumuster FIN gets the generation production window, not a fake year", () => {
    const r = decodeVinLocalFree("WDD2130041A403793");
    expect(r).not.toBeNull();
    expect(r!.year).toBeNull();
    expect(r!.model).toMatch(/E-Class/i);
    expect(r!.series).toBe("W213");
    expect(r!.modelYearRange).toBe("2016\u20132023 (W213)");
  });

  it.each([
    ["WDB2030081A880979", "2000\u20132007 (W203)"], // W203 C-Class
    ["WDD2220871A123456", "2013\u20132020 (W222)"], // W222 S-Class
    ["WDD2452071J281870", "2005\u20132011 (W245)"], // W245 B-Class
  ])("range for %s → %s", (vin, range) => {
    expect(decodeVinLocalFree(vin)!.modelYearRange).toBe(range);
  });

  it("W245 Baumuster is B-Class with Rastatt plant, no invented year", () => {
    const r = decodeVinLocalFree("WDD2452071J281870");
    expect(r).not.toBeNull();
    expect(isMercedesEuroBaumusterVin("WDD2452071J281870")).toBe(true);
    expect(r!.make).toBe("Mercedes-Benz");
    expect(r!.model).toMatch(/B-Class/i);
    expect(r!.series).toBe("W245");
    expect(r!.year).toBeNull();
    expect(r!.modelYearRange).toBe("2005\u20132011 (W245)");
    expect(r!.plantCity).toBe("Rastatt");
  });

  it("open-ended generations render as 'from–present'", () => {
    const r = decodeVinLocalFree("WDD2140871A123456"); // W214, 2023–
    expect(r!.year).toBeNull();
    expect(r!.modelYearRange).toMatch(/^2023\u2013present \(W214\)$/);
  });

  it("does not add a range when the exact ISO year is known", () => {
    const r = decodeVinLocalFree("WDD213042GA123456"); // 2016
    expect(r!.year).toBe(2016);
    expect(r!.modelYearRange).toBeNull();
  });
});

describe("Mercedes assembly plant (position 11)", () => {
  it("WDD/W1K passenger 'A' is Sindelfingen, not Kecskemét", () => {
    const r = decodeVin("WDD2130041A403793");
    expect(r.plantCity).toBe("Sindelfingen");
    expect(r.plantCountry).toBe("Germany");
    expect(decodeVin("W1K2130461A123456").plantCity).toBe("Sindelfingen");
  });

  it("WDD passenger 'N' is Kecskemét, 'J' is Rastatt", () => {
    // position 10 = year code (K), position 11 = plant letter.
    expect(decodeVin("WDD177087KN123456").plantCity).toBe("Kecskemét");
    expect(decodeVin("WDD177087KJ123456").plantCity).toBe("Rastatt");
  });

  it("WDC/W1N SUV 'A' is Tuscaloosa (Vance), not Sindelfingen", () => {
    expect(decodeVin("WDCDA5HB6HA123456").plantCity).toMatch(/Vance/i);
    expect(decodeVin("W1N1671231A123456").plantCity).toMatch(/Vance/i);
  });
});

describe("Mercedes model-line coverage smoke", () => {
  const lines: Array<{ vin: string; model: RegExp }> = [
    { vin: "WDD177087KA123456", model: /A-Class/i },
    { vin: "WDD118087KA123456", model: /CLA/i },
    { vin: "WDD246087JA123456", model: /B-Class/i },
    { vin: "WDD2030491A123456", model: /C-Class/i },
    { vin: "WDD204049AA123456", model: /C-Class/i },
    { vin: "WDD205037FA123456", model: /C-Class/i },
    { vin: "WDD206087MA123456", model: /C-Class/i },
    { vin: "WDD213042GA123456", model: /E-Class/i },
    { vin: "WDD214087PA123456", model: /E-Class/i },
    { vin: "WDD222087HA123456", model: /S-Class/i },
    { vin: "WDD223087LA123456", model: /S-Class/i },
    { vin: "WDDLJ7EB5KA123456", model: /CLS/i },
    { vin: "WDD236087PA123456", model: /CLE/i },
    { vin: "WDD253149GA123456", model: /GLC/i },
    { vin: "WDD254087NA123456", model: /GLC/i },
    { vin: "WDD166087FA123456", model: /ML/i },
    { vin: "WDD166087GA123456", model: /GLE/i },
    { vin: "WDD167087KA123456", model: /GLE/i },
    { vin: "WDD247087LA123456", model: /GLA/i },
    { vin: "WDD463276LA123456", model: /G-Class/i },
    { vin: "WDD290087MA123456", model: /EQS/i },
    { vin: "WDD294087NA123456", model: /EQE/i },
    { vin: "WDD296087NA123456", model: /EQS SUV/i },
    { vin: "WDD243000MA123456", model: /EQ/i },
    { vin: "WDD293087KA123456", model: /EQC/i },
    { vin: "W1K213046GA123456", model: /E-Class/i },
    { vin: "4JGDA5HB6HA123456", model: /GLE/i },
  ];

  it.each(lines)("$vin → $model", ({ vin, model }) => {
    const r = decodeVin(vin);
    expect(r.make).toBe("Mercedes-Benz");
    expect(r.model).toMatch(model);
  });
});
