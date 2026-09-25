import seoData from "./seo-data.json";
import {
  stripAppBasePath,
  SITE_ORIGIN,
  HREFLANG_MAP,
  LANG_PATH_ALT,
  type SeoLang,
} from "./seo-config";
import { isIndexableVinRest, buildVinPageSeo, normalizeVin, type VinSeoLang } from "@workspace/vin-page-seo";
import { resolveFavicons } from "./country-favicons";
import { resolvePageOgImage } from "./seo-og-images";
import {
  localizeCanonicalRest,
  toCanonicalRest,
} from "./localized-routes";
import { BLOG_ARTICLES, BLOG_INDEX_META, blogCover, blogPostPath } from "@/content/blog";
import type { Language } from "@/lib/languages";
// @ts-expect-error ESM build script — no generated .d.ts
import { buildCountryPageJsonLd } from "../../scripts/country-page-json-ld.mjs";

export type SeoPageKey = keyof typeof seoData;

export const SEO_DATA = seoData as {
  [K in SeoPageKey]: Record<SeoLang, { title: string; description: string }>;
};

const VALID_COUNTRY_SLUGS = new Set(["usa", "korea", "canada", "china", "japan", "uae"]);

/** Map English-canonical URL path (without lang prefix) → SEO_DATA key */
export const PATH_TO_SEO_KEY: Record<string, SeoPageKey> = {
  "": "home",
  "/pricing": "pricing",
  "/free-vin-decoder": "free_decoder",
  "/how-it-works": "how_it_works",
  "/faq": "faq",
  "/terms": "terms",
  "/privacy": "privacy",
  "/cars/usa": "country_usa",
  "/cars/korea": "country_korea",
  "/cars/canada": "country_canada",
  "/cars/china": "country_china",
  "/cars/japan": "country_japan",
  "/cars/uae": "country_uae",
  "/sign-in": "auth",
  "/sign-up": "sign_up",
  "/dashboard": "dashboard",
  "/dashboard/account": "dashboard",
  "/dashboard/help": "dashboard",
  "/checkout": "checkout",
  "/purchases": "purchases",
  "/vin/processing": "vin_result",
  "/forgot-password": "forgot_password",
  "/reset-password": "reset_password",
};

export function resolvePageKey(rest: string, langHint?: SeoLang): SeoPageKey {
  const canonical = toCanonicalRest(rest, langHint);
  const exact = PATH_TO_SEO_KEY[canonical];
  if (exact) return exact;

  if (canonical === "/api-b2b" || canonical.startsWith("/api-b2b/")) {
    return "home";
  }

  if (canonical.startsWith("/cars/")) {
    const slug = canonical.split("/").filter(Boolean)[1]?.toLowerCase();
    if (slug && VALID_COUNTRY_SLUGS.has(slug)) {
      if (slug === "korea") return "country_korea";
      if (slug === "canada") return "country_canada";
      if (slug === "china") return "country_china";
      if (slug === "japan") return "country_japan";
      if (slug === "uae") return "country_uae";
      return "country_usa";
    }
    return "not_found";
  }

  if (canonical.startsWith("/vin/")) return "vin_result";

  return "not_found";
}

const NOINDEX_PREFIXES = [
  "/adminx",
  "/sign-in",
  "/sign-up",
  "/dashboard",
  "/checkout",
  "/purchases",
  "/forgot-password",
  "/reset-password",
  "/set-password",
  "/terms",
  "/privacy",
];

export function isNoIndexPath(rest: string, pageKey: SeoPageKey, langHint?: SeoLang): boolean {
  if (pageKey === "not_found") return true;
  const canonical = toCanonicalRest(rest, langHint);
  if (canonical.startsWith("/api-b2b")) return true;
  if (isIndexableVinRest(canonical)) return false;
  if (NOINDEX_PREFIXES.some((p) => canonical === p || canonical.startsWith(`${p}/`))) return true;
  if (canonical === "/vin/processing" || canonical.startsWith("/vin/processing/")) return true;
  return canonical.startsWith("/vin/");
}

export function resolveSeoFromPath(
  pathname: string,
  basePath = "",
): {
  lang: SeoLang;
  rest: string;
  canonicalRest: string;
  pageKey: SeoPageKey;
  noIndex: boolean;
} {
  const normalized = stripAppBasePath(pathname.split("?")[0], basePath);
  const m = normalized.match(new RegExp(`^/(${LANG_PATH_ALT})(/.*)?$`));
  const lang = (m?.[1] ?? "en") as SeoLang;
  const rest = (m?.[2] ?? "").replace(/\/$/, "") || "";
  const canonicalRest = toCanonicalRest(rest, lang);
  const pageKey = resolvePageKey(rest, lang);
  const noIndex = isNoIndexPath(rest, pageKey, lang);
  return { lang, rest, canonicalRest, pageKey, noIndex };
}

export function getSeoEntry(lang: SeoLang, pageKey: SeoPageKey) {
  const page = SEO_DATA[pageKey] ?? SEO_DATA.not_found;
  return page[lang] ?? page.en;
}

/** Canonical URL path uses the language's localized slug. */
export function buildCanonicalPath(lang: SeoLang, rest: string): string {
  const canonical = toCanonicalRest(rest, lang);
  const localized = localizeCanonicalRest(lang, canonical);
  return localized ? `/${lang}${localized}` : `/${lang}`;
}

function blogRouteSeo(lang: SeoLang, canonicalRest: string, rest: string, basePath: string) {
  const language = lang as Language;
  const canonicalPath = buildCanonicalPath(lang, rest);
  const canonicalUrl = `${SITE_ORIGIN}${canonicalPath}`;
  const favicons = resolveFavicons(undefined, basePath);

  if (canonicalRest === "/blog") {
    const title = BLOG_INDEX_META.title[language];
    const description = BLOG_INDEX_META.description[language];
    const ogImage = `${SITE_ORIGIN}${resolvePageOgImage("blog", lang, basePath) ?? blogCover("free-km")}`;
    return {
      title,
      description,
      lang,
      canonicalPath,
      noIndex: false,
      favicons,
      ogImage,
      ogImageAlt: title,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "Blog",
        name: title,
        description,
        url: canonicalUrl,
        inLanguage: HREFLANG_MAP[lang],
        blogPost: BLOG_ARTICLES.map((article) => ({
          "@type": "BlogPosting",
          headline: article.title[language],
          image: `${SITE_ORIGIN}${blogCover(article.id)}`,
          url: `${SITE_ORIGIN}${blogPostPath(language, article.id)}`,
        })),
      },
    };
  }

  const id = canonicalRest.slice("/blog/".length).split("/")[0] ?? "";
  const article = BLOG_ARTICLES.find((item) => item.id === id);
  if (!article) return null;
  const title = `${article.title[language]} | VerifyKM`;
  const description = article.description[language];
  const ogImage = `${SITE_ORIGIN}${resolvePageOgImage(`blog_${article.id}`, lang, basePath) ?? blogCover(article.id)}`;
  return {
    title,
    description,
    lang,
    canonicalPath,
    noIndex: false,
    favicons,
    ogImage,
    ogImageAlt: title,
      jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "BlogPosting",
          headline: article.title[language],
          description,
          image: ogImage,
          inLanguage: HREFLANG_MAP[lang],
          mainEntityOfPage: canonicalUrl,
          url: canonicalUrl,
          author: { "@type": "Organization", name: "verifykm.com", url: SITE_ORIGIN },
          publisher: {
            "@type": "Organization",
            name: "verifykm.com",
            url: SITE_ORIGIN,
            logo: { "@type": "ImageObject", url: `${SITE_ORIGIN}/apple-touch-icon.png` },
          },
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "VerifyKM",
              item: `${SITE_ORIGIN}${buildCanonicalPath(lang, "")}`,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: BLOG_INDEX_META.title[language].replace(/\s+\|\s+VerifyKM$/, ""),
              item: `${SITE_ORIGIN}${buildCanonicalPath(lang, "/blog")}`,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: article.title[language],
              item: canonicalUrl,
            },
          ],
        },
      ],
    },
  };
}

export function getRouteSeo(
  pathname: string,
  basePath = "",
  pageKeyOverride?: SeoPageKey,
) {
  const resolved = resolveSeoFromPath(pathname, basePath);
  const pageKey = pageKeyOverride ?? resolved.pageKey;

  if (resolved.canonicalRest === "/blog" || resolved.canonicalRest.startsWith("/blog/")) {
    const blog = blogRouteSeo(resolved.lang, resolved.canonicalRest, resolved.rest, basePath);
    if (blog) return blog;
  }

  if (isIndexableVinRest(resolved.canonicalRest)) {
    const vin = normalizeVin(resolved.canonicalRest.replace(/^\/vin\//, ""));
    const lang = resolved.lang as VinSeoLang;
    const seo = buildVinPageSeo(lang, { vin }, SITE_ORIGIN);
    return {
      title: seo.title,
      description: seo.description,
      lang: resolved.lang,
      canonicalPath: seo.canonicalPath,
      noIndex: false,
      jsonLd: seo.jsonLd,
      ogImage: seo.ogImage,
      ogImageAlt: seo.title,
      favicons: resolveFavicons(undefined, basePath),
    };
  }

  const seo = getSeoEntry(resolved.lang, pageKey);
  const ogImage = resolvePageOgImage(pageKey, resolved.lang, basePath);
  const canonicalPath = buildCanonicalPath(resolved.lang, resolved.rest);
  const canonicalUrl = `${SITE_ORIGIN}${canonicalPath}`;
  const absoluteOgImage = ogImage
    ? (ogImage.startsWith("http") ? ogImage : `${SITE_ORIGIN}${ogImage}`)
    : undefined;

  const countryJsonLd =
    pageKey === "country_usa" || pageKey === "country_korea" || pageKey === "country_canada"
      || pageKey === "country_china" || pageKey === "country_japan" || pageKey === "country_uae"
      ? buildCountryPageJsonLd({
          pageKey,
          title: seo.title,
          description: seo.description,
          canonicalUrl,
          lang: HREFLANG_MAP[resolved.lang],
          ogImage: absoluteOgImage,
        })
      : undefined;

  return {
    ...seo,
    lang: resolved.lang,
    canonicalPath,
    noIndex: resolved.noIndex || pageKey === "not_found",
    favicons: resolveFavicons(pageKey, basePath),
    ogImage,
    ogImageAlt: seo.title,
    jsonLd: countryJsonLd,
  };
}
