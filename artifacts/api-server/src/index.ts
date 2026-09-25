import app from "./app";
import { logger } from "./lib/logger";
import { shouldEnforceClientGuard } from "./lib/clientGuard.js";
import { assertProductionConfig, exitOnProductionConfigFailure } from "./lib/productionConfig.js";
import { db, providersTable, systemSettingsTable } from "@workspace/db";
import { count, desc, eq, like } from "drizzle-orm";
import { scheduleCleanupJobs } from "./lib/cleanupJobs.js";
import { scheduleDbKeepalive } from "./lib/dbKeepalive.js";
import { refreshVinSitemapShards } from "./lib/sitemapMaintenance.js";
import { invalidatePublicSettingsCache } from "./routes/payments.js";
import { patchSystemSettingsSchema } from "./lib/schemaPatches.js";
import { getEffectiveSystemSettings, consolidateSystemSettingsRows } from "./lib/systemSettings.js";
import { setGetCarApiEnabledCache } from "./lib/getcarApiSettingsCache.js";

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception");
  if (process.env.NODE_ENV === "production") {
    setTimeout(() => process.exit(1), 250);
  }
});

process.on("unhandledRejection", (reason) => {
  // Log only — do not exit. A failed background job (email, fulfillment side-effect)
  // must not take down the whole site. Hard failures still exit via uncaughtException.
  logger.error({ reason }, "Unhandled promise rejection");
});

const rawPort = process.env["PORT"] ?? "8080";
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function seedCarstatProvider(): Promise<void> {
  const apiKey = process.env["CARSTAT_API_KEY"];
  if (!apiKey) return;

  const [{ total }] = await db.select({ total: count() }).from(providersTable);
  if (Number(total) > 0) return;

  await db.insert(providersTable).values({
    name: "Carstat",
    countryCode: "US",
    baseUrl: "https://carstat.dev",
    apiKey,
    rateLimit: 100,
    isActive: true,
  });
  logger.info("Seeded Carstat provider from CARSTAT_API_KEY env var");
}

async function migrateCarstatBaseUrls(): Promise<void> {
  const stale = await db.select().from(providersTable).where(like(providersTable.baseUrl, "%api.carstat.dev%"));
  if (stale.length === 0) return;

  for (const provider of stale) {
    await db.update(providersTable).set({
      baseUrl: (provider.baseUrl ?? "").replace("://api.carstat.dev", "://carstat.dev"),
      updatedAt: new Date(),
    }).where(eq(providersTable.id, provider.id));
  }
  logger.info({ count: stale.length }, "Migrated Carstat provider base URLs to https://carstat.dev");
}

async function syncPaypalFromEnv(): Promise<void> {
  const envClientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const envClientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!envClientId || !envClientSecret) return;

  const [settings] = await db.select().from(systemSettingsTable).orderBy(desc(systemSettingsTable.id)).limit(1);
  if (!settings) return;

  const effective = await getEffectiveSystemSettings();
  const hasClientId = !!effective?.paypalClientId?.trim();
  const hasSecret = !!effective?.paypalClientSecret?.trim();
  if (hasClientId && hasSecret) return;

  await db.update(systemSettingsTable).set({
    paypalClientId: hasClientId ? settings.paypalClientId : envClientId,
    paypalClientSecret: hasSecret ? settings.paypalClientSecret : envClientSecret,
    updatedAt: new Date(),
  }).where(eq(systemSettingsTable.id, settings.id));

  invalidatePublicSettingsCache();
  logger.info("Synced PayPal credentials from PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET env vars");
}

const dbUrl = process.env.DATABASE_URL ?? "";
const dbHostIsPrivate =
  /@(?:localhost|127\.0\.0\.1|postgres\.railway\.internal)(?::|\/)/i.test(dbUrl)
  || dbUrl.includes(".railway.internal");
const dbHasSslParam = /(?:^|[?&])ssl(?:mode)?=/i.test(dbUrl) || dbUrl.includes("sslmode");
if (
  process.env.NODE_ENV === "production"
  && !dbHasSslParam
  && !dbHostIsPrivate
  && process.env.DATABASE_SSL_SKIP_CHECK !== "true"
) {
  logger.info(
    "DATABASE_URL has no ?sslmode=require — recommended for encrypted connections when the database is reached over the public internet",
  );
}

exitOnProductionConfigFailure();

const server = app.listen(port, "0.0.0.0", async () => {
  logger.info({ port }, "Server listening");
  if (shouldEnforceClientGuard()) {
    logger.info("API client guard is active");
  }

  await patchSystemSettingsSchema().catch((e) =>
    logger.warn({ err: e }, "Failed to apply system_settings schema patches"),
  );
  await consolidateSystemSettingsRows().catch((e) =>
    logger.warn({ err: e }, "Failed to consolidate system_settings rows"),
  );
  invalidatePublicSettingsCache();
  void getEffectiveSystemSettings()
    .then((s) => {
      if (typeof s?.getcarApiEnabled === "boolean") {
        setGetCarApiEnabledCache(s.getcarApiEnabled);
      }
    })
    .catch((e) => logger.warn({ err: e }, "Failed to warm GetCarAPI enabled cache"));
  void migrateCarstatBaseUrls().catch((e) =>
    logger.warn({ err: e }, "Failed to migrate Carstat provider base URLs"),
  );
  void syncPaypalFromEnv().catch((e) =>
    logger.warn({ err: e }, "Failed to sync PayPal credentials from env"),
  );
  void seedCarstatProvider().catch((e) =>
    logger.warn({ err: e }, "Failed to seed Carstat provider"),
  );
  scheduleCleanupJobs();
  scheduleDbKeepalive();
  // VIN shards are written at runtime — Railway build cannot reach postgres.railway.internal.
  void refreshVinSitemapShards()
    .then((result) => {
      if (!result) {
        logger.warn("VIN sitemap refresh skipped (no public sitemap dir)");
        return;
      }
      logger.info(
        { vins: result.vinCount, shards: result.shardCount, dir: result.publicDir },
        "VIN sitemap shards refreshed",
      );
    })
    .catch((e) => logger.warn({ err: e }, "Failed to refresh VIN sitemap shards"));
});

server.on("error", (err) => {
  logger.error({ err }, "Server listen error");
  process.exit(1);
});

// Close idle connections after 30 s; keep-alive above typical LB timeout
server.setTimeout(30_000);
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
