/**
 * Prefixed deep-link geo swaps are intentionally disabled.
 * First-time geo runs only for `/` and unprefixed paths (e.g. /cars/usa) via App.tsx.
 * Landing on /en/cars-in-korea (Google, typed URL) never swaps language.
 */
export function GeoLanguageRedirect() {
  return null;
}
