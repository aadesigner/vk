import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://localhost:5432/verifykm_test";
});

import { sortAnalyticsChannels, parseAnalyticsPeriod, type AnalyticsChannelRow } from "./adminAnalytics.js";

describe("adminAnalytics helpers", () => {
  it("parses known periods and defaults to week", () => {
    expect(parseAnalyticsPeriod("today")).toBe("today");
    expect(parseAnalyticsPeriod("lastMonth")).toBe("lastMonth");
    expect(parseAnalyticsPeriod("nope")).toBe("week");
    expect(parseAnalyticsPeriod(undefined)).toBe("week");
  });

  it("sorts channels by revenue with Other last", () => {
    const rows: AnalyticsChannelRow[] = [
      { channel: "unknown", signups: 50, buyers: 10, revenue: 200, checks: 12, conversionPct: 20 },
      { channel: "direct", signups: 5, buyers: 2, revenue: 30, checks: 3, conversionPct: 40 },
      { channel: "meta_ads", signups: 20, buyers: 8, revenue: 150, checks: 10, conversionPct: 40 },
    ];
    const sorted = sortAnalyticsChannels(rows);
    expect(sorted.map((r) => r.channel)).toEqual(["meta_ads", "direct", "unknown"]);
  });
});
