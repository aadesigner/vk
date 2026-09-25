/** Prefetch lazy page chunks on nav hover so route changes feel instant. */

import { prefetchVinPublicPageChunk, prefetchVinResultPageChunk } from "@/lib/prefetch-vin-report";

const ROUTE_LOADERS: Record<string, () => Promise<unknown>> = {
  pricing: () => import("@/pages/pricing"),
  "how-it-works": () => import("@/pages/how-it-works"),
  faq: () => import("@/pages/faq"),
  dashboard: () => import("@/pages/dashboard"),
  purchases: () => import("@/pages/purchases"),
  adminx: () => Promise.all([
    import("@/pages/admin/analytics"),
    import("@/pages/admin/users"),
    import("@/pages/admin/lookups"),
  ]).catch(() => {}),
  checkout: () => import("@/pages/checkout"),
  "free-vin-decoder": () => import("@/pages/free-vin-decoder"),
  terms: () => import("@/pages/terms"),
  privacy: () => import("@/pages/privacy"),
  usa: () => import("@/pages/country"),
  korea: () => import("@/pages/country"),
  canada: () => import("@/pages/country"),
  china: () => import("@/pages/country"),
  uae: () => import("@/pages/country"),
  "sign-in": () => import("@/pages/auth"),
  "sign-up": () => import("@/pages/auth"),
};

const prefetched = new Set<string>();

export function prefetchRoute(segment: string, options?: { isSignedIn?: boolean }): void {
  const key = segment.toLowerCase();
  if (key === "vin") {
    if (options?.isSignedIn) {
      prefetchVinResultPageChunk();
    } else {
      prefetchVinPublicPageChunk();
    }
    return;
  }
  const load = ROUTE_LOADERS[key];
  if (!load || prefetched.has(key)) return;
  prefetched.add(key);
  void load();
}

export function prefetchRouteFromHref(href: string, options?: { isSignedIn?: boolean }): void {
  const parts = href.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  if (last) prefetchRoute(last, options);
  if (parts.includes("cars")) {
    const country = parts[parts.indexOf("cars") + 1];
    if (country) prefetchRoute(country, options);
  }
  if (parts.includes("vin")) {
    prefetchRoute("vin", options);
  }
}

export function prefetchCommonRoutes(): void {
  ["pricing", "how-it-works", "faq"].forEach((r) => prefetchRoute(r));
}

/** Warm the shared country page chunk (all /cars/:country routes). */
export function prefetchCountryPages(): void {
  ["usa", "korea", "canada", "china", "japan", "uae"].forEach((r) => prefetchRoute(r));
}

/** Signed-in client area — warm chunks during idle time. */
export function prefetchAuthAreaRoutes(): void {
  ["dashboard", "purchases", "checkout"].forEach((r) => prefetchRoute(r, { isSignedIn: true }));
  prefetchRoute("vin", { isSignedIn: true });
}
