import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://localhost:5432/kmcheck_test";
});

import {
  isCarstatVhrPayload,
  isVhrSourceEligible,
  parseVhrSourceCheck,
  pickAllAuctionArchives,
  pickBestAuctionArchive,
  selectVhrSourcesToBuy,
  VHR_KOREAN_INSURANCE_ID,
  VHR_SKIP_SOURCE_IDS,
} from "./carstatVhrApi.js";
import { redactCarstatVhrDataForClient } from "./carstatVhrReportSanitize.js";

function src(partial: {
  id: number;
  name?: string;
  price?: number;
  records?: number;
  hasData?: boolean;
  formats?: string[];
  langs?: string[];
  exists?: boolean;
}) {
  return parseVhrSourceCheck({
    id: partial.id,
    name: partial.name ?? `Source ${partial.id}`,
    price_usd: partial.price ?? 1,
    available_formats: partial.formats ?? ["html", "json"],
    available_languages: partial.langs ?? ["en", "ru"],
    preview: {
      has_data: partial.hasData ?? true,
      exists: partial.exists,
      records_count: partial.records ?? 1,
    },
  })!;
}

describe("carstatVhrApi selection", () => {
  it("always skips USA auctions (1), US dealer (6), Belarus listing (35), Belarus official (36)", () => {
    expect(VHR_SKIP_SOURCE_IDS.has(1)).toBe(true);
    expect(VHR_SKIP_SOURCE_IDS.has(6)).toBe(true);
    expect(VHR_SKIP_SOURCE_IDS.has(35)).toBe(true);
    expect(VHR_SKIP_SOURCE_IDS.has(36)).toBe(true);
    expect(isVhrSourceEligible(src({ id: 1, hasData: true, formats: ["json"], langs: ["en"] }))).toBe(false);
    expect(isVhrSourceEligible(src({ id: 6, hasData: true, formats: ["json"], langs: ["en"] }))).toBe(false);
    expect(isVhrSourceEligible(src({ id: 35, hasData: true }))).toBe(false);
    expect(
      isVhrSourceEligible(src({ id: 36, hasData: true, formats: ["json"], langs: ["en"] })),
    ).toBe(false);
    // Name belt-and-suspenders if Carstat renumbers
    expect(
      isVhrSourceEligible(
        src({ id: 999, name: "USA Insurance Auctions & Korea History", hasData: true, formats: ["json"], langs: ["en"] }),
      ),
    ).toBe(false);
    expect(
      isVhrSourceEligible(
        src({ id: 998, name: "Belarus Listing History", hasData: true, formats: ["json"], langs: ["en"] }),
      ),
    ).toBe(false);
  });

  it("requires json + data; english preferred; KR 68 may be ru-only", () => {
    expect(isVhrSourceEligible(src({ id: 2, formats: ["pdf"], hasData: true }))).toBe(false);
    expect(isVhrSourceEligible(src({ id: 2, formats: ["html"], hasData: true }))).toBe(false);
    expect(isVhrSourceEligible(src({ id: 2, hasData: false, records: 0 }))).toBe(false);
    expect(isVhrSourceEligible(src({ id: 2, hasData: true, formats: ["json"], langs: ["en"] }))).toBe(true);
    // ru-only (Belarus Official style) must not be purchased
    expect(isVhrSourceEligible(src({ id: 36, hasData: true, formats: ["html", "json"], langs: ["ru"] }))).toBe(false);
    // Korean Insurance demo VIN style — ru-only is eligible (we translate).
    expect(
      isVhrSourceEligible(
        src({ id: VHR_KOREAN_INSURANCE_ID, hasData: true, formats: ["json", "html"], langs: ["ru"] }),
      ),
    ).toBe(true);
    // Archives stay English-required
    expect(isVhrSourceEligible(src({ id: 2, hasData: true, formats: ["json"], langs: ["ru"] }))).toBe(false);
  });

  it("selects Korean Insurance ru-only with language=ru", () => {
    const selected = selectVhrSourcesToBuy([
      src({
        id: VHR_KOREAN_INSURANCE_ID,
        name: "Korean Insurance History",
        formats: ["json", "html", "pdf"],
        langs: ["ru"],
      }),
      src({ id: 5, records: 9 }),
    ]);
    expect(selected).toEqual([
      expect.objectContaining({ sourceId: 68, language: "ru" }),
    ]);
  });

  it("lists archive sources Alpha+Beta only and ranks Alpha first", () => {
    const pool = [
      src({ id: 3, records: 5, price: 2 }),
      src({ id: 1, records: 5, price: 2 }),
      src({ id: 2, records: 8, price: 3 }),
    ];
    expect(pickAllAuctionArchives(pool).map((s) => s.id)).toEqual([2, 3]);
    expect(pickBestAuctionArchive(pool)?.id).toBe(2);
  });

  it("buys Alpha only (not Beta) + korean insurance; never USA auctions or dealer", () => {
    const selected = selectVhrSourcesToBuy([
      src({ id: 1, name: "USA Insurance Auctions", records: 3 }),
      src({ id: 2, name: "Archive Alpha", records: 5 }),
      src({ id: 3, name: "Archive Beta", records: 2 }),
      src({ id: VHR_KOREAN_INSURANCE_ID, name: "Korean Insurance History", records: 2 }),
      src({ id: 5, name: "Vehicle History", records: 10 }),
      src({ id: 6, name: "US Dealer Listings", records: 99 }),
    ]);
    expect(selected.map((s) => s.sourceId)).toEqual([2, 68]);
  });

  it("does not buy USA auctions or dealer when only those + Alpha available", () => {
    const selected = selectVhrSourcesToBuy([
      src({ id: 1, name: "USA Insurance Auctions", records: 2 }),
      src({ id: 2, records: 2 }),
      src({ id: 6, name: "US Dealer Listings", records: 1 }),
    ]);
    expect(selected.map((s) => s.sourceId)).toEqual([2]);
  });

  it("skips inspections when korean insurance is missing (Alpha alone, not Beta)", () => {
    const selected = selectVhrSourcesToBuy([
      src({ id: 2, records: 2 }),
      src({ id: 3, records: 4 }),
      src({ id: 4, name: "Vehicle Inspections", records: 1 }),
      src({ id: 5, records: 9 }),
    ]);
    expect(selected.map((s) => s.sourceId)).toEqual([2]);
  });

  it("falls back to Beta when Alpha missing", () => {
    const selected = selectVhrSourcesToBuy([
      src({ id: 1, records: 2 }),
      src({ id: 3, records: 4 }),
      src({ id: 5, records: 9 }),
    ]);
    expect(selected.map((s) => s.sourceId)).toEqual([3]);
  });

  it("returns empty when only USA auctions is present", () => {
    expect(selectVhrSourcesToBuy([src({ id: 1, name: "USA Insurance Auctions" })])).toEqual([]);
  });

  it("adds inspections only together with korean insurance", () => {
    const selected = selectVhrSourcesToBuy([
      src({ id: 2, records: 3 }),
      src({ id: 4, name: "Vehicle Inspections", records: 8 }),
      src({ id: 68, name: "Korean Insurance History", records: 2 }),
    ]);
    expect(selected.map((s) => s.sourceId)).toEqual([2, 68, 4]);
  });

  it("buys korean alone or with inspections when auction missing", () => {
    const withInspection = selectVhrSourcesToBuy([
      src({ id: 68, name: "Korean Insurance History" }),
      src({ id: 4, name: "Vehicle Inspections" }),
      src({ id: 5, records: 9 }),
    ]);
    expect(withInspection.map((s) => s.sourceId)).toEqual([68, 4]);

    const koreanOnly = selectVhrSourcesToBuy([
      src({ id: 68, name: "Korean Insurance History" }),
      src({ id: 5, records: 9 }),
    ]);
    expect(koreanOnly.map((s) => s.sourceId)).toEqual([68]);
  });

  it("never buys inspections alone — falls back to vehicle history", () => {
    const selected = selectVhrSourcesToBuy([
      src({ id: 4, name: "Vehicle Inspections", records: 2 }),
      src({ id: 5, records: 9 }),
    ]);
    expect(selected.map((s) => s.sourceId)).toEqual([5]);
  });

  it("returns empty when only inspections is eligible", () => {
    expect(
      selectVhrSourcesToBuy([src({ id: 4, name: "Vehicle Inspections", records: 2 })]).map((s) => s.sourceId),
    ).toEqual([]);
  });

  it("falls back to vehicle history (5) and skips dealer + Belarus official", () => {
    const selected = selectVhrSourcesToBuy([
      src({ id: 5, name: "Vehicle History", records: 1 }),
      src({ id: 36, name: "Belarus Official History", records: 1, langs: ["en"] }),
      src({ id: 6, name: "US Dealer Listings", records: 50 }),
    ]);
    expect(selected.map((s) => s.sourceId)).toEqual([5]);
  });

  it("returns empty when only skipped sources are present", () => {
    expect(selectVhrSourcesToBuy([src({ id: 35 })])).toEqual([]);
    expect(selectVhrSourcesToBuy([src({ id: 1 }), src({ id: 6 }), src({ id: 35 }), src({ id: 36 })])).toEqual([]);
  });
});

describe("carstatVhr payload helpers", () => {
  it("detects deliverable VHR payloads", () => {
    expect(
      isCarstatVhrPayload({
        dataSource: "carstat_vhr",
        vhrReports: [{ sourceId: 1, htmlUrl: "https://v-h-r.b-cdn.net/x.html" }],
      }),
    ).toBe(true);
    expect(
      isCarstatVhrPayload({
        dataSource: "carstat_vhr",
        vhrReports: [{ sourceId: 1, htmlUrl: "" }],
      }),
    ).toBe(false);
    expect(isCarstatVhrPayload({ dataSource: "carstat_usa" })).toBe(false);
  });

  it("redacts CDN URLs, cost IDs, and provider product names for clients", () => {
    const out = redactCarstatVhrDataForClient({
      dataSource: "carstat_vhr",
      vhrReports: [
        {
          sourceId: 2,
          sourceName: "Archive Alpha",
          htmlUrl: "https://v-h-r.b-cdn.net/a.html",
          jsonUrl: "https://v-h-r.b-cdn.net/a.json",
          fetchedAt: "2026-01-01T00:00:00.000Z",
          chargedUsd: 1.5,
          reportId: "r1",
          requestId: "q1",
        },
      ],
    });
    const list = out.vhrReports as Array<Record<string, unknown>>;
    expect(list[0]?.htmlUrl).toBeNull();
    expect(list[0]?.jsonUrl).toBeNull();
    expect(list[0]?.hasHtml).toBe(true);
    expect(list[0]?.sourceId).toBe(2);
    expect(list[0]?.sourceName).toBe("Listing archive");
    expect(list[0]?.chargedUsd).toBeUndefined();
    expect(list[0]?.reportId).toBeUndefined();
    expect(list[0]?.requestId).toBeUndefined();
  });
});
