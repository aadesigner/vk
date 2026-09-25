import { db, systemSettingsTable, usersTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { logger } from "./logger.js";

/** Collect admin notification recipients from admin users + ADMIN_EMAIL env. */
export async function getAdminRecipientEmails(): Promise<string[]> {
  const admins = await db
    .select({ email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.isAdmin, true));

  const emails = new Set(
    admins
      .map((a) => a.email.trim().toLowerCase())
      .filter((e) => e.length > 0 && e.includes("@")),
  );

  const envAdmin = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (envAdmin && envAdmin.includes("@")) {
    emails.add(envAdmin);
  }

  return [...emails];
}

/** Notify admins when a customer pays for a manual-pending VIN report. */
export async function firePendingVinAdminNotification(opts: {
  pendingId: number;
  vin: string;
  isNewPending: boolean;
  requestCount: number;
  customer: { name: string | null; email: string } | null;
  vehicle: { year?: number | null; make?: string | null; model?: string | null };
}): Promise<void> {
  try {
    const [settings] = await db
      .select({
        siteUrl: systemSettingsTable.siteUrl,
        emailSendAdminPendingVin: systemSettingsTable.emailSendAdminPendingVin,
      })
      .from(systemSettingsTable)
      .orderBy(desc(systemSettingsTable.id))
      .limit(1);

    // Off by default — admins opt in from Admin → Emails.
    if (settings?.emailSendAdminPendingVin !== true) return;

    const recipients = await getAdminRecipientEmails();
    if (recipients.length === 0) {
      logger.warn({ vin: opts.vin }, "Pending VIN admin email skipped — no admin recipients");
      return;
    }

    const siteUrl = settings?.siteUrl?.replace(/\/$/, "") ?? "https://verifykm.com";
    const adminUrl = `${siteUrl}/adminx/pending-vin-checks/${opts.pendingId}`;
    const vehicleLabel = [opts.vehicle.year, opts.vehicle.make, opts.vehicle.model]
      .filter(Boolean)
      .join(" ") || opts.vin;

    const { sendEmail, buildPendingVinAdminEmail } = await import("./emailService.js");
    const payload = buildPendingVinAdminEmail({
      vin: opts.vin,
      vehicleLabel,
      adminUrl,
      isNewPending: opts.isNewPending,
      requestCount: opts.requestCount,
      customerEmail: opts.customer?.email ?? null,
      customerName: opts.customer?.name ?? null,
      siteUrl,
    });

    for (const to of recipients) {
      const result = await sendEmail({
        to,
        ...payload,
        logType: "admin_pending",
        logMeta: { vin: opts.vin },
      });
      if (!result.ok) {
        logger.warn({ vin: opts.vin, to, err: result.error }, "Pending VIN admin email failed");
      }
    }
  } catch (err) {
    logger.warn({ vin: opts.vin, err }, "Pending VIN admin email threw");
  }
}
