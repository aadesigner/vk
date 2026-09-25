import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://localhost:5432/verifykm_test";
});

import {
  applyCatalogAdminPatch,
  buildCatalogJsonExportRecord,
  catalogDataFromCsvRecord,
  catalogDataFromCsvRow,
  catalogDataToCsvCells,
  catalogIdentityConflict,
  dedupeCatalogImportRows,
  mergeCatalogData,
  catalogHasDeliverableReport,
  catalogHasPreviewPhoto,
  catalogIsSeoIndexable,
  catalogDeliverableFromHint,
  normalizeJsonImportRecord,
  parseCsvBool,
  sanitizeCatalogPayload,
  preserveAdminTaxiFlag,
  stampCatalogImportData,
} from "./vinCatalogImport";
import { normalizeCarstatResponse } from "./vinService";

const SAMPLE_VIN = "WBA3V7106FJ995387";

describe("catalogHasDeliverableReport", () => {
  it("treats fulfillmentPending stub as not deliverable", () => {
    expect(catalogHasDeliverableReport({
      make: "Hyundai",
      model: "Elantra",
      year: 2018,
      fulfillmentPending: true,
      accidents: [],
    })).toBe(false);
  });

  it("accepts published catalog with history", () => {
    expect(catalogHasDeliverableReport({
      make: "Hyundai",
      model: "Elantra",
      year: 2018,
      mileageHistory: [{ date: "2020-01-01", odometer: 50000 }],
    })).toBe(true);
  });

  it("rejects empty catalog payload", () => {
    expect(catalogHasDeliverableReport({})).toBe(false);
  });

  it("requires preview photo for SEO indexability", () => {
    const withHistoryOnly = {
      make: "Hyundai",
      model: "Elantra",
      year: 2018,
      mileageHistory: [{ date: "2020-01-01", odometer: 50000 }],
    };
    expect(catalogHasDeliverableReport(withHistoryOnly)).toBe(true);
    expect(catalogHasPreviewPhoto(withHistoryOnly)).toBe(false);
    expect(catalogIsSeoIndexable(withHistoryOnly)).toBe(false);

    const withPhoto = {
      ...withHistoryOnly,
      photos: ["https://cdn.test/1.jpg"],
    };
    expect(catalogIsSeoIndexable(withPhoto)).toBe(true);
  });

  it("catalogDeliverableFromHint matches full-data helper", () => {
    const payloads = [
      { make: "Hyundai", model: "Elantra", year: 2018, fulfillmentPending: true, accidents: [] },
      { make: "Hyundai", model: "Elantra", year: 2018, mileageHistory: [{ date: "2020-01-01", odometer: 50000 }] },
      { make: "BMW", model: "3 Series", year: 2019, photos: ["https://x.test/1.jpg"] },
      { make: "Ford", model: "F-150", year: 2020 },
      {},
    ];
    for (const payload of payloads) {
      const d = payload as Record<string, unknown>;
      const hint = {
        fulfillmentPending: d.fulfillmentPending === true,
        accidentsLen: Array.isArray(d.accidents) ? d.accidents.length : 0,
        mileageLen: Array.isArray(d.mileageHistory) ? d.mileageHistory.length : 0,
        ownerLen: Array.isArray(d.ownerHistory) ? d.ownerHistory.length : 0,
        claimsLen: Array.isArray(d.insuranceClaims) ? d.insuranceClaims.length : 0,
        registryLen: Array.isArray(d.registryHistory) ? d.registryHistory.length : 0,
        auctionLen: Array.isArray(d.auctionHistory) ? d.auctionHistory.length : 0,
        serviceLen: Array.isArray(d.serviceHistory) ? d.serviceHistory.length : 0,
        photosLen: Array.isArray(d.photos) ? d.photos.length : 0,
        make: typeof d.make === "string" ? d.make : null,
        model: typeof d.model === "string" ? d.model : null,
        year: d.year,
      };
      expect(catalogDeliverableFromHint(hint)).toBe(catalogHasDeliverableReport(payload));
    }
  });
});

describe("normalizeJsonImportRecord", () => {
  it("reads full data blob from export format", () => {
    const row = normalizeJsonImportRecord({
      vin: "WBAGW4107LCD28117",
      make: "BMW",
      model: "5 Series",
      year: 2020,
      provider: "carstat",
      data: {
        ownerHistory: [{ date: "2019-04-16", mileage: 87100 }],
        auctionHistory: [{ date: "2021-05-18", finalPrice: 12000 }],
        insuranceClaims: [],
        registryHistory: [{ type: "inspection", date: "2020-01-01" }],
      },
    });
    expect(row?.vin).toBe("WBAGW4107LCD28117");
    expect(row?.data.make).toBe("BMW");
    expect(row?.data.ownerHistory).toHaveLength(1);
    expect(row?.data.auctionHistory).toHaveLength(1);
    expect(row?.data.registryHistory).toHaveLength(1);
  });

  it("accepts flat records without data wrapper", () => {
    const row = normalizeJsonImportRecord({
      vin: "1HGBH41JXMN109186",
      make: "Honda",
      accidents: [{ severity: "minor" }],
      marketData: { estimatedValue: 5000 },
    });
    expect(row?.data.make).toBe("Honda");
    expect(row?.data.accidents).toHaveLength(1);
    expect(row?.data.marketData).toEqual({ estimatedValue: 5000 });
  });

  it("rejects invalid VINs", () => {
    expect(normalizeJsonImportRecord({ vin: "SHORT" })).toBeNull();
  });
});

describe("catalogIdentityConflict", () => {
  it("detects make/model/year mismatch", () => {
    expect(catalogIdentityConflict(
      { make: "BMW", model: "X5", year: 2020 },
      { make: "Audi", model: "Q5", year: 2020 },
    )).toBe(true);
  });
});

describe("parseCsvBool", () => {
  it("parses common truthy values", () => {
    expect(parseCsvBool("1")).toBe(true);
    expect(parseCsvBool("true")).toBe(true);
    expect(parseCsvBool("0")).toBe(false);
    expect(parseCsvBool("")).toBe(false);
  });
});

describe("sanitizeCatalogPayload", () => {
  it("keeps explicit false salvage/stolen/taxi flags", () => {
    const data = sanitizeCatalogPayload({
      make: "BMW",
      isSalvage: false,
      isStolen: false,
      isTaxi: false,
      accidents: [],
    });
    expect(data.isSalvage).toBe(false);
    expect(data.isStolen).toBe(false);
    expect(data.isTaxi).toBe(false);
    expect(data.accidents).toEqual([]);
  });

  it("preserves titleStatus and registry history", () => {
    const data = sanitizeCatalogPayload({
      titleStatus: "clean",
      registryHistory: [{ type: "registration", date: "2015-03-01" }],
    });
    expect(data.titleStatus).toBe("clean");
    expect(data.registryHistory).toHaveLength(1);
  });

  it("preserves krwPerUsd and photo object URLs", () => {
    const data = sanitizeCatalogPayload({
      country: "kr",
      krwPerUsd: 1420,
      photos: [{ url: "https://cdn.example.com/a.jpg" }, "https://cdn.example.com/b.jpg"],
      auctionHistory: [{ date: "2021-05-18", finalPrice: 12000 }],
    });
    expect(data.krwPerUsd).toBe(1420);
    expect(data.photos).toEqual([
      "https://cdn.example.com/a.jpg",
      "https://cdn.example.com/b.jpg",
    ]);
    expect(data.auctionHistory).toHaveLength(1);
  });

  it("preserves photosHd and Copart/IAA 360 spin galleries", () => {
    const exterior = Array.from({ length: 12 }, (_, i) => `https://cdn.example.com/ext-${i}.jpg`);
    const interior = Array.from({ length: 10 }, (_, i) => `https://cdn.example.com/int-${i}.jpg`);
    const data = sanitizeCatalogPayload({
      make: "Mercedes-Benz",
      photos: ["https://cdn.example.com/still.jpg"],
      photosHd: ["https://cdn.example.com/still-hd.jpg"],
      photos360Exterior: exterior,
      photos360Interior: interior,
    });
    expect(data.photos).toEqual(["https://cdn.example.com/still.jpg"]);
    expect(data.photosHd).toEqual(["https://cdn.example.com/still-hd.jpg"]);
    expect(data.photos360Exterior).toEqual(exterior);
    expect(data.photos360Interior).toEqual(interior);
  });

  it("keeps IAAI panorama embed URLs as strings (not photo arrays)", () => {
    const embed =
      "https://vis.iaai.com/Home/ThreeSixtyView?keys=SID-45976616~STP-1~INT-1&iframeview=true";
    const data = sanitizeCatalogPayload({
      make: "BMW",
      photos: ["https://vis.iaai.com/resizer?x=1"],
      photos360EmbedUrl: embed,
      photos360EmbedExteriorUrl: "https://vis.iaai.com/Home/ThreeSixtyView?keys=SID-45976616~STP-1&iframeview=true",
      photos360EmbedInteriorUrl: "https://vis.iaai.com/Home/ThreeSixtyView?keys=SID-45976616~INT-1&iframeview=true",
    });
    expect(data.photos360EmbedUrl).toBe(embed);
    expect(typeof data.photos360EmbedUrl).toBe("string");
    expect(data.photos360EmbedExteriorUrl).toContain("STP-1");
    expect(data.photos360EmbedInteriorUrl).toContain("INT-1");
  });

  it("repairs legacy embed URLs wrongly stored as 1-element arrays", () => {
    const embed =
      "https://vis.iaai.com/Home/ThreeSixtyView?keys=SID-1~STP-1&iframeview=true";
    const data = sanitizeCatalogPayload({
      photos360EmbedUrl: [embed],
    });
    expect(data.photos360EmbedUrl).toBe(embed);
  });

  it("keeps 360 fields through normalize → sanitize (admin provider refresh)", () => {
    const exterior = Array.from({ length: 16 }, (_, i) => `https://cdn.example.com/ext-${i}.jpg`);
    const interior = Array.from({ length: 12 }, (_, i) => `https://cdn.example.com/int-${i}.jpg`);
    const normal = Array.from({ length: 8 }, (_, i) => `https://cdn.example.com/n-${i}.jpg`);
    const big = Array.from({ length: 8 }, (_, i) => `https://cdn.example.com/b-${i}.jpg`);
    const normalized = normalizeCarstatResponse({
      year: 2014,
      vin: "WDDLJ9BB6EA096494",
      manufacturer: { name: "Mercedes-Benz" },
      model: { name: "CLA" },
      lots: [{
        domain: { name: "copart_com" },
        images: { normal, big, exterior, interior },
      }],
    });
    const saved = sanitizeCatalogPayload(normalized as unknown as Record<string, unknown>);
    expect(saved.photos360Exterior).toEqual(exterior);
    expect(saved.photos360Interior).toEqual(interior);
    expect(saved.photos).toEqual(normal);
    expect(saved.photosHd).toEqual(big);
  });
});

describe("preserveAdminTaxiFlag", () => {
  it("keeps an admin taxi flag when the provider payload omits it", () => {
    const preserved = preserveAdminTaxiFlag({ make: "Kia" }, { isTaxi: true, make: "Kia" });
    expect(preserved.isTaxi).toBe(true);
  });

  it("does not override an incoming taxi flag", () => {
    const preserved = preserveAdminTaxiFlag({ isTaxi: false }, { isTaxi: true });
    expect(preserved.isTaxi).toBe(false);
  });
});

describe("dedupeCatalogImportRows", () => {
  it("keeps the last row per VIN", () => {
    const rows = dedupeCatalogImportRows([
      { vin: "WBA3V7106FJ995387", data: { odometer: 1000 } },
      { vin: "WBA3V7106FJ995387", data: { odometer: 2000 } },
      { vin: "1HGBH41JXMN109186", data: { odometer: 3000 } },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.vin === "WBA3V7106FJ995387")?.data.odometer).toBe(2000);
  });
});

describe("stampCatalogImportData", () => {
  it("preserves frozen krw rate on Korean payloads", () => {
    const stamped = stampCatalogImportData(
      { country: "kr", make: "Hyundai" },
      { existingRate: 1500, currentRate: 1600 },
    );
    expect(stamped.krwPerUsd).toBe(1500);
  });
});

describe("mergeCatalogData", () => {
  it("merges incoming scalars without wiping untouched fields", () => {
    const merged = mergeCatalogData(
      { make: "BMW", model: "3 Series", year: 2015, odometer: 80000 },
      { odometer: 85000, titleStatus: "clean" },
    );
    expect(merged.make).toBe("BMW");
    expect(merged.odometer).toBe(85000);
    expect(merged.titleStatus).toBe("clean");
  });

  it("replaces JSON arrays when provided", () => {
    const merged = mergeCatalogData(
      { registryHistory: [{ type: "old" }] },
      { registryHistory: [{ type: "inspection", date: "2024-01-01" }] },
    );
    expect(merged.registryHistory).toEqual([{ type: "inspection", date: "2024-01-01" }]);
  });

  it("clears JSON arrays when incoming is empty", () => {
    const merged = mergeCatalogData(
      { accidents: [{ severity: "minor" }] },
      { accidents: [] },
    );
    expect(merged.accidents).toEqual([]);
  });
});

describe("catalogDataFromCsvRow", () => {
  it("preserves false salvage/stolen flags", () => {
    const data = catalogDataFromCsvRow({
      vin: SAMPLE_VIN,
      make: "Ford", model: "F-150", year: 2019,
      trim: null, engine: null, transmission: null, fuelType: null, bodyType: null,
      color: null, country: null, odometer: null, ownerCount: null, accidentCount: null,
      hp: null, cylinders: null, titleStatus: null,
      isSalvage: false, isStolen: false, isTaxi: false, photos: [],
      provider: null,
    });
    expect(data.isSalvage).toBe(false);
    expect(data.isStolen).toBe(false);
  });
});

describe("CSV round-trip", () => {
  const fullData = {
    make: "BMW",
    model: "3 Series",
    year: 2015,
    trim: "328i",
    engine: "2.0L",
    transmission: "Automatic",
    fuelType: "Gasoline",
    bodyType: "Sedan",
    color: "Black",
    country: "KR",
    odometer: 92100,
    ownerCount: 2,
    accidentCount: 1,
    hp: 240,
    cylinders: 4,
    titleStatus: "clean",
    isSalvage: false,
    isStolen: false,
    isTaxi: false,
    photos: ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"],
    accidents: [{ severity: "minor", date: "2018-06-01" }],
    insuranceClaims: [{ amount: 1200, date: "2018-06-15" }],
    mileageHistory: [{ date: "2019-01-01", mileage: 50000 }],
    ownerHistory: [{ date: "2017-03-01", type: "private" }],
    auctionHistory: [{ date: "2020-05-01", finalPrice: 15000 }],
    registryHistory: [{ type: "inspection", date: "2021-02-01", source: "KOTSA" }],
    marketData: { estimatedValue: 14000, currency: "USD" },
  };

  const meta = {
    id: 42,
    vin: SAMPLE_VIN,
    providerName: "carstat",
    importedAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-06-01T12:00:00.000Z"),
  };

  it("exports and re-imports all catalog fields", () => {
    const cells = catalogDataToCsvCells(meta, fullData);
    const record: Record<string, unknown> = {
      id: cells[0],
      vin: SAMPLE_VIN,
      make: fullData.make,
      model: fullData.model,
      year: fullData.year,
      trim: fullData.trim,
      engine: fullData.engine,
      transmission: fullData.transmission,
      fuel_type: fullData.fuelType,
      body_type: fullData.bodyType,
      color: fullData.color,
      country: fullData.country,
      odometer_km: fullData.odometer,
      owner_count: fullData.ownerCount,
      accident_count: fullData.accidentCount,
      hp: fullData.hp,
      cylinders: fullData.cylinders,
      title_status: fullData.titleStatus,
      is_salvage: "0",
      is_stolen: "0",
      is_taxi: "0",
      photos: fullData.photos.join("|"),
      accidents_json: JSON.stringify(fullData.accidents),
      insurance_claims_json: JSON.stringify(fullData.insuranceClaims),
      mileage_history_json: JSON.stringify(fullData.mileageHistory),
      owner_history_json: JSON.stringify(fullData.ownerHistory),
      auction_history_json: JSON.stringify(fullData.auctionHistory),
      registry_history_json: JSON.stringify(fullData.registryHistory),
      market_data_json: JSON.stringify(fullData.marketData),
      provider: meta.providerName,
    };

    const parsed = catalogDataFromCsvRecord(record);
    expect(parsed?.vin).toBe(SAMPLE_VIN);
    expect(parsed?.titleStatus).toBe("clean");
    expect(parsed?.photos).toHaveLength(2);

    const data = catalogDataFromCsvRow(parsed!);
    expect(data.make).toBe("BMW");
    expect(data.registryHistory).toEqual(fullData.registryHistory);
    expect(data.marketData).toEqual(fullData.marketData);
    expect(data.insuranceClaims).toEqual(fullData.insuranceClaims);
  });
});

describe("buildCatalogJsonExportRecord", () => {
  it("includes full nested data for server migration", () => {
    const data = {
      make: "BMW",
      registryHistory: [{ type: "registration", date: "2015-01-01" }],
      photos: ["https://cdn.example.com/x.jpg"],
    };
    const exported = buildCatalogJsonExportRecord({
      id: 1,
      vin: SAMPLE_VIN,
      providerName: "carstat",
      importedAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-06-01T00:00:00.000Z"),
      data,
    });
    expect(exported.vin).toBe(SAMPLE_VIN);
    expect(exported.data).toEqual(data);
    expect(exported.make).toBe("BMW");

    const reimported = normalizeJsonImportRecord(exported as Parameters<typeof normalizeJsonImportRecord>[0]);
    expect(reimported?.data.registryHistory).toHaveLength(1);
    expect(reimported?.data.photos).toEqual(["https://cdn.example.com/x.jpg"]);
  });
});

describe("applyCatalogAdminPatch", () => {
  it("replaces mileage history and clears odometer when admin clears the field", () => {
    const existing = {
      make: "Kia",
      model: "Sportage",
      year: 2019,
      odometer: 88000,
      mileageHistory: [{ date: "2024-01-01", odometer: 88000 }],
    };
    const patched = applyCatalogAdminPatch(existing, {
      make: "Kia",
      model: "Sportage",
      year: 2019,
      odometer: null,
      mileageHistory: [{ date: "2026-06-01", odometer: 42000 }],
    });
    expect(patched.odometer).toBeUndefined();
    expect(patched.mileageHistory).toEqual([{ date: "2026-06-01", odometer: 42000 }]);
  });

  it("clears history arrays when admin removes all rows", () => {
    const existing = {
      make: "Kia",
      model: "Sportage",
      mileageHistory: [{ date: "2024-01-01", odometer: 88000 }],
      ownerHistory: [{ date: "2020-01-01", mileage: 10000 }],
    };
    const patched = applyCatalogAdminPatch(existing, {
      make: "Kia",
      model: "Sportage",
      mileageHistory: [],
      ownerHistory: [],
    });
    expect(patched.mileageHistory).toEqual([]);
    expect(patched.ownerHistory).toEqual([]);
  });
});
