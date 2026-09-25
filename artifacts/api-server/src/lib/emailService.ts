import nodemailer from "nodemailer";
import { db, systemSettingsTable } from "@workspace/db";
import type { EmailTemplateOverride, EmailTemplatesConfig } from "@workspace/db";
import { desc } from "drizzle-orm";
import {
  renderEmailTemplate,
  varsFromReportReady,
  getSampleTemplateVars,
} from "./emailTemplates.js";
import {
  EMAIL_LOG_HTML_META_KEY,
  EMAIL_LOG_TEXT_META_KEY,
  recordEmailLog,
} from "./emailLog.js";
import type { EmailLogType } from "@workspace/db";
import {
  normalizeSmtpSecurity,
  smtpTransportSecurity,
  type SmtpSecurityLevel,
} from "./smtpSecurity.js";
import { buildEmailBase } from "./emailLayout.js";
import { formatSmtpConfigError, formatSmtpTransportError } from "./smtpErrors.js";
import { logger } from "./logger.js";

export { buildEmailBase };

export type SmtpOverride = {
  smtpEnabled?: boolean;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSecurity?: SmtpSecurityLevel | string | null;
  smtpUser?: string | null;
  smtpPass?: string | null;
  smtpFromEmail?: string | null;
  smtpFromName?: string | null;
};

export type SendEmailResult = {
  ok: boolean;
  error?: string;
  hint?: string;
  code?: string;
};

/** Cap how long callers (e.g. admin SMTP test) wait before a friendly timeout. */
export const SMTP_SEND_DEADLINE_MS = 22_000;

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Category recorded in Admin → Emails → Logs. Omit to skip logging. */
  logType?: EmailLogType;
  /** Extra context stored alongside the log row (vin, lookupId, userId, …). */
  logMeta?: Record<string, unknown>;
  /** When true, do not insert a new email_logs row (used by admin resend). */
  skipLog?: boolean;
}

function buildEmailLogMeta(opts: EmailOptions): Record<string, unknown> {
  const meta: Record<string, unknown> = { ...(opts.logMeta ?? {}) };
  meta[EMAIL_LOG_HTML_META_KEY] = opts.html;
  if (opts.text) meta[EMAIL_LOG_TEXT_META_KEY] = opts.text;
  return meta;
}

export async function sendEmailWithDeadline(
  opts: EmailOptions,
  smtpOverride?: SmtpOverride,
  deadlineMs = SMTP_SEND_DEADLINE_MS,
): Promise<SendEmailResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Inner send skips logging so a deadline timeout can still create a failed log
  // (with message body) for Admin → Emails → Logs → Resend.
  const sendPromise = sendEmail({ ...opts, skipLog: true }, smtpOverride);
  const deadline = new Promise<SendEmailResult>((resolve) => {
    timer = setTimeout(() => {
      resolve({
        ok: false,
        error: "SMTP connection timed out.",
        hint:
          "The API could not reach your mail server in time. On Railway, outbound SMTP is often blocked or slow — try port 465 (SSL) or 587 (STARTTLS), double-check host/credentials, or use a relay like SendGrid/Mailgun.",
        code: "SMTP_TIMEOUT",
      });
    }, deadlineMs);
  });

  const result = await Promise.race([sendPromise, deadline]);
  if (timer) clearTimeout(timer);

  if (!opts.skipLog && opts.logType) {
    recordEmailLog({
      type: opts.logType,
      recipient: opts.to,
      subject: opts.subject,
      status: result.ok ? "sent" : "failed",
      error: result.ok ? undefined : result.error,
      meta: buildEmailLogMeta(opts),
    });
  }

  return result;
}

type ResolvedSmtp = {
  host: string;
  port: number;
  security: SmtpSecurityLevel;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
};

type SmtpConfigResult =
  | { ok: true; config: ResolvedSmtp }
  | { ok: false; error: string; hint?: string; code?: string };

async function resolveSmtpConfig(override?: SmtpOverride): Promise<SmtpConfigResult> {
  let saved: typeof systemSettingsTable.$inferSelect | undefined;
  try {
    [saved] = await db
      .select()
      .from(systemSettingsTable)
      .orderBy(desc(systemSettingsTable.id))
      .limit(1);
  } catch (err) {
    const detail = formatSmtpTransportError(err);
    return { ok: false, ...detail };
  }

  const enabled = override?.smtpEnabled ?? saved?.smtpEnabled;
  if (!enabled) {
    const detail = formatSmtpConfigError("disabled");
    return { ok: false, ...detail };
  }

  const host = String(override?.smtpHost ?? saved?.smtpHost ?? "").trim();
  const user = String(override?.smtpUser ?? saved?.smtpUser ?? "").trim();
  const overridePass = override?.smtpPass != null ? String(override.smtpPass).trim() : "";
  const pass = overridePass || String(saved?.smtpPass ?? "").trim();

  if (!host) {
    const detail = formatSmtpConfigError("host");
    return { ok: false, ...detail };
  }
  if (!user) {
    const detail = formatSmtpConfigError("user");
    return { ok: false, ...detail };
  }
  if (!pass) {
    const detail = formatSmtpConfigError("pass");
    return { ok: false, ...detail };
  }

  const port = override?.smtpPort ?? saved?.smtpPort ?? 587;
  const security = normalizeSmtpSecurity(
    override?.smtpSecurity ?? saved?.smtpSecurity,
    port,
  );
  const fromEmail = String(override?.smtpFromEmail ?? saved?.smtpFromEmail ?? user).trim() || user;
  const fromName = String(override?.smtpFromName ?? saved?.smtpFromName ?? "verifykm").trim() || "verifykm";

  return {
    ok: true,
    config: {
      host,
      port,
      security,
      user,
      pass,
      fromEmail,
      fromName,
    },
  };
}

async function getSmtpSettings() {
  const resolved = await resolveSmtpConfig();
  return resolved.ok ? resolved.config : null;
}

/** True when admin SMTP is enabled and has host, user, and password. */
export async function isSmtpConfigured(): Promise<boolean> {
  return (await getSmtpSettings()) !== null;
}

export async function getSiteUrl(): Promise<string> {
  try {
    const [settings] = await db
      .select({ siteUrl: systemSettingsTable.siteUrl })
      .from(systemSettingsTable)
      .orderBy(desc(systemSettingsTable.id))
      .limit(1);
    return settings?.siteUrl?.replace(/\/$/, "") ?? "https://verifykm.com";
  } catch {
    return "https://verifykm.com";
  }
}

export async function loadEmailTemplatesConfig(): Promise<EmailTemplatesConfig> {
  try {
    const [settings] = await db
      .select({ emailTemplates: systemSettingsTable.emailTemplates })
      .from(systemSettingsTable)
      .orderBy(desc(systemSettingsTable.id))
      .limit(1);
    return (settings?.emailTemplates ?? {}) as EmailTemplatesConfig;
  } catch {
    return {};
  }
}

export async function sendEmail(
  opts: EmailOptions,
  smtpOverride?: SmtpOverride,
): Promise<SendEmailResult> {
  let smtpHost: string | undefined;
  const log = (status: "sent" | "failed", error?: string) => {
    if (opts.skipLog || !opts.logType) return;
    recordEmailLog({
      type: opts.logType,
      recipient: opts.to,
      subject: opts.subject,
      status,
      error,
      meta: buildEmailLogMeta(opts),
    });
  };

  try {
    const resolved = await resolveSmtpConfig(smtpOverride);
    if (!resolved.ok) {
      log("failed", resolved.error);
      return { ok: false, error: resolved.error, hint: resolved.hint, code: resolved.code };
    }
    const smtp = resolved.config;
    smtpHost = smtp.host;

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      ...smtpTransportSecurity(smtp.security),
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 15_000,
      tls: {
        rejectUnauthorized: process.env.SMTP_INSECURE !== "true",
      },
    });

    await transporter.sendMail({
      from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });

    log("sent");
    return { ok: true };
  } catch (err) {
    const detail = formatSmtpTransportError(err);
    logger.warn({ ...detail, smtpHost }, "sendEmail failed");
    log("failed", detail.error);
    return { ok: false, ...detail };
  }
}

// ── Pre-built templates (customizable via admin email templates) ───────────────

export function buildWelcomeEmail(
  name: string,
  siteUrl?: string,
  override?: EmailTemplateOverride,
): { subject: string; html: string } {
  const base = (siteUrl ?? "https://verifykm.com").replace(/\/$/, "");
  return renderEmailTemplate(
    "welcome",
    { name: name || "there", siteUrl: base },
    override,
    base,
  );
}

/** Combined report-ready + payment-confirmation email. */
export interface ReportReadyEmailData {
  name: string;
  email?: string | null;
  vin: string;
  reportUrl: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  mileage?: number | null;
  accidents?: number | null;
  owners?: number | null;
  amount?: number | null;
  currency?: string | null;
  paymentRef?: string | null;
}

export function buildReportReadyEmail(
  data: ReportReadyEmailData & { siteUrl?: string },
  override?: EmailTemplateOverride,
): { subject: string; html: string } {
  const siteUrl = (data.siteUrl ?? "https://verifykm.com").replace(/\/$/, "");
  return renderEmailTemplate(
    "vinready",
    varsFromReportReady({ ...data, siteUrl }),
    override,
    siteUrl,
  );
}

export function buildReportReadySampleHtml(siteUrl = "https://verifykm.com"): string {
  const { html } = renderEmailTemplate(
    "vinready",
    getSampleTemplateVars("vinready", siteUrl),
    undefined,
    siteUrl,
  );
  return html;
}

export function buildPendingVinEmail(
  name: string,
  vin: string,
  checkoutUrl: string,
  price: string,
  siteUrl?: string,
  override?: EmailTemplateOverride,
): { subject: string; html: string } {
  const base = (siteUrl ?? "https://verifykm.com").replace(/\/$/, "");
  return renderEmailTemplate(
    "abandoned",
    { name: name || "there", vin, checkoutUrl, price, siteUrl: base },
    override,
    base,
  );
}

export interface NoinfoCreditEmailData {
  name: string;
  vin: string;
  credits: string;
  checkoutUrl: string;
  siteUrl?: string;
}

/** Admin compensation: no report data found + 1 free credit granted. */
export function buildNoinfoCreditEmail(
  data: NoinfoCreditEmailData,
  override?: EmailTemplateOverride,
): { subject: string; html: string } {
  const base = (data.siteUrl ?? "https://verifykm.com").replace(/\/$/, "");
  return renderEmailTemplate(
    "noinfo",
    {
      name: data.name || "there",
      vin: data.vin,
      credits: data.credits,
      checkoutUrl: data.checkoutUrl,
      siteUrl: base,
    },
    override,
    base,
  );
}

export interface NoinfoRefundEmailData {
  name: string;
  vin: string;
  checkoutUrl: string;
  siteUrl?: string;
}

/** Admin closes pending VIN with no data and marks payment refunded. */
export function buildNoinfoRefundEmail(
  data: NoinfoRefundEmailData,
  override?: EmailTemplateOverride,
): { subject: string; html: string } {
  const base = (data.siteUrl ?? "https://verifykm.com").replace(/\/$/, "");
  return renderEmailTemplate(
    "noinforefund",
    {
      name: data.name || "there",
      vin: data.vin,
      checkoutUrl: data.checkoutUrl,
      siteUrl: base,
    },
    override,
    base,
  );
}

export function buildPasswordResetEmail(
  resetUrl: string,
  siteUrl?: string,
  override?: EmailTemplateOverride,
): { subject: string; html: string } {
  const base = (siteUrl ?? "https://verifykm.com").replace(/\/$/, "");
  return renderEmailTemplate("reset", { resetUrl, siteUrl: base }, override, base);
}

export function buildPromoEmail(
  name: string,
  subject: string,
  bodyHtml: string,
  ctaText?: string,
  ctaUrl?: string,
  siteUrl?: string,
): { subject: string; html: string } {
  const displayName = name || "there";
  const ctaBlock = ctaText && ctaUrl ? `
    <table cellpadding="0" cellspacing="0" border="0" style="margin-top:24px">
      <tr>
        <td bgcolor="#16a34a" style="border-radius:8px">
          <a href="${ctaUrl}" style="display:inline-block;padding:13px 28px;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;font-family:Arial,Helvetica,sans-serif">${ctaText}</a>
        </td>
      </tr>
    </table>
  ` : "";
  const content = `
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#111111">Hi ${displayName}!</h1>
    <div style="color:#444444;line-height:1.7">${bodyHtml}</div>
    ${ctaBlock}
  `;
  return {
    subject,
    html: buildEmailBase(content, undefined, siteUrl),
  };
}

export function buildSmtpTestEmail(siteUrl?: string): { subject: string; html: string } {
  const content = `
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#16a34a">SMTP is working! &#10003;</h1>
    <p style="margin:0 0 12px;color:#444444">Your verifykm email configuration is correctly set up.</p>
    <p style="margin:0;color:#444444">You can now send transactional emails including welcome messages, VIN report notifications, and payment confirmations.</p>
  `;
  return {
    subject: "verifykm — SMTP test email",
    html: buildEmailBase(content, "Your verifykm SMTP configuration is working correctly.", siteUrl),
  };
}

// ── Admin pending VIN notification ─────────────────────────────────────────────

export interface PendingVinAdminEmailData {
  vin: string;
  vehicleLabel: string;
  adminUrl: string;
  isNewPending: boolean;
  requestCount: number;
  customerEmail?: string | null;
  customerName?: string | null;
  siteUrl?: string;
}

export function buildPendingVinAdminEmail(
  data: PendingVinAdminEmailData,
): { subject: string; html: string; text: string } {
  const siteUrl = (data.siteUrl ?? "https://verifykm.com").replace(/\/$/, "");
  const customerLine = data.customerEmail
    ? `${data.customerName ? `${data.customerName} (` : ""}${data.customerEmail}${data.customerName ? ")" : ""}`
    : "—";

  const subject = data.isNewPending
    ? `Action required: new pending VIN check — ${data.vin}`
    : `Pending VIN update — ${data.requestCount} customer${data.requestCount === 1 ? "" : "s"} waiting (${data.vin})`;

  const headline = data.isNewPending
    ? "New pending VIN check"
    : "Another customer paid for a pending VIN";

  const intro = data.isNewPending
    ? "A customer paid for a VIN report that is not in the catalog yet. Review the draft, add data, and publish when ready."
    : "Another customer paid for a VIN that is already in the pending queue. Publish when the report is ready — all waiting customers will be notified.";

  const content = `
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#111111">${headline}</h1>
    <p style="margin:0 0 16px;color:#444444">${intro}</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:14px;color:#555555;font-family:Arial,Helvetica,sans-serif">VIN</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:14px;font-weight:700;color:#111111;text-align:right;font-family:monospace">${data.vin}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:14px;color:#555555;font-family:Arial,Helvetica,sans-serif">Vehicle</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:14px;font-weight:700;color:#111111;text-align:right;font-family:Arial,Helvetica,sans-serif">${data.vehicleLabel}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:14px;color:#555555;font-family:Arial,Helvetica,sans-serif">Customer</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:14px;font-weight:700;color:#111111;text-align:right;font-family:Arial,Helvetica,sans-serif">${customerLine}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;font-size:14px;color:#555555;font-family:Arial,Helvetica,sans-serif">Customers waiting</td>
        <td style="padding:10px 16px;font-size:14px;font-weight:700;color:#111111;text-align:right;font-family:Arial,Helvetica,sans-serif">${data.requestCount}</td>
      </tr>
    </table>
    <table cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td bgcolor="#d97706" style="border-radius:8px">
          <a href="${data.adminUrl}" style="display:inline-block;padding:13px 28px;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;font-family:Arial,Helvetica,sans-serif">Review &amp; Publish &rarr;</a>
        </td>
      </tr>
    </table>
    <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;font-family:Arial,Helvetica,sans-serif">
      Open the admin queue: <a href="${siteUrl}/adminx/pending-vin-checks" style="color:#d97706">${siteUrl}/adminx/pending-vin-checks</a>
    </p>
  `;

  const text = [
    headline,
    "",
    intro,
    "",
    `VIN: ${data.vin}`,
    `Vehicle: ${data.vehicleLabel}`,
    `Customer: ${customerLine}`,
    `Customers waiting: ${data.requestCount}`,
    "",
    `Review: ${data.adminUrl}`,
  ].join("\n");

  return {
    subject,
    html: buildEmailBase(content, subject, siteUrl),
    text,
  };
}
