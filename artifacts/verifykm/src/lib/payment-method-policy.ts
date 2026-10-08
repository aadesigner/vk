import { normalizeUserCountryCode } from "./user-countries";

/** Profile countries that must not see PayPal (card only) in checkout UI. */
export const PAYPAL_HIDDEN_COUNTRY_CODES = new Set([
  "DE",
  "AT",
  "IT",
  "GR",
  "FR",
  "MK",
]);

/**
 * UI-only: hide PayPal when UI language is German, or profile country is
 * DE / AT / IT / GR / FR / MK. Does not change server payment routes.
 */
export function isPaypalHiddenForCheckout(opts: {
  language: string | null | undefined;
  countryCode: string | null | undefined;
}): boolean {
  const lang = (opts.language ?? "").trim().toLowerCase().split("-")[0] ?? "";
  if (lang === "de") return true;
  const country = normalizeUserCountryCode(opts.countryCode);
  return country != null && PAYPAL_HIDDEN_COUNTRY_CODES.has(country);
}
