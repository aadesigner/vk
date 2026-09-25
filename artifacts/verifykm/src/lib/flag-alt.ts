/** ISO 3166-1 alpha-2 → i18n key for localized flag image alt text. */
const FLAG_COUNTRY_I18N: Record<string, string> = {
  us: "country_usa_name",
  ca: "country_canada_name",
  ae: "country_uae_name",
  kr: "country_korea_name",
  cn: "country_china_name",
  jp: "country_japan_name",
  gb: "flag_country_gb",
  au: "flag_country_au",
  mx: "flag_country_mx",
  es: "flag_country_es",
  ar: "flag_country_ar",
  co: "flag_country_co",
  pe: "flag_country_pe",
  cl: "flag_country_cl",
  pl: "flag_country_pl",
  ge: "flag_country_ge",
  ro: "flag_country_ro",
  al: "flag_country_al",
  xk: "flag_country_xk",
  sa: "flag_country_sa",
  jo: "flag_country_jo",
  kw: "flag_country_kw",
  eg: "flag_country_eg",
  qa: "flag_country_qa",
  bh: "flag_country_bh",
  ua: "flag_country_ua",
  ru: "flag_country_ru",
  bg: "flag_country_bg",
  de: "flag_country_de",
  fr: "flag_country_fr",
};

/** Localized "{country} flag" alt for flag images. */
export function formatImageFlagAlt(countryLabel: string, t: (key: string) => string): string {
  return t("image_flag_alt").replace("{country}", countryLabel);
}

export function flagCountryLabel(code: string, t: (key: string) => string): string {
  const key = FLAG_COUNTRY_I18N[code.toLowerCase()];
  return key ? t(key) : code.toUpperCase();
}

export function flagAltFromCode(code: string, t: (key: string) => string): string {
  return formatImageFlagAlt(flagCountryLabel(code, t), t);
}
