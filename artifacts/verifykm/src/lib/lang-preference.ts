import {
  SUPPORTED_LANGS,
  LANG_PATH_ALT,
  isSupportedLang,
  type Language,
} from "@/lib/languages";

export { SUPPORTED_LANGS, isSupportedLang };
export type { Language };

const LANG_KEY = "verifykm_lang";
const GEO_EVAL_KEY = "verifykm_geo_evaluated";

export function getStoredLangPreference(): Language | null {
  try {
    const raw = localStorage.getItem(LANG_KEY);
    if (raw && isSupportedLang(raw)) return raw;
  } catch { /* private browsing */ }
  return null;
}

export function setStoredLangPreference(lang: Language): void {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch { /* private browsing */ }
}

export function clearStoredLangPreference(): void {
  try {
    localStorage.removeItem(LANG_KEY);
  } catch { /* private browsing */ }
}

export function isGeoLanguageEvaluated(): boolean {
  try {
    if (localStorage.getItem(GEO_EVAL_KEY) === "1") return true;
  } catch { /* private browsing */ }
  try {
    return sessionStorage.getItem(GEO_EVAL_KEY) === "1";
  } catch {
    return false;
  }
}

export function markGeoLanguageEvaluated(): void {
  try {
    localStorage.setItem(GEO_EVAL_KEY, "1");
  } catch { /* private browsing */ }
  try {
    sessionStorage.setItem(GEO_EVAL_KEY, "1");
  } catch { /* private browsing */ }
}

/** Paths where geo language redirect must never run (admin, auth). */
export function isGeoRedirectExemptPath(pathname: string): boolean {
  if (pathname.startsWith("/adminx")) return true;
  if (new RegExp(`^/(${LANG_PATH_ALT})/(sign-in|sign-up|forgot-password|reset-password|set-password)(/|$)`).test(pathname)) {
    return true;
  }
  if (new RegExp(`^/(${LANG_PATH_ALT})/maintenance(/|$)`).test(pathname)) return true;
  return false;
}

export function extractPathLang(pathname: string): Language | null {
  const m = pathname.match(new RegExp(`^/(${LANG_PATH_ALT})(/|$)`));
  return (m?.[1] && isSupportedLang(m[1]) ? m[1] : null);
}

/**
 * Paths without a language prefix (e.g. /cars/usa, /vin/…) → /en/…
 * Returns null when no redirect is needed.
 */
export function isEnglishPrefixRedirectExempt(pathname: string): boolean {
  if (pathname === "/" || pathname === "") return true;
  if (pathname.startsWith("/adminx")) return true;
  if (/^\/(usa|korea|canada)-cars\/?$/.test(pathname)) return true;
  return false;
}

export function englishPrefixRedirectTarget(pathname: string): string | null {
  const rest = pathNeedingLangPrefix(pathname);
  if (rest === null) return null;
  return buildLocalizedPath("en", rest);
}

/** Path tail that needs a language prefix (e.g. `vin/ABC`); null when already localized or exempt. */
export function pathNeedingLangPrefix(pathname: string): string | null {
  if (isEnglishPrefixRedirectExempt(pathname)) return null;
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  if (!first) return null;
  if (isSupportedLang(first)) return null;

  if (/^[a-z]{2}$/i.test(first)) {
    return segments.slice(1).join("/");
  }

  return segments.join("/");
}

export function buildLocalizedPath(lang: Language, rest: string): string {
  const trimmed = rest.replace(/^\/+/, "");
  return trimmed ? `/${lang}/${trimmed}` : `/${lang}`;
}

export function replacePathLang(pathname: string, fromLang: Language, toLang: Language): string {
  return pathname.replace(new RegExp(`^/${fromLang}(/|$)`), `/${toLang}$1`);
}
