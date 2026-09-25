import { useLayoutEffect, useMemo } from "react";
import { useLocation } from "wouter";
import {
  SITE_ORIGIN,
  SEO_LANGS,
  HREFLANG_MAP,
  OG_LOCALE_MAP,
  stripLangPrefix,
  buildLocalizedPath,
  type SeoLang,
} from "@/lib/seo-config";
import { resolveAbsoluteAssetUrl } from "@workspace/vin-page-seo";
import {
  SEO_DATA,
  getRouteSeo,
  type SeoPageKey,
} from "@/lib/seo-pages";
import { resolveFavicons, type FaviconSet } from "@/lib/country-favicons";
import { toCanonicalRest } from "@/lib/localized-routes";

export { SEO_DATA };
export type { SeoPageKey };

const appBasePath = () => import.meta.env.BASE_URL.replace(/\/$/, "") || "";

interface SEOProps {
  title: string;
  description: string;
  lang: SeoLang;
  canonicalPath?: string;
  noIndex?: boolean;
  ogImage?: string;
  ogImageAlt?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  favicons?: FaviconSet;
  keywords?: string;
}

function upsertMeta(key: string, content: string, attr = "name") {
  let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertLink(rel: string, href: string, extra?: Record<string, string>) {
  if (!href?.trim()) return;
  const extraStr = extra ? Object.entries(extra).map(([k, v]) => `[${k}="${v}"]`).join("") : "";
  const selector = `link[rel="${rel}"]${extraStr}`;
  let el = document.querySelector(selector) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    if (extra) Object.entries(extra).forEach(([k, v]) => el!.setAttribute(k, v));
    document.head.appendChild(el);
  }
  el.href = href;
}

function removeAlternates() {
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
  document.querySelectorAll('meta[property="og:locale:alternate"]').forEach((el) => el.remove());
}

export function applyFavicons(favicons: FaviconSet) {
  const type = favicons.icon32.endsWith(".jpg") ? "image/jpeg" : "image/png";
  upsertLink("icon", favicons.icon32, { type });
  upsertLink("apple-touch-icon", favicons.apple);
}

function upsertJsonLd(data: Record<string, unknown> | Record<string, unknown>[] | undefined) {
  const id = "verifykm-json-ld";
  document.getElementById(id)?.remove();
  if (!data) return;
  const script = document.createElement("script");
  script.id = id;
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(Array.isArray(data) ? data : data);
  document.head.appendChild(script);
}

export function applySeoHead({
  title,
  description,
  lang,
  canonicalPath,
  noIndex,
  ogImage,
  ogImageAlt,
  jsonLd,
  favicons,
  keywords,
}: SEOProps) {
  document.title = title;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";

  upsertMeta("description", description);
  upsertMeta("robots", noIndex ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1");
  if (keywords?.trim()) {
    upsertMeta("keywords", keywords);
  } else {
    document.querySelector('meta[name="keywords"]')?.remove();
  }

  upsertMeta("og:title", title, "property");
  upsertMeta("og:description", description, "property");
  upsertMeta("og:type", "website", "property");
  upsertMeta("og:locale", OG_LOCALE_MAP[lang], "property");
  upsertMeta("og:site_name", "verifykm.com", "property");

  upsertMeta("twitter:card", "summary_large_image");
  upsertMeta("twitter:title", title);
  upsertMeta("twitter:description", description);

  const origin = typeof window !== "undefined" ? window.location.origin : SITE_ORIGIN;
  const absoluteOgImage = resolveAbsoluteAssetUrl(origin, ogImage);
  if (absoluteOgImage) {
    upsertMeta("og:image", absoluteOgImage, "property");
    upsertMeta("twitter:image", absoluteOgImage);
    if (absoluteOgImage.startsWith("https://")) {
      upsertMeta("og:image:secure_url", absoluteOgImage, "property");
    }
    if (ogImageAlt) {
      upsertMeta("og:image:alt", ogImageAlt, "property");
    }
  } else {
    document.querySelector('meta[property="og:image"]')?.remove();
    document.querySelector('meta[name="twitter:image"]')?.remove();
    document.querySelector('meta[property="og:image:secure_url"]')?.remove();
    document.querySelector('meta[property="og:image:alt"]')?.remove();
  }

  const path = canonicalPath ?? (typeof window !== "undefined" ? window.location.pathname : `/${lang}`);
  const canonical = `${origin}${path}`;
  upsertLink("canonical", canonical);
  upsertMeta("og:url", canonical, "property");

  removeAlternates();
  if (!noIndex) {
    // path is localized (e.g. /es/precios) — normalize to English canonical for hreflang pairs
    const localizedRest = stripLangPrefix(path);
    const base = toCanonicalRest(localizedRest, lang);
    SEO_LANGS.forEach((l) => {
      upsertLink("alternate", `${origin}${buildLocalizedPath(l, base)}`, {
        hreflang: HREFLANG_MAP[l],
      });
    });
    upsertLink("alternate", `${origin}${buildLocalizedPath("en", base)}`, { hreflang: "x-default" });

    SEO_LANGS.filter((l) => l !== lang).forEach((l) => {
      upsertMeta("og:locale:alternate", OG_LOCALE_MAP[l], "property");
    });
  }

  upsertJsonLd(jsonLd);
  applyFavicons(favicons ?? resolveFavicons(undefined, appBasePath()));
}

/** SEO meta always derived from the URL — never from UI language state. */
export function usePageSeo(pageKeyOverride?: SeoPageKey) {
  const [location] = useLocation();
  return useMemo(
    () => getRouteSeo(location, appBasePath(), pageKeyOverride),
    [location, pageKeyOverride],
  );
}

export function SEOHead({ title, description, lang, canonicalPath, noIndex, ogImage, ogImageAlt, jsonLd, favicons, keywords }: SEOProps) {
  useLayoutEffect(() => {
    applySeoHead({ title, description, lang, canonicalPath, noIndex, ogImage, ogImageAlt, jsonLd, favicons, keywords });
    return () => {
      document.getElementById("verifykm-json-ld")?.remove();
    };
  }, [title, description, lang, canonicalPath, noIndex, ogImage, ogImageAlt, jsonLd == null ? null : JSON.stringify(jsonLd), favicons?.icon16, favicons?.icon32, favicons?.apple, keywords]);

  return null;
}

/** Sets localized SEO from the URL on every route change (before lazy pages load). */
export function RouteSEO() {
  const [location] = useLocation();

  useLayoutEffect(() => {
    const seo = getRouteSeo(location, appBasePath());
    applySeoHead(seo);
  }, [location]);

  return null;
}

export type LangCode = SeoLang;

export function organizationJsonLd(origin: string, description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "verifykm.com",
    url: origin,
    logo: `${origin}/apple-touch-icon.png`,
    description,
  };
}

export function faqPageJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

export function productOfferJsonLd(params: {
  name: string;
  description: string;
  url: string;
  price: number;
  currency: string;
}) {
  const validUntil = new Date();
  validUntil.setFullYear(validUntil.getFullYear() + 1);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: params.name,
    description: params.description,
    url: params.url,
    brand: { "@type": "Brand", name: "verifykm.com" },
    offers: {
      "@type": "Offer",
      url: params.url,
      priceCurrency: params.currency,
      price: params.price.toFixed(2),
      availability: "https://schema.org/OnlineOnly",
      priceValidUntil: validUntil.toISOString().split("T")[0],
    },
  };
}
