/** Default VIN report pricing when no row exists in `pricing` table. */
export const DEFAULT_PRICING = {
  basePrice: 29.99,
  discountPrice: 19.99,
  currency: "EUR" as const,
  discountEnabled: true,
};

export const CATALOG_LIST_PRICE = DEFAULT_PRICING.basePrice;
export const CATALOG_SALE_PRICE = DEFAULT_PRICING.discountPrice;

/** Truncate to two decimals — stable PayPal/display amounts without float drift. */
export function roundCurrencyAmount(amount: number): number {
  return Math.trunc(amount * 100 + 1e-8) / 100;
}

/** Snap legacy / float drift to canonical catalog prices (€19.99 sale / €29.99 list). */
export function normalizeCatalogPrice(amount: number, kind: "list" | "sale"): number {
  const canonical = kind === "list" ? CATALOG_LIST_PRICE : CATALOG_SALE_PRICE;
  const truncated = roundCurrencyAmount(amount);
  if (Math.abs(truncated - canonical) < 0.011) return canonical;
  const legacyAmounts =
    kind === "list" ? [29.9, 30] : [19.9, 15.99, 15.9, 14.99, 14.9, 15, 9.9];
  for (const legacy of legacyAmounts) {
    if (Math.abs(truncated - legacy) < 0.011) return canonical;
  }
  return truncated;
}

export function normalizePricingAmounts<T extends { basePrice: number; discountPrice: number }>(row: T): T {
  return {
    ...row,
    basePrice: normalizeCatalogPrice(row.basePrice, "list"),
    discountPrice: normalizeCatalogPrice(row.discountPrice, "sale"),
  };
}
