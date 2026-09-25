import crypto from "crypto";
import type { Request, Response } from "express";

/** Durable browser identity cookie — survives logout; cleared only by the user. */
export const DEVICE_COOKIE_NAME = "km_did";

const DEVICE_COOKIE_MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function hashDeviceId(rawDeviceId: string): string {
  return crypto.createHash("sha256").update(rawDeviceId.trim().toLowerCase()).digest("hex");
}

export function normalizeDeviceCookieValue(raw: string | undefined | null): string | null {
  const v = String(raw ?? "").trim();
  if (!UUID_RE.test(v)) return null;
  return v.toLowerCase();
}

/** Read cookie or mint a new UUID; always re-set the cookie so max-age slides. */
export function ensureDeviceId(req: Request, res: Response): { deviceId: string; deviceHash: string } {
  const existing = normalizeDeviceCookieValue(req.cookies?.[DEVICE_COOKIE_NAME]);
  const deviceId = existing ?? crypto.randomUUID();
  setDeviceCookie(res, deviceId);
  return { deviceId, deviceHash: hashDeviceId(deviceId) };
}

export function resolveDeviceHashFromRequest(req: Request): string | null {
  const id = normalizeDeviceCookieValue(req.cookies?.[DEVICE_COOKIE_NAME]);
  return id ? hashDeviceId(id) : null;
}

export function setDeviceCookie(res: Response, deviceId: string): void {
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie(DEVICE_COOKIE_NAME, deviceId, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_COOKIE_MAX_AGE_MS,
  });
}

export function truncateUserAgent(ua: string | undefined, max = 240): string | null {
  const trimmed = String(ua ?? "").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}
