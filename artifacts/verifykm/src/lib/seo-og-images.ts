import type { SeoLang } from "./seo-config";
import type { SeoPageKey } from "./seo-pages";

const OG_PAGE_KEYS = new Set<SeoPageKey>([
  "home",
  "country_usa",
  "country_korea",
  "country_canada",
  "country_china",
  "country_japan",
  "country_uae",
]);

export function resolvePageOgImage(
  pageKey: SeoPageKey,
  lang: SeoLang,
  basePath = "",
): string | undefined {
  if (!OG_PAGE_KEYS.has(pageKey)) return undefined;
  const base = basePath.replace(/\/$/, "");
  return `${base}/seo/og/${pageKey}-${lang}.webp`;
}
