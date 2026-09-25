import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRICING,
  normalizeCatalogPrice,
  normalizePricingAmounts,
  roundCurrencyAmount,
} from "./pricingDefaults";

describe("pricingDefaults", () => {
  it("truncates to two decimals without rounding up to the next euro", () => {
    expect(roundCurrencyAmount(19.99)).toBe(19.99);
    expect(roundCurrencyAmount(19.999)).toBe(19.99);
    expect(normalizeCatalogPrice(19.99, "sale")).toBe(19.99);
    expect(normalizeCatalogPrice(12.5, "sale")).toBe(12.5);
  });

  it("migrates legacy sale prices to the current catalog sale amount", () => {
    expect(normalizeCatalogPrice(15.99, "sale")).toBe(19.99);
    expect(normalizeCatalogPrice(14.99, "sale")).toBe(19.99);
    expect(normalizeCatalogPrice(14.9, "sale")).toBe(19.99);
    expect(normalizeCatalogPrice(15, "sale")).toBe(19.99);
    expect(normalizeCatalogPrice(15.9, "sale")).toBe(19.99);
    expect(normalizeCatalogPrice(29.9, "list")).toBe(29.99);
  });

  it("normalizes pricing rows to catalog amounts", () => {
    expect(
      normalizePricingAmounts({
        basePrice: 29.99,
        discountPrice: 15.99,
      }),
    ).toEqual({
      basePrice: DEFAULT_PRICING.basePrice,
      discountPrice: DEFAULT_PRICING.discountPrice,
    });
  });
});
