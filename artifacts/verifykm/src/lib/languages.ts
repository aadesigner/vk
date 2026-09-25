/**
 * Single source of truth for site languages.
 * Display / picker priority (user-defined):
 * en → de → es → fr → sq → pl → ro → bg → ka → ar → uk → ru → zh
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
] as const;

export type Language = (typeof SUPPORTED_LANGS)[number];

/** Alternation group for path regexes: en|de|es|… */
export const LANG_PATH_ALT = SUPPORTED_LANGS.join("|");

export const LANG_PATH_RE = new RegExp(`^/(${LANG_PATH_ALT})(/|$)`);
export const LANG_SEGMENT_RE = new RegExp(`/(${LANG_PATH_ALT})(?:/|$)`);

export type LangMeta = {
  code: Language;
  /** Native / display name shown in pickers */
  label: string;
  /** Short code for compact UIs */
  short: string;
  /** ISO 3166-1 alpha-2 for lipis/flag-icons (4:3 SVG) */
  flag: string;
  hreflang: string;
  ogLocale: string;
  /** Intl locale for dates/numbers */
  intl: string;
};

/** Picker order = SUPPORTED_LANGS order */
export const LANG_META: Record<Language, LangMeta> = {
  en: { code: "en", label: "English", short: "EN", flag: "gb", hreflang: "en", ogLocale: "en_US", intl: "en-US" },
  de: { code: "de", label: "Deutsch", short: "DE", flag: "de", hreflang: "de", ogLocale: "de_DE", intl: "de-DE" },
  es: { code: "es", label: "Español", short: "ES", flag: "es", hreflang: "es", ogLocale: "es_ES", intl: "es-ES" },
  fr: { code: "fr", label: "Français", short: "FR", flag: "fr", hreflang: "fr", ogLocale: "fr_FR", intl: "fr-FR" },
  sq: { code: "sq", label: "Shqip", short: "SQ", flag: "al", hreflang: "sq-AL", ogLocale: "sq_AL", intl: "sq-AL" },
  pl: { code: "pl", label: "Polski", short: "PL", flag: "pl", hreflang: "pl", ogLocale: "pl_PL", intl: "pl-PL" },
  ro: { code: "ro", label: "Română", short: "RO", flag: "ro", hreflang: "ro", ogLocale: "ro_RO", intl: "ro-RO" },
  bg: { code: "bg", label: "Български", short: "BG", flag: "bg", hreflang: "bg", ogLocale: "bg_BG", intl: "bg-BG" },
  ka: { code: "ka", label: "ქართული", short: "KA", flag: "ge", hreflang: "ka", ogLocale: "ka_GE", intl: "ka-GE" },
  ar: { code: "ar", label: "العربية", short: "AR", flag: "sa", hreflang: "ar", ogLocale: "ar_SA", intl: "ar" },
  uk: { code: "uk", label: "Українська", short: "UK", flag: "ua", hreflang: "uk-UA", ogLocale: "uk_UA", intl: "uk-UA" },
  ru: { code: "ru", label: "Русский", short: "RU", flag: "ru", hreflang: "ru", ogLocale: "ru_RU", intl: "ru-RU" },
  zh: { code: "zh", label: "中文", short: "ZH", flag: "cn", hreflang: "zh-Hans", ogLocale: "zh_CN", intl: "zh-CN" },
};

/** Ordered list for navbar / footer / admin pickers */
export const LANG_PICKER_OPTIONS: LangMeta[] = SUPPORTED_LANGS.map((code) => LANG_META[code]);

export function isSupportedLang(seg: string): seg is Language {
  return (SUPPORTED_LANGS as readonly string[]).includes(seg);
}

export function parseLangFromSegment(seg: string | undefined | null): Language | null {
  if (!seg) return null;
  return isSupportedLang(seg) ? seg : null;
}

/** Locale homepage path used for crawlable cross-language footer links. */
export function localeHomePath(lang: Language): string {
  return `/${lang}`;
}

/**
 * Swap the leading locale segment in a pathname and remap localized slugs
 * (e.g. /es/precios → /sq/ofertat).
 */
export function replaceLangInPath(
  pathname: string,
  currentLang: Language,
  nextLang: Language,
): string {
  // Lazy import avoided — keep languages.ts free of circular deps by inlining remap via dynamic.
  // Callers that need slug remap should use remapPathForLang from localized-routes.
  // Fallback: prefix swap only (correct when already on English slugs).
  const newPath = pathname.replace(new RegExp(`^/${currentLang}(/|$)`), `/${nextLang}$1`);
  return newPath === pathname ? localeHomePath(nextLang) : newPath;
}

/** True when a click should keep SPA soft-navigation (left click, no modifiers). */
export function shouldSoftNavigateClick(
  e: Pick<MouseEvent, "defaultPrevented" | "button" | "metaKey" | "altKey" | "ctrlKey" | "shiftKey">,
): boolean {
  return (
    !e.defaultPrevented
    && e.button === 0
    && !e.metaKey
    && !e.altKey
    && !e.ctrlKey
    && !e.shiftKey
  );
}
