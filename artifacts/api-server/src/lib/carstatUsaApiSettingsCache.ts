import { db, systemSettingsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { logger } from "./logger.js";

/**
 * Admin toggle for Carstat USA API (Carfax/AutoCheck PDF) on the Providers page.
 * Default false — must be explicitly enabled (uses paid Carstat report credits).
 */
let enabledCache = false;
let lastFetch = 0;
const TTL_MS = 15_000;
let fetchPromise: Promise<void> | null = null;

async function refresh(): Promise<void> {
  try {
    const [row] = await db
      .select({ carstatUsaApiEnabled: systemSettingsTable.carstatUsaApiEnabled })
      .from(systemSettingsTable)
      .orderBy(desc(systemSettingsTable.id))
      .limit(1);
    if (row && typeof row.carstatUsaApiEnabled === "boolean") {
      enabledCache = row.carstatUsaApiEnabled;
    }
    lastFetch = Date.now();
  } catch (err) {
    logger.warn({ err }, "carstatUsaApiSettingsCache: failed to refresh");
  } finally {
    fetchPromise = null;
  }
}

export async function ensureCarstatUsaApiEnabledLoaded(): Promise<boolean> {
  if (Date.now() - lastFetch > TTL_MS) {
    if (!fetchPromise) fetchPromise = refresh();
    await fetchPromise;
  }
  return enabledCache;
}

export function isCarstatUsaApiEnabledCached(): boolean {
  return enabledCache;
}

export function invalidateCarstatUsaApiSettingsCache(): void {
  lastFetch = 0;
}

export function setCarstatUsaApiEnabledCache(enabled: boolean): void {
  enabledCache = enabled;
  lastFetch = Date.now();
}
