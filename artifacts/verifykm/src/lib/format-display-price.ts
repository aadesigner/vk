import { DEFAULT_PRICING } from "@/lib/pricing-defaults";

/** Truncate to two decimals — stable display and PayPal amounts. */
export function roundCurrencyAmount(amount: number): number {
  return Math.trunc(amount * 100 + 1e-8) / 100;
}

/** Snap legacy / float drift to canonical catalog prices (€19.99 sale / €29.99 list). */
export function normalizeCatalogPrice(amount: number, kind: "list" | "sale"): number {
  const canonical = kind === "list" ? DEFAULT_PRICING.basePrice : DEFAULT_PRICING.discountPrice;
  const truncated = roundCurrencyAmount(amount);
  if (Math.abs(truncated - canonical) < 0.011) return canonical;
  const legacyAmounts =
    kind === "list" ? [29.9, 30] : [19.9, 15.99, 15.9, 14.99, 14.9, 15, 9.9];
  for (const legacy of legacyAmounts) {
    if (Math.abs(truncated - legacy) < 0.011) return canonical;
  }
  return truncated;
}

/** Customer-facing price label — always two decimals (e.g. €19.99, €29.99). */
export function formatDisplayPrice(amount: number, currencySymbol: string): string {
  const rounded = roundCurrencyAmount(amount);
  return `${currencySymbol}${rounded.toFixed(2)}`;
}
