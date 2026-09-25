import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const revokedTokensTable = pgTable("revoked_tokens", {
  jti: text("jti").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at").notNull().defaultNow(),
}, (table) => [
  index("revoked_tokens_expires_at_idx").on(table.expiresAt),
]);

export type RevokedToken = typeof revokedTokensTable.$inferSelect;
