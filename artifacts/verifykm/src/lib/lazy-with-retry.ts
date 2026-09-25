import { lazy, type ComponentType, type LazyExoticComponent } from "react";

export const CHUNK_RELOAD_KEY = "verifykm-chunk-reload";

const CHUNK_RETRY_DELAYS_MS = [300, 700, 1400] as const;
/** Soft full-page reloads after deploy / stale chunks — capped to avoid loops. */
const CHUNK_RELOAD_MAX = 3;
const CHUNK_RELOAD_WINDOW_MS = 180_000;
const CACHE_BUST_PARAM = "_kmr";

type ChunkReloadState = { count: number; at: number };

/** Prevents lazy + error-boundary from burning two reload slots for the same failure. */
let reloadInFlight = false;

/**
 * React.lazy wrapper that retries with backoff and reloads the page on stale chunk errors
 * (common after deploy when the user still has an old bundle open).
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await importWithInlineRetry(factory);
    } catch (error) {
      if (attemptChunkRecovery()) {
        // Reload is in flight; hang briefly so Suspense stays up. If navigation is blocked,
        // rethrow so the error boundary can show a refresh UI.
        await sleep(2_500);
      }
      throw error;
    }
  });
}

async function importWithInlineRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
): Promise<{ default: T }> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= CHUNK_RETRY_DELAYS_MS.length; attempt++) {
    try {
      const result = await factory();
      clearChunkReloadState();
      return result;
    } catch (error) {
      lastError = error;
      if (!isChunkLoadError(error)) throw error;
      const delay = CHUNK_RETRY_DELAYS_MS[attempt];
      if (delay == null) break;
      await sleep(delay);
    }
  }
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function readChunkReloadState(): ChunkReloadState | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CHUNK_RELOAD_KEY);
    if (!raw) return null;
    if (raw === "1") return { count: 1, at: Date.now() };
    const parsed = JSON.parse(raw) as Partial<ChunkReloadState>;
    if (typeof parsed.count !== "number" || typeof parsed.at !== "number") return null;
    return { count: parsed.count, at: parsed.at };
  } catch {
    return null;
  }
}

function writeChunkReloadState(state: ChunkReloadState): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, JSON.stringify(state));
  } catch { /* private browsing */ }
}

/** True when a full-page reload may still help recover a stale/missing chunk. */
export function shouldAttemptChunkReload(): boolean {
  if (typeof window === "undefined") return false;
  const now = Date.now();
  const state = readChunkReloadState();
  if (!state) {
    writeChunkReloadState({ count: 1, at: now });
    return true;
  }
  if (now - state.at > CHUNK_RELOAD_WINDOW_MS) {
    writeChunkReloadState({ count: 1, at: now });
    return true;
  }
  if (state.count >= CHUNK_RELOAD_MAX) return false;
  writeChunkReloadState({ count: state.count + 1, at: state.at });
  return true;
}

export function clearChunkReloadState(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch { /* private browsing */ }
}

function withCacheBust(href: string): string {
  try {
    const url = new URL(href, window.location.origin);
    url.searchParams.delete(CACHE_BUST_PARAM);
    url.searchParams.set(CACHE_BUST_PARAM, String(Date.now()));
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}

async function clearStaleCaches(): Promise<void> {
  try {
    if (typeof caches === "undefined") return;
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  } catch { /* ignore */ }
}

/** Cache-busting navigation so we do not keep a stale index.html that points at deleted chunks. */
export function triggerChunkReload(): void {
  if (typeof window === "undefined") return;
  void clearStaleCaches().finally(() => {
    try {
      window.location.replace(withCacheBust(window.location.href));
    } catch {
      window.location.reload();
    }
  });
}

/** Record a reload attempt and navigate; returns false when the cap is exhausted. */
export function attemptChunkRecovery(): boolean {
  if (typeof window === "undefined") return false;
  if (reloadInFlight) return true;
  if (!shouldAttemptChunkReload()) return false;
  reloadInFlight = true;
  triggerChunkReload();
  return true;
}

export function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  const lower = msg.toLowerCase().trim();
  const name = error instanceof Error ? error.name : "";

  // Safari / Firefox module-script failures — exact phrases only (do NOT match generic API fetch).
  if (lower === "load failed") return true;
  if (lower === "networkerror when attempting to fetch resource.") return true;

  return (
    name === "ChunkLoadError"
    || lower.includes("failed to fetch dynamically imported module")
    || lower.includes("error fetching dynamically imported module")
    || lower.includes("importing a module script failed")
    || lower.includes("error loading dynamically imported module")
    || lower.includes("failed to load module script")
    || lower.includes("unable to preload css")
    || lower.includes("loading chunk")
    || lower.includes("loading css chunk")
    || lower.includes("dynamically imported module")
    // Server returned index.html (SPA fallback) for a missing .js chunk after deploy.
    || lower.includes("unexpected token '<'")
    || lower.includes("expected a javascript")
    || (lower.includes("mime") && lower.includes("text/html"))
  );
}

/** One-shot full page reload when a lazy chunk fails outside React.lazy (e.g. dynamic import in charts). */
let chunkRecoveryInstalled = false;

export function installChunkLoadRecovery(): void {
  if (typeof window === "undefined" || chunkRecoveryInstalled) return;
  chunkRecoveryInstalled = true;
  reloadInFlight = false;

  // Drop leftover cache-bust query so recovered URLs stay clean.
  // Do NOT clear reload state here — only a successful import clears it (avoids infinite loops).
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has(CACHE_BUST_PARAM)) {
      url.searchParams.delete(CACHE_BUST_PARAM);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  } catch { /* ignore */ }

  const tryReload = (error: unknown) => {
    if (!isChunkLoadError(error)) return;
    attemptChunkRecovery();
  };

  window.addEventListener("error", (event) => {
    tryReload(event.error ?? event.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    tryReload(event.reason);
  });
}
