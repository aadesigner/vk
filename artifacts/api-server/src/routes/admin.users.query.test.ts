import { describe, it, expect, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://localhost:5432/verifykm_test";
});

import { db, usersTable, vinLookupsTable, paymentsTable } from "@workspace/db";
import { eq, desc, count, sum, and, inArray, or, like, exists, not, sql } from "drizzle-orm";

function buildAdminUserWhere(searchRaw: string, status: string, checks: string) {
  const conditions = [];
  const search = searchRaw.trim();
  if (search) {
    conditions.push(or(like(usersTable.email, `%${search}%`), like(usersTable.name, `%${search}%`))!);
  }
  if (status === "banned") conditions.push(eq(usersTable.isBanned, true));
  if (status === "active") conditions.push(eq(usersTable.isBanned, false));
  if (checks === "checked") {
    conditions.push(
      exists(
        db.select({ one: sql`1` })
          .from(vinLookupsTable)
          .where(eq(vinLookupsTable.userId, usersTable.id)),
      ),
    );
  } else if (checks === "unchecked") {
    conditions.push(
      not(
        exists(
          db.select({ one: sql`1` })
            .from(vinLookupsTable)
            .where(eq(vinLookupsTable.userId, usersTable.id)),
        ),
      ),
    );
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

describe("admin users list query", () => {
  it("loads users with stats (no filters)", async () => {
    const where = buildAdminUserWhere("", "", "");
    const [users, totalRow] = await Promise.all([
      db.select().from(usersTable).where(where).orderBy(desc(usersTable.createdAt)).limit(5),
      db.select({ total: count() }).from(usersTable).where(where),
    ]);
    expect(totalRow[0]).toBeDefined();
    const userIds = users.map((u) => u.id);
    if (userIds.length === 0) return;
    const [checksStats, spentStats] = await Promise.all([
      db.select({ userId: vinLookupsTable.userId, total: count() })
        .from(vinLookupsTable)
        .where(inArray(vinLookupsTable.userId, userIds))
        .groupBy(vinLookupsTable.userId),
      db.select({ userId: paymentsTable.userId, total: sum(paymentsTable.amount) })
        .from(paymentsTable)
        .where(and(inArray(paymentsTable.userId, userIds), eq(paymentsTable.status, "completed")))
        .groupBy(paymentsTable.userId),
    ]);
    expect(Array.isArray(checksStats)).toBe(true);
    expect(Array.isArray(spentStats)).toBe(true);
  });

  it("supports checked / unchecked filters", async () => {
    const checkedWhere = buildAdminUserWhere("", "", "checked");
    const uncheckedWhere = buildAdminUserWhere("", "", "unchecked");
    await expect(
      db.select({ id: usersTable.id }).from(usersTable).where(checkedWhere).limit(1),
    ).resolves.toBeInstanceOf(Array);
    await expect(
      db.select({ id: usersTable.id }).from(usersTable).where(uncheckedWhere).limit(1),
    ).resolves.toBeInstanceOf(Array);
  });

  it("loads single user stats shape", async () => {
    const [user] = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
    if (!user) return;
    const userId = user.id;
    const [checksRow, spentRow] = await Promise.all([
      db.select({ totalChecks: count() }).from(vinLookupsTable).where(eq(vinLookupsTable.userId, userId)),
      db.select({ totalSpent: sum(paymentsTable.amount) })
        .from(paymentsTable)
        .where(and(eq(paymentsTable.userId, userId), eq(paymentsTable.status, "completed"))),
    ]);
    expect(checksRow[0]).toBeDefined();
    expect(spentRow[0]).toBeDefined();
    expect(checksRow[0]?.totalChecks).toBeDefined();
  });
});
