import type { QueryClient } from "@tanstack/react-query";

/** React Query keys for signed-in dashboard / purchases — always treat as live data. */
export const CLIENT_AREA_QUERY_ROOTS = [
  "/api/user/history",
  "/api/user/stats",
  "/api/user/payments",
] as const;

export function invalidateClientAreaQueries(queryClient: QueryClient): void {
  for (const root of CLIENT_AREA_QUERY_ROOTS) {
    void queryClient.invalidateQueries({ queryKey: [root], refetchType: "all" });
  }
}

export function refetchClientAreaQueries(queryClient: QueryClient): void {
  for (const root of CLIENT_AREA_QUERY_ROOTS) {
    void queryClient.refetchQueries({ queryKey: [root], type: "active" });
  }
}

/**
 * After a purchase / VIN unlock, force-refresh client-area data.
 * `refetchType: "all"` also refreshes inactive cached queries so a newly
 * unlocked VIN shows up when the user returns to the dashboard.
 */
export function refreshClientAreaAfterUnlock(queryClient: QueryClient): void {
  for (const root of CLIENT_AREA_QUERY_ROOTS) {
    void queryClient.invalidateQueries({ queryKey: [root], refetchType: "all" });
  }
}
