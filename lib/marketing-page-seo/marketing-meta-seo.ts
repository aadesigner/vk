import seoData from "./marketing-seo-data.json" with { type: "json" };
import b2bSeoData from "./marketing-b2b-seo-data.json" with { type: "json" };

const LANG_PATH_ALT = "en|de|es|fr|sq|pl|ro|bg|ka|ar|uk|ru|zh";
const LANG_PATH_RE = new RegExp(`^/(${LANG_PATH_ALT})(/.*)?$`);

const SEO_LANGS = ["en", "de", "es", "fr", "sq", "pl", "ro", "bg", "ka", "ar", "uk", "ru", "zh"] as const;

const HREFLANG_MAP: Record<string, string> = {
  en: "en",
  de: "de",
  es: "es",
  fr: "fr",
  sq: "sq-AL",
  pl: "pl",
  ro: "ro",
  bg: "bg",
  ka: "ka",
  ar: "ar",
  uk: "uk-UA",
  ru: "ru",
  zh: "zh-Hans",
};

const OG_LOCALE_MAP: Record<string, string> = {
  en: "en_US",
  de: "de_DE",
  es: "es_ES",
  fr: "fr_FR",
  sq: "sq_AL",
  pl: "pl_PL",
  ro: "ro_RO",
  bg: "bg_BG",
  ka: "ka_GE",
  ar: "ar_SA",
  uk: "uk_UA",
  ru: "ru_RU",
  zh: "zh_CN",
};

const PATH_TO_PAGE_KEY: Record<string, string> = {
  "": "home",
  "/pricing": "pricing",
  "/free-vin-decoder": "free_decoder",
  "/how-it-works": "how_it_works",
  "/faq": "faq",
  "/cars/usa": "country_usa",
  "/cars/korea": "country_korea",
  "/cars/canada": "country_canada",
  "/cars/china": "country_china",
  "/cars/japan": "country_japan",
  "/cars/uae": "country_uae",
};

const OG_PAGE_KEYS = new Set([
  "home",
  "country_usa",
  "country_korea",
  "country_canada",
  "country_china",
  "country_japan",
  "country_uae",
]);

const VALID_COUNTRY_SLUGS = new Set(["usa", "korea", "canada", "china", "japan", "uae"]);

type SeoEntry = { title: string; description: string };

export type MarketingMetaSeo = {
  lang: string;
  dir: "ltr" | "rtl";
  title: string;
  description: string;
  pageKey: string;
  rest: string;
  noIndex: boolean;
  canonicalPath: string;
  canonicalUrl: string;
  ogImage?: string;
  ogImageAlt: string;
};

function resolvePageKey(rest: string): string | null {
  const exact = PATH_TO_PAGE_KEY[rest];
  if (exact) return exact;
  if (rest === "/api-b2b" || rest.startsWith("/api-b2b/")) return "api_b2b";
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
    return null;
  }
  return null;
}

export function parseMarketingPath(reqPath: string): { pageKey: string; rest: string; lang: string } | null {
  const path = reqPath.replace(/\/$/, "") || "/";
  const m = path.match(LANG_PATH_RE);
  if (!m) return null;
  const lang = m[1] ?? "en";
  const rest = (m[2] ?? "").replace(/\/$/, "") || "";
  const pageKey = resolvePageKey(rest);
  if (!pageKey) return null;
  return { pageKey, rest, lang };
}

function seoOgImagePath(pageKey: string, lang: string): string | undefined {
  if (!OG_PAGE_KEYS.has(pageKey)) return undefined;
  const key = pageKey === "api_b2b" ? "home" : pageKey;
  return `/seo/og/${key}-${lang}.webp`;
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function removeGeneratedSeoTags(html: string): string {
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

function buildHomeOrganizationJsonLd(origin: string, description: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "verifykm.com",
    url: origin,
    logo: `${origin}/apple-touch-icon.png`,
    description,
  };
}

function buildJsonLdScript(resolved: MarketingMetaSeo, origin: string): string {
  if (resolved.noIndex) return "";
  if (resolved.pageKey !== "home") return "";
  const jsonLd = buildHomeOrganizationJsonLd(origin, resolved.description);
  const safeJson = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
  return `\n    <script id="verifykm-json-ld" type="application/ld+json">${safeJson}</script>`;
}

function buildSeoHeadBlock(resolved: MarketingMetaSeo, origin: string): string {
  const { lang, title, description, noIndex, canonicalUrl, rest, ogImage, ogImageAlt } = resolved;
  const lines = [
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta name="robots" content="${noIndex ? "noindex, nofollow" : "index, follow"}" />`,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:locale" content="${OG_LOCALE_MAP[lang] ?? OG_LOCALE_MAP.en}" />`,
    `<meta property="og:site_name" content="verifykm.com" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
  ];

  if (ogImage) {
    const absoluteOgImage = ogImage.startsWith("/") ? `${origin}${ogImage}` : ogImage;
    lines.push(`<meta property="og:image" content="${escapeHtml(absoluteOgImage)}" />`);
    lines.push(`<meta name="twitter:image" content="${escapeHtml(absoluteOgImage)}" />`);
    if (absoluteOgImage.startsWith("https://")) {
      lines.push(`<meta property="og:image:secure_url" content="${escapeHtml(absoluteOgImage)}" />`);
    }
    if (ogImageAlt) {
      lines.push(`<meta property="og:image:alt" content="${escapeHtml(ogImageAlt)}" />`);
    }
  }

  if (!noIndex) {
    for (const l of SEO_LANGS) {
      const href = rest ? `${origin}/${l}${rest}` : `${origin}/${l}`;
      lines.push(`<link rel="alternate" hreflang="${HREFLANG_MAP[l]}" href="${escapeHtml(href)}" />`);
    }
    lines.push(`<link rel="alternate" hreflang="x-default" href="${escapeHtml(rest ? `${origin}/en${rest}` : `${origin}/en`)}" />`);
    for (const l of SEO_LANGS) {
      if (l !== lang) {
        lines.push(`<meta property="og:locale:alternate" content="${OG_LOCALE_MAP[l]}" />`);
      }
    }
  }

  return `\n    ${lines.join("\n    ")}\n${buildJsonLdScript(resolved, origin)}`;
}

export function resolveMarketingMetaSeo(reqPath: string, siteOrigin: string): MarketingMetaSeo | null {
  const parsed = parseMarketingPath(reqPath);
  if (!parsed) return null;

  const { lang, rest, pageKey } = parsed;
  const origin = siteOrigin.replace(/\/$/, "");
  const b2bPage = (b2bSeoData as Record<string, Record<string, SeoEntry>>)[rest] ?? null;
  const b2bSeo = b2bPage ? (b2bPage[lang] ?? b2bPage.en ?? null) : null;
  const page = pageKey === "api_b2b"
    ? null
    : ((seoData as Record<string, Record<string, SeoEntry>>)[pageKey]
      ?? (seoData as Record<string, Record<string, SeoEntry>>).home);
  const seo = b2bSeo
    ?? (page ? (page[lang] ?? page.en) : (seoData as Record<string, Record<string, SeoEntry>>).home.en);
  const ogImage = seoOgImagePath(pageKey === "api_b2b" ? "home" : pageKey, lang);
  const canonicalPath = rest ? `/${lang}${rest}` : `/${lang}`;

  return {
    lang,
    dir: lang === "ar" ? "rtl" : "ltr",
    title: seo.title,
    description: seo.description,
    pageKey,
    rest,
    noIndex: rest.startsWith("/api-b2b/"),
    canonicalPath,
    canonicalUrl: `${origin}${canonicalPath}`,
    ogImage,
    ogImageAlt: seo.title,
  };
}

/** Replace title/meta in HTML for indexable marketing routes (SPA fallback when prerender shell is missing). */
export function injectMarketingMetaSeoIntoHtml(
  html: string,
  reqPath: string,
  siteOrigin: string,
): string {
  const resolved = resolveMarketingMetaSeo(reqPath, siteOrigin);
  if (!resolved) return html;

  let out = removeGeneratedSeoTags(html);
  out = out.replace(/<html([^>]*)>/i, (_match, attrs) => {
    const cleaned = String(attrs)
      .replace(/\s*lang="[^"]*"/gi, "")
      .replace(/\s*dir="[^"]*"/gi, "");
    return `<html${cleaned} lang="${resolved.lang}" dir="${resolved.dir}">`;
  });
  out = out.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(resolved.title)}</title>`);
  const seoBlock = buildSeoHeadBlock(resolved, siteOrigin.replace(/\/$/, ""));
  return out.replace(/<\/title>/i, `</title>${seoBlock}`);
}
