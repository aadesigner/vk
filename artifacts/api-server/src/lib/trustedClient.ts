import crypto from "crypto";
import type { Request } from "express";
import { ipKeyGenerator } from "express-rate-limit";
import { getAllowedOrigins, isAllowedOrigin } from "./allowedOrigins.js";

export const GUARD_HEADER = "x-verifykm-client";

/** Routes that cannot send a custom client header (OAuth redirects, health probes, signed image proxy). */
const EXEMPT_PREFIXES = [
  "/healthz",
  "/auth/google",
  "/auth/facebook",
  "/vin/image",
  "/payments/webhook/pok",
];

export function isExemptApiPath(path: string): boolean {
  return EXEMPT_PREFIXES.some(p => path === p || path.startsWith(`${p}/`));
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function originAllowed(origin: string, _allowed: string[]): boolean {
  return isAllowedOrigin(origin);
}

function refererAllowed(referer: string, _allowed: string[]): boolean {
  try {
    const refOrigin = new URL(referer).origin;
    return isAllowedOrigin(refOrigin);
  } catch {
    return false;
  }
}

function isTrustedBrowserContext(req: Request, allowed: string[]): boolean {
  const secFetchSite = req.headers["sec-fetch-site"];
  if (secFetchSite !== "same-origin" && secFetchSite !== "same-site") return false;

  const host = req.headers.host;
  if (!host) return false;

  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = (typeof forwardedProto === "string" ? forwardedProto.split(",")[0] : forwardedProto)
    ?? (req.secure ? "https" : "http");
  const requestOrigin = `${proto}://${host}`.replace(/\/+$/, "");

  if (isAllowedOrigin(requestOrigin)) return true;

  return allowed.some(o => {
    try {
      return new URL(o).host === new URL(requestOrigin).host;
    } catch {
      return false;
    }
  });
}

function hasValidClientToken(req: Request, expected: string): boolean {
  const provided = req.headers[GUARD_HEADER];
  if (typeof provided !== "string" || !provided) return false;
  return timingSafeEqual(provided, expected);
}

function isBrowserLikeRequest(req: Request, allowed: string[]): boolean {
  const origin = req.headers.origin;
  if (typeof origin === "string" && originAllowed(origin, allowed)) return true;

  const referer = req.headers.referer;
  if (typeof referer === "string" && refererAllowed(referer, allowed)) return true;

  return isTrustedBrowserContext(req, allowed);
}

function isClientGuardEnforced(): boolean {
  const token = process.env.CLIENT_GUARD_TOKEN?.trim();
  if (!token) return false;
  if (process.env.NODE_ENV === "production") return true;
  return process.env.CLIENT_GUARD_ENFORCE === "true";
}

/** True when the request comes from our web app (client token or trusted browser context). */
export function isTrustedApiRequest(req: Request): boolean {
  const token = process.env.CLIENT_GUARD_TOKEN?.trim();
  if (token && hasValidClientToken(req, token)) return true;
  if (isClientGuardEnforced()) return false;
  return isBrowserLikeRequest(req, getAllowedOrigins());
}

export function shouldSkipPublicRateLimit(req: Request): boolean {
  if (req.method === "OPTIONS") return true;
  if (isExemptApiPath(req.path)) return true;
  return isTrustedApiRequest(req);
}

export function clientIpKey(req: Request): string {
  const raw = (String(req.headers["x-forwarded-for"] ?? "")).split(",")[0]?.trim()
    || req.socket.remoteAddress
    || "unknown";
  return raw === "unknown" ? raw : ipKeyGenerator(raw);
}
