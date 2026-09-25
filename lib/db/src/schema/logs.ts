import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const systemLogsTable = pgTable("system_logs", {
  id: serial("id").primaryKey(),
  level: text("level").notNull().default("info"), // error | warn | info
  message: text("message").notNull(),
  context: text("context"), // JSON string with extra context
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SystemLog = typeof systemLogsTable.$inferSelect;
