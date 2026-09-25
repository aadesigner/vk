import { pgTable, serial, text, integer, boolean, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

/** Admin-editable draft for VINs paid before catalog data exists. */
export const pendingVinChecksTable = pgTable("pending_vin_checks", {
  id: serial("id").primaryKey(),
  vin: text("vin").notNull(),
  status: text("status").notNull().default("open"), // open | published
  draftData: jsonb("draft_data").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  publishedAt: timestamp("published_at"),
  publishedBy: text("published_by"),
}, (table) => [
  uniqueIndex("pending_vin_checks_vin_unique").on(table.vin),
  index("pending_vin_checks_status_idx").on(table.status),
  index("pending_vin_checks_updated_at_idx").on(table.updatedAt),
]);

/** Users who purchased a pending-manual VIN report (notified on publish). */
export const pendingVinCheckRequestsTable = pgTable("pending_vin_check_requests", {
  id: serial("id").primaryKey(),
  pendingVinCheckId: integer("pending_vin_check_id").notNull(),
  userId: text("user_id").notNull(),
  paymentId: integer("payment_id"),
  lookupId: integer("lookup_id").notNull(),
  notifyOnPublish: boolean("notify_on_publish").notNull().default(true),
  notifiedAt: timestamp("notified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("pending_vin_check_requests_pending_id_idx").on(table.pendingVinCheckId),
  index("pending_vin_check_requests_user_id_idx").on(table.userId),
  index("pending_vin_check_requests_lookup_id_idx").on(table.lookupId),
]);

export type PendingVinCheck = typeof pendingVinChecksTable.$inferSelect;
export type PendingVinCheckRequest = typeof pendingVinCheckRequestsTable.$inferSelect;
