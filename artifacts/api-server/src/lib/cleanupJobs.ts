import { db, systemLogsTable, loginAttemptsTable, systemSettingsTable, paymentsTable, emailLogsTable } from "@workspace/db";
import { lt, desc, and, eq, inArray } from "drizzle-orm";
import { logger } from "./logger.js";
import { EMAIL_LOG_RETENTION_DAYS } from "./emailLog.js";

/** Default retention for new installs; existing rows with 0 are migrated to this on startup. */
export const DEFAULT_LOG_RETENTION_DAYS = 4;

async function getSettings() {
  const [s] = await db
    .select({
      logRetentionDays: systemSettingsTable.logRetentionDays,
      failedTxnRetentionDays: systemSettingsTable.failedTxnRetentionDays,
      emailLogRetentionEnabled: systemSettingsTable.emailLogRetentionEnabled,
    })
    .from(systemSettingsTable)
    .orderBy(desc(systemSettingsTable.id))
    .limit(1);
  return s ?? {
    logRetentionDays: DEFAULT_LOG_RETENTION_DAYS,
    failedTxnRetentionDays: 0,
    emailLogRetentionEnabled: true,
  };
}

export async function purgeEmailLogs(days = EMAIL_LOG_RETENTION_DAYS): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86400 * 1000);
  let total = 0;
  for (;;) {
    const rows = await db
      .select({ id: emailLogsTable.id })
      .from(emailLogsTable)
      .where(lt(emailLogsTable.createdAt, cutoff))
      .limit(500);
    if (rows.length === 0) break;
    await db.delete(emailLogsTable).where(
      inArray(emailLogsTable.id, rows.map((r) => r.id)),
    );
    total += rows.length;
    if (rows.length < 500) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  return total;
}

async function purgeLogs(days: number): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86400 * 1000);
  let total = 0;
  for (;;) {
    const rows = await db
      .select({ id: systemLogsTable.id })
      .from(systemLogsTable)
      .where(lt(systemLogsTable.createdAt, cutoff))
      .limit(500);
    if (rows.length === 0) break;
    await db.delete(systemLogsTable).where(
      inArray(systemLogsTable.id, rows.map((r) => r.id)),
    );
    total += rows.length;
    if (rows.length < 500) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  return total;
}

async function purgeFailedTransactions(days: number): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86400 * 1000);
  let total = 0;
  for (;;) {
    const rows = await db
      .select({ id: paymentsTable.id })
      .from(paymentsTable)
      .where(and(eq(paymentsTable.status, "failed"), lt(paymentsTable.createdAt, cutoff)))
      .limit(500);
    if (rows.length === 0) break;
    await db.delete(paymentsTable).where(
      inArray(paymentsTable.id, rows.map((r) => r.id)),
    );
    total += rows.length;
    if (rows.length < 500) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  return total;
}

async function purgeOldLoginAttempts(): Promise<void> {
  const cutoff = new Date(Date.now() - 7 * 86400 * 1000);
  await db.delete(loginAttemptsTable).where(lt(loginAttemptsTable.attemptedAt, cutoff));
}

export async function runCleanupJobs(): Promise<void> {
  try {
    const settings = await getSettings();

    void purgeOldLoginAttempts().catch((e) =>
      logger.warn({ err: e }, "cleanup: login_attempts purge failed"),
    );

    const logDays = settings.logRetentionDays > 0
      ? settings.logRetentionDays
      : DEFAULT_LOG_RETENTION_DAYS;
    const n = await purgeLogs(logDays);
    if (n > 0) logger.info({ count: n, days: logDays }, "cleanup: system_logs purged");

    if (settings.failedTxnRetentionDays > 0) {
      const n = await purgeFailedTransactions(settings.failedTxnRetentionDays);
      if (n > 0) logger.info({ count: n, days: settings.failedTxnRetentionDays }, "cleanup: failed payments purged");
    }

    if (settings.emailLogRetentionEnabled) {
      const n = await purgeEmailLogs();
      if (n > 0) logger.info({ count: n, days: EMAIL_LOG_RETENTION_DAYS }, "cleanup: email_logs purged");
    }
  } catch (err) {
    logger.warn({ err }, "cleanup jobs failed");
  }
}

export function scheduleCleanupJobs(): void {
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  setTimeout(() => {
    void runCleanupJobs();
    setInterval(() => void runCleanupJobs(), SIX_HOURS);
  }, 30_000);
}
