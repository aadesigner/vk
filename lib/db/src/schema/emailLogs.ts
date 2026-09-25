import { pgTable, serial, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

/** Categories shown in the admin Emails → Logs filter. */
export const EMAIL_LOG_TYPES = [
  "welcome",
  "report",
  "reset",
  "abandoned",
  "noinfo",
  "noinforefund",
  "admin_pending",
  "test",
  "promo",
  "other",
] as const;

export type EmailLogType = (typeof EMAIL_LOG_TYPES)[number];
export type EmailLogStatus = "sent" | "failed";

export const emailLogsTable = pgTable("email_logs", {
  id: serial("id").primaryKey(),
  type: text("type").$type<EmailLogType>().notNull().default("other"),
  recipient: text("recipient").notNull(),
  subject: text("subject").notNull().default(""),
  status: text("status").$type<EmailLogStatus>().notNull().default("sent"),
  error: text("error"),
  /** Free-form context: vin, lookupId, userId, … */
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("email_logs_created_at_idx").on(table.createdAt),
  index("email_logs_type_created_at_idx").on(table.type, table.createdAt),
  index("email_logs_status_idx").on(table.status),
  index("email_logs_recipient_idx").on(table.recipient),
]);

export type EmailLog = typeof emailLogsTable.$inferSelect;
