import { Suspense } from "react";
import { lazyWithRetry } from "@/lib/lazy-with-retry";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { createVinReportFetchError } from "@/lib/api-error";
import { VinReportErrorView, resolveVinReportErrorKind } from "@/components/vin-report-error";
import { useQueryRecovery } from "@/hooks/use-query-recovery";
import { VIN_REPORT_QUERY_OPTIONS } from "@/lib/vin-report-cache";
import { RouteShellFallback } from "@/components/route-shell-fallback";

const VinResult = lazyWithRetry(() => import("@/pages/vin-result"));
const VinPublic = lazyWithRetry(() => import("@/pages/vin-public"));

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function PageLoader() {
  return <RouteShellFallback />;
}

type VinAccessGateProps = {
  params: { lang: string; id: string };
  vin: string;
};

/**
 * Signed-in visitors only reach VinResult when /vin/public confirms unlock
 * (purchased, pending_manual on their account, or admin).
 * Everyone else gets the locked VinPublic preview — same as guests.
 */
export function VinAccessGate({ params, vin }: VinAccessGateProps) {
  const { user } = useAuth();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["/api/vin/public", vin, user?.id ?? null],
    queryFn: async ({ signal }) => {
      const r = await fetch(`${basePath}/api/vin/public/${encodeURIComponent(vin)}`, {
        credentials: "include",
        signal,
      });
      if (r.status === 404) throw createVinReportFetchError(404);
      if (r.status === 403) throw createVinReportFetchError(403);
      if (!r.ok) throw createVinReportFetchError(r.status);
      return r.json() as Promise<{ isUnlocked?: boolean }>;
    },
    ...VIN_REPORT_QUERY_OPTIONS,
  });

  useQueryRecovery(isError && !!data, isFetching, refetch);

  // Keep the shell while the first fetch (or post-unlock refetch) is in flight —
  // never flash a cached 404 / "not in database" over a paid unlock.
  if ((isLoading || isFetching) && !data) return <PageLoader />;

  if (isError && !data) {
    const kind = resolveVinReportErrorKind(error);
    return (
      <VinReportErrorView
        kind={kind}
        language={params.lang}
        onRetry={kind === "server" || kind === "unknown" || kind === "rate_limit" ? () => void refetch() : undefined}
        isRetrying={isFetching}
      />
    );
  }

  if (data?.isUnlocked) {
    return (
      <Suspense fallback={<PageLoader />}>
        <VinResult params={{ lang: params.lang, id: vin }} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <VinPublic params={{ lang: params.lang, id: vin }} />
    </Suspense>
  );
}
