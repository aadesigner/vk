import rateLimit from "express-rate-limit";
import { clientIpKey, shouldSkipPublicRateLimit } from "./trustedClient.js";

const windowMs = Number(process.env.PUBLIC_RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000);
const defaultMax = process.env.NODE_ENV === "production" ? 30 : 40;
const max = Number(process.env.PUBLIC_RATE_LIMIT_MAX ?? defaultMax);

/**
 * Strict rate limit for direct / untrusted API access (curl, scrapers, spoofed clients).
 * Requests from the verifykm web app are skipped entirely.
 */
export const publicAbuseLimiter = rateLimit({
  windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 15 * 60 * 1000,
  max: Number.isFinite(max) && max > 0 ? max : defaultMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please use the website or try again later." },
  keyGenerator: clientIpKey,
  skip: (req) => shouldSkipPublicRateLimit(req) || req.isAdmin === true,
});
