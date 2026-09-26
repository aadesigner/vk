import { mapInBatches } from "../lib/batchAsync.js";
import { adminEmailMatches } from "../lib/adminBootstrap.js";
import express, { Router } from "express";
import multer from "multer";
import { parse as csvParse } from "csv-parse";
import { createReadStream, unlink } from "fs";
import { readFile } from "fs/promises";
import { tmpdir } from "os";
import { db, usersTable, vinLookupsTable, vinCatalogTable, paymentsTable, providersTable, pricingTable, systemSettingsTable, systemLogsTable, emailLogsTable, EMAIL_LOG_TYPES, couponsTable, passwordResetTokensTable, loginAttemptsTable, announcementsTable, pendingVinChecksTable, pendingVinCheckRequestsTable, DEFAULT_PRICING, normalizePricingAmounts } from "@workspace/db";
import { eq, desc, count, sum, sql, gte, like, ilike, lte, and, inArray, gt, or, lt, exists, not, ne, isNull } from "drizzle-orm";
import { requireAdmin, requireAdminAuth, hashPassword, clampSessionDays } from "../lib/auth";
import {
  ADMIN_UNLOCK_DAYS,
  attemptAdminAreaUnlock,
  clearAdminUnlockCookie,
  hasValidAdminUnlock,
  isAdminAreaPinEnabled,
  isAdminPinLockedOut,
  setAdminUnlockCookie,
} from "../lib/adminAreaUnlock.js";
import { clientIpKey } from "../lib/trustedClient.js";
import { fetchFromProvider, checkVinDeliverable, grantVinReportToUser, syncStampedCatalogToAllLookups, wipeRemovedCatalogVin, wipeRemovedCatalogVins, type VinExternalSource } from "../lib/vinService";
import { GETCARAPI_PROVIDER_NAME, GETCARAPI_DATA_SOURCE, resolveGetCarApiConfig } from "../lib/getcarApi.js";
import { extractVinPhotoUrls, invalidateVinImageCache } from "../lib/vinImageCache.js";
import {
  catalogDataFromCsvRecord,
  catalogDataFromCsvRow,
  catalogDataToCsvCells,
  catalogIdentityConflict,
  buildCatalogJsonExportRecord,
  CATALOG_CSV_COLUMNS,
  formatCatalogIdentity,
  applyCatalogAdminPatch,
  mergeCatalogData,
  normalizeJsonImportRecord,
  sanitizeCatalogPayload,
  preserveAdminTaxiFlag,
  dedupeCatalogImportRows,
  stampCatalogImportData,
  type JsonImportRecord,
} from "../lib/vinCatalogImport.js";
import { logger } from "../lib/logger";
import { makeTtlCache } from "../lib/ttlCache.js";
import { fetchOnlinePresenceStats, fetchPresenceUsersPage, type PresencePeriod } from "../lib/userPresence.js";
import {
  getAdminAnalyticsCached,
  invalidateAdminAnalyticsCache,
  parseAnalyticsPeriod,
} from "../lib/adminAnalytics.js";
import {
  buildPaymentsByMethodPeriods,
  buildSalesAttributionPeriods,
  buildSignupsByChannelPeriods,
  buildSignupsByCountryPeriods,
  buildCountryCountPeriods,
  normalizeDailyCounts,
  normalizeDailyRevenue,
  normalizePaymentStatusCounts,
  normalizeRecentPayments,
  sliceSeriesFrom,
  utcDateIsoDaysAgo,
} from "../lib/adminStats.js";
import { forEachJsonArrayRecord } from "../lib/streamJsonArray.js";
import { runCleanupJobs } from "../lib/cleanupJobs.js";
import { invalidateSettingsCache } from "../lib/settingsCache.js";
import { invalidateFreeDecoderSettingsCache } from "../lib/freeDecoderSettingsCache.js";
import {
  invalidateGetCarApiSettingsCache,
  setGetCarApiEnabledCache,
} from "../lib/getcarApiSettingsCache.js";
import { getEffectiveSystemSettings } from "../lib/systemSettings.js";
import { sanitizeAdminSettings } from "../lib/adminSettings.js";
import {
  applySocialLoginTestOverrides,
  resolveSiteOrigin,
  runAllSocialLoginTests,
  type SocialLoginTestOverrides,
} from "../lib/oauthSocialLoginTest.js";
import {
  listPendingVinChecksForAdmin,
  getPendingVinCheckById,
  savePendingVinCheckDraft,
  publishPendingVinCheck,
  removePendingVinCheck,
  removePendingVinCheckAsRefunded,
  creditNoInfoAndRemovePendingVinCheck,
  buildPendingVinExportPayload,
  importPendingVinDraftFromJson,
  buildAllPendingVinExportPayload,
  importPendingVinDraftsFromJson,
  prepareManualPublishCatalogData,
  finalizeAdminCatalogSave,
  detectAdminCatalogMileageTouched,
  reconcileLockedOdometerData,
} from "../lib/pendingVinService.js";
import { ADMIN_CONFIRM_PHRASES, requireConfirmPhrase } from "../lib/adminDestructive.js";
import {
  loadBackupFromUploadPath,
  restoreBackupPayload,
  streamBackupExport,
} from "../lib/adminBackup.js";
import { consumeAdminProviderAction, adminProviderRateLimitMessage } from "../lib/adminProviderRateLimit.js";
import { validateBoundedSettingsPatch, validateAnnouncementLinkUrl, validateSmtpSecurity } from "../lib/adminValidation.js";
import { normalizeSmtpSecurity } from "../lib/smtpSecurity.js";
import {
  listAccessBlocks,
  addIpBlock,
  addCountryBlock,
  removeAccessBlock,
  blockDevicesForBannedUser,
  removeUserBanIpBlocks,
  syncAccessBlocksForBannedUsers,
} from "../lib/accessBlocks.js";
import { normalizeMaintenanceRestrictions, normalizeMaintenanceMessage } from "../lib/maintenancePolicy.js";
import {
  recordedTransactionWhere,
  paymentHasFulfilledLookup,
  sumCollectedRevenue,
  SQL_COLLECTED_REVENUE_ROW_FILTER,
} from "../lib/recordedPayments.js";
import { invalidateAdminStatsCache, registerAdminStatsInvalidationHook } from "../lib/adminStatsInvalidation.js";
import { validateAnalyticsSettingsPatch, validateAnalyticsSettingsMerged } from "../lib/analyticsIds.js";
import { validateProviderBaseUrl } from "../lib/providerUrl.js";
import rateLimit from "express-rate-limit";
import { invalidateCountriesCache, SUPPORTED_COUNTRY_CODES } from "./countries.js";
import { invalidateAnnouncementsCache } from "./announcements.js";
import {
  applyFrozenKrwPerUsd,
  getCurrentKrwPerUsd,
  readFrozenKrwPerUsd,
} from "../lib/krwRate.js";
import { invalidatePricingCache, invalidatePublicSettingsCache } from "./payments.js";
import { clearPokTokenCache } from "../lib/pokClient.js";
import { invalidatePluginSettingsCache } from "../lib/pluginSettingsCache.js";
import { parseUserCountryCode } from "../lib/userCountry.js";
import { parseUserPhone } from "../lib/userPhone.js";
import {
  DEFAULT_PLUGIN_SETTINGS,
  normalizePluginSettings,
  type PluginSettings,
} from "../lib/pluginSettings.js";
import crypto from "crypto";

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tmpdir()),
    filename: (_req, file, cb) => {
      const ext = file.originalname?.toLowerCase().endsWith(".json") ? ".json" : ".csv";
      cb(null, `vin-import-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const backupUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tmpdir()),
    filename: (_req, file, cb) => {
      const name = (file.originalname ?? "backup").toLowerCase();
      const ext = name.endsWith(".json.gz")
        ? ".json.gz"
        : name.endsWith(".gz")
          ? ".gz"
          : ".json";
      cb(null, `verifykm-backup-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  // Keep RAM/disk safe on Railway — matches BACKUP_UPLOAD_MAX_BYTES
  limits: { fileSize: 100 * 1024 * 1024 },
});

const userImportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "Too many user import attempts. Try again in an hour." },
  standardHeaders: true,
  legacyHeaders: false,
});

const backupImportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: "Too many backup restore attempts. Try again in an hour." },
  standardHeaders: true,
  legacyHeaders: false,
});

const backupExportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 6,
  message: { error: "Too many backup exports. Try again in an hour." },
  standardHeaders: true,
  legacyHeaders: false,
});

function requireAdminProviderBudget(req: express.Request, res: express.Response): boolean {
  const adminId = req.userId;
  if (!adminId || !consumeAdminProviderAction(adminId)) {
    res.status(429).json({ error: adminProviderRateLimitMessage() });
    return false;
  }
  return true;
}

/** Prefer GetCarAPI when the row was sourced from it (providerName or data.dataSource). */
function resolveAdminRefreshSource(
  providerName: string | null | undefined,
  data: unknown,
): VinExternalSource {
  const pn = String(providerName ?? "").trim().toLowerCase();
  if (pn === GETCARAPI_PROVIDER_NAME) return "getcarapi";
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  const ds = record?.dataSource;
  if (typeof ds === "string" && ds.trim().toLowerCase() === GETCARAPI_DATA_SOURCE) {
    return "getcarapi";
  }
  return "carstat";
}

async function loadActiveCarstatProvider(): Promise<{
  name: string;
  baseUrl: string;
  apiKey: string;
} | null> {
  const providers = await db.select().from(providersTable).where(eq(providersTable.isActive, true)).limit(1);
  const provider = providers[0];
  if (!provider?.apiKey?.trim()) return null;
  return {
    name: provider.name,
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
  };
}

async function propagateCatalogDataToLookups(
  rows: Array<{ vin: string; data: Record<string, unknown> }>,
): Promise<void> {
  if (rows.length === 0) return;
  const currentRate = await getCurrentKrwPerUsd();
  const dataByVin = new Map<string, Record<string, unknown>>();
  for (const row of rows) dataByVin.set(row.vin, row.data);

  const vinList = [...dataByVin.keys()];
  const lookups = await db
    .select({
      id: vinLookupsTable.id,
      vin: vinLookupsTable.vin,
      data: vinLookupsTable.data,
    })
    .from(vinLookupsTable)
    .where(inArray(vinLookupsTable.vin, vinList));

  if (lookups.length === 0) return;

  await mapInBatches(lookups, 50, async (lookup) => {
    const catalogData = dataByVin.get(lookup.vin);
    if (!catalogData) return;
    const lookupData = (lookup.data ?? {}) as Record<string, unknown>;
    const catalogRate = readFrozenKrwPerUsd(catalogData);
    const lookupRate = readFrozenKrwPerUsd(lookupData);
    const stamped = stampCatalogImportData(catalogData, {
      existingRate: lookupRate ?? catalogRate,
      currentRate,
    });
    await db.update(vinLookupsTable)
      .set({ data: stamped, updatedAt: new Date() })
      .where(eq(vinLookupsTable.id, lookup.id));
  });
}

const router = Router();

// ── Admin area PIN (second gate; unlock cookie lasts 7 days) ─────────────────

router.get("/admin/unlock/status", requireAdminAuth, async (req, res) => {
  const userId = req.userId!;
  const ip = clientIpKey(req);
  const pinRequired = isAdminAreaPinEnabled();
  const unlocked = await hasValidAdminUnlock(req, userId);
  const lockedOut = pinRequired ? await isAdminPinLockedOut(userId, ip) : false;
  res.json({
    pinRequired,
    unlocked,
    lockedOut,
    unlockDays: ADMIN_UNLOCK_DAYS,
  });
});

router.post("/admin/unlock", requireAdminAuth, async (req, res) => {
  const userId = req.userId!;
  const ip = clientIpKey(req);
  const { pin } = req.body as { pin?: string };

  if (!isAdminAreaPinEnabled()) {
    const result = await attemptAdminAreaUnlock(userId, ip, "");
    if (!result.ok) {
      res.status(429).json({ error: "Too many failed attempts.", code: result.code });
      return;
    }
    setAdminUnlockCookie(res, result.token);
    res.json({ ok: true, unlocked: true, unlockDays: ADMIN_UNLOCK_DAYS });
    return;
  }

  if (typeof pin !== "string" || !pin.trim()) {
    res.status(400).json({ error: "PIN is required" });
    return;
  }

  const result = await attemptAdminAreaUnlock(userId, ip, pin.trim());
  if (result.ok) {
    setAdminUnlockCookie(res, result.token);
    logger.info({ msg: "admin_area_unlocked", userId, ip });
    res.json({ ok: true, unlocked: true, unlockDays: ADMIN_UNLOCK_DAYS });
    return;
  }

  if (result.code === "locked_out") {
    logger.warn({ msg: "admin_pin_lockout", userId, ip });
    res.status(429).json({
      error: `Too many failed PIN attempts. Try again in ${result.retryAfterMinutes} minutes.`,
      code: "locked_out",
      retryAfterMinutes: result.retryAfterMinutes,
    });
    return;
  }

  logger.warn({ msg: "admin_pin_invalid", userId, ip, attemptsRemaining: result.attemptsRemaining });
  res.status(401).json({
    error: "Incorrect admin PIN.",
    code: "invalid_pin",
    attemptsRemaining: result.attemptsRemaining,
  });
});

router.post("/admin/unlock/logout", requireAdminAuth, async (req, res) => {
  clearAdminUnlockCookie(res);
  logger.info({ msg: "admin_area_locked", userId: req.userId });
  res.json({ ok: true, unlocked: false });
});

// ── STATS ─────────────────────────────────────────────────────────────────────

const ADMIN_STATS_CACHE_MS = 90_000;

async function fetchAcquisitionAttributionRows(): Promise<{
  salesRows: Array<{ date: unknown; channel: unknown; count: unknown; revenue: unknown }>;
  signupRows: Array<{ date: unknown; channel: unknown; count: unknown }>;
}> {
  try {
    const [salesBySourceRaw, signupsByChannelRaw] = await Promise.all([
      db.execute(sql`
        SELECT
          (p.created_at AT TIME ZONE 'UTC')::date AS date,
          COALESCE(
            NULLIF(TRIM(u.acquisition_channel), ''),
            NULLIF(TRIM(u.acquisition_bucket), ''),
            'unknown'
          ) AS channel,
          COUNT(*)::int AS count,
          COALESCE(SUM(p.amount), 0)::float AS revenue
        FROM payments p
        LEFT JOIN users u ON u.id = p.user_id
        WHERE ${sql.raw(SQL_COLLECTED_REVENUE_ROW_FILTER)}
          AND (p.created_at AT TIME ZONE 'UTC')::date >= LEAST(
          DATE_TRUNC('year', NOW() AT TIME ZONE 'UTC')::date,
          (NOW() AT TIME ZONE 'UTC')::date - INTERVAL '89 days'
        )
        GROUP BY 1, 2
        ORDER BY date ASC
      `),
      db.execute(sql`
        SELECT
          (created_at AT TIME ZONE 'UTC')::date AS date,
          COALESCE(
            NULLIF(TRIM(acquisition_channel), ''),
            NULLIF(TRIM(acquisition_bucket), ''),
            'unknown'
          ) AS channel,
          COUNT(*)::int AS count
        FROM users
        WHERE (created_at AT TIME ZONE 'UTC')::date >= LEAST(
          DATE_TRUNC('year', NOW() AT TIME ZONE 'UTC')::date,
          (NOW() AT TIME ZONE 'UTC')::date - INTERVAL '89 days'
        )
        GROUP BY 1, 2
        ORDER BY date ASC
      `),
    ]);
    return {
      salesRows: salesBySourceRaw.rows as Array<{ date: unknown; channel: unknown; count: unknown; revenue: unknown }>,
      signupRows: signupsByChannelRaw.rows as Array<{ date: unknown; channel: unknown; count: unknown }>,
    };
  } catch (err) {
    // Missing acquisition_* columns must not blank the whole admin dashboard.
    logger.warn({ err }, "acquisition attribution stats unavailable");
    return { salesRows: [], signupRows: [] };
  }
}

async function loadAdminStatsPayload() {
  const [
    aggregatesRaw,
    cacheHitData,
    [{ activeProviders }],
    checksByDay30,
    revenueByDay30,
    usersByDay,
    recentPaymentsRaw,
    paymentStatusCountsRaw,
    [{ pendingVinChecksOpen }],
    recentPendingRows,
    onlinePresence,
    signupsByCountryRaw,
    purchasesByCountryRaw,
    paymentsByMethodRaw,
  ] = await Promise.all([
    // Merge totals + today count + weekly trends into one query
    db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM users)::int AS total_users,
        (SELECT COUNT(*) FROM vin_lookups)::int AS total_vin_checks,
        (SELECT COALESCE(SUM(p.amount), 0)::float FROM payments p
         WHERE ${sql.raw(SQL_COLLECTED_REVENUE_ROW_FILTER)}) AS total_revenue,
        (SELECT COUNT(*)::int FROM payments p
         WHERE p.status IN ('completed', 'revoked')) AS qualifying_payment_count,
        (SELECT COALESCE(AVG(p.amount), 0)::float FROM payments p
         WHERE ${sql.raw(SQL_COLLECTED_REVENUE_ROW_FILTER)}
           AND p.amount > 0) AS avg_paid_order_value,
        (SELECT COALESCE(SUM(p.amount), 0)::float FROM payments p
         WHERE ${sql.raw(SQL_COLLECTED_REVENUE_ROW_FILTER)}
           AND (p.created_at AT TIME ZONE 'UTC')::date >= DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC')::date) AS revenue_this_week,
        (SELECT COALESCE(SUM(p.amount), 0)::float FROM payments p
         WHERE ${sql.raw(SQL_COLLECTED_REVENUE_ROW_FILTER)}
           AND (p.created_at AT TIME ZONE 'UTC')::date >= (DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC') - INTERVAL '7 days')::date
           AND (p.created_at AT TIME ZONE 'UTC')::date < DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC')::date) AS revenue_last_week,
        (SELECT COALESCE(SUM(p.amount), 0)::float FROM payments p
         WHERE ${sql.raw(SQL_COLLECTED_REVENUE_ROW_FILTER)}
           AND (p.created_at AT TIME ZONE 'UTC')::date >= DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')::date) AS revenue_this_month,
        (SELECT COALESCE(SUM(p.amount), 0)::float FROM payments p
         WHERE ${sql.raw(SQL_COLLECTED_REVENUE_ROW_FILTER)}
           AND (p.created_at AT TIME ZONE 'UTC')::date >= (DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') - INTERVAL '1 month')::date
           AND (p.created_at AT TIME ZONE 'UTC')::date < DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')::date) AS revenue_last_month,
        (SELECT COALESCE(SUM(p.amount), 0)::float FROM payments p
         WHERE ${sql.raw(SQL_COLLECTED_REVENUE_ROW_FILTER)}
           AND (p.created_at AT TIME ZONE 'UTC')::date >= DATE_TRUNC('year', NOW() AT TIME ZONE 'UTC')::date) AS revenue_this_year,
        (SELECT COALESCE(SUM(p.amount), 0)::float FROM payments p
         WHERE ${sql.raw(SQL_COLLECTED_REVENUE_ROW_FILTER)}
           AND (p.created_at AT TIME ZONE 'UTC')::date = (NOW() AT TIME ZONE 'UTC')::date) AS revenue_today,
        (SELECT COALESCE(SUM(p.amount), 0)::float FROM payments p
         WHERE ${sql.raw(SQL_COLLECTED_REVENUE_ROW_FILTER)}
           AND (p.created_at AT TIME ZONE 'UTC')::date = (NOW() AT TIME ZONE 'UTC')::date - INTERVAL '1 day') AS revenue_yesterday,
        (SELECT COUNT(*)::int FROM users u
         WHERE (u.created_at AT TIME ZONE 'UTC')::date >= DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC')::date) AS signups_this_week,
        (SELECT COUNT(*)::int FROM users u
         WHERE (u.created_at AT TIME ZONE 'UTC')::date >= (DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC') - INTERVAL '7 days')::date
           AND (u.created_at AT TIME ZONE 'UTC')::date < DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC')::date) AS signups_last_week,
        (SELECT COUNT(*)::int FROM users u
         WHERE (u.created_at AT TIME ZONE 'UTC')::date >= DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')::date) AS signups_this_month,
        (SELECT COUNT(*)::int FROM users u
         WHERE (u.created_at AT TIME ZONE 'UTC')::date >= (DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') - INTERVAL '1 month')::date
           AND (u.created_at AT TIME ZONE 'UTC')::date < DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')::date) AS signups_last_month,
        (SELECT COUNT(*)::int FROM users u
         WHERE (u.created_at AT TIME ZONE 'UTC')::date >= DATE_TRUNC('year', NOW() AT TIME ZONE 'UTC')::date) AS signups_this_year,
        (SELECT COUNT(*)::int FROM users u
         WHERE (u.created_at AT TIME ZONE 'UTC')::date = (NOW() AT TIME ZONE 'UTC')::date) AS signups_today,
        (SELECT COUNT(*)::int FROM users u
         WHERE (u.created_at AT TIME ZONE 'UTC')::date = (NOW() AT TIME ZONE 'UTC')::date - INTERVAL '1 day') AS signups_yesterday,
        COUNT(*) FILTER (
          WHERE (vl.created_at AT TIME ZONE 'UTC')::date >= DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC')::date
        )::int AS checks_this_week,
        COUNT(*) FILTER (
          WHERE (vl.created_at AT TIME ZONE 'UTC')::date >= (DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC') - INTERVAL '7 days')::date
            AND (vl.created_at AT TIME ZONE 'UTC')::date < DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC')::date
        )::int AS checks_last_week,
        COUNT(*) FILTER (
          WHERE (vl.created_at AT TIME ZONE 'UTC')::date >= DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')::date
        )::int AS checks_this_month,
        COUNT(*) FILTER (
          WHERE (vl.created_at AT TIME ZONE 'UTC')::date >= (DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') - INTERVAL '1 month')::date
            AND (vl.created_at AT TIME ZONE 'UTC')::date < DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')::date
        )::int AS checks_last_month,
        COUNT(*) FILTER (
          WHERE (vl.created_at AT TIME ZONE 'UTC')::date >= DATE_TRUNC('year', NOW() AT TIME ZONE 'UTC')::date
        )::int AS checks_this_year,
        COUNT(*) FILTER (
          WHERE (vl.created_at AT TIME ZONE 'UTC')::date = (NOW() AT TIME ZONE 'UTC')::date
        )::int AS checks_today,
        COUNT(*) FILTER (
          WHERE (vl.created_at AT TIME ZONE 'UTC')::date = (NOW() AT TIME ZONE 'UTC')::date - INTERVAL '1 day'
        )::int AS checks_yesterday
      FROM vin_lookups vl
    `),
    db.select({ total: count(), cached: sql<number>`sum(case when from_cache then 1 else 0 end)` }).from(vinLookupsTable),
    db.select({ activeProviders: count() }).from(providersTable).where(eq(providersTable.isActive, true)),
    // 90-day series for checks (frontend slices to 7d / 30d / 90d)
    db.execute(sql`
      SELECT (created_at AT TIME ZONE 'UTC')::date as date, COUNT(*)::int as count
      FROM vin_lookups
      WHERE (created_at AT TIME ZONE 'UTC')::date >= LEAST(
        DATE_TRUNC('year', NOW() AT TIME ZONE 'UTC')::date,
        (NOW() AT TIME ZONE 'UTC')::date - INTERVAL '89 days'
      )
      GROUP BY (created_at AT TIME ZONE 'UTC')::date
      ORDER BY date ASC
    `),
    // 90-day series for revenue (completed + revoked — pending credit/remove must not deduct)
    db.execute(sql`
      SELECT (p.created_at AT TIME ZONE 'UTC')::date as date, COALESCE(SUM(p.amount), 0)::float as revenue
      FROM payments p
      WHERE ${sql.raw(SQL_COLLECTED_REVENUE_ROW_FILTER)}
        AND (p.created_at AT TIME ZONE 'UTC')::date >= LEAST(
        DATE_TRUNC('year', NOW() AT TIME ZONE 'UTC')::date,
        (NOW() AT TIME ZONE 'UTC')::date - INTERVAL '89 days'
      )
      GROUP BY (p.created_at AT TIME ZONE 'UTC')::date
      ORDER BY date ASC
    `),
    db.execute(sql`
      SELECT (created_at AT TIME ZONE 'UTC')::date as date, COUNT(*)::int as count
      FROM users
      WHERE (created_at AT TIME ZONE 'UTC')::date >= LEAST(
        DATE_TRUNC('year', NOW() AT TIME ZONE 'UTC')::date,
        (NOW() AT TIME ZONE 'UTC')::date - INTERVAL '89 days'
      )
      GROUP BY (created_at AT TIME ZONE 'UTC')::date
      ORDER BY date ASC
    `),
    db.execute(sql`
      SELECT p.id, p.user_id, p.vin, p.amount, p.currency, p.status,
             p.created_at, u.email, u.name
      FROM payments p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.status IN ('completed', 'revoked')
      ORDER BY p.created_at DESC
      LIMIT 10
    `),
    db.execute(sql`
      SELECT status, COUNT(*)::int as count
      FROM payments
      GROUP BY status
      ORDER BY count DESC
    `),
    db.select({ pendingVinChecksOpen: count() })
      .from(pendingVinChecksTable)
      .where(eq(pendingVinChecksTable.status, "open")),
    db.select({
      id: pendingVinChecksTable.id,
      vin: pendingVinChecksTable.vin,
      draftData: pendingVinChecksTable.draftData,
      createdAt: pendingVinChecksTable.createdAt,
      updatedAt: pendingVinChecksTable.updatedAt,
    })
      .from(pendingVinChecksTable)
      .where(eq(pendingVinChecksTable.status, "open"))
      .orderBy(desc(pendingVinChecksTable.updatedAt))
      .limit(5),
    fetchOnlinePresenceStats(),
    db.execute(sql`
      SELECT
        (created_at AT TIME ZONE 'UTC')::date AS date,
        COALESCE(NULLIF(TRIM(country_code), ''), '—') AS country_code,
        COUNT(*)::int AS count
      FROM users
      WHERE (created_at AT TIME ZONE 'UTC')::date >= LEAST(
        DATE_TRUNC('year', NOW() AT TIME ZONE 'UTC')::date,
        (NOW() AT TIME ZONE 'UTC')::date - INTERVAL '89 days'
      )
      GROUP BY 1, 2
      ORDER BY date ASC
    `),
    db.execute(sql`
      SELECT
        (p.created_at AT TIME ZONE 'UTC')::date AS date,
        COALESCE(NULLIF(TRIM(u.country_code), ''), '—') AS country_code,
        COUNT(*)::int AS count
      FROM payments p
      LEFT JOIN users u ON u.id = p.user_id
      WHERE p.status IN ('completed', 'revoked')
        AND p.amount > 0
        AND (p.created_at AT TIME ZONE 'UTC')::date >= LEAST(
        DATE_TRUNC('year', NOW() AT TIME ZONE 'UTC')::date,
        (NOW() AT TIME ZONE 'UTC')::date - INTERVAL '89 days'
      )
      GROUP BY 1, 2
      ORDER BY date ASC
    `),
    db.execute(sql`
      SELECT
        (p.created_at AT TIME ZONE 'UTC')::date AS date,
        CASE
          WHEN p.pok_order_id IS NOT NULL AND TRIM(p.pok_order_id) <> '' THEN 'pok'
          WHEN p.paypal_order_id IS NOT NULL AND TRIM(p.paypal_order_id) <> '' THEN 'paypal'
          WHEN p.kind = 'credit_redemption' THEN 'credit'
          WHEN COALESCE(p.amount, 0) = 0 THEN 'free'
          ELSE 'paypal'
        END AS method,
        COUNT(*)::int AS count,
        COALESCE(SUM(p.amount), 0)::float AS revenue
      FROM payments p
      WHERE ${sql.raw(SQL_COLLECTED_REVENUE_ROW_FILTER)}
        AND (p.created_at AT TIME ZONE 'UTC')::date >= LEAST(
        DATE_TRUNC('year', NOW() AT TIME ZONE 'UTC')::date,
        (NOW() AT TIME ZONE 'UTC')::date - INTERVAL '89 days'
      )
      GROUP BY 1, 2
      ORDER BY date ASC
    `),
  ]);

  const { salesRows: salesBySourceRows, signupRows: signupsByChannelRows } =
    await fetchAcquisitionAttributionRows();

  const agg = (aggregatesRaw.rows[0] ?? {}) as {
    total_users?: number; total_vin_checks?: number; total_revenue?: number;
    qualifying_payment_count?: number;
    avg_paid_order_value?: number;
    revenue_this_week?: number; revenue_last_week?: number;
    revenue_this_month?: number; revenue_last_month?: number;
    revenue_this_year?: number;
    revenue_today?: number; revenue_yesterday?: number;
    signups_this_week?: number; signups_last_week?: number;
    signups_this_month?: number; signups_last_month?: number;
    signups_this_year?: number;
    signups_today?: number; signups_yesterday?: number;
    checks_this_week?: number; checks_last_week?: number;
    checks_this_month?: number; checks_last_month?: number;
    checks_this_year?: number;
    checks_today?: number; checks_yesterday?: number;
  };

  const total = cacheHitData[0]?.total ?? 0;
  const cached = Number(cacheHitData[0]?.cached ?? 0);
  const cacheHitRate = total > 0 ? (cached / total) * 100 : 0;

  const checksBy90 = normalizeDailyCounts(checksByDay30.rows as Array<{ date: unknown; count: unknown }>);
  const revenueBy90 = normalizeDailyRevenue(revenueByDay30.rows as Array<{ date: unknown; revenue: unknown }>);
  const usersBy90 = normalizeDailyCounts(usersByDay.rows as Array<{ date: unknown; count: unknown }>);
  const cutoff7Str = utcDateIsoDaysAgo(6);
  const cutoff30Str = utcDateIsoDaysAgo(29);

  const totalRevenue = Number(agg.total_revenue ?? 0);
  const qualifyingPaymentCount = Number(agg.qualifying_payment_count ?? 0);
  const revenueThisWeek = Number(agg.revenue_this_week ?? 0);
  const revenueLastWeek = Number(agg.revenue_last_week ?? 0);
  const revenueThisMonth = Number(agg.revenue_this_month ?? 0);
  const revenueLastMonth = Number(agg.revenue_last_month ?? 0);
  const revenueThisYear = Number(agg.revenue_this_year ?? 0);

  const recentPendingVinChecks = await (async () => {
    if (recentPendingRows.length === 0) return [];
    const ids = recentPendingRows.map((r) => r.id);
    const countRows = await db.select({
      pendingVinCheckId: pendingVinCheckRequestsTable.pendingVinCheckId,
      requestCount: count(),
    })
      .from(pendingVinCheckRequestsTable)
      .where(inArray(pendingVinCheckRequestsTable.pendingVinCheckId, ids))
      .groupBy(pendingVinCheckRequestsTable.pendingVinCheckId);
    const countMap = new Map(countRows.map((r) => [r.pendingVinCheckId, r.requestCount]));
    return recentPendingRows.map((row) => {
      const draft = (row.draftData ?? {}) as Record<string, unknown>;
      return {
        id: row.id,
        vin: row.vin,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        requestCount: countMap.get(row.id) ?? 0,
        year: typeof draft.year === "number" ? draft.year : null,
        make: typeof draft.make === "string" ? draft.make : null,
        model: typeof draft.model === "string" ? draft.model : null,
      };
    });
  })();

  return {
    totalUsers: Number(agg.total_users ?? 0),
    totalVinChecks: Number(agg.total_vin_checks ?? 0),
    totalRevenue,
    qualifyingPaymentCount,
    avgOrderValue: Number(agg.avg_paid_order_value ?? 0),
    revenueThisWeek,
    revenueLastWeek,
    revenueThisMonth,
    revenueLastMonth,
    revenueThisYear,
    revenueToday: Number(agg.revenue_today ?? 0),
    revenueYesterday: Number(agg.revenue_yesterday ?? 0),
    signupsThisWeek: Number(agg.signups_this_week ?? 0),
    signupsLastWeek: Number(agg.signups_last_week ?? 0),
    signupsThisMonth: Number(agg.signups_this_month ?? 0),
    signupsLastMonth: Number(agg.signups_last_month ?? 0),
    signupsThisYear: Number(agg.signups_this_year ?? 0),
    signupsToday: Number(agg.signups_today ?? 0),
    signupsYesterday: Number(agg.signups_yesterday ?? 0),
    checksToday: Number(agg.checks_today ?? 0),
    checksYesterday: Number(agg.checks_yesterday ?? 0),
    checksThisWeek: Number(agg.checks_this_week ?? 0),
    checksLastWeek: Number(agg.checks_last_week ?? 0),
    checksThisMonth: Number(agg.checks_this_month ?? 0),
    checksLastMonth: Number(agg.checks_last_month ?? 0),
    checksThisYear: Number(agg.checks_this_year ?? 0),
    cacheHitRate: Math.round(cacheHitRate * 10) / 10,
    activeProviders: activeProviders ?? 0,
    checksByDay: sliceSeriesFrom(checksBy90, cutoff7Str),
    revenueByDay: sliceSeriesFrom(revenueBy90, cutoff7Str),
    checksByDay30: sliceSeriesFrom(checksBy90, cutoff30Str),
    revenueByDay30: sliceSeriesFrom(revenueBy90, cutoff30Str),
    checksByDay90: checksBy90,
    revenueByDay90: revenueBy90,
    usersByDay: usersBy90,
    usersByDay90: usersBy90,
    recentPayments: normalizeRecentPayments(recentPaymentsRaw.rows as Array<Record<string, unknown>>),
    paymentStatusCounts: normalizePaymentStatusCounts(
      paymentStatusCountsRaw.rows as Array<{ status: unknown; count: unknown }>,
    ),
    pendingVinChecksOpen: pendingVinChecksOpen ?? 0,
    recentPendingVinChecks,
    onlinePresence,
    signupsByCountry: buildSignupsByCountryPeriods(
      signupsByCountryRaw.rows as Array<{ date: unknown; country_code: unknown; count: unknown }>,
    ),
    purchasesByCountry: buildCountryCountPeriods(
      purchasesByCountryRaw.rows as Array<{ date: unknown; country_code: unknown; count: unknown }>,
    ),
    paymentsByMethod: buildPaymentsByMethodPeriods(
      paymentsByMethodRaw.rows as Array<{ date: unknown; method: unknown; count: unknown; revenue: unknown }>,
    ),
    ...buildSalesAttributionPeriods(salesBySourceRows),
    signupsByChannel: buildSignupsByChannelPeriods(signupsByChannelRows),
  };
}

const adminStatsCache = makeTtlCache<Awaited<ReturnType<typeof loadAdminStatsPayload>>>(ADMIN_STATS_CACHE_MS);

registerAdminStatsInvalidationHook(() => {
  adminStatsCache.invalidate();
  invalidateAdminAnalyticsCache();
});

router.get("/admin/stats", requireAdmin, async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.query.refresh === "1") {
    invalidateAdminStatsCache();
  }
  const payload = await adminStatsCache.getOrFetch(loadAdminStatsPayload);
  res.json(payload);
});

/** Lean acquisition + ops monitoring — one period, aggregates only. */
router.get("/admin/analytics", requireAdmin, async (req, res) => {
  try {
    res.setHeader("Cache-Control", "private, no-store");
    const period = parseAnalyticsPeriod(req.query.period);
    const refresh = req.query.refresh === "1";
    if (refresh) invalidateAdminAnalyticsCache();
    const payload = await getAdminAnalyticsCached(period, { refresh });
    res.json(payload);
  } catch (err) {
    logger.error({ err }, "admin_analytics_failed");
    res.status(500).json({ error: "Failed to load analytics" });
  }
});

router.get("/admin/presence-users", requireAdmin, async (req, res) => {
  try {
    const periodRaw = String(req.query.period ?? "now");
    if (!["now", "today", "yesterday"].includes(periodRaw)) {
      res.status(400).json({ error: "Invalid period" });
      return;
    }
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const data = await fetchPresenceUsersPage(periodRaw as PresencePeriod, page);
    res.json(data);
  } catch (err) {
    logger.error({ err }, "admin_presence_users_failed");
    res.status(500).json({
      users: [],
      page: 1,
      pageSize: 10,
      total: 0,
      pageCount: 1,
      error: "Failed to load online users",
    });
  }
});

// ── USERS ─────────────────────────────────────────────────────────────────────

function normalizeEmailDomain(raw: string): string | null {
  let domain = raw.trim().toLowerCase();
  if (domain.startsWith("@")) domain = domain.slice(1);
  if (!domain || domain.length > 253) return null;
  // e.g. gmail.com, yahoo.co.uk — letters/digits/dot/hyphen only
  if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(domain)) return null;
  if (!domain.includes(".")) return null;
  return domain;
}

function buildAdminUserWhere(
  searchRaw: string,
  status: string,
  checks: string,
  countryRaw = "",
  hasPhoneRaw = "",
  emailDomainRaw = "",
) {
  const conditions = [];
  const search = searchRaw.trim();
  if (search) {
    conditions.push(or(like(usersTable.email, `%${search}%`), like(usersTable.name, `%${search}%`))!);
  }
  if (status === "banned") conditions.push(eq(usersTable.isBanned, true));
  if (status === "active") conditions.push(eq(usersTable.isBanned, false));
  if (checks === "checked") {
    conditions.push(
      exists(
        db.select({ one: sql`1` })
          .from(vinLookupsTable)
          .where(eq(vinLookupsTable.userId, usersTable.id)),
      ),
    );
  } else if (checks === "unchecked") {
    conditions.push(
      not(
        exists(
          db.select({ one: sql`1` })
            .from(vinLookupsTable)
            .where(eq(vinLookupsTable.userId, usersTable.id)),
        ),
      ),
    );
  }
  const countryKey = countryRaw.trim().toLowerCase();
  if (countryKey === "unset" || countryKey === "none" || countryKey === "null") {
    conditions.push(isNull(usersTable.countryCode));
  } else if (countryKey) {
    const countryCode = parseUserCountryCode(countryRaw);
    if (countryCode) conditions.push(eq(usersTable.countryCode, countryCode));
  }
  const hasPhoneKey = hasPhoneRaw.trim().toLowerCase();
  const hasCompletePhone = and(
    sql`NULLIF(TRIM(${usersTable.phonePrefix}), '') IS NOT NULL`,
    sql`NULLIF(TRIM(${usersTable.phoneNational}), '') IS NOT NULL`,
  )!;
  if (hasPhoneKey === "yes" || hasPhoneKey === "true" || hasPhoneKey === "1") {
    conditions.push(hasCompletePhone);
  } else if (hasPhoneKey === "no" || hasPhoneKey === "false" || hasPhoneKey === "0") {
    conditions.push(not(hasCompletePhone));
  }
  const emailDomain = normalizeEmailDomain(emailDomainRaw);
  if (emailDomain) {
    conditions.push(sql`lower(split_part(${usersTable.email}, '@', 2)) = ${emailDomain}`);
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

function normalizeUserCsvRecord(record: Record<string, string>): {
  email: string;
  name?: string;
  phonePrefix?: string;
  phoneNational?: string;
  hasPhoneColumns: boolean;
} {
  const normalized = new Map<string, string>();
  for (const [key, value] of Object.entries(record)) {
    normalized.set(key.trim().toLowerCase().replace(/[\s-]+/g, "_"), value);
  }
  const hasPhoneColumns = normalized.has("phone_prefix") || normalized.has("phone_national");
  return {
    email: (normalized.get("email") ?? "").trim(),
    name: normalized.get("name")?.trim() || undefined,
    phonePrefix: normalized.get("phone_prefix"),
    phoneNational: normalized.get("phone_national"),
    hasPhoneColumns,
  };
}

type DbUser = typeof usersTable.$inferSelect;

/** Core columns always present — used when acquisition_* patches have not applied yet. */
const ADMIN_USER_CORE_COLUMNS = {
  id: usersTable.id,
  email: usersTable.email,
  name: usersTable.name,
  avatarUrl: usersTable.avatarUrl,
  passwordHash: usersTable.passwordHash,
  googleId: usersTable.googleId,
  facebookId: usersTable.facebookId,
  linkedinId: usersTable.linkedinId,
  authProvider: usersTable.authProvider,
  isBanned: usersTable.isBanned,
  banReason: usersTable.banReason,
  isAdmin: usersTable.isAdmin,
  lastLoginAt: usersTable.lastLoginAt,
  lastLoginIp: usersTable.lastLoginIp,
  signupIp: usersTable.signupIp,
  countryCode: usersTable.countryCode,
  countryChangeDay: usersTable.countryChangeDay,
  countryChangeCount: usersTable.countryChangeCount,
  phonePrefix: usersTable.phonePrefix,
  phoneNational: usersTable.phoneNational,
  phoneChangeDay: usersTable.phoneChangeDay,
  phoneChangeCount: usersTable.phoneChangeCount,
  lastSeenAt: usersTable.lastSeenAt,
  lastSeenPath: usersTable.lastSeenPath,
  creditBalance: usersTable.creditBalance,
  createdAt: usersTable.createdAt,
  updatedAt: usersTable.updatedAt,
} as const;

function withNullAcquisition(row: Record<string, unknown>): DbUser {
  return {
    ...row,
    acquisitionBucket: null,
    acquisitionChannel: null,
    acquisitionSource: null,
    acquisitionMedium: null,
    acquisitionCampaign: null,
    acquisitionClickId: null,
    acquisitionReferrer: null,
    acquisitionLandingPath: null,
    acquisitionInApp: null,
    acquisitionCapturedAt: null,
  } as DbUser;
}

async function selectAdminUsersPage(
  where: ReturnType<typeof buildAdminUserWhere>,
  limit: number,
  offset: number,
): Promise<DbUser[]> {
  try {
    return await db
      .select()
      .from(usersTable)
      .where(where)
      .orderBy(desc(usersTable.createdAt))
      .limit(limit)
      .offset(offset);
  } catch (err) {
    logger.warn({ err }, "admin users select with acquisition failed; falling back to core columns");
    const rows = await db
      .select(ADMIN_USER_CORE_COLUMNS)
      .from(usersTable)
      .where(where)
      .orderBy(desc(usersTable.createdAt))
      .limit(limit)
      .offset(offset);
    return rows.map((r) => withNullAcquisition(r as Record<string, unknown>));
  }
}

async function selectAdminUserById(userId: string): Promise<DbUser | null> {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    return user ?? null;
  } catch (err) {
    logger.warn({ err, userId }, "admin user by id with acquisition failed; falling back");
    const [row] = await db
      .select(ADMIN_USER_CORE_COLUMNS)
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    return row ? withNullAcquisition(row as Record<string, unknown>) : null;
  }
}

function toAdminUser(
  user: DbUser,
  stats?: { totalChecks: number; totalSpent: number },
) {
  const { passwordHash: _pw, ...safe } = user;
  return {
    ...safe,
    // Legacy accounts legitimately have null acquisition — never omit the keys.
    acquisitionBucket: user.acquisitionBucket ?? null,
    acquisitionChannel: user.acquisitionChannel ?? null,
    acquisitionSource: user.acquisitionSource ?? null,
    acquisitionMedium: user.acquisitionMedium ?? null,
    acquisitionCampaign: user.acquisitionCampaign ?? null,
    acquisitionClickId: user.acquisitionClickId ?? null,
    acquisitionReferrer: user.acquisitionReferrer ?? null,
    acquisitionLandingPath: user.acquisitionLandingPath ?? null,
    acquisitionInApp: user.acquisitionInApp ?? null,
    acquisitionCapturedAt: user.acquisitionCapturedAt ?? null,
    totalChecks: stats?.totalChecks ?? 0,
    totalSpent: stats?.totalSpent ?? 0,
  };
}

async function loadAdminUserStats(userId: string): Promise<{ totalChecks: number; totalSpent: number }> {
  const [checksRow, spentRow] = await Promise.all([
    db.select({ totalChecks: count() }).from(vinLookupsTable).where(eq(vinLookupsTable.userId, userId)),
    db.select({ totalSpent: sum(paymentsTable.amount) })
      .from(paymentsTable)
      .where(recordedTransactionWhere(eq(paymentsTable.userId, userId))),
  ]);
  return {
    totalChecks: Number(checksRow[0]?.totalChecks ?? 0),
    totalSpent: Number(spentRow[0]?.totalSpent ?? 0),
  };
}

router.get("/admin/users", requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10)));
    const offset = (page - 1) * limit;
    const search = String(req.query.search ?? "");
    const status = String(req.query.status ?? "");
    const checks = String(req.query.checks ?? "");
    const country = String(req.query.country ?? "");
    const hasPhone = String(req.query.hasPhone ?? "");
    const emailDomain = String(req.query.emailDomain ?? "");

    const where = buildAdminUserWhere(search, status, checks, country, hasPhone, emailDomain);

    const [users, totalRow] = await Promise.all([
      selectAdminUsersPage(where, limit, offset),
      db.select({ total: count() }).from(usersTable).where(where),
    ]);
    const total = Number(totalRow[0]?.total ?? 0);

    const userIds = users.map(u => u.id);
    const usersWithStats = userIds.length === 0 ? [] : await (async () => {
      const [checksStats, spentStats] = await Promise.all([
        db.select({ userId: vinLookupsTable.userId, total: count() })
          .from(vinLookupsTable)
          .where(inArray(vinLookupsTable.userId, userIds))
          .groupBy(vinLookupsTable.userId),
        db.select({ userId: paymentsTable.userId, total: sum(paymentsTable.amount) })
          .from(paymentsTable)
          .where(and(inArray(paymentsTable.userId, userIds), recordedTransactionWhere()))
          .groupBy(paymentsTable.userId),
      ]);
      const checksMap = new Map(
        checksStats.filter((r): r is typeof r & { userId: string } => r.userId != null)
          .map(r => [r.userId, Number(r.total ?? 0)]),
      );
      const spentMap = new Map(spentStats.map(r => [r.userId, Number(r.total ?? 0)]));
      return users.map(u => toAdminUser(u, {
        totalChecks: checksMap.get(u.id) ?? 0,
        totalSpent: spentMap.get(u.id) ?? 0,
      }));
    })();

    res.json({ items: usersWithStats, total, page, limit });
  } catch (err) {
    logger.error({ err }, "admin_get_users_failed");
    res.status(500).json({ error: "Failed to load users" });
  }
});

/** Distinct email domains among users (for admin filter dropdown). */
router.get("/admin/users/email-domains", requireAdmin, async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT lower(split_part(email, '@', 2)) AS domain, COUNT(*)::int AS count
      FROM users
      WHERE position('@' in email) > 1
        AND length(split_part(email, '@', 2)) > 0
      GROUP BY 1
      ORDER BY count DESC, domain ASC
      LIMIT 500
    `);
    const list = (result.rows ?? []) as Array<{ domain: string; count: number }>;
    res.json({
      domains: list
        .filter((r) => r.domain && normalizeEmailDomain(String(r.domain)))
        .map((r) => ({ domain: String(r.domain).toLowerCase(), count: Number(r.count) || 0 })),
    });
  } catch (err) {
    logger.error({ err }, "admin_users_email_domains_failed");
    res.status(500).json({ error: "Failed to load email domains" });
  }
});

// GET /admin/users/export — download users as CSV (must be defined before /:userId routes)
router.get("/admin/users/export", requireAdmin, async (req, res) => {
  const search = String(req.query.search ?? "");
  const status = String(req.query.status ?? "");
  const checks = String(req.query.checks ?? "");
  const country = String(req.query.country ?? "");
  const hasPhone = String(req.query.hasPhone ?? "");
  const emailDomain = String(req.query.emailDomain ?? "");
  const where = buildAdminUserWhere(search, status, checks, country, hasPhone, emailDomain);

  const users = await (async () => {
    try {
      return await db.select().from(usersTable).where(where).orderBy(desc(usersTable.createdAt)).limit(50000);
    } catch (err) {
      logger.warn({ err }, "admin users export with acquisition failed; falling back");
      const rows = await db
        .select(ADMIN_USER_CORE_COLUMNS)
        .from(usersTable)
        .where(where)
        .orderBy(desc(usersTable.createdAt))
        .limit(50000);
      return rows.map((r) => withNullAcquisition(r as Record<string, unknown>));
    }
  })();

  let checksMap = new Map<string, number>();
  let spentMap = new Map<string, number>();
  if (users.length > 0) {
    const userIds = users.map(u => u.id);
    const [checksStats, spentStats] = await Promise.all([
      db.select({ userId: vinLookupsTable.userId, total: count() })
        .from(vinLookupsTable)
        .where(inArray(vinLookupsTable.userId, userIds))
        .groupBy(vinLookupsTable.userId),
      db.select({ userId: paymentsTable.userId, total: sum(paymentsTable.amount) })
        .from(paymentsTable)
        .where(and(inArray(paymentsTable.userId, userIds), recordedTransactionWhere()))
        .groupBy(paymentsTable.userId),
    ]);
    checksMap = new Map(checksStats.filter(r => r.userId !== null).map(r => [r.userId!, r.total]));
    spentMap = new Map(spentStats.map(r => [r.userId, Number(r.total ?? 0)]));
  }

  const escape = (v: unknown): string => {
    const s = v == null ? "" : String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const header = "id,email,name,country_code,phone_prefix,phone_national,status,created_at,total_checks,total_spent\n";
  const csvBody = users
    .map(u => [
      u.id, u.email, u.name ?? "", u.countryCode ?? "",
      u.phonePrefix ?? "", u.phoneNational ?? "",
      u.isBanned ? "banned" : "active",
      u.createdAt instanceof Date ? u.createdAt.toISOString() : String(u.createdAt ?? ""),
      checksMap.get(u.id) ?? 0,
      spentMap.get(u.id) ?? 0,
    ].map(escape).join(","))
    .join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="users.csv"');
  res.send("\uFEFF" + header + csvBody);
});

// POST /admin/users/import — create/update users from CSV (must be defined before /:userId routes)
router.post("/admin/users/import", requireAdmin, userImportLimiter, upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) { res.status(400).json({ error: "CSV file is required" }); return; }

  const records = await new Promise<Record<string, string>[]>((resolve, reject) => {
    const rows: Record<string, string>[] = [];
    createReadStream(file.path)
      .pipe(csvParse({ columns: true, skip_empty_lines: true, trim: true }))
      .on("data", (row: Record<string, string>) => rows.push(row))
      .on("end", () => resolve(rows))
      .on("error", reject);
  }).finally(() => { unlink(file.path, () => {}); });

  if (records.length === 0) { res.status(400).json({ error: "CSV file is empty" }); return; }
  if (records.length > 500) { res.status(400).json({ error: "CSV file exceeds the 500-row limit" }); return; }
  const hasEmailColumn = Object.keys(records[0]).some(k => k.trim().toLowerCase() === "email");
  if (!hasEmailColumn) {
    res.status(400).json({ error: "CSV must have an 'email' column" });
    return;
  }

  // Fetch siteUrl + email service once before the loop
  const [importSettings] = await db
    .select({
      siteUrl: systemSettingsTable.siteUrl,
      emailSendPasswordReset: systemSettingsTable.emailSendPasswordReset,
      emailTemplates: systemSettingsTable.emailTemplates,
    })
    .from(systemSettingsTable).orderBy(desc(systemSettingsTable.id)).limit(1);
  const siteUrl = (importSettings?.siteUrl ?? process.env.SITE_URL ?? "https://verifykm.com").replace(/\/$/, "");
  const emailEnabled = importSettings?.emailSendPasswordReset !== false;
  const importTemplates = (importSettings?.emailTemplates ?? {}) as import("@workspace/db").EmailTemplatesConfig;
  const { sendEmail, buildPasswordResetEmail } = await import("../lib/emailService.js");

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const seenEmails = new Set<string>();
  const rows: Array<{ row: number; email: string; status: "inserted" | "updated" | "skipped" | "error"; reason?: string }> = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const {
      email: rawEmailField,
      name: recordName,
      phonePrefix: rawPhonePrefix,
      phoneNational: rawPhoneNational,
      hasPhoneColumns,
    } = normalizeUserCsvRecord(record);
    const rawEmail = rawEmailField.toLowerCase();
    if (!rawEmail || !emailRegex.test(rawEmail)) {
      rows.push({ row: i + 1, email: rawEmail || "(empty)", status: "error", reason: "Invalid email address" });
      continue;
    }
    if (seenEmails.has(rawEmail)) {
      rows.push({ row: i + 1, email: rawEmail, status: "skipped", reason: "Duplicate email in CSV" });
      continue;
    }
    seenEmails.add(rawEmail);

    let phoneUpdate: { phonePrefix: string | null; phoneNational: string | null } | undefined;
    if (hasPhoneColumns) {
      const parsed = parseUserPhone({
        phonePrefix: rawPhonePrefix ?? "",
        phoneNational: rawPhoneNational ?? "",
      });
      if (!parsed) {
        rows.push({
          row: i + 1,
          email: rawEmail,
          status: "error",
          reason: "Invalid phone (need both phone_prefix and phone_national, or both empty)",
        });
        continue;
      }
      phoneUpdate = { phonePrefix: parsed.prefix, phoneNational: parsed.national };
    }

    try {
      const [existing] = await db.select({ id: usersTable.id })
        .from(usersTable).where(eq(usersTable.email, rawEmail)).limit(1);

      if (existing) {
        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (recordName) updates.name = recordName;
        if (phoneUpdate) {
          updates.phonePrefix = phoneUpdate.phonePrefix;
          updates.phoneNational = phoneUpdate.phoneNational;
        }
        await db.update(usersTable)
          .set(updates as Parameters<ReturnType<typeof db.update>["set"]>[0])
          .where(eq(usersTable.id, existing.id));
        rows.push({ row: i + 1, email: rawEmail, status: "updated" });
      } else {
        const id = crypto.randomUUID();
        await db.insert(usersTable).values({
          id,
          email: rawEmail,
          name: recordName,
          authProvider: "local",
          ...(phoneUpdate ?? {}),
        });
        // Create a 7-day password-reset token and send a setup email so the account is immediately usable
        const tokenId = crypto.randomUUID();
        const rawVerifier = crypto.randomBytes(32).toString("hex");
        const tokenHash = await hashPassword(rawVerifier);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await db.insert(passwordResetTokensTable).values({ id: tokenId, tokenHash, userId: id, expiresAt });
        if (emailEnabled) {
          const resetUrl = `${siteUrl}/en/reset-password?token=${tokenId}.${rawVerifier}`;
          const { subject, html } = buildPasswordResetEmail(resetUrl, siteUrl, importTemplates.reset);
          void sendEmail({ to: rawEmail, subject, html, logType: "reset", logMeta: { source: "user_import" } });
        }
        rows.push({ row: i + 1, email: rawEmail, status: "inserted" });
      }
    } catch (err) {
      rows.push({ row: i + 1, email: rawEmail, status: "error", reason: err instanceof Error ? err.message.slice(0, 200) : "Unknown error" });
    }
  }

  res.json({
    total: records.length,
    inserted: rows.filter(r => r.status === "inserted").length,
    updated: rows.filter(r => r.status === "updated").length,
    skipped: rows.filter(r => r.status === "skipped").length,
    errors: rows.filter(r => r.status === "error").length,
    rows,
  });
});

async function logAdminAction(
  adminUserId: string,
  action: string,
  targetId: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(systemLogsTable).values({
      level: "info",
      message: action.slice(0, 500),
      context: JSON.stringify({ adminUserId, targetId, ...extra }).slice(0, 1500),
    });
  } catch { /* best-effort */ }
}

router.get("/admin/users/:userId", requireAdmin, async (req, res) => {
  try {
    const userId = String(req.params.userId ?? "").trim();
    if (!userId) { res.status(400).json({ error: "Invalid user ID" }); return; }

    const user = await selectAdminUserById(userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const stats = await loadAdminUserStats(userId);
    res.json(toAdminUser(user, stats));
  } catch (err) {
    logger.error({ err, userId: req.params.userId }, "admin_get_user_failed");
    res.status(500).json({ error: "Failed to load user" });
  }
});

router.post("/admin/users/:userId/ban", requireAdmin, async (req, res) => {
  const userId = String(req.params.userId ?? "");
  const { reason } = req.body as { reason?: string };

  // Protect admin accounts from being banned
  const [target] = await db.select({
    isAdmin: usersTable.isAdmin,
    email: usersTable.email,
  }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!target) { res.status(404).json({ error: "User not found" }); return; }
  if (target.isAdmin) { res.status(400).json({ error: "Admin accounts cannot be banned" }); return; }

  const [user] = await db.update(usersTable)
    .set({ isBanned: true, banReason: reason ?? null, updatedAt: new Date() })
    .where(eq(usersTable.id, userId))
    .returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  let blockedDevices: string[] = [];
  try {
    const blocked = await blockDevicesForBannedUser(userId, req.userId!, reason);
    blockedDevices = blocked.blockedDevices;
  } catch (err) {
    logger.warn({ err, userId }, "ban_access_blocks_failed");
  }
  await logAdminAction(req.userId!, "admin_ban_user", userId, { reason, blockedDevices });
  res.json({ ...toAdminUser(user), blockedDevices });
});

router.post("/admin/users/:userId/unban", requireAdmin, async (req, res) => {
  const userId = String(req.params.userId ?? "");
  const [user] = await db.update(usersTable)
    .set({ isBanned: false, banReason: null, updatedAt: new Date() })
    .where(eq(usersTable.id, userId))
    .returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  const removedIpBlocks = await removeUserBanIpBlocks(userId);
  await logAdminAction(req.userId!, "admin_unban_user", userId, { removedBlocks: removedIpBlocks });
  res.json({ ...toAdminUser(user), removedIpBlocks });
});

// Permanently delete a user account and all user-owned data.
// Shared vin_catalog rows are intentionally preserved.
router.delete("/admin/users/:userId", requireAdmin, async (req, res) => {
  const userId = String(req.params.userId ?? "").trim();
  if (!userId) { res.status(400).json({ error: "Invalid user ID" }); return; }

  const adminId = req.userId!;
  if (userId === adminId) {
    res.status(400).json({ error: "You cannot delete your own account" });
    return;
  }

  const { confirmEmail } = req.body as { confirmEmail?: string };
  const emailConfirm = confirmEmail?.trim().toLowerCase();
  if (!emailConfirm) {
    res.status(400).json({ error: "Email confirmation is required" });
    return;
  }

  const [target] = await db.select({
    id: usersTable.id,
    email: usersTable.email,
    isAdmin: usersTable.isAdmin,
  }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);

  if (!target) { res.status(404).json({ error: "User not found" }); return; }
  if (target.isAdmin) { res.status(400).json({ error: "Admin accounts cannot be deleted" }); return; }
  if (emailConfirm !== target.email.toLowerCase()) {
    res.status(400).json({ error: "Email confirmation does not match this user" });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const deletedTokens = await tx.delete(passwordResetTokensTable)
        .where(eq(passwordResetTokensTable.userId, userId))
        .returning({ id: passwordResetTokensTable.id });

      const deletedPayments = await tx.delete(paymentsTable)
        .where(eq(paymentsTable.userId, userId))
        .returning({ id: paymentsTable.id });

      const deletedLookups = await tx.delete(vinLookupsTable)
        .where(eq(vinLookupsTable.userId, userId))
        .returning({ id: vinLookupsTable.id });

      const deletedUsers = await tx.delete(usersTable)
        .where(eq(usersTable.id, userId))
        .returning({ id: usersTable.id });

      if (deletedUsers.length === 0) {
        throw new Error("USER_NOT_FOUND");
      }

      return {
        payments: deletedPayments.length,
        lookups: deletedLookups.length,
        resetTokens: deletedTokens.length,
      };
    });

    await logAdminAction(adminId, "admin_delete_user", userId, {
      email: target.email,
      ...result,
    });
    logger.info({ adminId, userId, email: target.email, ...result }, "User deleted by admin");

    res.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof Error && err.message === "USER_NOT_FOUND") {
      res.status(404).json({ error: "User not found" });
      return;
    }
    logger.error({ err, adminId, userId }, "Failed to delete user");
    res.status(500).json({ error: "Failed to delete user. Please try again." });
  }
});

router.patch("/admin/users/:userId", requireAdmin, async (req, res) => {
  const userId = String(req.params.userId ?? "");
  const { name, email, password, countryCode: rawCountry, phonePrefix: rawPrefix, phoneNational: rawNational } = req.body as {
    name?: string;
    email?: string;
    password?: string;
    countryCode?: string | null;
    phonePrefix?: string | null;
    phoneNational?: string | null;
  };

  const [target] = await db
    .select({
      isAdmin: usersTable.isAdmin,
      email: usersTable.email,
      name: usersTable.name,
      phonePrefix: usersTable.phonePrefix,
      phoneNational: usersTable.phoneNational,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!target) { res.status(404).json({ error: "User not found" }); return; }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) {
    const nextName = name?.trim() || null;
    if (nextName !== (target.name ?? null)) updates.name = nextName;
  }
  if (email?.trim()) {
    const emailLower = email.trim().toLowerCase();
    if (emailLower !== target.email.toLowerCase()) {
      if (adminEmailMatches(emailLower)) {
        res.status(403).json({ error: "Cannot assign the configured admin email to another account" });
        return;
      }
      const [conflict] = await db.select({ id: usersTable.id })
        .from(usersTable).where(eq(usersTable.email, emailLower)).limit(1);
      if (conflict && conflict.id !== userId) { res.status(409).json({ error: "Email already in use by another account" }); return; }
      updates.email = emailLower;
    }
  }
  if (password) {
    if (target.isAdmin) {
      res.status(403).json({ error: "Cannot reset another admin account's password from the panel" });
      return;
    }
    if (password.length < 8) { res.status(400).json({ error: "Password must be at least 8 characters" }); return; }
    const { hashPassword } = await import("../lib/auth.js");
    updates.passwordHash = await hashPassword(password);
  }
  if (rawCountry !== undefined) {
    const countryCode = parseUserCountryCode(rawCountry);
    if (rawCountry !== null && rawCountry !== "" && !countryCode) {
      res.status(400).json({ error: "Invalid country" });
      return;
    }
    updates.countryCode = countryCode;
  }
  if (rawPrefix !== undefined || rawNational !== undefined) {
    const merged = parseUserPhone({
      phonePrefix: rawPrefix !== undefined ? rawPrefix : (target.phonePrefix ?? null),
      phoneNational: rawNational !== undefined ? rawNational : (target.phoneNational ?? null),
    });
    if (!merged) {
      res.status(400).json({ error: "Invalid phone number" });
      return;
    }
    if (merged.prefix !== (target.phonePrefix ?? null) || merged.national !== (target.phoneNational ?? null)) {
      updates.phonePrefix = merged.prefix;
      updates.phoneNational = merged.national;
    }
  }

  if (Object.keys(updates).length === 0) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const { passwordHash: _pw, ...safeUser } = user;
    res.json(safeUser);
    return;
  }

  updates.updatedAt = new Date();
  const [user] = await db.update(usersTable)
    .set(updates as Parameters<ReturnType<typeof db.update>["set"]>[0])
    .where(eq(usersTable.id, userId))
    .returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  const { passwordHash: _pw, ...safeUser } = user;
  await logAdminAction(req.userId!, "admin_edit_user", userId, { fields: Object.keys(updates).filter(k => k !== "updatedAt") });
  res.json(safeUser);
});

// Revoke a user's access to a VIN
// - marks the vin_lookups row as "revoked" (removes it from the "Users with Access" list)
// - revokes all completed payments for this user+VIN
router.delete("/admin/users/:userId/lookups/:lookupId", requireAdmin, async (req, res) => {
  const userId = String(req.params.userId ?? "");
  const lookupId = parseInt(String(req.params.lookupId ?? ""), 10);
  if (isNaN(lookupId)) { res.status(400).json({ error: "Invalid lookup ID" }); return; }
  const [lookup] = await db.select({ id: vinLookupsTable.id, vin: vinLookupsTable.vin, paymentId: vinLookupsTable.paymentId })
    .from(vinLookupsTable)
    .where(and(eq(vinLookupsTable.id, lookupId), eq(vinLookupsTable.userId, userId)))
    .limit(1);
  if (!lookup) { res.status(404).json({ error: "Lookup not found" }); return; }
  await Promise.all([
    db.update(vinLookupsTable)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(eq(vinLookupsTable.id, lookupId)),
    db.update(paymentsTable)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(and(eq(paymentsTable.userId, userId), eq(paymentsTable.vin, lookup.vin), eq(paymentsTable.status, "completed"))),
  ]);
  await logAdminAction(req.userId!, "admin_revoke_access", userId, { lookupId, vin: lookup.vin });
  res.status(204).send();
});

router.post("/admin/users/:userId/grant-analysis", requireAdmin, async (req, res) => {
  const userId = String(req.params.userId ?? "");
  const { vin } = req.body as { vin?: string };
  const normalizedVin = vin?.trim().toUpperCase() ?? "";
  if (normalizedVin.length !== 17) { res.status(400).json({ error: "Valid 17-character VIN is required" }); return; }

  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  try {
    const result = await grantVinReportToUser(userId, normalizedVin, { adminId: req.userId });
    if (result.status === "already_exists") {
      res.status(409).json({ error: "User already has access to this VIN report", lookupId: result.lookupId, vin: result.vin });
      return;
    }
    await logAdminAction(req.userId!, "admin_grant_analysis", userId, {
      vin: normalizedVin,
      lookupId: result.lookupId,
      fromCache: result.fromCache,
    });
    res.status(201).json({
      lookupId: result.lookupId,
      vin: result.vin,
      fromCache: result.fromCache,
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "NO_PROVIDER") {
      res.status(503).json({ error: "No active VIN provider configured" });
      return;
    }
    if (code === "PROVIDER_RATE_LIMIT") {
      res.status(429).json({ error: (err as Error).message });
      return;
    }
    logger.error({ err, userId, vin: normalizedVin }, "Admin grant analysis failed");
    res.status(502).json({ error: "Failed to fetch VIN report from provider" });
  }
});

router.get("/admin/users/:userId/history", requireAdmin, async (req, res) => {
  const userId = String(req.params.userId ?? "");
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
  const offset = (page - 1) * limit;
  const [items, [{ total }]] = await Promise.all([
    db.select().from(vinLookupsTable)
      .where(eq(vinLookupsTable.userId, userId))
      .orderBy(desc(vinLookupsTable.createdAt))
      .limit(limit).offset(offset),
    db.select({ total: count() }).from(vinLookupsTable).where(eq(vinLookupsTable.userId, userId)),
  ]);
  res.json({ items, total, page, limit });
});

// POST /admin/users/:userId/credits — adjust prepaid credit balance (clamp at 0)
router.post("/admin/users/:userId/credits", requireAdmin, async (req, res) => {
  const userId = String(req.params.userId ?? "").trim();
  if (!userId) { res.status(400).json({ error: "Invalid user ID" }); return; }

  const body = req.body as { delta?: unknown; creditBalance?: unknown };
  const [existing] = await db.select({ id: usersTable.id, creditBalance: usersTable.creditBalance })
    .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!existing) { res.status(404).json({ error: "User not found" }); return; }

  let nextBalance: number;
  if (body.creditBalance !== undefined && body.creditBalance !== null && body.creditBalance !== "") {
    const absolute = typeof body.creditBalance === "number" ? body.creditBalance : Number(body.creditBalance);
    if (!Number.isFinite(absolute) || !Number.isInteger(absolute) || absolute < 0) {
      res.status(400).json({ error: "creditBalance must be a non-negative integer", code: "INVALID_BALANCE" });
      return;
    }
    if (absolute > 100_000) {
      res.status(400).json({ error: "creditBalance too large", code: "BALANCE_TOO_LARGE" });
      return;
    }
    nextBalance = absolute;
  } else {
    const deltaNum = typeof body.delta === "number" ? body.delta : Number(body.delta);
    if (!Number.isFinite(deltaNum) || !Number.isInteger(deltaNum) || deltaNum === 0) {
      res.status(400).json({ error: "delta must be a non-zero integer", code: "INVALID_DELTA" });
      return;
    }
    if (Math.abs(deltaNum) > 10_000) {
      res.status(400).json({ error: "delta too large", code: "DELTA_TOO_LARGE" });
      return;
    }
    nextBalance = Math.max(0, existing.creditBalance + deltaNum);
  }

  const appliedDelta = nextBalance - existing.creditBalance;

  const [user] = await db.update(usersTable)
    .set({ creditBalance: nextBalance, updatedAt: new Date() })
    .where(eq(usersTable.id, userId))
    .returning();

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  await logAdminAction(req.userId!, "admin_adjust_credits", userId, {
    delta: appliedDelta,
    previousBalance: existing.creditBalance,
    creditBalance: nextBalance,
  });

  res.json({
    ...toAdminUser(user),
    creditBalance: nextBalance,
    appliedDelta,
  });
});

// GET /admin/users/:userId/credit-purchases
router.get("/admin/users/:userId/credit-purchases", requireAdmin, async (req, res) => {
  const userId = String(req.params.userId ?? "").trim();
  if (!userId) { res.status(400).json({ error: "Invalid user ID" }); return; }

  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
  const offset = (page - 1) * limit;

  const where = and(
    eq(paymentsTable.userId, userId),
    eq(paymentsTable.kind, "credit_pack"),
    eq(paymentsTable.status, "completed"),
  );

  const [items, [{ total }]] = await Promise.all([
    db.select({
      id: paymentsTable.id,
      amount: paymentsTable.amount,
      currency: paymentsTable.currency,
      status: paymentsTable.status,
      credits: paymentsTable.credits,
      createdAt: paymentsTable.createdAt,
    })
      .from(paymentsTable)
      .where(where)
      .orderBy(desc(paymentsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(paymentsTable).where(where),
  ]);

  res.json({ items, total, page, limit });
});

// GET /admin/users/:userId/transactions — all payment activity for this user
router.get("/admin/users/:userId/transactions", requireAdmin, async (req, res) => {
  const userId = String(req.params.userId ?? "").trim();
  if (!userId) { res.status(400).json({ error: "Invalid user ID" }); return; }

  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
  const offset = (page - 1) * limit;

  // Hide abandoned PayPal checkouts (order created, never captured).
  const where = and(
    eq(paymentsTable.userId, userId),
    ne(paymentsTable.status, "pending"),
  );

  const [items, [{ total }]] = await Promise.all([
    db.select({
      id: paymentsTable.id,
      vin: paymentsTable.vin,
      amount: paymentsTable.amount,
      currency: paymentsTable.currency,
      status: paymentsTable.status,
      kind: paymentsTable.kind,
      credits: paymentsTable.credits,
      couponCode: paymentsTable.couponCode,
      paypalOrderId: paymentsTable.paypalOrderId,
      pokOrderId: paymentsTable.pokOrderId,
      createdAt: paymentsTable.createdAt,
    })
      .from(paymentsTable)
      .where(where)
      .orderBy(desc(paymentsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(paymentsTable).where(where),
  ]);

  res.json({
    items: items.map((row) => ({
      ...row,
      providerOrderId: row.pokOrderId ?? row.paypalOrderId ?? null,
    })),
    total,
    page,
    limit,
  });
});

// ── VIN LOOKUPS ───────────────────────────────────────────────────────────────

router.get("/admin/vin", requireAdmin, async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10)));
  const offset = (page - 1) * limit;
  const vin = String(req.query.vin ?? "");
  const status = req.query.status ? String(req.query.status) : undefined;
  const provider = req.query.provider ? String(req.query.provider) : undefined;
  const fromCacheRaw = req.query.fromCache;
  const fromCache = fromCacheRaw === "true" ? true : fromCacheRaw === "false" ? false : undefined;

  const conditions = [];
  if (vin) conditions.push(like(vinLookupsTable.vin, `%${vin.toUpperCase()}%`));
  if (status) conditions.push(eq(vinLookupsTable.status, status));
  if (provider) conditions.push(eq(vinLookupsTable.providerName, provider));
  if (fromCache !== undefined) conditions.push(eq(vinLookupsTable.fromCache, fromCache));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, [{ total }]] = await Promise.all([
    db.select().from(vinLookupsTable).where(where).orderBy(desc(vinLookupsTable.createdAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(vinLookupsTable).where(where),
  ]);

  res.json({ items, total, page, limit });
});

router.post("/admin/vin/export", requireAdmin, async (req, res) => {
  const body = req.body as { vin?: string; status?: string; provider?: string; fromCache?: boolean | string };
  const vin = body.vin ? String(body.vin) : "";
  const status = body.status ? String(body.status) : undefined;
  const provider = body.provider ? String(body.provider) : undefined;
  const fromCacheRaw = body.fromCache;
  const fromCache =
    fromCacheRaw === true || fromCacheRaw === "true"
      ? true
      : fromCacheRaw === false || fromCacheRaw === "false"
        ? false
        : undefined;

  const conditions = [];
  if (vin) conditions.push(like(vinLookupsTable.vin, `%${vin.toUpperCase()}%`));
  if (status) conditions.push(eq(vinLookupsTable.status, status));
  if (provider) conditions.push(eq(vinLookupsTable.providerName, provider));
  if (fromCache !== undefined) conditions.push(eq(vinLookupsTable.fromCache, fromCache));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: vinLookupsTable.id,
      vin: vinLookupsTable.vin,
      userId: vinLookupsTable.userId,
      status: vinLookupsTable.status,
      providerName: vinLookupsTable.providerName,
      fromCache: vinLookupsTable.fromCache,
      createdAt: vinLookupsTable.createdAt,
    })
    .from(vinLookupsTable)
    .where(where)
    .orderBy(desc(vinLookupsTable.createdAt))
    .limit(50000);

  const escape = (v: unknown): string => {
    const s = v == null ? "" : String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const header = "id,vin,userId,status,providerName,fromCache,createdAt\n";
  const body_csv = rows
    .map((r) =>
      [r.id, r.vin, r.userId, r.status, r.providerName ?? "", r.fromCache, r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt ?? "")]
        .map(escape)
        .join(",")
    )
    .join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="vin-lookups.csv"');
  res.send(header + body_csv);
});

router.delete("/admin/vin/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(vinLookupsTable).where(eq(vinLookupsTable.id, id));
  res.status(204).send();
});

router.post("/admin/vin/:id/refresh", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [lookup] = await db.select().from(vinLookupsTable).where(eq(vinLookupsTable.id, id)).limit(1);
  if (!lookup) { res.status(404).json({ error: "VIN lookup not found" }); return; }
  if (!requireAdminProviderBudget(req, res)) return;

  const refreshSource = resolveAdminRefreshSource(lookup.providerName, lookup.data);
  const carstat = await loadActiveCarstatProvider();

  if (refreshSource === "getcarapi") {
    if (!(await resolveGetCarApiConfig())) {
      res.status(503).json({ error: "GetCarAPI is not configured or is disabled" });
      return;
    }
  } else if (!carstat) {
    res.status(503).json({ error: "No active provider configured" });
    return;
  }

  const providerStamp =
    refreshSource === "getcarapi" ? GETCARAPI_PROVIDER_NAME : (carstat?.name ?? "carstat");

  try {
    const oldPhotoUrls = extractVinPhotoUrls(lookup.data);
    const data = await fetchFromProvider(
      lookup.vin,
      carstat?.baseUrl ?? "",
      carstat?.apiKey ?? "",
      {
        force: true,
        preferredSource: refreshSource,
        strictSource: true,
      },
    );
    const currentRate = await getCurrentKrwPerUsd();
    const existingCatalog = await db.select().from(vinCatalogTable).where(eq(vinCatalogTable.vin, lookup.vin)).limit(1);
    const existingCatalogData = (existingCatalog[0]?.data ?? {}) as Record<string, unknown>;
    const payload = stampCatalogImportData(
      sanitizeCatalogPayload(data as unknown as Record<string, unknown>),
      { existingRate: readFrozenKrwPerUsd(existingCatalogData), currentRate },
    );
    const [updated] = await db.transaction(async (tx) => {
      const rows = await tx.update(vinLookupsTable)
        .set({
          status: "complete",
          data: payload,
          providerName: providerStamp,
          fromCache: false,
          updatedAt: new Date(),
        })
        .where(eq(vinLookupsTable.id, id))
        .returning();
      await tx.insert(vinCatalogTable)
        .values({ vin: lookup.vin, data: payload, providerName: providerStamp, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: vinCatalogTable.vin,
          set: { data: payload, providerName: providerStamp, updatedAt: new Date() },
        });
      return rows;
    });
    await invalidateVinImageCache([
      ...oldPhotoUrls,
      ...extractVinPhotoUrls(payload),
    ]);
    res.json(updated);
  } catch (err) {
    logger.error({ err, id, refreshSource }, "Force refresh failed");
    const reason = err instanceof Error ? err.message : "";
    const label = refreshSource === "getcarapi" ? "GetCarAPI" : "provider";
    res.status(502).json({
      error: reason ? `Failed to refresh from ${label}: ${reason}` : `Failed to refresh from ${label}`,
    });
  }
});

// ── PROVIDERS ─────────────────────────────────────────────────────────────────

router.get("/admin/providers", requireAdmin, async (_req, res) => {
  const providers = await db.select().from(providersTable).orderBy(desc(providersTable.createdAt));
  res.json(providers.map(p => ({ ...p, apiKey: undefined })));
});

router.post("/admin/providers", requireAdmin, async (req, res) => {
  const { name, countryCode, baseUrl, apiKey, rateLimit, isActive } = req.body as {
    name: string; countryCode: string; baseUrl: string; apiKey?: string; rateLimit?: number; isActive?: boolean;
  };
  const urlCheck = validateProviderBaseUrl(baseUrl);
  if (!urlCheck.ok) {
    res.status(400).json({ error: urlCheck.error });
    return;
  }
  const [provider] = await db.insert(providersTable).values({
    name, countryCode, baseUrl: urlCheck.normalized, apiKey: apiKey ?? null, rateLimit: rateLimit ?? 100, isActive: isActive ?? false,
  }).returning();
  invalidateCountriesCache();
  res.status(201).json({ ...provider, apiKey: undefined });
});

router.patch("/admin/providers/carstat-bulk", requireAdmin, async (req, res) => {
  const { apiKey, isActive } = req.body as { apiKey?: string; isActive?: boolean };

  const existing = await db.select({ countryCode: providersTable.countryCode })
    .from(providersTable)
    .where(eq(providersTable.name, "Carstat"));
  const existingCodes = new Set(existing.map((p) => p.countryCode));

  const missing = SUPPORTED_COUNTRY_CODES.filter((code) => !existingCodes.has(code));
  if (missing.length > 0) {
    await db.insert(providersTable).values(
      missing.map((countryCode) => ({
        name: "Carstat",
        countryCode,
        baseUrl: "https://carstat.dev",
        apiKey: apiKey?.trim() || null,
        rateLimit: 100,
        isActive: isActive ?? false,
      })),
    );
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (apiKey !== undefined) updates.apiKey = apiKey || null;
  if (isActive !== undefined) updates.isActive = isActive;
  if (Object.keys(updates).length > 1) {
    await db.update(providersTable).set(updates).where(eq(providersTable.name, "Carstat"));
  }

  const providers = await db.select().from(providersTable).where(eq(providersTable.name, "Carstat"));
  invalidateCountriesCache();
  res.json(providers.map(p => ({ ...p, apiKey: undefined })));
});

router.patch("/admin/providers/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  const body = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) updates.name = String(body.name);
  if (body.countryCode !== undefined) updates.countryCode = String(body.countryCode);
  if (body.baseUrl !== undefined) {
    const urlCheck = validateProviderBaseUrl(String(body.baseUrl));
    if (!urlCheck.ok) {
      res.status(400).json({ error: urlCheck.error });
      return;
    }
    updates.baseUrl = urlCheck.normalized;
  }
  if (body.apiKey !== undefined) updates.apiKey = body.apiKey ? String(body.apiKey) : null;
  if (body.rateLimit !== undefined) updates.rateLimit = Number(body.rateLimit);
  if (body.isActive !== undefined) updates.isActive = Boolean(body.isActive);

  if (Object.keys(updates).length === 1) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  const [provider] = await db.update(providersTable)
    .set(updates)
    .where(eq(providersTable.id, id))
    .returning();
  if (!provider) { res.status(404).json({ error: "Provider not found" }); return; }
  invalidateCountriesCache();
  res.json({ ...provider, apiKey: undefined });
});

router.delete("/admin/providers/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  await db.delete(providersTable).where(eq(providersTable.id, id));
  invalidateCountriesCache();
  res.status(204).send();
});

router.post("/admin/providers/:id/test", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  const [provider] = await db.select().from(providersTable).where(eq(providersTable.id, id)).limit(1);

  if (!provider) {
    res.status(404).json({ ok: false, error: "Provider not found." });
    return;
  }
  if (!provider.baseUrl?.trim()) {
    res.status(400).json({ ok: false, error: "Provider has no API URL configured." });
    return;
  }
  if (!provider.apiKey?.trim()) {
    res.status(400).json({ ok: false, error: "Provider has no API key configured." });
    return;
  }

  try {
    const testVin = "WAUZZZ8V8J1073336";
    const result = await checkVinDeliverable(testVin, provider.baseUrl, provider.apiKey);

    if (result.status === "exists") {
      res.json({ ok: true, message: "Connected — local-exists OK and local-report succeeded for the test VIN (report call uses provider tokens)." });
      return;
    }
    if (result.status === "not_found") {
      res.json({ ok: false, error: "Provider responded but the test VIN has no report data." });
      return;
    }
    if (result.status === "no_access") {
      res.json({ ok: false, error: `Connected, but this API key cannot access report data (${result.hint ?? "empty lots for your key"}). Check your Carstat subscription domains.` });
      return;
    }

    res.json({ ok: false, error: result.reason });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("timeout") || msg.includes("TimeoutError")) {
      res.json({ ok: false, error: `Connection timed out after 10 s. Check the API URL is reachable.` });
    } else {
      res.json({ ok: false, error: `Could not reach the server: ${msg.slice(0, 120)}` });
    }
  }
});

// ── PRICING ───────────────────────────────────────────────────────────────────

router.get("/admin/pricing", requireAdmin, async (_req, res) => {
  const [pricing] = await db.select().from(pricingTable).orderBy(desc(pricingTable.id)).limit(1);
  res.json(normalizePricingAmounts(pricing ?? DEFAULT_PRICING));
});

router.patch("/admin/pricing", requireAdmin, async (req, res) => {
  const updates = req.body as { basePrice?: number; discountPrice?: number; discountEnabled?: boolean; currency?: string };
  const [existing] = await db.select().from(pricingTable).orderBy(desc(pricingTable.id)).limit(1);
  const nextBase = updates.basePrice ?? existing?.basePrice ?? DEFAULT_PRICING.basePrice;
  const nextDiscount = updates.discountPrice ?? existing?.discountPrice ?? DEFAULT_PRICING.discountPrice;
  const normalized = normalizePricingAmounts({
    basePrice: nextBase,
    discountPrice: nextDiscount,
  });
  if (existing) {
    const [updated] = await db.update(pricingTable)
      .set({
        ...updates,
        basePrice: normalized.basePrice,
        discountPrice: normalized.discountPrice,
        updatedAt: new Date(),
      })
      .where(eq(pricingTable.id, existing.id))
      .returning();
    invalidatePricingCache();
    res.json(normalizePricingAmounts(updated));
  } else {
    const [created] = await db.insert(pricingTable).values({
      basePrice: normalized.basePrice,
      discountPrice: normalized.discountPrice,
      currency: updates.currency ?? "EUR",
      discountEnabled: updates.discountEnabled ?? true,
    }).returning();
    invalidatePricingCache();
    res.json(normalizePricingAmounts(created));
  }
});

// ── SETTINGS ─────────────────────────────────────────────────────────────────

router.get("/admin/settings", requireAdmin, async (_req, res) => {
  const settings = await getEffectiveSystemSettings();
  if (!settings) {
    res.json({
      rateLimit: 10, rateLimitWindow: 60, maxVinsPerDay: 50,
      abuseDetectionEnabled: true, recaptchaEnabled: false,
      recaptchaSiteKey: null, recaptchaSecretKey: null,       maintenanceMode: false,
      maintenanceRestrictions: [], maintenanceMessage: null,
      vinLookupEnabled: true,
      getcarApiEnabled: true,
      getcarApiKeyConfigured: !!process.env["GETCARAPI_API_KEY"]?.trim(),
      freeVinDecoderEnabled: true, freeVinDecoderDailyLimit: 0, freeVinDecoderRequireSignIn: false,
      hasPaypalSecret: false, hasRecaptchaSecret: false, hasGoogleSecret: false, hasFacebookSecret: false, hasSmtpPass: false, hasPokSecret: false,
      googleButtonVisible: false, facebookButtonVisible: false,
    });
    return;
  }
  res.json(sanitizeAdminSettings(settings));
});

router.patch("/admin/settings", requireAdmin, async (req, res) => {
  const updates = req.body as Partial<{
    rateLimit: number; rateLimitWindow: number; maxVinsPerDay: number;
    abuseDetectionEnabled: boolean; recaptchaEnabled: boolean;
    recaptchaSiteKey: string | null; recaptchaSecretKey: string | null; recaptchaMinScore: number;
    maintenanceMode: boolean;
    maintenanceRestrictions: string[];
    maintenanceMessage: string | null;
    vinLookupEnabled: boolean;
    getcarApiEnabled: boolean;
    paypalClientId: string | null; paypalClientSecret: string | null;
    paypalSandbox: boolean; paypalEnableCards: boolean;
    pokMerchantId: string | null; pokKeyId: string | null; pokKeySecret: string | null;
    pokEnv: string;
    freeVinDecoderEnabled: boolean; freeVinDecoderDailyLimit: number; freeVinDecoderRequireSignIn: boolean;
    siteUrl: string | null;
    emailSendWelcome: boolean; emailSendReportConfirm: boolean; emailSendVinReady: boolean;
    emailSendPasswordReset: boolean; emailSendAbandonedCart: boolean;
    emailSendNoinfo: boolean;
    emailSendNoinforefund: boolean;
    emailSendAdminPendingVin: boolean;
    emailLogRetentionEnabled: boolean;
    emailTemplates: import("@workspace/db").EmailTemplatesConfig | null;
    smtpEnabled: boolean; smtpHost: string | null; smtpPort: number | null;
    smtpUser: string | null; smtpPass: string | null;
    smtpFromEmail: string | null; smtpFromName: string | null;
    maxFailedLogins: number; lockoutMinutes: number;
    adminMaxFailedLogins: number; adminLockoutMinutes: number;
    registerMaxPerHour: number; vinRatePerMinute: number;
    sessionDays: number; requireHttps: boolean;
    googleLoginEnabled: boolean; googleClientId: string | null; googleClientSecret: string | null;
    facebookLoginEnabled: boolean; facebookAppId: string | null; facebookAppSecret: string | null;
    logRetentionDays: number; failedTxnRetentionDays: number;
    krwPerUsd: number;
    analyticsGtmEnabled: boolean;
    analyticsGtmContainerId: string | null;
    analyticsGaEnabled: boolean;
    analyticsGaMeasurementId: string | null;
    analyticsClarityEnabled: boolean;
    analyticsClarityProjectId: string | null;
    analyticsMetaPixelEnabled: boolean;
    analyticsMetaPixelId: string | null;
  }>;

  const patch: Record<string, unknown> = { ...updates, updatedAt: new Date() };

  if ("krwPerUsd" in patch) {
    const rate = Number(patch.krwPerUsd);
    if (!Number.isFinite(rate) || rate <= 0 || rate > 100_000) {
      res.status(400).json({ error: "krwPerUsd must be between 1 and 100000" });
      return;
    }
    patch.krwPerUsd = rate;
  }

  const boundsError = validateBoundedSettingsPatch(patch);
  if (boundsError) {
    res.status(400).json({ error: boundsError });
    return;
  }

  if ("smtpSecurity" in patch) {
    const smtpSecError = validateSmtpSecurity(patch.smtpSecurity);
    if (smtpSecError) {
      res.status(400).json({ error: smtpSecError });
      return;
    }
    patch.smtpSecurity = normalizeSmtpSecurity(patch.smtpSecurity);
  }

  if ("maintenanceRestrictions" in patch) {
    patch.maintenanceRestrictions = normalizeMaintenanceRestrictions(patch.maintenanceRestrictions);
  }
  if ("maintenanceMessage" in patch) {
    patch.maintenanceMessage = normalizeMaintenanceMessage(patch.maintenanceMessage);
  }

  const analyticsFormatError = validateAnalyticsSettingsPatch(patch);
  if (analyticsFormatError) {
    res.status(400).json({ error: analyticsFormatError });
    return;
  }

  const [existing] = await db.select().from(systemSettingsTable).orderBy(desc(systemSettingsTable.id)).limit(1);

  const analyticsMergedError = validateAnalyticsSettingsMerged(patch, existing);
  if (analyticsMergedError) {
    res.status(400).json({ error: analyticsMergedError });
    return;
  }

  const trimText = (v: unknown) => (typeof v === "string" ? v.trim() || null : v);

  if ("paypalClientId" in patch) {
    const trimmed = trimText(patch.paypalClientId);
    if (trimmed === null) delete patch.paypalClientId;
    else patch.paypalClientId = trimmed;
  }
  if ("paypalClientSecret" in patch) {
    const secret = typeof patch.paypalClientSecret === "string" ? patch.paypalClientSecret.trim() : patch.paypalClientSecret;
    if (!secret) delete patch.paypalClientSecret;
    else patch.paypalClientSecret = secret;
  }
  if ("pokMerchantId" in patch) {
    const trimmed = trimText(patch.pokMerchantId);
    if (trimmed === null) delete patch.pokMerchantId;
    else patch.pokMerchantId = trimmed;
  }
  if ("pokKeyId" in patch) {
    const trimmed = trimText(patch.pokKeyId);
    if (trimmed === null) delete patch.pokKeyId;
    else patch.pokKeyId = trimmed;
  }
  if ("pokKeySecret" in patch) {
    const secret = typeof patch.pokKeySecret === "string" ? patch.pokKeySecret.trim() : patch.pokKeySecret;
    if (!secret) delete patch.pokKeySecret;
    else patch.pokKeySecret = secret;
  }
  if ("pokEnv" in patch) {
    const env = typeof patch.pokEnv === "string" ? patch.pokEnv.trim().toLowerCase() : patch.pokEnv;
    patch.pokEnv = env === "staging" ? "staging" : "production";
  }
  if ("recaptchaSecretKey" in patch) {
    const secret = typeof patch.recaptchaSecretKey === "string" ? patch.recaptchaSecretKey.trim() : patch.recaptchaSecretKey;
    if (!secret) delete patch.recaptchaSecretKey;
    else patch.recaptchaSecretKey = secret;
  }
  if ("googleClientId" in patch) {
    const trimmed = trimText(patch.googleClientId);
    patch.googleClientId = trimmed;
  }
  if ("googleClientSecret" in patch) {
    const secret = typeof patch.googleClientSecret === "string" ? patch.googleClientSecret.trim() : patch.googleClientSecret;
    if (!secret) delete patch.googleClientSecret;
    else patch.googleClientSecret = secret;
  }
  if ("facebookAppId" in patch) {
    const trimmed = trimText(patch.facebookAppId);
    patch.facebookAppId = trimmed;
  }
  if ("facebookAppSecret" in patch) {
    const secret = typeof patch.facebookAppSecret === "string" ? patch.facebookAppSecret.trim() : patch.facebookAppSecret;
    if (!secret) delete patch.facebookAppSecret;
    else patch.facebookAppSecret = secret;
  }
  delete patch.linkedinLoginEnabled;
  delete patch.linkedinClientId;
  delete patch.linkedinClientSecret;
  if ("smtpPass" in patch) {
    const secret = typeof patch.smtpPass === "string" ? patch.smtpPass.trim() : patch.smtpPass;
    if (!secret) delete patch.smtpPass;
    else patch.smtpPass = secret;
  }

  if (existing) {
    const [updated] = await db.update(systemSettingsTable)
      .set(patch)
      .where(eq(systemSettingsTable.id, existing.id))
      .returning();
    await logAdminAction(req.userId!, "admin_update_settings", "system", { fields: Object.keys(updates) });
    invalidatePublicSettingsCache();
    invalidateSettingsCache();
    invalidateFreeDecoderSettingsCache();
    invalidateGetCarApiSettingsCache();
    if (typeof updates.getcarApiEnabled === "boolean") {
      setGetCarApiEnabledCache(updates.getcarApiEnabled);
    }
    if (
      "pokMerchantId" in updates
      || "pokKeyId" in updates
      || "pokKeySecret" in updates
      || "pokEnv" in updates
    ) {
      clearPokTokenCache();
    }
    const effective = await getEffectiveSystemSettings();
    res.json(sanitizeAdminSettings(effective ?? updated));
  } else {
    const [created] = await db.insert(systemSettingsTable).values({
      rateLimit: updates.rateLimit ?? 10,
      rateLimitWindow: updates.rateLimitWindow ?? 60,
      maxVinsPerDay: updates.maxVinsPerDay ?? 50,
      abuseDetectionEnabled: updates.abuseDetectionEnabled ?? true,
      recaptchaEnabled: updates.recaptchaEnabled ?? false,
      recaptchaSiteKey: updates.recaptchaSiteKey ?? null,
      recaptchaSecretKey: updates.recaptchaSecretKey ?? null,
      maintenanceMode: updates.maintenanceMode ?? false,
      getcarApiEnabled: updates.getcarApiEnabled ?? true,
      freeVinDecoderEnabled: updates.freeVinDecoderEnabled ?? true,
      freeVinDecoderDailyLimit: updates.freeVinDecoderDailyLimit ?? 0,
      freeVinDecoderRequireSignIn: updates.freeVinDecoderRequireSignIn ?? false,
      siteUrl: updates.siteUrl ?? "https://verifykm.com",
      emailSendWelcome: updates.emailSendWelcome ?? true,
      emailSendReportConfirm: updates.emailSendReportConfirm ?? true,
      emailSendVinReady: updates.emailSendVinReady ?? true,
      emailSendPasswordReset: updates.emailSendPasswordReset ?? true,
      emailSendAbandonedCart: updates.emailSendAbandonedCart ?? false,
      emailSendNoinfo: updates.emailSendNoinfo ?? true,
      emailSendNoinforefund: updates.emailSendNoinforefund ?? true,
      emailSendAdminPendingVin: updates.emailSendAdminPendingVin ?? false,
      maxFailedLogins: updates.maxFailedLogins ?? 5,
      lockoutMinutes: updates.lockoutMinutes ?? 30,
      sessionDays: clampSessionDays(updates.sessionDays ?? 30),
      requireHttps: updates.requireHttps ?? false,
      googleLoginEnabled: updates.googleLoginEnabled ?? true,
      googleClientId: updates.googleClientId ?? null,
      googleClientSecret: updates.googleClientSecret ?? null,
      facebookLoginEnabled: updates.facebookLoginEnabled ?? true,
      facebookAppId: updates.facebookAppId ?? null,
      facebookAppSecret: updates.facebookAppSecret ?? null,
      krwPerUsd: updates.krwPerUsd ?? 1415,
      ...patch,
    }).returning();
    await logAdminAction(req.userId!, "admin_update_settings", "system", { fields: Object.keys(updates) });
    invalidatePublicSettingsCache();
    invalidateSettingsCache();
    invalidateFreeDecoderSettingsCache();
    invalidateGetCarApiSettingsCache();
    if (typeof updates.getcarApiEnabled === "boolean") {
      setGetCarApiEnabledCache(updates.getcarApiEnabled);
    }
    if (
      "pokMerchantId" in updates
      || "pokKeyId" in updates
      || "pokKeySecret" in updates
      || "pokEnv" in updates
    ) {
      clearPokTokenCache();
    }
    const effective = await getEffectiveSystemSettings();
    res.json(sanitizeAdminSettings(effective ?? created));
  }
});

// ── COUPONS ───────────────────────────────────────────────────────────────────

router.get("/admin/coupons", requireAdmin, async (_req, res) => {
  const items = await db.select().from(couponsTable).orderBy(desc(couponsTable.createdAt));
  res.json(items);
});

router.get("/admin/coupons/stats", requireAdmin, async (req, res) => {
  const days = Math.min(90, Math.max(7, parseInt(String(req.query.days ?? "30"), 10) || 30));

  const [coupons, overviewRaw, byDayRaw, byCouponPaymentsRaw, recentRaw] = await Promise.all([
    db.select().from(couponsTable),
    db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE coupon_code IS NOT NULL AND status = 'completed')::int AS total_redemptions,
        COALESCE(SUM(discount_amount) FILTER (WHERE coupon_code IS NOT NULL AND status = 'completed'), 0)::float AS total_discount,
        COALESCE(SUM(amount) FILTER (WHERE coupon_code IS NOT NULL AND status = 'completed'), 0)::float AS coupon_revenue,
        COUNT(*) FILTER (WHERE coupon_code IS NOT NULL AND status = 'completed' AND amount = 0)::int AS free_redemptions,
        COUNT(*) FILTER (
          WHERE coupon_code IS NOT NULL AND status = 'completed'
            AND created_at >= CURRENT_DATE - (${days} - 1) * INTERVAL '1 day'
        )::int AS redemptions_in_period
      FROM payments
      WHERE status <> 'voided'
    `),
    db.execute(sql`
      SELECT DATE(created_at) AS date,
        COUNT(*)::int AS redemptions,
        COALESCE(SUM(discount_amount), 0)::float AS discount,
        COALESCE(SUM(amount), 0)::float AS revenue
      FROM payments
      WHERE coupon_code IS NOT NULL
        AND status = 'completed'
        AND created_at >= CURRENT_DATE - (${days} - 1) * INTERVAL '1 day'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `),
    db.execute(sql`
      SELECT
        UPPER(coupon_code) AS code,
        COUNT(*)::int AS payment_redemptions,
        COALESCE(SUM(discount_amount), 0)::float AS total_discount,
        COALESCE(SUM(amount), 0)::float AS revenue,
        MAX(created_at) AS last_used_at
      FROM payments
      WHERE coupon_code IS NOT NULL AND status = 'completed'
      GROUP BY UPPER(coupon_code)
    `),
    db.execute(sql`
      SELECT p.id, p.coupon_code, p.amount, p.discount_amount, p.created_at, p.vin, u.email AS user_email
      FROM payments p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.coupon_code IS NOT NULL AND p.status = 'completed'
      ORDER BY p.created_at DESC
      LIMIT 20
    `),
  ]);

  const now = new Date();
  const activeCoupons = coupons.filter((c) => {
    if (!c.isActive) return false;
    if (c.expiresAt && c.expiresAt < now) return false;
    if (c.maxUses != null && c.uses >= c.maxUses) return false;
    return true;
  }).length;

  const overviewRow = (overviewRaw.rows[0] ?? {}) as {
    total_redemptions?: number;
    total_discount?: number;
    coupon_revenue?: number;
    free_redemptions?: number;
    redemptions_in_period?: number;
  };

  const paymentByCode = new Map(
    (byCouponPaymentsRaw.rows as Array<{
      code: string;
      payment_redemptions: number;
      total_discount: number;
      revenue: number;
      last_used_at: string | Date | null;
    }>).map((row) => [row.code, row]),
  );

  const byCoupon = coupons.map((c) => {
    const pay = paymentByCode.get(c.code.toUpperCase());
    return {
      id: c.id,
      code: c.code,
      type: c.type,
      value: c.value,
      uses: c.uses,
      maxUses: c.maxUses,
      isActive: c.isActive,
      expiresAt: c.expiresAt,
      paymentRedemptions: pay?.payment_redemptions ?? 0,
      totalDiscount: pay?.total_discount ?? 0,
      revenue: pay?.revenue ?? 0,
      lastUsedAt: pay?.last_used_at ?? null,
    };
  }).sort((a, b) => b.paymentRedemptions - a.paymentRedemptions);

  const orphanCodes = (byCouponPaymentsRaw.rows as Array<{ code: string; payment_redemptions: number; total_discount: number; revenue: number; last_used_at: string | Date | null }>)
    .filter((row) => !coupons.some((c) => c.code.toUpperCase() === row.code));

  for (const row of orphanCodes) {
    byCoupon.push({
      id: 0,
      code: row.code,
      type: "percent",
      value: 0,
      uses: row.payment_redemptions,
      maxUses: null,
      isActive: false,
      expiresAt: null,
      paymentRedemptions: row.payment_redemptions,
      totalDiscount: row.total_discount,
      revenue: row.revenue,
      lastUsedAt: row.last_used_at,
    });
  }

  res.json({
    days,
    overview: {
      totalCoupons: coupons.length,
      activeCoupons,
      totalRedemptions: Number(overviewRow.total_redemptions ?? 0),
      totalDiscountGiven: Number(overviewRow.total_discount ?? 0),
      couponRevenue: Number(overviewRow.coupon_revenue ?? 0),
      freeRedemptions: Number(overviewRow.free_redemptions ?? 0),
      redemptionsInPeriod: Number(overviewRow.redemptions_in_period ?? 0),
    },
    byDay: (byDayRaw.rows as Array<{ date: string; redemptions: number; discount: number; revenue: number }>).map((row) => ({
      date: String(row.date).substring(0, 10),
      redemptions: Number(row.redemptions),
      discount: Number(row.discount),
      revenue: Number(row.revenue),
    })),
    byCoupon,
    recentRedemptions: (recentRaw.rows as Array<{
      id: number;
      coupon_code: string;
      amount: number;
      discount_amount: number | null;
      created_at: string | Date;
      vin: string | null;
      user_email: string | null;
    }>).map((row) => ({
      id: row.id,
      couponCode: row.coupon_code,
      amount: Number(row.amount),
      discountAmount: row.discount_amount != null ? Number(row.discount_amount) : null,
      createdAt: row.created_at,
      vin: row.vin,
      userEmail: row.user_email,
    })),
  });
});

router.post("/admin/coupons", requireAdmin, async (req, res) => {
  const { code, type, value, maxUses, expiresAt, isActive } = req.body as {
    code: string; type: "percent" | "flat"; value: number;
    maxUses?: number | null; expiresAt?: string | null; isActive?: boolean;
  };
  if (!code?.trim()) { res.status(400).json({ error: "Code is required" }); return; }
  if (!["percent", "flat"].includes(type)) { res.status(400).json({ error: "Type must be percent or flat" }); return; }
  if (typeof value !== "number" || value <= 0) { res.status(400).json({ error: "Value must be > 0" }); return; }
  if (type === "percent" && value > 100) { res.status(400).json({ error: "Percent value cannot exceed 100" }); return; }

  try {
    const [coupon] = await db.insert(couponsTable).values({
      code: code.toUpperCase().trim(),
      type,
      value,
      maxUses: maxUses ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isActive: isActive ?? true,
    }).returning();
    res.status(201).json(coupon);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique")) { res.status(409).json({ error: "Coupon code already exists" }); return; }
    throw err;
  }
});

router.patch("/admin/coupons/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  const updates = req.body as Partial<{ isActive: boolean; maxUses: number | null; expiresAt: string | null }>;
  const [coupon] = await db.update(couponsTable)
    .set({
      ...(updates.isActive !== undefined ? { isActive: updates.isActive } : {}),
      ...(updates.maxUses !== undefined ? { maxUses: updates.maxUses } : {}),
      ...(updates.expiresAt !== undefined ? { expiresAt: updates.expiresAt ? new Date(updates.expiresAt) : null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(couponsTable.id, id))
    .returning();
  if (!coupon) { res.status(404).json({ error: "Coupon not found" }); return; }
  res.json(coupon);
});

router.delete("/admin/coupons/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  await db.delete(couponsTable).where(eq(couponsTable.id, id));
  res.status(204).send();
});

// ── ANNOUNCEMENTS ─────────────────────────────────────────────────────────────

router.get("/admin/announcements", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(announcementsTable).orderBy(desc(announcementsTable.id));
  res.json(rows);
});

router.post("/admin/announcements", requireAdmin, async (req, res) => {
  const { message, linkText, linkUrl, isActive, showTo, pages, endsAt, translations } =
    req.body as { message: string; linkText?: string; linkUrl?: string; isActive?: boolean; showTo?: string; pages?: string; endsAt?: string; translations?: Record<string, { message?: string; linkText?: string; linkUrl?: string; hidden?: boolean }> | null };
  if (!message?.trim()) { res.status(400).json({ error: "message is required" }); return; }
  const linkCheck = validateAnnouncementLinkUrl(linkUrl);
  if (!linkCheck.ok) { res.status(400).json({ error: linkCheck.error }); return; }
  const [row] = await db.insert(announcementsTable).values({
    message: message.trim(),
    linkText: linkText?.trim() || null,
    linkUrl: linkCheck.value,
    isActive: isActive ?? true,
    showTo: showTo ?? "all",
    pages: pages ?? "all",
    endsAt: endsAt ? new Date(endsAt) : null,
    translations: translations ?? null,
  }).returning();
  invalidateAnnouncementsCache();
  res.status(201).json(row);
});

router.patch("/admin/announcements/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  const { message, linkText, linkUrl, isActive, showTo, pages, endsAt, translations } =
    req.body as { message?: string; linkText?: string | null; linkUrl?: string | null; isActive?: boolean; showTo?: string; pages?: string; endsAt?: string | null; translations?: Record<string, { message?: string; linkText?: string; linkUrl?: string; hidden?: boolean }> | null };
  let safeLinkUrl: string | null | undefined;
  if (linkUrl !== undefined) {
    const linkCheck = validateAnnouncementLinkUrl(linkUrl);
    if (!linkCheck.ok) { res.status(400).json({ error: linkCheck.error }); return; }
    safeLinkUrl = linkCheck.value;
  }
  const [row] = await db.update(announcementsTable)
    .set({
      ...(message !== undefined && { message: message.trim() }),
      ...(linkText !== undefined && { linkText: linkText?.trim() || null }),
      ...(linkUrl !== undefined && { linkUrl: safeLinkUrl }),
      ...(isActive !== undefined && { isActive }),
      ...(showTo !== undefined && { showTo }),
      ...(pages !== undefined && { pages }),
      ...(endsAt !== undefined && { endsAt: endsAt ? new Date(endsAt) : null }),
      ...(translations !== undefined && { translations }),
    })
    .where(eq(announcementsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  invalidateAnnouncementsCache();
  res.json(row);
});

router.delete("/admin/announcements/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  await db.delete(announcementsTable).where(eq(announcementsTable.id, id));
  invalidateAnnouncementsCache();
  res.status(204).send();
});

// ── EMAIL ─────────────────────────────────────────────────────────────────────

/** `confirm` was merged into `vinready` — it is no longer editable. */
const EMAIL_TEMPLATE_TYPES = ["welcome", "vinready", "reset", "abandoned", "noinfo", "noinforefund"] as const;
type EmailTemplateType = typeof EMAIL_TEMPLATE_TYPES[number];

function isEmailTemplateType(v: string): v is EmailTemplateType {
  return (EMAIL_TEMPLATE_TYPES as readonly string[]).includes(v);
}

router.get("/admin/email/templates", requireAdmin, async (_req, res) => {
  const [settings] = await db
    .select({ emailTemplates: systemSettingsTable.emailTemplates })
    .from(systemSettingsTable)
    .orderBy(desc(systemSettingsTable.id))
    .limit(1);
  const stored = (settings?.emailTemplates ?? {}) as import("@workspace/db").EmailTemplatesConfig;
  const { mergeTemplateForAdmin } = await import("../lib/emailTemplates.js");
  const templates = Object.fromEntries(
    EMAIL_TEMPLATE_TYPES.map((type) => [type, mergeTemplateForAdmin(type, stored)]),
  );
  res.json({ templates });
});

router.put("/admin/email/templates/:type", requireAdmin, async (req, res) => {
  const type = String(req.params.type ?? "");
  if (!isEmailTemplateType(type)) {
    res.status(400).json({ error: "Invalid template type" });
    return;
  }
  const { subject, contentHtml, reset } = req.body as {
    subject?: string;
    contentHtml?: string;
    reset?: boolean;
  };

  const [current] = await db.select().from(systemSettingsTable).orderBy(desc(systemSettingsTable.id)).limit(1);
  const existing = (current?.emailTemplates ?? {}) as import("@workspace/db").EmailTemplatesConfig;

  if (reset) {
    delete existing[type];
  } else {
    const entry: import("@workspace/db").EmailTemplateOverride = {};
    if (subject !== undefined) entry.subject = subject;
    if (contentHtml !== undefined) entry.contentHtml = contentHtml;
    existing[type] = { ...existing[type], ...entry };
  }

  if (current) {
    await db.update(systemSettingsTable)
      .set({ emailTemplates: existing, updatedAt: new Date() })
      .where(eq(systemSettingsTable.id, current.id));
  } else {
    await db.insert(systemSettingsTable).values({ emailTemplates: existing });
  }

  const { mergeTemplateForAdmin } = await import("../lib/emailTemplates.js");
  res.json({ template: mergeTemplateForAdmin(type, existing) });
});

router.post("/admin/email/preview", requireAdmin, async (req, res) => {
  const body = req.body as {
    type?: string;
    subject?: string;
    contentHtml?: string;
    siteUrl?: string;
  };
  const type = String(body.type ?? req.query.type ?? "vinready");
  if (!isEmailTemplateType(type)) {
    res.status(400).json({ error: "Invalid template type" });
    return;
  }
  const { renderEmailTemplate, getSampleTemplateVars } = await import("../lib/emailTemplates.js");
  const { getSiteUrl } = await import("../lib/emailService.js");
  const siteUrl = (body.siteUrl ?? await getSiteUrl()).replace(/\/$/, "");
  const override = (body.subject || body.contentHtml)
    ? { subject: body.subject, contentHtml: body.contentHtml }
    : undefined;
  const { subject, html } = renderEmailTemplate(
    type,
    getSampleTemplateVars(type, siteUrl),
    override,
    siteUrl,
  );
  res.json({ subject, html });
});

router.get("/admin/email/preview", requireAdmin, async (req, res) => {
  const type = String(req.query.type ?? "vinready");
  if (!isEmailTemplateType(type)) {
    res.status(400).json({ error: "Invalid template type" });
    return;
  }
  const { renderEmailTemplate, getSampleTemplateVars } = await import("../lib/emailTemplates.js");
  const { getSiteUrl } = await import("../lib/emailService.js");
  const siteUrl = (await getSiteUrl()).replace(/\/$/, "");
  const { html } = renderEmailTemplate(type, getSampleTemplateVars(type, siteUrl), undefined, siteUrl);
  res.json({ html });
});

router.post("/admin/email/test", requireAdmin, async (req, res) => {
  try {
    const { to, type, subject, contentHtml, smtp } = req.body as {
      to?: string;
      type?: string;
      subject?: string;
      contentHtml?: string;
      smtp?: import("../lib/emailService.js").SmtpOverride;
    };
    if (!to?.trim()) { res.status(400).json({ error: "Recipient email (to) is required." }); return; }

    const { sendEmailWithDeadline, buildSmtpTestEmail, getSiteUrl } = await import("../lib/emailService.js");
    const siteUrl = (await getSiteUrl()).replace(/\/$/, "");

    let emailPayload: { subject: string; html: string; text?: string };
    if (type && isEmailTemplateType(type)) {
      const { renderEmailTemplate, getSampleTemplateVars } = await import("../lib/emailTemplates.js");
      const [settings] = await db
        .select({ emailTemplates: systemSettingsTable.emailTemplates })
        .from(systemSettingsTable)
        .orderBy(desc(systemSettingsTable.id))
        .limit(1);
      const stored = (settings?.emailTemplates ?? {}) as import("@workspace/db").EmailTemplatesConfig;
      const draftOverride = (subject || contentHtml) ? { subject, contentHtml } : undefined;
      const override = draftOverride ?? stored[type];
      emailPayload = renderEmailTemplate(type, getSampleTemplateVars(type, siteUrl), override, siteUrl);
    } else {
      emailPayload = buildSmtpTestEmail(siteUrl);
      emailPayload.text = "SMTP is working! Your verifykm email configuration is correctly set up.";
    }

    const result = await sendEmailWithDeadline({
      to: to.trim(),
      subject: emailPayload.subject,
      html: emailPayload.html,
      text: emailPayload.text,
      logType: "test",
      logMeta: { template: type ?? "smtp" },
    }, smtp && typeof smtp === "object" ? smtp : undefined);

    if (result.ok) {
      res.json({ ok: true });
      return;
    }

    res.status(502).json({
      ok: false,
      error: result.error ?? "Failed to send test email.",
      hint: result.hint,
      code: result.code,
    });
  } catch (err) {
    const { formatSmtpTransportError } = await import("../lib/smtpErrors.js");
    const detail = formatSmtpTransportError(err);
    res.status(500).json({
      ok: false,
      error: detail.error,
      hint: detail.hint ?? "An unexpected error occurred while sending the test email.",
      code: detail.code ?? "EMAIL_TEST_FAILED",
    });
  }
});

// ── EMAIL LOGS ────────────────────────────────────────────────────────────────

const EMAIL_LOG_TYPE_SET = new Set<string>(EMAIL_LOG_TYPES);

router.get("/admin/email/logs", requireAdmin, async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "25"), 10) || 25));
  const offset = (page - 1) * limit;

  const type = String(req.query.type ?? "").trim();
  const status = String(req.query.status ?? "").trim();
  const search = String(req.query.search ?? "").trim();
  const from = req.query.from ? String(req.query.from) : undefined;
  const to = req.query.to ? String(req.query.to) : undefined;

  const conditions = [];
  if (type && EMAIL_LOG_TYPE_SET.has(type)) {
    conditions.push(eq(emailLogsTable.type, type as (typeof EMAIL_LOG_TYPES)[number]));
  }
  if (status === "sent" || status === "failed") {
    conditions.push(eq(emailLogsTable.status, status));
  }
  if (search) {
    conditions.push(ilike(emailLogsTable.recipient, `%${search}%`));
  }
  if (from) {
    const d = new Date(from);
    if (!isNaN(d.getTime())) conditions.push(gte(emailLogsTable.createdAt, d));
  }
  if (to) {
    const d = new Date(to);
    if (!isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      conditions.push(lte(emailLogsTable.createdAt, d));
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rawItems, [{ total }]] = await Promise.all([
    db.select().from(emailLogsTable).where(where)
      .orderBy(desc(emailLogsTable.createdAt), desc(emailLogsTable.id))
      .limit(limit).offset(offset),
    db.select({ total: count() }).from(emailLogsTable).where(where),
  ]);

  const { sanitizeEmailLogMetaForApi, emailLogIsResendable } = await import("../lib/emailLog.js");
  const items = rawItems.map((row) => {
    const meta = (row.meta ?? null) as Record<string, unknown> | null;
    return {
      ...row,
      meta: sanitizeEmailLogMetaForApi(meta),
      resendable: emailLogIsResendable(row.status, meta),
    };
  });

  res.json({ items, total, page, limit, types: EMAIL_LOG_TYPES });
});

router.post("/admin/email/logs/:id/resend", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id) || id < 1) {
      res.status(400).json({ ok: false, error: "Invalid email log id." });
      return;
    }

    const [row] = await db.select().from(emailLogsTable).where(eq(emailLogsTable.id, id)).limit(1);
    if (!row) {
      res.status(404).json({ ok: false, error: "Email log not found." });
      return;
    }
    if (row.status !== "failed") {
      res.status(400).json({ ok: false, error: "Only failed emails can be resent." });
      return;
    }

    const meta = (row.meta ?? null) as Record<string, unknown> | null;
    const { getStoredEmailBody, markEmailLogSent, markEmailLogFailed } = await import("../lib/emailLog.js");
    const { html, text } = getStoredEmailBody(meta);
    if (!html) {
      res.status(400).json({
        ok: false,
        error:
          "Original message body was not stored for this log. New failed emails can be resent from here.",
      });
      return;
    }

    const { sendEmailWithDeadline } = await import("../lib/emailService.js");
    const result = await sendEmailWithDeadline({
      to: row.recipient,
      subject: row.subject || "(no subject)",
      html,
      text: text ?? undefined,
      skipLog: true,
    });

    if (result.ok) {
      await markEmailLogSent(id);
      try {
        await logAdminAction(req.userId!, "admin_resend_email", String(id), {
          recipient: row.recipient,
          type: row.type,
          subject: row.subject,
        });
      } catch {
        // Email already sent — audit log failure must not fail the response.
      }
      res.json({ ok: true });
      return;
    }

    await markEmailLogFailed(id, result.error ?? "Resend failed");
    res.status(502).json({
      ok: false,
      error: result.error ?? "Failed to resend email.",
      hint: result.hint,
      code: result.code,
    });
  } catch (err) {
    const { formatSmtpTransportError } = await import("../lib/smtpErrors.js");
    const detail = formatSmtpTransportError(err);
    res.status(500).json({
      ok: false,
      error: detail.error ?? "Could not resend email.",
      hint: detail.hint,
      code: detail.code ?? "EMAIL_RESEND_FAILED",
    });
  }
});

router.delete("/admin/email/logs", requireAdmin, async (req, res) => {
  await db.delete(emailLogsTable);
  await logAdminAction(req.userId!, "admin_clear_email_logs", "system", {});
  res.json({ ok: true });
});

router.post("/admin/email/pending-reminder", requireAdmin, async (req, res) => {
  const { userId } = req.body as { userId?: string };
  if (!userId) { res.status(400).json({ error: "userId is required" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  const [pricingRow] = await db.select().from(pricingTable).orderBy(desc(pricingTable.id)).limit(1);
  const pricing = normalizePricingAmounts(pricingRow ?? DEFAULT_PRICING);
  const price = pricing.discountEnabled ? pricing.discountPrice : pricing.basePrice;
  const currency = pricing.currency;
  const currencySymbol = currency === "EUR" ? "€" : "$";

  const pendingPayment = await db.select().from(paymentsTable)
    .where(and(eq(paymentsTable.userId, userId), eq(paymentsTable.status, "pending")))
    .orderBy(desc(paymentsTable.createdAt))
    .limit(1);
  const vin = pendingPayment[0]?.vin ?? "your vehicle";

  const [settingsRow] = await db
    .select({
      siteUrl: systemSettingsTable.siteUrl,
      emailSendAbandonedCart: systemSettingsTable.emailSendAbandonedCart,
      emailTemplates: systemSettingsTable.emailTemplates,
    })
    .from(systemSettingsTable).orderBy(desc(systemSettingsTable.id)).limit(1);
  if (settingsRow?.emailSendAbandonedCart === false) {
    res.json({ ok: false, error: "Abandoned cart emails are currently disabled in email settings." });
    return;
  }
  const siteUrl = settingsRow?.siteUrl?.replace(/\/$/, "") ?? "https://verifykm.com";
  const checkoutUrl = vin.length === 17
    ? `${siteUrl}/en/checkout?vin=${encodeURIComponent(vin)}`
    : `${siteUrl}/en/checkout`;
  const templates = (settingsRow?.emailTemplates ?? {}) as import("@workspace/db").EmailTemplatesConfig;
  const { sendEmail, buildPendingVinEmail } = await import("../lib/emailService.js");
  const { subject, html } = buildPendingVinEmail(
    user.name ?? user.email.split("@")[0],
    vin,
    checkoutUrl,
    `${currencySymbol}${price.toFixed(2)}`,
    siteUrl,
    templates.abandoned,
  );
  const result = await sendEmail({
    to: user.email,
    subject,
    html,
    logType: "abandoned",
    logMeta: { userId: user.id, vin: vin || null },
  });
  res.json(result);
});

// ── RECAPTCHA TEST ────────────────────────────────────────────────────────────

router.post("/admin/settings/test-recaptcha", requireAdmin, async (_req, res) => {
  const [settings] = await db.select().from(systemSettingsTable).orderBy(desc(systemSettingsTable.id)).limit(1);
  const secretKey = (settings as unknown as Record<string, unknown>)?.recaptchaSecretKey as string | null | undefined;

  if (!secretKey?.trim()) {
    res.status(400).json({ ok: false, error: "No reCAPTCHA secret key configured. Save your keys first." });
    return;
  }

  try {
    const params = new URLSearchParams({ secret: secretKey, response: "test-token-verifykm-admin" });
    const googleRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = await googleRes.json() as { success: boolean; "error-codes"?: string[] };
    const errorCodes = data["error-codes"] ?? [];

    if (errorCodes.includes("invalid-input-secret")) {
      res.json({ ok: false, error: "Secret key rejected by Google — double-check it matches the reCAPTCHA v3 key for your domain." });
    } else {
      res.json({ ok: true });
    }
  } catch (err) {
    logger.error({ err }, "reCAPTCHA test failed");
    res.status(502).json({ ok: false, error: "Could not reach Google's reCAPTCHA service. Check your server's network access." });
  }
});

// ── SOCIAL LOGIN TEST ─────────────────────────────────────────────────────────

router.post("/admin/settings/test-social-logins", requireAdmin, async (req, res) => {
  const overrides = (req.body?.overrides ?? undefined) as SocialLoginTestOverrides | undefined;
  const effective = await getEffectiveSystemSettings();
  const settings = applySocialLoginTestOverrides(effective, overrides);

  const proto = (req.headers["x-forwarded-proto"] as string | undefined) ?? req.protocol;
  const host = (req.headers["x-forwarded-host"] as string | undefined) ?? req.headers.host ?? "localhost";
  const siteOrigin = resolveSiteOrigin(proto, host);

  try {
    const report = await runAllSocialLoginTests(settings, siteOrigin);
    res.json(report);
  } catch (err) {
    logger.error({ err }, "social login test failed");
    res.status(500).json({
      ok: false,
      siteOrigin,
      testedAt: new Date().toISOString(),
      results: [],
      error: err instanceof Error ? err.message : "Social login test failed",
    });
  }
});

// ── TRANSACTIONS ─────────────────────────────────────────────────────────────

router.get("/admin/transactions", requireAdmin, async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10)));
  const offset = (page - 1) * limit;
  const status = req.query.status ? String(req.query.status) : undefined;
  const search = req.query.search ? String(req.query.search).trim() : undefined;

  const conditions = [];
  if (status === "failed" || status === "pending" || status === "voided" || status === "revoked" || status === "refunded") {
    // Keep history rows even when linked lookups were removed (credit / remove pending).
    conditions.push(eq(paymentsTable.status, status));
  } else if (status === "completed") {
    conditions.push(eq(paymentsTable.status, "completed"));
    conditions.push(or(
      paymentHasFulfilledLookup(),
      inArray(paymentsTable.kind, ["credit_pack", "credit_redemption"]),
    )!);
  } else if (status) {
    conditions.push(eq(paymentsTable.status, status));
    conditions.push(paymentHasFulfilledLookup());
  } else {
    conditions.push(recordedTransactionWhere());
  }
  if (search) {
    const q = `%${search}%`;
    conditions.push(or(
      like(paymentsTable.vin, `%${search.toUpperCase()}%`),
      ilike(paymentsTable.paypalOrderId, q),
      ilike(paymentsTable.pokOrderId, q),
      ilike(usersTable.email, q),
      ilike(usersTable.name, q),
    )!);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const baseQuery = db
    .select({
      id: paymentsTable.id,
      userId: paymentsTable.userId,
      userEmail: usersTable.email,
      userName: usersTable.name,
      vin: paymentsTable.vin,
      amount: paymentsTable.amount,
      currency: paymentsTable.currency,
      status: paymentsTable.status,
      kind: paymentsTable.kind,
      paypalOrderId: paymentsTable.paypalOrderId,
      pokOrderId: paymentsTable.pokOrderId,
      couponCode: paymentsTable.couponCode,
      discountAmount: paymentsTable.discountAmount,
      vinLookupId: paymentsTable.vinLookupId,
      createdAt: paymentsTable.createdAt,
    })
    .from(paymentsTable)
    .leftJoin(usersTable, eq(paymentsTable.userId, usersTable.id));

  const [rawItems, countResult, summaryResult] = await Promise.all([
    (where ? baseQuery.where(where) : baseQuery)
      .orderBy(desc(paymentsTable.createdAt))
      .limit(limit)
      .offset(offset),
    (where
      ? db.select({ total: count() }).from(paymentsTable).leftJoin(usersTable, eq(paymentsTable.userId, usersTable.id)).where(where)
      : db.select({ total: count() }).from(paymentsTable)
    ),
    db.execute(sql`
      SELECT status, COUNT(*)::int as cnt,
        COALESCE(SUM(
          CASE WHEN COALESCE(p.kind, 'vin_report') = 'credit_redemption' THEN 0 ELSE p.amount END
        ), 0)::float as rev
      FROM payments p
      WHERE status <> 'voided'
        AND (
          status IN ('failed', 'pending', 'revoked', 'refunded')
          OR (status = 'completed' AND p.kind IN ('credit_pack', 'credit_redemption'))
          OR EXISTS (
            SELECT 1 FROM vin_lookups vl
            WHERE vl.payment_id = p.id AND vl.status IN ('complete', 'pending_manual')
          )
        )
      GROUP BY status
    `),
  ]);

  const items = rawItems.map((row) => {
    const paymentMethod = row.pokOrderId
      ? "pok"
      : row.paypalOrderId
        ? "paypal"
        : row.kind === "credit_redemption"
          ? "credit"
          : row.amount === 0
            ? "free"
            : null;
    return {
      ...row,
      paymentMethod,
      providerOrderId: row.pokOrderId ?? row.paypalOrderId ?? null,
    };
  });

  const statusRows = summaryResult.rows as Array<{ status: string; cnt: number; rev: number }>;
  const counts: Record<string, number> = {};
  for (const row of statusRows) {
    counts[row.status] = Number(row.cnt);
  }
  // Keep revoked amounts in revenue (pending credit/remove must not deduct).
  const totalRevenue = sumCollectedRevenue(statusRows);

  res.json({
    items,
    total: countResult[0]?.total ?? 0,
    page,
    limit,
    summary: { totalRevenue, counts },
  });
});

// DELETE /admin/transactions/:id — soft-delete (void) a payment record for audit trail
router.delete("/admin/transactions/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid transaction ID" });
    return;
  }
  const [payment] = await db.select({ id: paymentsTable.id, status: paymentsTable.status })
    .from(paymentsTable)
    .where(eq(paymentsTable.id, id))
    .limit(1);
  if (!payment) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  if (payment.status === "voided") {
    res.json({ voided: true, id });
    return;
  }
  await db.update(paymentsTable)
    .set({ status: "voided", updatedAt: new Date() })
    .where(eq(paymentsTable.id, id));
  await logAdminAction(req.userId!, "admin_void_transaction", String(id), { previousStatus: payment.status });
  logger.info({ msg: "admin_transaction_voided", transactionId: id, adminId: req.userId });
  res.json({ voided: true, id });
});

// ── VIN CATALOG ──────────────────────────────────────────────────────────────

router.post("/admin/vin-catalog", requireAdmin, async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const vin = String(body.vin ?? "").trim().toUpperCase();
  if (vin.length !== 17) { res.status(400).json({ error: "VIN must be exactly 17 characters" }); return; }

  const [existing] = await db.select({ id: vinCatalogTable.id }).from(vinCatalogTable)
    .where(eq(vinCatalogTable.vin, vin)).limit(1);
  if (existing) { res.status(409).json({ error: "VIN already exists in catalog. Use the detail page to update it." }); return; }

  const { vin: _vin, providerName: pn, ...rawData } = body;
  const providerName = typeof pn === "string" && pn.trim() ? pn.trim() : "manual";
  const data = applyFrozenKrwPerUsd(
    sanitizeCatalogPayload(rawData as Record<string, unknown>),
    { currentRate: await getCurrentKrwPerUsd() },
  );

  const [entry] = await db.insert(vinCatalogTable).values({
    vin, data, providerName, updatedAt: new Date(),
  }).returning();

  logger.info({ vin, providerName }, "VIN catalog entry created manually by admin");
  res.status(201).json(entry);
});

/** Catalog rows that are unpublished manual-pending stubs — hide from admin catalog list. */
const catalogListableCondition = sql`(
  ${vinCatalogTable.data} IS NULL
  OR COALESCE((${vinCatalogTable.data}->>'fulfillmentPending')::boolean, false) = false
)`;

router.get("/admin/vin-catalog", requireAdmin, async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10)));
  const offset = (page - 1) * limit;
  const search = String(req.query.vin ?? "");
  const provider = String(req.query.provider ?? "");

  const conditions = [catalogListableCondition];
  if (search) conditions.push(like(vinCatalogTable.vin, `%${search.toUpperCase()}%`));
  if (provider) conditions.push(eq(vinCatalogTable.providerName, provider));
  const where = and(...conditions);

  const [items, [{ total }], providerStatsRaw] = await Promise.all([
    db.select().from(vinCatalogTable).where(where).orderBy(desc(vinCatalogTable.importedAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(vinCatalogTable).where(where),
    db.select({ provider: vinCatalogTable.providerName, cnt: count() })
      .from(vinCatalogTable)
      .where(catalogListableCondition)
      .groupBy(vinCatalogTable.providerName),
  ]);

  const providerStats = providerStatsRaw.filter(
    (s) => s.provider !== "manual_pending",
  );

  res.json({ items, total, page, limit, providerStats });
});

router.get("/admin/vin-catalog/export", requireAdmin, async (req, res) => {
  const format = String(req.query.format ?? "csv").toLowerCase();
  const provider = String(req.query.provider ?? "");
  const where = provider ? eq(vinCatalogTable.providerName, provider) : undefined;
  const date = new Date().toISOString().split("T")[0];

  if (format === "json") {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="vin-catalog-${date}.json"`);
    res.write("[");
    let first = true;
    let lastId = 0;
    for (;;) {
      const rows = await db.select().from(vinCatalogTable)
        .where(and(where, gt(vinCatalogTable.id, lastId)))
        .orderBy(vinCatalogTable.id).limit(500);
      if (rows.length === 0) break;
      for (const row of rows) {
        if (!first) res.write(",");
        res.write(JSON.stringify(buildCatalogJsonExportRecord({
          id: row.id,
          vin: row.vin,
          providerName: row.providerName,
          importedAt: row.importedAt,
          updatedAt: row.updatedAt,
          data: (row.data ?? {}) as Record<string, unknown>,
        })));
        first = false;
      }
      lastId = rows[rows.length - 1].id;
      if (rows.length < 500) break;
    }
    res.end("]");
    return;
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="vin-catalog-${date}.csv"`);
  res.write(`${CATALOG_CSV_COLUMNS.join(",")}\n`);
  let lastId = 0;
  for (;;) {
    const rows = await db.select().from(vinCatalogTable)
      .where(and(where, gt(vinCatalogTable.id, lastId)))
      .orderBy(vinCatalogTable.id).limit(500);
    if (rows.length === 0) break;
    for (const row of rows) {
      const d = (row.data ?? {}) as Record<string, unknown>;
      res.write(catalogDataToCsvCells({
        id: row.id,
        vin: row.vin,
        providerName: row.providerName,
        importedAt: row.importedAt,
        updatedAt: row.updatedAt,
      }, d).join(",") + "\n");
    }
    lastId = rows[rows.length - 1].id;
    if (rows.length < 500) break;
  }
  res.end();
});

// ── VIN CATALOG: IMPORT ───────────────────────────────────────────────────────

const CATALOG_IMPORT_BATCH = 200;
const MAX_IMPORT_CONFLICTS = 100;
const MAX_JSON_IMPORT_ROWS = 15_000;

type CatalogImportBatchRow = {
  vin: string;
  provider: string | null;
  data: Record<string, unknown>;
};

async function upsertCatalogImportBatch(
  batch: CatalogImportBatchRow[],
  conflictSamples: Array<{ vin: string; existing: string; incoming: string }>,
): Promise<{ inserted: number; updated: number; conflicts: number; photoUrls: string[] }> {
  const rows = dedupeCatalogImportRows(batch);
  if (rows.length === 0) return { inserted: 0, updated: 0, conflicts: 0, photoUrls: [] };

  const currentRate = await getCurrentKrwPerUsd();
  const vinList = rows.map((r) => r.vin);
  const found = await db.select().from(vinCatalogTable).where(inArray(vinCatalogTable.vin, vinList));
  const existingMap = new Map(found.map((r) => [r.vin, r]));

  const toInsert: Array<{ vin: string; providerName: string | null; data: Record<string, unknown> }> = [];
  const toUpdate: Array<{ vin: string; data: Record<string, unknown>; provider: string | null }> = [];
  let conflicts = 0;
  const photoUrls: string[] = [];

  for (const row of rows) {
    const cur = existingMap.get(row.vin);
    if (!cur) {
      const stamped = stampCatalogImportData(row.data, { currentRate });
      toInsert.push({ vin: row.vin, providerName: row.provider, data: stamped });
      photoUrls.push(...extractVinPhotoUrls(stamped));
    } else {
      const curData = (cur.data ?? {}) as Record<string, unknown>;
      if (catalogIdentityConflict(curData, row.data)) {
        conflicts++;
        if (conflictSamples.length < MAX_IMPORT_CONFLICTS) {
          conflictSamples.push({
            vin: row.vin,
            existing: formatCatalogIdentity(curData),
            incoming: formatCatalogIdentity(row.data),
          });
        }
      } else {
        const merged = mergeCatalogData(curData, row.data);
        const stamped = stampCatalogImportData(merged, {
          existingRate: readFrozenKrwPerUsd(curData),
          currentRate,
        });
        toUpdate.push({
          vin: row.vin,
          data: stamped,
          provider: row.provider ?? cur.providerName,
        });
        photoUrls.push(...extractVinPhotoUrls(stamped));
      }
    }
  }

  let inserted = 0;
  let updated = 0;

  if (toInsert.length > 0) {
    const result = await db.insert(vinCatalogTable)
      .values(toInsert.map((r) => ({ vin: r.vin, providerName: r.providerName, data: r.data, updatedAt: new Date() })))
      .onConflictDoNothing()
      .returning({ id: vinCatalogTable.id, vin: vinCatalogTable.vin, data: vinCatalogTable.data });
    inserted = result.length;
    if (result.length > 0) {
      await propagateCatalogDataToLookups(result.map((r) => ({
        vin: r.vin,
        data: (r.data ?? {}) as Record<string, unknown>,
      })));
    }
  }

  if (toUpdate.length > 0) {
    await db.insert(vinCatalogTable)
      .values(toUpdate.map((u) => ({ vin: u.vin, data: u.data, providerName: u.provider, updatedAt: new Date() })))
      .onConflictDoUpdate({
        target: vinCatalogTable.vin,
        set: {
          data: sql`excluded.data`,
          updatedAt: sql`now()`,
          providerName: sql`COALESCE(excluded.provider_name, ${vinCatalogTable.providerName})`,
        },
      });
    updated = toUpdate.length;
    await propagateCatalogDataToLookups(toUpdate.map((u) => ({ vin: u.vin, data: u.data })));
  }

  return { inserted, updated, conflicts, photoUrls };
}

router.post(
  "/admin/vin-catalog/import",
  requireAdmin,
  upload.single("file"),
  async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "Multipart field 'file' is required" }); return; }

  let totalInserted = 0, totalUpdated = 0, totalConflicts = 0, invalidSkipped = 0, batchErrors = 0;
  const allConflicts: Array<{ vin: string; existing: string; incoming: string }> = [];
  let total = 0;

  type ParsedCsvRow = NonNullable<ReturnType<typeof catalogDataFromCsvRecord>>;

  let currentBatch: CatalogImportBatchRow[] = [];
  const flushBatch = async () => {
    if (currentBatch.length === 0) return;
    try {
      const result = await upsertCatalogImportBatch(currentBatch, allConflicts);
      totalInserted += result.inserted;
      totalUpdated += result.updated;
      totalConflicts += result.conflicts;
      if (result.photoUrls.length > 0) {
        await invalidateVinImageCache(result.photoUrls);
      }
    } catch (err) {
      batchErrors++;
      logger.error({ err, batchSize: currentBatch.length }, "VIN catalog CSV import batch failed");
    } finally {
      currentBatch = [];
    }
  };

  try {
    const fileStream = createReadStream(req.file.path);
    const parser = fileStream.pipe(
      csvParse({ columns: true, trim: true, skip_empty_lines: true, bom: true })
    );
    for await (const record of parser) {
      const parsed = catalogDataFromCsvRecord(record as Record<string, unknown>);
      if (!parsed) {
        invalidSkipped++;
        continue;
      }
      currentBatch.push({
        vin: parsed.vin,
        provider: parsed.provider,
        data: catalogDataFromCsvRow(parsed),
      });
      total++;
      if (currentBatch.length >= CATALOG_IMPORT_BATCH) {
        await flushBatch();
      }
    }
    await flushBatch();
  } catch (err) {
    res.status(400).json({ error: "Failed to parse CSV: " + String((err as Error).message ?? err) });
    return;
  } finally {
    unlink(req.file.path, () => {});
  }

  if (total === 0 && invalidSkipped === 0) {
    res.status(400).json({ error: "No valid 17-character VINs found in CSV" });
    return;
  }

  logger.info({ inserted: totalInserted, updated: totalUpdated, skipped: totalConflicts, invalidSkipped, batchErrors, total }, "VIN catalog CSV import completed");
  res.json({
    inserted: totalInserted,
    updated: totalUpdated,
    skipped: totalConflicts,
    conflicts: allConflicts,
    conflictsTruncated: totalConflicts > MAX_IMPORT_CONFLICTS,
    invalidSkipped,
    batchErrors,
    total,
  });
});

// ── VIN CATALOG: IMPORT JSON ──────────────────────────────────────────────────

router.post(
  "/admin/vin-catalog/import-json",
  requireAdmin,
  upload.single("file"),
  async (req, res) => {
    if (!req.file) { res.status(400).json({ error: "Multipart field 'file' is required" }); return; }

    let totalInserted = 0, totalUpdated = 0, total = 0, totalConflicts = 0;
    let invalidSkipped = 0, batchErrors = 0;
    const allConflicts: Array<{ vin: string; existing: string; incoming: string }> = [];

    let currentBatch: CatalogImportBatchRow[] = [];
    const flushBatch = async () => {
      if (currentBatch.length === 0) return;
      try {
        const result = await upsertCatalogImportBatch(currentBatch, allConflicts);
        totalInserted += result.inserted;
        totalUpdated += result.updated;
        totalConflicts += result.conflicts;
        if (result.photoUrls.length > 0) {
          await invalidateVinImageCache(result.photoUrls);
        }
      } catch (err) {
        batchErrors++;
        logger.error({ err, batchSize: currentBatch.length }, "VIN catalog JSON import batch failed");
      } finally {
        currentBatch = [];
      }
    };

    try {
      await forEachJsonArrayRecord(
        req.file.path,
        { maxRows: MAX_JSON_IMPORT_ROWS },
        async (record) => {
          const normalized = normalizeJsonImportRecord(record as JsonImportRecord);
          if (!normalized) {
            invalidSkipped++;
            return;
          }
          currentBatch.push({
            vin: normalized.vin,
            provider: normalized.provider,
            data: normalized.data,
          });
          total++;
          if (currentBatch.length >= CATALOG_IMPORT_BATCH) {
            await flushBatch();
          }
        },
      );
    } catch (err) {
      res.status(400).json({ error: "Invalid JSON: " + String((err as Error).message ?? err) });
      return;
    } finally {
      unlink(req.file.path, () => {});
    }

    await flushBatch();

    if (total === 0 && invalidSkipped === 0) {
      res.status(400).json({ error: "No valid 17-character VINs found in JSON" });
      return;
    }

    logger.info({ inserted: totalInserted, updated: totalUpdated, skipped: totalConflicts, invalidSkipped, batchErrors, total }, "VIN catalog JSON import completed");
    res.json({
      inserted: totalInserted,
      updated: totalUpdated,
      skipped: totalConflicts,
      conflicts: allConflicts,
      conflictsTruncated: totalConflicts > MAX_IMPORT_CONFLICTS,
      invalidSkipped,
      batchErrors,
      total,
    });
  }
);

// ── VIN CATALOG: BY-VIN DETAIL / EDIT / ASSIGN ───────────────────────────────

router.get("/admin/vin-catalog/by-vin/:vin", requireAdmin, async (req, res) => {
  const vin = String(req.params.vin ?? "").toUpperCase();
  if (vin.length !== 17) { res.status(400).json({ error: "Invalid VIN" }); return; }
  const assignedPage = Math.max(1, parseInt(String(req.query.assignedPage ?? "1"), 10));
  const assignedLimit = Math.min(100, Math.max(1, parseInt(String(req.query.assignedLimit ?? "50"), 10)));
  const assignedOffset = (assignedPage - 1) * assignedLimit;

  const [entry] = await db.select().from(vinCatalogTable).where(eq(vinCatalogTable.vin, vin)).limit(1);
  if (!entry) { res.status(404).json({ error: "VIN not found in catalog" }); return; }

  const [{ lookupCount }] = await db.select({ lookupCount: count() })
    .from(vinLookupsTable).where(eq(vinLookupsTable.vin, vin));

  const [assignedUsers, [{ assignedTotal }]] = await Promise.all([
    db.execute(sql`
      SELECT vl.id, vl.user_id, vl.created_at, u.email, u.name
      FROM vin_lookups vl
      LEFT JOIN users u ON vl.user_id = u.id
      WHERE vl.vin = ${vin} AND vl.status IN ('complete', 'pending_manual') AND vl.user_id IS NOT NULL
      ORDER BY vl.created_at DESC LIMIT ${assignedLimit} OFFSET ${assignedOffset}
    `),
    db.select({ assignedTotal: count() }).from(vinLookupsTable)
      .where(and(
        eq(vinLookupsTable.vin, vin),
        or(eq(vinLookupsTable.status, "complete"), eq(vinLookupsTable.status, "pending_manual")),
        sql`user_id IS NOT NULL`,
      )),
  ]);

  res.json({ ...entry, lookupCount, assignedTotal, assignedPage, assignedLimit, assignedUsers: assignedUsers.rows });
});

router.patch("/admin/vin-catalog/by-vin/:vin", requireAdmin, async (req, res) => {
  const vin = String(req.params.vin ?? "").toUpperCase();
  if (vin.length !== 17) { res.status(400).json({ error: "Invalid VIN" }); return; }
  const [entry] = await db.select().from(vinCatalogTable).where(eq(vinCatalogTable.vin, vin)).limit(1);
  if (!entry) { res.status(404).json({ error: "VIN not found in catalog" }); return; }
  const body = req.body as Record<string, unknown> & { propagateToLookups?: boolean };
  const { propagateToLookups: _omit, ...catalogFields } = body;
  const entryData = (entry.data ?? {}) as Record<string, unknown>;
  const merged = applyCatalogAdminPatch(entryData, catalogFields as Record<string, unknown>);
  const mileageTouched = detectAdminCatalogMileageTouched(entryData, catalogFields);
  let prepared = finalizeAdminCatalogSave(merged, mileageTouched);

  // Admin form always sends odometer — if finalize did not lock (edge cases), honor submitted km.
  if ("odometer" in catalogFields) {
    const submitted = catalogFields.odometer == null || catalogFields.odometer === ""
      ? null
      : Number(catalogFields.odometer);
    if (
      submitted != null
      && Number.isFinite(submitted)
      && submitted > 0
      && (mileageTouched.odometer || mileageTouched.mileageHistory)
      && prepared.odometerLocked !== true
    ) {
      prepared = reconcileLockedOdometerData(prepared, submitted);
    }
  }
  delete prepared.fulfillmentPending;
  const currentRate = await getCurrentKrwPerUsd();
  const stamped = applyFrozenKrwPerUsd(prepared, {
    existingRate: readFrozenKrwPerUsd(entryData),
    currentRate,
  });
  const oldPhotoUrls = extractVinPhotoUrls(entry.data);
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(vinCatalogTable).set({ data: stamped, updatedAt: now }).where(eq(vinCatalogTable.vin, vin));
  });
  await syncStampedCatalogToAllLookups(vin, stamped, now);
  await invalidateVinImageCache([
    ...oldPhotoUrls,
    ...extractVinPhotoUrls(stamped),
  ]);
  const [updated] = await db.select().from(vinCatalogTable).where(eq(vinCatalogTable.vin, vin)).limit(1);
  res.json(updated);
});

router.post("/admin/vin-catalog/by-vin/:vin/assign", requireAdmin, async (req, res) => {
  const vin = String(req.params.vin ?? "").toUpperCase();
  if (vin.length !== 17) { res.status(400).json({ error: "Invalid VIN" }); return; }
  const { userId } = req.body as { userId?: string };
  if (!userId?.trim()) { res.status(400).json({ error: "userId is required" }); return; }
  const [[entry], [user]] = await Promise.all([
    db.select().from(vinCatalogTable).where(eq(vinCatalogTable.vin, vin)).limit(1),
    db.select({ id: usersTable.id, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, userId)).limit(1),
  ]);
  if (!entry) { res.status(404).json({ error: "VIN not found in catalog" }); return; }
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  const [existing] = await db.select({ id: vinLookupsTable.id }).from(vinLookupsTable)
    .where(and(eq(vinLookupsTable.vin, vin), eq(vinLookupsTable.userId, userId), eq(vinLookupsTable.status, "complete")))
    .limit(1);
  if (existing) { res.status(409).json({ error: "User already has access to this VIN report" }); return; }
  const [lookup] = await db.insert(vinLookupsTable).values({
    vin, userId, status: "complete",
    data: entry.data as unknown as Record<string, unknown>,
    providerName: entry.providerName, fromCache: true, paymentId: null,
  }).returning();
  logger.info({ vin, userId }, "VIN manually assigned to user by admin");
  res.status(201).json({ ok: true, lookupId: lookup.id });
});

router.post("/admin/vin-catalog/by-vin/:vin/refresh", requireAdmin, async (req, res) => {
  const vin = String(req.params.vin ?? "").toUpperCase();
  if (vin.length !== 17) { res.status(400).json({ error: "Invalid VIN" }); return; }
  if (!requireAdminProviderBudget(req, res)) return;

  const [existingEntry] = await db.select().from(vinCatalogTable).where(eq(vinCatalogTable.vin, vin)).limit(1);
  const refreshSource = resolveAdminRefreshSource(
    existingEntry?.providerName,
    existingEntry?.data,
  );
  const carstat = await loadActiveCarstatProvider();

  if (refreshSource === "getcarapi") {
    if (!(await resolveGetCarApiConfig())) {
      res.status(503).json({ error: "GetCarAPI is not configured or is disabled" });
      return;
    }
  } else if (!carstat) {
    res.status(503).json({ error: "No active provider configured" });
    return;
  }

  const providerStamp =
    refreshSource === "getcarapi" ? GETCARAPI_PROVIDER_NAME : (carstat?.name ?? "carstat");

  try {
    const oldPhotoUrls = extractVinPhotoUrls(existingEntry?.data);
    const existingData = (existingEntry?.data ?? {}) as Record<string, unknown>;
    const existingCatalogRate = readFrozenKrwPerUsd(existingData);
    const data = await fetchFromProvider(
      vin,
      carstat?.baseUrl ?? "",
      carstat?.apiKey ?? "",
      {
        force: true,
        preferredSource: refreshSource,
        strictSource: true,
      },
    );
    const payload = sanitizeCatalogPayload(data as unknown as Record<string, unknown>);
    const currentRate = await getCurrentKrwPerUsd();
    const stampedCatalog = preserveAdminTaxiFlag(
      stampCatalogImportData(payload, {
        existingRate: existingCatalogRate,
        currentRate,
      }),
      existingData,
    );
    const lookups = await db.select().from(vinLookupsTable).where(eq(vinLookupsTable.vin, vin));
    await db.transaction(async (tx) => {
      await tx.insert(vinCatalogTable)
        .values({ vin, data: stampedCatalog, providerName: providerStamp, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: vinCatalogTable.vin,
          set: { data: stampedCatalog, providerName: providerStamp, updatedAt: new Date() },
        });
      await Promise.all(lookups.map((lookup) => {
        const lookupData = (lookup.data ?? {}) as Record<string, unknown>;
        const lookupRate = readFrozenKrwPerUsd(lookupData);
        const lookupPayload = preserveAdminTaxiFlag(
          stampCatalogImportData(payload, {
            existingRate: lookupRate ?? existingCatalogRate,
            currentRate,
          }),
          lookupData,
        );
        return tx.update(vinLookupsTable)
          .set({
            data: lookupPayload,
            providerName: providerStamp,
            updatedAt: new Date(),
          })
          .where(eq(vinLookupsTable.id, lookup.id));
      }));
    });
    await invalidateVinImageCache([
      ...oldPhotoUrls,
      ...extractVinPhotoUrls(stampedCatalog),
    ]);
    logger.info({ vin, refreshSource }, "VIN catalog entry refreshed from provider");
    res.json({
      ok: true,
      vin,
      refreshedFrom: refreshSource,
      providerName: providerStamp,
      updatedAt: new Date().toISOString(),
      data: stampedCatalog,
      ownerCount: stampedCatalog.ownerCount ?? null,
      ownerHistoryLen: Array.isArray(stampedCatalog.ownerHistory)
        ? stampedCatalog.ownerHistory.length
        : 0,
    });
  } catch (err) {
    logger.error({ err, vin, refreshSource }, "VIN catalog refresh failed");
    const reason = err instanceof Error ? err.message : "";
    const label = refreshSource === "getcarapi" ? "GetCarAPI" : "provider";
    res.status(502).json({
      error: reason ? `Failed to refresh from ${label}: ${reason}` : `Failed to refresh from ${label}`,
    });
  }
});

router.delete("/admin/vin-catalog/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [entry] = await db
    .select({ id: vinCatalogTable.id, vin: vinCatalogTable.vin, data: vinCatalogTable.data })
    .from(vinCatalogTable)
    .where(eq(vinCatalogTable.id, id))
    .limit(1);
  if (!entry) { res.status(404).json({ error: "VIN not found in catalog" }); return; }

  const wiped = await wipeRemovedCatalogVin(entry.vin, entry.data);
  await db.delete(vinCatalogTable).where(eq(vinCatalogTable.id, id));
  await logAdminAction(req.userId!, "admin_delete_catalog_vin", entry.vin, {
    catalogId: id,
    ...wiped,
  });
  res.status(204).send();
});

/** Purge client access + sitemap for VINs already removed from catalog (repair orphaned lookups). */
router.post("/admin/vin-catalog/purge-access", requireAdmin, async (req, res) => {
  const { vins } = req.body as { vins?: string[] };
  if (!Array.isArray(vins) || vins.length === 0) {
    res.status(400).json({ error: "Provide vins: string[]" });
    return;
  }

  const results: Array<{ vin: string } & Awaited<ReturnType<typeof wipeRemovedCatalogVin>>> = [];
  for (const raw of vins) {
    const vin = String(raw ?? "").trim().toUpperCase();
    if (!vin) continue;
    const wiped = await wipeRemovedCatalogVin(vin);
    results.push({ vin, ...wiped });
    await logAdminAction(req.userId!, "admin_purge_catalog_vin_access", vin, wiped);
  }

  res.json({ ok: true, results });
});

router.post("/admin/vin-catalog/bulk-delete", requireAdmin, async (req, res) => {
  const { ids, provider, all, confirmPhrase } = req.body as { ids?: number[]; provider?: string; all?: boolean; confirmPhrase?: string };

  if (all === true) {
    if (!requireConfirmPhrase({ confirmPhrase }, ADMIN_CONFIRM_PHRASES.DELETE_ALL_CATALOG, res)) return;
    const where = provider ? eq(vinCatalogTable.providerName, provider) : undefined;
    const rows = await db
      .select({ vin: vinCatalogTable.vin, data: vinCatalogTable.data })
      .from(vinCatalogTable)
      .where(where);
    const wiped = await wipeRemovedCatalogVins(rows);
    await db.delete(vinCatalogTable).where(where);
    await logAdminAction(req.userId!, "admin_bulk_delete_catalog", "all", {
      provider: provider ?? null,
      catalogRows: rows.length,
      ...wiped,
    });
    res.json({ ok: true });
    return;
  }

  if (ids?.length) {
    const rows = await db
      .select({ vin: vinCatalogTable.vin, data: vinCatalogTable.data })
      .from(vinCatalogTable)
      .where(inArray(vinCatalogTable.id, ids));
    const wiped = await wipeRemovedCatalogVins(rows);
    await db.delete(vinCatalogTable).where(inArray(vinCatalogTable.id, ids));
    await logAdminAction(req.userId!, "admin_bulk_delete_catalog", "selected", {
      ids,
      catalogRows: rows.length,
      ...wiped,
    });
    res.json({ ok: true });
    return;
  }

  res.status(400).json({ error: "Specify ids, provider + all, or all:true" });
});

// POST /admin/vin/bulk-delete — bulk-delete lookup entries by category
router.post("/admin/vin/bulk-delete", requireAdmin, async (req, res) => {
  const { status, fromCache, provider, all, ids } = req.body as {
    status?: string; fromCache?: boolean; provider?: string; all?: boolean; ids?: number[];
  };

  if (ids?.length) {
    await db.delete(vinLookupsTable).where(inArray(vinLookupsTable.id, ids));
    res.json({ ok: true });
    return;
  }

  if (!all && status === undefined && fromCache === undefined && !provider) {
    res.status(400).json({ error: "Specify a filter (status, fromCache, provider) or all:true" });
    return;
  }

  const conditions = [];
  if (status) conditions.push(eq(vinLookupsTable.status, status));
  if (fromCache !== undefined) conditions.push(eq(vinLookupsTable.fromCache, fromCache));
  if (provider) conditions.push(eq(vinLookupsTable.providerName, provider));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  await db.delete(vinLookupsTable).where(where);
  res.json({ ok: true });
});

// ── LOGS ─────────────────────────────────────────────────────────────────────

router.get("/admin/logs", requireAdmin, async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "25"), 10)));
  const offset = (page - 1) * limit;
  const level = String(req.query.level ?? "");
  const message = String(req.query.message ?? "").trim();
  const from = req.query.from ? String(req.query.from) : undefined;
  const to = req.query.to ? String(req.query.to) : undefined;

  const conditions = [];
  if (level && ["error", "warn", "info"].includes(level)) {
    conditions.push(eq(systemLogsTable.level, level));
  }
  if (message) {
    conditions.push(ilike(systemLogsTable.message, `%${message}%`));
  }
  if (from) {
    const fromDate = new Date(from);
    if (!isNaN(fromDate.getTime())) conditions.push(gte(systemLogsTable.createdAt, fromDate));
  }
  if (to) {
    const toDate = new Date(to);
    if (!isNaN(toDate.getTime())) {
      toDate.setHours(23, 59, 59, 999);
      conditions.push(lte(systemLogsTable.createdAt, toDate));
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, [{ total }]] = await Promise.all([
    db.select().from(systemLogsTable).where(where).orderBy(desc(systemLogsTable.createdAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(systemLogsTable).where(where),
  ]);

  res.json({ items, total, page, limit });
});

// ── Security — dedicated settings GET/PUT ─────────────────────────────────────

router.get("/admin/security/settings", requireAdmin, async (req, res) => {
  const [row] = await db
    .select({
      maxFailedLogins: systemSettingsTable.maxFailedLogins,
      lockoutMinutes: systemSettingsTable.lockoutMinutes,
      adminMaxFailedLogins: systemSettingsTable.adminMaxFailedLogins,
      adminLockoutMinutes: systemSettingsTable.adminLockoutMinutes,
      registerMaxPerHour: systemSettingsTable.registerMaxPerHour,
      vinRatePerMinute: systemSettingsTable.vinRatePerMinute,
      recaptchaMinScore: systemSettingsTable.recaptchaMinScore,
    })
    .from(systemSettingsTable)
    .orderBy(desc(systemSettingsTable.id))
    .limit(1);
  res.json(row ? {
    ...row,
    recaptchaMinScore: Number(row.recaptchaMinScore) || 0.5,
  } : {
    maxFailedLogins: 5,
    lockoutMinutes: 30,
    adminMaxFailedLogins: 3,
    adminLockoutMinutes: 60,
    registerMaxPerHour: 5,
    vinRatePerMinute: 20,
    recaptchaMinScore: 0.5,
  });
});

router.put("/admin/security/settings", requireAdmin, async (req, res) => {
  const body = req.body as {
    maxFailedLogins?: number;
    lockoutMinutes?: number;
    adminMaxFailedLogins?: number;
    adminLockoutMinutes?: number;
    registerMaxPerHour?: number;
    vinRatePerMinute?: number;
    recaptchaMinScore?: number;
  };

  const patch: Record<string, unknown> = {};
  if (body.maxFailedLogins !== undefined) patch.maxFailedLogins = Number(body.maxFailedLogins);
  if (body.lockoutMinutes !== undefined) patch.lockoutMinutes = Number(body.lockoutMinutes);
  if (body.adminMaxFailedLogins !== undefined) patch.adminMaxFailedLogins = Number(body.adminMaxFailedLogins);
  if (body.adminLockoutMinutes !== undefined) patch.adminLockoutMinutes = Number(body.adminLockoutMinutes);
  if (body.registerMaxPerHour !== undefined) patch.registerMaxPerHour = Number(body.registerMaxPerHour);
  if (body.vinRatePerMinute !== undefined) patch.vinRatePerMinute = Number(body.vinRatePerMinute);
  if (body.recaptchaMinScore !== undefined) patch.recaptchaMinScore = Number(body.recaptchaMinScore);

  const boundsError = validateBoundedSettingsPatch(patch);
  if (boundsError) {
    res.status(400).json({ error: boundsError });
    return;
  }

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [existing] = await db.select({ id: systemSettingsTable.id }).from(systemSettingsTable).orderBy(desc(systemSettingsTable.id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Settings not initialised" });
    return;
  }
  await db.update(systemSettingsTable).set(patch).where(eq(systemSettingsTable.id, existing.id));
  invalidateSettingsCache();
  invalidateFreeDecoderSettingsCache();
  invalidatePublicSettingsCache();
  req.log.info({ msg: "admin_security_settings_update", patch, adminId: req.userId });
  res.json({ ok: true });
});

// ── Security — lockout monitoring ────────────────────────────────────────────

router.get("/admin/security/lockouts", requireAdmin, async (req, res) => {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [settings] = await db
    .select({
      maxFailedLogins: systemSettingsTable.maxFailedLogins,
      lockoutMinutes: systemSettingsTable.lockoutMinutes,
      adminMaxFailedLogins: systemSettingsTable.adminMaxFailedLogins,
      adminLockoutMinutes: systemSettingsTable.adminLockoutMinutes,
    })
    .from(systemSettingsTable)
    .orderBy(desc(systemSettingsTable.id))
    .limit(1);

  const userMax = settings?.maxFailedLogins ?? 5;
  const adminMax = settings?.adminMaxFailedLogins ?? 3;
  const userLockoutMs = (settings?.lockoutMinutes ?? 30) * 60 * 1000;
  const adminLockoutMs = (settings?.adminLockoutMinutes ?? 30) * 60 * 1000;

  // Attempts in last 24h grouped by (email, ip, context)
  const attempts = await db
    .select({
      email: loginAttemptsTable.email,
      ip: loginAttemptsTable.ip,
      context: loginAttemptsTable.context,
      failCount: count(),
      lastAttempt: sql<string>`MAX(${loginAttemptsTable.attemptedAt})::text`,
    })
    .from(loginAttemptsTable)
    .where(gte(loginAttemptsTable.attemptedAt, since24h))
    .groupBy(loginAttemptsTable.email, loginAttemptsTable.ip, loginAttemptsTable.context)
    .orderBy(desc(sql`MAX(${loginAttemptsTable.attemptedAt})`));

  const now = Date.now();
  const lockedOut = attempts
    .filter((r) => {
      const lockoutMs = r.context === "admin" ? adminLockoutMs : userLockoutMs;
      const maxForCtx = r.context === "admin" ? adminMax : userMax;
      const last = new Date(r.lastAttempt).getTime();
      return Number(r.failCount) >= maxForCtx && now - last < lockoutMs;
    })
    .map((r) => {
      const lockoutMs = r.context === "admin" ? adminLockoutMs : userLockoutMs;
      const last = new Date(r.lastAttempt).getTime();
      const expiresAt = new Date(last + lockoutMs).toISOString();
      return { ...r, failCount: Number(r.failCount), expiresAt };
    });

  const topIps = await db
    .select({ ip: loginAttemptsTable.ip, failCount: count() })
    .from(loginAttemptsTable)
    .where(gte(loginAttemptsTable.attemptedAt, since24h))
    .groupBy(loginAttemptsTable.ip)
    .orderBy(desc(count()))
    .limit(10);

  const [{ total24h }] = await db
    .select({ total24h: count() })
    .from(loginAttemptsTable)
    .where(gte(loginAttemptsTable.attemptedAt, since24h));

  res.json({
    lockedOut,
    topIps: topIps.map((r) => ({ ...r, failCount: Number(r.failCount) })),
    total24h: Number(total24h),
  });
});

router.delete("/admin/security/lockouts", requireAdmin, async (req, res) => {
  const { confirmPhrase } = (req.body ?? {}) as { confirmPhrase?: string };
  if (!requireConfirmPhrase({ confirmPhrase }, ADMIN_CONFIRM_PHRASES.CLEAR_ALL_LOCKOUTS, res)) return;
  await db.delete(loginAttemptsTable);
  await logAdminAction(req.userId!, "admin_clear_lockouts", "all");
  req.log.info({ msg: "admin_clear_lockouts", adminId: req.userId });
  res.json({ ok: true });
});

// ── Security — IP & country access blocks ────────────────────────────────────

router.get("/admin/security/blocks", requireAdmin, async (req, res) => {
  try {
    // Keep Blocked IPs in sync with currently banned accounts (idempotent upsert).
    await syncAccessBlocksForBannedUsers(req.userId ?? "system");
  } catch (err) {
    logger.warn({ err }, "sync_banned_access_blocks_failed");
  }

  const items = await listAccessBlocks();
  const userIds = [...new Set(items.map((b) => b.userId).filter((id): id is string => Boolean(id)))];
  const emailByUserId = new Map<string, string>();
  if (userIds.length > 0) {
    const users = await db
      .select({ id: usersTable.id, email: usersTable.email })
      .from(usersTable)
      .where(inArray(usersTable.id, userIds));
    for (const u of users) emailByUserId.set(u.id, u.email);
  }

  const mapped = items.map((b) => ({
    ...b,
    userEmail: b.userId ? (emailByUserId.get(b.userId) ?? null) : null,
    createdAt: b.createdAt.toISOString(),
    expiresAt: b.expiresAt?.toISOString() ?? null,
  }));
  res.json({
    items: mapped,
    ips: mapped.filter((b) => b.blockType === "ip"),
    countries: mapped.filter((b) => b.blockType === "country"),
    devices: mapped.filter((b) => b.blockType === "device"),
  });
});

router.post("/admin/security/blocks/ip", requireAdmin, async (req, res) => {
  const { ip, reason } = req.body as { ip?: string; reason?: string };
  if (!ip?.trim()) {
    res.status(400).json({ error: "IP address is required" });
    return;
  }
  const result = await addIpBlock({
    ip,
    reason: reason ?? null,
    source: "manual",
    createdBy: req.userId!,
  });
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  await logAdminAction(req.userId!, "admin_block_ip", ip.trim(), { reason });
  res.json({ ok: true });
});

router.delete("/admin/security/blocks/ip/:ip", requireAdmin, async (req, res) => {
  const ip = decodeURIComponent(String(req.params.ip ?? ""));
  const removed = await removeAccessBlock("ip", ip);
  if (!removed) {
    res.status(404).json({ error: "IP block not found" });
    return;
  }
  await logAdminAction(req.userId!, "admin_unblock_ip", ip);
  res.json({ ok: true });
});

router.post("/admin/security/blocks/country", requireAdmin, async (req, res) => {
  const { countryCode, reason } = req.body as { countryCode?: string; reason?: string };
  if (!countryCode?.trim()) {
    res.status(400).json({ error: "Country code is required (e.g. RU, CN)" });
    return;
  }
  const result = await addCountryBlock({
    countryCode,
    reason: reason ?? null,
    createdBy: req.userId!,
  });
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  await logAdminAction(req.userId!, "admin_block_country", countryCode.trim().toUpperCase(), { reason });
  res.json({ ok: true });
});

router.delete("/admin/security/blocks/country/:code", requireAdmin, async (req, res) => {
  const code = decodeURIComponent(String(req.params.code ?? ""));
  const removed = await removeAccessBlock("country", code);
  if (!removed) {
    res.status(404).json({ error: "Country block not found" });
    return;
  }
  await logAdminAction(req.userId!, "admin_unblock_country", code.toUpperCase());
  res.json({ ok: true });
});

router.delete("/admin/security/blocks/device/:hash", requireAdmin, async (req, res) => {
  const hash = decodeURIComponent(String(req.params.hash ?? ""));
  const removed = await removeAccessBlock("device", hash);
  if (!removed) {
    res.status(404).json({ error: "Device block not found" });
    return;
  }
  await logAdminAction(req.userId!, "admin_unblock_device", hash.slice(0, 16));
  res.json({ ok: true });
});

// ── Cleanup — manual purge triggers ──────────────────────────────────────────

router.post("/admin/logs/purge", requireAdmin, async (req, res) => {
  const { days } = req.body as { days?: number };
  if (!days || days < 1) {
    res.status(400).json({ error: "days must be ≥ 1" });
    return;
  }
  const cutoff = new Date(Date.now() - days * 86400 * 1000);
  let deleted = 0;
  for (;;) {
    const rows = await db
      .select({ id: systemLogsTable.id })
      .from(systemLogsTable)
      .where(lt(systemLogsTable.createdAt, cutoff))
      .limit(500);
    if (rows.length === 0) break;
    const ids = rows.map((r) => r.id);
    await db.delete(systemLogsTable).where(inArray(systemLogsTable.id, ids));
    deleted += rows.length;
    if (rows.length < 500) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  req.log.info({ msg: "admin_purge_logs", days, deleted, adminId: req.userId });
  res.json({ deleted });
});

router.post("/admin/transactions/purge-failed", requireAdmin, async (req, res) => {
  const { days } = req.body as { days?: number };
  if (!days || days < 1) {
    res.status(400).json({ error: "days must be ≥ 1" });
    return;
  }
  const cutoff = new Date(Date.now() - days * 86400 * 1000);
  let deleted = 0;
  for (;;) {
    const rows = await db
      .select({ id: paymentsTable.id })
      .from(paymentsTable)
      .where(and(eq(paymentsTable.status, "failed"), lt(paymentsTable.createdAt, cutoff)))
      .limit(500);
    if (rows.length === 0) break;
    const ids = rows.map((r) => r.id);
    await db.delete(paymentsTable).where(inArray(paymentsTable.id, ids));
    deleted += rows.length;
    if (rows.length < 500) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  req.log.info({ msg: "admin_purge_failed_txns", days, deleted, adminId: req.userId });
  res.json({ deleted });
});

// ── Pending VIN checks (manual fulfillment before catalog) ───────────────────

router.get("/admin/pending-vin-checks", requireAdmin, async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10)));
  const items = await listPendingVinChecksForAdmin(page, limit);
  const [{ total }] = await db.select({ total: count() })
    .from(pendingVinChecksTable)
    .where(eq(pendingVinChecksTable.status, "open"));
  res.json({ items, total, page, limit });
});

/** Lightweight count for admin sidebar badge — avoid full /admin/stats. Must stay before /:id. */
router.get("/admin/pending-vin-checks/count", requireAdmin, async (_req, res) => {
  const [{ open }] = await db.select({ open: count() })
    .from(pendingVinChecksTable)
    .where(eq(pendingVinChecksTable.status, "open"));
  res.json({ open: open ?? 0 });
});

router.get("/admin/pending-vin-checks/export.json", requireAdmin, async (_req, res) => {
  const payload = await buildAllPendingVinExportPayload();
  const date = new Date().toISOString().split("T")[0];
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="pending-vin-checks-${date}.json"`);
  res.json(payload);
});

router.post("/admin/pending-vin-checks/import-json", requireAdmin, upload.single("file"), async (req, res) => {
  let parsed: unknown;
  try {
    if (req.file) {
      const raw = await readFile(req.file.path, "utf8");
      parsed = JSON.parse(raw);
      unlink(req.file.path, () => {});
    } else if (req.body && typeof req.body === "object") {
      parsed = req.body;
    } else {
      res.status(400).json({ error: "JSON body or multipart field 'file' is required" });
      return;
    }
  } catch (err) {
    if (req.file) unlink(req.file.path, () => {});
    res.status(400).json({ error: "Invalid JSON: " + String((err as Error).message ?? err) });
    return;
  }

  try {
    const result = await importPendingVinDraftsFromJson(parsed);
    await logAdminAction(req.userId!, "admin_import_pending_vin_json_bulk", "pending-vin-checks", result);
    res.json(result);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "INVALID_PAYLOAD") {
      res.status(400).json({ error: (err as Error).message });
      return;
    }
    throw err;
  }
});

router.get("/admin/pending-vin-checks/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const row = await getPendingVinCheckById(id);
  if (!row || row.status !== "open") {
    res.status(404).json({ error: "Pending VIN check not found" });
    return;
  }
  res.json(row);
});

router.patch("/admin/pending-vin-checks/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const body = req.body as Record<string, unknown>;
  try {
    await savePendingVinCheckDraft({ pendingId: id, draftData: body });
    // Return the same enriched shape as GET (includes `requests`) so the client
    // cache stays consistent and the detail page can re-render without crashing.
    const detail = await getPendingVinCheckById(id);
    res.json(detail);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "NOT_FOUND") {
      res.status(404).json({ error: "Pending VIN check not found" });
      return;
    }
    throw err;
  }
});

router.post("/admin/pending-vin-checks/:id/publish", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const body = req.body as Record<string, unknown>;
  try {
    const result = await publishPendingVinCheck({
      pendingId: id,
      adminId: req.userId!,
      draftData: body,
    });
    req.log.info({ msg: "admin_publish_pending_vin", pendingId: id, vin: result.vin, adminId: req.userId });
    res.json({ ok: true, vin: result.vin, lookupIds: result.lookupIds });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "NOT_FOUND") {
      res.status(404).json({ error: "Pending VIN check not found or already published" });
      return;
    }
    logger.error({ err, pendingId: id }, "Publish pending VIN failed");
    res.status(500).json({ error: "Failed to publish pending VIN check" });
  }
});

router.get("/admin/pending-vin-checks/:id/export.json", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const row = await getPendingVinCheckById(id);
  if (!row || row.status !== "open") {
    res.status(404).json({ error: "Pending VIN check not found" });
    return;
  }
  const payload = buildPendingVinExportPayload(row);
  const date = new Date().toISOString().split("T")[0];
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="pending-vin-${row.vin}-${date}.json"`);
  res.json(payload);
});

router.post("/admin/pending-vin-checks/:id/import-json", requireAdmin, upload.single("file"), async (req, res) => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  let parsed: unknown;
  try {
    if (req.file) {
      const raw = await readFile(req.file.path, "utf8");
      parsed = JSON.parse(raw);
      unlink(req.file.path, () => {});
    } else if (req.body && typeof req.body === "object") {
      parsed = req.body;
    } else {
      res.status(400).json({ error: "JSON body or multipart field 'file' is required" });
      return;
    }
  } catch (err) {
    if (req.file) unlink(req.file.path, () => {});
    res.status(400).json({ error: "Invalid JSON: " + String((err as Error).message ?? err) });
    return;
  }

  try {
    const updated = await importPendingVinDraftFromJson({ pendingId: id, payload: parsed });
    await logAdminAction(req.userId!, "admin_import_pending_vin_json", String(id), { vin: updated.vin });
    res.json(updated);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "NOT_FOUND") {
      res.status(404).json({ error: "Pending VIN check not found" });
      return;
    }
    if (code === "INVALID_PAYLOAD") {
      res.status(400).json({ error: (err as Error).message });
      return;
    }
    throw err;
  }
});

router.delete("/admin/pending-vin-checks/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  try {
    const result = await removePendingVinCheck({ pendingId: id, adminId: req.userId! });
    await logAdminAction(req.userId!, "admin_remove_pending_vin", String(id), {
      vin: result.vin,
      removedLookupIds: result.removedLookupIds,
      paymentsRevoked: result.paymentsRevoked,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "NOT_FOUND") {
      res.status(404).json({ error: "Pending VIN check not found" });
      return;
    }
    logger.error({ err, pendingId: id }, "Remove pending VIN failed");
    res.status(500).json({ error: "Failed to remove pending VIN check" });
  }
});

/** Credit each requester +1, remove pending, email "no info / free credit" (Admin → Emails → noinfo). */
router.post("/admin/pending-vin-checks/:id/credit-and-notify", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  try {
    const result = await creditNoInfoAndRemovePendingVinCheck({ pendingId: id, adminId: req.userId! });
    await logAdminAction(req.userId!, "admin_credit_noinfo_pending_vin", String(id), {
      vin: result.vin,
      removedLookupIds: result.removedLookupIds,
      paymentsRevoked: result.paymentsRevoked,
      creditedUsers: result.creditedUsers,
      emailsSent: result.emailsSent,
      recipients: result.recipients,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "NOT_FOUND") {
      res.status(404).json({ error: "Pending VIN check not found" });
      return;
    }
    logger.error({ err, pendingId: id }, "Credit & notify pending VIN failed");
    res.status(500).json({ error: "Failed to credit users and remove pending VIN check" });
  }
});

/**
 * Remove pending + mark payments refunded (deducts sales).
 * Does not refund via PayPal/POK — admin refunds manually.
 */
router.post("/admin/pending-vin-checks/:id/remove-and-refund", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  try {
    const result = await removePendingVinCheckAsRefunded({ pendingId: id, adminId: req.userId! });
    await logAdminAction(req.userId!, "admin_remove_pending_vin_refunded", String(id), {
      vin: result.vin,
      removedLookupIds: result.removedLookupIds,
      paymentsRefunded: result.paymentsRefunded,
      emailsSent: result.emailsSent,
      recipients: result.recipients,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "NOT_FOUND") {
      res.status(404).json({ error: "Pending VIN check not found" });
      return;
    }
    logger.error({ err, pendingId: id }, "Remove pending + refunded failed");
    res.status(500).json({ error: "Failed to remove pending VIN check as refunded" });
  }
});

// ── PLUGINS ────────────────────────────────────────────────────────────────────

router.get("/admin/plugins", requireAdmin, async (_req, res) => {
  const [row] = await db
    .select({ pluginSettings: systemSettingsTable.pluginSettings })
    .from(systemSettingsTable)
    .orderBy(desc(systemSettingsTable.id))
    .limit(1);
  const settings = normalizePluginSettings(row?.pluginSettings ?? DEFAULT_PLUGIN_SETTINGS);
  res.json(settings);
});

router.patch("/admin/plugins", requireAdmin, async (req, res) => {
  const body = req.body as Partial<PluginSettings>;
  const [existing] = await db
    .select({ id: systemSettingsTable.id, pluginSettings: systemSettingsTable.pluginSettings })
    .from(systemSettingsTable)
    .orderBy(desc(systemSettingsTable.id))
    .limit(1);

  const current = normalizePluginSettings(existing?.pluginSettings ?? DEFAULT_PLUGIN_SETTINGS);
  const merged = normalizePluginSettings({
    geoLanguageRedirect: {
      ...current.geoLanguageRedirect,
      ...(body.geoLanguageRedirect ?? {}),
    },
  });

  const patch = { pluginSettings: merged, updatedAt: new Date() };

  if (existing) {
    await db.update(systemSettingsTable).set(patch).where(eq(systemSettingsTable.id, existing.id));
  } else {
    await db.insert(systemSettingsTable).values({
      ...patch,
      maintenanceMode: false,
      abuseDetectionEnabled: true,
    });
  }

  invalidatePluginSettingsCache();
  await logAdminAction(req.userId!, "admin_update_plugins", "plugins", {
    geoEnabled: merged.geoLanguageRedirect.enabled,
    ruleCount: merged.geoLanguageRedirect.rules.length,
  });
  res.json(merged);
});

// ── Full site backup (migration export / restore) ───────────────────────────

router.get("/admin/backup/export", requireAdmin, backupExportLimiter, async (req, res) => {
  try {
    const { counts } = await streamBackupExport(res);
    await logAdminAction(req.userId!, "admin_backup_export", "system", { counts });
  } catch (err) {
    const message = String((err as Error)?.message ?? err);
    if (message.includes("aborted by client")) {
      logger.info({ err }, "admin_backup_export_aborted");
      return;
    }
    logger.error({ err }, "admin_backup_export_failed");
    if (!res.headersSent) {
      res.status(500).json({ error: "Backup export failed" });
    } else {
      res.destroy(err as Error);
    }
  }
});

router.post(
  "/admin/backup/import",
  requireAdmin,
  backupImportLimiter,
  backupUpload.single("file"),
  async (req, res) => {
    const file = req.file;
    try {
      if (!requireConfirmPhrase(req.body ?? {}, ADMIN_CONFIRM_PHRASES.RESTORE_BACKUP, res)) {
        return;
      }
      if (!file?.path) {
        res.status(400).json({ error: "Backup file is required (field: file)" });
        return;
      }

      const payload = await loadBackupFromUploadPath(file.path, file.originalname);
      const { counts } = await restoreBackupPayload(payload);

      invalidateSettingsCache();
      invalidatePublicSettingsCache();
      invalidatePricingCache();
      invalidateFreeDecoderSettingsCache();
      invalidateGetCarApiSettingsCache();
      invalidatePluginSettingsCache();

      await logAdminAction(req.userId!, "admin_backup_restore", "system", {
        counts,
        exportedAt: payload.exportedAt,
      });

      res.json({
        ok: true,
        message: "Backup restored successfully. All previous data was replaced.",
        exportedAt: payload.exportedAt,
        counts,
      });
    } catch (err) {
      const message = String((err as Error)?.message ?? err);
      logger.error({ err }, "admin_backup_restore_failed");
      if (
        message.includes("Backup") ||
        message.includes("Invalid") ||
        message.includes("Missing") ||
        message.includes("Unsupported") ||
        message.includes("Another backup") ||
        message.includes("valid JSON") ||
        message.includes("too large")
      ) {
        res.status(400).json({ error: message });
        return;
      }
      res.status(500).json({ error: "Backup restore failed. Database was rolled back if the wipe had started." });
    } finally {
      if (file?.path) unlink(file.path, () => undefined);
    }
  },
);

export default router;
