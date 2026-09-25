/**
 * Shared POK payment confirmation — used by client confirm routes and webhooks.
 * Always re-verifies order status with POK API before marking completed.
 */
import { db, paymentsTable, couponsTable, type Payment } from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { completeCreditPackPayment } from "./creditRedemption.js";
import { invalidateAdminStatsCache } from "./adminStatsInvalidation.js";
import { logger } from "./logger.js";
import {
  pokAmountsMatch,
  resolvePokConfig,
  waitForPokOrderCompleted,
  type PokSdkOrder,
} from "./pokClient.js";

export type PokConfirmSource = "client" | "webhook";

export type PokConfirmSuccess = {
  ok: true;
  payment: Payment;
  alreadyCompleted: boolean;
  creditsAdded?: number;
  creditBalance?: number;
};

export type PokConfirmFailure = {
  ok: false;
  code: string;
  httpStatus: number;
  retryable: boolean;
  error: string;
};

export type PokConfirmResult = PokConfirmSuccess | PokConfirmFailure;

async function releaseCouponUseByCode(code: string | null | undefined): Promise<void> {
  if (!code?.trim()) return;
  const [coupon] = await db.select({ id: couponsTable.id })
    .from(couponsTable)
    .where(eq(couponsTable.code, code.toUpperCase().trim()))
    .limit(1);
  if (!coupon) return;
  await db
    .update(couponsTable)
    .set({ uses: sql`GREATEST(${couponsTable.uses} - 1, 0)`, updatedAt: new Date() })
    .where(eq(couponsTable.id, coupon.id));
}

async function markVinReportCompleted(paymentId: number, userId: string): Promise<Payment | null> {
  const [claimed] = await db
    .update(paymentsTable)
    .set({ status: "completed", updatedAt: new Date() })
    .where(
      and(
        eq(paymentsTable.id, paymentId),
        eq(paymentsTable.userId, userId),
        inArray(paymentsTable.status, ["pending", "failed"]),
      ),
    )
    .returning();

  if (claimed) return claimed;

  const [existing] = await db.select().from(paymentsTable)
    .where(and(eq(paymentsTable.id, paymentId), eq(paymentsTable.userId, userId)))
    .limit(1);
  return existing ?? null;
}

function amountMismatchFailure(
  payment: Payment,
  order: PokSdkOrder,
  source: PokConfirmSource,
): PokConfirmFailure {
  logger.error({
    msg: source === "webhook" ? "pok_webhook_amount_mismatch" : "pok_confirm_amount_mismatch",
    orderId: payment.pokOrderId,
    paymentId: payment.id,
    expectedAmount: payment.amount,
    expectedCurrency: payment.currency,
    orderAmount: order.amount,
    orderCurrency: order.currencyCode,
  });
  return {
    ok: false,
    code: "PAYMENT_AMOUNT_MISMATCH",
    httpStatus: 402,
    retryable: false,
    error: "Payment amount verification failed. Please contact support.",
  };
}

async function handleAmountMismatch(
  payment: Payment,
  order: PokSdkOrder,
  source: PokConfirmSource,
): Promise<PokConfirmFailure> {
  await db.update(paymentsTable)
    .set({ status: "failed", updatedAt: new Date() })
    .where(and(eq(paymentsTable.id, payment.id), eq(paymentsTable.status, "pending")));
  await releaseCouponUseByCode(payment.couponCode);
  return amountMismatchFailure(payment, order, source);
}

/**
 * Confirm a POK payment row after verifying completion with POK API (poll + guest-confirm).
 * Keeps status `pending` when POK is not complete yet — never marks failed on timing alone.
 */
export async function confirmPokPaymentRecord(
  payment: Payment,
  opts: { userId?: string; source: PokConfirmSource; expectedKind?: "vin_report" | "credit_pack" },
): Promise<PokConfirmResult> {
  const orderId = payment.pokOrderId;
  if (!orderId) {
    return {
      ok: false,
      code: "PAYMENT_NOT_FOUND",
      httpStatus: 404,
      retryable: false,
      error: "Payment not found",
    };
  }

  if (opts.userId && payment.userId !== opts.userId) {
    return {
      ok: false,
      code: "PAYMENT_NOT_FOUND",
      httpStatus: 404,
      retryable: false,
      error: "Payment not found",
    };
  }

  const kind = payment.kind ?? "vin_report";
  if (opts.expectedKind && kind !== opts.expectedKind) {
    return {
      ok: false,
      code: "WRONG_PAYMENT_KIND",
      httpStatus: 400,
      retryable: false,
      error: "Wrong payment kind for this endpoint",
    };
  }

  if (payment.status === "refunded") {
    return {
      ok: false,
      code: "PAYMENT_NOT_FOUND",
      httpStatus: 404,
      retryable: false,
      error: "Payment not found",
    };
  }

  if (payment.status === "completed") {
    if (kind === "credit_pack") {
      const { usersTable } = await import("@workspace/db");
      const [user] = await db.select({ creditBalance: usersTable.creditBalance })
        .from(usersTable).where(eq(usersTable.id, payment.userId)).limit(1);
      return {
        ok: true,
        payment,
        alreadyCompleted: true,
        creditsAdded: 0,
        creditBalance: user?.creditBalance ?? 0,
      };
    }
    return { ok: true, payment, alreadyCompleted: true };
  }

  if (!(await resolvePokConfig())) {
    return {
      ok: false,
      code: "POK_NOT_CONFIGURED",
      httpStatus: 503,
      retryable: true,
      error: "Card payment is not configured.",
    };
  }

  try {
    const { order, completed, attempts } = await waitForPokOrderCompleted(orderId);

    if (!completed) {
      logger.warn({
        msg: opts.source === "webhook" ? "pok_webhook_not_completed" : "pok_confirm_not_completed",
        orderId,
        paymentId: payment.id,
        userId: payment.userId,
        vin: payment.vin,
        attempts,
        source: opts.source,
      });
      return {
        ok: false,
        code: "PAYMENT_NOT_COMPLETED",
        httpStatus: 402,
        retryable: true,
        error: "Payment was not completed. Please try again.",
      };
    }

    if (!pokAmountsMatch(Number(payment.amount), payment.currency, order)) {
      return handleAmountMismatch(payment, order, opts.source);
    }

    if (kind === "credit_pack") {
      const credits = Number(payment.credits ?? 0);
      if (credits < 1) {
        return {
          ok: false,
          code: "INVALID_CREDITS",
          httpStatus: 500,
          retryable: false,
          error: "Invalid credit pack payment",
        };
      }
      const result = await completeCreditPackPayment(payment.id, payment.userId, credits);
      const [fresh] = await db.select().from(paymentsTable)
        .where(eq(paymentsTable.id, payment.id))
        .limit(1);
      if (!fresh || fresh.status !== "completed") {
        return {
          ok: false,
          code: "PAYMENT_CONFIRM_FAILED",
          httpStatus: 503,
          retryable: true,
          error: "Failed to confirm payment. Please try again.",
        };
      }
      logger.info({
        msg: opts.source === "webhook" ? "pok_webhook_credit_pack_confirmed" : "payment_confirmed",
        type: "pok",
        orderId,
        paymentId: payment.id,
        userId: payment.userId,
        creditsAdded: result.creditsAdded,
        amount: payment.amount,
        source: opts.source,
      });
      invalidateAdminStatsCache();
      return {
        ok: true,
        payment: fresh,
        alreadyCompleted: result.alreadyCompleted,
        creditsAdded: result.creditsAdded,
        creditBalance: result.creditBalance,
      };
    }

    const updated = await markVinReportCompleted(payment.id, payment.userId);
    if (!updated || updated.status !== "completed") {
      const [fresh] = await db.select().from(paymentsTable)
        .where(eq(paymentsTable.id, payment.id))
        .limit(1);
      if (fresh?.status === "completed") {
        return { ok: true, payment: fresh, alreadyCompleted: true };
      }
      return {
        ok: false,
        code: "PAYMENT_CONFIRM_FAILED",
        httpStatus: 503,
        retryable: true,
        error: "Failed to confirm payment. Please try again.",
      };
    }

    logger.info({
      msg: opts.source === "webhook" ? "pok_webhook_payment_confirmed" : "payment_confirmed",
      type: "pok",
      orderId,
      paymentId: payment.id,
      userId: payment.userId,
      vin: payment.vin,
      amount: payment.amount,
      currency: payment.currency,
      source: opts.source,
    });

    return { ok: true, payment: updated, alreadyCompleted: false };
  } catch (err) {
    logger.error({ err, orderId, paymentId: payment.id, source: opts.source }, "POK confirm failed");

    const [fresh] = await db.select().from(paymentsTable)
      .where(eq(paymentsTable.pokOrderId, orderId))
      .limit(1);
    if (fresh?.status === "completed") {
      if (kind === "credit_pack") {
        const { usersTable } = await import("@workspace/db");
        const [user] = await db.select({ creditBalance: usersTable.creditBalance })
          .from(usersTable).where(eq(usersTable.id, fresh.userId)).limit(1);
        return {
          ok: true,
          payment: fresh,
          alreadyCompleted: true,
          creditsAdded: 0,
          creditBalance: user?.creditBalance ?? 0,
        };
      }
      return { ok: true, payment: fresh, alreadyCompleted: true };
    }

    return {
      ok: false,
      code: "PAYMENT_CONFIRM_FAILED",
      httpStatus: 503,
      retryable: true,
      error: "Failed to confirm payment. Please try again.",
    };
  }
}

export async function confirmPokPaymentByOrderId(
  orderId: string,
  opts: { userId?: string; source: PokConfirmSource; expectedKind?: "vin_report" | "credit_pack" },
): Promise<PokConfirmResult> {
  const [payment] = await db.select().from(paymentsTable)
    .where(eq(paymentsTable.pokOrderId, orderId))
    .limit(1);

  if (!payment) {
    return {
      ok: false,
      code: "PAYMENT_NOT_FOUND",
      httpStatus: 404,
      retryable: false,
      error: "Payment not found",
    };
  }

  return confirmPokPaymentRecord(payment, opts);
}
