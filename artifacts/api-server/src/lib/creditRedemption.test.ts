import { describe, expect, it } from "vitest";
import { isCreditPackId, getCreditPack } from "./creditPacks.js";

describe("creditPacks", () => {
  it("accepts pack3 and pack5 only", () => {
    expect(isCreditPackId("pack3")).toBe(true);
    expect(isCreditPackId("pack5")).toBe(true);
    expect(isCreditPackId("pack1")).toBe(false);
    expect(isCreditPackId(null)).toBe(false);
  });

  it("has expected totals", () => {
    expect(getCreditPack("pack3")).toMatchObject({ credits: 3, totalPrice: 50.97, unitPrice: 16.99 });
    expect(getCreditPack("pack5")).toMatchObject({ credits: 5, totalPrice: 64.95, unitPrice: 12.99 });
  });
});
