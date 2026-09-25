import { db, systemSettingsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { logger } from "./logger.js";

export type FreeDecoderSettings = {
  freeVinDecoderEnabled: boolean;
  freeVinDecoderDailyLimit: number;
  freeVinDecoderRequireSignIn: boolean;
  recaptchaEnabled: boolean;
  recaptchaSecretKey: string | null;
  recaptchaMinScore: number;
};

const DEFAULTS: FreeDecoderSettings = {
  freeVinDecoderEnabled: true,
  freeVinDecoderDailyLimit: 0,
  freeVinDecoderRequireSignIn: false,
  recaptchaEnabled: false,
  recaptchaSecretKey: null,
  recaptchaMinScore: 0.5,
};

let cache: FreeDecoderSettings = { ...DEFAULTS };
let lastFetch = 0;
const TTL_MS = 60_000;
let fetchPromise: Promise<void> | null = null;

async function refresh(): Promise<void> {
  try {
    const [row] = await db
      .select({
        freeVinDecoderEnabled: systemSettingsTable.freeVinDecoderEnabled,
        freeVinDecoderDailyLimit: systemSettingsTable.freeVinDecoderDailyLimit,
        freeVinDecoderRequireSignIn: systemSettingsTable.freeVinDecoderRequireSignIn,
        recaptchaEnabled: systemSettingsTable.recaptchaEnabled,
        recaptchaSecretKey: systemSettingsTable.recaptchaSecretKey,
        recaptchaMinScore: systemSettingsTable.recaptchaMinScore,
      })
      .from(systemSettingsTable)
      .orderBy(desc(systemSettingsTable.id))
      .limit(1);
    if (row) {
      cache = {
        freeVinDecoderEnabled: row.freeVinDecoderEnabled ?? DEFAULTS.freeVinDecoderEnabled,
        freeVinDecoderDailyLimit: row.freeVinDecoderDailyLimit ?? DEFAULTS.freeVinDecoderDailyLimit,
        freeVinDecoderRequireSignIn: row.freeVinDecoderRequireSignIn ?? DEFAULTS.freeVinDecoderRequireSignIn,
        recaptchaEnabled: row.recaptchaEnabled ?? DEFAULTS.recaptchaEnabled,
        recaptchaSecretKey: row.recaptchaSecretKey?.trim() || null,
        recaptchaMinScore: (row.recaptchaMinScore as unknown as number) ?? DEFAULTS.recaptchaMinScore,
      };
    }
    lastFetch = Date.now();
  } catch (err) {
    logger.warn({ err }, "freeDecoderSettingsCache: failed to refresh");
  } finally {
    fetchPromise = null;
  }
}

export async function getFreeDecoderSettings(): Promise<FreeDecoderSettings> {
  if (Date.now() - lastFetch > TTL_MS) {
    if (!fetchPromise) fetchPromise = refresh();
    await fetchPromise;
  }
  return cache;
}

export function invalidateFreeDecoderSettingsCache(): void {
  lastFetch = 0;
}
