import { db, systemSettingsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { logger } from "./logger.js";

/**
 * Customer email after admin removes a pending VIN with no usable data
 * and marks the payment refunded (manual refund outside the app).
 */
export async function fireNoinfoRefundEmail(opts: {
  vin: string;
  user: { name: string | null; email: string | null } | undefined;
}): Promise<boolean> {
  const email = opts.user?.email?.trim();
  if (!email) {
    logger.warn({ vin: opts.vin }, "No-info refund email skipped — no recipient email");
    return false;
  }

  try {
    const [settings] = await db
      .select({
        emailSendNoinforefund: systemSettingsTable.emailSendNoinforefund,
        siteUrl: systemSettingsTable.siteUrl,
        emailTemplates: systemSettingsTable.emailTemplates,
      })
      .from(systemSettingsTable)
      .orderBy(desc(systemSettingsTable.id))
      .limit(1);

    if (settings?.emailSendNoinforefund === false) {
      logger.info({ vin: opts.vin, email }, "No-info refund email skipped — trigger disabled");
      return false;
    }

    const siteUrl = settings?.siteUrl?.replace(/\/$/, "") ?? "https://verifykm.com";
    const templates = (settings?.emailTemplates ?? {}) as import("@workspace/db").EmailTemplatesConfig;
    const { sendEmail, buildNoinfoRefundEmail } = await import("./emailService.js");

    const result = await sendEmail({
      to: email,
      logType: "noinforefund",
      logMeta: { vin: opts.vin },
      ...buildNoinfoRefundEmail(
        {
          name: opts.user?.name ?? email.split("@")[0],
          vin: opts.vin.toUpperCase(),
          checkoutUrl: `${siteUrl}/en`,
          siteUrl,
        },
        templates.noinforefund,
      ),
    });

    if (!result.ok) {
      logger.warn({ vin: opts.vin, email, err: result.error }, "No-info refund email failed");
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ vin: opts.vin, email, err }, "No-info refund email threw");
    return false;
  }
}
