import {
  db,
  vinLookupsTable,
  paymentsTable,
  couponsTable,
} from "@workspace/db";
import { and, eq, sql, desc } from "drizzle-orm";
import { logger } from "./logger.js";
import { withUserVinLookupLock } from "./vinLookupMutex.js";
import {
  fetchFromProvider,
  getCachedVin,
  getCatalogVin,
  upsertVinCatalog,
  enrichVinReportDataForServe,
  probeExternalVinAvailability,
} from "./vinService.js";
import { catalogHasDeliverableReport } from "./vinCatalogImport.js";
import {
  fulfillManualPendingVinLookup,
  isVinEligibleForManualPending,
} from "./pendingVinService.js";
import { GETCARAPI_PROVIDER_NAME, resolveGetCarApiConfig } from "./getcarApi.js";
import { finalizePaymentOnFulfillment } from "./recordedPayments.js";
import { fireVinReadyEmailForUser } from "./vinReadyEmail.js";
import {
  applyFrozenKrwPerUsd,
  getCurrentKrwPerUsd,
  readFrozenKrwPerUsd,
} from "./krwRate.js";
import { createConcurrencyLimiter } from "./batchAsync.js";

export const VIN_FULFILLING_STATUS = "fulfilling" as const;

/** Cap parallel provider jobs on this process — payment still queues as fulfilling immediately. */
const fulfillmentLimiter = createConcurrencyLimiter(
  Math.max(1, Number(process.env.VIN_FULFILLMENT_CONCURRENCY ?? 2) || 2),
);

export type ProviderFulfillmentPayment = {
  amount: number;
  currency: string;
  ref: string | null;
} | null;

export type ProviderFulfillmentInput = {
  userId: string;
  normalizedVin: string;
  resolvedPaymentId: number | null;
  freeCouponPaymentId: number | null;
  freeCouponCode: string | null;
  resolvedPayment: ProviderFulfillmentPayment;
  provider: { id: number; name: string; baseUrl: string; apiKey: string };
  /** Recipient for the report-ready email — must include name and email. */
  user: { name: string | null; email: string } | undefined;
};

async function stampLookupReportData(
  data: Record<string, unknown>,
  existingRate?: number | null,
): Promise<Record<string, unknown>> {
  const currentRate = await getCurrentKrwPerUsd();
  return applyFrozenKrwPerUsd(data, {
    existingRate: existingRate ?? readFrozenKrwPerUsd(data),
    currentRate,
  });
}

async function countFreeCoupon(paymentId: number, couponCode: string): Promise<void> {
  try {
    await db
      .update(paymentsTable)
      .set({ couponCode: null, updatedAt: new Date() })
      .where(and(eq(paymentsTable.id, paymentId), eq(paymentsTable.couponCode, couponCode)));
  } catch (err) {
    logger.warn({ err, couponCode, paymentId }, "Failed to clear free coupon code on payment");
  }
}

function isTransientProviderError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    err.name === "TimeoutError"
    || err.name === "AbortError"
    || msg.includes("timeout")
    || msg.includes("aborted")
    || msg.includes("fetch failed")
    || msg.includes("network")
    || msg.includes("econnreset")
    || msg.includes("socket")
    || msg.includes("could not reach")
  );
}

async function fetchFromProviderWithRetry(
  vin: string,
  baseUrl: string,
  apiKey: string,
  preferredSource?: "getcarapi" | "carstat" | null,
): Promise<Awaited<ReturnType<typeof fetchFromProvider>>> {
  try {
    return await fetchFromProvider(vin, baseUrl, apiKey, { preferredSource });
  } catch (err) {
    if (!isTransientProviderError(err)) throw err;
    logger.warn({ err, vin }, "Transient provider error — retrying report once");
    await new Promise((r) => setTimeout(r, 2000));
    return await fetchFromProvider(vin, baseUrl, apiKey, { preferredSource });
  }
}

async function failFreeCouponPayment(paymentId: number, couponCode: string | null): Promise<void> {
  try {
    await db.update(paymentsTable)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(paymentsTable.id, paymentId));
    if (couponCode) {
      await db.update(couponsTable)
        .set({ uses: sql`GREATEST(uses - 1, 0)` })
        .where(eq(couponsTable.code, couponCode));
    }
  } catch (err) {
    logger.warn({ err, paymentId, couponCode }, "Failed to roll back free coupon payment");
  }
}

export async function findUserFulfillingLookup(userId: string, vin: string) {
  const [row] = await db
    .select()
    .from(vinLookupsTable)
    .where(and(
      eq(vinLookupsTable.userId, userId),
      eq(vinLookupsTable.vin, vin),
      eq(vinLookupsTable.status, VIN_FULFILLING_STATUS),
    ))
    .orderBy(desc(vinLookupsTable.id))
    .limit(1);
  return row ?? null;
}

async function completeLookupFromCatalog(
  lookupId: number,
  input: ProviderFulfillmentInput,
  catalogEntry: NonNullable<Awaited<ReturnType<typeof getCatalogVin>>>,
): Promise<void> {
  const catalogData = catalogEntry.data as Record<string, unknown>;
  const enriched = await enrichVinReportDataForServe(input.normalizedVin, catalogData);
  const stampedData = await stampLookupReportData(enriched ?? catalogData);
  await db.update(vinLookupsTable).set({
    status: "complete",
    data: stampedData,
    providerName: catalogEntry.providerName,
    fromCache: true,
    updatedAt: new Date(),
  }).where(eq(vinLookupsTable.id, lookupId));

  await finalizePaymentOnFulfillment(input.resolvedPaymentId, lookupId);
  if (input.freeCouponPaymentId && input.freeCouponCode) {
    void countFreeCoupon(input.freeCouponPaymentId, input.freeCouponCode);
  }
  void fireVinReadyEmailForUser(lookupId, input.normalizedVin, stampedData, input.user, input.resolvedPayment);
  logger.info({
    msg: "vin_lookup_hit",
    source: "catalog_async",
    vin: input.normalizedVin,
    userId: input.userId,
    lookupId,
  });
}

async function runProviderFulfillmentJob(lookupId: number, input: ProviderFulfillmentInput): Promise<void> {
  const {
    userId,
    normalizedVin,
    resolvedPaymentId,
    freeCouponPaymentId,
    freeCouponCode,
    resolvedPayment,
    provider,
    user,
  } = input;

  try {
      await withUserVinLookupLock(userId, normalizedVin, async () => {
      const [current] = await db
        .select()
        .from(vinLookupsTable)
        .where(eq(vinLookupsTable.id, lookupId))
        .limit(1);
      if (!current || current.status !== VIN_FULFILLING_STATUS) return;

      const catalogEntry = await getCatalogVin(normalizedVin);
      const catalogData = (catalogEntry?.data as Record<string, unknown> | null) ?? null;
      // Local catalog wins — never re-fetch when we already have a deliverable report.
      if (catalogEntry && catalogData && catalogHasDeliverableReport(catalogData)) {
        await completeLookupFromCatalog(lookupId, input, catalogEntry);
        return;
      }

      const cached = await getCachedVin(normalizedVin);
      const cachedData = (cached?.data as Record<string, unknown> | null) ?? null;
      if (cached && cachedData) {
        const enriched = await enrichVinReportDataForServe(normalizedVin, cachedData, {
          primaryUpdatedAt: cached.updatedAt,
        });
        const stampedData = await stampLookupReportData(enriched ?? cachedData);
        await db.update(vinLookupsTable).set({
          status: "complete",
          data: stampedData,
          providerName: cached.providerName,
          fromCache: true,
          updatedAt: new Date(),
        }).where(eq(vinLookupsTable.id, lookupId));
        await finalizePaymentOnFulfillment(resolvedPaymentId, lookupId);
        if (freeCouponPaymentId && freeCouponCode) {
          void countFreeCoupon(freeCouponPaymentId, freeCouponCode);
        }
        void fireVinReadyEmailForUser(lookupId, normalizedVin, stampedData, user, resolvedPayment);
        logger.info({ msg: "vin_lookup_hit", source: "cache_async", vin: normalizedVin, userId, lookupId });
        return;
      }

        if (!provider.apiKey?.trim() && !(await resolveGetCarApiConfig())) {
          throw new Error("Provider API key not configured");
        }

        const probe = await probeExternalVinAvailability(normalizedVin);
        const preferredSource = probe.status === "exists" ? probe.source : null;
        // GetCarAPI-only installs: never call Carstat with an empty key.
        if (!preferredSource && !provider.apiKey?.trim() && (await resolveGetCarApiConfig())) {
          throw Object.assign(new Error("No vehicle history data found for this VIN in our database."), {
            code: "VIN_NO_DATA",
          });
        }
        const data = await fetchFromProviderWithRetry(
          normalizedVin,
          provider.baseUrl,
          provider.apiKey ?? "",
          preferredSource,
        );
        const reportProviderName =
          preferredSource === "getcarapi"
            ? GETCARAPI_PROVIDER_NAME
            : (provider.name || GETCARAPI_PROVIDER_NAME);
        const stampedData = await stampLookupReportData(data as unknown as Record<string, unknown>);
        await db.update(vinLookupsTable).set({
          status: "complete",
          data: stampedData,
          providerName: reportProviderName,
          fromCache: false,
          updatedAt: new Date(),
        }).where(eq(vinLookupsTable.id, lookupId));
        await finalizePaymentOnFulfillment(resolvedPaymentId, lookupId);
        void upsertVinCatalog(normalizedVin, reportProviderName, stampedData);
        if (freeCouponPaymentId && freeCouponCode) {
          void countFreeCoupon(freeCouponPaymentId, freeCouponCode);
        }
        void fireVinReadyEmailForUser(lookupId, normalizedVin, stampedData, user, resolvedPayment);
        logger.info({ msg: "vin_lookup_hit", source: "provider_async", vin: normalizedVin, userId, lookupId });
    });
  } catch (err) {
    logger.error({ err, vin: normalizedVin, userId, lookupId }, "Async VIN provider fulfillment failed");

    let errorCode: string | undefined;
    const errCode = err && typeof err === "object" && "code" in err
      ? String((err as { code?: unknown }).code ?? "")
      : "";
    if (err instanceof Error) {
      if (errCode === "VIN_NO_DATA" || /no vehicle history data found|vin not found/i.test(err.message)) {
        errorCode = "VIN_NO_DATA";
      } else if (
        errCode === "PROVIDER_CREDITS"
        || errCode === "PROVIDER_RATE_LIMIT"
        || /provider subscription|empty lots|balance is insufficient|not available|access denied|credits exhausted|rate limited/i.test(err.message)
      ) {
        errorCode = "VIN_CHECK_UNAVAILABLE";
      }
    }

    if (errorCode === "VIN_NO_DATA" && await isVinEligibleForManualPending(normalizedVin)) {
      try {
        await db.delete(vinLookupsTable).where(eq(vinLookupsTable.id, lookupId));
        const lookup = await fulfillManualPendingVinLookup({
          vin: normalizedVin,
          userId,
          paymentId: resolvedPaymentId,
        });
        await finalizePaymentOnFulfillment(resolvedPaymentId, lookup.id);
        if (freeCouponPaymentId && freeCouponCode) {
          void countFreeCoupon(freeCouponPaymentId, freeCouponCode);
        }
        // Manual pending fallback: no customer email until admin publishes.
        logger.info({ msg: "vin_lookup_hit", source: "manual_pending_async_fallback", vin: normalizedVin, userId, lookupId: lookup.id });
        return;
      } catch (manualErr) {
        logger.error({ manualErr, vin: normalizedVin, lookupId }, "Async manual pending fallback failed");
      }
    }

    await db.update(vinLookupsTable).set({
      status: "error",
      updatedAt: new Date(),
    }).where(and(eq(vinLookupsTable.id, lookupId), eq(vinLookupsTable.status, VIN_FULFILLING_STATUS)));

    if (resolvedPaymentId) {
      try {
        const [pmt] = await db.select({
          amount: paymentsTable.amount,
          kind: paymentsTable.kind,
        })
          .from(paymentsTable)
          .where(eq(paymentsTable.id, resolvedPaymentId))
          .limit(1);
        const isCreditRedemption = (pmt?.kind ?? "") === "credit_redemption";
        const isFreeCoupon = Number(pmt?.amount ?? 0) === 0 && !isCreditRedemption;
        if (isCreditRedemption) {
          const { refundCreditRedemption } = await import("./creditRedemption.js");
          await refundCreditRedemption(resolvedPaymentId, `provider_error:${errorCode ?? "unknown"}`);
        } else if (isFreeCoupon) {
          await failFreeCouponPayment(resolvedPaymentId, freeCouponCode);
        } else {
          logger.error({
            msg: "paid_vin_lookup_delivery_failed",
            paymentId: resolvedPaymentId,
            vin: normalizedVin,
            userId,
            lookupId,
            errorCode,
          });
        }
      } catch (dbErr) {
        logger.error({ dbErr }, "Failed to update payment after async VIN lookup error");
      }
    }
  }
}

/** Queue provider fetch in background; HTTP returns immediately with fulfilling status. */
export async function startProviderFulfillment(
  input: ProviderFulfillmentInput,
): Promise<{ id: number; vin: string; status: string }> {
  const existing = await findUserFulfillingLookup(input.userId, input.normalizedVin);
  if (existing) {
    return { id: existing.id, vin: existing.vin, status: existing.status };
  }

  const [lookup] = await db.insert(vinLookupsTable).values({
    vin: input.normalizedVin,
    userId: input.userId,
    status: VIN_FULFILLING_STATUS,
    data: null,
    providerName: input.provider.name,
    fromCache: false,
    paymentId: input.resolvedPaymentId,
  }).returning();

  logger.info({
    msg: "vin_lookup_queued",
    vin: input.normalizedVin,
    userId: input.userId,
    lookupId: lookup.id,
    paymentRef: input.resolvedPayment?.ref ?? null,
  });

  // Same job as before; limiter only reduces concurrent CPU/provider pressure under spikes.
  void fulfillmentLimiter
    .run(() => runProviderFulfillmentJob(lookup.id, input))
    .catch((err) => {
      logger.error({ err, lookupId: lookup.id, vin: input.normalizedVin }, "Provider fulfillment queue error");
    });
  return { id: lookup.id, vin: lookup.vin, status: lookup.status };
}
