import { db, systemSettingsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { logger } from "./logger.js";

/**
 * Admin toggle for Carstat VHR V2 on the Providers page.
 * Default false — must be explicitly enabled (uses paid VHR credits).
 */
let enabledCache = false;
let lastFetch = 0;
const TTL_MS = 15_000;
let fetchPromise: Promise<void> | null = null;

async function refresh(): Promise<void> {
  try {
    const [row] = await db
      .select({ carstatVhrApiEnabled: systemSettingsTable.carstatVhrApiEnabled })
      .from(systemSettingsTable)
      .orderBy(desc(systemSettingsTable.id))
      .limit(1);
    if (row && typeof row.carstatVhrApiEnabled === "boolean") {
      enabledCache = row.carstatVhrApiEnabled;
    }
    lastFetch = Date.now();
  } catch (err) {
    logger.warn({ err }, "carstatVhrApiSettingsCache: failed to refresh");
  } finally {
    fetchPromise = null;
  }
}

export async function ensureCarstatVhrApiEnabledLoaded(): Promise<boolean> {
  if (Date.now() - lastFetch > TTL_MS) {
    if (!fetchPromise) fetchPromise = refresh();
    await fetchPromise;
  }
  return enabledCache;
}

export function isCarstatVhrApiEnabledCached(): boolean {
  return enabledCache;
}

export function invalidateCarstatVhrApiSettingsCache(): void {
  lastFetch = 0;
}

export function setCarstatVhrApiEnabledCache(enabled: boolean): void {
  enabledCache = enabled;
  lastFetch = Date.now();
}
