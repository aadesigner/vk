import { describe, expect, it } from "vitest";
import {
  normalizeDailyCounts,
  normalizeDailyRevenue,
  normalizeDayKey,
  normalizeRecentPayments,
  sliceSeriesFrom,
  sumDailyCounts,
  sumDailyRevenue,
  trendPct,
  utcDateIsoDaysAgo,
  utcMonthStartIso,
  utcPrevMonthStartIso,
} from "./adminStats.js";

describe("normalizeDayKey", () => {
  it("extracts ISO date from timestamps", () => {
    expect(normalizeDayKey("2026-07-10T14:22:00.000Z")).toBe("2026-07-10");
    expect(normalizeDayKey(new Date("2026-07-10T14:22:00.000Z"))).toBe("2026-07-10");
  });
});

describe("series sums", () => {
  const counts = [
    { date: "2026-07-08", count: 2 },
    { date: "2026-07-09", count: 3 },
    { date: "2026-07-10", count: 5 },
  ];

  it("sums inclusive window", () => {
    expect(sumDailyCounts(counts, "2026-07-09")).toBe(8);
    expect(sumDailyCounts(counts, "2026-07-09", "2026-07-10")).toBe(3);
  });

  it("sums revenue window", () => {
    const revenue = [
      { date: "2026-07-09", revenue: 10 },
      { date: "2026-07-10", revenue: 20 },
    ];
    expect(sumDailyRevenue(revenue, "2026-07-09")).toBe(30);
  });
});

describe("normalizeRecentPayments", () => {
  it("coerces numeric amount", () => {
    const [row] = normalizeRecentPayments([{
      id: "1",
      user_id: "u1",
      vin: "VIN",
      amount: "19.9",
      currency: "EUR",
      status: "completed",
      created_at: "2026-07-10",
      email: null,
      name: null,
    }]);
    expect(row.amount).toBe(19.9);
  });
});

describe("normalizeDailyCounts", () => {
  it("normalizes rows", () => {
    expect(normalizeDailyCounts([{ date: "2026-07-10T00:00:00.000Z", count: "4" }])).toEqual([
      { date: "2026-07-10", count: 4 },
    ]);
  });
});

describe("trendPct", () => {
  it("handles zero baseline", () => {
    expect(trendPct(0, 0)).toBeNull();
    expect(trendPct(5, 0)).toBe(100);
  });
});

describe("utc helpers", () => {
  it("builds month boundaries", () => {
    const now = new Date("2026-07-10T12:00:00.000Z");
    expect(utcMonthStartIso(now)).toBe("2026-07-01");
    expect(utcPrevMonthStartIso(now)).toBe("2026-06-01");
    expect(utcDateIsoDaysAgo(6, now)).toBe("2026-07-04");
  });
});

describe("sliceSeriesFrom", () => {
  it("filters by date", () => {
    const rows = [{ date: "2026-07-01" }, { date: "2026-07-15" }];
    expect(sliceSeriesFrom(rows, "2026-07-10")).toEqual([{ date: "2026-07-15" }]);
  });
});

describe("normalizeDailyRevenue", () => {
  it("coerces revenue", () => {
    expect(normalizeDailyRevenue([{ date: "2026-07-10", revenue: "12.5" }])).toEqual([
      { date: "2026-07-10", revenue: 12.5 },
    ]);
  });
});
