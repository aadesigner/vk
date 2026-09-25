export type CountryFaviconSlug = "usa" | "korea" | "canada" | "china" | "japan" | "uae";

export interface FaviconSet {
  icon16: string;
  icon32: string;
  apple: string;
}

const PAGE_KEY_TO_SLUG: Record<string, CountryFaviconSlug> = {
  country_usa: "usa",
  country_korea: "korea",
  country_canada: "canada",
  country_china: "china",
  country_japan: "japan",
  country_uae: "uae",
};

export const DEFAULT_FAVICONS: FaviconSet = {
  icon16: "/favicon-16x16.png",
  icon32: "/favicon-32x32.png",
  apple: "/apple-touch-icon.png",
};

export function faviconsForSlug(slug: CountryFaviconSlug, basePath = ""): FaviconSet {
  const base = basePath.replace(/\/$/, "");
  return {
    icon16: `${base}/favicon-${slug}-16x16.png`,
    icon32: `${base}/favicon-${slug}-32x32.png`,
    apple: `${base}/apple-touch-icon-${slug}.png`,
  };
}

export function faviconsForPageKey(pageKey: string, basePath = ""): FaviconSet | undefined {
  const slug = PAGE_KEY_TO_SLUG[pageKey];
  return slug ? faviconsForSlug(slug, basePath) : undefined;
}

export function resolveFavicons(pageKey: string | undefined, basePath = ""): FaviconSet {
  const base = basePath.replace(/\/$/, "");
  const country = pageKey ? faviconsForPageKey(pageKey, basePath) : undefined;
  if (country) return country;
  return {
    icon16: `${base}${DEFAULT_FAVICONS.icon16}`,
    icon32: `${base}${DEFAULT_FAVICONS.icon32}`,
    apple: `${base}${DEFAULT_FAVICONS.apple}`,
  };
}
