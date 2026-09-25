import { useEffect, useState } from "react";
import {
  type ActiveMapLivePing,
  type CoverageLiveCity,
  type CoverageLiveEventKey,
  COVERAGE_LIVE_EVENT_KEYS,
  citiesForMapRegion,
  type MapLivePingRegion,
} from "@/lib/coverage-live-events";

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function pickEventKey(): CoverageLiveEventKey {
  return pickRandom(COVERAGE_LIVE_EVENT_KEYS);
}

type Options = {
  region?: MapLivePingRegion;
  /** When set, overrides region-based city pool (country focus maps). */
  cities?: CoverageLiveCity[];
  maxPings?: number;
  maxLabels?: number;
  enabled?: boolean;
};

/** Spawn random decorative pings on map cities — illustrative only. */
export function useCoverageMapLivePings({
  region,
  cities,
  maxPings = 10,
  maxLabels = 3,
  enabled = true,
}: Options): ActiveMapLivePing[] {
  const [pings, setPings] = useState<ActiveMapLivePing[]>([]);

  useEffect(() => {
    if (!enabled) {
      setPings([]);
      return;
    }

    const pool = cities ?? (region ? citiesForMapRegion(region) : []);
    if (pool.length === 0) return;

    let cancelled = false;

    const spawn = () => {
      if (cancelled) return;
      const city = pickRandom(pool);
      const eventKey = pickEventKey();
      const pingId = `${city.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      setPings((prev) => {
        const next = [
          ...prev,
          { pingId, city, eventKey, showLabel: true },
        ].slice(-maxPings);

        const labelFrom = Math.max(0, next.length - maxLabels);
        return next.map((p, idx) => ({
          ...p,
          showLabel: idx >= labelFrom,
        }));
      });
    };

    spawn();
    const interval = setInterval(spawn, 1400 + Math.random() * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [cities, enabled, maxLabels, maxPings, region]);

  return pings;
}
