const CACHE_NAME = "verifykm-vin-images-v1";
/** Max concurrent browser warmers for a neighbor window. */
const PREFETCH_CONCURRENCY = 3;
/** Cap in-memory session tracking to avoid unbounded growth. */
const MAX_SESSION_TRACKED = 120;

/** URLs that finished loading in this session — avoids spinner flash on report refetch. */
const sessionLoadedUrls = new Set<string>();

export function markVinImageSessionLoaded(url: string): void {
  if (!url) return;
  if (sessionLoadedUrls.size >= MAX_SESSION_TRACKED && !sessionLoadedUrls.has(url)) {
    const oldest = sessionLoadedUrls.values().next().value;
    if (oldest) sessionLoadedUrls.delete(oldest);
  }
  sessionLoadedUrls.add(url);
}

export function isVinImageSessionLoaded(url: string): boolean {
  return sessionLoadedUrls.has(url);
}

function canUseCacheApi(): boolean {
  return typeof window !== "undefined" && "caches" in window;
}

function isProxiedVinImage(url: string): boolean {
  return url.includes("/api/vin/image");
}

function hintPreloadImage(url: string): void {
  if (typeof document === "undefined" || !url) return;
  const attr = "data-vin-img-preload";
  if (document.querySelector(`link[${attr}="${CSS.escape(url)}"]`)) return;
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = url;
  link.setAttribute(attr, url);
  document.head.appendChild(link);
}

/** Decode a URL through the browser image pipeline (uses HTTP cache when warm). */
const warmInFlight = new Map<string, Promise<void>>();

export function warmVinImage(url: string): Promise<void> {
  if (!url || typeof window === "undefined") return Promise.resolve();
  if (isVinImageSessionLoaded(url)) return Promise.resolve();
  const existing = warmInFlight.get(url);
  if (existing) return existing;

  const promise = new Promise<void>((resolve) => {
    const img = new Image();
    img.decoding = "async";
    const finish = () => {
      markVinImageSessionLoaded(url);
      warmInFlight.delete(url);
      resolve();
    };
    img.onload = finish;
    img.onerror = () => {
      warmInFlight.delete(url);
      resolve();
    };
    img.src = url;
    if (img.complete && img.naturalWidth > 0) finish();
  });
  warmInFlight.set(url, promise);
  return promise;
}

/** Warm a small set of gallery neighbors (hero slider / lightbox). Default radius = 1. */
export async function warmVinImageNeighbors(urls: string[], centerIndex: number, radius = 1): Promise<void> {
  if (urls.length === 0) return;
  const n = urls.length;
  const indices = new Set<number>();
  for (let offset = 0; offset <= radius; offset++) {
    indices.add(((centerIndex + offset) % n + n) % n);
    if (offset > 0) indices.add(((centerIndex - offset) % n + n) % n);
  }
  const targets = [...indices].map((i) => urls[i]).filter((u): u is string => !!u);
  await warmVinImages(targets);
}

export async function warmVinImages(urls: string[]): Promise<void> {
  const unique = [...new Set(urls.filter((u) => typeof u === "string" && u.length > 0))];
  if (unique.length === 0) return;

  const priority = unique.slice(0, 2);
  const rest = unique.slice(2);
  await Promise.all(priority.map((url) => warmVinImage(url)));

  for (let i = 0; i < rest.length; i += PREFETCH_CONCURRENCY) {
    await Promise.all(rest.slice(i, i + PREFETCH_CONCURRENCY).map((url) => warmVinImage(url)));
  }
}

export type PrefetchVinImagesOptions = {
  /** Index to center the warm window on (default 0). */
  centerIndex?: number;
  /** Neighbors on each side of center (default 1 → max 3 images). */
  radius?: number;
};

/**
 * Warm only the current slide ± neighbors (not the full gallery).
 * Under concurrent unlocks, full-gallery prefetch stampedes `/api/vin/image`.
 */
export async function prefetchVinImages(
  urls: string[],
  opts?: PrefetchVinImagesOptions,
): Promise<void> {
  const unique = [...new Set(urls.filter((u) => typeof u === "string" && u.length > 0))];
  if (unique.length === 0) return;

  const centerIndex = Math.min(
    Math.max(0, opts?.centerIndex ?? 0),
    unique.length - 1,
  );
  const radius = Math.max(0, opts?.radius ?? 1);
  const n = unique.length;
  const indices = new Set<number>();
  for (let offset = 0; offset <= radius; offset++) {
    indices.add(((centerIndex + offset) % n + n) % n);
    if (offset > 0) indices.add(((centerIndex - offset) % n + n) % n);
  }
  const windowUrls = [...indices]
    .sort((a, b) => a - b)
    .map((i) => unique[i]!)
    .filter(Boolean);

  const hero = windowUrls[0] ?? unique[centerIndex]!;
  hintPreloadImage(hero);

  const proxied = windowUrls.filter(isProxiedVinImage);
  if (proxied.length === 0) {
    await warmVinImages(windowUrls);
    return;
  }

  let cache: Cache | null = null;
  if (canUseCacheApi()) {
    try {
      cache = await caches.open(CACHE_NAME);
    } catch {
      cache = null;
    }
  }

  const warmOne = async (url: string) => {
    try {
      if (cache && (await cache.match(url))) {
        await warmVinImage(url);
        return;
      }
      const response = await fetch(url, { credentials: "omit", mode: "same-origin" });
      if (!response.ok) return;
      if (cache) {
        try {
          await cache.put(url, response.clone());
        } catch {
          // private mode / quota
        }
      }
      await warmVinImage(url);
    } catch {
      // ignore individual prefetch failures
    }
  };

  for (let i = 0; i < proxied.length; i += PREFETCH_CONCURRENCY) {
    await Promise.all(proxied.slice(i, i + PREFETCH_CONCURRENCY).map(warmOne));
  }

  const nonProxied = windowUrls.filter((u) => !isProxiedVinImage(u));
  if (nonProxied.length) await warmVinImages(nonProxied);
}

export async function clearVinImageBrowserCache(): Promise<void> {
  if (!canUseCacheApi()) return;
  sessionLoadedUrls.clear();
  try {
    await caches.delete(CACHE_NAME);
  } catch {
    // ignore
  }
}
