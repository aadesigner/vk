import { db, systemSettingsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { logger } from "./logger.js";
import { normalizeMaintenanceRestrictions } from "./maintenancePolicy.js";
import type { MaintenancePartialRestriction } from "./maintenancePolicy.js";

type CachedSettings = {
  registerMaxPerHour: number;
  vinRatePerMinute: number;
  maxFailedLogins: number;
  lockoutMinutes: number;
  adminMaxFailedLogins: number;
  adminLockoutMinutes: number;
  recaptchaMinScore: number;
  maintenanceMode: boolean;
  maintenanceRestrictions: MaintenancePartialRestriction[];
  maintenanceMessage: string | null;
};

const DEFAULTS: CachedSettings = {
  registerMaxPerHour: 5,
  vinRatePerMinute: 20,
  maxFailedLogins: 5,
  lockoutMinutes: 30,
  adminMaxFailedLogins: 3,
  adminLockoutMinutes: 30,
  recaptchaMinScore: 0.5,
  maintenanceMode: false,
  maintenanceRestrictions: [],
  maintenanceMessage: null,
};

let cache: CachedSettings = { ...DEFAULTS };
let lastFetch = 0;
const TTL_MS = 60_000;
let fetchPromise: Promise<void> | null = null;

async function refresh(): Promise<void> {
  try {
    const [row] = await db
      .select({
        registerMaxPerHour: systemSettingsTable.registerMaxPerHour,
        vinRatePerMinute: systemSettingsTable.vinRatePerMinute,
        maxFailedLogins: systemSettingsTable.maxFailedLogins,
        lockoutMinutes: systemSettingsTable.lockoutMinutes,
        adminMaxFailedLogins: systemSettingsTable.adminMaxFailedLogins,
        adminLockoutMinutes: systemSettingsTable.adminLockoutMinutes,
        recaptchaMinScore: systemSettingsTable.recaptchaMinScore,
        maintenanceMode: systemSettingsTable.maintenanceMode,
        maintenanceRestrictions: systemSettingsTable.maintenanceRestrictions,
        maintenanceMessage: systemSettingsTable.maintenanceMessage,
      })
      .from(systemSettingsTable)
      .orderBy(desc(systemSettingsTable.id))
      .limit(1);
    if (row) {
      cache = {
        registerMaxPerHour: row.registerMaxPerHour ?? DEFAULTS.registerMaxPerHour,
        vinRatePerMinute: row.vinRatePerMinute ?? DEFAULTS.vinRatePerMinute,
        maxFailedLogins: row.maxFailedLogins ?? DEFAULTS.maxFailedLogins,
        lockoutMinutes: row.lockoutMinutes ?? DEFAULTS.lockoutMinutes,
        adminMaxFailedLogins: row.adminMaxFailedLogins ?? DEFAULTS.adminMaxFailedLogins,
        adminLockoutMinutes: row.adminLockoutMinutes ?? DEFAULTS.adminLockoutMinutes,
        recaptchaMinScore: (row.recaptchaMinScore as unknown as number) ?? DEFAULTS.recaptchaMinScore,
        maintenanceMode: row.maintenanceMode ?? DEFAULTS.maintenanceMode,
        maintenanceRestrictions: normalizeMaintenanceRestrictions(row.maintenanceRestrictions),
        maintenanceMessage: row.maintenanceMessage?.trim() || null,
      };
    }
    lastFetch = Date.now();
  } catch (err) {
    logger.warn({ err }, "settingsCache: failed to refresh settings");
  } finally {
    fetchPromise = null;
  }
}

export async function getSettings(): Promise<CachedSettings> {
  if (Date.now() - lastFetch > TTL_MS) {
    if (!fetchPromise) fetchPromise = refresh();
    await fetchPromise;
  }
  return cache;
}

export function invalidateSettingsCache(): void {
  lastFetch = 0;
}
