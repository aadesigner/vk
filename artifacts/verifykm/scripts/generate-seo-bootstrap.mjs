/**
 * Generates public/seo-bootstrap.js — synchronous SEO on first paint + SPA navigations.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  SEO_LANGS,
  PATH_TO_SEO_KEY,
  OG_LOCALE_MAP,
  HREFLANG_MAP,
  seoData,
  b2bSeoData,
} from "./seo-inject.mjs";
import { LANG_PATH_ALT } from "./languages.mjs";
import { SEO_OG_PAGES } from "./seo-og-config.mjs";
import { vinSeoBootstrapSnippet } from "./vin-seo-templates.mjs";
import {
  faviconAssetsForPageKey,
  DEFAULT_FAVICONS,
  COUNTRY_PAGE_FAVICON_SLUGS,
} from "./country-favicon-config.mjs";

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, "..");
const blogSeo = JSON.parse(readFileSync(join(dir, "blog-seo.json"), "utf8"));
const blogBootstrap = {
  indexSlug: blogSeo.indexSlug,
  index: blogSeo.index,
  bySlug: blogSeo.slugToId,
  posts: Object.fromEntries(
    blogSeo.articles.map((article) => [
      article.id,
      { slug: article.slug, title: article.title, description: article.description },
    ]),
  ),
};
const basePath = (process.env.BASE_PATH ?? "/").replace(/\/$/, "");

const NOINDEX = [
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
];

const NOINDEX_PREFIXES = ["/adminx", "/dashboard"];

const countryPageFavicons = Object.fromEntries(
  Object.keys(COUNTRY_PAGE_FAVICON_SLUGS).map((pageKey) => [
    pageKey,
    faviconAssetsForPageKey(pageKey),
  ]),
);

const js = `/* auto-generated — do not edit */
(function () {
  var SEO = ${JSON.stringify(seoData)};
  var B2B_SEO = ${JSON.stringify(b2bSeoData)};
  var PATH_MAP = ${JSON.stringify(PATH_TO_SEO_KEY)};
  var OG_LOCALE = ${JSON.stringify(OG_LOCALE_MAP)};
  var SEO_LANGS = ${JSON.stringify(SEO_LANGS)};
  var HREFLANG = ${JSON.stringify(HREFLANG_MAP)};
  var NOINDEX = ${JSON.stringify(NOINDEX)};
  var NOINDEX_PREFIXES = ${JSON.stringify(NOINDEX_PREFIXES)};
  var VALID_COUNTRY_SLUGS = ${JSON.stringify(["usa", "korea", "canada", "china", "japan", "uae"])};
  var BASE = ${JSON.stringify(basePath)};
  var DEFAULT_FAVICONS = ${JSON.stringify(DEFAULT_FAVICONS)};
  var COUNTRY_PAGE_FAVICONS = ${JSON.stringify(countryPageFavicons)};
  var VIN_INDEX_RE = /^\\/vin\\/([A-HJ-NPR-Z0-9]{17})$/i;
  var BLOG = ${JSON.stringify(blogBootstrap)};

  function blogFromRest(lang, rest) {
    var parts = String(rest || "").split("/").filter(Boolean);
    if (!parts.length || parts[0] !== BLOG.indexSlug[lang]) return null;
    if (parts.length === 1) {
      var index = BLOG.index[lang] || BLOG.index.en;
      return { title: index.title, description: index.description, image: "/seo/og/blog-" + lang + ".webp", canonicalRest: "/blog" };
    }
    var id = BLOG.bySlug[parts[1]];
    var post = id && BLOG.posts[id];
    if (!post) return null;
    var title = post.title[lang] || post.title.en;
    return {
      id: id,
      title: title + " | VerifyKM",
      description: post.description[lang] || post.description.en,
      image: "/seo/og/blog_" + id + "-" + lang + ".webp",
      canonicalRest: "/blog/" + id
    };
  }

  function blogPath(lang, canonicalRest) {
    var index = BLOG.indexSlug[lang] || "blog";
    if (!canonicalRest || canonicalRest === "/blog") return "/" + lang + "/" + index;
    var id = canonicalRest.replace("/blog/", "");
    var post = BLOG.posts[id];
    var slug = post && (post.slug[lang] || post.slug.en);
    return slug ? "/" + lang + "/" + index + "/" + slug : "/" + lang + canonicalRest;
  }

  function applyBlogSeo(lang, rest) {
    var blogHit = blogFromRest(lang, rest);
    if (!blogHit) return false;
    var origin = location.origin;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.title = blogHit.title;
    upsertMeta("description", blogHit.description);
    upsertMeta("robots", "index, follow");
    upsertMeta("og:title", blogHit.title, "property");
    upsertMeta("og:description", blogHit.description, "property");
    upsertMeta("og:type", blogHit.id ? "article" : "website", "property");
    upsertMeta("og:locale", OG_LOCALE[lang] || OG_LOCALE.en, "property");
    upsertMeta("og:site_name", "verifykm.com", "property");
    upsertMeta("twitter:card", "summary_large_image");
    upsertMeta("twitter:title", blogHit.title);
    upsertMeta("twitter:description", blogHit.description);
    removeOgImages();
    var blogImg = origin + blogHit.image;
    upsertMeta("og:image", blogImg, "property");
    upsertMeta("twitter:image", blogImg);
    if (blogImg.indexOf("https://") === 0) upsertMeta("og:image:secure_url", blogImg, "property");
    upsertMeta("og:image:alt", blogHit.title, "property");
    var canonical = origin + blogPath(lang, blogHit.canonicalRest);
    upsertLink("canonical", canonical);
    upsertMeta("og:url", canonical, "property");
    removeAlternates();
    SEO_LANGS.forEach(function (l) {
      upsertLink("alternate", origin + blogPath(l, blogHit.canonicalRest), { hreflang: HREFLANG[l] });
    });
    upsertLink("alternate", origin + blogPath("en", blogHit.canonicalRest), { hreflang: "x-default" });
    SEO_LANGS.forEach(function (l) {
      if (l !== lang) upsertMeta("og:locale:alternate", OG_LOCALE[l], "property");
    });
    applyFavicons("home");
    return true;
  }

  ${vinSeoBootstrapSnippet()}

  function resolvePageKey(rest) {
    if (PATH_MAP[rest]) return PATH_MAP[rest];
    if (rest === "/api-b2b" || rest.indexOf("/api-b2b/") === 0) return "api_b2b";
    if (rest.indexOf("/cars/") === 0) {
      var parts = rest.split("/").filter(Boolean);
      var slug = parts[1] ? parts[1].toLowerCase() : "";
      if (VALID_COUNTRY_SLUGS.indexOf(slug) !== -1) {
        if (slug === "korea") return "country_korea";
        if (slug === "canada") return "country_canada";
        if (slug === "china") return "country_china";
        if (slug === "japan") return "country_japan";
        if (slug === "uae") return "country_uae";
        return "country_usa";
      }
      return "not_found";
    }
    if (rest.indexOf("/vin/") === 0) return "vin_result";
    return "not_found";
  }

  function isNoIndexPath(rest, pageKey) {
    if (pageKey === "not_found") return true;
    if (rest.indexOf("/api-b2b/") === 0) return true;
    if (pageKey === "api_b2b") return false;
    // VIN URLs: safe default noindex (server/React set index only when catalog report exists).
    if (VIN_INDEX_RE.test(rest)) return true;
    if (NOINDEX.indexOf(rest) !== -1) return true;
    for (var i = 0; i < NOINDEX_PREFIXES.length; i++) {
      var p = NOINDEX_PREFIXES[i];
      if (rest === p || rest.indexOf(p + "/") === 0) return true;
    }
    if (rest === "/vin/processing" || rest.indexOf("/vin/processing/") === 0) return true;
    return rest.indexOf("/vin/") === 0;
  }

  function resolveB2bSeo(rest, lang) {
    var page = B2B_SEO[rest];
    if (!page) return null;
    return page[lang] || page.en || null;
  }

  function stripBase(pathname) {
    if (!BASE) return pathname;
    if (pathname === BASE) return "/";
    if (pathname.indexOf(BASE + "/") === 0) return pathname.slice(BASE.length) || "/";
    return pathname;
  }

  function upsertMeta(key, content, attr) {
    attr = attr || "name";
    var el = document.querySelector("meta[" + attr + '="' + key + '"]');
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  }

  function upsertLink(rel, href, extra) {
    if (!href || !String(href).trim()) return;
    var sel = 'link[rel="' + rel + '"]';
    if (extra) {
      for (var k in extra) sel += '[' + k + '="' + extra[k] + '"]';
    }
    var el = document.querySelector(sel);
    if (!el) {
      el = document.createElement("link");
      el.rel = rel;
      if (extra) for (var k2 in extra) el.setAttribute(k2, extra[k2]);
      document.head.appendChild(el);
    }
    el.href = href;
  }

  function removeAlternates() {
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(function (el) {
      el.remove();
    });
    document.querySelectorAll('meta[property="og:locale:alternate"]').forEach(function (el) {
      el.remove();
    });
  }

  function resolveFavicons(pageKey) {
    var assets = COUNTRY_PAGE_FAVICONS[pageKey] || DEFAULT_FAVICONS;
    var base = BASE.replace(/\\/$/, "");
    return {
      icon16: base + assets.icon16,
      icon32: base + assets.icon32,
      apple: base + assets.apple,
    };
  }

  function removeOgImages() {
    document.querySelectorAll('meta[property="og:image"]').forEach(function (el) { el.remove(); });
    document.querySelectorAll('meta[property="og:image:secure_url"]').forEach(function (el) { el.remove(); });
    document.querySelectorAll('meta[property="og:image:alt"]').forEach(function (el) { el.remove(); });
    document.querySelectorAll('meta[name="twitter:image"]').forEach(function (el) { el.remove(); });
  }

  function resolveOgImage(pageKey, lang) {
    if (!OG_PAGE_KEYS[pageKey]) return null;
    var base = BASE.replace(/\\/$/, "");
    return base + "/seo/og/" + pageKey + "-" + lang + ".webp";
  }

  var OG_PAGE_KEYS = ${JSON.stringify(Object.fromEntries(
    SEO_OG_PAGES.map((p) => [p.pageKey, true]),
  ))};

  function applyFavicons(pageKey) {
    var favicons = resolveFavicons(pageKey);
    upsertLink("icon", favicons.icon32, { type: "image/png", sizes: "32x32" });
    upsertLink("icon", favicons.icon16, { type: "image/png", sizes: "16x16" });
    upsertLink("apple-touch-icon", favicons.apple, { sizes: "180x180" });
  }

  function applySeoFromUrl() {
    var ORIGIN = location.origin;
    var pathname = stripBase(location.pathname);
    var m = pathname.match(/^\\/(${LANG_PATH_ALT})(\\/.*)?$/);
    var lang = m ? m[1] : "en";
    var rest = m && m[2] ? m[2].replace(/\\/$/, "") : "";
    if (applyBlogSeo(lang, rest)) return;
    // Server-side VIN SEO inject owns robots/index for /vin/{17}. Do not overwrite
    // catalog pages with thin fallbacks (or vice versa) in the browser bootstrap.
    if (VIN_INDEX_RE.test(rest)) return;
    var pageKey = resolvePageKey(rest);
    var b2b = resolveB2bSeo(rest, lang);
    var page = SEO[pageKey] || SEO.not_found || SEO.home;
    var seo = b2b || (page && page[lang]) || (page && page.en) || SEO.home.en;
    var noIndex = isNoIndexPath(rest, pageKey);

    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.title = seo.title;
    upsertMeta("description", seo.description);
    upsertMeta("robots", noIndex ? "noindex, nofollow" : "index, follow");
    upsertMeta("og:title", seo.title, "property");
    upsertMeta("og:description", seo.description, "property");
    upsertMeta("og:type", "website", "property");
    upsertMeta("og:locale", OG_LOCALE[lang] || OG_LOCALE.en, "property");
    upsertMeta("og:site_name", "verifykm.com", "property");
    upsertMeta("twitter:card", "summary_large_image");
    upsertMeta("twitter:title", seo.title);
    upsertMeta("twitter:description", seo.description);

    removeOgImages();
    var ogImageRel = resolveOgImage(pageKey === "api_b2b" ? "home" : pageKey, lang);
    if (ogImageRel) {
      var absoluteOg = ORIGIN + ogImageRel;
      upsertMeta("og:image", absoluteOg, "property");
      upsertMeta("twitter:image", absoluteOg);
      if (absoluteOg.indexOf("https://") === 0) {
        upsertMeta("og:image:secure_url", absoluteOg, "property");
      }
      upsertMeta("og:image:alt", seo.title, "property");
    }

    var canonical = ORIGIN + (rest ? "/" + lang + rest : "/" + lang);
    upsertLink("canonical", canonical);
    upsertMeta("og:url", canonical, "property");

    removeAlternates();
    if (!noIndex) {
      SEO_LANGS.forEach(function (l) {
        var href = ORIGIN + (rest ? "/" + l + rest : "/" + l);
        upsertLink("alternate", href, { hreflang: HREFLANG[l] });
      });
      upsertLink("alternate", ORIGIN + (rest ? "/en" + rest : "/en"), { hreflang: "x-default" });
      SEO_LANGS.forEach(function (l) {
        if (l !== lang) upsertMeta("og:locale:alternate", OG_LOCALE[l], "property");
      });
    }

    applyFavicons(pageKey === "api_b2b" ? "home" : pageKey);
  }

  applySeoFromUrl();

  window.addEventListener("popstate", applySeoFromUrl);
  var pushState = history.pushState;
  var replaceState = history.replaceState;
  history.pushState = function () {
    pushState.apply(history, arguments);
    applySeoFromUrl();
  };
  history.replaceState = function () {
    replaceState.apply(history, arguments);
    applySeoFromUrl();
  };
})();
`;

writeFileSync(join(root, "public", "seo-bootstrap.js"), js, "utf8");
console.log("Wrote public/seo-bootstrap.js");
