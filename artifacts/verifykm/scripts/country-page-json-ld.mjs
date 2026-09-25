/**
 * WebPage + Service JSON-LD for country landing pages (USA / Korea / Canada).
 * Used by prerender (seo-inject) and the client bundle (via Vite import).
 */

const COUNTRY_PAGE_KEYS = new Set(["country_usa", "country_korea", "country_canada", "country_china", "country_japan", "country_uae"]);

const AREA_SERVED = {
  country_usa: "United States",
  country_korea: "South Korea",
  country_canada: "Canada",
  country_china: "China",
  country_japan: "Japan",
  country_uae: "United Arab Emirates",
};

/** @param {string} lang BCP 47 tag, e.g. en, sq-AL, uk-UA */
export function buildCountryPageJsonLd({
  pageKey,
  title,
  description,
  canonicalUrl,
  lang,
  ogImage,
}) {
  if (!COUNTRY_PAGE_KEYS.has(pageKey)) return undefined;

  const areaServed = AREA_SERVED[pageKey];
  const webpageId = `${canonicalUrl}#webpage`;
  const serviceId = `${canonicalUrl}#service`;

  const webpage = {
    "@type": "WebPage",
    "@id": webpageId,
    url: canonicalUrl,
    name: title.replace(/\s*\|\s*verifykm\.com\s*$/i, "").trim(),
    description,
    inLanguage: lang,
    isPartOf: {
      "@type": "WebSite",
      "@id": "https://verifykm.com/#website",
      name: "verifykm.com",
      url: "https://verifykm.com",
    },
  };

  if (ogImage) {
    webpage.primaryImageOfPage = { "@type": "ImageObject", url: ogImage };
  }

  const service = {
    "@type": "Service",
    "@id": serviceId,
    name: title.replace(/\s*\|\s*verifykm\.com\s*$/i, "").trim(),
    description,
    url: canonicalUrl,
    provider: {
      "@type": "Organization",
      name: "verifykm.com",
      url: "https://verifykm.com",
    },
    areaServed: { "@type": "Country", name: areaServed },
    serviceType: "Vehicle history report",
  };

  return {
    "@context": "https://schema.org",
    "@graph": [webpage, service],
  };
}

export function isCountrySeoPageKey(pageKey) {
  return COUNTRY_PAGE_KEYS.has(pageKey);
}

/** Organization schema for the homepage (prerender + optional client reuse). */
export function buildHomeOrganizationJsonLd(origin, description) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "verifykm.com",
    url: origin,
    logo: `${origin}/apple-touch-icon.png`,
    description,
  };
}
