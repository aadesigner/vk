import type { Request, Response } from "express";
import { db, usersTable, userDevicesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { clientIpKey } from "./trustedClient.js";
import { ensureDeviceId, truncateUserAgent } from "./deviceIdentity.js";
import { normalizeBlockedIp } from "./accessBlockNormalize.js";
import { logger } from "./logger.js";

/**
 * Record IP + device for a successful auth session.
 * Never throws to the caller — tracking must not break login/register.
 */
export async function trackUserSessionAccess(
  req: Request,
  res: Response,
  userId: string,
  opts?: { isNewAccount?: boolean },
): Promise<void> {
  try {
    const ipRaw = clientIpKey(req);
    const ip = normalizeBlockedIp(ipRaw) ?? (ipRaw !== "unknown" ? ipRaw : null);
    const { deviceHash } = ensureDeviceId(req, res);
    const userAgent = truncateUserAgent(req.headers["user-agent"]);
    const now = new Date();

    if (opts?.isNewAccount) {
      await db
        .update(usersTable)
        .set({
          lastLoginAt: now,
          ...(ip ? { lastLoginIp: ip, signupIp: ip } : {}),
          updatedAt: now,
        })
        .where(eq(usersTable.id, userId));
    } else {
      await db
        .update(usersTable)
        .set({
          lastLoginAt: now,
          ...(ip ? { lastLoginIp: ip } : {}),
          updatedAt: now,
        })
        .where(eq(usersTable.id, userId));
    }

    const deviceUpdate: {
      lastSeenAt: Date;
      lastIp?: string;
      userAgent?: string;
    } = { lastSeenAt: now };
    if (ip) deviceUpdate.lastIp = ip;
    if (userAgent) deviceUpdate.userAgent = userAgent;

    await db
      .insert(userDevicesTable)
      .values({
        userId,
        deviceHash,
        userAgent,
        lastIp: ip,
        createdAt: now,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: [userDevicesTable.userId, userDevicesTable.deviceHash],
        set: deviceUpdate,
      });
  } catch (err) {
    logger.warn({ err, userId }, "trackUserSessionAccess failed");
  }
}
