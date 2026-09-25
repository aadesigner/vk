#!/usr/bin/env node
/**
 * Railway / production build — frontend + API in one artifact.
 * Run from repo root. Requires CLIENT_GUARD_TOKEN for Vite embed (same as API).
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args, env = {}) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...env },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const guard = process.env.CLIENT_GUARD_TOKEN?.trim();
if (!guard && process.env.NODE_ENV === "production") {
  console.error("CLIENT_GUARD_TOKEN must be set before building for production.");
  process.exit(1);
}

// Nixpacks already runs `pnpm install` in the install phase — skip the duplicate on Railway.
if (!existsSync(path.join(root, "node_modules"))) {
  console.log("→ pnpm install");
  run("pnpm", ["install", "--frozen-lockfile", "--prod=false"]);
} else {
  console.log("→ pnpm install (skipped — node_modules already present)");
}
console.log("→ typecheck libs");
run("pnpm", ["run", "typecheck:libs"]);

console.log("→ build frontend");
run("pnpm", ["--filter", "@workspace/verifykm", "run", "build"], {
  BASE_PATH: "/",
  VITE_CLIENT_GUARD_TOKEN: guard ?? "",
});

console.log("→ build API");
run("pnpm", ["--filter", "@workspace/api-server", "run", "build"]);

console.log("Railway build complete.");
