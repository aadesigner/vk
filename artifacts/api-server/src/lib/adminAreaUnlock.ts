import type { Request, Response } from "express";
import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { and, count, eq, gte } from "drizzle-orm";
import { db, loginAttemptsTable } from "@workspace/db";
import { addIpBlock } from "./accessBlocks.js";
import { clientIpKey } from "./trustedClient.js";
import { getSettings } from "./settingsCache.js";
import { logger } from "./logger.js";

export const ADMIN_UNLOCK_COOKIE = "km_admin_unlock";
export const ADMIN_PIN_CONTEXT = "admin_pin";
export const ADMIN_UNLOCK_DAYS = 7;
const PIN_BLOCK_HOURS = 24;

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET environment variable is required in production");
    }
    return new TextEncoder().encode("dev-insecure-secret-change-in-production");
  }
  return new TextEncoder().encode(secret);
}

export function getAdminAreaPin(): string | null {
  const pin = process.env.ADMIN_AREA_PIN?.trim();
  return pin || null;
}

export function isAdminAreaPinEnabled(): boolean {
  return Boolean(getAdminAreaPin());
}

function hashPin(value: string): Buffer {
  return crypto.createHash("sha256").update(value, "utf8").digest();
}

export function verifyAdminAreaPin(input: string): boolean {
  const expected = getAdminAreaPin();
  if (!expected) return true;
  const a = hashPin(input);
  const b = hashPin(expected);
  return crypto.timingSafeEqual(a, b);
}

export async function signAdminUnlockToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, typ: "admin_unlock" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_UNLOCK_DAYS}d`)
    .sign(getJwtSecret());
}

export async function verifyAdminUnlockToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (payload.typ !== "admin_unlock") return null;
    const sub = payload.sub;
    return typeof sub === "string" && sub ? sub : null;
  } catch {
    return null;
  }
}

export function setAdminUnlockCookie(res: Response, token: string): void {
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie(ADMIN_UNLOCK_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_UNLOCK_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearAdminUnlockCookie(res: Response): void {
  const isProduction = process.env.NODE_ENV === "production";
  res.clearCookie(ADMIN_UNLOCK_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/",
  });
}

export async function hasValidAdminUnlock(req: Request, userId: string): Promise<boolean> {
  if (!isAdminAreaPinEnabled()) return true;
  const token: string | undefined = req.cookies?.[ADMIN_UNLOCK_COOKIE];
  if (!token) return false;
  const sub = await verifyAdminUnlockToken(token);
  return sub === userId;
}

async function lockoutMinutes(): Promise<number> {
  const settings = await getSettings();
  return settings.adminLockoutMinutes ?? 30;
}

async function maxFailedAttempts(): Promise<number> {
  const settings = await getSettings();
  return settings.adminMaxFailedLogins ?? 3;
}

export async function isAdminPinLockedOut(userId: string, ip: string): Promise<boolean> {
  const mins = await lockoutMinutes();
  const maxFails = await maxFailedAttempts();
  const since = new Date(Date.now() - mins * 60 * 1000);
  const [{ failCount }] = await db
    .select({ failCount: count() })
    .from(loginAttemptsTable)
    .where(and(
      eq(loginAttemptsTable.email, userId),
      eq(loginAttemptsTable.ip, ip),
      eq(loginAttemptsTable.context, ADMIN_PIN_CONTEXT),
      gte(loginAttemptsTable.attemptedAt, since),
    ));
  return Number(failCount ?? 0) >= maxFails;
}

async function recordAdminPinFailure(userId: string, ip: string): Promise<number> {
  await db.insert(loginAttemptsTable).values({
    email: userId,
    ip,
    context: ADMIN_PIN_CONTEXT,
  });

  const mins = await lockoutMinutes();
  const maxFails = await maxFailedAttempts();
  const since = new Date(Date.now() - mins * 60 * 1000);
  const [{ failCount }] = await db
    .select({ failCount: count() })
    .from(loginAttemptsTable)
    .where(and(
      eq(loginAttemptsTable.email, userId),
      eq(loginAttemptsTable.ip, ip),
      eq(loginAttemptsTable.context, ADMIN_PIN_CONTEXT),
      gte(loginAttemptsTable.attemptedAt, since),
    ));
  const fails = Number(failCount ?? 0);

  if (fails >= maxFails && ip !== "unknown") {
    const expiresAt = new Date(Date.now() + PIN_BLOCK_HOURS * 60 * 60 * 1000);
    await addIpBlock({
      ip,
      reason: `Admin PIN lockout (${fails} failed attempts)`,
      source: "admin_pin_lockout",
      userId,
      expiresAt,
    }).catch((err) => {
      logger.warn({ err, ip, userId }, "admin_pin_ip_block_failed");
    });
  }

  return fails;
}

async function clearAdminPinFailures(userId: string, ip: string): Promise<void> {
  await db.delete(loginAttemptsTable).where(and(
    eq(loginAttemptsTable.email, userId),
    eq(loginAttemptsTable.ip, ip),
    eq(loginAttemptsTable.context, ADMIN_PIN_CONTEXT),
  ));
}

export type AdminPinAttemptResult =
  | { ok: true; token: string }
  | { ok: false; code: "locked_out"; retryAfterMinutes: number }
  | { ok: false; code: "invalid_pin"; attemptsRemaining: number };

export async function attemptAdminAreaUnlock(
  userId: string,
  ip: string,
  pin: string,
): Promise<AdminPinAttemptResult> {
  if (!isAdminAreaPinEnabled()) {
    const token = await signAdminUnlockToken(userId);
    return { ok: true, token };
  }

  if (await isAdminPinLockedOut(userId, ip)) {
    return { ok: false, code: "locked_out", retryAfterMinutes: await lockoutMinutes() };
  }

  if (!verifyAdminAreaPin(pin)) {
    const fails = await recordAdminPinFailure(userId, ip);
    const maxFails = await maxFailedAttempts();
    if (fails >= maxFails) {
      return { ok: false, code: "locked_out", retryAfterMinutes: await lockoutMinutes() };
    }
    return { ok: false, code: "invalid_pin", attemptsRemaining: Math.max(0, maxFails - fails) };
  }

  await clearAdminPinFailures(userId, ip);
  const token = await signAdminUnlockToken(userId);
  return { ok: true, token };
}
