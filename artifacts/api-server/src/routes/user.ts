import { Router } from "express";
import { db, usersTable, vinLookupsTable, paymentsTable } from "@workspace/db";
import { eq, desc, count, sum, and, gte, ne, type SQL } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { authSessionUserSelect } from "../lib/authUserSelect.js";
import { recordedTransactionWhere } from "../lib/recordedPayments.js";
import { transformVinPhotoData } from "../lib/imageProxy.js";
import { mediaVersionFromUpdatedAt } from "../lib/vinImageCache.js";
import { summarizeVinLookupData } from "../lib/vinLookupSummary.js";
import { userHistoryLimiter } from "../lib/expensiveEndpointLimiter.js";
import { parseUserCountryCode } from "../lib/userCountry.js";
import { parseUserPhone } from "../lib/userPhone.js";
import {
  MAX_COUNTRY_CHANGES_PER_DAY,
  countryChangesRemaining,
  nextCountryChangeCount,
} from "../lib/countryChangeLimit.js";
import {
  MAX_PHONE_CHANGES_PER_DAY,
  phoneChangesRemaining,
  nextPhoneChangeCount,
} from "../lib/phoneChangeLimit.js";

/** Safe positive int from query; rejects NaN / Infinity / junk. */
function parsePositiveInt(raw: unknown, fallback: number): number {
  const n = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Hard caps so deep OFFSET / huge limit cannot abuse the DB. */
const HISTORY_MAX_LIMIT = 50;
const HISTORY_MAX_PAGE = 500;

function proxyVinRow(row: Record<string, unknown>): Record<string, unknown> {
  const mediaVersion = mediaVersionFromUpdatedAt(
    row.updatedAt as Date | string | null | undefined,
  );
  const { providerName: _providerName, ...rest } = row;
  const result: Record<string, unknown> = { ...rest };

  if (result.data && typeof result.data === "object" && !Array.isArray(result.data)) {
    result.data = transformVinPhotoData(result.data, mediaVersion);
  }

  return result;
}

const router = Router();

/** User-facing lists exclude admin-revoked lookups (row kept in DB for audit). */
function activeUserLookupWhere(userId: string): SQL {
  return and(eq(vinLookupsTable.userId, userId), ne(vinLookupsTable.status, "revoked"))!;
}

function profilePayload(
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    isBanned: boolean;
    isAdmin: boolean;
    countryCode: string | null;
    phonePrefix: string | null;
    phoneNational: string | null;
    creditBalance?: number;
    createdAt: Date;
  },
  extras: {
    countryChangesRemaining: number;
    phoneChangesRemaining: number;
    totalChecks?: number;
    totalSpent?: number;
  },
) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    isBanned: user.isBanned,
    isAdmin: user.isAdmin,
    countryCode: user.countryCode ?? null,
    countryChangesRemaining: extras.countryChangesRemaining,
    countryChangesLimit: MAX_COUNTRY_CHANGES_PER_DAY,
    phonePrefix: user.phonePrefix ?? null,
    phoneNational: user.phoneNational ?? null,
    phoneChangesRemaining: extras.phoneChangesRemaining,
    phoneChangesLimit: MAX_PHONE_CHANGES_PER_DAY,
    creditBalance: user.creditBalance ?? 0,
    ...(extras.totalChecks !== undefined ? { totalChecks: extras.totalChecks } : {}),
    ...(extras.totalSpent !== undefined ? { totalSpent: extras.totalSpent } : {}),
    createdAt: user.createdAt,
  };
}

// GET /user/profile
router.get("/user/profile", requireAuth, async (req, res) => {
  const userId = req.userId!;

  const [user] = await db
    .select({
      ...authSessionUserSelect,
      countryChangeDay: usersTable.countryChangeDay,
      countryChangeCount: usersTable.countryChangeCount,
      phoneChangeDay: usersTable.phoneChangeDay,
      phoneChangeCount: usersTable.phoneChangeCount,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [checksResult] = await db.select({ total: count() }).from(vinLookupsTable).where(activeUserLookupWhere(userId));
  const [spentResult] = await db.select({ total: sum(paymentsTable.amount) }).from(paymentsTable)
    .where(recordedTransactionWhere(eq(paymentsTable.userId, userId)));

  res.setHeader("Cache-Control", "private, no-store");
  res.json(profilePayload(user, {
    countryChangesRemaining: countryChangesRemaining(user.countryChangeDay, user.countryChangeCount),
    phoneChangesRemaining: phoneChangesRemaining(user.phoneChangeDay, user.phoneChangeCount),
    totalChecks: checksResult?.total ?? 0,
    totalSpent: Number(spentResult?.total ?? 0),
  }));
});

// PATCH /user/profile — country and/or phone (separate 2/day UTC limits)
router.patch("/user/profile", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const body = req.body as {
    countryCode?: string | null;
    phonePrefix?: string | null;
    phoneNational?: string | null;
  };

  const hasCountry = body.countryCode !== undefined;
  const hasPhone = body.phonePrefix !== undefined || body.phoneNational !== undefined;

  if (!hasCountry && !hasPhone) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  let nextCountry: string | null | undefined;
  if (hasCountry) {
    const countryCode = parseUserCountryCode(body.countryCode);
    if (body.countryCode !== null && body.countryCode !== "" && !countryCode) {
      res.status(400).json({ error: "Invalid country", code: "INVALID_COUNTRY" });
      return;
    }
    nextCountry = countryCode;
  }

  let nextPhone: { prefix: string | null; national: string | null } | undefined;
  if (hasPhone) {
    const parsed = parseUserPhone({
      phonePrefix: body.phonePrefix,
      phoneNational: body.phoneNational,
    });
    if (!parsed) {
      res.status(400).json({
        error: "Enter a valid dialing prefix and phone number (digits only).",
        code: "INVALID_PHONE",
      });
      return;
    }
    nextPhone = parsed;
  }

  const [current] = await db
    .select({
      countryCode: usersTable.countryCode,
      countryChangeDay: usersTable.countryChangeDay,
      countryChangeCount: usersTable.countryChangeCount,
      phonePrefix: usersTable.phonePrefix,
      phoneNational: usersTable.phoneNational,
      phoneChangeDay: usersTable.phoneChangeDay,
      phoneChangeCount: usersTable.phoneChangeCount,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!current) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  let countryRemaining = countryChangesRemaining(current.countryChangeDay, current.countryChangeCount);
  let phoneRemaining = phoneChangesRemaining(current.phoneChangeDay, current.phoneChangeCount);
  let countryDay = current.countryChangeDay;
  let countryCount = current.countryChangeCount;
  let phoneDay = current.phoneChangeDay;
  let phoneCount = current.phoneChangeCount;

  if (hasCountry && nextCountry !== undefined) {
    const previous = current.countryCode ?? null;
    if (previous !== nextCountry) {
      if (countryRemaining <= 0) {
        res.status(429).json({
          error: "You can change country / nationality at most twice per day.",
          code: "COUNTRY_CHANGE_LIMIT",
          countryChangesRemaining: 0,
          countryChangesLimit: MAX_COUNTRY_CHANGES_PER_DAY,
        });
        return;
      }
      const bump = nextCountryChangeCount(current.countryChangeDay, current.countryChangeCount);
      updates.countryCode = nextCountry;
      updates.countryChangeDay = bump.day;
      updates.countryChangeCount = bump.count;
      countryDay = bump.day;
      countryCount = bump.count;
      countryRemaining = countryChangesRemaining(bump.day, bump.count);
    }
  }

  if (hasPhone && nextPhone) {
    const prevPrefix = current.phonePrefix ?? null;
    const prevNational = current.phoneNational ?? null;
    const phoneChanged = prevPrefix !== nextPhone.prefix || prevNational !== nextPhone.national;
    if (phoneChanged) {
      if (phoneRemaining <= 0) {
        res.status(429).json({
          error: "You can change your phone number at most twice per day.",
          code: "PHONE_CHANGE_LIMIT",
          phoneChangesRemaining: 0,
          phoneChangesLimit: MAX_PHONE_CHANGES_PER_DAY,
        });
        return;
      }
      const bump = nextPhoneChangeCount(current.phoneChangeDay, current.phoneChangeCount);
      updates.phonePrefix = nextPhone.prefix;
      updates.phoneNational = nextPhone.national;
      updates.phoneChangeDay = bump.day;
      updates.phoneChangeCount = bump.count;
      phoneDay = bump.day;
      phoneCount = bump.count;
      phoneRemaining = phoneChangesRemaining(bump.day, bump.count);
    }
  }

  if (Object.keys(updates).length === 1) {
    const [user] = await db
      .select(authSessionUserSelect)
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.setHeader("Cache-Control", "private, no-store");
    res.json(profilePayload(user, {
      countryChangesRemaining: countryRemaining,
      phoneChangesRemaining: phoneRemaining,
    }));
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set(updates as Parameters<ReturnType<typeof db.update>["set"]>[0])
    .where(eq(usersTable.id, userId))
    .returning(authSessionUserSelect);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.setHeader("Cache-Control", "private, no-store");
  res.json(profilePayload(user, {
    countryChangesRemaining: countryChangesRemaining(countryDay, countryCount),
    phoneChangesRemaining: phoneChangesRemaining(phoneDay, phoneCount),
  }));
});

// GET /user/history
router.get("/user/history", requireAuth, userHistoryLimiter, async (req, res) => {
  const userId = req.userId!;
  const page = Math.min(HISTORY_MAX_PAGE, parsePositiveInt(req.query.page, 1));
  const limit = Math.min(HISTORY_MAX_LIMIT, parsePositiveInt(req.query.limit, 20));
  const offset = (page - 1) * limit;
  const summaryView = String(req.query.view ?? "").toLowerCase() === "summary";

  const [rows, [{ total }]] = await Promise.all([
    db.select().from(vinLookupsTable)
      .where(activeUserLookupWhere(userId))
      .orderBy(desc(vinLookupsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(vinLookupsTable).where(activeUserLookupWhere(userId)),
  ]);

  const items = rows.map((row) => {
    const rowObj = row as unknown as Record<string, unknown>;
    if (summaryView && rowObj.data) {
      rowObj.data = summarizeVinLookupData(rowObj.data);
    }
    return proxyVinRow(rowObj);
  });
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ items, total, page, limit });
});

// GET /user/payments
router.get("/user/payments", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
  const offset = (page - 1) * limit;

  const fulfilledForUser = recordedTransactionWhere(eq(paymentsTable.userId, userId));

  const [items, [{ total }]] = await Promise.all([
    db.select().from(paymentsTable)
      .where(fulfilledForUser)
      .orderBy(desc(paymentsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(paymentsTable).where(fulfilledForUser),
  ]);

  res.setHeader("Cache-Control", "private, no-store");
  res.json({ items, total, page, limit });
});

// GET /user/credit-purchases — this user's credit_pack payments
router.get("/user/credit-purchases", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
  const offset = (page - 1) * limit;

  const where = and(
    eq(paymentsTable.userId, userId),
    eq(paymentsTable.kind, "credit_pack"),
    eq(paymentsTable.status, "completed"),
  );

  const [items, [{ total }]] = await Promise.all([
    db.select({
      id: paymentsTable.id,
      amount: paymentsTable.amount,
      currency: paymentsTable.currency,
      status: paymentsTable.status,
      credits: paymentsTable.credits,
      createdAt: paymentsTable.createdAt,
    })
      .from(paymentsTable)
      .where(where)
      .orderBy(desc(paymentsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(paymentsTable).where(where),
  ]);

  res.setHeader("Cache-Control", "private, no-store");
  res.json({ items, total, page, limit });
});

// GET /user/stats
router.get("/user/stats", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [totalChecks, totalSpent, checksThisMonth, completedPayments, paymentCurrencyRow] = await Promise.all([
    db.select({ total: count() }).from(vinLookupsTable).where(activeUserLookupWhere(userId)),
    db.select({ total: sum(paymentsTable.amount) }).from(paymentsTable)
      .where(recordedTransactionWhere(eq(paymentsTable.userId, userId))),
    db.select({ total: count() }).from(vinLookupsTable)
      .where(and(activeUserLookupWhere(userId), gte(vinLookupsTable.createdAt, monthStart))),
    db.select({ total: count() }).from(paymentsTable)
      .where(recordedTransactionWhere(eq(paymentsTable.userId, userId))),
    db.select({ currency: paymentsTable.currency }).from(paymentsTable)
      .where(recordedTransactionWhere(eq(paymentsTable.userId, userId)))
      .orderBy(desc(paymentsTable.createdAt))
      .limit(1),
  ]);

  res.setHeader("Cache-Control", "private, no-store");
  res.json({
    totalChecks: totalChecks[0]?.total ?? 0,
    totalSpent: Number(totalSpent[0]?.total ?? 0),
    checksThisMonth: checksThisMonth[0]?.total ?? 0,
    completedPayments: completedPayments[0]?.total ?? 0,
    paymentCurrency: paymentCurrencyRow[0]?.currency ?? "USD",
    recentChecks: [],
  });
});

// DELETE /user/vin/:id — user deletes their own failed lookup
router.delete("/user/vin/:id", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [lookup] = await db.select().from(vinLookupsTable)
    .where(eq(vinLookupsTable.id, id))
    .limit(1);

  if (!lookup) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  if (lookup.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (lookup.status !== "error") {
    res.status(400).json({ error: "Only failed lookups can be deleted" });
    return;
  }

  await db.delete(vinLookupsTable).where(eq(vinLookupsTable.id, id));
  res.status(204).send();
});

export default router;
