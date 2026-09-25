import { describe, expect, it } from "vitest";
import {
  finalizeAdminCatalogSave,
  detectAdminCatalogMileageTouched,
  prepareManualPublishCatalogData,
  reconcileLockedOdometerData,
} from "./pendingVinCatalogPrep.js";

describe("prepareManualPublishCatalogData", () => {
  it("stores odometer in km and derives miles for display", () => {
    const out = prepareManualPublishCatalogData({
      country: "US",
      odometer: 80_467,
    });
    expect(out.odometer).toBe(80_467);
    expect(out.miles).toBe(50_000);
  });

  it("converts mileage history entered in miles to km", () => {
    const out = prepareManualPublishCatalogData({
      country: "US",
      mileageHistory: [{ odometer: 50_000, unit: "mi" }],
    });
    expect(out.mileageHistory).toEqual([{ odometer: 80_467, unit: "km" }]);
    expect(out.odometer).toBe(80_467);
    expect(out.miles).toBe(50_000);
  });
});

describe("detectAdminCatalogMileageTouched", () => {
  it("ignores unchanged scalar when only mileage history was edited", () => {
    const previous = {
      odometer: 120_000,
      mileageHistory: [{ date: "2025-01-01", odometer: 120_000 }],
    };
    const catalogFields = {
      odometer: 120_000,
      mileageHistory: [{ date: "2026-01-01", odometer: 55_000 }],
    };
    expect(detectAdminCatalogMileageTouched(previous, catalogFields)).toEqual({
      odometer: false,
      mileageHistory: true,
    });
    const out = finalizeAdminCatalogSave(
      { ...previous, ...catalogFields },
      detectAdminCatalogMileageTouched(previous, catalogFields),
    );
    expect(out.odometer).toBe(55_000);
    expect(out.odometerLocked).toBe(true);
  });
});

describe("finalizeAdminCatalogSave", () => {
  it("locks odometer when admin edits scalar and drops higher history readings", () => {
    const out = finalizeAdminCatalogSave(
      {
        country: "de",
        odometer: 42_000,
        odometerLocked: true,
        mileageHistory: [
          { date: "2024-01-01", odometer: 99_000 },
          { date: "2025-01-01", odometer: 88_000 },
        ],
        ownerHistory: [{ mileage: 99_000 }],
      },
      { odometer: true },
    );
    expect(out.odometer).toBe(42_000);
    expect(out.odometerLocked).toBe(true);
    expect(out.mileageHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ odometer: 42_000 }),
      ]),
    );
    expect(
      (out.mileageHistory as { odometer: number; source?: string }[])
        .find((e) => e.odometer === 42_000)?.source,
    ).toBeUndefined();
    expect((out.mileageHistory as { odometer: number }[]).every((e) => e.odometer <= 42_000)).toBe(true);
  });

  it("locks from edited mileage history so stale owner rows cannot win on serve", () => {
    const out = finalizeAdminCatalogSave(
      {
        country: "de",
        odometer: 120_000,
        mileageHistory: [{ date: "2026-01-01", odometer: 55_000 }],
        ownerHistory: [{ mileage: 120_000 }],
        registryHistory: [{ mileage: 118_000 }],
      },
      { mileageHistory: true },
    );
    expect(out.odometer).toBe(55_000);
    expect(out.odometerLocked).toBe(true);
    expect((out.ownerHistory as { mileage: number }[])[0]!.mileage).toBe(55_000);
  });
});

describe("reconcileLockedOdometerData", () => {
  it("adds mileage row when none match locked value without source", () => {
    const out = reconcileLockedOdometerData({ mileageHistory: [] }, 30_000);
    expect(out.mileageHistory).toEqual([
      expect.objectContaining({ odometer: 30_000 }),
    ]);
    expect((out.mileageHistory as { source?: string }[])[0]?.source).toBeUndefined();
  });

  it("caps owner and registry mileage when locking", () => {
    const out = reconcileLockedOdometerData(
      {
        ownerHistory: [{ mileage: 315_724 }],
        registryHistory: [{ mileage: 310_000, details: [{ label: "Mileage", value: "315,724 km" }] }],
      },
      100_000,
    );
    expect((out.ownerHistory as { mileage: number }[])[0]!.mileage).toBe(100_000);
    expect((out.registryHistory as { mileage: number }[])[0]!.mileage).toBe(100_000);
    expect((out.registryHistory as { details: { value: string }[] }[])[0]!.details[0]!.value).toBe("100,000 km");
  });
});
