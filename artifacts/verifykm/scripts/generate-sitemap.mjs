/**
 * Generates marketing-page sitemaps (no VIN URLs).
 * - public/sitemap-pages.xml  — urlset for indexable marketing routes
 * - public/sitemap.xml        — sitemap index pointing at pages (+ VIN shards later)
 *
 * Paths from src/lib/indexable-paths.json via seo-inject.mjs.
 * VIN catalog URLs are written by generate-vin-sitemap.mjs into separate shards.
 */
import { writeFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SUPPORTED_LANGS, HREFLANG_MAP } from "./languages.mjs";
import { INDEXABLE_PRERENDER_PATHS } from "./seo-inject.mjs";
import { localizedPath } from "./localized-routes.mjs";

const ORIGIN = "https://verifykm.com";
const LANGS = SUPPORTED_LANGS;
const PATHS = INDEXABLE_PRERENDER_PATHS;

const HREFLANG = HREFLANG_MAP;

const dir = dirname(fileURLToPath(import.meta.url));
const publicDir = join(dir, "..", "public");
const pagesOut = join(publicDir, "sitemap-pages.xml");
const indexOut = join(publicDir, "sitemap.xml");
const lastmod = new Date().toISOString().slice(0, 10);

function loc(lang, canonicalPath) {
  return `${ORIGIN}${localizedPath(lang, canonicalPath)}`;
}

/** Keep any existing VIN shards in the index (vin generator owns rewriting them). */
function listVinShards() {
  if (!existsSync(publicDir)) return [];
  return readdirSync(publicDir)
    .filter((name) => /^sitemap-vins-\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const na = Number(a.match(/(\d+)/)?.[1] || 0);
      const nb = Number(b.match(/(\d+)/)?.[1] || 0);
      return na - nb;
    });
}

function pathPriority(path, lang) {
  if (path === "") {
    if (lang === "en" || lang === "sq") return "1.0";
    return "0.95";
  }
  if (path.startsWith("/api-b2b")) return "0.2";
  if (path.startsWith("/cars")) return "0.85";
  if (path.startsWith("/blog")) return "0.75";
  return "0.8";
}

const urls = PATHS.flatMap((path) =>
  LANGS.map((lang) => {
    const alternates = LANGS.map(
      (l) =>
        `    <xhtml:link rel="alternate" hreflang="${HREFLANG[l]}" href="${loc(l, path)}" />`,
    ).join("\n");
    const xDefault = `    <xhtml:link rel="alternate" hreflang="x-default" href="${loc("en", path)}" />`;
    const priority = pathPriority(path, lang);
    const changefreq =
      path === "" ? "weekly" : path.startsWith("/api-b2b") ? "yearly" : "monthly";
    return `  <url>
    <loc>${loc(lang, path)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
${alternates}
${xDefault}
  </url>`;
  }),
);

const pagesXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>
`;

writeFileSync(pagesOut, pagesXml, "utf8");

const vinShards = listVinShards();
const vinIndexEntries = vinShards
  .map(
    (name) => `  <sitemap>
    <loc>${ORIGIN}/${name}</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`,
  )
  .join("\n");

const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${ORIGIN}/sitemap-pages.xml</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>
${vinIndexEntries ? `${vinIndexEntries}\n` : ""}</sitemapindex>
`;

writeFileSync(indexOut, indexXml, "utf8");
console.log(
  `Wrote ${urls.length} page URLs → public/sitemap-pages.xml; sitemap index → public/sitemap.xml` +
    (vinShards.length ? ` (kept ${vinShards.length} VIN shard${vinShards.length === 1 ? "" : "s"})` : ""),
);
