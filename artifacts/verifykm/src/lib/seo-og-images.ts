import type { SeoLang } from "./seo-config";
import type { SeoPageKey } from "./seo-pages";

const OG_PAGE_KEYS = new Set<string>([
  "home",
  "pricing",
  "free_decoder",
  "how_it_works",
  "faq",
  "country_usa",
  "country_korea",
  "country_canada",
  "country_china",
  "country_japan",
  "country_uae",
  "blog",
  "blog_free-km",
  "blog_read-vin",
  "blog_rollback",
  "blog_salvage",
  "blog_usa",
  "blog_korea",
  "blog_korea-sheet",
  "blog_odo-scam",
  "blog_import-scam",
  "blog_before-pay",
  "blog_accidents",
  "blog_stolen",
  "blog_cost",
]);

export function resolvePageOgImage(
  pageKey: SeoPageKey | string,
  lang: SeoLang,
  basePath = "",
): string | undefined {
  if (!OG_PAGE_KEYS.has(pageKey)) return undefined;
  const base = basePath.replace(/\/$/, "");
  return `${base}/seo/og/${pageKey}-${lang}.webp`;
}
