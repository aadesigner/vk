import { describe, it, expect } from "vitest";
import {
  apiPathRestriction,
  isApiPathUnderMaintenance,
  isExemptMaintenanceApiPath,
  normalizeMaintenanceRestrictions,
} from "./maintenancePolicy.js";

describe("maintenancePolicy", () => {
  it("normalizes partial restrictions", () => {
    expect(normalizeMaintenanceRestrictions(["free_decoder", "bogus", "checkout", "checkout"]))
      .toEqual(["free_decoder", "checkout"]);
  });

  it("maps API paths to restrictions", () => {
    expect(apiPathRestriction("/vin/decode-free")).toBe("free_decoder");
    expect(apiPathRestriction("/payments/create-paypal-order")).toBe("checkout");
    expect(apiPathRestriction("/payments/create-credit-pack-order")).toBe("checkout");
    expect(apiPathRestriction("/payments/create-pok-order")).toBe("checkout");
    expect(apiPathRestriction("/payments/confirm-pok-order")).toBe("checkout");
    expect(apiPathRestriction("/payments/redeem-credit")).toBe("checkout");
    expect(apiPathRestriction("/vin/lookup")).toBe("vin_reports");
    expect(apiPathRestriction("/vin/peek/5YJSA1E14HF000001")).toBe("vin_reports");
    expect(apiPathRestriction("/vin/42")).toBe("vin_reports");
    expect(apiPathRestriction("/vin/public/ABC")).toBeNull();
  });

  it("blocks full site when maintenanceMode is on", () => {
    expect(isApiPathUnderMaintenance("/vin/42", {
      maintenanceMode: true,
      maintenanceRestrictions: [],
      maintenanceMessage: null,
    })).toBe(true);
  });

  it("blocks only configured partial restrictions", () => {
    const state = {
      maintenanceMode: false,
      maintenanceRestrictions: normalizeMaintenanceRestrictions(["free_decoder"]),
      maintenanceMessage: null,
    };
    expect(isApiPathUnderMaintenance("/vin/decode-free", state)).toBe(true);
    expect(isApiPathUnderMaintenance("/vin/42", state)).toBe(false);
  });

  it("exempts public settings and health", () => {
    expect(isExemptMaintenanceApiPath("/payments/public-settings")).toBe(true);
    expect(isExemptMaintenanceApiPath("/healthz")).toBe(true);
    expect(isExemptMaintenanceApiPath("/vin/decode-free")).toBe(false);
  });
});
