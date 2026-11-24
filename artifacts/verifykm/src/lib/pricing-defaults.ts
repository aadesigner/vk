/** Mirrors server defaults — used for loading fallbacks before `/api/payments/current-pricing` responds. */
export const DEFAULT_PRICING = {
  basePrice: 29.99,
  discountPrice: 17.99,
  currency: "EUR" as const,
  discountEnabled: true,
};
