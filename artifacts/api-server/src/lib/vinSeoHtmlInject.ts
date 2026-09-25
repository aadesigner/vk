import type { VinPageSeo, VinSeoLang, VinSeoVehicle } from "@workspace/vin-page-seo";
import {
  VIN_SEO_LANGS,
  buildVinOnlyPageDescription,
  buildVinOnlyPageTitle,
  buildVinPageSeo,
  injectVinSsrIntoHtml,
  normalizeVin,
  resolveVinSsrBodyContent,
} from "@workspace/vin-page-seo";

const OG_LOCALE_MAP: Record<VinSeoLang, string> = {
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

const HREFLANG_MAP: Record<VinSeoLang, string> = {
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

const SEO_LANGS: readonly VinSeoLang[] = VIN_SEO_LANGS;

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
    .replace(/\n?\s*<script id="verifykm-json-ld"[^>]*>[\s\S]*?<\/script>/g, "")
    .replace(/\n?\s*<style id="verifykm-vin-ssr-style"[^>]*>[\s\S]*?<\/style>/g, "")
    .replace(/\n?\s*<main id="verifykm-vin-ssr"[\s\S]*?<\/main>/g, "");
}

function buildSeoHeadBlock(seo: VinPageSeo, lang: VinSeoLang, origin: string): string {
  const canonicalUrl = `${origin.replace(/\/$/, "")}${seo.canonicalPath}`;
  const rest = seo.canonicalPath.replace(/^\/(en|es|uk|ru|ro|pl|ka|ar|sq|de|fr|bg|zh)/, "");
  const robots = seo.noIndex ? "noindex, follow" : "index, follow";
  const lines = [
    `<meta name="description" content="${escapeHtml(seo.description)}" />`,
    `<meta name="robots" content="${robots}" />`,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:title" content="${escapeHtml(seo.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(seo.description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:locale" content="${OG_LOCALE_MAP[lang]}" />`,
    `<meta property="og:site_name" content="verifykm.com" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(seo.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(seo.description)}" />`,
  ];

  if (seo.ogImage) {
    lines.push(`<meta property="og:image" content="${escapeHtml(seo.ogImage)}" />`);
    lines.push(`<meta name="twitter:image" content="${escapeHtml(seo.ogImage)}" />`);
    if (seo.ogImage.startsWith("https://")) {
      lines.push(`<meta property="og:image:secure_url" content="${escapeHtml(seo.ogImage)}" />`);
    }
    if (seo.ogImageAlt) {
      lines.push(`<meta property="og:image:alt" content="${escapeHtml(seo.ogImageAlt)}" />`);
    }
  }

  if (!seo.noIndex) {
    for (const l of SEO_LANGS) {
      const href = `${origin.replace(/\/$/, "")}/${l}${rest}`;
      lines.push(`<link rel="alternate" hreflang="${HREFLANG_MAP[l]}" href="${escapeHtml(href)}" />`);
    }
    lines.push(
      `<link rel="alternate" hreflang="x-default" href="${escapeHtml(`${origin.replace(/\/$/, "")}/en${rest}`)}" />`,
    );
    for (const l of SEO_LANGS) {
      if (l === lang) continue;
      lines.push(`<meta property="og:locale:alternate" content="${OG_LOCALE_MAP[l]}" />`);
    }
  }

  if (!seo.noIndex && seo.jsonLd.length > 0) {
    lines.push(
      `<script id="verifykm-json-ld" type="application/ld+json">${JSON.stringify(seo.jsonLd)}</script>`,
    );
  }

  return `\n    ${lines.join("\n    ")}\n`;
}

export function injectVinPageSeoIntoHtml(
  html: string,
  seo: VinPageSeo,
  lang: VinSeoLang,
  origin: string,
  vehicle?: VinSeoVehicle | null,
  findingsSummary?: string | null,
): string {
  const dir = lang === "ar" ? "rtl" : "ltr";
  let out = removeGeneratedSeoTags(html);

  out = out.replace(/<html([^>]*)>/i, (_match, attrs) => {
    const cleaned = String(attrs)
      .replace(/\s*lang="[^"]*"/gi, "")
      .replace(/\s*dir="[^"]*"/gi, "");
    return `<html${cleaned} lang="${lang}" dir="${dir}">`;
  });

  out = out.replace(
    /<title>[^<]*<\/title>/i,
    `<title>${escapeHtml(seo.title)}</title>`,
  );

  const seoBlock = buildSeoHeadBlock(seo, lang, origin);
  out = out.replace(/<\/title>/i, `</title>${seoBlock}`);

  if (!seo.noIndex) {
    const vin = normalizeVin(vehicle?.vin ?? seo.canonicalPath.split("/").pop() ?? "");
    const ssrContent = vehicle
      ? resolveVinSsrBodyContent(lang, { ...vehicle, vin }, { findingsSummary })
      : null;
    if (ssrContent) {
      out = injectVinSsrIntoHtml(out, ssrContent);
    }
  }

  return out;
}

export function buildVinOnlyFallbackSeo(lang: VinSeoLang, vin: string, origin: string): VinPageSeo {
  const normalized = normalizeVin(vin);
  return {
    ...buildVinPageSeo(lang, { vin: normalized }, origin),
    noIndex: true,
    jsonLd: [],
    ogImage: undefined,
    ogImageAlt: undefined,
  };
}

export function buildVinOnlyFallbackSeoLegacy(lang: VinSeoLang, vin: string): { title: string; description: string } {
  const normalized = normalizeVin(vin);
  return {
    title: buildVinOnlyPageTitle(lang, normalized),
    description: buildVinOnlyPageDescription(lang, normalized),
  };
}
