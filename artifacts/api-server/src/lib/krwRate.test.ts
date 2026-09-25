import { describe, it, expect, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://localhost:5432/verifykm_test";
});

import {
  applyFrozenKrwPerUsd,
  readFrozenKrwPerUsd,
  isKoreanReportData,
  DEFAULT_KRW_PER_USD,
} from "./krwRate.js";

describe("krwRate", () => {
  it("detects Korean reports", () => {
    expect(isKoreanReportData({ country: "kr" })).toBe(true);
    expect(isKoreanReportData({ country: "us" })).toBe(false);
  });

  it("stamps current rate on new Korean reports", () => {
    const out = applyFrozenKrwPerUsd({ country: "kr", make: "Kia" }, { currentRate: 1600 });
    expect(out.krwPerUsd).toBe(1600);
  });

  it("preserves an existing frozen rate on updates", () => {
    const incoming = { country: "kr", make: "Kia", accidents: [{ id: 1 }] };
    const out = applyFrozenKrwPerUsd(incoming, { existingRate: 1500, currentRate: 1800 });
    expect(out.krwPerUsd).toBe(1500);
  });

  it("ignores non-Korean reports", () => {
    const data = { country: "us", make: "Ford" };
    expect(applyFrozenKrwPerUsd(data, { currentRate: 1600 })).toBe(data);
  });

  it("reads frozen rate from report data", () => {
    expect(readFrozenKrwPerUsd({ krwPerUsd: 1537 })).toBe(1537);
    expect(readFrozenKrwPerUsd({ krwPerUsd: 0 })).toBeNull();
    expect(readFrozenKrwPerUsd(null)).toBeNull();
  });

  it("falls back to default when current rate is invalid", () => {
    const out = applyFrozenKrwPerUsd({ country: "kr" }, { currentRate: 0 });
    expect(out.krwPerUsd).toBe(DEFAULT_KRW_PER_USD);
  });
});
