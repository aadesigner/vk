import { pgTable, serial, text, boolean, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vinLookupsTable = pgTable("vin_lookups", {
  id: serial("id").primaryKey(),
  vin: text("vin").notNull(),
  userId: text("user_id"), // Clerk user ID, nullable for cached results
  status: text("status").notNull().default("pending"), // pending | complete | error
  data: jsonb("data"), // normalized VIN data
  providerName: text("provider_name"),
  fromCache: boolean("from_cache").notNull().default(false),
  paymentId: integer("payment_id"),
  dataCorrupt: boolean("data_corrupt").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("vin_lookups_vin_idx").on(table.vin),
  index("vin_lookups_user_id_idx").on(table.userId),
  index("vin_lookups_status_idx").on(table.status),
  index("vin_lookups_created_at_idx").on(table.createdAt),
  index("vin_lookups_vin_status_idx").on(table.vin, table.status),
  index("vin_lookups_user_created_idx").on(table.userId, table.createdAt),
]);

export const insertVinLookupSchema = createInsertSchema(vinLookupsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVinLookup = z.infer<typeof insertVinLookupSchema>;
export type VinLookup = typeof vinLookupsTable.$inferSelect;
