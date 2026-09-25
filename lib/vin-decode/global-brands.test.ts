import { describe, expect, it } from "vitest";
import { decodeGlobalBrand, decodeVin } from "./index";

describe("decodeGlobalBrand lightweight dispatch", () => {
  it("returns empty for unrelated Toyota VIN without scanning all tables", () => {
    const r = decodeGlobalBrand("JTDKB20U797867720");
    expect(r.model).toBeNull();
    expect(r.makeOverride).toBeNull();
  });

  it("single pass returns Dacia make + model together", () => {
    const r = decodeGlobalBrand("UU1DJF11065848712");
    expect(r.makeOverride).toBe("Dacia");
    expect(r.model).toBe("Duster");
  });
});

describe("JN1 Nissan vs Infiniti (shared Japan PC WMI)", () => {
  it("defaults JN1 make to Nissan (not Infiniti)", () => {
    const r = decodeVin("JN1ZZZZZ0N0123456");
    expect(r.make).toBe("Nissan");
    expect(r.model).toBeNull();
  });

  it("Japan Leaf JN1AZ0* stays Nissan Leaf", () => {
    const r = decodeVin("JN1AZ0CP0BT000001");
    expect(r.make).toBe("Nissan");
    expect(r.model).toBe("Leaf");
  });

  it("verified Infiniti Q50 / Q60 VDS on JN1 overrides make", () => {
    expect(decodeVin("JN1BV7AR0EM680355")).toMatchObject({ make: "Infiniti", model: "Q50" });
    expect(decodeVin("JN1FV7LK0MM530035")).toMatchObject({ make: "Infiniti", model: "Q60" });
  });

  it("dedicated Infiniti WMIs remain Infiniti", () => {
    expect(decodeVin("JNKCV51E0AM123456").make).toBe("Infiniti");
    expect(decodeVin("JNAAZ0CP0N0123456").make).toBe("Infiniti");
  });
});
