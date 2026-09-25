/** Normalize client router paths so wouter route patterns match reliably. */
export function normalizeAppPath(pathname: string): string {
  if (!pathname) return "/";

  let path = pathname.replace(/\/{2,}/g, "/");
  if (path.length > 1 && path.endsWith("/")) {
    path = path.replace(/\/+$/, "");
  }
  return path || "/";
}

export function splitRouterLocation(location: string): { pathname: string; suffix: string } {
  const pathname = location.split(/[?#]/)[0] ?? location;
  const suffix = location.slice(pathname.length);
  return { pathname, suffix };
}

/**
 * Target for trailing-slash / slash-collapse redirects.
 * Wouter's `useLocation()` omits `?query`, so AppRouter must pass search/hash
 * explicitly — otherwise referral `?vin=` / UTMs are wiped on `/checkout/` → `/checkout`.
 */
export function pathNormalizeRedirectTarget(
  normalizedPathname: string,
  search: string = "",
  hash: string = "",
): string {
  const qs = !search ? "" : search.startsWith("?") ? search : `?${search}`;
  const fragment = !hash ? "" : hash.startsWith("#") ? hash : `#${hash}`;
  return `${normalizedPathname}${qs}${fragment}`;
}
