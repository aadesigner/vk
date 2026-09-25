import { describe, expect, it } from "vitest";
import {
  isVehicleTooOldForLookup,
  isVehicleEligibleForHistoryLookup,
  MIN_VEHICLE_LOOKUP_YEAR,
} from "@workspace/vin-decode";

describe("lookup eligibility", () => {
  it("year gate is disabled", () => {
    expect(MIN_VEHICLE_LOOKUP_YEAR).toBe(2008);
    expect(isVehicleTooOldForLookup(2007)).toBe(false);
    expect(isVehicleTooOldForLookup(1999)).toBe(false);
    expect(isVehicleEligibleForHistoryLookup(2007)).toBe(true);
    expect(isVehicleTooOldForLookup(2008)).toBe(false);
    expect(isVehicleTooOldForLookup(2009)).toBe(false);
    expect(isVehicleTooOldForLookup(2020)).toBe(false);
    expect(isVehicleEligibleForHistoryLookup(2008)).toBe(true);
    expect(isVehicleEligibleForHistoryLookup(2009)).toBe(true);
  });

  it("ignores missing or implausible years", () => {
    expect(isVehicleTooOldForLookup(null)).toBe(false);
    expect(isVehicleTooOldForLookup(undefined)).toBe(false);
    expect(isVehicleTooOldForLookup(3008)).toBe(false);
    expect(isVehicleTooOldForLookup(0)).toBe(false);
  });
});
