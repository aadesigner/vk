import { describe, expect, it } from "vitest";
import { decodeVolvoModel, decodeVolvoSpec, isVolvoVin } from "./volvo";
import { decodeVin } from "./vinDecoder";

// VIN layout used below (EU / rest-of-world): position 4 (index 3) = model
// letter, position 10 (index 9) = model year. Check digit (index 8) is not
// validated by the decoder, so a filler is fine here.
describe("decodeVolvoSpec — EU layout (model at position 4)", () => {
  it("decodes a 2018 XC60 (YV4 / D)", () => {
    const spec = decodeVolvoSpec("YV4DA0AA0J1234567");
    expect(spec).toEqual({
      model: "XC60",
      bodyStyle: "SUV",
      fuelType: null,
      driveType: null,
    });
  });

  it("decodes a 2020 XC90 (YV4 / C)", () => {
    expect(decodeVolvoSpec("YV4CA0AA0L1234567")?.model).toBe("XC90");
  });

  it("decodes a 2019 S60 sedan (YV1 / F)", () => {
    const spec = decodeVolvoSpec("YV1FA0AA0K1234567");
    expect(spec?.model).toBe("S60");
    expect(spec?.bodyStyle).toBe("Sedan");
  });

  it("decodes a 2021 XC40 (YV4 / H, year-disambiguated from V60CC/S60)", () => {
    expect(decodeVolvoSpec("YV4HA0AA0M1234567")?.model).toBe("XC40");
  });

  it("flags V90 Cross Country as AWD wagon", () => {
    const spec = decodeVolvoSpec("YV4NA0AA0K1234567");
    expect(spec).toEqual({
      model: "V90 Cross Country",
      bodyStyle: "Wagon",
      fuelType: null,
      driveType: "All-Wheel Drive",
    });
  });

  it("marks the EX30 as an electric SUV", () => {
    const spec = decodeVolvoSpec("YV4YA0AA0S1234567");
    expect(spec?.model).toBe("EX30");
    expect(spec?.fuelType).toBe("Electric");
    expect(spec?.bodyStyle).toBe("SUV");
  });

  it("decodes a 2009 S60 via the legacy table (YV1 / R)", () => {
    expect(decodeVolvoSpec("YV1RA0AA091234567")?.model).toBe("S60");
  });
});

describe("decodeVolvoSpec — model-specific WMIs", () => {
  it("maps 7JR (US-built) to S60", () => {
    expect(decodeVolvoSpec("7JR102FK6KG012345")?.model).toBe("S60");
  });

  it("maps LVY to S90", () => {
    expect(decodeVolvoSpec("LVYA00000L1234567")?.model).toBe("S90");
  });
});

describe("decodeVolvoSpec — rejects mismatches", () => {
  it("returns null for a non-Volvo VIN", () => {
    expect(decodeVolvoSpec("WBA3V1100A1234567")).toBeNull();
    expect(isVolvoVin("WBA3V1100A1234567")).toBe(false);
  });

  it("returns null when the letter conflicts with the WMI XC split", () => {
    // 'C' (XC90, an XC vehicle) under YV1 (non-XC) is not a valid combination.
    expect(decodeVolvoModel("YV1CA0AA0L1234567")).toBeNull();
  });
});

describe("decodeVin integration", () => {
  it("returns Volvo make + model + body for an EU XC60", () => {
    const r = decodeVin("YV4DA0AA0J1234567");
    expect(r.make).toBe("Volvo");
    expect(r.model).toBe("XC60");
    expect(r.bodyStyleDecoded).toBe("SUV");
  });

  it("reports the plant from position 11", () => {
    expect(decodeVin("YV4DA0AA0J2234567").plantCountry).toBe("Belgium"); // 2 = Ghent
    expect(decodeVin("YV4DA0AA0J1234567").plantCountry).toBe("Sweden");  // 1 = Torslanda
  });
});
