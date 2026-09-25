import type { Language } from "@/lib/languages";
import { pathFor } from "@/lib/localized-routes";
import { pageSlug } from "@/lib/localized-routes";

export type DashboardView = "reports" | "account" | "help";

export type ClientAreaSection = DashboardView | "purchases" | "offers";

/** Strip trailing slash for stable path comparisons. */
export function normalizeClientPath(path: string): string {
  const trimmed = path.split("?")[0]?.split("#")[0]?.trim() ?? "";
  if (!trimmed || trimmed === "/") return "/";
  return trimmed.replace(/\/+$/, "");
}

export function dashboardPath(lang: string, view: DashboardView = "reports"): string {
  const base = pathFor(lang as Language, "dashboard");
  return view === "reports" ? base : `${base}/${view}`;
}

export function parseDashboardView(location: string, lang: string): DashboardView {
  const path = normalizeClientPath(location);
  const base = pathFor(lang as Language, "dashboard");
  if (path === `${base}/account`) return "account";
  if (path === `${base}/help`) return "help";
  return "reports";
}

export function isDashboardLocation(location: string, lang: string): boolean {
  const path = normalizeClientPath(location);
  const base = pathFor(lang as Language, "dashboard");
  return path === base || path.startsWith(`${base}/`);
}

export function isPurchasesLocation(location: string, lang: string): boolean {
  const path = normalizeClientPath(location);
  const base = pathFor(lang as Language, "purchases");
  return path === base || path.startsWith(`${base}/`);
}

export function isOffersLocation(location: string, lang: string): boolean {
  const path = normalizeClientPath(location);
  const pricing = pathFor(lang as Language, "pricing");
  const credits = pathFor(lang as Language, "credits_checkout");
  const enPricing = `/${lang}/pricing`;
  return (
    path === pricing
    || path.startsWith(`${pricing}/`)
    || path === enPricing
    || path.startsWith(`${enPricing}/`)
    || path === credits
    || path.startsWith(`/${lang}/credits/`)
  );
}

export function parseClientAreaSection(location: string, lang: string): ClientAreaSection {
  if (isOffersLocation(location, lang)) return "offers";
  if (isPurchasesLocation(location, lang)) return "purchases";
  return parseDashboardView(location, lang);
}

/** @deprecated kept for call sites that need the raw localized dashboard slug */
export function dashboardSlug(lang: Language): string {
  return pageSlug(lang, "dashboard");
}
