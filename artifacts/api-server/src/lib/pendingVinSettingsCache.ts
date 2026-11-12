import { logger } from "./logger.js";

/**
 * Admin toggle: allow paid checkout into pending_manual when providers have no record.
 * Default true preserves current VerifyKM behavior until an admin turns it off.
 */
let enabledCache = true;
let lastFetch = 0;
const TTL_MS = 15_000;
let fetchPromise: Promise<void> | null = null;

async function refresh(): Promise<void> {
  try {
    const { db, systemSettingsTable } = await import("@workspace/db");
    const { desc } = await import("drizzle-orm");
    const [row] = await db
      .select({ pendingVinEnabled: systemSettingsTable.pendingVinEnabled })
      .from(systemSettingsTable)
      .orderBy(desc(systemSettingsTable.id))
      .limit(1);
    if (row && typeof row.pendingVinEnabled === "boolean") {
      enabledCache = row.pendingVinEnabled;
    }
    lastFetch = Date.now();
  } catch (err) {
    // Fail-open to previous cache (default true) so a DB blip does not invent "no data".
    logger.warn({ err }, "pendingVinSettingsCache: failed to refresh");
  } finally {
    fetchPromise = null;
  }
}

/** Refresh from DB when stale; call before eligibility checks. */
export async function ensurePendingVinEnabledLoaded(): Promise<boolean> {
  if (Date.now() - lastFetch > TTL_MS) {
    if (!fetchPromise) fetchPromise = refresh();
    await fetchPromise;
  }
  return enabledCache;
}

export function isPendingVinEnabledCached(): boolean {
  return enabledCache;
}

export function invalidatePendingVinSettingsCache(): void {
  lastFetch = 0;
}

/** Immediate write-through after admin PATCH. */
export function setPendingVinEnabledCache(enabled: boolean): void {
  enabledCache = enabled;
  lastFetch = Date.now();
}
