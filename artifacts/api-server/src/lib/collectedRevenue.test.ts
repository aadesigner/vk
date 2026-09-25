import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {},
  paymentsTable: {},
  vinLookupsTable: {},
}));

import {
  countsAsCollectedRevenue,
  sumCollectedRevenue,
} from "./recordedPayments.js";

describe("collected revenue payment kinds", () => {
  it("includes completed credit_pack and vin_report sales", () => {
    expect(countsAsCollectedRevenue({ status: "completed", kind: "credit_pack" })).toBe(true);
    expect(countsAsCollectedRevenue({ status: "completed", kind: "vin_report" })).toBe(true);
    expect(countsAsCollectedRevenue({ status: "revoked", kind: "credit_pack" })).toBe(true);
  });

  it("excludes credit_redemption from revenue even when completed", () => {
    expect(countsAsCollectedRevenue({ status: "completed", kind: "credit_redemption" })).toBe(false);
  });

  it("sums pack revenue but not credit spend rows", () => {
    expect(sumCollectedRevenue([
      { status: "completed", kind: "credit_pack", rev: 41.97 },
      { status: "completed", kind: "credit_redemption", rev: 0 },
      { status: "completed", kind: "vin_report", rev: 13.99 },
    ])).toBeCloseTo(55.96, 2);
  });
});
