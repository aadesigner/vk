import { db, systemSettingsTable, paymentsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { logger } from "./logger.js";
import { claimEmailDelivery, vinReadyEmailDeliveryKey } from "./emailDeliveryGuard.js";

export type ReportEmailPayment = {
  amount: number;
  currency: string;
  ref: string | null;
} | null;

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readOwners(d: Record<string, unknown>): number | null {
  const direct = toNumber(d.owners) ?? toNumber(d.ownerCount);
  if (direct != null) return direct;
  return Array.isArray(d.ownershipHistory) ? d.ownershipHistory.length : null;
}

function readAccidents(d: Record<string, unknown>): number | null {
  const direct = toNumber(d.accidentCount);
  if (direct != null) return direct;
  return Array.isArray(d.accidents) ? d.accidents.length : null;
}

/** Falls back to the payment attached to the lookup (manual publish path). */
async function resolvePayment(
  lookupId: number,
  provided: ReportEmailPayment,
): Promise<ReportEmailPayment> {
  if (provided) return provided;
  try {
    const [row] = await db
      .select({
        amount: paymentsTable.amount,
        currency: paymentsTable.currency,
        ref: paymentsTable.paypalOrderId,
      })
      .from(paymentsTable)
      .where(eq(paymentsTable.vinLookupId, lookupId))
      .orderBy(desc(paymentsTable.id))
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

/**
 * Fire-and-forget combined "report ready + payment confirmation" email, sent
 * after catalog publish or instant fulfillment.
 */
export async function fireVinReadyEmailForUser(
  lookupId: number,
  vin: string,
  data: Record<string, unknown> | null,
  user: { name: string | null; email: string } | undefined,
  payment: ReportEmailPayment = null,
): Promise<boolean> {
  if (!user?.email) {
    logger.warn({ vin, lookupId }, "Report ready email skipped — no recipient email on user record");
    return false;
  }

  const deliveryKey = vinReadyEmailDeliveryKey(lookupId, user.email);
  if (!claimEmailDelivery(deliveryKey)) {
    logger.info({ vin, lookupId, email: user.email }, "Report ready email skipped — duplicate guard");
    return false;
  }

  try {
    const [settings] = await db
      .select({
        emailSendVinReady: systemSettingsTable.emailSendVinReady,
        siteUrl: systemSettingsTable.siteUrl,
        emailTemplates: systemSettingsTable.emailTemplates,
      })
      .from(systemSettingsTable)
      .orderBy(desc(systemSettingsTable.id))
      .limit(1);
    if (settings?.emailSendVinReady === false) return false;

    const siteUrl = settings?.siteUrl?.replace(/\/$/, "") ?? "https://verifykm.com";
    const templates = (settings?.emailTemplates ?? {}) as import("@workspace/db").EmailTemplatesConfig;
    const { sendEmail, buildReportReadyEmail } = await import("./emailService.js");

    const d = data ?? {};
    const resolvedPayment = await resolvePayment(lookupId, payment);

    const result = await sendEmail({
      to: user.email,
      logType: "report",
      logMeta: { vin, lookupId },
      ...buildReportReadyEmail({
        name: user.name ?? user.email.split("@")[0],
        email: user.email,
        vin,
        // Unprefixed /vin/{VIN} so the SPA can redirect to the visitor's language
        // (stored preference / geo). Hardcoding /en/ would lock English.
        reportUrl: `${siteUrl}/vin/${encodeURIComponent(vin)}`,
        make: (d.make as string | null) ?? null,
        model: (d.model as string | null) ?? null,
        year: toNumber(d.year),
        mileage: toNumber(d.mileage) ?? toNumber(d.odometer),
        accidents: readAccidents(d),
        owners: readOwners(d),
        amount: resolvedPayment?.amount ?? null,
        currency: resolvedPayment?.currency ?? null,
        paymentRef: resolvedPayment?.ref ?? null,
        siteUrl,
      }, templates.vinready),
    });

    if (!result.ok) {
      logger.warn({ vin, lookupId, err: result.error }, "Report ready email failed");
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ vin, lookupId, err }, "Report ready email threw");
    return false;
  }
}
