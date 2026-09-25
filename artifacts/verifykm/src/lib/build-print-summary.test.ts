import { describe, it, expect, vi } from "vitest";
import { buildAuctionPrintRows } from "./build-print-summary";

const t = (key: string) => key;

describe("buildAuctionPrintRows", () => {
  it("formats auction entries with location and price", () => {
    const rows = buildAuctionPrintRows([
      {
        date: "2023-05-10",
        city: "Dallas",
        state: "TX",
        country: "USA",
        finalPrice: 12500,
        primaryDamage: "front end",
      },
    ], t, "en", 2020);

    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("auction_record_n #1");
    expect(rows[0].detail).toContain("Dallas");
    expect(rows[0].detail).toContain("$12,500");
  });

  it("respects PRINT_AUCTION_LIMIT", () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({ date: `2020-01-${String(i + 1).padStart(2, "0")}` }));
    const rows = buildAuctionPrintRows(entries, t, "en");
    expect(rows.length).toBeLessThanOrEqual(6);
  });
});
