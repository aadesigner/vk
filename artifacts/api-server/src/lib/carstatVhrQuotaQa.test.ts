/**
 * QA coverage for Korean Insurance check-quota + force-companion behavior.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://localhost:5432/kmcheck_test";
});

import {
  __rememberVhrMarketSignalsForTests,
  buildForcedKoreanBuyList,
  hasKoreanMarketVhrSignal,
  looksLikeKoreanMarketCountry,
  parseVhrSourceCheck,
  selectVhrSourcesToBuy,
  VHR_KOREAN_INSURANCE_ID,
  VHR_NON_KR_CHECK_SOURCE_IDS,
} from "./carstatVhrApi.js";
import {
  __resetKoreanInsuranceCheckQuotaForTests,
  canIncludeKoreanInsuranceInCheck,
  isForceKoreanInsuranceVin,
  parseKoreanInsuranceRemaining,
  recordKoreanInsuranceCheckSpent,
  recordKoreanInsuranceReportPaid,
  getCachedKoreanInsuranceCheckQuota,
  KR_CHECK_SPARE,
} from "./carstatVhrQuota.js";

function src(partial: {
  id: number;
  name?: string;
  records?: number;
  hasData?: boolean;
  formats?: string[];
  langs?: string[];
}) {
  return parseVhrSourceCheck({
    id: partial.id,
    name: partial.name ?? `Source ${partial.id}`,
    price_usd: 1,
    available_formats: partial.formats ?? ["html", "json"],
    available_languages: partial.langs ?? ["en", "ru"],
    preview: {
      has_data: partial.hasData ?? true,
      records_count: partial.records ?? 1,
    },
  })!;
}

describe("QA: KR check quota meter", () => {
  beforeEach(() => {
    __resetKoreanInsuranceCheckQuotaForTests();
  });

  it("parses live Carstat check-quotas remaining_checks", () => {
    expect(
      parseKoreanInsuranceRemaining({
        sources: [{
          source_id: 68,
          name: "Korean Insurance History",
          initial_checks: 10,
          checks_per_purchase: 10,
          remaining_checks: 5,
        }],
      }),
    ).toBe(5);
  });

  it("blocks KR-including checks at spare floor", () => {
    __resetKoreanInsuranceCheckQuotaForTests({
      remaining: KR_CHECK_SPARE,
      fetchedAt: Date.now(),
      exhausted: false,
      spentSinceRefill: 0,
    });
    expect(canIncludeKoreanInsuranceInCheck()).toBe(false);
  });

  it("refills local counter after paid KR report", () => {
    __resetKoreanInsuranceCheckQuotaForTests({
      remaining: 3,
      fetchedAt: Date.now(),
      exhausted: false,
      spentSinceRefill: 2,
    });
    recordKoreanInsuranceCheckSpent();
    expect(getCachedKoreanInsuranceCheckQuota().remaining).toBe(2);
    recordKoreanInsuranceReportPaid();
    expect(getCachedKoreanInsuranceCheckQuota().remaining).toBe(12);
    expect(getCachedKoreanInsuranceCheckQuota().spentSinceRefill).toBe(0);
  });
});

describe("QA: peek never asks source 68", () => {
  it("non-KR peek source list excludes 68", () => {
    expect(VHR_NON_KR_CHECK_SOURCE_IDS).toEqual([2, 3, 4, 5]);
    expect(VHR_NON_KR_CHECK_SOURCE_IDS.includes(VHR_KOREAN_INSURANCE_ID as never)).toBe(false);
  });
});

describe("QA: force-68 Korean-market signals", () => {
  it("K* WMI forces; German WMI alone does not", () => {
    expect(isForceKoreanInsuranceVin("KNAF241BEMA915413")).toBe(true);
    expect(isForceKoreanInsuranceVin("WDDHF0CB9EA796317")).toBe(false);
  });

  it("Korea country / inspections are market signals", () => {
    expect(looksLikeKoreanMarketCountry("South Korea")).toBe(true);
    expect(looksLikeKoreanMarketCountry("Germany")).toBe(false);
    expect(hasKoreanMarketVhrSignal([src({ id: 4, name: "Vehicle Inspections" })])).toBe(true);
  });

  it("force buy list pairs cached inspections (and archive) with 68", () => {
    const vin = "WDDHF0CB9EA796399";
    __rememberVhrMarketSignalsForTests(vin, [
      src({ id: 2, name: "Archive Alpha" }),
      src({ id: 4, name: "Vehicle Inspections" }),
    ]);
    expect(buildForcedKoreanBuyList(vin).map((s) => s.sourceId)).toEqual([2, 68, 4]);
  });

  it("force buy list pairs inspections with 68 only (not Vehicle History — either/or partner)", () => {
    const vin = "WDDHF0CB9EA796400";
    __rememberVhrMarketSignalsForTests(vin, [
      src({ id: 5, name: "Vehicle History" }),
      src({ id: 4, name: "Vehicle Inspections" }),
    ]);
    // 5+4 without force is selectVhrSourcesToBuy; force path uses 68 as partner, not 5.
    expect(buildForcedKoreanBuyList(vin).map((s) => s.sourceId)).toEqual([68, 4]);
  });
});

describe("QA: cache RAM bounds", () => {
  it("market-signal cache stays capped under many unique VINs", () => {
    for (let i = 0; i < 1200; i += 1) {
      const vin = `WDDHF0CB9EA7${String(900000 + i).slice(-6)}`;
      __rememberVhrMarketSignalsForTests(vin, [
        src({ id: 4, name: "Vehicle Inspections" }),
      ]);
    }
    // Cap is 800 — building a list for an old VIN may miss, newest should hit.
    const newest = "WDDHF0CB9EA7" + String(900000 + 1199).slice(-6);
    expect(buildForcedKoreanBuyList(newest).map((s) => s.sourceId)).toEqual([68, 4]);
  });
});

describe("QA: inspections pairing rules", () => {
  it("inspections + KR → buy both", () => {
    expect(
      selectVhrSourcesToBuy([
        src({ id: 68, name: "Korean Insurance History" }),
        src({ id: 4, name: "Vehicle Inspections" }),
      ]).map((s) => s.sourceId),
    ).toEqual([68, 4]);
  });

  it("inspections + vehicle history → buy both (no KR)", () => {
    expect(
      selectVhrSourcesToBuy([
        src({ id: 5, name: "Vehicle History" }),
        src({ id: 4, name: "Vehicle Inspections" }),
      ]).map((s) => s.sourceId),
    ).toEqual([5, 4]);
  });

  it("inspections alone → buy nothing", () => {
    expect(
      selectVhrSourcesToBuy([src({ id: 4, name: "Vehicle Inspections" })]).map((s) => s.sourceId),
    ).toEqual([]);
  });

  it("archive wins over history; KR still brings inspections", () => {
    expect(
      selectVhrSourcesToBuy([
        src({ id: 2, name: "Archive Alpha" }),
        src({ id: 5, name: "Vehicle History" }),
        src({ id: 4, name: "Vehicle Inspections" }),
        src({ id: 68, name: "Korean Insurance History" }),
      ]).map((s) => s.sourceId),
    ).toEqual([2, 68, 4]);
  });
});
