import pg from "pg";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
  const m = line.match(/^\s*([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const vin = (process.argv[2] ?? "1N6ED1EJXNN664377").toUpperCase();
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const catalog = await c.query(
  `SELECT vin, provider_name, data->>'make' AS make, data->>'model' AS model, data->>'year' AS year
   FROM vin_catalog WHERE vin = $1`,
  [vin],
);
const lookups = await c.query(
  `SELECT id, vin, user_id, status, data->>'make' AS make, data->>'model' AS model, data->>'year' AS year,
          from_cache, created_at
   FROM vin_lookups WHERE vin = $1 ORDER BY created_at DESC LIMIT 8`,
  [vin],
);
const payments = await c.query(
  `SELECT id, vin, status, user_id, created_at FROM payments WHERE vin = $1 ORDER BY created_at DESC LIMIT 8`,
  [vin],
);
const pendingPayments = await c.query(
  `SELECT id, vin, status, user_id, created_at FROM payments
   WHERE status IN ('pending', 'created') ORDER BY created_at DESC LIMIT 10`,
);

console.log("=== VIN", vin, "===");
console.log("catalog:", catalog.rows);
console.log("lookups:", lookups.rows);
console.log("payments:", payments.rows);
console.log("recent pending payments:", pendingPayments.rows);

await c.end();
