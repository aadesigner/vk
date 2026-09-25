import { db, emailLogsTable, EMAIL_LOG_TYPES } from "@workspace/db";
import type { EmailLogType, EmailLogStatus } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";

/** Logs older than this are removed when auto-cleanup is enabled. */
export const EMAIL_LOG_RETENTION_DAYS = 7;

/** Stored on log meta for Admin → Logs → Resend; stripped from list API responses. */
export const EMAIL_LOG_HTML_META_KEY = "_html";
export const EMAIL_LOG_TEXT_META_KEY = "_text";

const VALID_TYPES = new Set<string>(EMAIL_LOG_TYPES);

export function normalizeEmailLogType(value: string | null | undefined): EmailLogType {
  const v = value?.trim().toLowerCase() ?? "";
  return VALID_TYPES.has(v) ? (v as EmailLogType) : "other";
}

/** Subjects are rendered from admin templates — keep the column bounded. */
const MAX_SUBJECT = 300;
const MAX_ERROR = 500;

export type RecordEmailLogInput = {
  type: EmailLogType;
  recipient: string;
  subject: string;
  status: EmailLogStatus;
  error?: string | null;
  meta?: Record<string, unknown> | null;
};

export function getStoredEmailBody(meta: Record<string, unknown> | null | undefined): {
  html: string | null;
  text: string | null;
} {
  if (!meta || typeof meta !== "object") return { html: null, text: null };
  const html = typeof meta[EMAIL_LOG_HTML_META_KEY] === "string" ? meta[EMAIL_LOG_HTML_META_KEY] : null;
  const text = typeof meta[EMAIL_LOG_TEXT_META_KEY] === "string" ? meta[EMAIL_LOG_TEXT_META_KEY] : null;
  return { html, text };
}

/** Drop message body fields so list payloads stay small. */
export function sanitizeEmailLogMetaForApi(
  meta: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!meta || typeof meta !== "object") return null;
  const next = { ...meta };
  delete next[EMAIL_LOG_HTML_META_KEY];
  delete next[EMAIL_LOG_TEXT_META_KEY];
  return Object.keys(next).length > 0 ? next : null;
}

export function emailLogIsResendable(
  status: EmailLogStatus | string,
  meta: Record<string, unknown> | null | undefined,
): boolean {
  if (status !== "failed") return false;
  return Boolean(getStoredEmailBody(meta).html);
}

/**
 * Never throws and never blocks the caller — a logging failure must not stop an
 * email from being considered sent.
 */
export function recordEmailLog(input: RecordEmailLogInput): void {
  const recipient = input.recipient.trim().toLowerCase();
  if (!recipient) return;

  void db
    .insert(emailLogsTable)
    .values({
      type: normalizeEmailLogType(input.type),
      recipient: recipient.slice(0, 320),
      subject: (input.subject ?? "").slice(0, MAX_SUBJECT),
      status: input.status,
      error: input.error ? String(input.error).slice(0, MAX_ERROR) : null,
      meta: input.meta ?? null,
    })
    .catch((err) => {
      logger.warn({ err }, "email log insert failed");
    });
}

export async function markEmailLogSent(id: number): Promise<boolean> {
  try {
    await db
      .update(emailLogsTable)
      .set({ status: "sent", error: null })
      .where(eq(emailLogsTable.id, id));
    return true;
  } catch (err) {
    logger.warn({ err, id }, "email log mark sent failed");
    return false;
  }
}

export async function markEmailLogFailed(id: number, error: string): Promise<boolean> {
  try {
    await db
      .update(emailLogsTable)
      .set({ status: "failed", error: String(error).slice(0, MAX_ERROR) })
      .where(eq(emailLogsTable.id, id));
    return true;
  } catch (err) {
    logger.warn({ err, id }, "email log mark failed update failed");
    return false;
  }
}
