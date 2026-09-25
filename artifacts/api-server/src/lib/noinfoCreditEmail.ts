import { db, systemSettingsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { logger } from "./logger.js";

/**
 * Customer email after admin closes a pending VIN with no usable data
 * and grants one free report credit.
 */
export async function fireNoinfoCreditEmail(opts: {
  vin: string;
  user: { name: string | null; email: string | null } | undefined;
  credits?: number;
}): Promise<boolean> {
  const email = opts.user?.email?.trim();
  if (!email) {
    logger.warn({ vin: opts.vin }, "No-info credit email skipped — no recipient email");
    return false;
  }

  try {
    const [settings] = await db
      .select({
        emailSendNoinfo: systemSettingsTable.emailSendNoinfo,
        siteUrl: systemSettingsTable.siteUrl,
        emailTemplates: systemSettingsTable.emailTemplates,
      })
      .from(systemSettingsTable)
      .orderBy(desc(systemSettingsTable.id))
      .limit(1);

    if (settings?.emailSendNoinfo === false) {
      logger.info({ vin: opts.vin, email }, "No-info credit email skipped — trigger disabled");
      return false;
    }

    const siteUrl = settings?.siteUrl?.replace(/\/$/, "") ?? "https://verifykm.com";
    const templates = (settings?.emailTemplates ?? {}) as import("@workspace/db").EmailTemplatesConfig;
    const credits = String(opts.credits ?? 1);
    const { sendEmail, buildNoinfoCreditEmail } = await import("./emailService.js");

    const result = await sendEmail({
      to: email,
      logType: "noinfo",
      logMeta: { vin: opts.vin, credits },
      ...buildNoinfoCreditEmail(
        {
          name: opts.user?.name ?? email.split("@")[0],
          vin: opts.vin.toUpperCase(),
          credits,
          checkoutUrl: `${siteUrl}/en`,
          siteUrl,
        },
        templates.noinfo,
      ),
    });

    if (!result.ok) {
      logger.warn({ vin: opts.vin, email, err: result.error }, "No-info credit email failed");
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ vin: opts.vin, email, err }, "No-info credit email threw");
    return false;
  }
}
