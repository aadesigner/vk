import { db, usersTable } from "@workspace/db";
import { count } from "drizzle-orm";

export function adminEmailMatches(email: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  return !!adminEmail && email.toLowerCase().trim() === adminEmail;
}

/** Grant admin only when the first account on an empty DB uses ADMIN_EMAIL. */
export async function shouldBootstrapAdmin(email: string): Promise<boolean> {
  if (!adminEmailMatches(email)) return false;
  const [{ total }] = await db.select({ total: count() }).from(usersTable);
  return Number(total) === 0;
}
