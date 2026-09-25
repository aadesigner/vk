import { useGetCurrentPricing, type PricingConfig } from "@workspace/api-client-react";
import { STATIC_QUERY_OPTIONS, orvalQuery } from "@/lib/query-options";
import { DEFAULT_PRICING } from "@/lib/pricing-defaults";
import { formatDisplayPrice, normalizeCatalogPrice } from "@/lib/format-display-price";

export interface DisplayPriceResult {
  displayPrice: number | null;
  basePrice: number | null;
  isDiscount: boolean;
  loading: boolean;
  currencySymbol: string;
  currency: string;
  fmtPrice: (amount: number) => string;
}

export function useDisplayPrice(): DisplayPriceResult {
  const { data: pricing, isLoading } = useGetCurrentPricing({
    query: orvalQuery<PricingConfig>(STATIC_QUERY_OPTIONS),
  });

  // Match server: always show catalog defaults when `/api/payments/current-pricing` is slow or unreachable.
  const active = pricing ?? DEFAULT_PRICING;

  const currency = active.currency ?? DEFAULT_PRICING.currency;
  const currencySymbol =
    currency === "EUR" ? "€"
    : currency === "USD" ? "$"
    : currency;

  const fmtPrice = (amount: number): string => formatDisplayPrice(amount, currencySymbol);

  const isDiscount = active.discountEnabled;
  const displayPrice = normalizeCatalogPrice(
    isDiscount ? active.discountPrice : active.basePrice,
    isDiscount ? "sale" : "list",
  );
  const basePrice = normalizeCatalogPrice(active.basePrice, "list");

  return {
    displayPrice,
    basePrice,
    isDiscount,
    loading: isLoading && pricing == null,
    currencySymbol,
    currency,
    fmtPrice,
  };
}
