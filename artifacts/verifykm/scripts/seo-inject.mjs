/**
 * Shared SEO HTML injection — used by Vite dev plugin, prerender, and bootstrap generator.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  faviconAssetsForPageKey,
  withBasePath,
  DEFAULT_FAVICONS,
} from "./country-favicon-config.mjs";
import { isSeoOgPageKey, seoOgImagePath } from "./seo-og-config.mjs";
import { vinSeoTemplates } from "./vin-seo-templates.mjs";
import { buildCountryPageJsonLd, buildHomeOrganizationJsonLd, isCountrySeoPageKey } from "./country-page-json-ld.mjs";
import {
  injectMarketingSsrIntoHtml,
  resolveMarketingSsrContent,
} from "./marketing-ssr-inject.mjs";
import {
  injectVinSsrIntoHtml,
  resolveVinSsrContent,
} from "./vin-ssr-inject.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const seoData = JSON.parse(
  readFileSync(join(__dir, "../src/lib/seo-data.json"), "utf8"),
);

import { SUPPORTED_LANGS, HREFLANG_MAP as LANG_HREFLANG, OG_LOCALE_MAP as LANG_OG, LANG_PATH_ALT } from "./languages.mjs";
import { localizeCanonicalRest, localizedPath, toCanonicalRest } from "./localized-routes.mjs";

export const SEO_LANGS = SUPPORTED_LANGS;

const b2bSeoData = JSON.parse(
  readFileSync(join(__dir, "b2b-seo-data.json"), "utf8"),
);

const blogSeo = JSON.parse(readFileSync(join(__dir, "blog-seo.json"), "utf8"));

export const B2B_PRERENDER_PATHS = Object.keys(b2bSeoData);

/** Canonical indexable routes — keep in sync with src/lib/indexable-paths.json */
export const INDEXABLE_PRERENDER_PATHS = JSON.parse(
  readFileSync(join(__dir, "../src/lib/indexable-paths.json"), "utf8"),
);

const b2bInIndexable = INDEXABLE_PRERENDER_PATHS.filter((p) => p.startsWith("/api-b2b")).sort();
const b2bInData = new Set(B2B_PRERENDER_PATHS);
// Indexable B2B routes must be a subset of b2b-seo-data paths (hub-only is OK — secondary pages stay noindex).
if (!b2bInIndexable.every((p) => b2bInData.has(p))) {
  throw new Error(
    "indexable-paths.json B2B routes must exist in b2b-seo-data.json — update both files",
  );
}

export const PATH_TO_SEO_KEY = {
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
  "/checkout": "checkout",
  "/purchases": "purchases",
  "/vin/processing": "vin_result",
  "/forgot-password": "forgot_password",
  "/reset-password": "reset_password",
};

const VALID_COUNTRY_SLUGS = new Set(["usa", "korea", "canada", "china", "japan", "uae"]);

const NOINDEX_EXACT = new Set([
  "/sign-in",
  "/sign-up",
  "/dashboard",
  "/checkout",
  "/purchases",
  "/forgot-password",
  "/reset-password",
  "/set-password",
  "/vin/processing",
  "/terms",
  "/privacy",
]);

const NOINDEX_PREFIXES = ["/adminx", "/dashboard"];

const VIN_INDEX_RE = /^\/vin\/([A-HJ-NPR-Z0-9]{17})$/i;

export function isIndexableVinRest(rest) {
  const m = rest.match(VIN_INDEX_RE);
  return !!m && m[1].toLowerCase() !== "processing";
}

export function vinSeoFromRest(rest, lang) {
  const m = rest.match(VIN_INDEX_RE);
  if (!m) return null;
  const vin = m[1].toUpperCase();
  return vinSeoTemplates(vin, lang);
}

export function resolvePageKey(rest) {
  const exact = PATH_TO_SEO_KEY[rest];
  if (exact) return exact;

  // B2B marketing is indexable; titles come from b2b-seo-data.json (not SEO_DATA home).
  if (rest === "/api-b2b" || rest.startsWith("/api-b2b/")) {
    return "api_b2b";
  }

  if (rest.startsWith("/cars/")) {
    const slug = rest.split("/").filter(Boolean)[1]?.toLowerCase();
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

  if (rest.startsWith("/vin/")) return "vin_result";

  return "not_found";
}

export function isNoIndexPath(rest, pageKey) {
  if (pageKey === "not_found") return true;
  // Secondary B2B URLs: noindex (hub /api-b2b stays indexable with partner-intent meta).
  if (rest.startsWith("/api-b2b/")) return true;
  if (pageKey === "api_b2b") return false;
  // VIN report URLs: default noindex in static bootstrap. Catalog pages that should
  // rank get index/follow from server inject + React when report data exists.
  if (isIndexableVinRest(rest)) return true;
  if (NOINDEX_EXACT.has(rest)) return true;
  if (NOINDEX_PREFIXES.some((p) => rest === p || rest.startsWith(`${p}/`))) return true;
  return rest.startsWith("/vin/");
}

export const HREFLANG_MAP = LANG_HREFLANG;
export const OG_LOCALE_MAP = LANG_OG;

export const SITE_ORIGIN = "https://verifykm.com";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function stripBasePath(pathname, basePath = "") {
  const base = basePath.replace(/\/$/, "");
  if (!base) return pathname;
  if (pathname === base) return "/";
  if (pathname.startsWith(`${base}/`)) return pathname.slice(base.length) || "/";
  return pathname;
}

function blogCopy(map, lang) {
  return map?.[lang] ?? map?.en ?? "";
}

function resolveBlogPage(rest, lang) {
  if (rest !== "/blog" && !rest.startsWith("/blog/")) return null;

  if (rest === "/blog") {
    const title = blogCopy(blogSeo.index, lang).title;
    const description = blogCopy(blogSeo.index, lang).description;
    return {
      title,
      description,
      ogImage: "/blog/free-km.jpg",
      ogType: "website",
      h1: title.replace(/\s+\|\s+VerifyKM$/, ""),
      lead: description,
      sections: blogSeo.articles.map((article) => ({
        title: blogCopy(article.title, lang),
        body: blogCopy(article.description, lang),
      })),
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "Blog",
        name: title,
        description,
        url: `${SITE_ORIGIN}${localizedPath(lang, "/blog")}`,
        inLanguage: LANG_HREFLANG[lang] ?? lang,
        blogPost: blogSeo.articles.map((article) => ({
          "@type": "BlogPosting",
          headline: blogCopy(article.title, lang),
          image: `${SITE_ORIGIN}/blog/${article.id}.jpg`,
          url: `${SITE_ORIGIN}${localizedPath(lang, `/blog/${article.id}`)}`,
        })),
      },
    };
  }

  const id = rest.slice("/blog/".length).split("/")[0];
  const article = blogSeo.articles.find((item) => item.id === id);
  if (!article) return null;
  const headline = blogCopy(article.title, lang);
  const description = blogCopy(article.description, lang);
  const title = `${headline} | VerifyKM`;
  const canonicalPath = localizedPath(lang, rest);
  const canonicalUrl = `${SITE_ORIGIN}${canonicalPath}`;
  return {
    title,
    description,
    ogImage: `/blog/${article.id}.jpg`,
    ogType: "article",
    h1: headline,
    lead: description,
    sections: blogCopy(article.sections, lang),
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "BlogPosting",
          headline,
          description,
          image: `${SITE_ORIGIN}/blog/${article.id}.jpg`,
          inLanguage: LANG_HREFLANG[lang] ?? lang,
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
              item: `${SITE_ORIGIN}${localizedPath(lang, "")}`,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: blogCopy(blogSeo.index, lang).title.replace(/\s+\|\s+VerifyKM$/, ""),
              item: `${SITE_ORIGIN}${localizedPath(lang, "/blog")}`,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: headline,
              item: canonicalUrl,
            },
          ],
        },
      ],
    },
  };
}

/** Resolve SEO for a URL pathname like /sq/ofertat or /sq/pricing (alias). */
export function resolveSeoForPath(pathname, basePath = "") {
  const path = stripBasePath(pathname.split("?")[0], basePath);
  const m = path.match(new RegExp(`^/(${LANG_PATH_ALT})(/.*)?$`));
  const lang = m?.[1] ?? "en";
  const rawRest = (m?.[2] ?? "").replace(/\/$/, "") || "";
  const rest = toCanonicalRest(rawRest);
  const blogPage = resolveBlogPage(rest, lang);
  if (blogPage) {
    const canonicalPath = localizedPath(lang, rest);
    return {
      lang,
      dir: lang === "ar" ? "rtl" : "ltr",
      title: blogPage.title,
      description: blogPage.description,
      pageKey: "blog",
      rest,
      noIndex: false,
      canonicalPath,
      canonicalUrl: `${SITE_ORIGIN}${canonicalPath}`,
      ogImage: blogPage.ogImage,
      ogImageAlt: blogPage.h1,
      ogType: blogPage.ogType,
      blogSsr: {
        h1: blogPage.h1,
        lead: blogPage.lead,
        sections: blogPage.sections,
      },
      blogJsonLd: blogPage.jsonLd,
    };
  }
  const vinSeo = isIndexableVinRest(rest) ? vinSeoFromRest(rest, lang) : null;
  const pageKey = resolvePageKey(rest);
  const b2bPage = b2bSeoData[rest] ?? null;
  const b2bSeo = b2bPage ? (b2bPage[lang] ?? b2bPage.en ?? null) : null;
  const page = pageKey === "api_b2b"
    ? null
    : (seoData[pageKey] ?? seoData.not_found ?? seoData.home);
  const seo = vinSeo
    ?? b2bSeo
    ?? (page ? (page[lang] ?? page.en ?? seoData.home.en) : seoData.home.en);
  const noIndex = isNoIndexPath(rest, pageKey);
  const canonicalPath = localizedPath(lang, rest);
  const dir = lang === "ar" ? "rtl" : "ltr";
  const ogImage = seo.ogImage
    ?? (isSeoOgPageKey(pageKey) ? seoOgImagePath(pageKey, lang, basePath) : undefined);

  return {
    lang,
    dir,
    title: seo.title,
    description: seo.description,
    pageKey,
    rest,
    noIndex,
    canonicalPath,
    canonicalUrl: `${SITE_ORIGIN}${canonicalPath}`,
    ogImage,
    ogImageAlt: seo.ogImageAlt ?? seo.title,
  };
}

function removeGeneratedSeoTags(html) {
  return html
    .replace(/\n?\s*<meta name="description"[^>]*>/g, "")
    .replace(/\n?\s*<meta name="robots"[^>]*>/g, "")
    .replace(/\n?\s*<meta property="og:[^"]+"[^>]*>/g, "")
    .replace(/\n?\s*<meta name="twitter:[^"]+"[^>]*>/g, "")
    .replace(/\n?\s*<link rel="canonical"[^>]*>/g, "")
    .replace(/\n?\s*<link rel="alternate" hreflang="[^"]+"[^>]*>/g, "")
    .replace(/\n?\s*<meta property="og:locale:alternate"[^>]*>/g, "")
    .replace(/\n?\s*<script id="verifykm-json-ld"[^>]*>[\s\S]*?<\/script>/g, "");
}

function buildJsonLdScript(resolved) {
  if (resolved.noIndex) return "";

  let jsonLd;

  if (resolved.blogJsonLd) {
    jsonLd = resolved.blogJsonLd;
  } else if (resolved.pageKey === "home") {
    jsonLd = buildHomeOrganizationJsonLd(SITE_ORIGIN, resolved.description);
  } else if (isCountrySeoPageKey(resolved.pageKey)) {
    const absoluteOg = resolved.ogImage
      ? (String(resolved.ogImage).startsWith("/")
        ? `${SITE_ORIGIN}${resolved.ogImage}`
        : resolved.ogImage)
      : undefined;

    jsonLd = buildCountryPageJsonLd({
      pageKey: resolved.pageKey,
      title: resolved.title,
      description: resolved.description,
      canonicalUrl: resolved.canonicalUrl,
      lang: HREFLANG_MAP[resolved.lang],
      ogImage: absoluteOg,
    });
  }

  if (!jsonLd) return "";

  const safeJson = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
  return `\n    <script id="verifykm-json-ld" type="application/ld+json">${safeJson}</script>`;
}

function buildSeoHeadBlock(resolved) {
  const { lang, title, description, noIndex, canonicalUrl, rest, ogImage, ogImageAlt } = resolved;
  const lines = [
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta name="robots" content="${noIndex ? "noindex, nofollow" : "index, follow"}" />`,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:type" content="${resolved.ogType || "website"}" />`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:locale" content="${OG_LOCALE_MAP[lang]}" />`,
    `<meta property="og:site_name" content="verifykm.com" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
  ];

  if (ogImage) {
    const absoluteOgImage = String(ogImage).startsWith("/") ? `${SITE_ORIGIN}${ogImage}` : ogImage;
    lines.push(`<meta property="og:image" content="${escapeHtml(absoluteOgImage)}" />`);
    lines.push(`<meta name="twitter:image" content="${escapeHtml(absoluteOgImage)}" />`);
    if (String(absoluteOgImage).startsWith("https://")) {
      lines.push(`<meta property="og:image:secure_url" content="${escapeHtml(absoluteOgImage)}" />`);
    }
    if (ogImageAlt) {
      lines.push(`<meta property="og:image:alt" content="${escapeHtml(ogImageAlt)}" />`);
    }
  }

  if (!noIndex) {
    for (const l of SEO_LANGS) {
      const href = `${SITE_ORIGIN}${localizedPath(l, rest)}`;
      lines.push(
        `<link rel="alternate" hreflang="${HREFLANG_MAP[l]}" href="${escapeHtml(href)}" />`,
      );
    }
    lines.push(
      `<link rel="alternate" hreflang="x-default" href="${escapeHtml(
        `${SITE_ORIGIN}${localizedPath("en", rest)}`,
      )}" />`,
    );
    for (const l of SEO_LANGS) {
      if (l === lang) continue;
      lines.push(
        `<meta property="og:locale:alternate" content="${OG_LOCALE_MAP[l]}" />`,
      );
    }
  }

  return `\n    ${lines.join("\n    ")}\n${buildJsonLdScript(resolved)}`;
}

function resolveFavicons(pageKey, basePath = "") {
  const country = faviconAssetsForPageKey(pageKey);
  const assets = country ?? DEFAULT_FAVICONS;
  return {
    icon16: withBasePath(assets.icon16, basePath),
    icon32: withBasePath(assets.icon32, basePath),
    apple: withBasePath(assets.apple, basePath),
  };
}

function applyFaviconLinks(html, pageKey, basePath = "") {
  const { icon16, icon32, apple } = resolveFavicons(pageKey, basePath);
  return html
    .replace(
      /<link rel="icon" type="image\/png" sizes="32x32" href="[^"]*" \/>/i,
      `<link rel="icon" type="image/png" sizes="32x32" href="${escapeHtml(icon32)}" />`,
    )
    .replace(
      /<link rel="icon" type="image\/png" sizes="16x16" href="[^"]*" \/>/i,
      `<link rel="icon" type="image/png" sizes="16x16" href="${escapeHtml(icon16)}" />`,
    )
    .replace(
      /<link rel="apple-touch-icon" sizes="180x180" href="[^"]*" \/>/i,
      `<link rel="apple-touch-icon" sizes="180x180" href="${escapeHtml(apple)}" />`,
    );
}

/** Inject localized SEO into an HTML document string (for SSR-like prerender + Vite dev). */
export function injectSeoIntoHtml(html, pathname, basePath = "") {
  const resolved = resolveSeoForPath(pathname, basePath);
  let out = removeGeneratedSeoTags(html);
  out = applyFaviconLinks(out, resolved.pageKey, basePath);

  out = out.replace(/<html([^>]*)>/i, (_match, attrs) => {
    const cleaned = String(attrs)
      .replace(/\s*lang="[^"]*"/gi, "")
      .replace(/\s*dir="[^"]*"/gi, "");
    return `<html${cleaned} lang="${resolved.lang}" dir="${resolved.dir}">`;
  });

  out = out.replace(
    /<title>[^<]*<\/title>/i,
    `<title>${escapeHtml(resolved.title)}</title>`,
  );

  const seoBlock = buildSeoHeadBlock(resolved);
  out = out.replace(/<\/title>/i, `</title>${seoBlock}`);

  if (!resolved.noIndex) {
    const ssrContent = resolved.blogSsr
      ?? resolveMarketingSsrContent(resolved.pageKey, resolved.rest, resolved.lang);
    if (ssrContent) {
      out = injectMarketingSsrIntoHtml(out, ssrContent);
    }
  }

  if (isIndexableVinRest(resolved.rest)) {
    const vinSsrContent = resolveVinSsrContent(resolved.rest, resolved.lang);
    if (vinSsrContent) {
      out = injectVinSsrIntoHtml(out, vinSsrContent);
    }
  }

  return out;
}

/** Indexable marketing routes only — no sign-in/checkout/dashboard shells. */
export function getPrerenderPaths() {
  return INDEXABLE_PRERENDER_PATHS;
}

export { seoData, b2bSeoData };
