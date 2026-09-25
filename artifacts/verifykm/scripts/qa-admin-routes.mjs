/**
 * QA: admin routing + dashboard stability invariants (static).
 * Usage: node artifacts/verifykm/scripts/qa-admin-routes.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let errors = 0;

function fail(msg) {
  console.error("FAIL:", msg);
  errors++;
}

function read(rel) {
  const path = join(root, rel);
  if (!existsSync(path)) {
    fail(`missing file ${rel}`);
    return "";
  }
  return readFileSync(path, "utf8");
}

const app = read("src/App.tsx");
const layout = read("src/pages/admin/layout.tsx");
const index = read("src/pages/admin/index.tsx");
const chart = read("src/pages/admin/admin-dashboard-chart.tsx");
const notFound = read("src/pages/admin/not-found.tsx");
const adminQueryOpts = read("src/lib/admin-query-options.ts");
const adminRoutes = read("src/lib/admin-routes.ts");

// ── Admin 404 must stay inside admin shell ───────────────────────────────────
if (!notFound.includes("Admin page not found")) {
  fail("admin/not-found.tsx must render admin-specific 404 copy");
}
if (!app.includes("AdminNotFound")) {
  fail("App.tsx must import AdminNotFound");
}
if (!app.includes("function AdminRouteOutlet")) {
  fail("App.tsx must resolve admin paths via AdminRouteOutlet (no wouter catch-all)");
}
if (!app.includes("matchAdminRoute")) {
  fail("App.tsx must use matchAdminRoute for deterministic admin routing");
}
if (!app.includes("function AdminSwitch")) {
  fail("App.tsx must isolate admin routes in AdminSwitch");
}
if (!app.includes("isAdminAppPath(pathname)")) {
  fail("AppRouter and NotFoundLang must branch on isAdminAppPath");
}
if (!app.includes("normalizeAppPath")) {
  fail("App.tsx AppRouter must normalize paths (trailing slash fix)");
}
if (!app.includes("isAdminAppPath(pathname)")) {
  fail("NotFoundLang must delegate any admin path to AdminSwitch");
}

// Catch-all must not use greedy wouter wildcards for /adminx
if (app.includes('path="/adminx/:rest*"') || app.includes('path="/adminx/:rest+"')) {
  fail("App.tsx must not use wouter /adminx/:rest* or :rest+ catch-all routes");
}

// Admin overview should be eagerly imported (first /adminx load must not wait on a lazy chunk)
if (!app.includes('import AdminOverview from "@/pages/admin/index"')) {
  fail("AdminOverview must be eagerly imported in App.tsx");
}

// AdminLayout should be eagerly imported (avoids chunk-load shell flashes)
if (!app.includes('import { AdminLayout } from "@/pages/admin/layout"')) {
  fail("AdminLayout must be eagerly imported in App.tsx");
}

// ── Nav links must have matching routes ───────────────────────────────────────
const navHrefs = [...new Set([...layout.matchAll(/href: "(\/adminx[^"]*)"/g)].map((m) => m[1]))];
for (const href of navHrefs) {
  if (!adminRoutes.includes(`"${href}"`)) {
    fail(`admin nav href ${href} missing from admin-routes.ts EXACT_ROUTES`);
  }
}

// ── Dashboard performance guards ─────────────────────────────────────────────
if (index.includes("framer-motion")) {
  fail("admin dashboard should not use framer-motion (use CSS transitions to reduce memory)");
}
if (!index.includes("useMemo")) {
  fail("admin dashboard must memoize derived chart data");
}
if (!chart.includes("isAnimationActive={false}")) {
  fail("admin-dashboard-chart must disable animation (isAnimationActive={false})");
}
if (
  (index.includes("refetchInterval") || adminQueryOpts.includes("ADMIN_STATS_QUERY"))
  && !adminQueryOpts.includes("refetchIntervalInBackground: false")
) {
  fail("admin stats query must set refetchIntervalInBackground: false (ADMIN_STATS_QUERY)");
}

// Layout should reuse stats cache for pending badge (no duplicate poll)
if (layout.includes('queryKey: ["/api/admin/pending-vin-checks"')) {
  fail("AdminLayout must not run a separate pending-vin-checks poll; use stats cache");
}
if (!layout.includes("getAdminGetStatsQueryOptions")) {
  fail("AdminLayout should read pending count from admin stats query cache");
}

if (!layout.includes("normalizeAdminPath") && !layout.includes("splitRouterLocation")) {
  fail("AdminLayout should match nav active state on normalized admin pathname");
}

// ── AdminPage should not wrap eager layout in Suspense ───────────────────────
const adminPageMatch = app.match(/function AdminPage[\s\S]*?^}/m);
if (adminPageMatch && adminPageMatch[0].includes("<Suspense") && adminPageMatch[0].includes("<AdminLayout")) {
  fail("AdminPage must not Suspense-wrap eager AdminLayout (causes full-shell loader flash)");
}

// ── Route matrix (regression: bare /adminx must never be not-found) ───────────
function normalizeAppPath(pathname) {
  if (!pathname) return "/";
  let path = pathname.replace(/\/{2,}/g, "/");
  if (path.length > 1 && path.endsWith("/")) path = path.replace(/\/+$/, "");
  return path || "/";
}
function normalizeAdminPath(pathname) {
  const stripped = pathname.startsWith("~") ? pathname.slice(1) : pathname;
  return normalizeAppPath(stripped);
}
function matchAdminRoute(pathname) {
  const path = normalizeAdminPath(pathname);
  const exact = {
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
  }[path];
  if (exact) return { id: exact };
  if (/^\/adminx\/users\/([^/]+)$/.test(path)) return { id: "user-detail" };
  if (/^\/adminx\/pending-vin-checks\/([^/]+)$/.test(path)) return { id: "pending-vin-detail" };
  if (/^\/adminx\/vin\/([^/]+)$/.test(path)) return { id: "vin-detail" };
  if (path.startsWith("/adminx/")) return { id: "not-found" };
  return { id: "not-found" };
}

const routeMatrix = [
  ["/adminx", "overview"],
  ["/adminx/", "overview"],
  ["~/adminx", "overview"],
  ["/adminx/analytics", "analytics"],
  ["/adminx/users", "users"],
  ["/adminx/users/abc", "user-detail"],
  ["/adminx/pending-vin-checks", "pending-vin-checks"],
  ["/adminx/pending-vin-checks/42", "pending-vin-detail"],
  ["/adminx/vin/1HGCM82633A123456", "vin-detail"],
  ["/adminx/logs", "logs"],
  ["/adminx/bad-page", "not-found"],
];
for (const [path, expected] of routeMatrix) {
  const got = matchAdminRoute(path).id;
  if (got !== expected) {
    fail(`matchAdminRoute(${path}) => ${got}, expected ${expected}`);
  }
}

const outletCases = [
  "overview", "analytics", "users", "user-detail", "lookups", "providers", "pricing",
  "settings", "plugins", "logs", "coupons", "emails", "security", "vin-catalog",
  "pending-vin-checks", "pending-vin-detail", "vin-detail", "transactions",
  "announcements", "not-found",
];
for (const id of outletCases) {
  if (!app.includes(`case "${id}":`)) {
    fail(`AdminRouteOutlet missing switch case for "${id}"`);
  }
}

if (errors > 0) {
  console.error(`\n${errors} admin QA check(s) failed.`);
  process.exit(1);
}

console.log("Admin route + dashboard QA: all static checks passed.");
