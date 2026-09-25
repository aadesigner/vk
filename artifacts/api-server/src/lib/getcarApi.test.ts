import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://localhost:5432/verifykm_test";
});

import {
  normalizeGetCarApiResponse,
  mapGetCarApiCountry,
  checkGetCarApiExists,
  GETCARAPI_DATA_SOURCE,
} from "./getcarApi.js";

describe("mapGetCarApiCountry", () => {
  it("maps public slugs to short codes", () => {
    expect(mapGetCarApiCountry("south_korea")).toBe("kr");
    expect(mapGetCarApiCountry("United States")).toBe("us");
    expect(mapGetCarApiCountry("canada")).toBe("ca");
  });
});

describe("checkGetCarApiExists", () => {
  const prevKey = process.env.GETCARAPI_API_KEY;

  beforeEach(async () => {
    process.env.GETCARAPI_API_KEY = "vdi_test";
    process.env.GETCARAPI_BASE_URL = "https://getcarapi.com";
    const { setGetCarApiEnabledCache } = await import("./getcarApiSettingsCache.js");
    setGetCarApiEnabledCache(true);
  });

  afterEach(() => {
    if (prevKey === undefined) delete process.env.GETCARAPI_API_KEY;
    else process.env.GETCARAPI_API_KEY = prevKey;
    vi.unstubAllGlobals();
  });

  it("reads nested data.exists from docs-shaped 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: { vin: "WDDUX8GB8JA397509", exists: true, country: "south_korea" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const result = await checkGetCarApiExists("WDDUX8GB8JA397509");
    expect(result).toEqual({ status: "exists", country: "kr" });
  });

  it("treats 404 as not_found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ success: false, data: { exists: false, country: null } }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    await expect(checkGetCarApiExists("AAAAAAAAAAAAAAAAA")).resolves.toEqual({ status: "not_found" });
  });
});

describe("normalizeGetCarApiResponse", () => {
  it("maps real GetCarAPI field names (mileageKm, priceAmount, soldDate, eventType)", () => {
    const normalized = normalizeGetCarApiResponse({
      vin: "WDDUX8GB8JA397509",
      country: "south_korea",
      vehicle: {
        make: "Mercedes-Benz",
        model: "E-Class",
        year: 2018,
        currentKnownMileageKm: 129048,
      },
      mileageHistory: [
        { date: "2022-04-12", mileageKm: 65396, kind: "other" },
      ],
      observations: [
        { observedAt: "2026-08-29T12:00:00.000Z", mileageKm: 129048 },
      ],
      listings: [
        { priceAmount: 45951, priceCurrency: "USD", priceUsd: 45951, location: "Seoul, Korea" },
      ],
      auctionSales: [
        { soldDate: "2025-03-16", amount: 45951, priceUsd: 45951, currency: "USD" },
      ],
      accidents: [
        {
          date: "2023-12-22",
          type: "accident",
          category: "insurance",
          description: "insurance_own_damage",
          insuranceBenefitUsd: 848.23,
          currency: "USD",
        },
      ],
      ownerChanges: [
        { date: "2024-11-14", info: "Trader transfer", mileageKm: 118670 },
      ],
      events: [
        {
          eventType: "mileage",
          description: "Listing odometer — 129,048 km",
          occurredAt: "2026-08-29T12:00:00.000Z",
          metadata: { kind: "mileage_listing", mileageKm: 129048 },
        },
        {
          eventType: "other",
          description: "Car inspection completed",
          occurredAt: "2026-04-01T00:00:00.000Z",
          metadata: {
            type: "inspection",
            title: "Car inspection completed",
            details: [{ label: "Inspection date", value: "April 1, 2026" }],
          },
        },
        {
          eventType: "other",
          description: "Safety recall campaign",
          occurredAt: "2021-01-01T00:00:00.000Z",
          metadata: { type: "recall", title: "Safety recall campaign" },
        },
      ],
      photos: [{ url: "https://cdn.example.com/a.jpg" }],
      salvage: null,
    });

    expect(normalized.dataSource).toBe(GETCARAPI_DATA_SOURCE);
    expect(normalized.country).toBe("kr");
    expect(normalized.odometer).toBe(129048);
    expect(normalized.mileageHistory?.some((m) => m.odometer === 65396 && m.date === "2022-04-12")).toBe(true);
    expect(normalized.mileageHistory?.some((m) => m.odometer === 129048)).toBe(true);
    expect(normalized.marketData?.estimatedValue).toBe(45951);
    expect(normalized.auctionHistory?.[0]?.finalPrice).toBe(45951);
    expect(normalized.auctionHistory?.[0]?.date).toBe("2025-03-16");
    expect(normalized.accidents?.[0]?.description).toMatch(/Insurance/i);
    expect(normalized.accidents?.[0]?.lossAmount).toBe(848.23);
    expect(normalized.ownerHistory?.[0]?.mileage).toBe(118670);
    // Mileage / inspections / recalls stay out of Events list
    expect((normalized.registryHistory ?? []).every((e) => e.type !== "mileage")).toBe(true);
    expect((normalized.registryHistory ?? []).some((e) => e.type === "inspection")).toBe(false);
    expect(normalized.serviceHistory?.some((e) => /inspection/i.test(e.title ?? ""))).toBe(true);
    expect(
      normalized.serviceHistory?.some(
        (e) => (e.details?.length ?? 0) > 0 && /inspection/i.test(e.title ?? ""),
      ),
    ).toBe(true);
    expect(normalized.recallHistory?.some((e) => e.type === "recall")).toBe(true);
    expect(normalized.accidentCount).toBe(1);
    expect(normalized.isFlooded).toBe(false);
    expect(normalized.photos).toEqual(["https://cdn.example.com/a.jpg"]);
  });

  it("routes ownership and claims out of Events into their sections", () => {
    const normalized = normalizeGetCarApiResponse({
      vehicle: { make: "Honda", model: "Civic", year: 2019, country: "canada" },
      accidents: [],
      ownerChanges: [],
      events: [
        {
          eventType: "other",
          description: "Ownership transfer recorded",
          occurredAt: "2023-06-01T00:00:00.000Z",
          metadata: { type: "ownership", title: "Ownership transfer recorded", location: "Ontario" },
        },
        {
          eventType: "insurance",
          description: "Insurance claim paid",
          occurredAt: "2022-03-15T00:00:00.000Z",
          metadata: { type: "claim", amount: 1200, title: "Insurance claim paid" },
        },
        {
          eventType: "other",
          description: "Emission test passed",
          occurredAt: "2024-01-10T00:00:00.000Z",
          metadata: { type: "emissions", title: "Emission test passed" },
        },
      ],
      photos: [],
    });
    expect(normalized.ownerHistory?.some((o) => o.location === "Ontario")).toBe(true);
    expect(normalized.insuranceClaims?.some((c) => /Insurance claim/i.test(c.description ?? ""))).toBe(true);
    expect(normalized.registryHistory?.some((e) => /Emission/i.test(e.title ?? ""))).toBe(true);
    expect(normalized.registryHistory?.some((e) => /Ownership/i.test(e.title ?? ""))).toBeFalsy();
    expect(normalized.registryHistory?.some((e) => /Insurance claim/i.test(e.title ?? ""))).toBeFalsy();
    expect(normalized.accidentCount).toBe(0);
    expect(normalized.isFlooded).toBe(false);
  });

  it("infers Canada from listing location when country missing", () => {
    const normalized = normalizeGetCarApiResponse({
      vehicle: { make: "Toyota", model: "Prius", year: 2025 },
      listings: [{ location: "Cobourg, Ontario, Canada", priceAmount: 44944, priceCurrency: "CAD", priceUsd: 32156 }],
      events: [],
      accidents: [],
      photos: [],
    });
    expect(normalized.country).toBe("ca");
    expect(normalized.marketData?.estimatedValue).toBe(32156);
  });

  it("splits First registration delivery into title + detail row", () => {
    const normalized = normalizeGetCarApiResponse({
      vehicle: { make: "Mercedes", model: "S-Class", year: 2014, country: "south_korea" },
      events: [
        {
          eventType: "delivery",
          description: "First registration: 2014",
          occurredAt: "2014-01-01T00:00:00.000Z",
        },
        {
          eventType: "other",
          description: "Maintenance/repair history",
          occurredAt: "2020-02-27T00:00:00.000Z",
          metadata: {
            type: "other",
            title: "Maintenance/repair history",
            details: [
              { label: "Completion date", value: "February 27, 2020" },
              { label: "mileage", value: "29,464km" },
            ],
          },
        },
      ],
      accidents: [],
      photos: [],
    });
    const firstReg = normalized.registryHistory?.find((e) => e.type === "first_registration");
    expect(firstReg?.title).toBe("First registration");
    expect(firstReg?.date).toMatch(/^2014/);
    expect(firstReg?.details?.some((d) => /first registration/i.test(d.label))).toBe(true);
    expect(normalized.serviceHistory?.some((e) => e.title === "Maintenance/repair history")).toBe(true);
    expect(normalized.registryHistory?.some((e) => e.title === "Maintenance/repair history")).toBeFalsy();
  });

  it("keeps KRW insuranceBenefit when currency is KRW (not USD twin)", () => {
    const normalized = normalizeGetCarApiResponse({
      vehicle: { make: "Mercedes", model: "E-Class", year: 2018, country: "south_korea" },
      accidents: [
        {
          date: "2023-11-23",
          type: "accident",
          category: "Damage to this vehicle",
          description: "Insurance accident on 2023-11-23— repair ₩941,000, payout ₩521,630",
          repairTotal: 941000,
          insuranceBenefit: 521630,
          currency: "KRW",
          repairTotalUsd: 678.5,
          insuranceBenefitUsd: 376.0,
        },
      ],
      events: [],
      photos: [],
    });
    expect(normalized.accidents?.[0]?.lossAmount).toBe(521630);
    expect(normalized.accidents?.[0]?.currency).toBe("KRW");
  });

  it("maps Extra tab into vehicleExtras, never Events", () => {
    const normalized = normalizeGetCarApiResponse({
      vehicle: { make: "Chevrolet", model: "Tahoe", year: 2023 },
      extra: [
        { key: "doors", label: "Doors", value: "4-Door", observedAt: "2026-09-19" },
        { key: "stock_number", label: "Stock number", value: "Pr474053 - #65", observedAt: "2026-09-19" },
      ],
      events: [],
      accidents: [],
      photos: [],
    });
    expect(normalized.vehicleExtras).toEqual([
      expect.objectContaining({ label: "Doors", value: "4-Door", observedAt: "2026-09-19" }),
      expect.objectContaining({ label: "Stock number", value: "Pr474053 - #65" }),
    ]);
    expect(normalized.registryHistory).toBeUndefined();
  });

  it("splits license plate and diagnosis colon titles into expandable details", () => {
    const normalized = normalizeGetCarApiResponse({
      vehicle: { make: "Hyundai", model: "Sonata", year: 2018, country: "south_korea" },
      events: [
        {
          eventType: "other",
          description: "License plate: 12가3456",
          occurredAt: "2019-03-01T00:00:00.000Z",
        },
        {
          eventType: "other",
          description: "Diagnosis: Pass",
          occurredAt: "2021-06-15T00:00:00.000Z",
        },
        {
          eventType: "other",
          description: "Korean performance inspection",
          occurredAt: "2022-08-20T00:00:00.000Z",
        },
      ],
      accidents: [],
      photos: [],
    });
    const plate = normalized.registryHistory?.find((e) => e.title === "License plate");
    expect(plate?.details?.[0]).toEqual({ label: "License plate", value: "12가3456" });
    const diagnosis = normalized.registryHistory?.find((e) => e.title === "Diagnosis");
    expect(diagnosis?.details?.[0]).toEqual({ label: "Diagnosis", value: "Pass" });
    // "inspection" in the title routes to service history, not Events
    expect(normalized.serviceHistory?.some((e) => /performance inspection/i.test(e.title ?? ""))).toBe(true);
  });

  it("keeps inspection detail rows on service history cards", () => {
    const normalized = normalizeGetCarApiResponse({
      vehicle: { make: "BMW", model: "X5", year: 2018, country: "south_korea" },
      events: [
        {
          eventType: "other",
          description: "Car inspection completed",
          occurredAt: "2024-06-11T00:00:00.000Z",
          metadata: {
            type: "inspection",
            title: "Car inspection completed",
            details: [
              { label: "Inspection date", value: "June 11, 2024" },
              { label: "Inspection category", value: "Regular inspection" },
              { label: "Driving distance during inspection", value: "116,200km" },
              { label: "Inspection station", value: "Seongnam Center" },
            ],
          },
        },
        {
          eventType: "inspection",
          description: "odometer 118686 km(listing)",
          occurredAt: "2025-03-16T00:00:00.000Z",
        },
      ],
      accidents: [],
      photos: [],
    });
    const rich = normalized.serviceHistory?.find((e) =>
      e.details?.some((d) => /Inspection station/i.test(d.label)),
    );
    expect(rich?.title).toMatch(/inspection/i);
    expect(rich?.mileage).toBe(116200);
    expect(rich?.location).toBe("Seongnam Center");
    expect(rich?.details?.length).toBe(4);

    const listingProbe = normalized.serviceHistory?.find(
      (e) => e.date === "2025-03-16" || e.mileage === 118686,
    );
    expect(listingProbe?.title).toBe("Car inspection completed");
    expect(listingProbe?.mileage).toBe(118686);
  });

  it("merges photosOld source URLs as alternates when CDN is primary", () => {
    const normalized = normalizeGetCarApiResponse({
      vehicle: { make: "Chevrolet", model: "Tahoe", year: 2023 },
      photosNew: [
        { id: 1, url: "https://imgsv.getcarapi.com/p/cdn1.jpg", provider: "cloudflare" },
        { id: 2, url: "https://imgsv.getcarapi.com/p/cdn2.jpg", provider: "cloudflare" },
      ],
      photosOld: [
        { id: 1, url: "https://dealer.example.com/a.jpg" },
        { id: 2, url: "https://dealer.example.com/b.jpg" },
        { id: 3, url: "https://dealer.example.com/c.jpg" },
      ],
      photos: [
        { id: 1, url: "https://imgsv.getcarapi.com/p/cdn1.jpg", sourceUrl: "https://dealer.example.com/a.jpg" },
      ],
      events: [],
      accidents: [],
    });
    expect(normalized.photos?.length).toBeGreaterThanOrEqual(3);
    expect(normalized.photos?.[0]).toContain("imgsv.getcarapi.com");
    expect(normalized.photoAlternates?.[0]).toContain("dealer.example.com");
    expect(normalized.photos?.some((u) => u.includes("dealer.example.com/c.jpg"))).toBe(true);
  });
});
