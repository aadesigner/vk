/**
 * Focus-brand free VIN decoder coverage:
 * Smart, Opel, Renault, Toyota, Hyundai, Honda, Suzuki, Fiat, Ford.
 * Prefix / WMI only — no speculative model guesses.
 */

import { describe, expect, it } from "vitest";
import { decodeVin, decodeVinLocalFree, decodeLocalSeries } from "./index";

function pad(prefix: string): string {
  const base = prefix.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "0");
  return (base + "000000000000000").slice(0, 17);
}

describe("focus brands — Smart", () => {
  it("WME451 fortwo + Hambach plant", () => {
    const vin = pad("WME4510000K123456");
    const r = decodeVin(vin);
    expect(r.make).toBe("Smart");
    expect(r.model).toBe("fortwo");
    expect(r.plantCity).toBe("Hambach");
    expect(decodeLocalSeries(vin)).toBe("451");
  });

  it("HESXR → Smart #1 EV (China JV)", () => {
    const vin = "HESXR1C49PS069265";
    const r = decodeVinLocalFree(vin)!;
    expect(r.make).toBe("Smart");
    expect(r.model).toBe("#1");
    expect(r.series).toBe("HX11");
    expect(r.fuelType).toBe("Electric");
    expect(r.countryOfOrigin).toBe("China");
  });

  it("HESCR → Smart #3 EV", () => {
    const vin = "HESCR1C43PS131354";
    const r = decodeVin(vin);
    expect(r.make).toBe("Smart");
    expect(r.model).toBe("#3");
    expect(r.fuelType).toBe("Electric");
    expect(decodeLocalSeries(vin)).toBe("HC11");
  });

  it("W1A453 → Smart forfour (MB AG WMI)", () => {
    const vin = pad("W1A4530000L123456");
    const r = decodeVin(vin);
    expect(r.make).toBe("Smart");
    expect(r.model).toBe("forfour");
    expect(decodeLocalSeries(vin)).toBe("453");
  });
});

describe("focus brands — Opel", () => {
  it("W0LP Astra German plant", () => {
    const vin = pad("W0LPE6ED5A1123456");
    const r = decodeVin(vin);
    expect(r.make).toBe("Opel");
    expect(r.model).toBe("Astra");
  });

  it("W0LF Frontera", () => {
    expect(decodeVin(pad("W0LF")).model).toBe("Frontera");
  });

  it("W0L0ZEC Corsa-e", () => {
    expect(decodeVin(pad("W0L0ZEC")).model).toBe("Corsa-e");
  });
});

describe("focus brands — Renault", () => {
  it("VF1 Clio / Captur / Megane / Zoe", () => {
    expect(decodeVin("VF1RJA00012345678").model).toContain("Clio");
    expect(decodeVin(pad("VF1RFK")).model).toBe("Captur");
    expect(decodeVin(pad("VF1LB")).model).toBe("Megane");
    expect(decodeVin(pad("VF1R000")).model).toBe("Zoe");
  });

  it("VF2 Spanish plant resolves make + Clio", () => {
    const r = decodeVin(pad("VF2RJA"));
    expect(r.make).toBe("Renault");
    expect(r.model).toBe("Clio");
  });

  it("VF1BA Twingo", () => {
    expect(decodeVin(pad("VF1BA")).model).toBe("Twingo");
  });
});

describe("focus brands — Fiat", () => {
  it("official type-approval: 312 / 199 / ZCG", () => {
    expect(decodeVin("ZFA31200000745586").model).toBe("500");
    expect(decodeVin("ZFA31200003974827").model).toBe("Panda");
    expect(decodeVin("ZFA19900005000000").model).toBe("500L");
    expect(decodeVin(pad("ZFA199")).model).toBe("Punto");
    expect(decodeVin(pad("ZFA334")).model).toBe("500X");
    expect(decodeVin(pad("ZFA356")).model).toBe("Tipo");
    expect(decodeVin(pad("ZCG312")).make).toBe("Fiat");
    expect(decodeVin(pad("ZCG312")).model).toBe("500");
  });
});

describe("focus brands — Suzuki", () => {
  it("Swift / Ignis Hungary", () => {
    expect(decodeVin("JS2ZC33S7C4116148").model).toBe("Swift");
    const ignis = decodeVin(pad("TSMMH"));
    expect(ignis.make).toBe("Suzuki");
    expect(ignis.model).toBe("Ignis");
    expect(ignis.country).toBe("Hungary");
  });
});

describe("focus brands — Honda", () => {
  it("US Accord series", () => {
    const vin = "1HGCV1F34LA123456";
    expect(decodeVin(vin).model).toBe("Accord");
    expect(decodeLocalSeries(vin)).toBe("10th gen");
  });

  it("UK Swindon Civic FN2", () => {
    // positions: 1-5 SHHFN … plant at index 10 = A (Swindon)
    const vin = "SHHFN2000PA123456";
    const r = decodeVin(vin);
    expect(r.make).toBe("Honda");
    expect(r.model).toBe("Civic");
    expect(r.plantCity).toBe("Swindon");
    expect(decodeLocalSeries(vin)).toBe("FN2");
  });
});

describe("focus brands — Toyota / Hyundai", () => {
  it("Toyota RAV4 + Corolla Cross chassis", () => {
    expect(decodeVin("JTMB1RFV0KD123456").model).toBe("RAV4");
    const cross = decodeVin(pad("JTMW1R"));
    expect(cross.make).toBe("Toyota");
    expect(cross.model).toBe("Corolla Cross");
    expect(decodeLocalSeries(pad("JTMW1R"))).toBe("XG10");
  });

  it("Hyundai IONIQ 5 + Sonata US", () => {
    expect(decodeVin("KMHL341BGBU123456").model).toContain("IONIQ");
    const sonata = decodeVin(pad("5NPE2"));
    expect(sonata.make).toBe("Hyundai");
    expect(sonata.model).toBe("Sonata");
  });
});

describe("focus brands — Ford", () => {
  it("EU Focus Mk4 + US F-150", () => {
    expect(decodeVin("WF0ZZZGBJNW123456").model).toContain("Focus");
    expect(decodeVin("1FTFW1E50MFA12345").model).toBe("F-150");
  });

  it("Puma ST homologation", () => {
    expect(decodeVin(pad("WF0ZZZNGC")).model).toContain("Puma");
  });
});

describe("focus brands — Jaguar / Range Rover (Land Rover)", () => {
  it("EU ZZZ Range Rover / Defender / Discovery Sport", () => {
    const rr = decodeVin("SALZZZBN1MA123456");
    expect(rr.make).toBe("Land Rover");
    expect(rr.model).toContain("Range Rover");
    expect(decodeLocalSeries("SALZZZBN1MA123456")).toMatch(/L405|L460/);

    expect(decodeVin("SALZZZLM1MA123456").model).toContain("Defender");
    expect(decodeVin("SALZZZJA1MA123456").model).toContain("Discovery Sport");
  });

  it("EU ZZZ Jaguar F-Pace / I-Pace / XF", () => {
    expect(decodeVin("SAJZZZBG1MA123456").model).toContain("F-Pace");
    const ipace = decodeVin("SAJZZZBM1MA123456");
    expect(ipace.make).toBe("Jaguar");
    expect(ipace.model).toContain("I-Pace");
    expect(ipace.fuelType).toBe("Electric");
    expect(decodeVin("SAJZZZBN1MA123456").model).toContain("XF");
  });

  it("US Defender SALE* does not stay as Evoque", () => {
    const vin = "SALEX7EU0L2000152";
    const r = decodeVin(vin);
    expect(r.make).toBe("Land Rover");
    expect(r.model).toContain("Defender");
    expect(decodeLocalSeries(vin)).toBe("L663");
    expect(r.year).toBe(2020);
    // Plant left null — generic SAL plant table removed for accuracy.
    expect(r.plantCity).toBeNull();
  });

  it("US Velar SALY / Jaguar F-Pace prefixes", () => {
    const velar = "SALYA2000N0000000".slice(0, 17);
    expect(decodeVin(velar).model).toContain("Velar");
    const fp = decodeVin(pad("SAJXA4"));
    expect(fp.make).toBe("Jaguar");
    expect(fp.model).toContain("F-Pace");
  });

  it("classic UK SALLDH Defender", () => {
    const vin = "SALLDH0009A000000".slice(0, 17);
    expect(decodeVin(vin).model).toContain("Defender");
  });

  it("SALGA2JF is Range Rover L405 not Velar; SALWA2BK is Sport not Freelander", () => {
    const rr = decodeVin("SALGA2JFSFA226427");
    expect(rr.model).toMatch(/Range Rover/i);
    expect(rr.model).not.toMatch(/Velar/i);
    expect(rr.engineDecoded).toBeNull();
    expect(rr.fuelType).toBeNull();

    const sport = decodeVin("SALWA2BKGJA402093");
    expect(sport.model).toMatch(/Range Rover Sport/i);
    expect(sport.model).not.toMatch(/Freelander/i);
    expect(sport.engineDecoded).toBeNull();
    expect(sport.fuelType).toBeNull();
  });

  it("does not invent JLR model on bare WMI", () => {
    const r = decodeVin("SALZZZXX1MA123456");
    expect(r.make).toBe("Land Rover");
    expect(r.model).toBeNull();
  });
});

describe("focus brands — no false positives", () => {
  it("does not invent a model when only WMI is known", () => {
    const r = decodeVin("WME9990000K123456");
    expect(r.make).toBe("Smart");
    expect(r.model).toBeNull();
  });

  it("Toyota Proace on VF1BT stays Toyota line, not Renault Clio", () => {
    const r = decodeVin(pad("VF1BT9"));
    expect(r.make).toBe("Toyota");
    expect(r.model).toMatch(/Proace/);
  });
});
