import { describe, expect, it } from "vitest";
import {
  decodeAudiModern,
  decodePorscheModern,
  decodeSkodaModern,
  decodeVolkswagenModern,
} from "./vag-modern";
import { decodeVin } from "./vinDecoder";

function typedVin(wmi: string, type78: string, year = "S", filler = "ZZZ"): string {
  return `${wmi}${filler}${type78}A${year}A123456`;
}

function porscheTypeVin(
  wmi: "WP0" | "WP1",
  type78: string,
  type12: string,
  year = "S",
): string {
  return `${wmi}ZZZ${type78}A${year}A${type12}12345`;
}

describe("modern Volkswagen type decoding", () => {
  const electricCases = [
    ["E1", "ID.3"],
    ["E2", "ID.4"],
    ["E3", "ID.5"],
    ["E4", "ID.7"],
  ] as const;

  for (const [type, model] of electricCases) {
    it(`${type} resolves ${model} as an EV`, () => {
      const vin = typedVin("WVW", type);
      expect(decodeVolkswagenModern(vin)?.model).toBe(model);
      const decoded = decodeVin(vin);
      expect(decoded.model).toContain(model);
      expect(decoded.fuelType).toBe("Electric");
      expect(decoded.transmissionDecoded).toBe("Single-Speed Automatic");
    });
  }

  it("EB resolves ID. Buzz under the SUV/MPV WMI", () => {
    const vin = typedVin("WVG", "EB");
    expect(decodeVin(vin).model).toContain("ID. Buzz");
    expect(decodeVin(vin).bodyStyleDecoded).toBe("MPV / Van");
    expect(decodeVin(vin).fuelType).toBe("Electric");
  });

  it("corrects legacy shifted or incorrect VW type mappings", () => {
    expect(decodeVin(typedVin("WVW", "CJ", "S")).model).toContain("Passat");
    expect(decodeVin(typedVin("WVW", "SK", "S")).model).toContain("Caddy");
    expect(decodeVin(typedVin("WVW", "6C", "S")).model).toContain("Polo");
  });

  it("covers recent combustion/hybrid-era product lines", () => {
    expect(decodeVin(typedVin("WVW", "CT", "S")).model).toContain("Tiguan");
    expect(decodeVin(typedVin("WVW", "R4", "S")).model).toContain("Tayron");
    expect(decodeVin(typedVin("WVG", "CR", "S")).model).toContain("Touareg");
  });

  it("covers North-American VW type codes and WMIs", () => {
    const id4 = typedVin("1V2", "E8", "S", "AAA");
    expect(decodeVin(id4).make).toBe("Volkswagen");
    expect(decodeVin(id4).model).toContain("ID.4");
    expect(decodeVin(id4).fuelType).toBe("Electric");

    expect(decodeVin(typedVin("3VV", "B2", "S", "AAA")).model).toContain("Taos");
    expect(decodeVin(typedVin("1V2", "CA", "S", "AAA")).model).toContain("Atlas");
    expect(decodeVin(typedVin("1VW", "A3", "D", "ZZZ")).model).toContain("Passat");
  });

  it("decodes both China-only ID.6 joint-venture variants", () => {
    const crozz = decodeVin("LFVVB9E74M5110965");
    expect(crozz.make).toBe("Volkswagen");
    expect(crozz.model).toContain("ID.6 CROZZ");
    expect(crozz.fuelType).toBe("Electric");
    expect(crozz.transmissionDecoded).toBe("Single-Speed Automatic");

    const id6x = decodeVin("LSV1C6E59M2015316");
    expect(id6x.make).toBe("Volkswagen");
    expect(id6x.model).toContain("ID.6 X");
    expect(id6x.fuelType).toBe("Electric");
    expect(id6x.bodyStyleDecoded).toBe("SUV / Crossover");
  });

  it("uses neutral JV make for unverified China LFV/LSV VINs", () => {
    const unknown = decodeVin("LFVZZZZZZZZ123456");
    expect(unknown.make).toBe("Volkswagen Group (China JV)");
  });
});

describe("modern Audi type decoding", () => {
  const evCases = [
    ["GF", "Q6 e-tron"],
    ["GH", "A6 e-tron"],
    ["FZ", "Q4 e-tron"],
    ["FW", "e-tron GT"],
  ] as const;

  for (const [type, model] of evCases) {
    it(`${type} resolves ${model}`, () => {
      const vin = typedVin("WAU", type);
      expect(decodeAudiModern(vin)?.model).toContain(model);
      const decoded = decodeVin(vin);
      expect(decoded.model).toContain(model);
      expect(decoded.fuelType).toBe("Electric");
      expect(decoded.transmissionDecoded).toBe("Single-Speed Automatic");
    });
  }

  it("year-gates GE e-tron naming", () => {
    expect(decodeAudiModern(typedVin("WAU", "GE", "N"))?.model).toContain("e-tron");
    expect(decodeAudiModern(typedVin("WAU", "GE", "R"))?.model).toContain("Q8 e-tron");
  });

  it("recognizes current Q5 and splits NA F2 A6 vs A7", () => {
    const q5 = typedVin("WA1", "GU", "S", "AAA");
    expect(decodeVin(q5).model).toContain("Q5");

    expect(decodeVin("WAUD2AF20KN123456").model).toMatch(/^A6\b/);
    expect(decodeVin("WAUD2AF20KN123456").model).not.toMatch(/A7/);
    expect(decodeVin("WAUV2AF20KN123456").model).toMatch(/A7/);
    expect(decodeVin("WAUV2AF20KN123456").model).not.toMatch(/A6/);
    // Ambiguous EU letter platform / unknown pos.4 — make only, never "A6 / A7".
    const sport = typedVin("WUA", "F2", "S", "AAA");
    expect(decodeVin(sport).make).toBe("Audi");
    expect(decodeVin(sport).model ?? "").not.toContain("A6 / A7");
    expect(decodeVin("WAUZZZF2AAN123456").model ?? "").not.toContain("A6 / A7");
  });
});

describe("modern Škoda type decoding", () => {
  const cases = [
    ["5A", "Enyaq", true],
    ["PY", "Elroq", true],
    ["NZ", "Superb", false],
    ["PS", "Kodiaq", false],
    ["NX", "Octavia", false],
    ["PJ", "Fabia", false],
  ] as const;

  for (const [type, model, electric] of cases) {
    it(`${type} resolves ${model}`, () => {
      const vin = typedVin("TMB", type);
      expect(decodeSkodaModern(vin)?.model).toBe(model);
      const decoded = decodeVin(vin);
      expect(decoded.make).toBe("Škoda");
      expect(decoded.model).toBe(model);
      if (electric) {
        expect(decoded.fuelType).toBe("Electric");
        expect(decoded.transmissionDecoded).toBe("Single-Speed Automatic");
      }
    });
  }

  it("recognizes additional verified Škoda WMIs", () => {
    const vin = typedVin("TMP", "PS");
    expect(decodeVin(vin).make).toBe("Škoda");
    expect(decodeVin(vin).model).toBe("Kodiaq");
  });

  it("year-gates the reused PS code between Kamiq and Kodiaq", () => {
    expect(decodeVin(typedVin("TMB", "PS", "M")).model).toBe("Kamiq");
    expect(decodeVin(typedVin("TMB", "PS", "S")).model).toBe("Kodiaq");
  });

  it("disambiguates Elroq from Enyaq Coupé on shared NY type code", () => {
    const elroq = decodeVin("TMBNC9NY9SF084979");
    expect(elroq.model).toBe("Elroq");
    expect(elroq.fuelType).toBe("Electric");
  });
});

describe("modern Porsche type decoding", () => {
  it("uses positions 7, 8 and 12 for Taycan", () => {
    const vin = porscheTypeVin("WP0", "Y1", "A");
    expect(decodePorscheModern(vin)?.model).toBe("Taycan");
    const decoded = decodeVin(vin);
    expect(decoded.model).toContain("Taycan");
    expect(decoded.fuelType).toBe("Electric");
    expect(decoded.transmissionDecoded).toBe("Single-Speed Automatic");
  });

  it("decodes all official Macan Electric type variants", () => {
    for (const variant of ["0", "1", "2"]) {
      const vin = porscheTypeVin("WP1", "XA", variant);
      expect(decodePorscheModern(vin)?.model).toBe("Macan Electric");
      expect(decodeVin(vin).fuelType).toBe("Electric");
    }
  });

  it("decodes current Panamera type YA0", () => {
    const vin = porscheTypeVin("WP0", "YA", "0", "R");
    expect(decodeVin(vin).model).toContain("Panamera");
    expect(decodePorscheModern(vin)?.chassis).toBe("976");
  });

  it("keeps the long-running 911 type conservative", () => {
    const current = typedVin("WP0", "99", "S");
    expect(decodeVin(current).model).toContain("911");
    expect(decodePorscheModern(current)?.chassis).toBeNull();
  });

  it("maps Porsche 97 type to Panamera, not 911", () => {
    const panamera = typedVin("WP0", "97", "S");
    expect(decodePorscheModern(panamera)?.model).toContain("Panamera");
    expect(decodeVin(panamera).model).toContain("Panamera");
  });
});
