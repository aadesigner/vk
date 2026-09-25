/** Shared OG screenshot targets — used by capture script and SEO inject. */

import { SUPPORTED_LANGS } from "./languages.mjs";

export const SEO_OG_LANGS = SUPPORTED_LANGS;

/** pageKey → URL path without lang prefix */
export const SEO_OG_PAGES = [
  { pageKey: "home", rest: "" },
  { pageKey: "country_usa", rest: "/cars/usa" },
  { pageKey: "country_korea", rest: "/cars/korea" },
  { pageKey: "country_canada", rest: "/cars/canada" },
  { pageKey: "country_china", rest: "/cars/china" },
  { pageKey: "country_japan", rest: "/cars/japan" },
  { pageKey: "country_uae", rest: "/cars/uae" },
];

export const SEO_OG_WIDTH = 1200;
export const SEO_OG_HEIGHT = 630;

/** WebP output — tuned for ~25–45 KB OG cards at 1200×630 */
export const SEO_OG_WEBP_QUALITY = 80;
export const SEO_OG_WEBP_EFFORT = 6;

export function seoOgImageRelPath(pageKey, lang) {
  return `/seo/og/${pageKey}-${lang}.webp`;
}

export function seoOgImagePath(pageKey, lang, basePath = "") {
  const base = String(basePath).replace(/\/$/, "");
  return `${base}${seoOgImageRelPath(pageKey, lang)}`;
}

export function isSeoOgPageKey(pageKey) {
  return SEO_OG_PAGES.some((p) => p.pageKey === pageKey);
}
