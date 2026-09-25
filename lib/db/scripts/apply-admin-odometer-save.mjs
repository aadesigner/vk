/**
 * Dev helper: apply admin catalog mileage save logic directly to DB.
 * Usage: node lib/db/scripts/apply-admin-odometer-save.mjs <VIN> <odometer_km>
 */
import pg from "pg";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
  const m = line.match(/^\s*([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const vin = (process.argv[2] ?? "").toUpperCase();
const targetKm = Number(process.argv[3]);
if (vin.length !== 17 || !Number.isFinite(targetKm) || targetKm <= 0) {
  console.error("Usage: node lib/db/scripts/apply-admin-odometer-save.mjs <VIN> <odometer_km>");
  process.exit(1);
}

const { applyCatalogAdminPatch } = await import(
  pathToFileURL(join(root, "artifacts/api-server/src/lib/vinCatalogImport.ts")).href
);
const { finalizeAdminCatalogSave, detectAdminCatalogMileageTouched } = await import(
  pathToFileURL(join(root, "artifacts/api-server/src/lib/pendingVinCatalogPrep.ts")).href
);

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const row = await c.query("SELECT data FROM vin_catalog WHERE vin = $1", [vin]);
if (!row.rows[0]) {
  console.error("VIN not in catalog");
  process.exit(1);
}
const entryData = row.rows[0].data ?? {};
const catalogFields = {
  ...entryData,
  odometer: targetKm,
  mileageHistory: [{ date: new Date().toISOString().slice(0, 10), odometer: targetKm, unit: "km", source: "admin" }],
};
const merged = applyCatalogAdminPatch(entryData, catalogFields);
const touched = detectAdminCatalogMileageTouched(entryData, catalogFields);
const prepared = finalizeAdminCatalogSave(merged, touched);
const now = new Date();
await c.query(
  "UPDATE vin_catalog SET data = $1::jsonb, updated_at = $2 WHERE vin = $3",
  [JSON.stringify(prepared), now, vin],
);
await c.query(
  "UPDATE vin_lookups SET data = $1::jsonb, updated_at = $2 WHERE vin = $3",
  [JSON.stringify(prepared), now, vin],
);
console.log("Updated", vin, "odometer=", prepared.odometer, "locked=", prepared.odometerLocked);
await c.end();
