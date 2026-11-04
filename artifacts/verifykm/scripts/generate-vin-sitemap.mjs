/**
 * VIN sitemap generator — currently a no-op clearer.
 *
 * Policy: public VIN pages stay online for users but are NOT submitted to Google.
 * SEO focuses on marketing pages (see generate-sitemap.mjs). This script only
 * deletes any leftover sitemap-vins-*.xml shards and keeps the index pages-only.
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  unlinkSync,
  renameSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ORIGIN = "https://verifykm.com";

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

function writeSitemapIndex(lastmod) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${ORIGIN}/sitemap-pages.xml</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>
</sitemapindex>
`;
  writeAtomic(indexPath, xml);
}

const today = new Date().toISOString().slice(0, 10);

if (!existsSync(pagesPath)) {
  console.warn("generate-vin-sitemap: sitemap-pages.xml missing — run generate-sitemap.mjs first");
  process.exit(0);
}

const removed = clearVinShards();
writeSitemapIndex(today);
console.log(
  `generate-vin-sitemap: VIN SEO disabled — index → pages only` +
    (removed.length ? ` (removed ${removed.join(", ")})` : ""),
);
