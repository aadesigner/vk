import { describe, expect, it } from "vitest";
import {
  buildLockedHistorySummary,
  extractLockedPreviewSignals,
  lockedPreviewSignalsHaveFindings,
  sanitizeLockedPreviewSignalsForClient,
  LOCKED_PUBLIC_FORBIDDEN_KEYS,
} from "@workspace/vin-page-seo";

describe("extractLockedPreviewSignals", () => {
  it("counts safe fields and never exposes accidents", () => {
    const signals = extractLockedPreviewSignals({
      mileageHistory: [{ odometer: 10 }, { odometer: 20 }],
      ownerCount: 2,
      insuranceClaims: [{ id: 1 }],
      auctionHistory: [{ id: 1 }, { id: 2 }, { id: 3 }],
      registryHistory: [],
      accidentCount: 9,
      accidents: [{ id: 1 }, { id: 2 }],
      odometer: 99999,
      salvage: true,
    });

    expect(signals).toEqual({
      mileageRecordCount: 2,
      ownerCount: 2,
      insuranceClaimCount: 1,
      auctionRecordCount: 3,
      registryRecordCount: 0,
      floodRecordCount: 0,
    });
    expect(signals).not.toHaveProperty("accidentCount");
  });

  it("treats scalar odometer as one mileage reading when history empty", () => {
    expect(extractLockedPreviewSignals({ odometer: 50000 }).mileageRecordCount).toBe(1);
  });

  it("counts flood records from floodCount when flooded", () => {
    expect(
      extractLockedPreviewSignals({
        isFlooded: true,
        floodCount: 4,
        floodLossAmount: 4_060_218,
      }).floodRecordCount,
    ).toBe(4);
  });

  it("counts one flood record when flagged without floodCount", () => {
    expect(
      extractLockedPreviewSignals({ flooded: true }).floodRecordCount,
    ).toBe(1);
  });

  it("ignores flood amount / false flags", () => {
    expect(
      extractLockedPreviewSignals({
        isFlooded: false,
        floodCount: 0,
        floodLossAmount: 999,
      }).floodRecordCount,
    ).toBe(0);
  });
});

describe("sanitizeLockedPreviewSignalsForClient", () => {
  it("keeps only whitelisted count keys and strips attacker/extra fields", () => {
    const dirty = {
      mileageRecordCount: 4,
      ownerCount: 2,
      insuranceClaimCount: 1,
      auctionRecordCount: 0,
      registryRecordCount: 0,
      floodRecordCount: 4,
      accidentCount: 7,
      accidents: [{ secret: true }],
      odometer: 120000,
      mileageHistory: [{ odometer: 1 }],
      isFlooded: true,
      floodLossAmount: 4_060_218,
      isUnlocked: true,
    };
    const clean = sanitizeLockedPreviewSignalsForClient(dirty);
    expect(clean).toEqual({
      mileageRecordCount: 4,
      ownerCount: 2,
      insuranceClaimCount: 1,
      auctionRecordCount: 0,
      registryRecordCount: 0,
      floodRecordCount: 4,
    });
    for (const key of LOCKED_PUBLIC_FORBIDDEN_KEYS) {
      expect(clean).not.toHaveProperty(key);
    }
    expect(clean).not.toHaveProperty("isUnlocked");
    expect(clean).not.toHaveProperty("isFlooded");
    expect(clean).not.toHaveProperty("floodLossAmount");
  });

  it("clamps invalid and oversized counts", () => {
    expect(
      sanitizeLockedPreviewSignalsForClient({
        mileageRecordCount: -3,
        ownerCount: 1e9,
        insuranceClaimCount: "nope",
        auctionRecordCount: 2.7,
        registryRecordCount: null,
        floodRecordCount: 1.9,
      }),
    ).toEqual({
      mileageRecordCount: 0,
      ownerCount: 9999,
      insuranceClaimCount: 0,
      auctionRecordCount: 2,
      registryRecordCount: 0,
      floodRecordCount: 1,
    });
  });
});

describe("buildLockedHistorySummary", () => {
  it("includes VIN and findings without mentioning accidents", () => {
    const summary = buildLockedHistorySummary(
      "en",
      { vin: "WBA3V7106FJ995387", year: 2015, make: "BMW", model: "3 Series" },
      {
        mileageRecordCount: 4,
        ownerCount: 2,
        insuranceClaimCount: 0,
        auctionRecordCount: 1,
        registryRecordCount: 0,
        floodRecordCount: 0,
      },
    );

    expect(summary).toContain("WBA3V7106FJ995387");
    expect(summary).toContain("2015 BMW 3 Series");
    expect(summary).toContain("4 mileage readings");
    expect(summary).toContain("2 ownership records");
    expect(summary).toContain("1 auction records");
    expect(summary?.toLowerCase()).not.toContain("accident");
  });

  it("includes flood damage findings when present", () => {
    const summary = buildLockedHistorySummary(
      "en",
      { vin: "WDDUG8JB2KA456113", year: 2019, make: "Mercedes-Benz", model: "S-Class" },
      {
        mileageRecordCount: 0,
        ownerCount: 0,
        insuranceClaimCount: 0,
        auctionRecordCount: 0,
        registryRecordCount: 0,
        floodRecordCount: 4,
      },
    );
    expect(summary).toContain("4 flood damage records");
    expect(summary).toContain("WDDUG8JB2KA456113");
  });

  it("returns null when there are no findings", () => {
    expect(
      lockedPreviewSignalsHaveFindings({
        mileageRecordCount: 0,
        ownerCount: 0,
        insuranceClaimCount: 0,
        auctionRecordCount: 0,
        registryRecordCount: 0,
        floodRecordCount: 0,
      }),
    ).toBe(false);
    expect(
      buildLockedHistorySummary("en", { vin: "WBA3V7106FJ995387", make: "BMW" }, {
        mileageRecordCount: 0,
        ownerCount: 0,
        insuranceClaimCount: 0,
        auctionRecordCount: 0,
        registryRecordCount: 0,
        floodRecordCount: 0,
      }),
    ).toBeNull();
  });

  it("builds Albanian summary with VIN", () => {
    const summary = buildLockedHistorySummary(
      "sq",
      { vin: "WBA3V7106FJ995387", year: 2015, make: "BMW", model: "3 Series" },
      {
        mileageRecordCount: 3,
        ownerCount: 0,
        insuranceClaimCount: 0,
        auctionRecordCount: 0,
        registryRecordCount: 0,
        floodRecordCount: 0,
      },
    );
    expect(summary).toContain("VIN WBA3V7106FJ995387");
    expect(summary).toContain("3 lexime kilometrazhi");
    expect(summary?.toLowerCase()).not.toContain("aksident");
  });
});
