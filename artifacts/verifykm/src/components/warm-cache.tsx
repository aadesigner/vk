import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetCurrentPricingQueryOptions, type PricingConfig } from "@workspace/api-client-react";
import { STATIC_QUERY_OPTIONS, orvalQuery } from "@/lib/query-options";
import { prefetchAuthAreaRoutes, prefetchCommonRoutes } from "@/lib/prefetch-route";
import { prefetchNavMenuAssets } from "@/lib/nav-assets";
import { prefetchVinPageChunk } from "@/lib/prefetch-vin-report";
import { prefetchPublicSettings } from "@/lib/public-settings";
import { useAuth } from "@/lib/auth-context";

function prefersReducedNetwork(): boolean {
  if (typeof navigator === "undefined") return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn?.saveData) return true;
  return conn?.effectiveType === "slow-2g" || conn?.effectiveType === "2g";
}

/** Prefetch static API data and route chunks during idle time. */
export function WarmCache() {
  const queryClient = useQueryClient();
  const { isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    if (prefersReducedNetwork()) return;

    // Warm nav icons after first paint so they don't compete with hero decode on iOS.
    let idleId: number | undefined;
    const warmNav = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      prefetchNavMenuAssets();
    };
    const navStart = window.setTimeout(() => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(warmNav, { timeout: 2_500 });
      } else {
        warmNav();
      }
    }, 700);

    const warm = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      void queryClient.prefetchQuery(
        getGetCurrentPricingQueryOptions({ query: orvalQuery<PricingConfig>(STATIC_QUERY_OPTIONS) }),
      );
      prefetchPublicSettings(queryClient);
      prefetchCommonRoutes();
    };

    let warmIdleId: number | undefined;
    const startId = window.setTimeout(() => {
      if (typeof window.requestIdleCallback === "function") {
        warmIdleId = window.requestIdleCallback(warm, { timeout: 20_000 });
      } else {
        window.setTimeout(warm, 12_000);
      }
    }, 4_000);

    return () => {
      window.clearTimeout(navStart);
      window.clearTimeout(startId);
      if (idleId != null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (warmIdleId != null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(warmIdleId);
      }
    };
  }, [queryClient]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || prefersReducedNetwork()) return;

    const warmAuth = () => {
      prefetchAuthAreaRoutes();
      prefetchVinPageChunk();
    };

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(warmAuth, { timeout: 18_000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(warmAuth, 10_000);
    return () => window.clearTimeout(timer);
  }, [isLoaded, isSignedIn, queryClient]);

  return null;
}
