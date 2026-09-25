import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const defaultPoolMax = process.env.NODE_ENV === "production" ? 8 : 20;
const pgPoolMax = parseInt(process.env.PG_POOL_MAX ?? String(defaultPoolMax), 10);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: isNaN(pgPoolMax) || pgPoolMax <= 0 ? defaultPoolMax : pgPoolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 3_000,
  allowExitOnIdle: false,
});

pool.on("error", (err) => {
  console.error({ err }, "PostgreSQL pool error");
});

export const db = drizzle(pool, { schema });

export * from "./schema";
