import type { QueryClient } from "@tanstack/react-query";
import type { VinLookup } from "@workspace/api-client-react";
import { VIN_REPORT_QUERY_OPTIONS } from "@/lib/vin-report-cache";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const vinResultChunkPrefetched = { current: false };
const vinPublicChunkPrefetched = { current: false };

export function normalizeVin(vin: string): string {
  return vin.trim().toUpperCase();
}

/** Lazy-load the authenticated VIN report page chunk. */
export function prefetchVinResultPageChunk(): void {
  if (vinResultChunkPrefetched.current) return;
  vinResultChunkPrefetched.current = true;
  void import("@/pages/vin-result");
}

/** Lazy-load the public VIN preview page chunk. */
export function prefetchVinPublicPageChunk(): void {
  if (vinPublicChunkPrefetched.current) return;
  vinPublicChunkPrefetched.current = true;
  void import("@/pages/vin-public");
}

/** @deprecated Use prefetchVinResultPageChunk */
export function prefetchVinPageChunk(): void {
  prefetchVinResultPageChunk();
}

/** Parse VIN from paths like /en/vin/1HGBH41JXMN109186 */
export function extractVinFromHref(href: string): string | null {
  const parts = href.split("/").filter(Boolean);
  const vinIdx = parts.findIndex((p) => p.toLowerCase() === "vin");
  if (vinIdx === -1 || vinIdx >= parts.length - 1) return null;
  const candidate = parts[vinIdx + 1];
  if (!candidate || candidate.length !== 17) return null;
  return normalizeVin(candidate);
}

export function vinLookupQueryKey(vin: string): readonly [string, string, string] {
  return ["/api/vin", "vin", normalizeVin(vin)];
}

/** Prefetch at most this many recent complete reports (avoids N× API load on large histories). */
const HISTORY_PREFETCH_LIMIT = 4;

/** @deprecated Use prefetchVinReport — summary rows must not seed the full report cache. */
export function seedVinLookupsFromHistory(queryClient: QueryClient, lookups: VinLookup[]): void {
  let prefetched = 0;
  for (const lookup of lookups) {
    if (lookup.status !== "complete" || !lookup.vin) continue;
    if (prefetched >= HISTORY_PREFETCH_LIMIT) break;
    prefetchVinReport(queryClient, lookup.vin);
    prefetched += 1;
  }
}

/** Prefetch authenticated VIN report JSON (signed-in users only). */
export function prefetchVinReport(queryClient: QueryClient, vin: string): void {
  const vinUpper = normalizeVin(vin);
  if (vinUpper.length !== 17) return;

  const key = vinLookupQueryKey(vinUpper);
  const existing = queryClient.getQueryData(key);
  if (existing) return;

  prefetchVinResultPageChunk();

  void queryClient.prefetchQuery({
    queryKey: key,
    ...VIN_REPORT_QUERY_OPTIONS,
    queryFn: async () => {
      const r = await fetch(`${basePath}/api/vin/${encodeURIComponent(vinUpper)}`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<VinLookup>;
    },
  });
}

/** Prefetch public VIN preview chunk (guests). */
export function prefetchVinPublicFromHref(href: string): void {
  const vin = extractVinFromHref(href);
  if (!vin) return;
  prefetchVinPublicPageChunk();
}

export function prefetchVinFromHref(
  queryClient: QueryClient,
  href: string,
  options?: { isSignedIn?: boolean },
): void {
  const vin = extractVinFromHref(href);
  if (!vin) return;

  if (options?.isSignedIn) {
    prefetchVinReport(queryClient, vin);
  } else {
    prefetchVinPublicFromHref(href);
  }
}
