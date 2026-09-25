import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

function envRateMax(name: string, prodDefault: number, devDefault: number): number {
  const raw = process.env[name];
  if (raw !== undefined && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return process.env.NODE_ENV === "production" ? prodDefault : devDefault;
}

/** Per-user when authenticated, else per-IP — never skipped for trusted clients. */
export function userOrIpKey(req: Request): string {
  if (req.userId) return `u:${req.userId}`;
  const raw = (String(req.headers["x-forwarded-for"] ?? "")).split(",")[0]?.trim()
    || req.socket.remoteAddress
    || "unknown";
  return raw === "unknown" ? raw : `ip:${ipKeyGenerator(raw)}`;
}

/** Pre-checkout VIN peek — calls local-exists when catalog is cold. */
export const vinPeekLimiter = rateLimit({
  windowMs: 60_000,
  max: envRateMax("VIN_PEEK_RATE_MAX", 25, 40),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many VIN preview requests. Please wait a moment." },
  keyGenerator: userOrIpKey,
});

/** PayPal order creation — each call may hit local-exists. */
export const paypalOrderCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.PAYPAL_ORDER_RATE_MAX ?? 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many checkout attempts. Please wait before trying again." },
  keyGenerator: userOrIpKey,
});

/** PayPal capture — defense in depth. */
export const paypalCaptureLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.PAYPAL_CAPTURE_RATE_MAX ?? 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many payment confirmations. Please wait before trying again." },
  keyGenerator: userOrIpKey,
});

/** POK SDK order creation — may hit local-exists (VIN) or pack pricing. */
export const pokOrderCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.POK_ORDER_RATE_MAX ?? 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many checkout attempts. Please wait before trying again." },
  keyGenerator: userOrIpKey,
});

/** POK confirm — after GuestCheckoutForm onSuccess. */
export const pokConfirmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.POK_CONFIRM_RATE_MAX ?? 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many payment confirmations. Please wait before trying again." },
  keyGenerator: userOrIpKey,
});

/** POK inbound webhooks — per IP, generous for provider retries. */
export const pokWebhookLimiter = rateLimit({
  windowMs: 60_000,
  max: Number(process.env.POK_WEBHOOK_RATE_MAX ?? 120),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many webhook requests." },
  keyGenerator: (req) => {
    const raw = (String(req.headers["x-forwarded-for"] ?? "")).split(",")[0]?.trim()
      || req.socket.remoteAddress
      || "unknown";
    return raw === "unknown" ? raw : `ip:${ipKeyGenerator(raw)}`;
  },
});

/** Post-payment lookup — provider path is async but still bounded per user. */
export const vinLookupUserLimiter = rateLimit({
  windowMs: 60_000,
  max: envRateMax("VIN_LOOKUP_USER_RATE_MAX", 12, 15),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many report requests. Please wait before trying again." },
  keyGenerator: userOrIpKey,
});

/** OAuth initiation — redirect spam guard. */
export const oauthInitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.OAUTH_INIT_RATE_MAX ?? 40),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Please wait and try again." },
  keyGenerator: (req) => {
    const raw = (String(req.headers["x-forwarded-for"] ?? "")).split(",")[0]?.trim()
      || req.socket.remoteAddress
      || "unknown";
    return raw === "unknown" ? raw : ipKeyGenerator(raw);
  },
});

/** Signed-in presence heartbeat — per authenticated user; DB writes throttled ~60s. */
export const presenceHeartbeatLimiter = rateLimit({
  windowMs: 60_000,
  max: envRateMax("PRESENCE_HEARTBEAT_RATE_MAX", 6, 12),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: true },
  keyGenerator: userOrIpKey,
  validate: { ip: false },
  handler: (_req, res) => {
    // Soft-limit: do not tip off scanners with 429; no DB write happens after this.
    res.status(200).json({ ok: true });
  },
});

/** Client-area VIN history paging — small payloads, but capped against click/script spam. */
export const userHistoryLimiter = rateLimit({
  windowMs: 60_000,
  max: envRateMax("USER_HISTORY_RATE_MAX", 60, 120),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many history requests. Please wait a moment." },
  keyGenerator: userOrIpKey,
  validate: { ip: false },
});
