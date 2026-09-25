import { describe, expect, it } from "vitest";
import { summarizeVinLookupData } from "./vinLookupSummary.js";

describe("summarizeVinLookupData", () => {
  it("returns null for non-object data", () => {
    expect(summarizeVinLookupData(null)).toBeNull();
    expect(summarizeVinLookupData([])).toBeNull();
  });

  it("keeps dashboard card fields and trims heavy arrays", () => {
    const full = {
      make: "Hyundai",
      model: "Sonata",
      year: 2019,
      odometer: 88_000,
      accidentCount: 2,
      isSalvage: false,
      photos: ["a.jpg", "b.jpg", "c.jpg"],
      mileageHistory: Array.from({ length: 30 }, (_, i) => ({
        date: `2020-0${(i % 9) + 1}-01`,
        odometer: 10_000 + i * 1000,
      })),
      ownerHistory: [{ date: "2021-01-01", mileage: 50_000 }],
      registryHistory: [
        {
          type: "insurance_event",
          title: "Collision repair",
          details: [{ label: "Mileage", value: "60,000 km" }],
        },
      ],
      accidents: [{ severity: "minor", date: "2022-01-01", lossAmount: 1_000_000 }],
      insuranceClaims: [{ date: "2022-01-01", type: "own damage", lossAmount: 500_000 }],
      vinDecode: { huge: true },
      rawProviderPayload: { nested: { deep: true } },
    };

    const summary = summarizeVinLookupData(full);
    expect(summary).toMatchObject({
      make: "Hyundai",
      model: "Sonata",
      year: 2019,
      odometer: 88_000,
      accidentCount: 2,
      isSalvage: false,
    });
    expect(summary!.photos).toHaveLength(1);
    expect(summary!.mileageHistory).toHaveLength(20);
    expect(summary!.accidents).toHaveLength(1);
    expect(summary).not.toHaveProperty("vinDecode");
    expect(summary).not.toHaveProperty("rawProviderPayload");
  });

  it("uses thumbnailUrl when photos array is empty", () => {
    const summary = summarizeVinLookupData({
      make: "Kia",
      model: "Sportage",
      thumbnailUrl: "/api/vin/image?token=abc",
      photos: [],
    });
    expect(summary!.photos).toEqual(["/api/vin/image?token=abc"]);
  });
});
