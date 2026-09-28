/**
 * One-shot: inspect catalog photo counts for given VINs and optionally peek Carstat.
 * Usage: node --import ./load-env.mjs scripts/peek-missing-photos.mjs VIN...
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
  const m = line.match(/^\s*([^#=]+)=(.*)$/);
  if (m && process.env[m[1].trim()] == null) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
}

const vins = process.argv.slice(2).map((v) => v.trim().toUpperCase()).filter(Boolean);
if (vins.length === 0) {
  console.error("Pass VINs");
  process.exit(1);
}

const { eq, inArray } = await import("drizzle-orm");
const { db, vinCatalogTable, vinLookupsTable, providersTable } = await import("@workspace/db");

const cats = await db.select().from(vinCatalogTable).where(inArray(vinCatalogTable.vin, vins));
console.log("catalog hits", cats.length, "/", vins.length);

for (const c of cats) {
  const d = (c.data || {});
  const photos = Array.isArray(d.photos) ? d.photos : [];
  const hd = Array.isArray(d.photosHd) ? d.photosHd : [];
  const e360 = Array.isArray(d.photos360Exterior) ? d.photos360Exterior : [];
  const i360 = Array.isArray(d.photos360Interior) ? d.photos360Interior : [];
  console.log(JSON.stringify({
    vin: c.vin,
    provider: c.providerName,
    updatedAt: c.updatedAt,
    photos: photos.length,
    photosHd: hd.length,
    e360: e360.length,
    i360: i360.length,
    make: d.make,
    model: d.model,
    year: d.year,
    country: d.country,
    dataSource: d.dataSource,
    sample: typeof photos[0] === "string" ? photos[0].slice(0, 140) : photos[0],
    photoKeys: Object.keys(d).filter((k) => /photo|image|thumb/i.test(k)),
  }, null, 2));
}

const missing = vins.filter((v) => !cats.some((c) => c.vin === v));
if (missing.length) console.log("NOT IN CATALOG", missing);

for (const vin of vins) {
  const lookups = await db.select({
    id: vinLookupsTable.id,
    status: vinLookupsTable.status,
    providerName: vinLookupsTable.providerName,
    updatedAt: vinLookupsTable.updatedAt,
    data: vinLookupsTable.data,
  }).from(vinLookupsTable).where(eq(vinLookupsTable.vin, vin)).limit(5);
  for (const l of lookups) {
    const d = (l.data || {});
    const photos = Array.isArray(d.photos) ? d.photos : [];
    console.log(JSON.stringify({
      lookupVin: vin,
      lookupId: l.id,
      status: l.status,
      provider: l.providerName,
      photos: photos.length,
      sample: typeof photos[0] === "string" ? photos[0].slice(0, 140) : null,
    }));
  }
}

const [provider] = await db.select().from(providersTable).where(eq(providersTable.isActive, true)).limit(1);
if (!provider?.apiKey) {
  console.log("No active Carstat provider — skip live peek");
  process.exit(0);
}

const { pickBestLotPhotoUrls, pickDisplayLotPhotoUrls, normalizeCarstatResponse } = await import("../src/lib/vinService.ts").catch(async () => {
  // Prefer compiled dist if present
  return import("../dist/lib/vinService.js").catch(() => null);
});

if (!normalizeCarstatResponse) {
  console.log("Could not load vinService — DB inspect only");
  process.exit(0);
}

const base = String(provider.baseUrl).replace(/\/$/, "").replace("://api.carstat.dev", "://carstat.dev");
for (const vin of vins) {
  console.log("\n==== LIVE", vin, "====");
  const res = await fetch(`${base}/api/local-report/${encodeURIComponent(vin)}`, {
    headers: { Accept: "application/json", "x-api-key": provider.apiKey },
  });
  const body = await res.json();
  const lots = (body.lots ?? body.data?.lots ?? []) || [];
  console.log("HTTP", res.status, "lots", lots.length);
  for (let i = 0; i < Math.min(lots.length, 3); i++) {
    const l = lots[i];
    const domain = l.domain?.name ?? l.domain;
    const imgs = l.images ?? {};
    const keys = typeof imgs === "object" && imgs ? Object.keys(imgs) : [];
    console.log(` lot ${i} domain=${domain} imageKeys=${keys.join(",") || "(none)"}`);
    for (const k of keys.slice(0, 12)) {
      const arr = imgs[k];
      const n = Array.isArray(arr) ? arr.length : (arr && typeof arr === "object" ? Object.keys(arr).length : typeof arr);
      console.log(`   ${k}: ${n}`);
    }
    if (imgs && typeof imgs === "object" && !Array.isArray(imgs)) {
      console.log(`   pickBest=${pickBestLotPhotoUrls(imgs).length} pickDisplay=${pickDisplayLotPhotoUrls(imgs).length}`);
    }
  }
  const normalized = normalizeCarstatResponse(body.lots ? body : { ...body, lots });
  console.log("normalized photos", normalized.photos?.length ?? 0, "hd", normalized.photosHd?.length ?? 0);
  console.log("sample", normalized.photos?.[0]?.slice?.(0, 140));
}

process.exit(0);
