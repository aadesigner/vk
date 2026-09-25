import type { QueryClient } from "@tanstack/react-query";

/** React Query options for authenticated VIN report pages. */
export const VIN_REPORT_QUERY_OPTIONS = {
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  refetchOnMount: true,
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
} as const;

/** Poll while provider fetch is in progress — stops when status changes. */
export function vinReportRefetchInterval(query: {
  state: { data?: unknown; error?: unknown; fetchFailureCount?: number };
}): number | false {
  const status = (query.state.data as { status?: string } | undefined)?.status;
  if (status === "fulfilling") return 2_000;
  const err = query.state.error as { notFound?: boolean; kind?: string } | null | undefined;
  const failures = query.state.fetchFailureCount ?? 0;
  // Brief post-unlock race: keep trying instead of sticking on a false 404.
  if ((err?.notFound || err?.kind === "not_found") && failures < 45) return 2_000;
  return false;
}

function normalizeVin(vin: string): string {
  return vin.trim().toUpperCase();
}

function queryKeyMatchesVinReport(
  queryKey: readonly unknown[],
  vinUpper: string,
  lookupId?: number,
): boolean {
  if (!Array.isArray(queryKey) || queryKey.length === 0) return false;
  const first = queryKey[0];
  if (first === "/api/vin/public" && normalizeVin(String(queryKey[1] ?? "")) === vinUpper) {
    return true;
  }
  if (first === "/api/vin" && queryKey[1] === "vin" && normalizeVin(String(queryKey[2] ?? "")) === vinUpper) {
    return true;
  }
  if (
    lookupId != null &&
    first === "/api/vin" &&
    queryKey[1] === "id" &&
    queryKey[2] === lookupId
  ) {
    return true;
  }
  if (typeof first === "string" && first.startsWith("/api/vin/")) {
    const segment = first.slice("/api/vin/".length);
    if (normalizeVin(segment) === vinUpper) return true;
    if (lookupId != null && segment === String(lookupId)) return true;
  }
  return false;
}

/**
 * Drop VIN report client caches so the next mount fetches fresh server data.
 * Uses remove (not only invalidate) so a pre-purchase public 404 / locked preview
 * cannot flash "not in database" after credit or payment unlock.
 */
export function invalidateVinReportCaches(
  queryClient: QueryClient,
  vin: string,
  lookupId?: number,
): void {
  const vinUpper = normalizeVin(vin);
  const matchesVinReport = (query: { queryKey: readonly unknown[]; state: { data?: unknown } }) => {
    if (queryKeyMatchesVinReport(query.queryKey, vinUpper, lookupId)) return true;
    const data = query.state.data as { vin?: string; id?: number } | undefined;
    if (data?.vin && normalizeVin(data.vin) === vinUpper) return true;
    if (lookupId != null && data?.id === lookupId) return true;
    return false;
  };

  void queryClient.removeQueries({ predicate: (query) => matchesVinReport(query) });
}
