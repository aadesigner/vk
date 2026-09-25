import { Request, Response, NextFunction } from "express";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db, usersTable, revokedTokensTable, systemSettingsTable } from "@workspace/db";
import { desc, eq, lt } from "drizzle-orm";
import { logger } from "./logger.js";
import crypto from "crypto";
import { shouldBootstrapAdmin } from "./adminBootstrap.js";
import { clampSessionDays, DEFAULT_SESSION_DAYS, MIN_SESSION_DAYS } from "./sessionPolicy.js";
import { hasValidAdminUnlock, isAdminAreaPinEnabled } from "./adminAreaUnlock.js";

export { clampSessionDays, DEFAULT_SESSION_DAYS, MIN_SESSION_DAYS } from "./sessionPolicy.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export const COOKIE_NAME = "km_session";
const BCRYPT_ROUNDS = 12;

export async function getConfiguredSessionDays(): Promise<number> {
  try {
    const [settings] = await db
      .select({ sessionDays: systemSettingsTable.sessionDays })
      .from(systemSettingsTable)
      .orderBy(desc(systemSettingsTable.id))
      .limit(1);
    return clampSessionDays(settings?.sessionDays);
  } catch {
    return DEFAULT_SESSION_DAYS;
  }
}

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

export async function signJwt(userId: string, sessionDays?: number): Promise<string> {
  const days = clampSessionDays(sessionDays);
  const jti = crypto.randomUUID();
  return new SignJWT({ sub: userId, jti })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(getJwtSecret());
}

export async function verifyJwt(token: string): Promise<{ sub: string; jti: string; exp: number }> {
  const { payload } = await jwtVerify(token, getJwtSecret());
  return {
    sub: payload.sub as string,
    jti: (payload.jti ?? "") as string,
    exp: (payload.exp ?? 0) as number,
  };
}

export function setAuthCookie(res: Response, token: string, sessionDays?: number): void {
  const days = clampSessionDays(sessionDays);
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/",
    maxAge: days * 24 * 60 * 60 * 1000,
  });
}

/**
 * Sliding session: re-issue JWT + refresh cookie when less than half the lifetime remains.
 * Keeps active visitors signed in on desktop and mobile without shortening the max window.
 */
export async function refreshSessionIfNeeded(
  res: Response,
  userId: string,
  token: string,
  sessionDays?: number,
): Promise<{ token: string; expiresAt: Date }> {
  const days = clampSessionDays(sessionDays);
  try {
    const { exp } = await verifyJwt(token);
    const expiresAt = new Date(exp * 1000);
    const remainingMs = expiresAt.getTime() - Date.now();
    const halfLifeMs = (days * 24 * 60 * 60 * 1000) / 2;
    if (remainingMs > 0 && remainingMs <= halfLifeMs) {
      const newToken = await signJwt(userId, days);
      setAuthCookie(res, newToken, days);
      const { exp: newExp } = await verifyJwt(newToken);
      return { token: newToken, expiresAt: new Date(newExp * 1000) };
    }
    return { token, expiresAt };
  } catch {
    return { token, expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000) };
  }
}

export function clearAuthCookie(res: Response): void {
  const isProduction = process.env.NODE_ENV === "production";
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/",
  });
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

export async function isTokenRevoked(jti: string): Promise<boolean> {
  if (!jti) return false;
  const [row] = await db
    .select({ jti: revokedTokensTable.jti })
    .from(revokedTokensTable)
    .where(eq(revokedTokensTable.jti, jti))
    .limit(1);
  return !!row;
}

export async function readSessionUserId(req: Request): Promise<string | undefined> {
  if (req.userId) return req.userId;
  const token: string | undefined = req.cookies?.[COOKIE_NAME];
  if (!token) return undefined;
  try {
    const { sub, jti } = await verifyJwt(token);
    if (jti && (await isTokenRevoked(jti))) return undefined;
    req.userId = sub;
    return sub;
  } catch {
    return undefined;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token: string | undefined = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const { sub, jti } = await verifyJwt(token);
    if (jti && (await isTokenRevoked(jti))) {
      clearAuthCookie(res);
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const [user] = await db
      .select({ id: usersTable.id, isBanned: usersTable.isBanned })
      .from(usersTable)
      .where(eq(usersTable.id, sub))
      .limit(1);

    if (!user) {
      clearAuthCookie(res);
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (user.isBanned) {
      clearAuthCookie(res);
      res.status(403).json({ error: "Your account has been suspended.", code: "banned" });
      return;
    }

    req.userId = sub;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const userId = await readSessionUserId(req);
  if (userId) req.userId = userId;
  next();
}

export async function requireAdminAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = await authenticateAdminRequest(req, res);
  if (!userId) return;
  req.userId = userId;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = await authenticateAdminRequest(req, res);
  if (!userId) return;
  req.userId = userId;

  if (isAdminAreaPinEnabled() && !(await hasValidAdminUnlock(req, userId))) {
    res.status(403).json({
      error: "Admin area locked. Enter your admin PIN.",
      code: "admin_unlock_required",
    });
    return;
  }

  next();
}

async function authenticateAdminRequest(req: Request, res: Response): Promise<string | null> {
  const token: string | undefined = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  let userId: string;
  let jti: string;
  try {
    const payload = await verifyJwt(token);
    userId = payload.sub;
    jti = payload.jti;
  } catch {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  if (jti && await isTokenRevoked(jti)) {
    clearAuthCookie(res);
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  const [user] = await db
    .select({ isAdmin: usersTable.isAdmin })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user?.isAdmin) {
    logger.warn({ msg: "admin_access_denied", userId, method: req.method, path: req.path });
    res.status(403).json({ error: "Forbidden" });
    return null;
  }

  logger.info({ msg: "admin_access", userId, method: req.method, path: req.path, granted: true });
  return userId;
}

export async function revokeToken(jti: string, expiresAt: Date): Promise<void> {
  if (!jti) return;
  try {
    await db.insert(revokedTokensTable).values({ jti, expiresAt }).onConflictDoNothing();
    // Opportunistically purge expired revocations to keep the table small
    await db.delete(revokedTokensTable).where(lt(revokedTokensTable.expiresAt, new Date()));
  } catch (err) {
    logger.warn({ err }, "Failed to revoke token");
  }
}

export async function upsertUser(
  userId: string,
  email: string,
  name?: string,
  avatarUrl?: string,
): Promise<typeof usersTable.$inferSelect | null> {
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (existing) {
    const [updated] = await db
      .update(usersTable)
      .set({ email, name: name ?? existing.name, avatarUrl: avatarUrl ?? existing.avatarUrl, lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning();
    return updated ?? null;
  }

  const isAdmin = await shouldBootstrapAdmin(email);
  const [created] = await db.insert(usersTable).values({
    id: userId,
    email,
    name,
    avatarUrl,
    isAdmin,
    lastLoginAt: new Date(),
  }).returning();
  return created ?? null;
}
