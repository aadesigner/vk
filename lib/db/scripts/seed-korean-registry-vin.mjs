/**
 * One-time: fetch Korean VIN from Carstat, update catalog, assign to user.
 * Usage: node lib/db/scripts/seed-korean-registry-vin.mjs [VIN] [email]
 */
import pg from "pg";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
  const m = line.match(/^\s*([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const vin = (process.argv[2] ?? "WBAGW4107LCD28117").toUpperCase();
const email = process.argv[3] ?? "armand9a@gmail.com";

const { fetchFromProvider } = await import(
  "../../../artifacts/api-server/src/lib/vinService.ts"
);

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const provider = (await c.query(
  "SELECT name, base_url, api_key FROM providers WHERE is_active = true LIMIT 1",
)).rows[0];
const user = (await c.query("SELECT id FROM users WHERE email = $1", [email])).rows[0];

if (!provider?.api_key) {
  console.error("No active provider with api_key");
  process.exit(1);
}
if (!user) {
  console.error("User not found:", email);
  process.exit(1);
}

console.log("Fetching from provider for", vin);
const normalized = await fetchFromProvider(vin, provider.base_url, provider.api_key);
const payload = JSON.stringify(normalized);
console.log("registryHistory events:", normalized.registryHistory?.length ?? 0);

await c.query(
  `INSERT INTO vin_catalog (vin, data, provider_name, updated_at)
   VALUES ($1, $2::jsonb, $3, NOW())
   ON CONFLICT (vin) DO UPDATE SET data = $2::jsonb, provider_name = $3, updated_at = NOW()`,
  [vin, payload, provider.name],
);
const lookups = await c.query(
  "UPDATE vin_lookups SET data = $1::jsonb, updated_at = NOW() WHERE vin = $2 RETURNING id",
  [payload, vin],
);
console.log("lookups updated:", lookups.rowCount);

const existing = (await c.query(
  "SELECT id FROM vin_lookups WHERE vin = $1 AND user_id = $2 AND status = 'complete' LIMIT 1",
  [vin, user.id],
)).rows[0];

if (existing) {
  console.log("User already has lookup id", existing.id);
} else {
  const ins = await c.query(
    `INSERT INTO vin_lookups (vin, user_id, status, data, provider_name, from_cache, payment_id, created_at, updated_at)
     VALUES ($1, $2, 'complete', $3::jsonb, $4, true, null, NOW(), NOW())
     RETURNING id`,
    [vin, user.id, payload, provider.name],
  );
  console.log("Assigned lookup id", ins.rows[0].id, "to", email);
}

await c.end();
