import { describe, it, expect, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://localhost:5432/verifykm_test";
});

import { applyCatalogAdminPatch } from "./vinCatalogImport.js";
import {
  detectAdminCatalogMileageTouched,
  finalizeAdminCatalogSave,
} from "./pendingVinCatalogPrep.js";

const BMW_ENTRY = {
  country: "kr",
  odometer: 315724,
  mileageHistory: [{ date: "2025-09-09", odometer: 315707, unit: "km" }],
  ownerHistory: [{ mileage: 315724 }],
  registryHistory: [{ mileage: 310000 }],
};

function adminSave(entryData: Record<string, unknown>, catalogFields: Record<string, unknown>) {
  const merged = applyCatalogAdminPatch(entryData, catalogFields);
  const touched = detectAdminCatalogMileageTouched(entryData, catalogFields);
  return finalizeAdminCatalogSave(merged, touched);
}

describe("admin catalog save integration", () => {
  it("persists scalar odometer edit for WBA7G shape", () => {
    const out = adminSave(BMW_ENTRY, { ...BMW_ENTRY, odometer: 100_000 });
    expect(out.odometer).toBe(100_000);
    expect(out.odometerLocked).toBe(true);
    expect((out.mileageHistory as { odometer: number }[]).every((e) => e.odometer <= 100_000)).toBe(true);
  });

  it("persists mileage history edit when scalar unchanged", () => {
    const out = adminSave(BMW_ENTRY, {
      ...BMW_ENTRY,
      mileageHistory: [{ date: "2025-09-09", odometer: 100_000, unit: "km" }],
    });
    expect(out.odometer).toBe(100_000);
    expect(out.odometerLocked).toBe(true);
  });

  it("persists admin-pasted photo URLs including non-CDN hosts", () => {
    const url = "https://images.example-cdn.net/vehicle/front.jpg";
    const out = adminSave({ make: "Kia", photos: [] }, {
      make: "Kia",
      photos: [url],
    });
    expect(out.photos).toEqual([url]);
  });

  it("persists every catalog/pending form field on admin save", () => {
    const patch = {
      make: "Hyundai",
      model: "Tucson",
      year: 2019,
      trim: "Limited",
      engine: "2.4",
      transmission: "A/T",
      fuelType: "Gasoline",
      bodyType: "SUV",
      color: "Blue",
      country: "us",
      odometer: 88000,
      ownerCount: 2,
      accidentCount: 1,
      hp: 181,
      cylinders: 4,
      titleStatus: "clean",
      isSalvage: false,
      isStolen: false,
      isTaxi: false,
      photos: ["https://cdn.example.com/car.jpg"],
      accidents: [{ date: "2020-01-01", type: "collision", primaryDamage: "front" }],
      insuranceClaims: [{ date: "2020-02-01", type: "collision", lossAmount: 1200 }],
      mileageHistory: [{
        date: "2024-01-01",
        odometer: 88000,
        unit: "km",
        source: "copart",
        primaryDamage: "none",
        secondaryDamage: "none",
      }],
      ownerHistory: [{ date: "2019-06-01", location: "CA", mileage: 100 }],
      auctionHistory: [{
        date: "2021-03-01",
        city: "Los Angeles",
        primaryDamage: "rear",
        secondaryDamage: "left",
        finalPrice: 7500,
      }],
      registryHistory: [{
        date: "2018-01-01",
        type: "registration",
        title: "First",
        details: [{ label: "Use", value: "Private" }],
      }],
      marketData: {
        estimatedValue: 15000,
        currency: "USD",
        lastAuctionPrice: 14000,
        lastAuctionDate: "2021-03-01",
      },
    };

    const out = adminSave({}, patch);

    expect(out.make).toBe("Hyundai");
    expect(out.model).toBe("Tucson");
    expect(out.year).toBe(2019);
    expect(out.trim).toBe("Limited");
    expect(out.engine).toBe("2.4");
    expect(out.transmission).toBe("A/T");
    expect(out.fuelType).toBe("Gasoline");
    expect(out.bodyType).toBe("SUV");
    expect(out.color).toBe("Blue");
    expect(out.country).toBe("us");
    expect(out.odometer).toBe(88000);
    expect(out.ownerCount).toBe(2);
    expect(out.accidentCount).toBe(1);
    expect(out.hp).toBe(181);
    expect(out.cylinders).toBe(4);
    expect(out.titleStatus).toBe("clean");
    expect(out.isSalvage).toBe(false);
    expect(out.isStolen).toBe(false);
    expect(out.isTaxi).toBe(false);
    expect(out.photos).toEqual(["https://cdn.example.com/car.jpg"]);
    expect(out.accidents).toEqual([expect.objectContaining({ primaryDamage: "front" })]);
    expect(out.insuranceClaims).toEqual([expect.objectContaining({ lossAmount: 1200 })]);
    expect(out.mileageHistory).toEqual([expect.objectContaining({
      source: "copart",
      primaryDamage: "none",
      secondaryDamage: "none",
    })]);
    expect(out.ownerHistory).toEqual([expect.objectContaining({ location: "CA" })]);
    expect(out.auctionHistory).toEqual([expect.objectContaining({
      primaryDamage: "rear",
      secondaryDamage: "left",
      finalPrice: 7500,
    })]);
    expect(out.registryHistory).toEqual([expect.objectContaining({
      title: "First",
      details: [{ label: "Use", value: "Private" }],
    })]);
    expect(out.marketData).toEqual(expect.objectContaining({
      estimatedValue: 15000,
      currency: "USD",
    }));
  });

  it("clears scalar fields and history arrays when admin empties them", () => {
    const existing = {
      make: "Kia",
      hp: 150,
      titleStatus: "salvage",
      photos: ["https://x.test/1.jpg"],
      insuranceClaims: [{ date: "2020-01-01" }],
      auctionHistory: [{ date: "2021-01-01" }],
      registryHistory: [{ date: "2019-01-01" }],
      marketData: { currency: "USD", estimatedValue: 1 },
    };
    const out = adminSave(existing, {
      make: "Kia",
      hp: null,
      titleStatus: "",
      photos: [],
      insuranceClaims: [],
      auctionHistory: [],
      registryHistory: [],
      marketData: null,
    });
    expect(out.hp).toBeUndefined();
    expect(out.titleStatus).toBeUndefined();
    expect(out.photos).toEqual([]);
    expect(out.insuranceClaims).toEqual([]);
    expect(out.auctionHistory).toEqual([]);
    expect(out.registryHistory).toEqual([]);
    expect(out.marketData).toBeUndefined();
  });
});
