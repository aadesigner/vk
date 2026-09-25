import {
  SUPPORTED_LANGS,
  LANG_PATH_ALT,
  LANG_META,
  type Language,
} from "@/lib/languages";
import indexablePaths from "./indexable-paths.json";
import { localizeCanonicalRest } from "@/lib/localized-routes";

/** Public site origin for canonical URLs and sitemap (production). */
export const SITE_ORIGIN = "https://verifykm.com";
export { LANG_PATH_ALT };

export const SEO_LANGS = SUPPORTED_LANGS;
export type SeoLang = Language;

/** BCP 47 hreflang values */
export const HREFLANG_MAP: Record<SeoLang, string> = Object.fromEntries(
  SUPPORTED_LANGS.map((code) => [code, LANG_META[code].hreflang]),
) as Record<SeoLang, string>;

export const OG_LOCALE_MAP: Record<SeoLang, string> = Object.fromEntries(
  SUPPORTED_LANGS.map((code) => [code, LANG_META[code].ogLocale]),
) as Record<SeoLang, string>;

/** Paths indexed in sitemap-pages.xml (without language prefix). Home = "".
 *  Canonical list: src/lib/indexable-paths.json (also used by prerender + sitemap scripts).
 *  Values are English canonical rests; builders localize per language.
 */
export const INDEXABLE_PATHS = indexablePaths as readonly string[];

/** Build `/{lang}` or `/{lang}/{localized-slug…}` from an English canonical rest. */
export function buildLocalizedPath(lang: SeoLang, path: string): string {
  let canonical = !path || path === "/" ? "" : path;
  if (canonical && !canonical.startsWith("/")) canonical = `/${canonical}`;
  const rest = localizeCanonicalRest(lang, canonical);
  if (!rest) return `/${lang}`;
  return `/${lang}${rest.startsWith("/") ? rest : `/${rest}`}`;
}

export function stripLangPrefix(pathname: string): string {
  const stripped = pathname.replace(new RegExp(`^/(${LANG_PATH_ALT})(/|$)`), "/");
  return stripped === "/" ? "" : stripped.replace(/\/$/, "") || "";
}

/** Strip Vite `base` prefix so SEO parsing sees `/{lang}/…`. */
export function stripAppBasePath(pathname: string, basePath = ""): string {
  const base = basePath.replace(/\/$/, "");
  if (!base) return pathname;
  if (pathname === base) return "/";
  if (pathname.startsWith(`${base}/`)) return pathname.slice(base.length) || "/";
  return pathname;
}

export function parseLangFromPath(pathname: string, basePath = ""): SeoLang | null {
  const normalized = stripAppBasePath(pathname.split("?")[0], basePath);
  const m = normalized.match(new RegExp(`^/(${LANG_PATH_ALT})(/|$)`));
  return m ? (m[1] as SeoLang) : null;
}
