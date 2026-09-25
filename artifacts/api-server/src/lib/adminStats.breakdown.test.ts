import { describe, expect, it } from "vitest";
import {
  buildPaymentsByMethodPeriods,
  buildSignupsByCountryPeriods,
  buildCountryCountPeriods,
  buildSalesAttributionPeriods,
  buildSignupsByChannelPeriods,
} from "./adminStats.js";

describe("dashboard period breakdowns", () => {
  const now = new Date("2026-08-08T15:00:00.000Z");

  it("buckets country signups into today / week / quarter", () => {
    const maps = buildSignupsByCountryPeriods(
      [
        { date: "2026-08-08", country_code: "AL", count: 5 },
        { date: "2026-08-08", country_code: "DE", count: 2 },
        { date: "2026-08-07", country_code: "AL", count: 1 },
        { date: "2026-07-01", country_code: "US", count: 9 },
      ],
      now,
    );
    expect(maps.today).toEqual([
      { countryCode: "AL", count: 5 },
      { countryCode: "DE", count: 2 },
    ]);
    expect(maps.yesterday).toEqual([{ countryCode: "AL", count: 1 }]);
    expect(maps.week.find((r) => r.countryCode === "AL")?.count).toBe(6);
    expect(maps.lastMonth).toEqual([{ countryCode: "US", count: 9 }]);
    expect(maps.quarter.find((r) => r.countryCode === "US")?.count).toBe(9);
  });

  it("buckets purchases by country for last month", () => {
    const maps = buildCountryCountPeriods(
      [
        { date: "2026-07-15", country_code: "AL", count: 4 },
        { date: "2026-07-20", country_code: "DE", count: 2 },
        { date: "2026-08-01", country_code: "AL", count: 1 },
      ],
      now,
    );
    expect(maps.lastMonth).toEqual([
      { countryCode: "AL", count: 4 },
      { countryCode: "DE", count: 2 },
    ]);
    expect(maps.month).toEqual([{ countryCode: "AL", count: 1 }]);
  });

  it("buckets payment methods with revenue", () => {
    const maps = buildPaymentsByMethodPeriods(
      [
        { date: "2026-08-08", method: "pok", count: 2, revenue: 30 },
        { date: "2026-08-08", method: "paypal", count: 1, revenue: 15 },
        { date: "2026-08-05", method: "credit", count: 3, revenue: 0 },
      ],
      now,
    );
    expect(maps.today).toEqual([
      { method: "paypal", count: 1, revenue: 15 },
      { method: "pok", count: 2, revenue: 30 },
    ]);
    expect(maps.week.some((r) => r.method === "credit" && r.count === 3)).toBe(true);
  });

  it("attributes sales/signups with null/empty channel as unknown", () => {
    const sales = buildSalesAttributionPeriods(
      [
        { date: "2026-08-08", channel: null, count: 2, revenue: 30 },
        { date: "2026-08-08", channel: "", count: 1, revenue: 15 },
        { date: "2026-08-08", channel: "meta_ads", count: 1, revenue: 16 },
        { date: "2026-08-07", channel: "unknown", count: 3, revenue: 45 },
      ],
      now,
    );
    // null + empty + explicit unknown roll into channel "unknown"
    const todayUnknown = sales.salesByChannel.today.find((r) => r.channel === "unknown");
    expect(todayUnknown?.count).toBe(3);
    expect(todayUnknown?.revenue).toBe(45);
    expect(sales.salesByChannel.today.find((r) => r.channel === "meta_ads")?.revenue).toBe(16);
    expect(sales.salesBySource.today.find((r) => r.bucket === "unknown")?.count).toBe(3);
    expect(sales.salesBySource.today.find((r) => r.bucket === "paid_ads")?.count).toBe(1);

    const signups = buildSignupsByChannelPeriods(
      [
        { date: "2026-08-08", channel: null, count: 5 },
        { date: "2026-08-08", channel: "direct", count: 2 },
        { date: "2026-08-08", channel: "  ", count: 1 },
      ],
      now,
    );
    expect(signups.today.find((r) => r.channel === "unknown")?.count).toBe(6);
    expect(signups.today.find((r) => r.channel === "direct")?.count).toBe(2);
  });

  it("uses Monday–Sunday weeks and calendar year", () => {
    // 2026-08-08 is Saturday → week starts Monday 2026-08-03
    const maps = buildSignupsByCountryPeriods(
      [
        { date: "2026-08-03", country_code: "AL", count: 2 },
        { date: "2026-08-02", country_code: "DE", count: 4 }, // Sunday before this Monday — last week
        { date: "2026-01-15", country_code: "US", count: 3 },
      ],
      now,
    );
    expect(maps.week.find((r) => r.countryCode === "AL")?.count).toBe(2);
    expect(maps.week.find((r) => r.countryCode === "DE")).toBeUndefined();
    expect(maps.year.find((r) => r.countryCode === "US")?.count).toBe(3);
    expect(maps.year.find((r) => r.countryCode === "AL")?.count).toBe(2);
  });
});
