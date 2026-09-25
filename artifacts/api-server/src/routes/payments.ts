import { Router } from "express";
import { db, paymentsTable, pricingTable, usersTable, systemSettingsTable, couponsTable, DEFAULT_PRICING, normalizePricingAmounts } from "@workspace/db";
import { eq, desc, and, lt, sql, gte, isNull, isNotNull } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { ensureVinPayableForPayment, PUBLIC_VIN_CHECK_UNAVAILABLE } from "../lib/vinService.js";
import { recordedTransactionWhere } from "../lib/recordedPayments.js";
import rateLimit from "express-rate-limit";
import { isTrustedApiRequest } from "../lib/clientGuard.js";
import { isRecaptchaRelaxedForRequest } from "../lib/allowedOrigins.js";
import { makeTtlCache } from "../lib/ttlCache.js";
import { getEffectiveSystemSettings } from "../lib/systemSettings.js";
import {
  isFacebookOAuthConfigured,
  isGoogleOAuthConfigured,
} from "../lib/oauthSettings.js";
import { normalizeMaintenanceRestrictions } from "../lib/maintenancePolicy.js";
import { rejectVinLookupIfDisabled } from "../lib/vinLookupGate.js";
import { resolveClarityProjectId } from "../lib/analyticsIds.js";
import {
  PAYPAL_ORDER_ID_RE,
  fetchPaypalOrderStatus,
  interpretPaypalCaptureResponse,
  fetchPaypalOrderCaptureAmount,
  paypalAmountsMatch,
} from "../lib/paypalCapture.js";
import { paypalOrderCreateLimiter, paypalCaptureLimiter, pokOrderCreateLimiter, pokConfirmLimiter, pokWebhookLimiter } from "../lib/expensiveEndpointLimiter.js";
import { getCreditPack, isCreditPackId } from "../lib/creditPacks.js";
import { completeCreditPackPayment } from "../lib/creditRedemption.js";
import { invalidateAdminStatsCache } from "../lib/adminStatsInvalidation.js";
import { vinReportPaymentLabel } from "../lib/vinReportPaymentLabel.js";
import {
  POK_ORDER_ID_RE,
  createPokSdkOrder,
  getPokConfig,
  getPokEnv,
  resolvePokConfig,
  resolvePokWebhookUrl,
} from "../lib/pokClient.js";
import { confirmPokPaymentByOrderId } from "../lib/pokPaymentConfirm.js";
import { handlePokWebhook } from "../lib/pokWebhook.js";

const couponLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many coupon attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isTrustedApiRequest(req),
});

const router = Router();

// ── PayPal helpers ────────────────────────────────────────────────────────────

async function getPaypalConfig() {
  const settings = await getEffectiveSystemSettings();
  const clientId = (settings?.paypalClientId?.trim() || process.env.PAYPAL_CLIENT_ID?.trim()) ?? "";
  const clientSecret = (settings?.paypalClientSecret?.trim() || process.env.PAYPAL_CLIENT_SECRET?.trim()) ?? "";
  const sandbox = settings?.paypalSandbox ?? true;
  return { clientId, clientSecret, sandbox };
}

async function getPaypalAccessToken(clientId: string, clientSecret: string, sandbox: boolean) {
  const base = sandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
  const resp = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`PayPal auth failed: ${err.slice(0, 200)}`);
  }
  const data = await resp.json() as { access_token: string; expires_in?: number };
  return { token: data.access_token, base, expiresIn: data.expires_in ?? 32400 };
}

// Cache PayPal access tokens — they're valid for ~9 h; refresh 5 min early
let _ppTokenCache: { cacheKey: string; token: string; base: string; expiresAt: number } | null = null;

async function getPaypalAccessTokenCached(clientId: string, clientSecret: string, sandbox: boolean) {
  const cacheKey = `${sandbox ? "sb" : "live"}:${clientId}`;
  if (_ppTokenCache && _ppTokenCache.cacheKey === cacheKey && Date.now() < _ppTokenCache.expiresAt) {
    return { token: _ppTokenCache.token, base: _ppTokenCache.base };
  }
  const { token, base, expiresIn } = await getPaypalAccessToken(clientId, clientSecret, sandbox);
  _ppTokenCache = { cacheKey, token, base, expiresAt: Date.now() + (expiresIn - 300) * 1000 };
  return { token, base };
}

// ── Pricing ───────────────────────────────────────────────────────────────────

async function getActivePricing() {
  const [pricing] = await db.select().from(pricingTable).orderBy(desc(pricingTable.id)).limit(1);
  return normalizePricingAmounts(pricing ?? DEFAULT_PRICING);
}

type PricingResponse = { basePrice: number; discountPrice: number; currency: string; discountEnabled: boolean };
type PublicSettingsResponse = {
  recaptchaEnabled: boolean;
  recaptchaSiteKey: string | null;
  paypalClientId: string | null;
  paypalSandbox: boolean;
  paypalEnableCards: boolean;
  googleEnabled: boolean;
  facebookEnabled: boolean;
  freeVinDecoderEnabled: boolean;
  freeVinDecoderRequireSignIn: boolean;
  krwPerUsd: number;
  analyticsGtmEnabled: boolean;
  analyticsGtmContainerId: string | null;
  analyticsGaEnabled: boolean;
  analyticsGaMeasurementId: string | null;
  analyticsClarityEnabled: boolean;
  analyticsClarityProjectId: string | null;
  analyticsMetaPixelEnabled: boolean;
  analyticsMetaPixelId: string | null;
  maintenanceMode: boolean;
  maintenanceRestrictions: string[];
  maintenanceMessage: string | null;
  vinLookupEnabled: boolean;
  /** True when POK_MERCHANT_ID + POK_KEY_ID + POK_KEY_SECRET are set. */
  pokEnabled: boolean;
  pokEnv: "staging" | "production";
};

const pricingCache = makeTtlCache<PricingResponse>(30 * 60_000);
const publicSettingsCache = makeTtlCache<PublicSettingsResponse>(5 * 60_000);

export function invalidatePricingCache(): void { pricingCache.invalidate(); }
export function invalidatePublicSettingsCache(): void { publicSettingsCache.invalidate(); }

// GET /payments/current-pricing
router.get("/payments/current-pricing", async (_req, res) => {
  const data = await pricingCache.getOrFetch(async () => {
    const pricing = await getActivePricing();
    return {
      basePrice: pricing.basePrice,
      discountPrice: pricing.discountPrice,
      currency: pricing.currency,
      discountEnabled: pricing.discountEnabled,
    };
  });
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=1800");
  res.json(data);
});

// GET /payments/public-settings
router.get("/payments/public-settings", async (req, res) => {
  const data = await publicSettingsCache.getOrFetch(async () => {
    const settings = await getEffectiveSystemSettings();
    const envClientId = process.env.PAYPAL_CLIENT_ID?.trim() || null;
    const rawClientId = settings?.paypalClientId?.trim() || envClientId;
    const paypalClientId = rawClientId || null;
    const googleEnabled = isGoogleOAuthConfigured(settings);
    const facebookEnabled = isFacebookOAuthConfigured(settings);
    const pokConfig = getPokConfig(settings);
    return {
      recaptchaEnabled: settings?.recaptchaEnabled ?? false,
      recaptchaSiteKey: settings?.recaptchaSiteKey ?? null,
      paypalClientId,
      paypalSandbox: settings?.paypalSandbox ?? true,
      paypalEnableCards: settings?.paypalEnableCards ?? true,
      googleEnabled,
      facebookEnabled,
      freeVinDecoderEnabled: settings?.freeVinDecoderEnabled ?? true,
      freeVinDecoderRequireSignIn: settings?.freeVinDecoderRequireSignIn ?? false,
      krwPerUsd: settings?.krwPerUsd && settings.krwPerUsd > 0 ? settings.krwPerUsd : 1415,
      analyticsGtmEnabled: !!(settings?.analyticsGtmEnabled && settings.analyticsGtmContainerId?.trim()),
      analyticsGtmContainerId: settings?.analyticsGtmContainerId?.trim() || null,
      analyticsGaEnabled: !!(settings?.analyticsGaEnabled && settings.analyticsGaMeasurementId?.trim()),
      analyticsGaMeasurementId: settings?.analyticsGaMeasurementId?.trim() || null,
      analyticsClarityEnabled: !!(
        settings?.analyticsClarityEnabled && resolveClarityProjectId(settings)
      ),
      analyticsClarityProjectId: resolveClarityProjectId(settings),
      analyticsMetaPixelEnabled: !!(
        settings?.analyticsMetaPixelEnabled && settings.analyticsMetaPixelId?.trim()
      ),
      analyticsMetaPixelId: settings?.analyticsMetaPixelId?.trim() || null,
      maintenanceMode: settings?.maintenanceMode ?? false,
      maintenanceRestrictions: normalizeMaintenanceRestrictions(settings?.maintenanceRestrictions),
      maintenanceMessage: settings?.maintenanceMessage?.trim() || null,
      vinLookupEnabled: settings?.vinLookupEnabled !== false,
      pokEnabled: !!pokConfig,
      pokEnv: pokConfig?.env ?? getPokEnv(settings),
    };
  });
  const relaxed = isRecaptchaRelaxedForRequest(req);
  res.setHeader("Cache-Control", "public, max-age=120, stale-while-revalidate=600");
  const livePok = await resolvePokConfig();
  res.json({
    ...data,
    // Re-resolve POK on every request so admin saves show without waiting for cache TTL.
    pokEnabled: !!livePok,
    pokEnv: livePok?.env ?? getPokEnv(),
    recaptchaEnabled: relaxed ? false : data.recaptchaEnabled,
    recaptchaSiteKey: relaxed ? null : data.recaptchaSiteKey,
  });
});

async function verifyRecaptcha(
  token: string,
  secretKey: string,
  minScore = 0.5,
): Promise<boolean> {
  const endpoints = [
    "https://www.google.com/recaptcha/api/siteverify",
    "https://www.recaptcha.net/recaptcha/api/siteverify",
  ];
  for (const endpoint of endpoints) {
    try {
      const body = new URLSearchParams({ secret: secretKey, response: token });
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        signal: AbortSignal.timeout(5000),
      });
      const data = await resp.json() as { success: boolean; score?: number };
      if (data.success && (data.score ?? 1) >= minScore) return true;
    } catch {
      // try next endpoint
    }
  }
  return false;
}

// ── Coupon validation helper ──────────────────────────────────────────────────

async function resolveCoupon(code: string, basePrice: number): Promise<{
  coupon: typeof couponsTable.$inferSelect;
  finalPrice: number;
  discountAmount: number;
} | { error: string }> {
  const [coupon] = await db.select().from(couponsTable)
    .where(eq(couponsTable.code, code.toUpperCase().trim()))
    .limit(1);

  if (!coupon || !coupon.isActive) return { error: "Invalid or inactive coupon code" };
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return { error: "Coupon has expired" };
  if (coupon.maxUses != null && coupon.uses >= coupon.maxUses) return { error: "Coupon usage limit reached" };

  const price = Number(basePrice);
  const rawValue = Number(coupon.value);
  if (!Number.isFinite(price) || price < 0 || !Number.isFinite(rawValue)) {
    return { error: "Invalid or inactive coupon code" };
  }

  let discountAmount = 0;
  if (coupon.type === "percent") {
    discountAmount = parseFloat((price * (rawValue / 100)).toFixed(2));
  } else {
    discountAmount = Math.min(rawValue, price);
  }

  const finalPrice = parseFloat(Math.max(0, price - discountAmount).toFixed(2));
  if (!Number.isFinite(finalPrice) || !Number.isFinite(discountAmount)) {
    return { error: "Invalid or inactive coupon code" };
  }
  return { coupon, finalPrice, discountAmount };
}

/** Atomically consume one coupon use; returns false when maxUses is exhausted. */
async function consumeCouponUse(couponId: number, maxUses: number | null): Promise<boolean> {
  const conditions = [eq(couponsTable.id, couponId)];
  if (maxUses != null) {
    conditions.push(lt(couponsTable.uses, maxUses));
  }

  const [updated] = await db
    .update(couponsTable)
    .set({ uses: sql`${couponsTable.uses} + 1`, updatedAt: new Date() })
    .where(and(...conditions))
    .returning({ id: couponsTable.id });

  return !!updated;
}

/** Roll back a reserved coupon use when order creation fails before payment is stored. */
async function releaseCouponUse(couponId: number): Promise<void> {
  await db
    .update(couponsTable)
    .set({ uses: sql`GREATEST(${couponsTable.uses} - 1, 0)`, updatedAt: new Date() })
    .where(eq(couponsTable.id, couponId));
}

async function releaseCouponUseByCode(code: string | null | undefined): Promise<void> {
  if (!code?.trim()) return;
  const [coupon] = await db.select({ id: couponsTable.id })
    .from(couponsTable)
    .where(eq(couponsTable.code, code.toUpperCase().trim()))
    .limit(1);
  if (coupon) await releaseCouponUse(coupon.id);
}

/**
 * Create or reuse a pending €0 coupon payment (no gateway).
 * Caller must already have validated the coupon and VIN payability.
 */
async function createOrReuseFreeCouponPayment(input: {
  userId: string;
  vin: string;
  currency: string;
  discountAmount: number;
  appliedCoupon: typeof couponsTable.$inferSelect | null;
}): Promise<{ paymentId: number; reused: boolean } | { error: string }> {
  const { userId, vin, currency, discountAmount, appliedCoupon } = input;

  const [existingPendingFree] = await db.select().from(paymentsTable)
    .where(and(
      eq(paymentsTable.userId, userId),
      eq(paymentsTable.vin, vin),
      eq(paymentsTable.status, "pending"),
      eq(paymentsTable.amount, 0),
      sql`${paymentsTable.couponCode} IS NOT NULL`,
    ))
    .orderBy(desc(paymentsTable.id))
    .limit(1);

  if (existingPendingFree) {
    logger.info({
      msg: "payment_reused",
      type: "free_coupon_pending",
      paymentId: existingPendingFree.id,
      userId,
      vin,
      couponCode: existingPendingFree.couponCode ?? null,
    });
    return { paymentId: existingPendingFree.id, reused: true };
  }

  if (appliedCoupon) {
    const reserved = await consumeCouponUse(appliedCoupon.id, appliedCoupon.maxUses);
    if (!reserved) return { error: "Coupon usage limit reached" };
  }

  const [payment] = await db.insert(paymentsTable).values({
    userId,
    vin,
    amount: 0,
    currency,
    status: "pending",
    kind: "vin_report",
    couponCode: appliedCoupon?.code ?? null,
    discountAmount,
  }).returning();

  logger.info({
    msg: "payment_created",
    type: "free_coupon",
    paymentId: payment.id,
    userId,
    vin,
    couponCode: appliedCoupon?.code ?? null,
  });
  return { paymentId: payment.id, reused: false };
}

// POST /payments/validate-coupon
router.post("/payments/validate-coupon", requireAuth, couponLimiter, async (req, res) => {
  if (await rejectVinLookupIfDisabled(req, res)) return;
  const { code } = req.body as { code?: string };
  if (!code?.trim()) {
    res.status(400).json({ error: "Coupon code is required" });
    return;
  }

  const COUPON_RE = /^[A-Z0-9_-]{1,50}$/i;
  if (!COUPON_RE.test(code.trim())) {
    res.status(400).json({ error: "Invalid coupon code format" });
    return;
  }

  const pricing = await getActivePricing();
  const basePrice = pricing.discountEnabled ? pricing.discountPrice : pricing.basePrice;
  const result = await resolveCoupon(code, basePrice);

  if ("error" in result) {
    res.status(422).json({ error: result.error });
    return;
  }

  res.json({
    code: result.coupon.code,
    type: result.coupon.type,
    value: result.coupon.value,
    finalPrice: result.finalPrice,
    discountAmount: result.discountAmount,
    isFree: result.finalPrice === 0,
    vin: req.body.vin ?? null,
  });
});

// POST /payments/create-paypal-order — creates a PayPal order and returns orderId
router.post("/payments/create-paypal-order", paypalOrderCreateLimiter, requireAuth, async (req, res) => {
  const userId = req.userId!;
  const { vin, couponCode, recaptchaToken } = req.body as {
    vin: string; couponCode?: string; recaptchaToken?: string;
  };

  const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/i;
  if (!vin || !VIN_RE.test(vin)) { res.status(400).json({ error: "Invalid VIN — must be 17 alphanumeric characters (no I, O, or Q)" }); return; }

  // Coupon code: max 50 chars, alphanumeric + dash/underscore only
  const COUPON_RE = /^[A-Z0-9_-]{1,50}$/i;
  if (couponCode?.trim() && !COUPON_RE.test(couponCode.trim())) {
    res.status(400).json({ error: "Invalid coupon code format" });
    return;
  }

  const user = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);

  if (user[0]?.isBanned) { res.status(403).json({ error: "Account suspended" }); return; }
  if (await rejectVinLookupIfDisabled(req, res)) return;

  const pricing = await getActivePricing();
  const basePrice = pricing.discountEnabled ? pricing.discountPrice : pricing.basePrice;
  const currency = pricing.currency;

  let finalPrice = basePrice;
  let discountAmount = 0;
  let appliedCoupon: typeof couponsTable.$inferSelect | null = null;

  if (couponCode?.trim()) {
    const couponResult = await resolveCoupon(couponCode, basePrice);
    if ("error" in couponResult) { res.status(422).json({ error: couponResult.error }); return; }
    finalPrice = couponResult.finalPrice;
    discountAmount = couponResult.discountAmount;
    appliedCoupon = couponResult.coupon;
  }

  const normalizedVin = vin.toUpperCase();

  const payable = await ensureVinPayableForPayment(userId, normalizedVin);
  if (!payable.ok) {
    if (payable.code === "ALREADY_UNLOCKED") {
      res.status(409).json({ error: "You already have access to this VIN report.", code: "ALREADY_UNLOCKED", alreadyUnlocked: true, lookupId: payable.lookupId ?? null });
      return;
    }
    if (payable.code === "VIN_NO_DATA") {
      res.status(422).json({ error: "No vehicle history data found for this VIN.", code: "VIN_NO_DATA" });
      return;
    }
    res.status(503).json({ error: PUBLIC_VIN_CHECK_UNAVAILABLE, code: "VIN_CHECK_UNAVAILABLE" });
    return;
  }

  if (finalPrice === 0) {
    const free = await createOrReuseFreeCouponPayment({
      userId,
      vin: normalizedVin,
      currency,
      discountAmount,
      appliedCoupon,
    });
    if ("error" in free) {
      res.status(422).json({ error: free.error });
      return;
    }
    res.json({ free: true, paymentId: free.paymentId, vin: normalizedVin });
    return;
  }

  const { clientId, clientSecret, sandbox } = await getPaypalConfig();
  if (!clientId || !clientSecret) {
    res.status(503).json({ error: "Payment system not configured. Contact support." });
    return;
  }

  let reservedCouponId: number | null = null;
  if (appliedCoupon) {
    const reserved = await consumeCouponUse(appliedCoupon.id, appliedCoupon.maxUses);
    if (!reserved) {
      res.status(422).json({ error: "Coupon usage limit reached" });
      return;
    }
    reservedCouponId = appliedCoupon.id;
  }

  try {
    const { token: ppToken, base } = await getPaypalAccessTokenCached(clientId, clientSecret, sandbox);
    const userEmail = user[0]?.email ?? "";
    const reportLabel = vinReportPaymentLabel(normalizedVin);

    const orderResp = await fetch(`${base}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ppToken}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          amount: {
            currency_code: currency,
            // Charge the post-coupon total only. Do not send a PayPal `discount` breakdown —
            // that path is fragile (AMOUNT_MISMATCH) and coupons are already recorded on our payment row.
            value: finalPrice.toFixed(2),
            breakdown: {
              item_total: { currency_code: currency, value: finalPrice.toFixed(2) },
            },
          },
          description: reportLabel,
          items: [{
            name: reportLabel,
            quantity: "1",
            category: "DIGITAL_GOODS",
            unit_amount: { currency_code: currency, value: finalPrice.toFixed(2) },
          }],
          custom_id: `${userId}|${normalizedVin}`,
        }],
        payer: userEmail ? { email_address: userEmail } : undefined,
        application_context: {
          brand_name: "verifykm.com",
          landing_page: "NO_PREFERENCE",
          user_action: "PAY_NOW",
          shipping_preference: "NO_SHIPPING",
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!orderResp.ok) {
      const err = await orderResp.text();
      if (reservedCouponId != null) await releaseCouponUse(reservedCouponId);
      throw new Error(`PayPal order creation failed: ${err.slice(0, 300)}`);
    }

    const order = await orderResp.json() as { id: string };

    await db.insert(paymentsTable).values({
      userId,
      vin: normalizedVin,
      amount: finalPrice,
      currency,
      status: "pending",
      paypalOrderId: order.id,
      couponCode: appliedCoupon?.code ?? null,
      discountAmount: discountAmount > 0 ? discountAmount : null,
    });
    reservedCouponId = null;

    logger.info({ msg: "payment_created", type: "paypal_order", paypalOrderId: order.id, userId, vin: normalizedVin, amount: finalPrice, currency, couponCode: appliedCoupon?.code ?? null });
    res.json({ orderId: order.id, finalPrice, discountAmount, vin: normalizedVin, isFree: false });
  } catch (err) {
    if (reservedCouponId != null) await releaseCouponUse(reservedCouponId);
    logger.error({ err }, "PayPal order creation failed");
    res.status(503).json({ error: "Failed to create payment. Please try again." });
  }
});

// POST /payments/capture-paypal-order
router.post("/payments/capture-paypal-order", paypalCaptureLimiter, requireAuth, async (req, res) => {
  const userId = req.userId!;
  const { orderId } = req.body as { orderId: string };
  if (!orderId || !PAYPAL_ORDER_ID_RE.test(orderId)) {
    res.status(400).json({ error: "Invalid order ID", code: "INVALID_ORDER_ID" });
    return;
  }

  const [payment] = await db.select().from(paymentsTable)
    .where(eq(paymentsTable.paypalOrderId, orderId))
    .limit(1);

  if (!payment || payment.userId !== userId) {
    res.status(404).json({ error: "Payment not found", code: "PAYMENT_NOT_FOUND" });
    return;
  }
  if ((payment.kind ?? "vin_report") === "credit_pack") {
    res.status(400).json({ error: "Use credit-pack capture for this order", code: "WRONG_CAPTURE_ENDPOINT" });
    return;
  }

  if (payment.status === "completed") {
    res.json({ success: true, vin: payment.vin, paymentId: payment.id });
    return;
  }

  const { clientId, clientSecret, sandbox } = await getPaypalConfig();
  if (!clientId || !clientSecret) {
    res.status(503).json({ error: "Payment system not configured. Contact support.", code: "PAYMENT_NOT_CONFIGURED" });
    return;
  }

  try {
    const { token: ppToken, base } = await getPaypalAccessTokenCached(clientId, clientSecret, sandbox);
    const captureResp = await fetch(`${base}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ppToken}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });

    const captureAttempt = await interpretPaypalCaptureResponse(
      captureResp,
      () => fetchPaypalOrderStatus(base, ppToken, orderId),
    );

    if (!captureAttempt.treatedAsCompleted) {
      await db.update(paymentsTable)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(paymentsTable.paypalOrderId, orderId));
      logger.warn({
        msg: "payment_capture_failed",
        orderId,
        userId,
        vin: payment.vin,
        captureStatus: captureAttempt.orderStatus,
      });
      res.status(402).json({
        error: "Payment was not completed. Please try again.",
        code: "PAYMENT_NOT_COMPLETED",
      });
      return;
    }

    let captured = captureAttempt.capturedAmount != null && captureAttempt.capturedCurrency
      ? { amount: captureAttempt.capturedAmount, currency: captureAttempt.capturedCurrency }
      : null;
    if (!captured) {
      captured = await fetchPaypalOrderCaptureAmount(base, ppToken, orderId);
    }
    if (captured && !paypalAmountsMatch(Number(payment.amount), payment.currency, captured)) {
      await db.update(paymentsTable)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(paymentsTable.paypalOrderId, orderId));
      logger.error({
        msg: "payment_capture_amount_mismatch",
        orderId,
        paymentId: payment.id,
        expectedAmount: payment.amount,
        expectedCurrency: payment.currency,
        capturedAmount: captured.amount,
        capturedCurrency: captured.currency,
      });
      res.status(402).json({
        error: "Payment amount verification failed. Please contact support.",
        code: "PAYMENT_AMOUNT_MISMATCH",
      });
      return;
    }

    await db.update(paymentsTable)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(paymentsTable.paypalOrderId, orderId));
    logger.info({
      msg: "payment_captured",
      orderId,
      paymentId: payment.id,
      userId,
      vin: payment.vin,
      amount: payment.amount,
      currency: payment.currency,
    });

    res.json({ success: true, vin: payment.vin, paymentId: payment.id });
  } catch (err) {
    logger.error({ err, orderId }, "PayPal capture failed");

    try {
      const { token: ppToken, base } = await getPaypalAccessTokenCached(clientId, clientSecret, sandbox);
      const orderStatus = await fetchPaypalOrderStatus(base, ppToken, orderId);
      if (orderStatus === "COMPLETED") {
        await db.update(paymentsTable)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(paymentsTable.paypalOrderId, orderId));
        logger.info({ msg: "payment_captured_recovered", orderId, paymentId: payment.id, userId, vin: payment.vin });
        res.json({ success: true, vin: payment.vin, paymentId: payment.id });
        return;
      }
    } catch (recoverErr) {
      logger.error({ recoverErr, orderId }, "PayPal capture recovery check failed");
    }

    const [fresh] = await db.select().from(paymentsTable)
      .where(eq(paymentsTable.paypalOrderId, orderId))
      .limit(1);
    if (fresh?.status === "completed") {
      res.json({ success: true, vin: fresh.vin, paymentId: fresh.id });
      return;
    }

    await db.update(paymentsTable)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(paymentsTable.paypalOrderId, orderId));
    res.status(503).json({
      error: "Failed to capture payment. Please try again.",
      code: "PAYMENT_CAPTURE_FAILED",
    });
  }
});

// GET /payments/history
router.get("/payments/history", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const payments = await db.select().from(paymentsTable)
    .where(recordedTransactionWhere(eq(paymentsTable.userId, userId)))
    .orderBy(desc(paymentsTable.createdAt))
    .limit(50);
  res.json(payments);
});

// POST /payments/create-credit-pack-order — PayPal order for prepaid credits (no VIN)
router.post("/payments/create-credit-pack-order", paypalOrderCreateLimiter, requireAuth, async (req, res) => {
  const userId = req.userId!;
  const { packId } = req.body as { packId?: string };

  if (!isCreditPackId(packId)) {
    res.status(400).json({ error: "Invalid pack. Use pack3 or pack5.", code: "INVALID_PACK" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (user.isBanned) { res.status(403).json({ error: "Account suspended" }); return; }

  const pack = getCreditPack(packId);
  const { clientId, clientSecret, sandbox } = await getPaypalConfig();
  if (!clientId || !clientSecret) {
    res.status(503).json({ error: "Payment system not configured. Contact support." });
    return;
  }

  try {
    const { token: ppToken, base } = await getPaypalAccessTokenCached(clientId, clientSecret, sandbox);
    const userEmail = user.email ?? "";
    const amountValue = pack.totalPrice.toFixed(2);

    const orderResp = await fetch(`${base}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ppToken}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          amount: {
            currency_code: pack.currency,
            value: amountValue,
            breakdown: {
              item_total: { currency_code: pack.currency, value: amountValue },
            },
          },
          description: `VerifyKM credit pack — ${pack.credits} credits`,
          items: [{
            name: `${pack.credits} VIN report credits`,
            quantity: "1",
            unit_amount: { currency_code: pack.currency, value: amountValue },
          }],
          custom_id: `${userId}|credit_pack|${pack.id}`,
        }],
        payer: userEmail ? { email_address: userEmail } : undefined,
        application_context: {
          brand_name: "verifykm.com",
          landing_page: "NO_PREFERENCE",
          user_action: "PAY_NOW",
          shipping_preference: "NO_SHIPPING",
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!orderResp.ok) {
      const err = await orderResp.text();
      throw new Error(`PayPal credit-pack order failed: ${err.slice(0, 300)}`);
    }

    const order = await orderResp.json() as { id: string };

    const [payment] = await db.insert(paymentsTable).values({
      userId,
      vin: null,
      amount: pack.totalPrice,
      currency: pack.currency,
      status: "pending",
      kind: "credit_pack",
      credits: pack.credits,
      paypalOrderId: order.id,
    }).returning();

    logger.info({
      msg: "payment_created",
      type: "credit_pack_order",
      paypalOrderId: order.id,
      paymentId: payment.id,
      userId,
      packId: pack.id,
      credits: pack.credits,
      amount: pack.totalPrice,
    });

    res.json({
      orderId: order.id,
      paymentId: payment.id,
      packId: pack.id,
      credits: pack.credits,
      finalPrice: pack.totalPrice,
      currency: pack.currency,
    });
  } catch (err) {
    logger.error({ err }, "PayPal credit-pack order creation failed");
    res.status(503).json({ error: "Failed to create payment. Please try again." });
  }
});

// POST /payments/capture-credit-pack-order
router.post("/payments/capture-credit-pack-order", paypalCaptureLimiter, requireAuth, async (req, res) => {
  const userId = req.userId!;
  const { orderId } = req.body as { orderId?: string };
  if (!orderId || !PAYPAL_ORDER_ID_RE.test(orderId)) {
    res.status(400).json({ error: "Invalid order ID", code: "INVALID_ORDER_ID" });
    return;
  }

  const [payment] = await db.select().from(paymentsTable)
    .where(eq(paymentsTable.paypalOrderId, orderId))
    .limit(1);

  if (!payment || payment.userId !== userId) {
    res.status(404).json({ error: "Payment not found", code: "PAYMENT_NOT_FOUND" });
    return;
  }
  if (payment.kind !== "credit_pack") {
    res.status(400).json({ error: "Not a credit pack order", code: "WRONG_PAYMENT_KIND" });
    return;
  }

  const credits = Number(payment.credits ?? 0);
  if (credits < 1) {
    res.status(500).json({ error: "Invalid credit pack payment", code: "INVALID_CREDITS" });
    return;
  }

  if (payment.status === "completed") {
    const [user] = await db.select({ creditBalance: usersTable.creditBalance })
      .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    res.json({
      success: true,
      paymentId: payment.id,
      creditsAdded: 0,
      creditBalance: user?.creditBalance ?? 0,
    });
    return;
  }

  const { clientId, clientSecret, sandbox } = await getPaypalConfig();
  if (!clientId || !clientSecret) {
    res.status(503).json({ error: "Payment system not configured. Contact support.", code: "PAYMENT_NOT_CONFIGURED" });
    return;
  }

  const finishCreditPackCapture = async (logMsg: string) => {
    const result = await completeCreditPackPayment(payment.id, userId, credits);
    invalidateAdminStatsCache();
    logger.info({
      msg: logMsg,
      orderId,
      paymentId: payment.id,
      userId,
      creditsAdded: result.creditsAdded,
      creditBalance: result.creditBalance,
      alreadyCompleted: result.alreadyCompleted,
      amount: payment.amount,
    });
    res.json({
      success: true,
      paymentId: payment.id,
      creditsAdded: result.creditsAdded,
      creditBalance: result.creditBalance,
    });
  };

  const verifyPaypalCapturedAmount = async (
    base: string,
    ppToken: string,
  ): Promise<boolean> => {
    const captured = await fetchPaypalOrderCaptureAmount(base, ppToken, orderId);
    if (captured && !paypalAmountsMatch(Number(payment.amount), payment.currency, captured)) {
      await db.update(paymentsTable)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(paymentsTable.paypalOrderId, orderId));
      logger.error({
        msg: "credit_pack_capture_amount_mismatch",
        orderId,
        paymentId: payment.id,
        expectedAmount: payment.amount,
        expectedCurrency: payment.currency,
        capturedAmount: captured.amount,
        capturedCurrency: captured.currency,
      });
      res.status(402).json({
        error: "Payment amount verification failed. Please contact support.",
        code: "PAYMENT_AMOUNT_MISMATCH",
      });
      return false;
    }
    return true;
  };

  try {
    const { token: ppToken, base } = await getPaypalAccessTokenCached(clientId, clientSecret, sandbox);
    const captureResp = await fetch(`${base}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ppToken}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });

    const captureAttempt = await interpretPaypalCaptureResponse(
      captureResp,
      () => fetchPaypalOrderStatus(base, ppToken, orderId),
    );

    if (!captureAttempt.treatedAsCompleted) {
      const orderStatus = await fetchPaypalOrderStatus(base, ppToken, orderId);
      if (orderStatus === "COMPLETED") {
        const amountCheck = await verifyPaypalCapturedAmount(base, ppToken);
        if (!amountCheck) return;
        await finishCreditPackCapture("credit_pack_captured_recovered");
        return;
      }
      await db.update(paymentsTable)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(paymentsTable.paypalOrderId, orderId));
      logger.warn({
        msg: "credit_pack_capture_failed",
        orderId,
        userId,
        captureStatus: captureAttempt.orderStatus,
      });
      res.status(402).json({
        error: "Payment was not completed. Please try again.",
        code: "PAYMENT_NOT_COMPLETED",
      });
      return;
    }

    let captured = captureAttempt.capturedAmount != null && captureAttempt.capturedCurrency
      ? { amount: captureAttempt.capturedAmount, currency: captureAttempt.capturedCurrency }
      : null;
    if (!captured) {
      captured = await fetchPaypalOrderCaptureAmount(base, ppToken, orderId);
    }
    if (captured && !paypalAmountsMatch(Number(payment.amount), payment.currency, captured)) {
      await db.update(paymentsTable)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(paymentsTable.paypalOrderId, orderId));
      logger.error({
        msg: "credit_pack_capture_amount_mismatch",
        orderId,
        paymentId: payment.id,
        expectedAmount: payment.amount,
        expectedCurrency: payment.currency,
        capturedAmount: captured.amount,
        capturedCurrency: captured.currency,
      });
      res.status(402).json({
        error: "Payment amount verification failed. Please contact support.",
        code: "PAYMENT_AMOUNT_MISMATCH",
      });
      return;
    }

    await finishCreditPackCapture("credit_pack_captured");
  } catch (err) {
    logger.error({ err, orderId }, "PayPal credit-pack capture failed");

    try {
      const { token: ppToken, base } = await getPaypalAccessTokenCached(clientId, clientSecret, sandbox);
      const orderStatus = await fetchPaypalOrderStatus(base, ppToken, orderId);
      if (orderStatus === "COMPLETED") {
        const amountCheck = await verifyPaypalCapturedAmount(base, ppToken);
        if (!amountCheck) return;
        await finishCreditPackCapture("credit_pack_captured_recovered");
        return;
      }
    } catch (recoverErr) {
      logger.error({ recoverErr, orderId }, "PayPal credit-pack capture recovery failed");
    }

    const [fresh] = await db.select().from(paymentsTable)
      .where(eq(paymentsTable.paypalOrderId, orderId))
      .limit(1);
    if (fresh?.status === "completed") {
      const [user] = await db.select({ creditBalance: usersTable.creditBalance })
        .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      res.json({
        success: true,
        paymentId: fresh.id,
        creditsAdded: 0,
        creditBalance: user?.creditBalance ?? 0,
      });
      return;
    }

    await db.update(paymentsTable)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(paymentsTable.paypalOrderId, orderId));
    res.status(503).json({
      error: "Failed to capture payment. Please try again.",
      code: "PAYMENT_CAPTURE_FAILED",
    });
  }
});

// POST /payments/redeem-credit — spend 1 credit to unlock a VIN (then client calls POST /vin/lookup)
router.post("/payments/redeem-credit", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const { vin } = req.body as { vin?: string };
  const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/i;
  if (!vin || !VIN_RE.test(vin)) {
    res.status(400).json({ error: "Invalid VIN — must be 17 alphanumeric characters (no I, O, or Q)" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (user.isBanned) { res.status(403).json({ error: "Account suspended" }); return; }
  if (await rejectVinLookupIfDisabled(req, res)) return;

  const normalizedVin = vin.toUpperCase();
  const payable = await ensureVinPayableForPayment(userId, normalizedVin);
  if (!payable.ok) {
    if (payable.code === "ALREADY_UNLOCKED") {
      res.status(409).json({
        error: "You already have access to this VIN report.",
        code: "ALREADY_UNLOCKED",
        alreadyUnlocked: true,
        lookupId: payable.lookupId ?? null,
      });
      return;
    }
    if (payable.code === "VIN_NO_DATA") {
      res.status(422).json({ error: "No vehicle history data found for this VIN.", code: "VIN_NO_DATA" });
      return;
    }
    res.status(503).json({ error: PUBLIC_VIN_CHECK_UNAVAILABLE, code: "VIN_CHECK_UNAVAILABLE" });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ creditBalance: usersTable.creditBalance })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);

      if (!locked || locked.creditBalance < 1) {
        return { insufficient: true as const };
      }

      const [updatedUser] = await tx
        .update(usersTable)
        .set({
          creditBalance: sql`${usersTable.creditBalance} - 1`,
          updatedAt: new Date(),
        })
        .where(and(eq(usersTable.id, userId), sql`${usersTable.creditBalance} >= 1`))
        .returning({ creditBalance: usersTable.creditBalance });

      if (!updatedUser) {
        return { insufficient: true as const };
      }

      const [payment] = await tx.insert(paymentsTable).values({
        userId,
        vin: normalizedVin,
        amount: 0,
        currency: "EUR",
        status: "completed",
        kind: "credit_redemption",
        credits: 1,
      }).returning();

      return {
        insufficient: false as const,
        paymentId: payment.id,
        creditBalance: updatedUser.creditBalance,
      };
    });

    if (result.insufficient) {
      res.status(402).json({
        error: "Not enough credits. Purchase a credit pack or pay with PayPal.",
        code: "INSUFFICIENT_CREDITS",
      });
      return;
    }

    logger.info({
      msg: "credit_redeemed",
      paymentId: result.paymentId,
      userId,
      vin: normalizedVin,
      creditBalance: result.creditBalance,
    });

    res.json({
      paymentId: result.paymentId,
      creditBalance: result.creditBalance,
      vin: normalizedVin,
    });
  } catch (err) {
    logger.error({ err, userId, vin: normalizedVin }, "credit redeem failed");
    res.status(500).json({ error: "Failed to redeem credit. Please try again." });
  }
});

// ── POK Payments (credit card) ────────────────────────────────────────────────

// POST /payments/create-pok-order — VIN report card checkout
router.post("/payments/create-pok-order", pokOrderCreateLimiter, requireAuth, async (req, res) => {
  const userId = req.userId!;
  let reservedCouponId: number | null = null;
  let normalizedVin = "";
  let couponCodeLog: string | null = null;
  let finalPriceLog: number | null = null;
  let currencyLog = "EUR";
  let responded = false;

  const sendJson = (status: number, body: Record<string, unknown>) => {
    if (responded || res.headersSent) return;
    responded = true;
    res.status(status).json(body);
  };

  // Answer with JSON before Cloudflare gives up. Use 503 (not 502): CF replaces origin 502
  // bodies with its HTML error page, which breaks the checkout client's JSON parsing.
  const watchdog = setTimeout(() => {
    logger.error({
      msg: "create_pok_watchdog",
      userId,
      vin: normalizedVin || null,
      couponCode: couponCodeLog,
    }, "POK create-pok-order watchdog fired");
    sendJson(503, {
      error: "Failed to create card payment. Please try again.",
      code: "POK_CREATE_TIMEOUT",
    });
  }, 12_000);

  try {
    const { vin, couponCode, recaptchaToken } = req.body as {
      vin: string; couponCode?: string; recaptchaToken?: string;
    };

    const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/i;
    if (!vin || !VIN_RE.test(vin)) {
      sendJson(400, { error: "Invalid VIN — must be 17 alphanumeric characters (no I, O, or Q)" });
      return;
    }

    const COUPON_RE = /^[A-Z0-9_-]{1,50}$/i;
    if (couponCode?.trim() && !COUPON_RE.test(couponCode.trim())) {
      sendJson(400, { error: "Invalid coupon code format" });
      return;
    }

    normalizedVin = vin.toUpperCase();
    if (couponCode?.trim()) couponCodeLog = couponCode.trim().toUpperCase();

    logger.info({
      msg: "create_pok_begin",
      userId,
      vin: normalizedVin,
      couponCode: couponCodeLog,
    });

    const userPromise = db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const pricingPromise = getActivePricing();
    const pokConfigPromise = resolvePokConfig();

    const [userRows, pricing, pokConfig] = await Promise.all([
      userPromise,
      pricingPromise,
      pokConfigPromise,
    ]);

    if (userRows[0]?.isBanned) { sendJson(403, { error: "Account suspended" }); return; }
    if (await rejectVinLookupIfDisabled(req, res)) { responded = true; return; }

    void recaptchaToken;

    const basePrice = Number(pricing.discountEnabled ? pricing.discountPrice : pricing.basePrice);
    const currency = String(pricing.currency || "EUR").trim() || "EUR";
    currencyLog = currency;

    let finalPrice = basePrice;
    let discountAmount = 0;
    let appliedCoupon: typeof couponsTable.$inferSelect | null = null;

    if (couponCodeLog) {
      const couponResult = await resolveCoupon(couponCodeLog, basePrice);
      if ("error" in couponResult) { sendJson(422, { error: couponResult.error }); return; }
      finalPrice = couponResult.finalPrice;
      discountAmount = couponResult.discountAmount;
      appliedCoupon = couponResult.coupon;
    }
    finalPriceLog = finalPrice;

    // Free coupons: same zero-amount unlock as PayPal — do not create a POK order.
    if (finalPrice === 0) {
      const free = await createOrReuseFreeCouponPayment({
        userId,
        vin: normalizedVin,
        currency,
        discountAmount,
        appliedCoupon,
      });
      if ("error" in free) {
        sendJson(422, { error: free.error });
        return;
      }
      sendJson(200, { free: true, paymentId: Number(free.paymentId), vin: normalizedVin });
      return;
    }

    const chargeAmount = Number(Number(finalPrice).toFixed(2));
    if (!(Number.isFinite(chargeAmount) && chargeAmount > 0)) {
      sendJson(422, { error: "Invalid discounted price for card payment", code: "INVALID_AMOUNT" });
      return;
    }

    if (!pokConfig) {
      sendJson(503, { error: "Card payment is not configured. Contact support.", code: "POK_NOT_CONFIGURED" });
      return;
    }

    // Reuse recent pending POK payment BEFORE provider checks — recovers CF 502 retries fast.
    const reuseAfter = new Date(Date.now() - 25 * 60_000);
    const couponClause = appliedCoupon
      ? eq(paymentsTable.couponCode, appliedCoupon.code)
      : isNull(paymentsTable.couponCode);
    const [existingPending] = await db.select({
      id: paymentsTable.id,
      pokOrderId: paymentsTable.pokOrderId,
    })
      .from(paymentsTable)
      .where(and(
        eq(paymentsTable.userId, userId),
        eq(paymentsTable.vin, normalizedVin),
        eq(paymentsTable.status, "pending"),
        eq(paymentsTable.kind, "vin_report"),
        eq(paymentsTable.amount, chargeAmount),
        isNotNull(paymentsTable.pokOrderId),
        gte(paymentsTable.createdAt, reuseAfter),
        couponClause,
      ))
      .orderBy(desc(paymentsTable.id))
      .limit(1);

    if (existingPending?.pokOrderId && POK_ORDER_ID_RE.test(existingPending.pokOrderId)) {
      logger.info({
        msg: "payment_reused",
        type: "pok_order",
        pokOrderId: existingPending.pokOrderId,
        paymentId: existingPending.id,
        userId,
        vin: normalizedVin,
        couponCode: appliedCoupon?.code ?? null,
      });
      sendJson(200, {
        orderId: existingPending.pokOrderId,
        paymentId: Number(existingPending.id),
        finalPrice: chargeAmount,
        discountAmount,
        vin: normalizedVin,
        currency,
        pokEnv: pokConfig.env,
        reused: true,
      });
      return;
    }

    const payable = await ensureVinPayableForPayment(userId, normalizedVin);
    if (responded) return;
    if (!payable.ok) {
      if (payable.code === "ALREADY_UNLOCKED") {
        sendJson(409, {
          error: "You already have access to this VIN report.",
          code: "ALREADY_UNLOCKED",
          alreadyUnlocked: true,
          lookupId: payable.lookupId ?? null,
        });
        return;
      }
      if (payable.code === "VIN_NO_DATA") {
        sendJson(422, { error: "No vehicle history data found for this VIN.", code: "VIN_NO_DATA" });
        return;
      }
      sendJson(503, { error: PUBLIC_VIN_CHECK_UNAVAILABLE, code: "VIN_CHECK_UNAVAILABLE" });
      return;
    }

    // Create POK order first (network). Reserve coupon only after success so we don't
    // hold a coupon row lock during the external HTTP call.
    const order = await createPokSdkOrder({
      amount: chargeAmount,
      currencyCode: currency,
      description: vinReportPaymentLabel(normalizedVin),
      merchantCustomReference: `vin|${userId}|${normalizedVin}|${Date.now()}`,
      config: pokConfig,
      webhookUrl: (await resolvePokWebhookUrl()) ?? undefined,
    });
    if (responded) return;

    if (appliedCoupon) {
      const reserved = await consumeCouponUse(appliedCoupon.id, appliedCoupon.maxUses);
      if (!reserved) {
        logger.warn({
          msg: "coupon_consume_race_after_pok",
          couponId: appliedCoupon.id,
          pokOrderId: order.id,
          userId,
        });
      } else {
        reservedCouponId = appliedCoupon.id;
      }
    }

    const [payment] = await db.insert(paymentsTable).values({
      userId,
      vin: normalizedVin,
      amount: chargeAmount,
      currency,
      status: "pending",
      kind: "vin_report",
      pokOrderId: order.id,
      couponCode: appliedCoupon?.code ?? null,
      discountAmount: discountAmount > 0 ? discountAmount : null,
    }).returning();
    reservedCouponId = null;

    const paymentId = Number(payment.id);
    logger.info({
      msg: "payment_created",
      type: "pok_order",
      pokOrderId: order.id,
      paymentId,
      userId,
      vin: normalizedVin,
      amount: chargeAmount,
      currency,
      couponCode: appliedCoupon?.code ?? null,
    });

    sendJson(200, {
      orderId: order.id,
      paymentId,
      finalPrice: chargeAmount,
      discountAmount,
      vin: normalizedVin,
      currency,
      pokEnv: pokConfig.env,
    });
  } catch (err) {
    if (reservedCouponId != null) {
      try { await releaseCouponUse(reservedCouponId); } catch { /* best-effort */ }
    }
    const errMessage = err instanceof Error ? err.message : String(err);
    logger.error({
      errMessage,
      errName: err instanceof Error ? err.name : undefined,
      userId,
      vin: normalizedVin || null,
      couponCode: couponCodeLog,
      finalPrice: finalPriceLog,
      currency: currencyLog,
    }, "POK order creation failed");
    sendJson(503, {
      error: "Failed to create card payment. Please try again.",
      code: "POK_CREATE_FAILED",
    });
  } finally {
    clearTimeout(watchdog);
  }
});

// POST /payments/webhook/pok — POK server notification (optional; always re-verifies via POK API)
router.post("/payments/webhook/pok", pokWebhookLimiter, (req, res) => {
  void handlePokWebhook(req, res);
});

// POST /payments/confirm-pok-order — after GuestCheckoutForm onSuccess
router.post("/payments/confirm-pok-order", pokConfirmLimiter, requireAuth, async (req, res) => {
  const userId = req.userId!;
  const { orderId } = req.body as { orderId?: string };
  if (!orderId || !POK_ORDER_ID_RE.test(orderId)) {
    res.status(400).json({ error: "Invalid order ID", code: "INVALID_ORDER_ID" });
    return;
  }

  const result = await confirmPokPaymentByOrderId(orderId, {
    userId,
    source: "client",
    expectedKind: "vin_report",
  });

  if (result.ok) {
    res.json({
      success: true,
      vin: result.payment.vin,
      paymentId: result.payment.id,
      alreadyCompleted: result.alreadyCompleted,
      retryable: false,
    });
    return;
  }

  if (result.code === "WRONG_PAYMENT_KIND") {
    res.status(400).json({ error: "Use credit-pack confirm for this order", code: "WRONG_CONFIRM_ENDPOINT" });
    return;
  }

  res.status(result.httpStatus).json({
    error: result.error,
    code: result.code,
    retryable: result.retryable,
  });
});

// POST /payments/create-pok-credit-pack-order
router.post("/payments/create-pok-credit-pack-order", pokOrderCreateLimiter, requireAuth, async (req, res) => {
  const userId = req.userId!;
  const { packId } = req.body as { packId?: string };

  if (!isCreditPackId(packId)) {
    res.status(400).json({ error: "Invalid pack. Use pack3 or pack5.", code: "INVALID_PACK" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (user.isBanned) { res.status(403).json({ error: "Account suspended" }); return; }

  if (!(await resolvePokConfig())) {
    res.status(503).json({ error: "Card payment is not configured. Contact support.", code: "POK_NOT_CONFIGURED" });
    return;
  }

  const pack = getCreditPack(packId);

  try {
    const order = await createPokSdkOrder({
      amount: Number(pack.totalPrice.toFixed(2)),
      currencyCode: pack.currency,
      description: `VerifyKM credit pack — ${pack.credits} credits`,
      merchantCustomReference: `pack|${userId}|${pack.id}|${Date.now()}`,
      webhookUrl: (await resolvePokWebhookUrl()) ?? undefined,
    });

    const [payment] = await db.insert(paymentsTable).values({
      userId,
      vin: null,
      amount: pack.totalPrice,
      currency: pack.currency,
      status: "pending",
      kind: "credit_pack",
      credits: pack.credits,
      pokOrderId: order.id,
    }).returning();

    logger.info({
      msg: "payment_created",
      type: "pok_credit_pack_order",
      pokOrderId: order.id,
      paymentId: payment.id,
      userId,
      packId: pack.id,
      credits: pack.credits,
      amount: pack.totalPrice,
    });

    res.json({
      orderId: order.id,
      paymentId: payment.id,
      packId: pack.id,
      credits: pack.credits,
      finalPrice: pack.totalPrice,
      currency: pack.currency,
      pokEnv: (await resolvePokConfig())?.env ?? getPokEnv(),
    });
  } catch (err) {
    logger.error({ err }, "POK credit-pack order creation failed");
    res.status(503).json({ error: "Failed to create card payment. Please try again." });
  }
});

// POST /payments/confirm-pok-credit-pack-order
router.post("/payments/confirm-pok-credit-pack-order", pokConfirmLimiter, requireAuth, async (req, res) => {
  const userId = req.userId!;
  const { orderId } = req.body as { orderId?: string };
  if (!orderId || !POK_ORDER_ID_RE.test(orderId)) {
    res.status(400).json({ error: "Invalid order ID", code: "INVALID_ORDER_ID" });
    return;
  }

  const result = await confirmPokPaymentByOrderId(orderId, {
    userId,
    source: "client",
    expectedKind: "credit_pack",
  });

  if (result.ok) {
    res.json({
      success: true,
      paymentId: result.payment.id,
      creditsAdded: result.creditsAdded ?? 0,
      creditBalance: result.creditBalance ?? 0,
      alreadyCompleted: result.alreadyCompleted,
      retryable: false,
    });
    return;
  }

  res.status(result.httpStatus).json({
    error: result.error,
    code: result.code,
    retryable: result.retryable,
  });
});

export default router;
