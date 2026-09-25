/**
 * Ford + Chevrolet/GMC North America free-decoder QA.
 * Prefixes / chassis codes verified via NHTSA vPIC or GM MID — no invented lines.
 */
import { describe, expect, it } from "vitest";
import { decodeVin } from "./vinDecoder";
import { decodeFordNaModel } from "./ford-na";
import { decodeGmNaModel } from "./gm-na";

function pad(prefix: string, yearChar = "N"): string {
  const base = `${prefix}0${yearChar}A123456`;
  return (base + "XXXXXXXX").slice(0, 17);
}

describe("Ford NA — NHTSA-verified models", () => {
  const cases: Array<{ vin: string; model: string; make?: string }> = [
    { vin: "1FTFW1E50MFA12345", model: "F-150" },
    { vin: "1FTEX1EP5MKD12345", model: "F-150" },
    { vin: "1FT7W2BT5NED12345", model: "F-250" },
    { vin: "1FTBF2B60NEE12345", model: "F-250" },
    { vin: pad("1FMCU0"), model: "Escape" },
    { vin: pad("1FMSK8"), model: "Explorer" },
    { vin: pad("1FA6P8", "J"), model: "Mustang" },
    { vin: pad("1FA6P5", "P"), model: "Mustang" },
    { vin: pad("1FMEE5"), model: "Bronco" },
    { vin: pad("1FMDE5"), model: "Bronco Sport" },
    { vin: pad("3FMTK1"), model: "Mustang Mach-E" },
    { vin: pad("3FTTW8"), model: "Maverick" },
    { vin: "1FADP3F22JL123456", model: "Focus" },
    { vin: pad("3FA6P0", "K"), model: "Fusion" },
    { vin: "2FMPK4J90KBB12345", model: "Edge" },
    { vin: "1FMJK1KT5LEA12345", model: "Expedition MAX" },
    { vin: "1FMJU1JT5LEA12345", model: "Expedition" },
    { vin: "1FTBW2CM5HKA12345", model: "Transit" },
  ];

  for (const c of cases) {
    it(`${c.vin.slice(0, 8)} → ${c.model}`, () => {
      expect(decodeFordNaModel(c.vin)).toBe(c.model);
      const r = decodeVin(c.vin);
      expect(r.make).toBe(c.make ?? "Ford");
      expect(r.model).toBe(c.model);
    });
  }

  it("does not invent a model for unknown Ford NA stem", () => {
    expect(decodeFordNaModel("1FTZZZZZ0NMA12345")).toBeNull();
  });
});

describe("Chevrolet / GMC NA — NHTSA + MID chassis", () => {
  const cases: Array<{ vin: string; model: string | RegExp; make: string }> = [
    { vin: "1GCUYEED8MZ123456", model: "Silverado 1500", make: "Chevrolet" },
    { vin: "1GCPYBEH0LZ123456", model: "Silverado 1500", make: "Chevrolet" },
    { vin: "1GC4YUEY5MF123456", model: /Silverado/, make: "Chevrolet" },
    { vin: "1GCHSBEA0L1123456", model: "Colorado", make: "Chevrolet" },
    { vin: "1GTU9CED0LZ123456", model: "Sierra 1500", make: "GMC" },
    { vin: "1GNSKCKC0LR123456", model: "Tahoe", make: "Chevrolet" },
    { vin: "1GKS2CKJ0LR123456", model: "Yukon", make: "GMC" },
    { vin: "1GNERGKW8KJ123456", model: "Traverse", make: "Chevrolet" },
    { vin: "3GNAXUEV5LS123456", model: "Equinox", make: "Chevrolet" },
    { vin: "2GNAXTEV9L6123456", model: "Equinox", make: "Chevrolet" },
    { vin: "1G1ZD5ST5LF123456", model: "Malibu", make: "Chevrolet" },
    { vin: "1G1FB1RS5K0123456", model: "Camaro", make: "Chevrolet" },
    { vin: "1G1YY26U965123456", model: "Corvette", make: "Chevrolet" },
    { vin: "KL8CB6SA0HC123456", model: "Spark", make: "Chevrolet" },
    { vin: "KL79MSSL0PB123456", model: "Trailblazer", make: "Chevrolet" },
    { vin: "1GYKNARS4LZ123456", model: "XT5", make: "Cadillac" },
    // MID Book 6 classic Silverado chassis (pos.5–6 = CR)
    { vin: "1GCNCREC0GZ123456", model: "Silverado 1500", make: "Chevrolet" },
    // MID Book 6 Tahoe when pos.4 = L
    { vin: "1GNLCAE0XG1234567", model: "Tahoe", make: "Chevrolet" },
    // MID Book 6 Suburban when pos.4 = S
    { vin: "1GNSCHE0XG1234567", model: "Suburban", make: "Chevrolet" },
  ];

  for (const c of cases) {
    it(`${c.vin.slice(0, 8)} → ${c.model}`, () => {
      const local = decodeGmNaModel(c.vin);
      if (typeof c.model === "string") expect(local).toBe(c.model);
      else expect(local).toMatch(c.model);

      const r = decodeVin(c.vin);
      expect(r.make).toBe(c.make);
      if (typeof c.model === "string") expect(r.model).toBe(c.model);
      else expect(r.model).toMatch(c.model);
    });
  }

  it("does not invent Chevy model from bare WMI", () => {
    expect(decodeGmNaModel("1GCZZZZZ0NMA12345")).toBeNull();
  });
});
