import { describe, expect, it, vi } from "vitest";
import { makeTtlCache } from "./ttlCache.js";

describe("admin stats TTL cache pattern", () => {
  it("dedupes concurrent fetches within TTL", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () => ({ totalUsers: 1 }));
    const cache = makeTtlCache<{ totalUsers: number }>(90_000);

    const [a, b] = await Promise.all([
      cache.getOrFetch(fetcher),
      cache.getOrFetch(fetcher),
    ]);

    expect(a).toEqual({ totalUsers: 1 });
    expect(b).toEqual({ totalUsers: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_000);
    await cache.getOrFetch(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(61_000);
    await cache.getOrFetch(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("invalidate clears cached payload", async () => {
    const fetcher = vi.fn(async () => ({ totalUsers: 2 }));
    const cache = makeTtlCache<{ totalUsers: number }>(90_000);

    await cache.getOrFetch(fetcher);
    cache.invalidate();
    await cache.getOrFetch(fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
