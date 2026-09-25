import { db, paymentsTable, usersTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { logger } from "./logger.js";

/**
 * Refund a credit_redemption payment: restore 1 credit and mark payment failed.
 * Idempotent if payment is already failed/refunded or not a credit redemption.
 */
export async function refundCreditRedemption(
  paymentId: number | null | undefined,
  reason: string,
): Promise<boolean> {
  if (!paymentId) return false;

  return db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, paymentId))
      .limit(1);

    if (!payment) return false;
    if (payment.kind !== "credit_redemption") return false;
    if (payment.status !== "completed") return false;

    await tx
      .update(paymentsTable)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(paymentsTable.id, paymentId));

    await tx
      .update(usersTable)
      .set({
        creditBalance: sql`${usersTable.creditBalance} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, payment.userId));

    logger.warn({
      msg: "credit_redemption_refunded",
      paymentId,
      userId: payment.userId,
      vin: payment.vin,
      reason,
    });
    return true;
  });
}

/** Grant pack credits once when capturing a credit_pack payment. */
export async function completeCreditPackPayment(
  paymentId: number,
  userId: string,
  credits: number,
): Promise<{ creditBalance: number; creditsAdded: number; alreadyCompleted: boolean }> {
  return db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(paymentsTable)
      .set({ status: "completed", updatedAt: new Date() })
      .where(
        and(
          eq(paymentsTable.id, paymentId),
          eq(paymentsTable.userId, userId),
          eq(paymentsTable.kind, "credit_pack"),
          eq(paymentsTable.status, "pending"),
        ),
      )
      .returning({ id: paymentsTable.id });

    if (!claimed) {
      const [payment] = await tx
        .select()
        .from(paymentsTable)
        .where(and(eq(paymentsTable.id, paymentId), eq(paymentsTable.userId, userId)))
        .limit(1);

      if (!payment) throw new Error("PAYMENT_NOT_FOUND");
      if (payment.kind !== "credit_pack") throw new Error("NOT_CREDIT_PACK");

      const [user] = await tx
        .select({ creditBalance: usersTable.creditBalance })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);

      return {
        creditBalance: user?.creditBalance ?? 0,
        creditsAdded: 0,
        alreadyCompleted: payment.status === "completed",
      };
    }

    const [updated] = await tx
      .update(usersTable)
      .set({
        creditBalance: sql`${usersTable.creditBalance} + ${credits}`,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, userId))
      .returning({ creditBalance: usersTable.creditBalance });

    return {
      creditBalance: updated?.creditBalance ?? credits,
      creditsAdded: credits,
      alreadyCompleted: false,
    };
  });
}
