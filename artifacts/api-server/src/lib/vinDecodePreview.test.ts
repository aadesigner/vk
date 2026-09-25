import { describe, it, expect } from "vitest";
import { decodeVinPeek } from "./vinDecodePreview";

describe("decodeVinPeek", () => {
  it("returns local make/model/year without NHTSA", async () => {
    const r = await decodeVinPeek("1HGCM82633A004352", true, null);
    expect(r.make).toBe("Honda");
    expect(r.model).toBe("Accord");
    expect(r.year).toBe(2003);
    expect(r.decodeSource).toBe("local");
    expect(r.wmi).toBe("1HG");
  });

  it("prefers plausible cache make/model over decode", async () => {
    const r = await decodeVinPeek("KMHSW81UBGU554169", true, {
      make: "Hyundai",
      model: "Sonata",
      year: 2016,
    });
    expect(r.make).toBe("Hyundai");
    expect(r.model).toBe("Sonata");
    expect(r.year).toBe(2016);
    expect(r.decodeSource).toBe("cache");
  });

  it("rejects gibberish cache model and keeps decoded", async () => {
    const r = await decodeVinPeek("KMHSW81UBGU554169", true, {
      make: "KMHSW81UBG",
      model: "KMHSW81UBG",
    });
    expect(r.make).toBe("Hyundai");
    expect(r.model).toBe("Santa Fe Sport");
    expect(r.decodeSource).toBe("local");
  });
});
