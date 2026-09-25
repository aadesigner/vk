import { pgTable, serial, text, real, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  vin: text("vin"),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("EUR"),
  status: text("status").notNull().default("pending"), // pending | completed | failed | refunded
  /** vin_report | credit_pack | credit_redemption */
  kind: text("kind").notNull().default("vin_report"),
  /** Pack size granted (3/5) or 1 on redemption. */
  credits: integer("credits"),
  paypalOrderId: text("paypal_order_id"),
  /** POK Payments SDK order id (card checkout). Mutually exclusive with paypalOrderId in practice. */
  pokOrderId: text("pok_order_id"),
  couponCode: text("coupon_code"),
  discountAmount: real("discount_amount"),
  vinLookupId: integer("vin_lookup_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("payments_user_id_idx").on(table.userId),
  index("payments_vin_idx").on(table.vin),
  uniqueIndex("payments_paypal_order_id_idx").on(table.paypalOrderId),
  uniqueIndex("payments_pok_order_id_idx").on(table.pokOrderId),
  index("payments_status_idx").on(table.status),
  index("payments_created_at_idx").on(table.createdAt),
]);

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
