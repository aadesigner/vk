/**
 * Writes catalog VIN URLs into sharded sitemap files and updates the sitemap index.
 * Run after generate-sitemap.mjs during build/deploy when DATABASE_URL is set.
 *
 * Design goals:
 * - Never append VINs into the marketing urlset (keeps sitemap-pages.xml small).
 * - One <url> entry per VIN (en loc + xhtml hreflang alternates) — not × langs.
 * - Shard at ~25k URLs so each file stays under Google's 50k / ~50MB limits.
 * - Atomic writes where practical so a half-written file never becomes production.
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  unlinkSync,
  renameSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { SUPPORTED_LANGS, HREFLANG_MAP } from "./languages.mjs";

const ORIGIN = "https://verifykm.com";
const LANGS = SUPPORTED_LANGS;
const HREFLANG = HREFLANG_MAP;
/** Google max is 50_000 URLs; leave headroom for markup size. */
const MAX_URLS_PER_SHARD = 25_000;

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, "..", "..", "..");
const envPath = join(root, ".env");
const publicDir = join(dir, "..", "public");
const indexPath = join(publicDir, "sitemap.xml");
const pagesPath = join(publicDir, "sitemap-pages.xml");

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

function loadPg() {
  // Prefer workspace db package (pnpm does not hoist pg into @workspace/verifykm).
  const candidates = [
    join(root, "lib/db/package.json"),
    join(root, "package.json"),
  ];
  for (const pkgJson of candidates) {
    if (!existsSync(pkgJson)) continue;
    try {
      return createRequire(pkgJson)("pg");
    } catch {
      // try next
    }
  }
  return null;
}

function clearVinShards() {
  if (!existsSync(publicDir)) return [];
  const removed = [];
  for (const name of readdirSync(publicDir)) {
    if (/^sitemap-vins-\d+\.xml$/i.test(name)) {
      unlinkSync(join(publicDir, name));
      removed.push(name);
    }
  }
  return removed;
}

function writeAtomic(filePath, contents) {
  const tmp = `${filePath}.${process.pid}.tmp`;
  writeFileSync(tmp, contents, "utf8");
  renameSync(tmp, filePath);
}

function writeSitemapIndex(vinShardNames, lastmod) {
  const entries = [
    `  <sitemap>
    <loc>${ORIGIN}/sitemap-pages.xml</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`,
    ...vinShardNames.map(
      (name) => `  <sitemap>
    <loc>${ORIGIN}/${name}</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`,
    ),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</sitemapindex>
`;
  writeAtomic(indexPath, xml);
}

function urlEntryForVin(vin, lastmod) {
  const path = `/vin/${vin}`;
  const alternates = LANGS.map(
    (l) =>
      `    <xhtml:link rel="alternate" hreflang="${HREFLANG[l]}" href="${ORIGIN}/${l}${path}" />`,
  ).join("\n");
  const xDefault = `    <xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}/en${path}" />`;
  return `  <url>
    <loc>${ORIGIN}/en${path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
${alternates}
${xDefault}
  </url>`;
}

function wrapUrlset(urlBlocks) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlBlocks.join("\n")}
</urlset>
`;
}

const today = new Date().toISOString().slice(0, 10);

if (!existsSync(pagesPath)) {
  console.warn("generate-vin-sitemap: sitemap-pages.xml missing — run generate-sitemap.mjs first");
  process.exit(0);
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  clearVinShards();
  writeSitemapIndex([], today);
  console.log("generate-vin-sitemap: skip VIN shards (no DATABASE_URL); index → pages only");
  process.exit(0);
}

const pg = loadPg();
if (!pg) {
  clearVinShards();
  writeSitemapIndex([], today);
  console.log("generate-vin-sitemap: skip VIN shards (pg not resolvable); index → pages only");
  process.exit(0);
}

/** Railway build network cannot resolve postgres.railway.internal — never fail the frontend build. */
let rows = [];
const client = new pg.Client({
  connectionString: dbUrl,
  connectionTimeoutMillis: 8_000,
  query_timeout: 30_000,
});
try {
  await client.connect();
  const result = await client.query(
    `SELECT vin, updated_at FROM vin_catalog
     WHERE (
       jsonb_array_length(COALESCE(data->'photos', '[]'::jsonb)) > 0
       OR jsonb_array_length(COALESCE(data->'photosHd', '[]'::jsonb)) > 0
       OR jsonb_array_length(COALESCE(data->'photos360Exterior', '[]'::jsonb)) > 0
     )
     ORDER BY updated_at DESC LIMIT 50000`,
  );
  rows = result.rows;
  await client.end();
} catch (err) {
  try {
    await client.end();
  } catch {
    // ignore
  }
  const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
  const message = err instanceof Error ? err.message : String(err);
  clearVinShards();
  writeSitemapIndex([], today);
  console.warn(
    `generate-vin-sitemap: DB unavailable during build (${code || "error"}: ${message}); index → pages only`,
  );
  process.exit(0);
}

clearVinShards();

if (rows.length === 0) {
  writeSitemapIndex([], today);
  console.log("generate-vin-sitemap: no catalog VINs; index → pages only");
  process.exit(0);
}

const entries = rows.map((row) => {
  const vin = String(row.vin).toUpperCase();
  const lastmod = row.updated_at
    ? new Date(row.updated_at).toISOString().slice(0, 10)
    : today;
  return urlEntryForVin(vin, lastmod);
});

const shardNames = [];
for (let i = 0; i < entries.length; i += MAX_URLS_PER_SHARD) {
  const chunk = entries.slice(i, i + MAX_URLS_PER_SHARD);
  const shardNum = shardNames.length + 1;
  const name = `sitemap-vins-${shardNum}.xml`;
  writeAtomic(join(publicDir, name), wrapUrlset(chunk));
  shardNames.push(name);
}

writeSitemapIndex(shardNames, today);
console.log(
  `generate-vin-sitemap: ${rows.length} VINs → ${shardNames.length} shard(s) [${shardNames.join(", ")}] (1 URL entry each; hreflang covers ${LANGS.length} langs)`,
);
