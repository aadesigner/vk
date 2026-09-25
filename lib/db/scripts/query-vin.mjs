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

const userId = process.argv[3] ?? "fb96e0a0-0744-41db-ae52-cede21904d57";

const catalog = await c.query(
  "SELECT vin, provider_name, data->>'make' AS make, data->>'model' AS model, data->>'year' AS year FROM vin_catalog WHERE vin = $1",
  [vin],
);
const lookups = await c.query(
  "SELECT id, vin, user_id, status, data->>'make' AS make, data->>'model' AS model, data->>'year' AS year, from_cache, created_at FROM vin_lookups WHERE vin = $1 ORDER BY created_at DESC LIMIT 8",
  [vin],
);
const payments = await c.query(
  "SELECT id, vin, status, user_id, created_at FROM payments WHERE vin = $1 ORDER BY created_at DESC LIMIT 8",
  [vin],
);
const openPayments = await c.query(
  "SELECT id, vin, status, user_id, created_at FROM payments WHERE status NOT IN ('completed', 'failed') ORDER BY created_at DESC LIMIT 10",
);
const userLookups = await c.query(
  "SELECT id, vin, status, data->>'make' AS make, data->>'model' AS model, created_at FROM vin_lookups WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10",
  [userId],
);

const yv1Payments = await c.query(
  "SELECT id, vin, status, created_at FROM payments WHERE vin = 'YV1MC67278J058366' ORDER BY id",
);
const lookup10 = await c.query(
  "SELECT id, vin, user_id, status, payment_id, from_cache, created_at FROM vin_lookups WHERE id IN (9, 10)",
);

console.log("=== VIN", vin, "===");
console.log(JSON.stringify({ catalog: catalog.rows, lookups: lookups.rows, payments: payments.rows, openPayments: openPayments.rows, userLookups: userLookups.rows, yv1Payments: yv1Payments.rows, lookupDetails: lookup10.rows }, null, 2));

await c.end();
