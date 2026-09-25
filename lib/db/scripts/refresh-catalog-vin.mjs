/**
 * Re-fetch a VIN from Carstat and update vin_catalog + vin_lookups with normalized data.
 * Usage: node lib/db/scripts/refresh-catalog-vin.mjs <VIN>
 * Requires: API built (pnpm --filter @workspace/api-server run build) and DATABASE_URL in .env
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
if (vin.length !== 17) {
  console.error("Usage: node lib/db/scripts/refresh-catalog-vin.mjs <VIN>");
  process.exit(1);
}

const { fetchFromProvider } = await import(
  pathToFileURL(join(root, "artifacts/api-server/src/lib/vinService.ts")).href
);

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows } = await client.query(
  "SELECT base_url, api_key FROM providers WHERE is_active = true ORDER BY id LIMIT 1",
);
const provider = rows[0];
if (!provider?.api_key) {
  console.error("No active provider with api_key");
  process.exit(1);
}

const normalized = await fetchFromProvider(vin, provider.base_url, provider.api_key);
const payload = JSON.stringify(normalized);

await client.query(
  "UPDATE vin_catalog SET data = $1::jsonb, updated_at = NOW() WHERE vin = $2",
  [payload, vin],
);
const lookups = await client.query(
  "UPDATE vin_lookups SET data = $1::jsonb, updated_at = NOW() WHERE vin = $2 RETURNING id",
  [payload, vin],
);

console.log("VIN:", vin);
console.log("accidentCount:", normalized.accidentCount);
console.log("accidents:", normalized.accidents?.length ?? 0);
console.log("insuranceClaims:", normalized.insuranceClaims?.length ?? 0);
console.log("lookups updated:", lookups.rowCount);

await client.end();
