import { pgTable, serial, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Browser/device identities bound to a user via an httpOnly cookie.
 * `deviceHash` is SHA-256 of the cookie value (never store the raw cookie).
 */
export const userDevicesTable = pgTable("user_devices", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  deviceHash: text("device_hash").notNull(),
  /** Truncated User-Agent for admin forensics only — not used for blocking. */
  userAgent: text("user_agent"),
  lastIp: text("last_ip"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("user_devices_user_hash_idx").on(table.userId, table.deviceHash),
  index("user_devices_user_id_idx").on(table.userId),
  index("user_devices_device_hash_idx").on(table.deviceHash),
  index("user_devices_last_seen_at_idx").on(table.lastSeenAt),
]);

export type UserDevice = typeof userDevicesTable.$inferSelect;
