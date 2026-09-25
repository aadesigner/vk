import { describe, expect, it } from "vitest";
import { resolveLatestOdometerKm } from "./index";

describe("resolveLatestOdometerKm", () => {
  it("uses the highest mileage across listing and registry history", () => {
    expect(resolveLatestOdometerKm({
      odometer: 160_000,
      mileageHistory: [{ odometer: 161_404 }],
      registryHistory: [{
        mileage: 170_500,
        details: [{ label: "Driving distance during inspection", value: "77,675km" }],
      }],
      ownerHistory: [{ mileage: 168_000 }],
    })).toBe(170_500);
  });

  it("ignores inflated US auction mileage for Korean registry vehicles", () => {
    expect(resolveLatestOdometerKm({
      country: "kr",
      odometer: 301_000,
      mileageHistory: [
        { odometer: 301_000, source: "na_auction" },
        { odometer: 101_410, source: "listing" },
      ],
      registryHistory: [
        { mileage: 245_000, details: [{ label: "Driving distance during inspection", value: "245,000km" }] },
        { mileage: 198_500, details: [{ label: "Driving distance during inspection", value: "198,500km" }] },
      ],
      ownerHistory: [{ mileage: 210_000 }],
    })).toBe(245_000);
  });

  it("allows Encar listing readings above the last registry inspection", () => {
    expect(resolveLatestOdometerKm({
      country: "kr",
      odometer: 101_410,
      mileageHistory: [{ odometer: 101_410 }],
      registryHistory: [{
        mileage: 77_675,
        details: [{ label: "Driving distance during inspection", value: "77,675km" }],
      }],
    })).toBe(101_410);
  });

  it("uses admin-locked odometer instead of higher registry readings", () => {
    expect(resolveLatestOdometerKm({
      odometer: 315_707,
      odometerLocked: true,
      mileageHistory: [{ odometer: 200_000 }],
      registryHistory: [{ mileage: 400_000, details: [{ value: "400,000km" }] }],
    })).toBe(315_707);
  });
});
