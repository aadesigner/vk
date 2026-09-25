import type { QueryClient } from "@tanstack/react-query";
import { getAdminGetStatsQueryKey } from "@workspace/api-client-react";
import { getErrorStatus } from "@/lib/api-error";
import { ADMIN_PENDING_COUNT_QUERY_KEY, fetchAdminPendingCount } from "@/lib/admin-pending-count";
import { orvalQuery, type SharedQueryExtras } from "@/lib/query-options";
import type { AdminStats, AdminUser, AdminUserPage, AdminVinPage, SystemSettings } from "@workspace/api-client-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function shouldRetryAdminQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 3) return false;
  const status = getErrorStatus(error);
  if (status === 401 || status === 403 || status === 404 || status === 429) return false;
  if (status && status >= 400 && status < 500) return false;
  return true;
}

const ADMIN_QUERY_BASE: SharedQueryExtras = {
  staleTime: 30_000,
  gcTime: 10 * 60 * 1000,
  refetchOnWindowFocus: false,
  refetchOnMount: true,
  refetchOnReconnect: true,
  retry: shouldRetryAdminQuery,
};

/** Shared React Query options for admin pages — safe to spread into useQuery. */
export const ADMIN_QUERY_OPTIONS = ADMIN_QUERY_BASE;

/** Full overview stats — only mount on Overview; poll gently (not every admin page). */
const ADMIN_STATS_QUERY_BASE: SharedQueryExtras = {
  ...ADMIN_QUERY_BASE,
  staleTime: 3 * 60_000,
  refetchInterval: 3 * 60_000,
  refetchIntervalInBackground: false,
};

/** Sidebar pending badge — tiny COUNT(*); safe to poll while admin is open. */
const ADMIN_PENDING_COUNT_QUERY_BASE: SharedQueryExtras = {
  ...ADMIN_QUERY_BASE,
  staleTime: 30_000,
  refetchInterval: 60_000,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
};

/** For orval admin hooks (useAdminGetStats, etc.). */
export const adminStatsQuery = () => orvalQuery<AdminStats>(ADMIN_STATS_QUERY_BASE);
export const adminPendingCountQuery = (): SharedQueryExtras => ({ ...ADMIN_PENDING_COUNT_QUERY_BASE });
export const adminUsersQuery = () => orvalQuery<AdminUserPage>(ADMIN_QUERY_BASE);
export const adminVinLookupsQuery = () => orvalQuery<AdminVinPage>(ADMIN_QUERY_BASE);
export const adminSettingsQuery = () => orvalQuery<SystemSettings>(ADMIN_QUERY_BASE);

/** @deprecated Use adminStatsQuery() for orval hooks; ADMIN_QUERY_OPTIONS for useQuery spreads. */
export const ADMIN_STATS_QUERY = ADMIN_STATS_QUERY_BASE;

/** Admin user detail — poll credits/spend while the page is open. */
const ADMIN_USER_DETAIL_QUERY_BASE: SharedQueryExtras = {
  ...ADMIN_QUERY_BASE,
  staleTime: 15_000,
  refetchInterval: 30_000,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
};

export const adminUserDetailQuery = () => orvalQuery<AdminUser>(ADMIN_USER_DETAIL_QUERY_BASE);

/** Same timing as adminUserDetailQuery — for manual useQuery spreads. */
export const ADMIN_USER_DETAIL_QUERY = ADMIN_USER_DETAIL_QUERY_BASE;

/** Bypass server-side admin stats TTL (90s) — used by dashboard Refresh. */
export async function fetchAdminStatsFresh(signal?: AbortSignal): Promise<AdminStats> {
  const r = await fetch(`${basePath}/api/admin/stats?refresh=1`, {
    credentials: "include",
    signal,
  });
  if (!r.ok) {
    throw new Error(`Stats refresh failed (${r.status})`);
  }
  return r.json() as Promise<AdminStats>;
}

/** Wipe client + server dashboard caches and reload stats, pending count, presence. */
export async function refreshAdminDashboard(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.fetchQuery({
      queryKey: getAdminGetStatsQueryKey(),
      queryFn: ({ signal }) => fetchAdminStatsFresh(signal),
    }),
    queryClient.fetchQuery({
      queryKey: ADMIN_PENDING_COUNT_QUERY_KEY,
      queryFn: ({ signal }) => fetchAdminPendingCount(signal),
    }),
  ]);
  await queryClient.invalidateQueries({ queryKey: ["admin", "presence-users"] });
}
