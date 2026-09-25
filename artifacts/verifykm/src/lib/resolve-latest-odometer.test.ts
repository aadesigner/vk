import { describe, expect, it } from "vitest";
import { resolveLatestOdometerRecordedDate, resolveLatestRecordedOdometer } from "./resolve-latest-odometer";

describe("resolveLatestOdometerRecordedDate", () => {
  it("returns the date from the mileage history row matching the resolved odometer", () => {
    const input = {
      odometer: 101_410,
      mileageHistory: [{ odometer: 101_410, date: "2024-03-15" }],
      registryHistory: [{ mileage: 77_675, date: "2022-08-01" }],
    };
    expect(resolveLatestRecordedOdometer(input)).toBe(101_410);
    expect(resolveLatestOdometerRecordedDate(input)).toBe("2024-03-15");
  });

  it("uses registry inspection date when that is the resolved reading", () => {
    const input = {
      country: "kr",
      odometer: 301_000,
      mileageHistory: [{ odometer: 301_000, date: "2025-01-01", source: "na_auction" }],
      registryHistory: [{ mileage: 245_000, date: "2023-11-20" }],
    };
    expect(resolveLatestRecordedOdometer(input)).toBe(245_000);
    expect(resolveLatestOdometerRecordedDate(input)).toBe("2023-11-20");
  });

  it("returns null when no dated reading is available", () => {
    expect(resolveLatestOdometerRecordedDate({
      odometer: 120_000,
      mileageHistory: [{ odometer: 120_000 }],
    })).toBeNull();
  });
});
