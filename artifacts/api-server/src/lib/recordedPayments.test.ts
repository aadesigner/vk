import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {},
  paymentsTable: {},
  vinLookupsTable: {},
}));

import {
  isCollectedRevenueStatus,
  isPaymentUsableForLookup,
  sumCollectedRevenue,
} from "./recordedPayments.js";

describe("isPaymentUsableForLookup", () => {
  const userId = "user-1";

  it("accepts completed payments for the same user", () => {
    expect(isPaymentUsableForLookup({ status: "completed", amount: 9.99, userId }, userId)).toBe(true);
  });

  it("accepts pending free-coupon reservations before fulfillment", () => {
    expect(isPaymentUsableForLookup({ status: "pending", amount: 0, userId }, userId)).toBe(true);
  });

  it("rejects pending paid PayPal orders", () => {
    expect(isPaymentUsableForLookup({ status: "pending", amount: 9.99, userId }, userId)).toBe(false);
  });

  it("rejects another user's payment", () => {
    expect(isPaymentUsableForLookup({ status: "completed", amount: 9.99, userId: "other" }, userId)).toBe(false);
  });
});

describe("collected revenue after pending credit/remove", () => {
  it("treats revoked like completed for revenue (no deduct)", () => {
    expect(isCollectedRevenueStatus("completed")).toBe(true);
    expect(isCollectedRevenueStatus("revoked")).toBe(true);
    expect(isCollectedRevenueStatus("refunded")).toBe(false);
    expect(isCollectedRevenueStatus("failed")).toBe(false);
  });

  it("does not count refunded toward collected revenue", () => {
    expect(isCollectedRevenueStatus("refunded")).toBe(false);
    expect(sumCollectedRevenue([
      { status: "completed", kind: "vin_report", rev: 10 },
      { status: "refunded", kind: "vin_report", rev: 10 },
    ])).toBe(10);
  });

  it("excludes credit_redemption from collected revenue totals", () => {
    expect(sumCollectedRevenue([
      { status: "completed", kind: "credit_pack", rev: 41.97 },
      { status: "completed", kind: "credit_redemption", rev: 13.99 },
    ])).toBe(41.97);
  });
});
