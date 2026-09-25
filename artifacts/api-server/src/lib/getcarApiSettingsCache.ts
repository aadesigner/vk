import { db, systemSettingsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { logger } from "./logger.js";

/**
 * Admin toggle for GetCarAPI in the Providers page.
 * Default true so existing env-only installs keep working until an admin turns it off.
 */
let enabledCache = true;
let lastFetch = 0;
const TTL_MS = 15_000;
let fetchPromise: Promise<void> | null = null;

async function refresh(): Promise<void> {
  try {
    const [row] = await db
      .select({ getcarApiEnabled: systemSettingsTable.getcarApiEnabled })
      .from(systemSettingsTable)
      .orderBy(desc(systemSettingsTable.id))
      .limit(1);
    if (row && typeof row.getcarApiEnabled === "boolean") {
      enabledCache = row.getcarApiEnabled;
    }
    lastFetch = Date.now();
  } catch (err) {
    // Fail-open to previous cache (default true) so a DB blip does not invent "unavailable".
    logger.warn({ err }, "getcarApiSettingsCache: failed to refresh");
  } finally {
    fetchPromise = null;
  }
}

/** Refresh from DB when stale; call before check/retrieve. */
export async function ensureGetCarApiEnabledLoaded(): Promise<boolean> {
  if (Date.now() - lastFetch > TTL_MS) {
    if (!fetchPromise) fetchPromise = refresh();
    await fetchPromise;
  }
  return enabledCache;
}

/** Sync peek of cached flag (may be stale up to TTL unless invalidated). */
export function isGetCarApiEnabledCached(): boolean {
  return enabledCache;
}

export function invalidateGetCarApiSettingsCache(): void {
  lastFetch = 0;
}

/** Immediate write-through after admin PATCH (avoids waiting for TTL). */
export function setGetCarApiEnabledCache(enabled: boolean): void {
  enabledCache = enabled;
  lastFetch = Date.now();
}
