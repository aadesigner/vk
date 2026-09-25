import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

export type CachedVinImage = {
  contentType: string;
  body: Buffer;
};

export type VinImageDiskHit = {
  contentType: string;
  bodyPath: string;
  byteLength: number;
};

const isProduction = process.env.NODE_ENV === "production";

const CACHE_DIR =
  process.env.VIN_IMAGE_CACHE_DIR?.trim() ||
  path.join(process.cwd(), ".cache", "vin-images");

const inflight = new Map<string, Promise<CachedVinImage>>();
const MEMORY_CACHE_MAX_ENTRIES = Math.max(
  1,
  Number(
    process.env.VIN_IMAGE_MEMORY_CACHE_MAX_ENTRIES
    ?? (isProduction ? 16 : 24),
  ) || (isProduction ? 16 : 24),
);
/** Hot-fetch RAM cap — disk cache + streaming serves repeat traffic without heap copies. */
const MEMORY_CACHE_MAX_BYTES = Math.max(
  256 * 1024,
  Number(
    process.env.VIN_IMAGE_MEMORY_CACHE_MAX_BYTES
    ?? (isProduction ? 16 * 1024 * 1024 : 32 * 1024 * 1024),
  ) || (isProduction ? 16 * 1024 * 1024 : 32 * 1024 * 1024),
);

const memoryCache = new Map<string, CachedVinImage>();
let memoryCacheBytes = 0;

function rememberInMemory(url: string, image: CachedVinImage): void {
  const existing = memoryCache.get(url);
  if (existing) {
    memoryCacheBytes -= existing.body.length;
    memoryCache.delete(url);
  }
  memoryCache.set(url, image);
  memoryCacheBytes += image.body.length;

  while (
    memoryCache.size > MEMORY_CACHE_MAX_ENTRIES
    || memoryCacheBytes > MEMORY_CACHE_MAX_BYTES
  ) {
    const oldest = memoryCache.keys().next().value;
    if (!oldest) break;
    const evicted = memoryCache.get(oldest);
    if (evicted) memoryCacheBytes -= evicted.body.length;
    memoryCache.delete(oldest);
  }
}

function forgetInMemory(url: string): void {
  const existing = memoryCache.get(url);
  if (!existing) return;
  memoryCacheBytes -= existing.body.length;
  memoryCache.delete(url);
}

function cacheKeyForUrl(url: string): string {
  return crypto.createHash("sha256").update(url).digest("hex");
}

function pathsForUrl(url: string): { bodyPath: string; metaPath: string } {
  const key = cacheKeyForUrl(url);
  return {
    bodyPath: path.join(CACHE_DIR, `${key}.bin`),
    metaPath: path.join(CACHE_DIR, `${key}.json`),
  };
}

const MAX_DISK_BYTES = Number(process.env.VIN_IMAGE_CACHE_MAX_BYTES ?? 400 * 1024 * 1024);

/** Global cap on concurrent upstream CDN fetches (protects Node under unlock spikes). */
const MAX_UPSTREAM_CONCURRENCY = Math.max(
  1,
  Number(process.env.VIN_IMAGE_UPSTREAM_CONCURRENCY ?? (isProduction ? 12 : 8)) || 12,
);

let upstreamActive = 0;
const upstreamWaiters: Array<() => void> = [];

export async function withVinImageUpstreamSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (upstreamActive >= MAX_UPSTREAM_CONCURRENCY) {
    await new Promise<void>((resolve) => {
      upstreamWaiters.push(resolve);
    });
  }
  upstreamActive += 1;
  try {
    return await fn();
  } finally {
    upstreamActive -= 1;
    const next = upstreamWaiters.shift();
    if (next) next();
  }
}

type DiskCacheEntry = {
  bodyPath: string;
  metaPath: string;
  size: number;
  mtimeMs: number;
};

async function ensureCacheDir(): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

async function listDiskCacheEntries(): Promise<DiskCacheEntry[]> {
  await ensureCacheDir();
  let files: string[];
  try {
    files = await fs.readdir(CACHE_DIR);
  } catch {
    return [];
  }

  const entries: DiskCacheEntry[] = [];
  for (const file of files) {
    if (!file.endsWith(".bin")) continue;
    const bodyPath = path.join(CACHE_DIR, file);
    const metaPath = path.join(CACHE_DIR, file.replace(/\.bin$/, ".json"));
    try {
      const [bodyStat, metaStat] = await Promise.all([fs.stat(bodyPath), fs.stat(metaPath)]);
      entries.push({
        bodyPath,
        metaPath,
        size: bodyStat.size + metaStat.size,
        mtimeMs: Math.max(bodyStat.mtimeMs, metaStat.mtimeMs),
      });
    } catch {
      // skip incomplete pairs
    }
  }
  return entries;
}

async function evictDiskCacheIfNeeded(): Promise<void> {
  if (!Number.isFinite(MAX_DISK_BYTES) || MAX_DISK_BYTES <= 0) return;
  let entries = await listDiskCacheEntries();
  let total = entries.reduce((sum, entry) => sum + entry.size, 0);
  if (total <= MAX_DISK_BYTES) return;

  entries.sort((a, b) => a.mtimeMs - b.mtimeMs);
  for (const entry of entries) {
    if (total <= MAX_DISK_BYTES) break;
    await Promise.allSettled([fs.unlink(entry.bodyPath), fs.unlink(entry.metaPath)]);
    total -= entry.size;
  }
}

/** Raw upstream photo URLs stored on VIN lookup / catalog rows. */
export function extractVinPhotoUrls(data: unknown): string[] {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  const record = data as Record<string, unknown>;
  const urls = new Set<string>();
  if (typeof record.thumbnailUrl === "string" && record.thumbnailUrl) {
    urls.add(record.thumbnailUrl);
  }
  if (Array.isArray(record.photos)) {
    for (const photo of record.photos) {
      if (typeof photo === "string" && photo) urls.add(photo);
    }
  }
  if (Array.isArray(record.photosHd)) {
    for (const photo of record.photosHd) {
      if (typeof photo === "string" && photo) urls.add(photo);
    }
  }
  if (Array.isArray(record.photos360Exterior)) {
    for (const photo of record.photos360Exterior) {
      if (typeof photo === "string" && photo) urls.add(photo);
    }
  }
  if (Array.isArray(record.photos360Interior)) {
    for (const photo of record.photos360Interior) {
      if (typeof photo === "string" && photo) urls.add(photo);
    }
  }
  return [...urls];
}

export function mediaVersionFromUpdatedAt(
  updatedAt: Date | string | null | undefined,
): number | undefined {
  if (!updatedAt) return undefined;
  const ms = updatedAt instanceof Date ? updatedAt.getTime() : new Date(updatedAt).getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

export function getMemoryCachedVinImage(url: string): CachedVinImage | null {
  return memoryCache.get(url) ?? null;
}

async function readVinImageDiskHit(url: string): Promise<VinImageDiskHit | null> {
  try {
    const { bodyPath, metaPath } = pathsForUrl(url);
    const [metaRaw, bodyStat] = await Promise.all([
      fs.readFile(metaPath, "utf8"),
      fs.stat(bodyPath),
    ]);
    const meta = JSON.parse(metaRaw) as { contentType?: string };
    if (!meta.contentType || bodyStat.size <= 0) return null;
    return {
      contentType: meta.contentType,
      bodyPath,
      byteLength: bodyStat.size,
    };
  } catch {
    return null;
  }
}

export async function readVinImageCache(url: string): Promise<CachedVinImage | null> {
  const mem = memoryCache.get(url);
  if (mem) return mem;
  const disk = await readVinImageDiskHit(url);
  if (!disk) return null;
  try {
    const body = await fs.readFile(disk.bodyPath);
    if (!body.length) return null;
    return { contentType: disk.contentType, body };
  } catch {
    return null;
  }
}

/** Disk metadata for streaming — avoids loading multi-MB buffers on cache hits. */
export async function getVinImageDiskHit(url: string): Promise<VinImageDiskHit | null> {
  return readVinImageDiskHit(url);
}

export async function resolveVinImageDiskHit(url: string): Promise<VinImageDiskHit | null> {
  if (memoryCache.has(url)) return null;
  return readVinImageDiskHit(url);
}

export async function writeVinImageCache(
  url: string,
  contentType: string,
  body: Buffer,
): Promise<void> {
  if (!body.length) return;
  await ensureCacheDir();
  const { bodyPath, metaPath } = pathsForUrl(url);
  const tmpBody = `${bodyPath}.${process.pid}.tmp`;
  const tmpMeta = `${metaPath}.${process.pid}.tmp`;
  await fs.writeFile(tmpBody, body);
  await fs.writeFile(tmpMeta, JSON.stringify({ contentType, upstreamUrl: url, savedAt: Date.now() }));
  await fs.rename(tmpBody, bodyPath);
  await fs.rename(tmpMeta, metaPath);
  await evictDiskCacheIfNeeded();
}

export async function invalidateVinImageCache(urls: string[]): Promise<void> {
  const unique = [...new Set(urls.filter(Boolean))];
  await Promise.all(unique.map(async (url) => {
    inflight.delete(url);
    forgetInMemory(url);
    const { bodyPath, metaPath } = pathsForUrl(url);
    await Promise.allSettled([fs.unlink(bodyPath), fs.unlink(metaPath)]);
  }));
}

export async function invalidateVinImagesFromData(data: unknown): Promise<void> {
  await invalidateVinImageCache(extractVinPhotoUrls(data));
}

/** Disk cache with in-flight dedupe — one upstream fetch per URL at a time. */
export async function getOrFetchVinImage(
  url: string,
  fetcher: () => Promise<CachedVinImage>,
): Promise<CachedVinImage> {
  const cached = await readVinImageCache(url);
  if (cached) return cached;

  const existing = inflight.get(url);
  if (existing) return existing;

  const promise = fetcher()
    .then(async (image) => {
      rememberInMemory(url, image);
      await writeVinImageCache(url, image.contentType, image.body);
      return image;
    })
    .finally(() => {
      inflight.delete(url);
    });

  inflight.set(url, promise);
  return promise;
}
