import { db, paymentsTable, vinLookupsTable } from "@workspace/db";
import { and, eq, exists, inArray, or, type SQL } from "drizzle-orm";

/** Lookup outcomes that count as a real delivered (or queued) report for the customer. */
export const FULFILLED_LOOKUP_STATUSES = ["complete", "pending_manual"] as const;

/** Payment kinds that are real money/history without a VIN lookup row. */
export const NON_LOOKUP_PAYMENT_KINDS = ["credit_pack", "credit_redemption"] as const;

/** Prepaid credit spend — always €0; revenue was collected on credit_pack purchase. */
export const REVENUE_EXCLUDED_PAYMENT_KINDS = ["credit_redemption"] as const;

/**
 * SQL fragment (payments alias `p`): rows that contribute to collected revenue.
 * Includes credit_pack + vin_report cash; excludes credit_redemption redemptions.
 */
export const SQL_COLLECTED_REVENUE_ROW_FILTER =
  "p.status IN ('completed', 'revoked') AND COALESCE(p.kind, 'vin_report') <> 'credit_redemption'";

/** Payment is linked to a fulfilled VIN report (unlock or manual pending queue). */
export function paymentHasFulfilledLookup(): SQL {
  return exists(
    db
      .select({ id: vinLookupsTable.id })
      .from(vinLookupsTable)
      .where(
        and(
          eq(vinLookupsTable.paymentId, paymentsTable.id),
          inArray(vinLookupsTable.status, [...FULFILLED_LOOKUP_STATUSES]),
        ),
      ),
  );
}

/** Completed credit pack / redemption (no VIN lookup required). */
export function paymentIsCompletedNonLookupKind(): SQL {
  return and(
    eq(paymentsTable.status, "completed"),
    inArray(paymentsTable.kind, [...NON_LOOKUP_PAYMENT_KINDS]),
  )!;
}

/**
 * Rows that belong in admin/client transaction history.
 * - Completed/revoked VIN payments with a fulfilled lookup
 * - Revoked payments even after lookups were removed (pending VIN credit/remove)
 * - Refunded payments after pending remove+refund (sales deducted, history kept)
 * - Completed credit packs / redemptions
 */
export function recordedTransactionWhere(extra?: SQL): SQL {
  const base = or(
    and(
      paymentHasFulfilledLookup(),
      or(eq(paymentsTable.status, "completed"), eq(paymentsTable.status, "revoked")),
    ),
    eq(paymentsTable.status, "revoked"),
    eq(paymentsTable.status, "refunded"),
    paymentIsCompletedNonLookupKind(),
  )!;
  return extra ? and(base, extra)! : base;
}

/**
 * Money we kept: completed sales and revoked access after pending credit/remove.
 * Refunded/voided/failed are excluded — revoking must not deduct revenue.
 */
export function isCollectedRevenueStatus(status: string): boolean {
  return status === "completed" || status === "revoked";
}

export function isRevenueExcludedPaymentKind(kind: string | null | undefined): boolean {
  return (kind ?? "vin_report") === "credit_redemption";
}

/** Whether a payment row contributes to admin revenue totals. */
export function countsAsCollectedRevenue(payment: {
  status: string;
  kind?: string | null;
}): boolean {
  if (!isCollectedRevenueStatus(payment.status)) return false;
  return !isRevenueExcludedPaymentKind(payment.kind);
}

export function sumCollectedRevenue(
  rows: Array<{ status: string; kind?: string | null; rev?: number | null; revenue?: number | null }>,
): number {
  let total = 0;
  for (const row of rows) {
    if (!countsAsCollectedRevenue(row)) continue;
    total += Number(row.rev ?? row.revenue ?? 0);
  }
  return total;
}

/** Mark payment completed and link to the lookup that unlocked the report. */
export async function finalizePaymentOnFulfillment(
  paymentId: number | null | undefined,
  lookupId: number,
): Promise<void> {
  if (!paymentId) return;
  await db
    .update(paymentsTable)
    .set({
      status: "completed",
      vinLookupId: lookupId,
      updatedAt: new Date(),
    })
    .where(eq(paymentsTable.id, paymentId));
}

export function isPaymentUsableForLookup(
  payment: { status: string; amount: number | null | undefined; userId: string },
  userId: string,
): boolean {
  if (payment.userId !== userId) return false;
  if (payment.status === "completed") return true;
  if (payment.status === "pending" && Number(payment.amount ?? 0) === 0) return true;
  return false;
}
