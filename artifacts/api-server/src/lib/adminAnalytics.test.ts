import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://localhost:5432/kmcheck_test";
});

import {
  sortAnalyticsChannels,
  parseAnalyticsPeriod,
  enrichChannelRows,
  finalizeNamedRows,
  finalizeReferrers,
  mergeCampaigns,
  deriveAnalyticsSummaryExtras,
  normalizeReferrerHost,
  ANALYTICS_BUCKET_ORDER,
  type AnalyticsChannelRow,
} from "./adminAnalytics.js";

function channel(partial: Partial<AnalyticsChannelRow> & Pick<AnalyticsChannelRow, "channel">): AnalyticsChannelRow {
  return {
    signups: 0,
    buyers: 0,
    revenue: 0,
    checks: 0,
    conversionPct: null,
    signupSharePct: 0,
    revenueSharePct: 0,
    revenuePerSignup: 0,
    ...partial,
  };
}

describe("adminAnalytics helpers", () => {
  it("parses known periods and defaults to week", () => {
    expect(parseAnalyticsPeriod("today")).toBe("today");
    expect(parseAnalyticsPeriod("lastMonth")).toBe("lastMonth");
    expect(parseAnalyticsPeriod("nope")).toBe("week");
    expect(parseAnalyticsPeriod(undefined)).toBe("week");
  });

  it("sorts channels by revenue with Other last", () => {
    const rows: AnalyticsChannelRow[] = [
      channel({ channel: "unknown", signups: 50, buyers: 10, revenue: 200, checks: 12, conversionPct: 20 }),
      channel({ channel: "direct", signups: 5, buyers: 2, revenue: 30, checks: 3, conversionPct: 40 }),
      channel({ channel: "meta_ads", signups: 20, buyers: 8, revenue: 150, checks: 10, conversionPct: 40 }),
    ];
    const sorted = sortAnalyticsChannels(rows);
    expect(sorted.map((r) => r.channel)).toEqual(["meta_ads", "direct", "unknown"]);
  });

  it("enriches channel share and revenue-per-signup", () => {
    const rows = enrichChannelRows([
      { channel: "meta_ads", signups: 20, buyers: 8, revenue: 160, checks: 10, conversionPct: 40 },
      { channel: "direct", signups: 5, buyers: 1, revenue: 40, checks: 2, conversionPct: 20 },
    ]);
    expect(rows[0].signupSharePct).toBe(80);
    expect(rows[1].signupSharePct).toBe(20);
    expect(rows[0].revenueSharePct).toBe(80);
    expect(rows[0].revenuePerSignup).toBe(8);
    expect(rows[1].revenuePerSignup).toBe(8);
  });

  it("rolls up named dimensions with unknown last and canonical bucket order", () => {
    const sources = finalizeNamedRows(
      [
        { key: "unknown", signups: 40, buyers: 2, revenue: 20 },
        { key: "facebook", signups: 10, buyers: 4, revenue: 80 },
        { key: "FACEBOOK", signups: 5, buyers: 1, revenue: 20 },
        { key: "google", signups: 8, buyers: 2, revenue: 30 },
      ],
      { limit: 10 },
    );
    expect(sources.map((r) => r.key)).toEqual(["facebook", "google", "unknown"]);
    expect(sources[0].signups).toBe(15);
    expect(sources[0].conversionPct).toBe(33.3);

    const buckets = finalizeNamedRows(
      [
        { key: "direct", signups: 3, buyers: 0, revenue: 0 },
        { key: "paid_ads", signups: 9, buyers: 3, revenue: 90 },
        { key: "google", signups: 4, buyers: 1, revenue: 10 },
      ],
      { order: ANALYTICS_BUCKET_ORDER },
    );
    expect(buckets.map((r) => r.key)).toEqual(["paid_ads", "google", "direct"]);
  });

  it("merges campaigns including signup-only (zero revenue) rows", () => {
    const rows = mergeCampaigns(
      [
        { campaign: "spring_sale", signups: 12 },
        { campaign: "brand_awareness", signups: 7 },
      ],
      [
        { campaign: "spring_sale", buyers: 3, revenue: 48 },
      ],
    );
    expect(rows.map((r) => r.campaign)).toEqual(["spring_sale", "brand_awareness"]);
    expect(rows[0].conversionPct).toBe(25);
    expect(rows[1].revenue).toBe(0);
    expect(rows[1].signups).toBe(7);
  });

  it("normalizes referrer hosts and ranks them", () => {
    expect(normalizeReferrerHost("https://www.facebook.com/l.php")).toBe("facebook.com");
    expect(normalizeReferrerHost("direct")).toBe("");
    const refs = finalizeReferrers(
      [
        { referrer: "https://www.google.com/", signups: 4 },
        { referrer: "google.com", signups: 2 },
        { referrer: "t.co", signups: 3 },
        { referrer: "", signups: 9 },
      ],
      18,
    );
    expect(refs.map((r) => r.referrer)).toEqual(["google.com", "t.co"]);
    expect(refs[0].signups).toBe(6);
    expect(refs[0].signupSharePct).toBe(33.3);
  });

  it("derives efficiency and attribution coverage from the period summary", () => {
    const extras = deriveAnalyticsSummaryExtras({
      revenue: 200,
      checks: 40,
      signups: 20,
      payingUsers: 5,
      clickIdSignups: 8,
      channels: [
        { channel: "meta_ads", signups: 12 },
        { channel: "unknown", signups: 8 },
      ],
    });
    expect(extras.signupToBuyerPct).toBe(25);
    expect(extras.revenuePerSignup).toBe(10);
    expect(extras.checksPerSignup).toBe(2);
    expect(extras.attributedPct).toBe(60);
    expect(extras.clickIdPct).toBe(40);
  });
});
