import { describe, expect, it } from "vitest";
import { decodeVin } from "./vinDecoder";
import { decodeTeslaSpec, isTeslaVin } from "./tesla";
import { decodeBydSpec } from "./byd";
import { decodeZeekrSpec } from "./zeekr";
import { decodeXiaomiSpec } from "./xiaomi";

describe("Tesla decoder", () => {
  it("decodes Model 3 RWD with NMC battery", () => {
    const spec = decodeTeslaSpec("5YJ3E1EA0KF123456");
    expect(spec?.model).toBe("Model 3");
    expect(spec?.fuelType).toBe("Electric");
    expect(spec?.driveType).toBe("Rear-Wheel Drive");
    expect(spec?.engineDecoded).toContain("Single Motor");
    expect(spec?.engineDecoded).toContain("NCA/NMC");
  });

  it("decodes Model Y AWD Performance", () => {
    const spec = decodeTeslaSpec("7SAYGFEF0PF123456");
    expect(spec?.model).toBe("Model Y");
    expect(spec?.driveType).toBe("All-Wheel Drive");
    expect(spec?.bodyStyle).toContain("SUV");
  });

  it("decodes Shanghai-built Model 3", () => {
    const spec = decodeTeslaSpec("LRW3E7EK0NC123456");
    expect(spec?.model).toBe("Model 3");
    expect(spec?.plantCountry).toBe("China");
  });
});

describe("BYD decoder", () => {
  it("decodes Atto 3 from LGXCE4 prefix", () => {
    const spec = decodeBydSpec("LGXCE4CB6N2154228");
    expect(spec).toEqual(expect.objectContaining({
      make: "BYD",
      model: "Atto 3",
      bodyStyle: "SUV",
      fuelType: "Electric",
    }));
  });

  it("decodes Seal from LGXCH6 prefix", () => {
    expect(decodeBydSpec("LGXCH6CD9N2084390")?.model).toBe("Seal");
  });

  it("decodes Dolphin from LC0CE4 prefix", () => {
    expect(decodeBydSpec("LC0CE4CB0M0099725")?.model).toBe("Dolphin");
  });

  it("decodes Han from LC0CE6 prefix", () => {
    expect(decodeBydSpec("LC0CE6CD0N2000001")?.model).toBe("Han");
  });
});

describe("Zeekr decoder", () => {
  it("decodes Zeekr 001 from L6T79T2 prefix", () => {
    const spec = decodeZeekrSpec("L6T79T2E0NP029402");
    expect(spec?.make).toBe("Zeekr");
    expect(spec?.model).toBe("001");
    expect(spec?.bodyStyle).toBe("Shooting Brake");
  });

  it("decodes Zeekr 007 RWD from L6T79ME prefix", () => {
    const spec = decodeZeekrSpec("L6T79MEN2P1234567");
    expect(spec?.model).toBe("007");
    expect(spec?.driveType).toBe("Rear-Wheel Drive");
  });

  it("decodes Zeekr 009 from L6T79T2E9M prefix", () => {
    const spec = decodeZeekrSpec("L6T79T2E9MP002410");
    expect(spec?.model).toBe("009");
    expect(spec?.bodyStyle).toBe("MPV");
  });

  it("decodes Zeekr 7X AWD", () => {
    expect(decodeZeekrSpec("L6T79NCE2S1234567")?.model).toBe("7X");
  });
});

describe("Xiaomi decoder", () => {
  it("decodes SU7 from LNB WMI", () => {
    const spec = decodeXiaomiSpec("LNBMS00000R123456");
    expect(spec?.make).toBe("Xiaomi");
    expect(spec?.model).toBe("SU7");
    expect(spec?.bodyStyle).toBe("Sedan");
    expect(spec?.fuelType).toBe("Electric");
  });

  it("decodes SU7 from HXM WMI", () => {
    expect(decodeXiaomiSpec("HXM0000000R123456")?.model).toBe("SU7");
  });
});

describe("Toyota USA 5YF (not Tesla)", () => {
  it("does not treat 5YF as a Tesla WMI", () => {
    expect(isTeslaVin("5YFS4MCE0NP127131")).toBe(false);
    expect(decodeTeslaSpec("5YFS4MCE0NP127131")).toBeNull();
  });

  it("decodes Mississippi Corolla VIN as Toyota Corolla", () => {
    const r = decodeVin("5YFS4MCE0NP127131");
    expect(r.make).toBe("Toyota");
    expect(r.model).toBe("Corolla");
    // Letter N uniquely fits E210 Corolla window → 2022
    expect(r.year).toBe(2022);
    expect(r.plantCity).toBe("Blue Springs, MS");
    expect(r.engineDecoded).toContain("2.0L");
  });
});

describe("decodeVin integration", () => {
  it("returns Tesla make + model + specs", () => {
    const r = decodeVin("5YJ3E1EA0KF123456");
    expect(r.make).toBe("Tesla");
    expect(r.model).toBe("Model 3");
    expect(r.fuelType).toBe("Electric");
    expect(r.transmissionDecoded).toBe("Single-Speed Automatic");
  });

  it("returns BYD make + Atto 3", () => {
    const r = decodeVin("LGXCE4CB6N2154228");
    expect(r.make).toBe("BYD");
    expect(r.model).toBe("Atto 3");
    expect(r.bodyStyleDecoded).toBe("SUV");
  });

  it("returns Zeekr make + model", () => {
    const r = decodeVin("L6T79T2E0NP029402");
    expect(r.make).toBe("Zeekr");
    expect(r.model).toBe("001");
  });

  it("returns Xiaomi make + SU7", () => {
    const r = decodeVin("LNBMS00000R123456");
    expect(r.make).toBe("Xiaomi");
    expect(r.model).toBe("SU7");
  });
});
