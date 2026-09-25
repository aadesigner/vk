/**
 * One-time ops: refresh Korean VIN catalog + assign to user.
 * Run: pnpm --filter @workspace/api-server exec vitest run src/scripts/seed-korean-registry-vin.test.ts
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
  const m = line.match(/^\s*([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const VIN = (process.env.SEED_VIN ?? "WBAGW4107LCD28117").toUpperCase();
const EMAIL = process.env.SEED_EMAIL ?? "armand9a@gmail.com";

describe("seed korean registry vin", () => {
  it(`refreshes ${VIN} and assigns to ${EMAIL}`, async () => {
    const { and, eq } = await import("drizzle-orm");
    const {
      db,
      providersTable,
      usersTable,
      vinCatalogTable,
      vinLookupsTable,
    } = await import("@workspace/db");
    const { fetchFromProvider } = await import("../lib/vinService");

    const [provider] = await db.select().from(providersTable).where(eq(providersTable.isActive, true)).limit(1);
    const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, EMAIL)).limit(1);

    expect(provider?.apiKey).toBeTruthy();
    expect(user?.id).toBeTruthy();

    const normalized = await fetchFromProvider(VIN, provider!.baseUrl, provider!.apiKey!);
    expect((normalized.registryHistory?.length ?? 0)).toBeGreaterThan(0);

    const payload = normalized as unknown as Record<string, unknown>;
    await db.insert(vinCatalogTable)
      .values({ vin: VIN, data: payload, providerName: provider!.name })
      .onConflictDoUpdate({
        target: vinCatalogTable.vin,
        set: { data: payload, providerName: provider!.name, updatedAt: new Date() },
      });

    await db.update(vinLookupsTable)
      .set({ data: payload, updatedAt: new Date() })
      .where(eq(vinLookupsTable.vin, VIN));

    const [existing] = await db.select({ id: vinLookupsTable.id })
      .from(vinLookupsTable)
      .where(and(
        eq(vinLookupsTable.vin, VIN),
        eq(vinLookupsTable.userId, user!.id),
        eq(vinLookupsTable.status, "complete"),
      ))
      .limit(1);

    if (!existing) {
      await db.insert(vinLookupsTable).values({
        vin: VIN,
        userId: user!.id,
        status: "complete",
        data: payload,
        providerName: provider!.name,
        fromCache: true,
        paymentId: null,
      });
    }
  }, 60_000);
});
