import { resolveCountryIso2 } from "./format-country-name";

/** Default KRW per 1 USD when admin rate is unset (USD/KRW ~1,415 as of Aug 2026) */
export const DEFAULT_KRW_PER_USD = 1415;
/** Admin amount currencies only — no CAD/GBP/etc. */
export type AmountCurrencyCode = "KRW" | "USD" | "EUR";

/** ISO / region codes treated as Europe → default EUR for admin amounts. */
const EUROPE_COUNTRY_CODES = new Set([
  "al", "ad", "at", "ba", "be", "bg", "by", "ch", "cy", "cz", "de", "dk", "ee",
  "es", "fi", "fr", "gb", "gr", "hr", "hu", "ie", "is", "it", "li", "lt", "lu",
  "lv", "mc", "md", "me", "mk", "mt", "nl", "no", "pl", "pt", "ro", "rs", "se",
  "si", "sk", "sm", "ua", "va", "xk",
]);

function countryIsoLower(country?: string | null): string | null {
  const iso = resolveCountryIso2(country);
  if (iso) return iso.toLowerCase();
  const c = country?.toLowerCase().trim();
  return c || null;
}

export function isKoreanCountry(country?: string | null): boolean {
  return countryIsoLower(country) === "kr";
}

export function isUsdDefaultCountry(country?: string | null): boolean {
  const c = countryIsoLower(country);
  return c === "us" || c === "ca";
}

export function isEuropeanCountry(country?: string | null): boolean {
  const c = countryIsoLower(country);
  if (!c) return false;
  if (c === "kr" || c === "us" || c === "ca") return false;
  return EUROPE_COUNTRY_CODES.has(c);
}

/** Encar/KOTSA insurance payouts and registry repair costs are stored as KRW. */
export function isKoreanSourcedAccidentType(type?: string | null): boolean {
  const normalized = type?.toLowerCase();
  return normalized === "insurance"
    || normalized === "registry"
    || normalized === "inspection"
    || normalized === "flood";
}

/** Normalize admin/provider currency tags to KRW / USD / EUR when recognizable. */
export function normalizeAmountCurrency(value: unknown): AmountCurrencyCode | null {
  if (typeof value !== "string") return null;
  const n = value.trim().toUpperCase().replace(/\s+/g, "");
  if (!n) return null;
  if (n === "KRW" || n === "WON" || n === "₩" || n === "KR") return "KRW";
  if (n === "USD" || n === "US$" || n === "$" || n === "DOLLAR" || n === "DOLLARS") return "USD";
  if (n === "EUR" || n === "EURO" || n === "EUROS" || n === "€") return "EUR";
  return null;
}

/** Default amount currency from vehicle country: KR→KRW, US/CA→USD, Europe→EUR, else USD. */
export function defaultAmountCurrencyForCountry(country?: string | null): AmountCurrencyCode {
  if (isKoreanCountry(country)) return "KRW";
  if (isEuropeanCountry(country)) return "EUR";
  return "USD";
}

export function reportUsesKrwAmounts(input?: {
  country?: string | null;
  insuranceClaims?: unknown[] | null;
}): boolean {
  if (isKoreanCountry(input?.country)) return true;
  return Array.isArray(input?.insuranceClaims) && input.insuranceClaims.length > 0;
}

/**
 * When to treat a loss amount as KRW for display.
 * Explicit row `currency` wins; otherwise fall back to country / Korean-sourced type heuristics
 * (provider rows without currency keep working).
 */
export function shouldFormatAccidentLossAsKrw(input: {
  currency?: string | null;
  vehicleCountry?: string | null;
  accidentType?: string | null;
  accidentCountry?: string | null;
  hasKoreanInsuranceClaims?: boolean;
}): boolean {
  return resolveAmountDisplayCurrency(input) === "KRW";
}

/** Resolve display currency for an amount row (explicit tag → heuristics). */
export function resolveAmountDisplayCurrency(input: {
  currency?: string | null;
  vehicleCountry?: string | null;
  accidentType?: string | null;
  accidentCountry?: string | null;
  hasKoreanInsuranceClaims?: boolean;
}): AmountCurrencyCode {
  const explicit = normalizeAmountCurrency(input.currency);
  if (explicit) return explicit;

  if (reportUsesKrwAmounts({
    country: input.vehicleCountry,
    insuranceClaims: input.hasKoreanInsuranceClaims ? [{}] : null,
  })) {
    return "KRW";
  }
  if (isKoreanCountry(input.accidentCountry)) return "KRW";
  if (isKoreanSourcedAccidentType(input.accidentType)) return "KRW";
  if (isEuropeanCountry(input.vehicleCountry) || isEuropeanCountry(input.accidentCountry)) {
    return "EUR";
  }
  return "USD";
}

export function formatAmountPlain(amount: number, currency: AmountCurrencyCode): string {
  const n = Math.round(amount);
  if (currency === "KRW") return `₩${n.toLocaleString()}`;
  if (currency === "EUR") return `€${n.toLocaleString()}`;
  return `$${n.toLocaleString()}`;
}

export function convertKrwToUsd(krw: number, krwPerUsd: number): number {
  if (!Number.isFinite(krw) || !Number.isFinite(krwPerUsd) || krwPerUsd <= 0) return 0;
  return krw / krwPerUsd;
}

export function convertUsdToKrw(usd: number, krwPerUsd: number): number {
  if (!Number.isFinite(usd) || !Number.isFinite(krwPerUsd) || krwPerUsd <= 0) return 0;
  return Math.round(usd * krwPerUsd);
}

export function formatUsdAmount(usd: number): string {
  const rounded = Math.round(usd);
  return `$${rounded.toLocaleString()}`;
}

/** Live admin preview string for an amount + currency. */
export function formatAdminAmountPreview(
  amountRaw: string,
  currency: string,
  krwPerUsd: number,
  vehicleCountry?: string | null,
): string | null {
  const n = Number(String(amountRaw).trim().replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  const code = normalizeAmountCurrency(currency) ?? "USD";
  const rate = resolveKrwPerUsd(krwPerUsd);
  // KRW amounts always preview as won + USD (Korean currency display).
  if (code === "KRW") {
    return `Users see ₩… · ≈ ${formatUsdAmount(convertKrwToUsd(n, rate))} USD`;
  }
  if (code === "EUR") {
    return `Users see €${Math.round(n).toLocaleString()}`;
  }
  // USD: only show won conversion for Korean vehicles — never for US/CA/etc.
  if (isKoreanCountry(vehicleCountry)) {
    return `Users see $${Math.round(n).toLocaleString()} · ≈ ₩${convertUsdToKrw(n, rate).toLocaleString()}`;
  }
  return `Users see $${Math.round(n).toLocaleString()}`;
}

/** Parse KRW from provider strings: "2,566,720 won", "136.6 million won", "₩7060220" */
export function parseKrwFromText(text: string | null | undefined): number | null {
  if (!text) return null;
  const trimmed = text.trim();

  const million = trimmed.match(/([\d.,]+)\s*million\s+won/i);
  if (million) {
    const n = parseFloat(million[1]!.replace(/,/g, ""));
    return Number.isFinite(n) ? Math.round(n * 1_000_000) : null;
  }

  const wonSuffix = trimmed.match(/([\d,]+)\s*won/i);
  if (wonSuffix) {
    const n = parseInt(wonSuffix[1]!.replace(/,/g, ""), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  const wonPrefix = trimmed.match(/₩\s*([\d,]+)/);
  if (wonPrefix) {
    const n = parseInt(wonPrefix[1]!.replace(/,/g, ""), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  return null;
}

/** USD primary with original won in parentheses — plain text for print */
export function formatKoreanWonPlain(krw: number, krwPerUsd: number): string {
  const rate = krwPerUsd > 0 ? krwPerUsd : DEFAULT_KRW_PER_USD;
  const usd = convertKrwToUsd(krw, rate);
  return `${formatUsdAmount(usd)} (₩${Math.round(krw).toLocaleString()})`;
}

/** @deprecated use formatKoreanWonPlain */
export const formatKoreanInsuranceAmount = formatKoreanWonPlain;

export function formatKoreanWonFromText(
  text: string,
  krwPerUsd?: number | null,
): string | null {
  const krw = parseKrwFromText(text);
  if (krw == null) return null;
  return formatKoreanWonPlain(krw, resolveKrwPerUsd(krwPerUsd));
}

export function resolveKrwPerUsd(rate: number | null | undefined): number {
  return typeof rate === "number" && rate > 0 ? rate : DEFAULT_KRW_PER_USD;
}
