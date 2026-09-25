/**
 * Inspect / fix latest lookup for a user by email.
 * Usage:
 *   node lib/db/scripts/fix-user-latest-vin.mjs inspect armand9a@gmail.com
 *   node lib/db/scripts/fix-user-latest-vin.mjs refetch armand9a@gmail.com
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

const mode = process.argv[2] ?? "inspect";
const email = process.argv[3] ?? "armand9a@gmail.com";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const userRes = await c.query("SELECT id, email, name FROM users WHERE email = $1", [email]);
const user = userRes.rows[0];
if (!user) {
  console.error("User not found:", email);
  process.exit(1);
}

const lookupsRes = await c.query(
  `SELECT id, vin, status, payment_id, from_cache,
          length(COALESCE(data::text, '')) AS data_len,
          data->>'make' AS make, data->>'model' AS model, data->>'year' AS year,
          created_at
   FROM vin_lookups WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
  [user.id],
);
const latest = lookupsRes.rows[0];
console.log(JSON.stringify({ user, latestLookups: lookupsRes.rows }, null, 2));

if (!latest) {
  console.log("No lookups for user");
  await c.end();
  process.exit(0);
}

if (mode === "inspect") {
  const vin = latest.vin;
  const [cat, pays] = await Promise.all([
    c.query(
      "SELECT vin, length(data::text) AS data_len, data->>'make' AS make, updated_at FROM vin_catalog WHERE vin = $1",
      [vin],
    ),
    c.query(
      "SELECT id, vin, status, amount, created_at FROM payments WHERE user_id = $1 AND vin = $2 ORDER BY created_at DESC",
      [user.id, vin],
    ),
  ]);
  console.log(JSON.stringify({ catalog: cat.rows, payments: pays.rows }, null, 2));
  await c.end();
  process.exit(0);
}

if (mode !== "refetch") {
  console.error("Unknown mode:", mode);
  process.exit(1);
}

const vin = latest.vin.toUpperCase();
console.log("Deleting lookup id", latest.id, "for VIN", vin);

await c.query("DELETE FROM vin_lookups WHERE id = $1 AND user_id = $2", [latest.id, user.id]);

const providerRes = await c.query(
  "SELECT name, base_url, api_key FROM providers WHERE is_active = true LIMIT 1",
);
const provider = providerRes.rows[0];
if (!provider?.api_key) {
  console.error("No active provider with API key");
  process.exit(1);
}

// Use the same fetch path as the API (tsx + vinService)
const { fetchFromProvider } = await import(
  "../../../artifacts/api-server/src/lib/vinService.ts"
);

console.log("Fetching from provider for", vin);
const data = await fetchFromProvider(vin, provider.base_url, provider.api_key);
const payload = data;

const payRes = await c.query(
  "SELECT id FROM payments WHERE user_id = $1 AND vin = $2 AND status = 'completed' ORDER BY created_at DESC LIMIT 1",
  [user.id, vin],
);
const paymentId = payRes.rows[0]?.id ?? null;

await c.query("BEGIN");
try {
  await c.query(
    `INSERT INTO vin_catalog (vin, data, provider_name, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (vin) DO UPDATE SET data = $2, provider_name = $3, updated_at = NOW()`,
    [vin, JSON.stringify(payload), provider.name],
  );

  const ins = await c.query(
    `INSERT INTO vin_lookups (vin, user_id, status, data, provider_name, from_cache, payment_id, created_at, updated_at)
     VALUES ($1, $2, 'complete', $3, $4, false, $5, NOW(), NOW())
     RETURNING id, vin, status, data->>'make' AS make, data->>'model' AS model, length(data::text) AS data_len`,
    [vin, user.id, JSON.stringify(payload), provider.name, paymentId],
  );
  await c.query("COMMIT");
  console.log("OK — new lookup:", JSON.stringify(ins.rows[0], null, 2));
} catch (err) {
  await c.query("ROLLBACK");
  throw err;
}

await c.end();
