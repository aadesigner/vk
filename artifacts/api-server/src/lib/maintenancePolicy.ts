/** Partial maintenance targets — full site uses `maintenanceMode` boolean. */
export const MAINTENANCE_PARTIAL_RESTRICTIONS = [
  "free_decoder",
  "checkout",
  "vin_reports",
] as const;

export type MaintenancePartialRestriction = (typeof MAINTENANCE_PARTIAL_RESTRICTIONS)[number];

export type MaintenanceState = {
  maintenanceMode: boolean;
  maintenanceRestrictions: MaintenancePartialRestriction[];
  maintenanceMessage: string | null;
};

const PARTIAL_SET = new Set<string>(MAINTENANCE_PARTIAL_RESTRICTIONS);

export function normalizeMaintenanceRestrictions(input: unknown): MaintenancePartialRestriction[] {
  if (!Array.isArray(input)) return [];
  const out: MaintenancePartialRestriction[] = [];
  for (const item of input) {
    if (typeof item !== "string") continue;
    if (!PARTIAL_SET.has(item)) continue;
    if (!out.includes(item as MaintenancePartialRestriction)) {
      out.push(item as MaintenancePartialRestriction);
    }
  }
  return out;
}

export function normalizeMaintenanceMessage(input: unknown): string | null {
  if (input == null) return null;
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 500);
}

/** API paths are relative to the `/api` mount (e.g. `/vin/decode-free`). */
export function apiPathRestriction(path: string): MaintenancePartialRestriction | null {
  const p = path.split("?")[0] ?? path;
  if (p === "/vin/decode-free") return "free_decoder";
  if (
    p === "/payments/create-paypal-order"
    || p === "/payments/capture-paypal-order"
    || p === "/payments/create-credit-pack-order"
    || p === "/payments/capture-credit-pack-order"
    || p === "/payments/create-pok-order"
    || p === "/payments/confirm-pok-order"
    || p === "/payments/create-pok-credit-pack-order"
    || p === "/payments/confirm-pok-credit-pack-order"
    || p === "/payments/redeem-credit"
    || p === "/payments/validate-coupon"
  ) {
    return "checkout";
  }
  if (p === "/vin/lookup") return "vin_reports";
  if (p.startsWith("/vin/peek/")) return "vin_reports";
  if (p.startsWith("/vin/resolve/")) return "vin_reports";
  if (p.startsWith("/vin/share-link/")) return "vin_reports";
  if (/^\/vin\/\d+$/.test(p)) return "vin_reports";
  return null;
}

export function isApiPathUnderMaintenance(
  path: string,
  state: MaintenanceState,
): boolean {
  if (state.maintenanceMode) return true;
  const restriction = apiPathRestriction(path);
  if (!restriction) return false;
  return state.maintenanceRestrictions.includes(restriction);
}

/** Paths that must stay reachable while maintenance is active. */
export function isExemptMaintenanceApiPath(path: string): boolean {
  const p = path.split("?")[0] ?? path;
  if (p === "/healthz") return true;
  if (p.startsWith("/auth/")) return true;
  if (p.startsWith("/admin/")) return true;
  if (p === "/payments/public-settings") return true;
  if (p === "/payments/current-pricing") return true;
  if (p === "/payments/webhook/pok") return true;
  if (p === "/plugins/geo-language") return true;
  if (p.startsWith("/announcements")) return true;
  return false;
}
