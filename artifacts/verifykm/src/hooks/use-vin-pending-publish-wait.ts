import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

type VinLookupRow = {
  vin?: string;
  status?: string;
  updatedAt?: string | Date;
  id?: number;
};

function lookupUpdatedMs(lookup: VinLookupRow | undefined): number {
  if (!lookup?.updatedAt) return 0;
  const t =
    lookup.updatedAt instanceof Date
      ? lookup.updatedAt.getTime()
      : new Date(lookup.updatedAt).getTime();
  return Number.isFinite(t) ? t : 0;
}

function applyLookupToCaches(queryClient: ReturnType<typeof useQueryClient>, fresh: VinLookupRow): void {
  const vin = fresh.vin?.toUpperCase();
  if (vin) {
    queryClient.setQueryData(["/api/vin", "vin", vin], fresh);
  }
  if (fresh.id != null) {
    queryClient.setQueryData(["/api/vin", "id", fresh.id], fresh);
  }
}

/** Long-poll while pending_manual — server wakes the request when admin publishes. */
export function useVinPendingPublishWait(lookup: VinLookupRow | undefined, enabled: boolean): void {
  const queryClient = useQueryClient();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const sinceRef = useRef(0);
  const vinRef = useRef("");

  useEffect(() => {
    if (!enabled || !lookup?.vin || lookup.status !== "pending_manual") return;

    const vin = lookup.vin.toUpperCase();
    if (vinRef.current !== vin) {
      vinRef.current = vin;
      sinceRef.current = lookupUpdatedMs(lookup) || Date.now();
    }

    let cancelled = false;
    let abort: AbortController | null = null;

    const loop = async () => {
      while (!cancelled) {
        abort = new AbortController();
        try {
          const url = `${basePath}/api/vin/wait-update/${encodeURIComponent(vin)}?since=${sinceRef.current}`;
          const r = await fetch(url, { credentials: "include", signal: abort.signal });
          if (cancelled) return;
          if (!r.ok) {
            await new Promise((res) => setTimeout(res, 5_000));
            continue;
          }
          const body = (await r.json()) as { changed?: boolean; lookup?: VinLookupRow };
          if (body.changed && body.lookup) {
            applyLookupToCaches(queryClient, body.lookup);
            if (body.lookup.status !== "pending_manual") return;
            sinceRef.current = lookupUpdatedMs(body.lookup) || Date.now();
          }
        } catch (err) {
          if (cancelled || (err instanceof DOMException && err.name === "AbortError")) return;
          await new Promise((res) => setTimeout(res, 3_000));
        }
      }
    };

    void loop();
    return () => {
      cancelled = true;
      abort?.abort();
    };
  }, [enabled, lookup?.vin, lookup?.status, lookup?.updatedAt, queryClient, basePath]);
}
