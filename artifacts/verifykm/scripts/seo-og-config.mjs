/** Shared OG screenshot targets — public frontend only (no auth, dashboard, checkout, admin). */

import { SUPPORTED_LANGS } from "./languages.mjs";

export const SEO_OG_LANGS = SUPPORTED_LANGS;

const BLOG_ARTICLE_IDS = [
  "free-km",
  "read-vin",
  "rollback",
  "salvage",
  "usa",
  "korea",
  "korea-sheet",
  "odo-scam",
  "import-scam",
  "before-pay",
  "accidents",
  "stolen",
  "cost",
];

/** pageKey → English-canonical path (localized at capture / inject time) */
export const SEO_OG_PAGES = [
  { pageKey: "home", rest: "" },
  { pageKey: "pricing", rest: "/pricing" },
  { pageKey: "free_decoder", rest: "/free-vin-decoder" },
  { pageKey: "how_it_works", rest: "/how-it-works" },
  { pageKey: "faq", rest: "/faq" },
  { pageKey: "country_usa", rest: "/cars/usa" },
  { pageKey: "country_korea", rest: "/cars/korea" },
  { pageKey: "country_canada", rest: "/cars/canada" },
  { pageKey: "country_china", rest: "/cars/china" },
  { pageKey: "country_japan", rest: "/cars/japan" },
  { pageKey: "country_uae", rest: "/cars/uae" },
  { pageKey: "blog", rest: "/blog" },
  ...BLOG_ARTICLE_IDS.map((id) => ({ pageKey: `blog_${id}`, rest: `/blog/${id}` })),
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

export function seoOgPageKeyFromBlogRest(canonicalRest) {
  if (canonicalRest === "/blog") return "blog";
  if (canonicalRest.startsWith("/blog/")) {
    const id = canonicalRest.slice("/blog/".length).split("/")[0];
    const key = `blog_${id}`;
    return isSeoOgPageKey(key) ? key : null;
  }
  return null;
}
