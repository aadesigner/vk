/** Shared country-page favicon paths (usa / korea / canada only). */
export const COUNTRY_PAGE_FAVICON_SLUGS = {
  country_usa: "usa",
  country_korea: "korea",
  country_canada: "canada",
  country_china: "china",
  country_japan: "japan",
  country_uae: "uae",
};

export const DEFAULT_FAVICONS = {
  icon16: "/favicon-16x16.png",
  icon32: "/favicon-32x32.png",
  apple: "/apple-touch-icon.png",
};

export function faviconAssetsForPageKey(pageKey) {
  const slug = COUNTRY_PAGE_FAVICON_SLUGS[pageKey];
  if (!slug) return null;
  return {
    icon16: `/favicon-${slug}-16x16.png`,
    icon32: `/favicon-${slug}-32x32.png`,
    apple: `/apple-touch-icon-${slug}.png`,
  };
}

export function withBasePath(path, basePath = "") {
  const base = basePath.replace(/\/$/, "");
  if (!base) return path;
  return `${base}${path}`;
}
