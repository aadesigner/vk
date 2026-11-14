import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://localhost:5432/kmcheck_test";
});

import {
  __rememberVhrMarketSignalsForTests,
  buildForcedKoreanBuyList,
  forceKoreanInsuranceSelectedSource,
  hasKoreanMarketVhrSignal,
  isCarstatVhrPayload,
  isVhrSourceEligible,
  looksLikeKoreanMarketCountry,
  mergeForcedKoreanIntoSelection,
  parseVhrSourceCheck,
  pickAllAuctionArchives,
  pickBestAuctionArchive,
  selectVhrSourcesToBuy,
  VHR_KOREAN_INSURANCE_ID,
  VHR_NON_KR_CHECK_SOURCE_IDS,
  VHR_SKIP_SOURCE_IDS,
} from "./carstatVhrApi.js";
import {
  __resetKoreanInsuranceCheckQuotaForTests,
  getCachedKoreanInsuranceCheckQuota,
} from "./carstatVhrQuota.js";
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
  it("never includes Korean Insurance in non-KR peek source list", () => {
    expect(VHR_NON_KR_CHECK_SOURCE_IDS).toEqual([2, 3, 4, 5]);
    expect(VHR_NON_KR_CHECK_SOURCE_IDS.includes(VHR_KOREAN_INSURANCE_ID as never)).toBe(false);
  });

  it("detects Korean market country and free inspections signal (not only K* WMI)", () => {
    expect(looksLikeKoreanMarketCountry("South Korea")).toBe(true);
    expect(looksLikeKoreanMarketCountry("KR")).toBe(true);
    expect(looksLikeKoreanMarketCountry("Germany")).toBe(false);
    expect(hasKoreanMarketVhrSignal([src({ id: 4, name: "Vehicle Inspections", records: 1 })])).toBe(true);
    expect(hasKoreanMarketVhrSignal([src({ id: 2, records: 3 })])).toBe(false);
  });

  it("force-gate helpers stay sync/local (no peek slowdown surface)", () => {
    // Peek never calls shouldForce; these helpers must stay CPU/Map-only.
    expect(typeof looksLikeKoreanMarketCountry).toBe("function");
    expect(typeof hasKoreanMarketVhrSignal).toBe("function");
    expect(VHR_NON_KR_CHECK_SOURCE_IDS.includes(68 as never)).toBe(false);
  });

  it("forced KR buy list is 68 alone when no companions were cached", () => {
    expect(buildForcedKoreanBuyList("WDDHF0CB9EA796317").map((s) => s.sourceId)).toEqual([68]);
  });

  it("forced KR buy list pairs inspections (and archive) when peek cached them", () => {
    const vin = "WDDHF0CB9EA796318";
    __rememberVhrMarketSignalsForTests(vin, [
      src({ id: 2, name: "Archive Alpha", records: 2 }),
      src({ id: 4, name: "Vehicle Inspections", records: 1 }),
    ]);
    // Inspections alone are not selected by selectVhrSourcesToBuy — but force pairs them with 68.
    expect(selectVhrSourcesToBuy([
      src({ id: 4, name: "Vehicle Inspections", records: 1 }),
    ]).map((s) => s.sourceId)).toEqual([]);
    expect(buildForcedKoreanBuyList(vin).map((s) => s.sourceId)).toEqual([2, 68, 4]);
  });

  it("mergeForcedKoreanIntoSelection keeps archive and adds 68", () => {
    const merged = mergeForcedKoreanIntoSelection("WDDHF0CB9EA796317", [
      { sourceId: 2, sourceName: "Archive Alpha", priceUsd: 1, language: "en" },
    ]);
    expect(merged.map((s) => s.sourceId)).toEqual([2, 68]);
  });

  it("builds force-68 selection for unpaid KR checks", () => {
    expect(forceKoreanInsuranceSelectedSource()).toEqual(
      expect.objectContaining({ sourceId: 68, language: "en" }),
    );
  });

  it("treats client_check_quota_exhausted on 68 as no data and marks quota", () => {
    __resetKoreanInsuranceCheckQuotaForTests({
      remaining: 2,
      fetchedAt: Date.now(),
      exhausted: false,
      spentSinceRefill: 0,
    });
    const parsed = parseVhrSourceCheck({
      id: 68,
      name: "Korean Insurance History",
      status: "client_check_quota_exhausted",
      available_formats: ["json"],
      available_languages: ["en"],
    });
    expect(parsed?.hasData).toBe(false);
    expect(getCachedKoreanInsuranceCheckQuota().exhausted).toBe(true);
  });

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

  it("adds inspections together with korean insurance", () => {
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

  it("pairs inspections with vehicle history when both match (no KR required)", () => {
    const selected = selectVhrSourcesToBuy([
      src({ id: 4, name: "Vehicle Inspections", records: 2 }),
      src({ id: 5, name: "Vehicle History", records: 9 }),
    ]);
    expect(selected.map((s) => s.sourceId)).toEqual([5, 4]);
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
