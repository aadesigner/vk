import { describe, expect, it, beforeEach, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://localhost:5432/kmcheck_test";
});

import {
  __resetKoreanInsuranceCheckQuotaForTests,
  canIncludeKoreanInsuranceInCheck,
  isForceKoreanInsuranceVin,
  parseKoreanInsuranceRemaining,
  recordKoreanInsuranceCheckSpent,
  recordKoreanInsuranceReportPaid,
  markKoreanInsuranceCheckQuotaExhausted,
  getCachedKoreanInsuranceCheckQuota,
  KR_CHECK_SPARE,
} from "./carstatVhrQuota.js";

describe("carstatVhrQuota", () => {
  beforeEach(() => {
    __resetKoreanInsuranceCheckQuotaForTests();
  });

  it("parses remaining from several check-quotas shapes", () => {
    expect(parseKoreanInsuranceRemaining({ remaining: 7 })).toBe(7);
    expect(parseKoreanInsuranceRemaining({ korean_insurance_remaining: 3 })).toBe(3);
    // Live Carstat GET /api/vhr/check-quotas
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
    expect(
      parseKoreanInsuranceRemaining({
        quotas: [{ id: 68, name: "Korean Insurance History", remaining: 9 }],
      }),
    ).toBe(9);
    expect(
      parseKoreanInsuranceRemaining({
        sources: [{ source_id: 2, remaining: 99 }, { sourceId: 68, checks_remaining: 4 }],
      }),
    ).toBe(4);
    expect(parseKoreanInsuranceRemaining({ quotas: { "68": { remaining: 2 } } })).toBe(2);
    expect(parseKoreanInsuranceRemaining({})).toBeNull();
  });

  it("blocks KR checks when remaining ≤ 2 (force threshold)", () => {
    expect(KR_CHECK_SPARE).toBe(2);
    __resetKoreanInsuranceCheckQuotaForTests({
      remaining: 2,
      fetchedAt: Date.now(),
      exhausted: false,
      spentSinceRefill: 0,
    });
    expect(canIncludeKoreanInsuranceInCheck()).toBe(false);

    __resetKoreanInsuranceCheckQuotaForTests({
      remaining: 1,
      fetchedAt: Date.now(),
      exhausted: false,
      spentSinceRefill: 0,
    });
    expect(canIncludeKoreanInsuranceInCheck()).toBe(false);

    __resetKoreanInsuranceCheckQuotaForTests({
      remaining: 3,
      fetchedAt: Date.now(),
      exhausted: false,
      spentSinceRefill: 0,
    });
    expect(canIncludeKoreanInsuranceInCheck()).toBe(true);
  });

  it("tracks spend and refill", () => {
    __resetKoreanInsuranceCheckQuotaForTests({
      remaining: 5,
      fetchedAt: Date.now(),
      exhausted: false,
      spentSinceRefill: 0,
    });
    recordKoreanInsuranceCheckSpent();
    expect(getCachedKoreanInsuranceCheckQuota().remaining).toBe(4);
    expect(getCachedKoreanInsuranceCheckQuota().spentSinceRefill).toBe(1);

    recordKoreanInsuranceReportPaid();
    const after = getCachedKoreanInsuranceCheckQuota();
    expect(after.remaining).toBe(14);
    expect(after.spentSinceRefill).toBe(0);
    expect(after.exhausted).toBe(false);
  });

  it("marks exhausted", () => {
    markKoreanInsuranceCheckQuotaExhausted("client_check_quota_exhausted");
    const q = getCachedKoreanInsuranceCheckQuota();
    expect(q.remaining).toBe(0);
    expect(q.exhausted).toBe(true);
    expect(canIncludeKoreanInsuranceInCheck()).toBe(false);
  });

  it("detects Korean WMI for force buy", () => {
    expect(isForceKoreanInsuranceVin("KNAF241BEMA915413")).toBe(true);
    expect(isForceKoreanInsuranceVin("WDDHF0CB9EA796317")).toBe(false);
  });
});
