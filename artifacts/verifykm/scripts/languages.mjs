/**
 * Mirror of src/lib/languages.ts for Node build scripts (mjs cannot import TS cleanly).
 * Keep in sync when adding languages.
 */
export const SUPPORTED_LANGS = [
  "en",
  "de",
  "es",
  "fr",
  "sq",
  "pl",
  "ro",
  "bg",
  "ka",
  "ar",
  "uk",
  "ru",
  "zh",
];

export const LANG_PATH_ALT = SUPPORTED_LANGS.join("|");

export const HREFLANG_MAP = {
  en: "en",
  de: "de",
  es: "es",
  fr: "fr",
  sq: "sq-AL",
  pl: "pl",
  ro: "ro",
  bg: "bg",
  ka: "ka",
  ar: "ar",
  uk: "uk-UA",
  ru: "ru",
  zh: "zh-Hans",
};

export const OG_LOCALE_MAP = {
  en: "en_US",
  de: "de_DE",
  es: "es_ES",
  fr: "fr_FR",
  sq: "sq_AL",
  pl: "pl_PL",
  ro: "ro_RO",
  bg: "bg_BG",
  ka: "ka_GE",
  ar: "ar_SA",
  uk: "uk_UA",
  ru: "ru_RU",
  zh: "zh_CN",
};
