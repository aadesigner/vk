/**
 * Profile / registration country allowlist (English names).
 * Informational only — not used by geo-language redirects or VIN markets.
 * Albania (AL) and Kosovo (XK) are separate entries.
 * Excludes Antarctica, uninhabited territories, and tiny no-market regions.
 */

export type UserCountryOption = { code: string; name: string };

/** Market-relevant ISO 3166-1 alpha-2, including Kosovo (XK). */
const ISO_ALPHA2_CODES = [
  "AD", "AE", "AF", "AG", "AL", "AM", "AO", "AR", "AT", "AU", "AW", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BM", "BN", "BO", "BR", "BS",
  "BT", "BW", "BY", "BZ", "CA", "CD", "CF", "CG", "CH", "CI", "CL", "CM", "CN",
  "CO", "CR", "CU", "CV", "CW", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE",
  "EG", "ER", "ES", "ET", "FI", "FJ", "FR", "GA", "GB", "GD", "GE", "GG", "GH", "GI",
  "GM", "GN", "GQ", "GR", "GT", "GW", "GY", "HK",
  "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN", "IQ", "IR", "IS", "IT", "JE", "JM",
  "JO", "JP", "KE", "KG", "KH", "KM", "KN", "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC",
  "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MG", "MK",
  "ML", "MM", "MN", "MO", "MR", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA",
  "NE", "NG", "NI", "NL", "NO", "NP", "NZ", "OM", "PA", "PE", "PG",
  "PH", "PK", "PL", "PR", "PS", "PT", "PY", "QA", "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SI", "SK", "SL", "SM", "SN", "SO", "SR", "SS",
  "ST", "SV", "SX", "SY", "SZ", "TD", "TG", "TH", "TJ", "TL", "TM", "TN", "TO",
  "TR", "TT", "TW", "TZ", "UA", "UG", "US", "UY", "UZ", "VC", "VE", "VN", "VU", "WS",
  "XK", "YE", "ZA", "ZM", "ZW",
] as const;

const ALLOWED = new Set<string>(ISO_ALPHA2_CODES);

/** Keep AL and XK distinct. Drop placeholder geo codes. */
export function normalizeUserCountryCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const upper = code.trim().toUpperCase();
  if (!upper || upper.length !== 2) return null;
  if (upper === "XX" || upper === "T1") return null;
  return upper;
}

export function isAllowedUserCountryCode(code: string | null | undefined): boolean {
  const normalized = normalizeUserCountryCode(code);
  return normalized != null && ALLOWED.has(normalized);
}

function englishRegionName(code: string): string {
  if (code === "AL") return "Albania";
  if (code === "XK") return "Kosovo";
  try {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(code);
    return name && name !== code ? name : code;
  } catch {
    return code;
  }
}

let cachedOptions: UserCountryOption[] | null = null;

export function getUserCountryOptions(): UserCountryOption[] {
  if (cachedOptions) return cachedOptions;
  cachedOptions = ISO_ALPHA2_CODES.map((code) => ({
    code,
    name: englishRegionName(code),
  })).sort((a, b) => a.name.localeCompare(b.name, "en"));
  return cachedOptions;
}

export function userCountryLabel(code: string | null | undefined): string | null {
  const normalized = normalizeUserCountryCode(code);
  if (!normalized || !ALLOWED.has(normalized)) return null;
  return englishRegionName(normalized);
}

/** Validate and return stored code, or null if empty/invalid. */
export function parseUserCountryCode(code: string | null | undefined): string | null {
  const normalized = normalizeUserCountryCode(code);
  if (!normalized || !ALLOWED.has(normalized)) return null;
  return normalized;
}
