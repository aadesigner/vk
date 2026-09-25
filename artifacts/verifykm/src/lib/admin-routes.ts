import { normalizeAppPath } from "@/lib/normalize-app-path";

/** Strip wouter's absolute-path marker when base path mismatches briefly. */
export function stripWouterAbsPrefix(pathname: string): string {
  return pathname.startsWith("~") ? pathname.slice(1) : pathname;
}

export function normalizeAdminPath(pathname: string): string {
  return normalizeAppPath(stripWouterAbsPrefix(pathname));
}

export function isAdminAppPath(pathname: string): boolean {
  const path = normalizeAdminPath(pathname);
  return path === "/adminx" || path.startsWith("/adminx/");
}

export type AdminRouteMatch =
  | { id: "overview" }
  | { id: "analytics" }
  | { id: "users" }
  | { id: "user-detail"; userId: string }
  | { id: "lookups" }
  | { id: "providers" }
  | { id: "pricing" }
  | { id: "settings" }
  | { id: "plugins" }
  | { id: "logs" }
  | { id: "coupons" }
  | { id: "emails" }
  | { id: "security" }
  | { id: "vin-catalog" }
  | { id: "pending-vin-checks" }
  | { id: "pending-vin-detail"; checkId: string }
  | { id: "vin-detail"; vin: string }
  | { id: "transactions" }
  | { id: "announcements" }
  | { id: "not-found" };

type ExactAdminRouteId = Exclude<
  AdminRouteMatch["id"],
  "user-detail" | "pending-vin-detail" | "vin-detail" | "not-found"
>;

const EXACT_ROUTES: Record<string, ExactAdminRouteId> = {
  "/adminx": "overview",
  "/adminx/analytics": "analytics",
  "/adminx/users": "users",
  "/adminx/lookups": "lookups",
  "/adminx/providers": "providers",
  "/adminx/pricing": "pricing",
  "/adminx/settings": "settings",
  "/adminx/plugins": "plugins",
  "/adminx/logs": "logs",
  "/adminx/coupons": "coupons",
  "/adminx/emails": "emails",
  "/adminx/security": "security",
  "/adminx/vin-catalog": "vin-catalog",
  "/adminx/pending-vin-checks": "pending-vin-checks",
  "/adminx/transactions": "transactions",
  "/adminx/announcements": "announcements",
};

/** Deterministic admin matcher — no wouter wildcard ambiguity. */
export function matchAdminRoute(pathname: string): AdminRouteMatch {
  const path = normalizeAdminPath(pathname);

  const exact = EXACT_ROUTES[path];
  if (exact) return { id: exact };

  const userDetail = path.match(/^\/adminx\/users\/([^/]+)$/);
  if (userDetail) return { id: "user-detail", userId: userDetail[1]! };

  const pendingDetail = path.match(/^\/adminx\/pending-vin-checks\/([^/]+)$/);
  if (pendingDetail) return { id: "pending-vin-detail", checkId: pendingDetail[1]! };

  const vinDetail = path.match(/^\/adminx\/vin\/([^/]+)$/);
  if (vinDetail) return { id: "vin-detail", vin: vinDetail[1]! };

  if (path.startsWith("/adminx/")) return { id: "not-found" };

  return { id: "not-found" };
}
