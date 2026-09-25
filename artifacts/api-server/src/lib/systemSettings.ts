import { db, systemSettingsTable, type SystemSettings } from "@workspace/db";
import { desc, eq, ne } from "drizzle-orm";
import { mergeMissingCredentials } from "./oauthSettings.js";

function trimmed(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

/** True when the latest row may still need credential fields from older rows. */
function latestRowMayNeedCredentialMerge(row: SystemSettings): boolean {
  return !trimmed(row.googleClientId)
    || !trimmed(row.googleClientSecret)
    || !trimmed(row.facebookAppId)
    || !trimmed(row.facebookAppSecret)
    || !trimmed(row.paypalClientId)
    || !trimmed(row.paypalClientSecret)
    || !trimmed((row as SystemSettings & { pokMerchantId?: string | null }).pokMerchantId)
    || !trimmed((row as SystemSettings & { pokKeyId?: string | null }).pokKeyId)
    || !trimmed((row as SystemSettings & { pokKeySecret?: string | null }).pokKeySecret)
    || !trimmed(row.recaptchaSecretKey)
    || !trimmed(row.smtpPass);
}

/** Latest settings row (highest id). */
export async function getLatestSystemSettings(): Promise<SystemSettings | null> {
  const [row] = await db
    .select()
    .from(systemSettingsTable)
    .orderBy(desc(systemSettingsTable.id))
    .limit(1);
  return row ?? null;
}

/**
 * Prefer the newest row, but inherit credentials from older rows when a partial
 * insert left the latest row without them (e.g. email-template-only row).
 */
export async function getEffectiveSystemSettings(): Promise<SystemSettings | null> {
  const latest = await getLatestSystemSettings();
  if (!latest) return null;
  if (!latestRowMayNeedCredentialMerge(latest)) return latest;

  const olderRows = await db
    .select()
    .from(systemSettingsTable)
    .where(ne(systemSettingsTable.id, latest.id))
    .orderBy(desc(systemSettingsTable.id))
    .limit(20);

  if (olderRows.length === 0) return latest;

  let merged = latest;
  for (const row of olderRows) {
    merged = mergeMissingCredentials(merged, row);
  }
  return merged;
}

/** Merge orphan settings rows into the canonical row and delete duplicates. */
export async function consolidateSystemSettingsRows(): Promise<void> {
  const rows = await db
    .select()
    .from(systemSettingsTable)
    .orderBy(desc(systemSettingsTable.id));

  if (rows.length <= 1) return;

  const [canonical, ...older] = rows;
  const merged: SystemSettings = { ...canonical };

  for (const row of older) {
    if (!merged.paypalClientId?.trim() && row.paypalClientId?.trim()) {
      merged.paypalClientId = row.paypalClientId;
    }
    if (!merged.paypalClientSecret?.trim() && row.paypalClientSecret?.trim()) {
      merged.paypalClientSecret = row.paypalClientSecret;
    }
    const m = merged as SystemSettings & {
      pokMerchantId?: string | null;
      pokKeyId?: string | null;
      pokKeySecret?: string | null;
      pokEnv?: string | null;
    };
    const r = row as typeof m;
    if (!m.pokMerchantId?.trim() && r.pokMerchantId?.trim()) m.pokMerchantId = r.pokMerchantId;
    if (!m.pokKeyId?.trim() && r.pokKeyId?.trim()) m.pokKeyId = r.pokKeyId;
    if (!m.pokKeySecret?.trim() && r.pokKeySecret?.trim()) m.pokKeySecret = r.pokKeySecret;
    if (!merged.googleClientId?.trim() && row.googleClientId?.trim()) {
      merged.googleClientId = row.googleClientId;
    }
    if (!merged.recaptchaSecretKey?.trim() && row.recaptchaSecretKey?.trim()) {
      merged.recaptchaSecretKey = row.recaptchaSecretKey;
    }
    if (!merged.googleClientSecret?.trim() && row.googleClientSecret?.trim()) {
      merged.googleClientSecret = row.googleClientSecret;
    }
    if (!merged.facebookAppId?.trim() && row.facebookAppId?.trim()) {
      merged.facebookAppId = row.facebookAppId;
    }
    if (!merged.facebookAppSecret?.trim() && row.facebookAppSecret?.trim()) {
      merged.facebookAppSecret = row.facebookAppSecret;
    }
    if (!merged.smtpPass?.trim() && row.smtpPass?.trim()) {
      merged.smtpPass = row.smtpPass;
    }
  }

  await db
    .update(systemSettingsTable)
    .set({
      paypalClientId: merged.paypalClientId,
      paypalClientSecret: merged.paypalClientSecret,
      paypalSandbox: merged.paypalSandbox,
      paypalEnableCards: merged.paypalEnableCards,
      pokMerchantId: (merged as SystemSettings & { pokMerchantId?: string | null }).pokMerchantId,
      pokKeyId: (merged as SystemSettings & { pokKeyId?: string | null }).pokKeyId,
      pokKeySecret: (merged as SystemSettings & { pokKeySecret?: string | null }).pokKeySecret,
      pokEnv: (merged as SystemSettings & { pokEnv?: string | null }).pokEnv ?? "production",
      googleClientId: merged.googleClientId,
      recaptchaSecretKey: merged.recaptchaSecretKey,
      googleClientSecret: merged.googleClientSecret,
      facebookAppId: merged.facebookAppId,
      facebookAppSecret: merged.facebookAppSecret,
      smtpPass: merged.smtpPass,
      updatedAt: new Date(),
    })
    .where(eq(systemSettingsTable.id, canonical.id));

  for (const row of older) {
    await db.delete(systemSettingsTable).where(eq(systemSettingsTable.id, row.id));
  }
}
