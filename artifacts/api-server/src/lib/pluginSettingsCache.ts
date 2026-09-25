import { db, systemSettingsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { logger } from "./logger.js";
import {
  DEFAULT_PLUGIN_SETTINGS,
  normalizePluginSettings,
  type PluginSettings,
} from "./pluginSettings.js";

let cache: PluginSettings = { ...DEFAULT_PLUGIN_SETTINGS };
let lastFetch = 0;
const TTL_MS = 60_000;
let fetchPromise: Promise<void> | null = null;

async function refresh(): Promise<void> {
  try {
    const [row] = await db
      .select({ pluginSettings: systemSettingsTable.pluginSettings })
      .from(systemSettingsTable)
      .orderBy(desc(systemSettingsTable.id))
      .limit(1);
    cache = normalizePluginSettings(row?.pluginSettings);
    lastFetch = Date.now();
  } catch (err) {
    logger.warn({ err }, "pluginSettingsCache: failed to refresh");
  } finally {
    fetchPromise = null;
  }
}

export async function getPluginSettings(): Promise<PluginSettings> {
  if (Date.now() - lastFetch > TTL_MS) {
    if (!fetchPromise) fetchPromise = refresh();
    await fetchPromise;
  }
  return cache;
}

export function invalidatePluginSettingsCache(): void {
  lastFetch = 0;
}
