/**
 * Backfill missing photos for catalog VINs that have history but empty galleries.
 * Usage:
 *   pnpm exec vitest run src/scripts/repair-missing-photos.test.ts
 *   REPAIR_VINS=VIN1,VIN2 REPAIR_APPLY=1 pnpm exec vitest run src/scripts/repair-missing-photos.test.ts
 *   REPAIR_ALL=1 REPAIR_APPLY=1 REPAIR_LIMIT=50 ...
 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
  const m = line.match(/^\s*([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
}

const APPLY = process.env.REPAIR_APPLY === "1";
const REPAIR_ALL = process.env.REPAIR_ALL === "1";
const LIMIT = Math.max(1, Number(process.env.REPAIR_LIMIT ?? "20") || 20);
const DEFAULT_VINS = [
  "5YJ3E1EB9NF228344",
  "1HGCV2630KA510203",
  "WBA31DP04P9N91864",
];
const TARGET_VINS = (process.env.REPAIR_VINS ?? DEFAULT_VINS.join(","))
  .split(/[\s,]+/)
  .map((v) => v.trim().toUpperCase())
  .filter((v) => v.length === 17);

describe("repair missing photos", () => {
  it("backfills empty galleries from Carstat", async () => {
    const { eq, inArray, sql } = await import("drizzle-orm");
    const { db, vinCatalogTable, vinLookupsTable, providersTable } = await import("@workspace/db");
    const {
      reportNeedsPhotoBackfill,
      sanitizeCatalogPayload,
      stampCatalogImportData,
      preserveAdminTaxiFlag,
    } = await import("../lib/vinCatalogImport");
    const { fetchFromProvider, syncStampedCatalogToAllLookups } = await import("../lib/vinService");
    const { readFrozenKrwPerUsd, getCurrentKrwPerUsd } = await import("../lib/krwRate");
    const { extractVinPhotoUrls, invalidateVinImageCache } = await import("../lib/vinImageCache");

    const [provider] = await db.select().from(providersTable).where(eq(providersTable.isActive, true)).limit(1);
    if (!provider?.apiKey) throw new Error("No active Carstat provider");

    let vins = TARGET_VINS;
    if (REPAIR_ALL) {
      const rows = await db.execute(sql`
        SELECT vin
        FROM vin_catalog
        WHERE COALESCE((data->>'fulfillmentPending')::boolean, false) = false
          AND jsonb_array_length(COALESCE(data->'photos', '[]'::jsonb)) = 0
          AND jsonb_array_length(COALESCE(data->'photosHd', '[]'::jsonb)) = 0
          AND jsonb_array_length(COALESCE(data->'photos360Exterior', '[]'::jsonb)) = 0
          AND (
            lower(COALESCE(data->>'country', '')) IN ('kr', 'korea', 'south korea')
            OR lower(COALESCE(data->>'country', '')) LIKE '%korea%'
            OR jsonb_array_length(COALESCE(data->'auctionHistory', '[]'::jsonb)) > 0
            OR jsonb_array_length(COALESCE(data->'registryHistory', '[]'::jsonb)) > 0
            OR jsonb_array_length(COALESCE(data->'insuranceClaims', '[]'::jsonb)) > 0
          )
        ORDER BY updated_at DESC NULLS LAST
        LIMIT ${LIMIT}
      `);
      vins = (rows as unknown as { vin: string }[]).map((r) => String(r.vin).toUpperCase());
      // drizzle execute shape varies
      if (!Array.isArray(rows) && rows && typeof rows === "object" && "rows" in (rows as object)) {
        vins = ((rows as { rows: { vin: string }[] }).rows ?? []).map((r) => String(r.vin).toUpperCase());
      }
      console.log(`REPAIR_ALL candidates: ${vins.length} (limit ${LIMIT})`);
    }

    const cats = await db.select().from(vinCatalogTable).where(inArray(vinCatalogTable.vin, vins));
    console.log(`catalog rows: ${cats.length}/${vins.length}`);

    let need = 0;
    let fixed = 0;
    for (const vin of vins) {
      const entry = cats.find((c) => c.vin === vin);
      const data = (entry?.data ?? null) as Record<string, unknown> | null;
      const photosLen = Array.isArray(data?.photos) ? data!.photos.length : 0;
      const needs = reportNeedsPhotoBackfill(data);
      console.log(`\n${vin} provider=${entry?.providerName ?? "(none)"} photos=${photosLen} needsBackfill=${needs}`);
      if (!needs && photosLen > 0) continue;
      if (!needs) {
        console.log("  skip (not a photo-backfill candidate)");
        continue;
      }
      need += 1;
      if (!APPLY) {
        console.log("  dry-run — set REPAIR_APPLY=1 to write");
        continue;
      }

      const oldUrls = extractVinPhotoUrls(data);
      const fetched = await fetchFromProvider(
        vin,
        String(provider.baseUrl ?? ""),
        String(provider.apiKey ?? ""),
        { force: true, preferredSource: "carstat", strictSource: true },
      );
      const payload = sanitizeCatalogPayload(fetched as unknown as Record<string, unknown>);
      const newPhotos = Array.isArray(payload.photos) ? payload.photos.length : 0;
      console.log(`  fetched photos=${newPhotos}`);
      if (newPhotos === 0) {
        console.log("  WARNING: provider still returned 0 photos");
        continue;
      }

      const currentRate = await getCurrentKrwPerUsd();
      const stamped = preserveAdminTaxiFlag(
        stampCatalogImportData(payload, {
          existingRate: readFrozenKrwPerUsd(data ?? {}),
          currentRate,
        }),
        data ?? {},
      );
      const now = new Date();
      await db.insert(vinCatalogTable)
        .values({
          vin,
          data: stamped,
          providerName: provider.name ?? "carstat",
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: vinCatalogTable.vin,
          set: {
            data: stamped,
            providerName: provider.name ?? "carstat",
            updatedAt: now,
          },
        });
      await syncStampedCatalogToAllLookups(vin, stamped, now);
      await invalidateVinImageCache([...oldUrls, ...extractVinPhotoUrls(stamped)]);
      console.log(`  saved catalog + synced lookups`);
      fixed += 1;
    }

    console.log(`\nSummary: need=${need} fixed=${fixed} apply=${APPLY}`);
    if (!APPLY && need > 0) {
      console.log("Re-run with REPAIR_APPLY=1 to persist.");
    }
  }, 300_000);
});
