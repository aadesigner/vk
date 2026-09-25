import { Client } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const c = new Client({ connectionString: url });
await c.connect();
try {
  const r = await c.query(
    `UPDATE pricing
     SET base_price = 29.99, discount_price = 19.99, discount_enabled = true
     RETURNING id, base_price, discount_price, discount_enabled`,
  );
  if (r.rowCount) {
    console.log("updated", r.rows);
  } else {
    const i = await c.query(
      `INSERT INTO pricing (base_price, discount_price, currency, discount_enabled)
       VALUES (29.99, 19.99, 'EUR', true)
       RETURNING id, base_price, discount_price, discount_enabled`,
    );
    console.log("inserted", i.rows);
  }
} finally {
  await c.end();
}
