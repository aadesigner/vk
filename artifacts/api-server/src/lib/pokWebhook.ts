/**
 * Inbound POK webhook — triggers server-side confirm after card/3DS completes.
 * Always re-verifies with POK API; never trusts the webhook body alone.
 */
import crypto from "node:crypto";
import type { Request, Response } from "express";
import { logger } from "./logger.js";
import {
  extractPokOrderIdFromWebhook,
  POK_ORDER_ID_RE,
  resolvePokConfig,
  resolvePokWebhookSecret,
} from "./pokClient.js";
import { confirmPokPaymentByOrderId } from "./pokPaymentConfirm.js";

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Optional shared secret — set POK_WEBHOOK_SECRET in production. */
export function verifyPokWebhookAuth(req: Request, secret: string | null): boolean {
  if (!secret) {
    // No secret configured — rely on UUID order ids + POK API re-verification.
    return true;
  }

  const headerSecret =
    (typeof req.headers["x-pok-webhook-secret"] === "string" ? req.headers["x-pok-webhook-secret"] : null)
    ?? (typeof req.headers["x-webhook-secret"] === "string" ? req.headers["x-webhook-secret"] : null);

  if (headerSecret && timingSafeEqual(headerSecret, secret)) return true;

  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    const token = auth.slice("Bearer ".length).trim();
    if (token && timingSafeEqual(token, secret)) return true;
  }

  const q = req.query.secret;
  if (typeof q === "string" && q && timingSafeEqual(q, secret)) return true;

  return false;
}

export async function handlePokWebhook(req: Request, res: Response): Promise<void> {
  const pokConfig = await resolvePokConfig();
  const secret = resolvePokWebhookSecret(pokConfig);
  if (!verifyPokWebhookAuth(req, secret)) {
    logger.warn({ msg: "pok_webhook_auth_failed", ip: req.ip });
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const orderId = extractPokOrderIdFromWebhook(req.body);
  if (!orderId || !POK_ORDER_ID_RE.test(orderId)) {
    logger.warn({ msg: "pok_webhook_invalid_payload" });
    res.status(400).json({ error: "Invalid webhook payload" });
    return;
  }

  logger.info({ msg: "pok_webhook_received", orderId });

  const result = await confirmPokPaymentByOrderId(orderId, { source: "webhook" });

  if (result.ok) {
    res.status(200).json({
      ok: true,
      paymentId: result.payment.id,
      alreadyCompleted: result.alreadyCompleted,
    });
    return;
  }

  if (result.code === "PAYMENT_NOT_FOUND") {
    // Unknown order — return 200 so POK does not retry forever on foreign orders.
    res.status(200).json({ ok: false, ignored: true });
    return;
  }

  if (result.retryable) {
    // Tell POK to retry later (order may still be settling).
    res.status(503).json({ ok: false, code: result.code });
    return;
  }

  res.status(200).json({ ok: false, code: result.code });
}
