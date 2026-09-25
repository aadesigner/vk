/**
 * Inspect Carstat image tiers vs normalized photo count.
 * Run: pnpm --filter @workspace/api-server exec vitest run src/scripts/peek-vin-photos.test.ts
 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
  const m = line.match(/^\s*([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const VIN = (process.env.PEEK_VIN ?? "WBAGV8106RCR24769").toUpperCase();

function sample(v: unknown): string {
  if (typeof v === "string") return v.slice(0, 100);
  if (v && typeof v === "object") return JSON.stringify(v).slice(0, 140);
  return String(v);
}

describe("peek vin photos", () => {
  it(`inspects images for ${VIN}`, async () => {
    const { eq } = await import("drizzle-orm");
    const { db, providersTable, vinCatalogTable } = await import("@workspace/db");
    const { pickBestLotPhotoUrls, normalizeCarstatResponse } = await import("../lib/vinService");

    const [provider] = await db.select().from(providersTable).where(eq(providersTable.isActive, true)).limit(1);
    if (!provider?.apiKey) throw new Error("No active provider");

    const base = String(provider.baseUrl).replace(/\/$/, "").replace("://api.carstat.dev", "://carstat.dev");
    const res = await fetch(`${base}/api/local-report/${encodeURIComponent(VIN)}`, {
      headers: { Accept: "application/json", "x-api-key": provider.apiKey },
    });
    const body = await res.json() as Record<string, unknown>;
    const lots = (body.lots ?? (body.data as Record<string, unknown> | undefined)?.lots ?? []) as Record<string, unknown>[];

    console.log("HTTP", res.status, "| lots:", lots.length);

    for (let i = 0; i < lots.length; i++) {
      const l = lots[i]!;
      const domain = (l.domain as Record<string, unknown> | undefined)?.name ?? l.domain;
      const imgs = (l.images ?? {}) as Record<string, unknown>;
      const keys = Object.keys(imgs);
      console.log(`\nLot ${i} | domain: ${String(domain)} | image keys: ${keys.join(", ") || "(none)"}`);
      for (const k of keys) {
        const arr = imgs[k];
        if (!Array.isArray(arr)) {
          console.log(`  ${k}: ${typeof arr} ${sample(arr)}`);
          continue;
        }
        console.log(`  ${k}: count=${arr.length}`);
        if (arr.length > 0) console.log(`    [0] ${sample(arr[0])}`);
        if (arr.length > 1) console.log(`    [1] ${sample(arr[1])}`);
      }
      console.log(`  pickBest: ${pickBestLotPhotoUrls(imgs).length}`);
    }

    const [cat] = await db.select().from(vinCatalogTable).where(eq(vinCatalogTable.vin, VIN)).limit(1);
    const dbPhotos = (cat?.data as Record<string, unknown> | undefined)?.photos;
    console.log(`\nDB catalog photos: ${Array.isArray(dbPhotos) ? dbPhotos.length : 0}`);

    const normalized = normalizeCarstatResponse(body.lots ? body : { ...body, lots });
    console.log(`normalizeCarstatResponse photos: ${normalized.photos?.length ?? 0}`);
    console.log(`normalize 360 exterior: ${normalized.photos360Exterior?.length ?? 0}`);
    console.log(`normalize 360 interior: ${normalized.photos360Interior?.length ?? 0}`);
    console.log(`normalize 360 embed: ${normalized.photos360EmbedUrl ?? "(none)"}`);
    console.log(`normalize 360 embed ext: ${normalized.photos360EmbedExteriorUrl ?? "(none)"}`);
    console.log(`normalize 360 embed int: ${normalized.photos360EmbedInteriorUrl ?? "(none)"}`);
  }, 120_000);
});
