import { describe, it, expect } from "vitest";
import { decodeModelEuropean } from "@workspace/vin-decode";
import { decodeVin } from "@workspace/vin-decode";
import { mergeFreeDecode, parseNhtsaApiPayload } from "./vinDecodeFree";

describe("parseNhtsaApiPayload", () => {
  it("parses compact DecodeVinValues rows", () => {
    const parsed = parseNhtsaApiPayload({
      Results: [{
        ErrorCode: "0",
        Make: "HONDA",
        Model: "Accord",
        ModelYear: "2003",
        BodyClass: "Coupe",
        EngineCylinders: "6",
        DisplacementL: "3.0",
        FuelTypePrimary: "Gasoline",
        PlantCountry: "UNITED STATES (USA)",
        PlantCity: "MARYSVILLE",
      }],
    });
    expect(parsed?.make).toBe("HONDA");
    expect(parsed?.model).toBe("Accord");
    expect(parsed?.year).toBe(2003);
    expect(parsed?.plantCountry).toBe("UNITED STATES");
  });
});

describe("decodeModelEuropean", () => {
  it("WVWZZZ + pos7 C (3C) → Passat", () => {
    expect(decodeModelEuropean("WVWZZZ3CZCE064077")).toBe("Passat");
    expect(decodeModelEuropean("WVWZZZ1KZAW123456")).toBe("Golf");
  });
});

describe("decodeVin european integration", () => {
  it("European VW Golf via ZZZ filler", () => {
    const r = decodeVin("WVWZZZ1KZAW123456");
    expect(r.make).toBe("Volkswagen");
    expect(r.model).toContain("Golf");
  });

  it("European Audi Q5 (type code FY)", () => {
    const r = decodeVin("WAUZZZFYBN1234567");
    expect(r.make).toBe("Audi");
    expect(r.model).toContain("Q5");
  });

  it("BMW WBA3V71 decodes as 4 Series F33 Convertible, not Gran Coupé", () => {
    const r = decodeVin("WBA3V7106FJ995387");
    expect(r.make).toBe("BMW");
    expect(r.model).toContain("4 Series");
    expect(r.model).toContain("F33");
    expect(r.model).not.toContain("F36");
  });

  it("BMW Spartanburg X7 (WBA21) decodes as X7, not 2 Series", () => {
    const r = decodeVin("WBA21EM00P9R09775");
    expect(r.make).toBe("BMW");
    expect(r.model).toContain("X7");
    expect(r.transmissionDecoded).toBe("Automatic");
    expect(r.year).toBe(2023);
  });
});

describe("mergeFreeDecode", () => {
  const local = decodeVin("1HGCM82633A004352");

  it("prefers NHTSA make/model when clean", () => {
    const merged = mergeFreeDecode("1HGCM82633A004352", local, {
      errorCode: 0,
      make: "HONDA",
      model: "Accord",
      trim: "EX-V6",
      manufacturer: "AMERICAN HONDA MOTOR CO., INC.",
      vehicleType: "PASSENGER CAR",
      bodyStyle: "Coupe",
      year: 2003,
      engineCylinders: "6",
      engineDisplacementL: "2.998832712",
      engineModel: "J30A4",
      fuelType: "Gasoline",
      driveType: null,
      transmissionStyle: "Automatic",
      plantCountry: "UNITED STATES",
      plantCity: "MARYSVILLE",
    }, true);

    expect(merged.source).toMatch(/nhtsa|hybrid/);
    expect(merged.make).toBe("Honda");
    expect(merged.model).toBe("Accord");
    expect(merged.trim).toBe("EX-V6");
    expect(merged.year).toBe(2003);
    expect(merged.engineCylinders).toBe("6");
  });

  it("falls back to local when NHTSA missing", () => {
    const merged = mergeFreeDecode("KMHSW81UBGU554169", decodeVin("KMHSW81UBGU554169"), null, true);
    expect(merged.source).toBe("local");
    expect(merged.make).toBe("Hyundai");
    expect(merged.model).toBe("Santa Fe Sport");
    expect(merged.diagnostics.length).toBeGreaterThan(0);
  });

  it("uses local model when NHTSA model is implausible", () => {
    const merged = mergeFreeDecode("KMHSW81UBGU554169", decodeVin("KMHSW81UBGU554169"), {
      errorCode: 0,
      make: "HYUNDAI",
      model: "KMHSW81UBG",
      trim: null,
      manufacturer: null,
      vehicleType: null,
      bodyStyle: null,
      year: 2016,
      engineCylinders: null,
      engineDisplacementL: null,
      engineModel: null,
      fuelType: null,
      driveType: null,
      transmissionStyle: null,
      plantCountry: null,
      plantCity: null,
    }, true);
    expect(merged.model).toBe("Santa Fe Sport");
  });

  it("merges partial NHTSA (make/year/plant) when errorCode is non-zero", () => {
    const local = decodeVin("WBA21EM00P9R09775");
    const merged = mergeFreeDecode("WBA21EM00P9R09775", local, {
      errorCode: 1,
      make: "BMW",
      model: null,
      series: null,
      trim: null,
      manufacturer: "BMW AG",
      vehicleType: "PASSENGER CAR",
      bodyStyle: null,
      year: 2023,
      engineCylinders: null,
      engineDisplacementL: null,
      engineModel: null,
      fuelType: null,
      fuelTypeSecondary: null,
      driveType: null,
      transmissionStyle: null,
      transmissionSpeeds: null,
      turbo: null,
      electrificationLevel: null,
      gvwr: null,
      vehicleDescriptor: "WBA21EM0*P9",
      plantCountry: "UNITED STATES",
      plantCity: "GREER",
      abs: null,
      esc: null,
      tpms: null,
      seatBeltType: null,
      airbagLocations: null,
    }, true);

    expect(merged.make).toBe("BMW");
    expect(merged.model).toContain("X7");
    expect(merged.year).toBe(2023);
    expect(merged.plantCity).toBe("GREER");
    expect(merged.transmissionStyle).toBe("Automatic");
    expect(merged.source).toMatch(/hybrid|nhtsa/);
  });

  it("prefers local model year when NHTSA partial decode returns a conflicting year", () => {
    const vin = "1HGBH41JXMN109186";
    const local = decodeVin(vin);
    const merged = mergeFreeDecode(vin, local, {
      errorCode: 1,
      make: "HONDA",
      model: null,
      series: null,
      trim: null,
      manufacturer: "AMERICAN HONDA MOTOR CO., INC.",
      vehicleType: "PASSENGER CAR",
      bodyStyle: null,
      doors: null,
      year: 1991,
      engineCylinders: null,
      engineDisplacementL: null,
      engineModel: null,
      engineHp: null,
      engineKw: null,
      fuelType: null,
      fuelTypeSecondary: null,
      driveType: null,
      transmissionStyle: null,
      transmissionSpeeds: null,
      turbo: null,
      electrificationLevel: null,
      gvwr: null,
      vehicleDescriptor: "1HGBH41J*MN",
      plantCountry: null,
      plantCity: null,
      abs: null,
      esc: null,
      tpms: null,
      seatBeltType: null,
      airbagLocations: null,
    }, true);

    expect(local.year).toBe(2021);
    expect(merged.make).toBe("Honda");
    expect(merged.model).toBe("Civic");
    expect(merged.year).toBe(2021);
  });

  it("ignores NHTSA invented year on Mercedes Euro Baumuster (pos.10 is steering)", () => {
    const vin = "WDD2452071J281870";
    const local = decodeVin(vin);
    expect(local.year).toBeNull();
    expect(local.model).toMatch(/B-Class/i);

    const merged = mergeFreeDecode(vin, local, {
      errorCode: 8,
      make: "MERCEDES-BENZ",
      model: null,
      series: null,
      trim: null,
      manufacturer: "MERCEDES-BENZ CARS",
      vehicleType: "PASSENGER CAR",
      bodyStyle: null,
      doors: null,
      // NHTSA maps steering digit "1" → ISO MY2001 — must not leak into our result.
      year: 2001,
      engineCylinders: null,
      engineDisplacementL: null,
      engineModel: null,
      engineHp: null,
      engineKw: null,
      fuelType: null,
      fuelTypeSecondary: null,
      driveType: null,
      transmissionStyle: null,
      transmissionSpeeds: null,
      turbo: null,
      electrificationLevel: null,
      gvwr: null,
      vehicleDescriptor: "WDD24520*1J",
      plantCountry: null,
      plantCity: null,
      abs: null,
      esc: null,
      tpms: null,
      seatBeltType: null,
      airbagLocations: null,
    }, true);

    expect(merged.year).toBeNull();
    expect(merged.model).toMatch(/B-Class/i);
    expect(merged.series).toBe("W245");
    expect(merged.modelYearRange).toBe("2005\u20132011 (W245)");
    expect(merged.make).toBe("Mercedes-Benz");
  });

  it("still uses NHTSA/ISO year for US letter-VDS Mercedes", () => {
    const vin = "WDDGF8HB6LA123456";
    const local = decodeVin(vin);
    expect(local.year).toBe(2020);
    const merged = mergeFreeDecode(vin, local, {
      errorCode: 0,
      make: "MERCEDES-BENZ",
      model: "C-Class",
      series: null,
      trim: null,
      manufacturer: "MERCEDES-BENZ CARS",
      vehicleType: "PASSENGER CAR",
      bodyStyle: null,
      doors: null,
      year: 2020,
      engineCylinders: null,
      engineDisplacementL: null,
      engineModel: null,
      engineHp: null,
      engineKw: null,
      fuelType: null,
      fuelTypeSecondary: null,
      driveType: null,
      transmissionStyle: null,
      transmissionSpeeds: null,
      turbo: null,
      electrificationLevel: null,
      gvwr: null,
      vehicleDescriptor: null,
      plantCountry: null,
      plantCity: null,
      abs: null,
      esc: null,
      tpms: null,
      seatBeltType: null,
      airbagLocations: null,
    }, true);
    expect(merged.year).toBe(2020);
  });
});
