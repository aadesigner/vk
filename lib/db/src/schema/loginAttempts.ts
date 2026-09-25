import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";

export const loginAttemptsTable = pgTable("login_attempts", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  ip: text("ip").notNull(),
  context: text("context").notNull().default("user"),
  attemptedAt: timestamp("attempted_at").notNull().defaultNow(),
}, (table) => [
  index("login_attempts_email_idx").on(table.email),
  index("login_attempts_attempted_at_idx").on(table.attemptedAt),
  index("login_attempts_context_idx").on(table.context),
]);

export type LoginAttempt = typeof loginAttemptsTable.$inferSelect;
