import { Router, type Response } from "express";
import { db, vinLookupsTable, paymentsTable, providersTable, usersTable, couponsTable, pricingTable, DEFAULT_PRICING, normalizePricingAmounts } from "@workspace/db";
import { eq, desc, and, sql, or } from "drizzle-orm";
import { requireAuth, optionalAuth } from "../lib/auth.js";
import {
  getCachedVin,
  getCachedVinForPeek,
  getCachedVinForPreview,
  getCatalogVin,
  getCatalogVinPeekHint,
  probeExternalVinAvailability,
  enrichVinReportDataForServe,
  applyMissingFloodFlagsForServe,
  vinHasReportData,
  resolveVinReportForViewer,
  resolveLockedPreviewPhotoSources,
  sanitizeAuctionPanoramaUrl,
  splitAuctionPanoramaUrls,
} from "../lib/vinService.js";
import { catalogHasDeliverableReport } from "../lib/vinCatalogImport.js";
import { logger } from "../lib/logger.js";
import { decodeVin, decodeCountry, resolveCheckDigitValid, decodeVinDiagnostics, isVehicleTooOldForLookup } from "@workspace/vin-decode";
import { decodeFreeVin } from "../lib/vinDecodeFree.js";
import { decodeVinPeek } from "../lib/vinDecodePreview.js";
import { verifyImageToken, buildImageProxyUrl, transformVinPhotoData, resolveVinPhotoUrlForClient } from "../lib/imageProxy.js";
import { getOrFetchVinImage, getMemoryCachedVinImage, resolveVinImageDiskHit, getVinImageDiskHit, mediaVersionFromUpdatedAt, withVinImageUpstreamSlot } from "../lib/vinImageCache.js";
import { signVinShareToken, verifyVinShareToken } from "../lib/vinShareToken.js";
import { getSettings } from "../lib/settingsCache.js";
import { getFreeDecoderSettings } from "../lib/freeDecoderSettingsCache.js";
import { isTrustedApiRequest } from "../lib/clientGuard.js";
import { rejectVinLookupIfDisabled } from "../lib/vinLookupGate.js";
import { clientIpKey } from "../lib/trustedClient.js";
import { assertAllowedImageUrl } from "../lib/imageHostAllowlist.js";
import { vinPeekLimiter, vinLookupUserLimiter } from "../lib/expensiveEndpointLimiter.js";
import { startProviderFulfillment, VIN_FULFILLING_STATUS } from "../lib/vinFulfillmentService.js";
import { isRecaptchaRelaxedForRequest } from "../lib/allowedOrigins.js";
import rateLimit from "express-rate-limit";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { VIN_SEO_LANGS, extractLockedPreviewSignals, sanitizeLockedPreviewSignalsForClient, type VinSeoLang } from "@workspace/vin-page-seo";
import { buildVinSeoFromCatalogData } from "../lib/vinPageSeo.js";
import {
  applyFrozenKrwPerUsd,
  getCurrentKrwPerUsd,
  readFrozenKrwPerUsd,
} from "../lib/krwRate.js";
import {
  resolveVinFulfillmentMode,
  fulfillManualPendingVinLookup,
  serializeLookupForClient,
  isVinEligibleForManualPending,
} from "../lib/pendingVinService.js";
import { fireVinReadyEmailForUser } from "../lib/vinReadyEmail.js";
import { finalizePaymentOnFulfillment, isPaymentUsableForLookup } from "../lib/recordedPayments.js";
import { refundCreditRedemption } from "../lib/creditRedemption.js";
import { waitForVinLookupPublish } from "../lib/vinLookupNotify.js";

const router = Router();

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

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

async function canAccessVinShare(
  userId: string | undefined,
  vin: string,
  shareToken?: string | null,
): Promise<boolean> {
  if (shareToken) {
    const tokenVin = verifyVinShareToken(shareToken);
    if (tokenVin === vin) return true;
  }
  if (!userId) return false;
  return userOwnsVinReport(userId, vin);
}

/** True when this user purchased, is awaiting delivery, or completed a lookup for the VIN (admin included). */
async function userOwnsVinReport(userId: string, vin: string): Promise<boolean> {
  const [userRow] = await db
    .select({ isAdmin: usersTable.isAdmin })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (userRow?.isAdmin) return true;
  return userHasVinPurchaseOrDelivery(userId, vin);
}

/**
 * Real purchase / credit / coupon / lookup claim for this VIN.
 * Excludes bare admin — used so missing VINs do not get a fake "fulfilling" unlock.
 */
async function userHasVinPurchaseOrDelivery(userId: string, vin: string): Promise<boolean> {
  const [payment] = await db
    .select({ id: paymentsTable.id })
    .from(paymentsTable)
    .where(
      and(
        eq(paymentsTable.userId, userId),
        eq(paymentsTable.vin, vin),
        eq(paymentsTable.status, "completed"),
      ),
    )
    .limit(1);
  if (payment) return true;

  const [lookup] = await db
    .select({ id: vinLookupsTable.id })
    .from(vinLookupsTable)
    .where(
      and(
        eq(vinLookupsTable.userId, userId),
        eq(vinLookupsTable.vin, vin),
        or(
          eq(vinLookupsTable.status, "complete"),
          eq(vinLookupsTable.status, "pending_manual"),
          eq(vinLookupsTable.status, VIN_FULFILLING_STATUS),
        ),
      ),
    )
    .limit(1);
  if (lookup) return true;

  const [pendingFreeCoupon] = await db
    .select({ id: paymentsTable.id })
    .from(paymentsTable)
    .where(
      and(
        eq(paymentsTable.userId, userId),
        eq(paymentsTable.vin, vin),
        eq(paymentsTable.status, "pending"),
        eq(paymentsTable.amount, 0),
        sql`${paymentsTable.couponCode} IS NOT NULL`,
      ),
    )
    .limit(1);
  return !!pendingFreeCoupon;
}

// Public VIN report — rate limit untrusted direct API access only
const publicVinLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait before checking another VIN." },
  keyGenerator: clientIpKey,
  skip: (req) =>
    req.isAdmin === true || isTrustedApiRequest(req),
});

// Free decoder — burst limit for untrusted direct API access only
const freeDecodeBurstLimiter = rateLimit({
  windowMs: 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many decode requests. Please wait a moment." },
  keyGenerator: clientIpKey,
  skip: (req) => isTrustedApiRequest(req),
});

// VIN lookups per minute per IP — DB-configurable, admin exempt
const vinLookupLimiter = rateLimit({
  windowMs: 60_000,
  max: async () => {
    const s = await getSettings();
    const v = s.vinRatePerMinute;
    return v <= 0 ? 0 : v;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait before trying again." },
  skip: async (req) => {
    if (req.isAdmin === true) return true;
    if (isTrustedApiRequest(req)) return true;
    const s = await getSettings();
    return s.vinRatePerMinute <= 0;
  },
});

// ── reCAPTCHA helper (used by decode-free) ────────────────────────────────────
async function checkRecaptchaFreeDecoder(
  token: string | undefined,
  settings: { recaptchaEnabled?: boolean | null; recaptchaSecretKey?: string | null; recaptchaMinScore?: number | null },
): Promise<{ blocked: boolean; reason?: string }> {
  if (!settings.recaptchaEnabled || !settings.recaptchaSecretKey) return { blocked: false };
  if (!token) return { blocked: true, reason: "Security verification required. Please reload the page and try again." };
  const minScore = settings.recaptchaMinScore ?? 0.5;
  const endpoints = [
    "https://www.google.com/recaptcha/api/siteverify",
    "https://www.recaptcha.net/recaptcha/api/siteverify",
  ];
  let networkOnly = true;
  for (const endpoint of endpoints) {
    try {
      const body = new URLSearchParams({ secret: settings.recaptchaSecretKey, response: token });
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        signal: AbortSignal.timeout(5000),
      });
      networkOnly = false;
      const data = await resp.json() as { success: boolean; score?: number };
      if (data.success && (data.score ?? 1) >= minScore) {
        return { blocked: false };
      }
      return { blocked: true, reason: "Security check failed. Please try again." };
    } catch {
      logger.warn({ endpoint }, "reCAPTCHA siteverify unreachable for free decoder — trying fallback");
    }
  }
  if (networkOnly) {
    logger.warn("reCAPTCHA siteverify unreachable for free decoder — allowing through");
    return { blocked: false };
  }
  return { blocked: true, reason: "Security check failed. Please try again." };
}

// ── Image proxy helpers ───────────────────────────────────────────────────────

const MAX_VIN_PHOTOS = 24;
const MAX_VIN_SPIN_PHOTOS = 72;

function transformVinPhotos(data: unknown, mediaVersion?: number): unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const d = data as Record<string, unknown>;
  const transformed = transformVinPhotoData(d, mediaVersion) as Record<string, unknown>;
  if (Array.isArray(transformed.photos)) {
    transformed.photos = (transformed.photos as string[]).slice(0, MAX_VIN_PHOTOS);
  }
  if (Array.isArray(transformed.photosHd)) {
    transformed.photosHd = (transformed.photosHd as string[]).slice(0, MAX_VIN_PHOTOS);
  }
  if (Array.isArray(transformed.photos360Exterior)) {
    transformed.photos360Exterior = (transformed.photos360Exterior as string[]).slice(0, MAX_VIN_SPIN_PHOTOS);
  }
  if (Array.isArray(transformed.photos360Interior)) {
    transformed.photos360Interior = (transformed.photos360Interior as string[]).slice(0, MAX_VIN_SPIN_PHOTOS);
  }
  return transformed;
}

function proxyPhotoUrls(
  photos: string[],
  mediaVersion?: number,
): string[] {
  return photos
    .filter(Boolean)
    .slice(0, MAX_VIN_PHOTOS)
    .map((p) => resolveVinPhotoUrlForClient(p, { mediaVersion }));
}

function proxySpinPhotoUrls(
  photos: string[],
  mediaVersion?: number,
): string[] {
  return photos
    .filter(Boolean)
    .slice(0, MAX_VIN_SPIN_PHOTOS)
    .map((p) => resolveVinPhotoUrlForClient(p, { mediaVersion }));
}

async function findCompleteUserLookup(userId: string, normalizedVin: string) {
  const [row] = await db
    .select()
    .from(vinLookupsTable)
    .where(
      and(
        eq(vinLookupsTable.userId, userId),
        eq(vinLookupsTable.vin, normalizedVin),
        or(
          eq(vinLookupsTable.status, "complete"),
          eq(vinLookupsTable.status, "pending_manual"),
        ),
      ),
    )
    .orderBy(desc(vinLookupsTable.updatedAt))
    .limit(1);
  return row ?? null;
}

/** Prefer a deliverable report over an in-flight fulfilling row for the same VIN. */
async function findUserVinLookupForServe(userId: string, vin: string) {
  const deliverable = await findCompleteUserLookup(userId, vin);
  if (deliverable) return deliverable;

  const [fulfilling] = await db
    .select()
    .from(vinLookupsTable)
    .where(and(
      eq(vinLookupsTable.userId, userId),
      eq(vinLookupsTable.vin, vin),
      eq(vinLookupsTable.status, VIN_FULFILLING_STATUS),
    ))
    .orderBy(desc(vinLookupsTable.updatedAt), desc(vinLookupsTable.id))
    .limit(1);
  return fulfilling ?? null;
}

async function sendExistingLookupResponse(
  res: Response,
  lookup: NonNullable<Awaited<ReturnType<typeof findCompleteUserLookup>>>,
) {
  const rawData = lookup.data as Record<string, unknown> | null;
  const enrichedData = rawData
    ? await enrichVinReportDataForServe(lookup.vin, rawData, { primaryUpdatedAt: lookup.updatedAt })
    : null;
  res.json(serializeLookupForClient({
    ...lookup,
    data: enrichedData ?? lookup.data,
  }));
}

// GET /vin/image?token=... — serves provider images via signed proxy (token required)
// No session auth required — the AES-256-GCM signed token (24 h expiry) is sufficient.
// Thumbnails are already returned in the public API response, so requiring auth here
// only breaks locked-page previews without adding meaningful security.
const MAX_VIN_IMAGE_BYTES = 6 * 1024 * 1024;

router.get("/vin/image", async (req, res) => {
  const rawToken = req.query.token;
  const token = typeof rawToken === "string" ? rawToken : "";
  const url = verifyImageToken(token);
  if (!url) {
    res.status(403).json({ error: "Invalid or expired image token" });
    return;
  }
  try {
    assertAllowedImageUrl(url);
  } catch {
    res.status(403).json({ error: "Image host not allowed" });
    return;
  }
  try {
    const memoryCached = getMemoryCachedVinImage(url);
    if (memoryCached) {
      if (memoryCached.body.length > MAX_VIN_IMAGE_BYTES) {
        res.status(413).json({ error: "Image too large" });
        return;
      }
      res.setHeader("Content-Type", memoryCached.contentType);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Vin-Image-Cache", "HIT-MEM");
      res.send(memoryCached.body);
      return;
    }

    const diskCached = await resolveVinImageDiskHit(url);
    if (diskCached) {
      if (diskCached.byteLength > MAX_VIN_IMAGE_BYTES) {
        res.status(413).json({ error: "Image too large" });
        return;
      }
      res.setHeader("Content-Type", diskCached.contentType);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Vin-Image-Cache", "HIT");
      await pipeline(createReadStream(diskCached.bodyPath), res);
      return;
    }

    const image = await getOrFetchVinImage(url, async () => {
      return withVinImageUpstreamSlot(async () => {
        const upstream = await fetch(url, {
          headers: { Accept: "image/*,*/*" },
          signal: AbortSignal.timeout(15_000),
        });
        if (!upstream.ok) {
          throw new Error(`upstream ${upstream.status}`);
        }
        const ct = upstream.headers.get("content-type") ?? "image/jpeg";
        const lenHeader = upstream.headers.get("content-length");
        if (lenHeader) {
          const len = Number(lenHeader);
          if (Number.isFinite(len) && len > MAX_VIN_IMAGE_BYTES) {
            throw new Error("upstream image too large");
          }
        }
        const body = Buffer.from(await upstream.arrayBuffer());
        if (!body.length) throw new Error("empty image body");
        if (body.length > MAX_VIN_IMAGE_BYTES) throw new Error("upstream image too large");
        return { contentType: ct, body };
      });
    });
    const diskHit = await getVinImageDiskHit(url);
    if (diskHit) {
      if (diskHit.byteLength > MAX_VIN_IMAGE_BYTES) {
        res.status(413).json({ error: "Image too large" });
        return;
      }
      res.setHeader("Content-Type", diskHit.contentType);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Vin-Image-Cache", "MISS");
      await pipeline(createReadStream(diskHit.bodyPath), res);
      return;
    }
    if (image.body.length > MAX_VIN_IMAGE_BYTES) {
      res.status(413).json({ error: "Image too large" });
      return;
    }
    res.setHeader("Content-Type", image.contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Vin-Image-Cache", "MISS");
    res.send(image.body);
  } catch (err) {
    logger.warn({ err, url }, "vin image proxy fetch failed");
    res.status(502).json({ error: "Image fetch failed" });
  }
});

// ── Free-coupon bookkeeping (use counted atomically at payment creation) ─────
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


// ── Free VIN decoder daily rate limit (in-memory, resets on server restart) ──
const FREE_DECODE_IP_MAP = new Map<string, { count: number; day: string }>();
const FREE_DECODE_IP_MAX = Math.max(
  500,
  Number(process.env.FREE_DECODE_IP_MAP_MAX ?? 3000) || 3000,
);

function pruneFreeDecodeIpMap(today: string): void {
  for (const [ip, entry] of FREE_DECODE_IP_MAP) {
    if (entry.day !== today) FREE_DECODE_IP_MAP.delete(ip);
  }
  while (FREE_DECODE_IP_MAP.size > FREE_DECODE_IP_MAX) {
    const oldest = FREE_DECODE_IP_MAP.keys().next().value;
    if (!oldest) break;
    FREE_DECODE_IP_MAP.delete(oldest);
  }
}

function checkFreeDecodeLimit(ip: string, limit: number): boolean {
  const today = new Date().toISOString().slice(0, 10);
  pruneFreeDecodeIpMap(today);
  const entry = FREE_DECODE_IP_MAP.get(ip);
  if (!entry || entry.day !== today) {
    FREE_DECODE_IP_MAP.set(ip, { count: 1, day: today });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// GET /vin/decode-free?vin=XXX — public (unless settings restrict)
// ⚠️  IMPORTANT: This route must NEVER write to vinLookupsTable.
// Only paid lookups (POST /vin/lookup) may persist data to the DB.
// Free decode results come purely from NHTSA + local decoder.
router.get("/vin/decode-free", freeDecodeBurstLimiter, optionalAuth, async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  const settings = await getFreeDecoderSettings();

  if (settings.freeVinDecoderEnabled === false) {
    res.status(403).json({ error: "The free VIN decoder is currently disabled." });
    return;
  }

  if (settings.freeVinDecoderRequireSignIn && !req.userId) {
    res.status(401).json({
      error: "Sign in required to use the free VIN decoder.",
      code: "SIGN_IN_REQUIRED",
    });
    return;
  }

  // reCAPTCHA when enabled (same as checkout / auth)
  if (!isRecaptchaRelaxedForRequest(req)) {
    const rcToken = String(req.query.rc ?? "") || undefined;
    const captcha = await checkRecaptchaFreeDecoder(rcToken, settings);
    if (captcha.blocked) {
      res.status(400).json({
        error: captcha.reason ?? "Security check failed.",
        code: "RECAPTCHA_FAILED",
      });
      return;
    }
  }

  if (settings.freeVinDecoderDailyLimit && settings.freeVinDecoderDailyLimit > 0) {
    const ip = (String(req.headers["x-forwarded-for"] ?? "")).split(",")[0]?.trim()
      || req.socket.remoteAddress
      || "unknown";
    if (!checkFreeDecodeLimit(ip, settings.freeVinDecoderDailyLimit)) {
      res.status(429).json({
        error: `Daily limit of ${settings.freeVinDecoderDailyLimit} free decodes reached. Please try again tomorrow or upgrade.`,
      });
      return;
    }
  }

  const vin = String(req.query.vin ?? "").toUpperCase().trim();

  if (!vin || vin.length !== 17) {
    res.status(400).json({ error: "VIN must be exactly 17 characters" });
    return;
  }
  const invalidChars = vin.split("").filter(c => !/^[A-HJ-NPR-Z0-9]$/.test(c));
  if (invalidChars.length > 0) {
    const unique = [...new Set(invalidChars)];
    const hasBannedLetter = unique.some(c => ["I","O","Q"].includes(c));
    const hint = hasBannedLetter
      ? ` VINs never use the letters I, O, or Q — did you mean the digit 0 (zero) instead of the letter O?`
      : "";
    res.status(400).json({
      error: `VIN contains invalid character${unique.length > 1 ? "s" : ""}: ${unique.join(", ")}.${hint}`,
    });
    return;
  }

  const checkDigitValid = resolveCheckDigitValid(vin);

  try {
    const result = await decodeFreeVin(vin, checkDigitValid);
    res.json(result);
  } catch (err) {
    logger.warn({ err, vin }, "Free VIN decode failed — falling back to local only");
    const local = decodeVin(vin);
    res.json({
      vin,
      year: local.year,
      make: local.make,
      model: local.model,
      trim: null,
      manufacturer: null,
      vehicleType: null,
      bodyStyle: local.bodyStyleDecoded,
      engineCylinders: local.engineCylinders,
      engineDisplacementL: local.engineDisplacement,
      engineDecoded: local.engineDecoded,
      engineCode: local.engineCode,
      fuelType: local.fuelType,
      driveType: local.driveType,
      transmissionStyle: local.transmissionDecoded,
      plantCountry: local.plantCountry,
      plantCity: local.plantCity,
      plantCode: local.plantCode,
      countryOfOrigin: local.country,
      wmi: local.wmi,
      checkDigitValid,
      source: "local",
      diagnostics: decodeVinDiagnostics(vin, local),
    });
  }
});

// POST /vin/lookup — submit a VIN lookup
router.post("/vin/lookup", vinLookupLimiter, vinLookupUserLimiter, requireAuth, async (req, res) => {
  if (await rejectVinLookupIfDisabled(req, res)) return;

  const userId = req.userId!;
  const { vin, paypalOrderId, paymentId } = req.body as {
    vin: string;
    paypalOrderId?: string;
    paymentId?: number;
  };

  if (!vin || vin.length !== 17) {
    res.status(400).json({ error: "VIN must be exactly 17 characters" });
    return;
  }

  const normalizedVin = vin.toUpperCase();

  // name/email are required so the report-ready email has a recipient.
  const user = await db
    .select({
      isBanned: usersTable.isBanned,
      name: usersTable.name,
      email: usersTable.email,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (user[0]?.isBanned) {
    res.status(403).json({ error: "Account suspended" });
    return;
  }

  let resolvedPayment: { amount: number; currency: string; ref: string | null } | null = null;
  let resolvedPaymentId: number | null = null;
  let resolvedPaymentVin: string | null = null;
  let freeCouponPaymentId: number | null = null;
  let freeCouponCode: string | null = null;

  if (paypalOrderId) {
    const payment = await db.select().from(paymentsTable)
      .where(eq(paymentsTable.paypalOrderId, paypalOrderId))
      .limit(1);
    if (!payment[0] || !isPaymentUsableForLookup(payment[0], userId)) {
      res.status(402).json({ error: "Valid payment required", code: "PAYMENT_REQUIRED" });
      return;
    }
    resolvedPaymentId = payment[0].id;
    resolvedPaymentVin = payment[0].vin;
    resolvedPayment = { amount: Number(payment[0].amount), currency: payment[0].currency ?? "EUR", ref: payment[0].paypalOrderId ?? null };
    if (Number(payment[0].amount) === 0 && payment[0].couponCode) {
      freeCouponPaymentId = payment[0].id;
      freeCouponCode = payment[0].couponCode;
    }
  } else if (paymentId) {
    const payment = await db.select().from(paymentsTable)
      .where(eq(paymentsTable.id, paymentId))
      .limit(1);
    if (!payment[0] || !isPaymentUsableForLookup(payment[0], userId)) {
      res.status(402).json({ error: "Valid payment required", code: "PAYMENT_REQUIRED" });
      return;
    }
    resolvedPaymentId = payment[0].id;
    resolvedPaymentVin = payment[0].vin;
    resolvedPayment = { amount: Number(payment[0].amount), currency: payment[0].currency ?? "EUR", ref: payment[0].paypalOrderId ?? null };
    if (Number(payment[0].amount) === 0 && payment[0].couponCode) {
      freeCouponPaymentId = payment[0].id;
      freeCouponCode = payment[0].couponCode;
    }
  } else {
    const existingPayment = await db.select().from(paymentsTable)
      .where(eq(paymentsTable.userId, userId))
      .limit(100);
    const vinPayment = existingPayment.find(
      (p) => p.vin === normalizedVin && isPaymentUsableForLookup(p, userId),
    );
    if (!vinPayment) {
      res.status(402).json({ error: "Payment required for VIN lookup", code: "PAYMENT_REQUIRED" });
      return;
    }
    resolvedPaymentId = vinPayment.id;
    resolvedPaymentVin = vinPayment.vin;
    resolvedPayment = { amount: Number(vinPayment.amount), currency: vinPayment.currency ?? "EUR", ref: vinPayment.paypalOrderId ?? null };
    if (Number(vinPayment.amount) === 0 && vinPayment.couponCode) {
      freeCouponPaymentId = vinPayment.id;
      freeCouponCode = vinPayment.couponCode;
    }
  }

  if (resolvedPaymentVin && resolvedPaymentVin.toUpperCase() !== normalizedVin) {
    await refundCreditRedemption(resolvedPaymentId, "VIN_MISMATCH");
    res.status(400).json({ error: "Payment is for a different VIN", code: "VIN_MISMATCH" });
    return;
  }

  const existingLookup = await findCompleteUserLookup(userId, normalizedVin);

  if (existingLookup) {
    await sendExistingLookupResponse(res, existingLookup);
    return;
  }

  logger.info({ msg: "vin_lookup_start", vin: normalizedVin, userId, paymentRef: resolvedPayment?.ref ?? null });

  const catalogEntry = await getCatalogVin(normalizedVin);
  const catalogData = (catalogEntry?.data as Record<string, unknown> | null) ?? null;
  // Local catalog wins — never re-fetch provider when we already have a deliverable report.
  if (catalogEntry && catalogData && catalogHasDeliverableReport(catalogData)) {
    const racedLookup = await findCompleteUserLookup(userId, normalizedVin);
    if (racedLookup) {
      await sendExistingLookupResponse(res, racedLookup);
      return;
    }
    const enriched = await enrichVinReportDataForServe(normalizedVin, catalogData);
    const stampedData = await stampLookupReportData(enriched ?? catalogData);
    const [lookup] = await db.insert(vinLookupsTable).values({
      vin: normalizedVin,
      userId,
      status: "complete",
      data: stampedData,
      providerName: catalogEntry.providerName,
      fromCache: true,
      paymentId: resolvedPaymentId,
    }).returning();
    logger.info({ msg: "vin_lookup_hit", source: "catalog", vin: normalizedVin, userId, provider: catalogEntry.providerName });
    await finalizePaymentOnFulfillment(resolvedPaymentId, lookup.id);
    res.json(serializeLookupForClient(lookup));
    if (freeCouponPaymentId && freeCouponCode) {
      void countFreeCoupon(freeCouponPaymentId, freeCouponCode);
    }
    void fireVinReadyEmailForUser(lookup.id, normalizedVin, lookup.data as Record<string, unknown> | null, user[0], resolvedPayment);
    return;
  }

  const cached = await getCachedVin(normalizedVin);
  const cachedData = (cached?.data as Record<string, unknown> | null) ?? null;
  // Reuse another user's complete local report — never re-fetch when we already have one.
  if (cached && cachedData) {
    const racedLookup = await findCompleteUserLookup(userId, normalizedVin);
    if (racedLookup) {
      await sendExistingLookupResponse(res, racedLookup);
      return;
    }
    const enriched = await enrichVinReportDataForServe(normalizedVin, cachedData, {
      primaryUpdatedAt: cached.updatedAt,
    });
    const stampedData = await stampLookupReportData(enriched ?? cachedData);
    const [lookup] = await db.insert(vinLookupsTable).values({
      vin: normalizedVin,
      userId,
      status: "complete",
      data: stampedData,
      providerName: cached.providerName,
      fromCache: true,
      paymentId: resolvedPaymentId,
    }).returning();
    logger.info({ msg: "vin_lookup_hit", source: "cache", vin: normalizedVin, userId, provider: cached.providerName });
    await finalizePaymentOnFulfillment(resolvedPaymentId, lookup.id);
    res.json(serializeLookupForClient(lookup));
    if (freeCouponPaymentId && freeCouponCode) {
      void countFreeCoupon(freeCouponPaymentId, freeCouponCode);
    }
    void fireVinReadyEmailForUser(lookup.id, normalizedVin, lookup.data as Record<string, unknown> | null, user[0], resolvedPayment);
    return;
  }

  const fulfillmentMode = await resolveVinFulfillmentMode(normalizedVin);
  if (fulfillmentMode === "manual_pending") {
    try {
      const racedLookup = await findCompleteUserLookup(userId, normalizedVin);
      if (racedLookup) {
        await sendExistingLookupResponse(res, racedLookup);
        return;
      }
      const lookup = await fulfillManualPendingVinLookup({
        vin: normalizedVin,
        userId,
        paymentId: resolvedPaymentId,
      });
      logger.info({ msg: "vin_lookup_hit", source: "manual_pending", vin: normalizedVin, userId, lookupId: lookup.id });
      await finalizePaymentOnFulfillment(resolvedPaymentId, lookup.id);
      res.json(serializeLookupForClient(lookup));
      if (freeCouponPaymentId && freeCouponCode) {
        void countFreeCoupon(freeCouponPaymentId, freeCouponCode);
      }
      // Manual pending: no customer email until admin publishes to catalog.
      return;
    } catch (err) {
      logger.error({ err, vin: normalizedVin }, "Manual pending VIN fulfillment failed");
      if (freeCouponPaymentId) {
        await failFreeCouponPayment(freeCouponPaymentId, freeCouponCode);
      }
      await refundCreditRedemption(resolvedPaymentId, "VIN_INVALID");
      res.status(422).json({ error: "VIN failed validation for manual report.", code: "VIN_INVALID" });
      return;
    }
  }

  const providers = await db.select().from(providersTable).where(eq(providersTable.isActive, true)).limit(1);
  const provider = providers[0];
  const { resolveGetCarApiConfig, GETCARAPI_PROVIDER_NAME } = await import("../lib/getcarApi.js");
  const getCarConfigured = !!(await resolveGetCarApiConfig());
  const carstatReady = !!provider?.apiKey?.trim();

  // Standard delivery can use GetCarAPI alone — do not require Carstat when GCA is configured.
  if (!carstatReady && !getCarConfigured) {
    await refundCreditRedemption(resolvedPaymentId, "VIN_CHECK_UNAVAILABLE");
    res.status(503).json({ error: "VIN check is temporarily unavailable. Please try again later.", code: "VIN_CHECK_UNAVAILABLE" });
    return;
  }

  const racedLookup = await findCompleteUserLookup(userId, normalizedVin);
  if (racedLookup) {
    await sendExistingLookupResponse(res, racedLookup);
    return;
  }

  const queued = await startProviderFulfillment({
    userId,
    normalizedVin,
    resolvedPaymentId,
    freeCouponPaymentId,
    freeCouponCode,
    resolvedPayment,
    provider: carstatReady
      ? {
          id: provider!.id,
          name: provider!.name,
          baseUrl: provider!.baseUrl,
          apiKey: provider!.apiKey!,
        }
      : {
          id: 0,
          name: GETCARAPI_PROVIDER_NAME,
          baseUrl: "",
          apiKey: "",
        },
    user: user[0],
  });

  res.status(202).json({
    id: queued.id,
    vin: queued.vin,
    status: queued.status,
    fulfilling: queued.status === VIN_FULFILLING_STATUS,
  });
});

// GET /vin/seo/:vin — public meta for crawlers (locked preview fields only)
router.get("/vin/seo/:vin", publicVinLimiter, async (req, res) => {
  const vin = String(req.params.vin ?? "").toUpperCase();
  const lang = String(req.query.lang ?? "en").toLowerCase();
  const seoLang = ((VIN_SEO_LANGS as readonly string[]).includes(lang) ? lang : "en") as VinSeoLang;

  if (!VIN_RE.test(vin)) {
    res.status(400).json({ error: "Invalid VIN" });
    return;
  }

  const report = await vinHasReportData(vin);
  if (!report) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const d = report.dataSource;
  const lockedPreviewSources = await resolveLockedPreviewPhotoSources(vin, d);
  const previewPhotos = proxyPhotoUrls(lockedPreviewSources, report.mediaVersion);

  const seo = buildVinSeoFromCatalogData(seoLang, vin, d, {
    thumbnailUrl: previewPhotos[0] ?? null,
    isUnlocked: false,
  });

  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  res.json(seo);
});

// GET /vin/public/:vin — public locked preview; full report when purchased or valid share link
router.get("/vin/public/:vin", publicVinLimiter, optionalAuth, async (req, res) => {
  const vin = String(req.params.vin ?? "").toUpperCase();
  if (!vin || vin.length !== 17) {
    res.status(400).json({ error: "Invalid VIN" });
    return;
  }

  const userId = req.userId;

  const [report, ownsReport] = await Promise.all([
    resolveVinReportForViewer(vin, userId),
    userId ? userOwnsVinReport(userId, vin) : Promise.resolve(false),
  ]);

  // Paid / credit unlock can land here while provider fetch is still in flight and
  // catalog data is not written yet. Do not 404 real buyers — gate needs isUnlocked so
  // VinResult can show the retrieving state instead of "not in our database".
  // Require a purchase/delivery claim (not bare admin) so random admin visits stay 404.
  if (!report) {
    if (userId && (await userHasVinPurchaseOrDelivery(userId, vin))) {
      res.setHeader("Cache-Control", "private, no-store");
      res.json({
        vin,
        make: null,
        model: null,
        year: null,
        engine: null,
        transmission: null,
        color: null,
        country: null,
        thumbnailUrl: null,
        photos: [],
        inCatalog: false,
        isUnlocked: true,
        status: VIN_FULFILLING_STATUS,
        fulfilling: true,
      });
      return;
    }
    res.status(404).json({ error: "Not found" });
    return;
  }

  const { dataSource: d, inCatalog, mediaVersion } = report;
  // Only the purchasing account (or admin) unlocks — share links never bypass payment.
  const isUnlocked = ownsReport;
  const floodReady = applyMissingFloodFlagsForServe(d as Record<string, unknown>) ?? d;

  const catalogPhotos = Array.isArray(d.photos)
    ? (d.photos as string[]).filter(Boolean)
    : [];
  const lockedPreviewSources = await resolveLockedPreviewPhotoSources(vin, d);
  const lockedPreviewPhotos = proxyPhotoUrls(lockedPreviewSources, mediaVersion);

  // 3. Fetch current pricing
  const [pricingRow] = await db
    .select()
    .from(pricingTable)
    .orderBy(desc(pricingTable.id))
    .limit(1);
  const pricing = normalizePricingAmounts(pricingRow ?? DEFAULT_PRICING);
  const displayPrice = pricing.discountEnabled ? pricing.discountPrice : pricing.basePrice;
  const currency = pricing.currency;

  const response: Record<string, unknown> = {
    vin,
    make: (d.make as string | null) ?? null,
    model: (d.model as string | null) ?? null,
    year: (d.year as number | null) ?? null,
    engine: (d.engine as string | null) ?? null,
    transmission: (d.transmission as string | null) ?? null,
    color: (d.color as string | null) ?? (d.exteriorColor as string | null) ?? null,
    country: (d.country as string | null) ?? null,
    thumbnailUrl: lockedPreviewPhotos[0] ?? null,
    photos: lockedPreviewPhotos,
    inCatalog,
    isUnlocked,
    price: displayPrice,
    currency,
  };

  if (!isUnlocked) {
    // Counts only — never accident/salvage/stolen/odometer values or history arrays.
    response.previewSignals = sanitizeLockedPreviewSignalsForClient(
      extractLockedPreviewSignals(floodReady as Record<string, unknown>),
    );
  }

  if (isUnlocked) {
    const catalogPhotosHd = Array.isArray(d.photosHd)
      ? (d.photosHd as string[]).filter(Boolean)
      : [];
    const photos360Exterior = Array.isArray(d.photos360Exterior)
      ? (d.photos360Exterior as string[]).filter(Boolean)
      : [];
    const photos360Interior = Array.isArray(d.photos360Interior)
      ? (d.photos360Interior as string[]).filter(Boolean)
      : [];
    const photos360EmbedUrl = sanitizeAuctionPanoramaUrl(d.photos360EmbedUrl);
    const splitEmbed = splitAuctionPanoramaUrls(photos360EmbedUrl);
    const photos360EmbedExteriorUrl =
      sanitizeAuctionPanoramaUrl(d.photos360EmbedExteriorUrl) ?? splitEmbed.exterior;
    const photos360EmbedInteriorUrl =
      sanitizeAuctionPanoramaUrl(d.photos360EmbedInteriorUrl) ?? splitEmbed.interior;
    Object.assign(response, {
      trim: (d.trim as string | null) ?? null,
      odometer: (d.odometer as number | null) ?? (d.mileage as number | null) ?? null,
      odometerLocked: d.odometerLocked === true,
      accidents: Array.isArray(d.accidents) ? d.accidents : [],
      accidentCount:
        (d.accidentCount as number | null) ??
        (Array.isArray(d.accidents) ? (d.accidents as unknown[]).length : 0),
      ownerCount: (d.owners as number | null) ?? (d.ownerCount as number | null) ?? null,
      salvage: (d.isSalvage as boolean | null) ?? (d.salvage as boolean | null) ?? null,
      stolen: (d.isStolen as boolean | null) ?? (d.stolen as boolean | null) ?? null,
      taxi: (d.isTaxi as boolean | null) ?? (d.taxi as boolean | null) ?? null,
      flooded: (floodReady.isFlooded as boolean | null) ?? (floodReady.flooded as boolean | null) ?? null,
      floodCount: (floodReady.floodCount as number | null) ?? null,
      floodLossAmount: (floodReady.floodLossAmount as number | null) ?? null,
      titleStatus: (d.titleStatus as string | null) ?? null,
      photos: proxyPhotoUrls(catalogPhotos, mediaVersion),
      ...(catalogPhotosHd.length > 0
        && catalogPhotosHd.join("\0") !== catalogPhotos.join("\0")
        ? { photosHd: proxyPhotoUrls(catalogPhotosHd, mediaVersion) }
        : {}),
      ...(photos360Exterior.length > 0
        ? { photos360Exterior: proxySpinPhotoUrls(photos360Exterior, mediaVersion) }
        : {}),
      ...(photos360Interior.length > 0
        ? { photos360Interior: proxySpinPhotoUrls(photos360Interior, mediaVersion) }
        : {}),
      ...(photos360EmbedUrl ? { photos360EmbedUrl } : {}),
      ...(photos360EmbedExteriorUrl ? { photos360EmbedExteriorUrl } : {}),
      ...(photos360EmbedInteriorUrl ? { photos360EmbedInteriorUrl } : {}),
      hp: (d.hp as number | null) ?? null,
      cylinders: (d.cylinders as number | null) ?? null,
      bodyType: (d.bodyType as string | null) ?? null,
      fuelType: (d.fuelType as string | null) ?? null,
      mileageHistory: Array.isArray(d.mileageHistory) ? d.mileageHistory : [],
      ownerHistory: Array.isArray(d.ownerHistory) ? d.ownerHistory : [],
      insuranceClaims: Array.isArray(d.insuranceClaims) ? d.insuranceClaims : [],
      registryHistory: Array.isArray(d.registryHistory) ? d.registryHistory : [],
      recallHistory: Array.isArray(d.recallHistory) ? d.recallHistory : [],
      serviceHistory: Array.isArray(d.serviceHistory) ? d.serviceHistory : [],
      auctionHistory: Array.isArray(d.auctionHistory) ? d.auctionHistory : [],
      marketData: (d.marketData as Record<string, unknown> | null) ?? null,
      krwPerUsd: readFrozenKrwPerUsd(d),
    });
  }

  res.setHeader("Cache-Control", "private, no-store");
  res.json(response);
});

// GET /vin/public/resolve-id/:id — removed; use GET /vin/resolve/:id (auth + owner check)

// GET /vin/share-link/:vin — mint a share token for an owned / purchased report
router.get("/vin/share-link/:vin", requireAuth, async (req, res) => {
  const vin = String(req.params.vin ?? "").toUpperCase();
  if (!VIN_RE.test(vin)) {
    res.status(400).json({ error: "Invalid VIN" });
    return;
  }

  const allowed = await canAccessVinShare(req.userId, vin);
  if (!allowed) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const report = await vinHasReportData(vin);
  if (!report) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.json({ token: signVinShareToken(vin) });
});

// GET /vin/resolve/:id — resolves a numeric lookup ID to its VIN (owner only)
router.get("/vin/resolve/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const userId = req.userId!;
  const [userRow] = await db
    .select({ isAdmin: usersTable.isAdmin })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  const [row] = await db
    .select({ vin: vinLookupsTable.vin, userId: vinLookupsTable.userId })
    .from(vinLookupsTable)
    .where(and(
      eq(vinLookupsTable.id, id),
      or(
        eq(vinLookupsTable.status, "complete"),
        eq(vinLookupsTable.status, "pending_manual"),
        eq(vinLookupsTable.status, VIN_FULFILLING_STATUS),
      ),
    ))
    .limit(1);
  if (!row) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (!userRow?.isAdmin && row.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  res.json({ vin: row.vin });
});

// GET /vin/wait-update/:vin — long-poll while pending_manual; wakes on admin publish only
router.get("/vin/wait-update/:vin", requireAuth, async (req, res) => {
  const vin = String(req.params.vin ?? "").toUpperCase();
  if (!VIN_RE.test(vin)) {
    res.status(400).json({ error: "Invalid VIN" });
    return;
  }

  const userId = req.userId!;
  const sinceRaw = String(req.query.since ?? "0");
  const sinceMs = Number(sinceRaw);
  const since = Number.isFinite(sinceMs) && sinceMs > 0 ? sinceMs : 0;

  const [user] = await db
    .select({ isAdmin: usersTable.isAdmin })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  const loadClientLookup = async () => {
    const row = await findCompleteUserLookup(userId, vin);
    if (!row) return null;
    if (row.userId !== userId && !user?.isAdmin) return null;
    const rawData = row.data as Record<string, unknown> | null;
    const enrichedData = rawData
      ? await enrichVinReportDataForServe(row.vin, rawData, { primaryUpdatedAt: row.updatedAt })
      : null;
    return serializeLookupForClient({ ...row, data: enrichedData ?? row.data });
  };

  const lookupMs = (row: { updatedAt?: Date | string | null }) => {
    if (!row.updatedAt) return 0;
    const t = row.updatedAt instanceof Date ? row.updatedAt.getTime() : new Date(row.updatedAt).getTime();
    return Number.isFinite(t) ? t : 0;
  };

  let current = await findCompleteUserLookup(userId, vin);
  if (!current || (current.userId !== userId && !user?.isAdmin)) {
    res.status(404).json({ error: "VIN lookup not found" });
    return;
  }

  const alreadyChanged =
    current.status !== "pending_manual" || lookupMs(current) > since;

  if (alreadyChanged) {
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ changed: true, lookup: await loadClientLookup() });
    return;
  }

  let closed = false;
  req.on("close", () => { closed = true; });

  await waitForVinLookupPublish(vin, 55_000);
  if (closed) return;

  current = await findCompleteUserLookup(userId, vin);
  if (!current) {
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ changed: false });
    return;
  }

  const changed = current.status !== "pending_manual" || lookupMs(current) > since;
  res.setHeader("Cache-Control", "private, no-store");
  res.json({
    changed,
    lookup: changed ? await loadClientLookup() : null,
  });
});

// GET /vin/:id
router.get("/vin/:id", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const rawId = String(req.params.id ?? "").toUpperCase();
  const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
  const isVinString = VIN_RE.test(rawId);
  const id = isVinString ? NaN : parseInt(rawId, 10);

  if (!isVinString && isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  let lookup: typeof vinLookupsTable.$inferSelect | undefined;
  if (!isVinString && !isNaN(id)) {
    [lookup] = await db.select().from(vinLookupsTable).where(eq(vinLookupsTable.id, id)).limit(1);
  } else {
    lookup = await findUserVinLookupForServe(userId, rawId);
  }

  if (!lookup) {
    // Purchased but lookup still pending — serve catalog/cache data when available
    if (isVinString && (await userOwnsVinReport(userId, rawId))) {
      const report = await vinHasReportData(rawId);
      if (report) {
        res.setHeader("Cache-Control", "private, no-store");
        res.json({
          id: 0,
          vin: rawId,
          userId,
          status: "complete",
          data: transformVinPhotos(report.dataSource, report.mediaVersion),
          fromCache: true,
          paymentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return;
      }
    }
    // Real buyer/credit redeem waiting on provider — never hard 404 right after checkout.
    // Bare admin (no payment/lookup) must still 404 for unknown VINs.
    if (isVinString && (await userHasVinPurchaseOrDelivery(userId, rawId))) {
      res.setHeader("Cache-Control", "private, no-store");
      res.json({
        id: 0,
        vin: rawId,
        userId,
        status: VIN_FULFILLING_STATUS,
        fulfilling: true,
        data: null,
        fromCache: false,
        paymentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return;
    }
    res.status(404).json({ error: "VIN lookup not found" });
    return;
  }

  const [user] = await db
    .select({ isAdmin: usersTable.isAdmin })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  // Same 404 as a missing row — do not leak existence of other users' lookup IDs.
  if (lookup.userId !== userId && !user?.isAdmin) {
    res.status(404).json({ error: "VIN lookup not found" });
    return;
  }

  if (lookup.status === "revoked" && !user?.isAdmin) {
    res.status(403).json({ error: "Access to this report has been revoked" });
    return;
  }

  if (lookup.status === VIN_FULFILLING_STATUS) {
    res.setHeader("Cache-Control", "private, no-store");
    const { providerName: _providerName, ...safe } = lookup;
    res.json({
      ...safe,
      data: null,
      status: VIN_FULFILLING_STATUS,
      fulfilling: true,
    });
    return;
  }

  res.setHeader("Cache-Control", "private, no-store");
  const rawData = lookup.data as Record<string, unknown> | null;
  const enrichedData = rawData
    ? await enrichVinReportDataForServe(lookup.vin, rawData, { primaryUpdatedAt: lookup.updatedAt })
    : null;
  res.json(serializeLookupForClient({
    ...lookup,
    data: enrichedData ?? lookup.data,
  }));
});

// GET /vin/peek/:vin — pre-checkout preview decoded from the VIN string
router.get("/vin/peek/:vin", vinPeekLimiter, requireAuth, async (req, res) => {
  if (await rejectVinLookupIfDisabled(req, res)) return;

  const vin = String(req.params.vin ?? "").toUpperCase();
  if (!vin || vin.length !== 17) {
    res.status(400).json({ error: "Invalid VIN" });
    return;
  }
  const invalidChars = vin.split("").filter(c => !/^[A-HJ-NPR-Z0-9]$/.test(c));
  if (invalidChars.length > 0) {
    const unique = [...new Set(invalidChars)];
    const hasBannedLetter = unique.some(c => ["I","O","Q"].includes(c));
    const hint = hasBannedLetter
      ? ` VINs never use the letters I, O, or Q — did you mean the digit 0 (zero) instead of the letter O?`
      : "";
    res.status(400).json({
      error: `VIN contains invalid character${unique.length > 1 ? "s" : ""}: ${unique.join(", ")}.${hint}`,
    });
    return;
  }

  const checkDigitValid = resolveCheckDigitValid(vin);

  // Check if this user already has a completed lookup or payment for this VIN
  const [[completedLookup], [pendingLookup], [completedPmt], [fulfillingLookup], [pendingFreePmt]] = await Promise.all([
    db.select({ id: vinLookupsTable.id })
      .from(vinLookupsTable)
      .where(and(
        eq(vinLookupsTable.userId, req.userId!),
        eq(vinLookupsTable.vin, vin),
        eq(vinLookupsTable.status, "complete")
      ))
      .orderBy(desc(vinLookupsTable.id))
      .limit(1),
    db.select({ id: vinLookupsTable.id })
      .from(vinLookupsTable)
      .where(and(
        eq(vinLookupsTable.userId, req.userId!),
        eq(vinLookupsTable.vin, vin),
        eq(vinLookupsTable.status, "pending_manual")
      ))
      .orderBy(desc(vinLookupsTable.id))
      .limit(1),
    db.select({ id: paymentsTable.id })
      .from(paymentsTable)
      .where(and(
        eq(paymentsTable.userId, req.userId!),
        eq(paymentsTable.vin, vin),
        eq(paymentsTable.status, "completed")
      ))
      .limit(1),
    db.select({ id: vinLookupsTable.id })
      .from(vinLookupsTable)
      .where(and(
        eq(vinLookupsTable.userId, req.userId!),
        eq(vinLookupsTable.vin, vin),
        eq(vinLookupsTable.status, VIN_FULFILLING_STATUS),
      ))
      .orderBy(desc(vinLookupsTable.id))
      .limit(1),
    db.select({ id: paymentsTable.id })
      .from(paymentsTable)
      .where(and(
        eq(paymentsTable.userId, req.userId!),
        eq(paymentsTable.vin, vin),
        eq(paymentsTable.status, "pending"),
        eq(paymentsTable.amount, 0),
        sql`${paymentsTable.couponCode} IS NOT NULL`,
      ))
      .orderBy(desc(paymentsTable.id))
      .limit(1),
  ]);
  const alreadyUnlocked = !!(completedLookup || pendingLookup || completedPmt);
  const deliveryInProgress = !!(fulfillingLookup || pendingFreePmt);
  const lookupId = completedLookup?.id ?? pendingLookup?.id ?? fulfillingLookup?.id ?? null;
  const pendingFreeCouponPaymentId = pendingFreePmt?.id ?? null;

  const [cached, catalog] = await Promise.all([
    getCachedVinForPeek(vin),
    getCatalogVinPeekHint(vin),
  ]);

  const previewData = ((cached?.status === "complete"
    ? { make: cached.make, model: cached.model, year: cached.year }
    : null) ?? (catalog ? { make: catalog.make, model: catalog.model, year: catalog.year } : null));
  const fromCache = !!(cached?.status === "complete" || catalog);

  const identity = await decodeVinPeek(vin, checkDigitValid, fromCache ? previewData : null);

  const peekPayload = {
    vin,
    make: identity.make,
    model: identity.model,
    year: identity.year,
    modelYearRange: identity.modelYearRange,
    series: identity.series,
    trim: identity.trim,
    engine: identity.engine,
    country: identity.country,
    wmi: identity.wmi,
    decodeSource: identity.decodeSource,
    fromCache,
    localDecode: identity.decodeSource === "local",
    deliveryInProgress,
    pendingFreeCouponPaymentId,
  };

  if (alreadyUnlocked) {
    res.json({
      ...peekPayload,
      dataAvailable: true,
      alreadyUnlocked: true,
      lookupId,
    });
    return;
  }

  if (isVehicleTooOldForLookup(identity.year)) {
    res.json({
      ...peekPayload,
      dataAvailable: false,
      vehicleTooOld: true,
      alreadyUnlocked: false,
      lookupId,
    });
    return;
  }

  let dataAvailable: boolean | undefined;
  let manualPending = false;
  let checkUnavailable = false;
  let checkUnavailableCode: string | undefined;

  const catalogData = catalog;
  const cachedComplete = cached?.status === "complete";

  if (catalogData?.deliverable) {
    dataAvailable = true;
  } else if (cachedComplete) {
    dataAvailable = true;
  } else {
  try {
    const probe = await probeExternalVinAvailability(vin);
    if (probe.status === "exists") {
      dataAvailable = true;
    } else if (probe.status === "not_found") {
      if (await isVinEligibleForManualPending(vin)) {
        dataAvailable = true;
        manualPending = true;
      } else {
        dataAvailable = false;
      }
    } else {
      if (await isVinEligibleForManualPending(vin)) {
        dataAvailable = true;
        manualPending = true;
      } else {
        checkUnavailable = true;
        checkUnavailableCode = "PROVIDER_UNAVAILABLE";
      }
    }
  } catch (err) {
    logger.warn({ msg: "peek_exists_check_failed", vin, err });
    if (await isVinEligibleForManualPending(vin)) {
      dataAvailable = true;
      manualPending = true;
    } else {
      checkUnavailable = true;
      checkUnavailableCode = "PROVIDER_UNAVAILABLE";
    }
  }
  }

  res.json({
    ...peekPayload,
    dataAvailable,
    manualPending: manualPending || undefined,
    checkUnavailable: checkUnavailable || undefined,
    checkUnavailableCode: checkUnavailableCode ?? undefined,
    alreadyUnlocked: false,
    lookupId,
  });
});

// GET /vin/preview/:vin — unlisted preview (share token ?s= or signed-in owner)
router.get("/vin/preview/:vin", publicVinLimiter, optionalAuth, async (req, res) => {
  const vin = String(req.params.vin ?? "").toUpperCase();
  if (!vin || vin.length !== 17) {
    res.status(400).json({ error: "Invalid VIN" });
    return;
  }

  const shareToken = typeof req.query.s === "string" ? req.query.s : undefined;
  const allowed = await canAccessVinShare(req.userId, vin, shareToken);
  if (!allowed) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const cached = await getCachedVinForPreview(vin);
  if (!cached || cached.status !== "complete") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const mediaVersion = mediaVersionFromUpdatedAt(cached.updatedAt);
  const firstPhoto = cached.firstPhoto;
  res.json({
    vin,
    make: cached.make ?? null,
    model: cached.model ?? null,
    year: cached.year ?? null,
    country: cached.country ?? null,
    thumbnailUrl: firstPhoto ? buildImageProxyUrl(firstPhoto, { mediaVersion }) : null,
  });
});

export default router;
