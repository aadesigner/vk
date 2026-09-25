export const MAINTENANCE_PARTIAL_RESTRICTIONS = [
  "free_decoder",
  "checkout",
  "vin_reports",
] as const;

export type MaintenancePartialRestriction = (typeof MAINTENANCE_PARTIAL_RESTRICTIONS)[number];

export type MaintenanceStatus = {
  maintenanceMode: boolean;
  maintenanceRestrictions: MaintenancePartialRestriction[];
  maintenanceMessage: string | null;
};

import { LANG_PATH_ALT } from "@/lib/languages";

const LANG_PATH_RE = new RegExp(`^/(${LANG_PATH_ALT})`);

const AUTH_PATH_RE = new RegExp(`^/(${LANG_PATH_ALT})/(sign-in|sign-up|forgot-password|reset-password|set-password)(/|$)`);
const MAINTENANCE_PATH_RE = new RegExp(`^/(${LANG_PATH_ALT})/maintenance(/|$)`);
const ADMIN_PATH_RE = /^\/adminx(\/|$)/;

export function isMaintenanceExemptPath(pathname: string): boolean {
  if (ADMIN_PATH_RE.test(pathname)) return true;
  if (MAINTENANCE_PATH_RE.test(pathname)) return true;
  if (AUTH_PATH_RE.test(pathname)) return true;
  return false;
}

/** Map public SPA path to a maintenance restriction key. */
export function frontendPathRestriction(pathname: string): MaintenancePartialRestriction | null {
  const m = pathname.match(new RegExp(`^/(${LANG_PATH_ALT})(/.*)?$`));
  if (!m) return null;
  const sub = m[2] ?? "";
  if (sub === "/free-vin-decoder" || sub.startsWith("/free-vin-decoder/")) return "free_decoder";
  if (sub === "/checkout" || sub.startsWith("/checkout/")) return "checkout";
  if (sub === "/vin/processing" || /^\/vin\/[^/]+$/.test(sub)) return "vin_reports";
  return null;
}

export function isFrontendUnderMaintenance(
  pathname: string,
  status: MaintenanceStatus | undefined,
): MaintenancePartialRestriction | "full_site" | null {
  if (!status) return null;
  if (isMaintenanceExemptPath(pathname)) return null;

  if (status.maintenanceMode) {
    const partial = frontendPathRestriction(pathname);
    if (partial) return "full_site";
    const m = pathname.match(new RegExp(`^/(${LANG_PATH_ALT})(/.*)?$`));
    const sub = m?.[2] ?? "";
    if (!sub || sub === "/") return "full_site";
    if (sub.startsWith("/terms") || sub.startsWith("/privacy")) return null;
    return "full_site";
  }

  const restriction = frontendPathRestriction(pathname);
  if (!restriction) return null;
  return status.maintenanceRestrictions.includes(restriction) ? restriction : null;
}

export function extractLangFromPath(pathname: string): string {
  const m = pathname.match(new RegExp(`^/(${LANG_PATH_ALT})(/|$)`));
  return m?.[1] ?? "en";
}
