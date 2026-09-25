import { db, accessBlocksTable, userDevicesTable, usersTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { resolveRequestCountryCode } from "./geoCountry.js";
import { clientIpKey } from "./trustedClient.js";
import {
  normalizeBlockedCountry,
  normalizeBlockedDevice,
  normalizeBlockedIp,
} from "./accessBlockNormalize.js";
import { resolveDeviceHashFromRequest } from "./deviceIdentity.js";

export type AccessBlockType = "ip" | "country" | "device";

export {
  normalizeBlockedCountry,
  normalizeBlockedDevice,
  normalizeBlockedIp,
} from "./accessBlockNormalize.js";

export type AccessBlockRow = {
  id: number;
  blockType: AccessBlockType;
  blockValue: string;
  reason: string | null;
  source: string;
  userId: string | null;
  createdBy: string | null;
  createdAt: Date;
  expiresAt: Date | null;
};

type BlockCache = {
  ips: Set<string>;
  countries: Set<string>;
  devices: Set<string>;
  loadedAt: number;
};

const CACHE_TTL_MS = 15_000;
let cache: BlockCache | null = null;

function isActive(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() > Date.now();
}

async function loadCache(): Promise<BlockCache> {
  const now = Date.now();
  if (cache && now - cache.loadedAt < CACHE_TTL_MS) return cache;

  const rows = await db
    .select({
      blockType: accessBlocksTable.blockType,
      blockValue: accessBlocksTable.blockValue,
      expiresAt: accessBlocksTable.expiresAt,
    })
    .from(accessBlocksTable);

  const ips = new Set<string>();
  const countries = new Set<string>();
  const devices = new Set<string>();
  for (const row of rows) {
    if (!isActive(row.expiresAt)) continue;
    if (row.blockType === "ip") ips.add(row.blockValue);
    if (row.blockType === "country") countries.add(row.blockValue);
    if (row.blockType === "device") devices.add(row.blockValue);
  }

  cache = { ips, countries, devices, loadedAt: now };
  return cache;
}

export function invalidateAccessBlockCache(): void {
  cache = null;
}

export async function isIpBlocked(ip: string): Promise<boolean> {
  const normalized = normalizeBlockedIp(ip);
  if (!normalized) return false;
  const { ips } = await loadCache();
  return ips.has(normalized);
}

export async function isCountryBlocked(countryCode: string | null): Promise<boolean> {
  if (!countryCode) return false;
  const { countries } = await loadCache();
  return countries.has(countryCode);
}

export async function isDeviceBlocked(deviceHash: string | null): Promise<boolean> {
  const normalized = deviceHash ? normalizeBlockedDevice(deviceHash) : null;
  if (!normalized) return false;
  const { devices } = await loadCache();
  return devices.has(normalized);
}

export type AccessBlockCheck = {
  blocked: boolean;
  reason?: "ip" | "country" | "device";
};

export async function checkAccessBlock(
  ip: string,
  countryCode: string | null,
  deviceHash?: string | null,
): Promise<AccessBlockCheck> {
  if (await isIpBlocked(ip)) return { blocked: true, reason: "ip" };
  if (await isDeviceBlocked(deviceHash ?? null)) return { blocked: true, reason: "device" };
  if (await isCountryBlocked(countryCode)) return { blocked: true, reason: "country" };
  return { blocked: false };
}

export async function listAccessBlocks(): Promise<AccessBlockRow[]> {
  const rows = await db
    .select()
    .from(accessBlocksTable)
    .orderBy(desc(accessBlocksTable.createdAt));

  return rows
    .filter((r) => isActive(r.expiresAt))
    .map((r) => ({
      id: r.id,
      blockType: r.blockType as AccessBlockType,
      blockValue: r.blockValue,
      reason: r.reason,
      source: r.source,
      userId: r.userId,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
    }));
}

export async function addIpBlock(opts: {
  ip: string;
  reason?: string | null;
  source?: string;
  userId?: string | null;
  createdBy?: string | null;
  expiresAt?: Date | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = normalizeBlockedIp(opts.ip);
  if (!normalized) return { ok: false, error: "Invalid IP address" };

  await db
    .insert(accessBlocksTable)
    .values({
      blockType: "ip",
      blockValue: normalized,
      reason: opts.reason ?? null,
      source: opts.source ?? "manual",
      userId: opts.userId ?? null,
      createdBy: opts.createdBy ?? null,
      expiresAt: opts.expiresAt ?? null,
    })
    .onConflictDoUpdate({
      target: [accessBlocksTable.blockType, accessBlocksTable.blockValue],
      set: {
        reason: opts.reason ?? null,
        source: opts.source ?? "manual",
        userId: opts.userId ?? null,
        createdBy: opts.createdBy ?? null,
        createdAt: new Date(),
        expiresAt: opts.expiresAt ?? null,
      },
    });

  invalidateAccessBlockCache();
  return { ok: true };
}

export async function addDeviceBlock(opts: {
  deviceHash: string;
  reason?: string | null;
  source?: string;
  userId?: string | null;
  createdBy?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = normalizeBlockedDevice(opts.deviceHash);
  if (!normalized) return { ok: false, error: "Invalid device id" };

  await db
    .insert(accessBlocksTable)
    .values({
      blockType: "device",
      blockValue: normalized,
      reason: opts.reason ?? null,
      source: opts.source ?? "manual",
      userId: opts.userId ?? null,
      createdBy: opts.createdBy ?? null,
    })
    .onConflictDoUpdate({
      target: [accessBlocksTable.blockType, accessBlocksTable.blockValue],
      set: {
        reason: opts.reason ?? null,
        source: opts.source ?? "manual",
        userId: opts.userId ?? null,
        createdBy: opts.createdBy ?? null,
        createdAt: new Date(),
        expiresAt: null,
      },
    });

  invalidateAccessBlockCache();
  return { ok: true };
}

export async function addCountryBlock(opts: {
  countryCode: string;
  reason?: string | null;
  createdBy?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const code = normalizeBlockedCountry(opts.countryCode);
  if (!code) return { ok: false, error: "Invalid country code (use ISO 3166-1 alpha-2, e.g. RU)" };

  await db
    .insert(accessBlocksTable)
    .values({
      blockType: "country",
      blockValue: code,
      reason: opts.reason ?? null,
      source: "manual",
      createdBy: opts.createdBy ?? null,
    })
    .onConflictDoUpdate({
      target: [accessBlocksTable.blockType, accessBlocksTable.blockValue],
      set: {
        reason: opts.reason ?? null,
        createdBy: opts.createdBy ?? null,
        createdAt: new Date(),
        expiresAt: null,
      },
    });

  invalidateAccessBlockCache();
  return { ok: true };
}

export async function removeAccessBlock(
  blockType: AccessBlockType,
  blockValue: string,
): Promise<boolean> {
  const value =
    blockType === "ip"
      ? normalizeBlockedIp(blockValue)
      : blockType === "device"
        ? normalizeBlockedDevice(blockValue)
        : normalizeBlockedCountry(blockValue);
  if (!value) return false;

  const result = await db
    .delete(accessBlocksTable)
    .where(and(eq(accessBlocksTable.blockType, blockType), eq(accessBlocksTable.blockValue, value)));

  invalidateAccessBlockCache();
  return (result.rowCount ?? 0) > 0;
}

/** Removes device (and any legacy) blocks created by a user ban (manual IP/country blocks stay). */
export async function removeUserBanIpBlocks(userId: string): Promise<number> {
  const result = await db
    .delete(accessBlocksTable)
    .where(and(eq(accessBlocksTable.source, "user_ban"), eq(accessBlocksTable.userId, userId)));

  invalidateAccessBlockCache();
  return result.rowCount ?? 0;
}

async function listDeviceHashesForBan(userId: string): Promise<string[]> {
  const deviceRows = await db
    .select({ deviceHash: userDevicesTable.deviceHash })
    .from(userDevicesTable)
    .where(eq(userDevicesTable.userId, userId));
  return deviceRows.map((r) => r.deviceHash).filter(Boolean);
}

/**
 * Ban hardening: block remembered devices for this account only.
 * IPs stay as forensic records on the user (signup / last login) and are
 * never auto-blocked — use Security → Block IP for manual network bans.
 */
export async function blockDevicesForBannedUser(
  userId: string,
  adminId: string,
  reason?: string | null,
): Promise<{ blockedDevices: string[] }> {
  const banReason = reason ?? "Auto-blocked when user account was banned";
  const blockedDevices: string[] = [];
  for (const deviceHash of await listDeviceHashesForBan(userId)) {
    const result = await addDeviceBlock({
      deviceHash,
      reason: banReason,
      source: "user_ban",
      userId,
      createdBy: adminId,
    });
    if (result.ok) blockedDevices.push(deviceHash);
  }
  return { blockedDevices };
}

/** Remove legacy auto IP blocks created by older user-ban logic (manual IP blocks stay). */
export async function purgeLegacyUserBanIpBlocks(): Promise<number> {
  const result = await db
    .delete(accessBlocksTable)
    .where(and(eq(accessBlocksTable.source, "user_ban"), eq(accessBlocksTable.blockType, "ip")));
  invalidateAccessBlockCache();
  return result.rowCount ?? 0;
}

/**
 * Ensure every currently banned account has device rows in access_blocks.
 * Does not create IP blocks. Clears legacy user_ban IP rows.
 */
export async function syncAccessBlocksForBannedUsers(
  createdBy = "system",
): Promise<{ users: number; devices: number; purgedLegacyIps: number }> {
  try {
    const purgedLegacyIps = await purgeLegacyUserBanIpBlocks();
    const banned = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.isBanned, true))
      .limit(500);

    let devices = 0;
    for (const user of banned) {
      const result = await blockDevicesForBannedUser(
        user.id,
        createdBy,
        "Synced from banned account",
      );
      devices += result.blockedDevices.length;
    }
    return { users: banned.length, devices, purgedLegacyIps };
  } catch {
    return { users: 0, devices: 0, purgedLegacyIps: 0 };
  }
}

export function resolveBlockCountryFromRequest(req: import("express").Request): string | null {
  return resolveRequestCountryCode(req);
}

export function resolveBlockIpFromRequest(req: import("express").Request): string {
  return clientIpKey(req);
}

export function resolveBlockDeviceFromRequest(req: import("express").Request): string | null {
  return resolveDeviceHashFromRequest(req);
}
