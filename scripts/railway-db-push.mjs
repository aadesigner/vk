#!/usr/bin/env node
/**
 * Push Drizzle schema to Railway Postgres (non-interactive).
 * Usage: DATABASE_URL=postgres://... node scripts/railway-db-push.mjs
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (!process.env.DATABASE_URL?.trim()) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const r = spawnSync(
  "pnpm",
  ["--filter", "@workspace/db", "run", "push-force"],
  { cwd: root, stdio: "inherit", shell: process.platform === "win32" },
);

process.exit(r.status ?? 1);
