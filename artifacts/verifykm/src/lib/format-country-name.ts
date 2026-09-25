export type CountryLabelOverrides = {
  usa?: string;
  korea?: string;
  canada?: string;
};

const ISO_ALIASES: Record<string, string> = {
  USA: "US",
  US: "US",
  UK: "GB",
  GB: "GB",
  KR: "KR",
  KOR: "KR",
  KOREA: "KR",
  DE: "DE",
  GER: "DE",
  DEU: "DE",
  JP: "JP",
  JPN: "JP",
  FR: "FR",
  FRA: "FR",
  IT: "IT",
  ITA: "IT",
  CA: "CA",
  CAN: "CA",
  AU: "AU",
  AUS: "AU",
  CN: "CN",
  CHN: "CN",
  PL: "PL",
  POL: "PL",
  NL: "NL",
  NLD: "NL",
  ES: "ES",
  ESP: "ES",
  AE: "AE",
  ARE: "AE",
  UA: "UA",
  UKR: "UA",
  RU: "RU",
  RUS: "RU",
  MX: "MX",
  MEX: "MX",
  SE: "SE",
  SWE: "SE",
  AT: "AT",
  AUT: "AT",
  BE: "BE",
  BEL: "BE",
  HU: "HU",
  HUN: "HU",
  SK: "SK",
  SVK: "SK",
  CZ: "CZ",
  CZE: "CZ",
  IN: "IN",
  IND: "IN",
  TR: "TR",
  TUR: "TR",
  BR: "BR",
  BRA: "BR",
  ZA: "ZA",
  ZAF: "ZA",
  TW: "TW",
  TWN: "TW",
  TH: "TH",
  THA: "TH",
  NO: "NO",
  NOR: "NO",
  DK: "DK",
  DNK: "DK",
  FI: "FI",
  FIN: "FI",
  PT: "PT",
  PRT: "PT",
  GR: "GR",
  GRC: "GR",
  RO: "RO",
  ROU: "RO",
  CH: "CH",
  CHE: "CH",
  IE: "IE",
  IRL: "IE",
  NZ: "NZ",
  NZL: "NZ",
  IL: "IL",
  ISR: "IL",
  SA: "SA",
  SAU: "SA",
};

/** English / provider country names → ISO 3166-1 alpha-2 (VIN decoder, pending reports). */
const ENGLISH_NAME_TO_ISO: Record<string, string> = {
  "united states": "US",
  "united states of america": "US",
  usa: "US",
  "u.s.a.": "US",
  "u.s.": "US",
  canada: "CA",
  mexico: "MX",
  "south korea": "KR",
  "republic of korea": "KR",
  korea: "KR",
  "north korea": "KP",
  japan: "JP",
  china: "CN",
  "people's republic of china": "CN",
  germany: "DE",
  "united kingdom": "GB",
  uk: "GB",
  "great britain": "GB",
  england: "GB",
  france: "FR",
  italy: "IT",
  spain: "ES",
  sweden: "SE",
  austria: "AT",
  belgium: "BE",
  hungary: "HU",
  poland: "PL",
  slovakia: "SK",
  "czech republic": "CZ",
  czechia: "CZ",
  india: "IN",
  australia: "AU",
  netherlands: "NL",
  ukraine: "UA",
  russia: "RU",
  "russian federation": "RU",
  "united arab emirates": "AE",
  uae: "AE",
  turkey: "TR",
  türkiye: "TR",
  brazil: "BR",
  argentina: "AR",
  "south africa": "ZA",
  taiwan: "TW",
  thailand: "TH",
  vietnam: "VN",
  malaysia: "MY",
  indonesia: "ID",
  philippines: "PH",
  norway: "NO",
  denmark: "DK",
  finland: "FI",
  portugal: "PT",
  greece: "GR",
  romania: "RO",
  bulgaria: "BG",
  croatia: "HR",
  serbia: "RS",
  slovenia: "SI",
  ireland: "IE",
  switzerland: "CH",
  luxembourg: "LU",
  "new zealand": "NZ",
  israel: "IL",
  egypt: "EG",
  "saudi arabia": "SA",
};

const LOCALE_MAP: Record<string, string> = {
  en: "en-US",
  de: "de-DE",
  es: "es-ES",
  fr: "fr-FR",
  sq: "sq-AL",
  pl: "pl-PL",
  ro: "ro-RO",
  bg: "bg-BG",
  ka: "ka-GE",
  ar: "ar",
  uk: "uk-UA",
  ru: "ru-RU",
  zh: "zh-CN",
};

function normalizeCountryKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Resolve only ISO codes and English country names — non-English free text stays as typed. */
export function resolveCountryIso2(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const upper = raw.trim().toUpperCase();
  if (ISO_ALIASES[upper]) return ISO_ALIASES[upper];
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  return ENGLISH_NAME_TO_ISO[normalizeCountryKey(raw)] ?? null;
}

/** English label for storage/prefill so every UI language can resolve + translate it. */
export function canonicalCountryStorageLabel(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  const iso2 = resolveCountryIso2(raw.trim());
  if (!iso2) return raw.trim();
  if (iso2 === "US") return "USA";
  if (iso2 === "KR") return "South Korea";
  if (iso2 === "CA") return "Canada";
  if (iso2 === "AE") return "UAE";
  if (iso2 === "CN") return "China";
  return localizedRegionName(iso2, "en") ?? raw.trim();
}

function localizedRegionName(iso2: string, lang: string): string | null {
  const locale = LOCALE_MAP[lang] ?? lang;
  try {
    const display = new Intl.DisplayNames([locale], { type: "region" });
    return display.of(iso2) ?? null;
  } catch {
    return null;
  }
}

function applyOverrides(iso2: string, overrides?: CountryLabelOverrides): string | null {
  if (iso2 === "US" && overrides?.usa) return overrides.usa;
  if (iso2 === "KR" && overrides?.korea) return overrides.korea;
  if (iso2 === "CA" && overrides?.canada) return overrides.canada;
  return null;
}

/** Expand ISO / short codes or English names to a localized country label. */
export function formatCountryName(
  raw: string | null | undefined,
  lang = "en",
  overrides?: CountryLabelOverrides,
): string {
  if (!raw?.trim()) return "";

  const trimmed = raw.trim();
  if (trimmed.includes("/")) {
    return trimmed
      .split("/")
      .map((part) => formatCountryName(part.trim(), lang, overrides))
      .filter(Boolean)
      .join(" / ");
  }

  const iso2 = resolveCountryIso2(trimmed);

  if (!iso2) return trimmed;

  const override = applyOverrides(iso2, overrides);
  if (override) return override;

  return localizedRegionName(iso2, lang) ?? trimmed;
}

/** Translate a single location segment only if it is a known country label/code. */
function translateCountrySegmentOnly(
  segment: string,
  lang: string,
  overrides?: CountryLabelOverrides,
): string | null {
  const trimmed = segment.trim();
  if (!trimmed) return null;

  // VIN-style combined origins in a location field (rare): only if every part is a country.
  if (trimmed.includes("/")) {
    const bits = trimmed.split("/").map((p) => p.trim()).filter(Boolean);
    if (bits.length === 0 || !bits.every((b) => resolveCountryIso2(b))) return null;
    return bits.map((b) => formatCountryName(b, lang, overrides)).join(" / ");
  }

  if (!resolveCountryIso2(trimmed)) return null;
  return formatCountryName(trimmed, lang, overrides);
}

/**
 * Location line — translates only the trailing country segment.
 * City / region text before the last comma is never rewritten
 * (e.g. "Asan, South Korea" → "Asan, Koreja e Jugut" in Albanian).
 */
export function formatLocationLabel(
  raw: string | null | undefined,
  lang = "en",
  overrides?: CountryLabelOverrides,
): string {
  if (!raw?.trim()) return "";

  const trimmed = raw.trim();
  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return trimmed;

  const countryPart = parts[parts.length - 1]!;
  const translatedCountry = translateCountrySegmentOnly(countryPart, lang, overrides);
  if (!translatedCountry) return trimmed;

  if (parts.length === 1) return translatedCountry;
  return [...parts.slice(0, -1), translatedCountry].join(", ");
}

export function countryLabelsFromT(t: (key: string) => string): CountryLabelOverrides {
  return {
    usa: t("country_usa_name"),
    korea: t("country_korea_name"),
    canada: t("country_canada_name"),
  };
}

/** Localize VIN origin / plant country — handles legacy combined labels like "France/Spain". */
export function formatVinOriginCountry(
  raw: string | null | undefined,
  lang = "en",
  overrides?: CountryLabelOverrides,
): string {
  if (!raw?.trim()) return "";
  const trimmed = raw.trim();
  if (trimmed.includes("/")) {
    return trimmed
      .split("/")
      .map((part) => formatCountryName(part.trim(), lang, overrides))
      .filter(Boolean)
      .join(" / ");
  }
  return formatCountryName(trimmed, lang, overrides) || trimmed;
}
