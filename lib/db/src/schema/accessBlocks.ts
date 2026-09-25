import { pgTable, serial, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

export const accessBlocksTable = pgTable("access_blocks", {
  id: serial("id").primaryKey(),
  blockType: text("block_type").notNull(), // ip | country | device
  blockValue: text("block_value").notNull(),
  reason: text("reason"),
  source: text("source").notNull().default("manual"), // manual | user_ban
  userId: text("user_id"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
}, (table) => [
  uniqueIndex("access_blocks_type_value_idx").on(table.blockType, table.blockValue),
  index("access_blocks_user_id_idx").on(table.userId),
  index("access_blocks_created_at_idx").on(table.createdAt),
]);

export type AccessBlock = typeof accessBlocksTable.$inferSelect;
