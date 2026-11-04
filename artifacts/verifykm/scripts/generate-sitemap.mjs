/**
 * Generates marketing-page sitemaps (no VIN URLs).
 * - public/sitemap-pages.xml  — urlset for indexable marketing routes
 * - public/sitemap.xml        — sitemap index (pages only; VIN shards cleared)
 *
 * Paths from src/lib/indexable-paths.json via seo-inject.mjs.
 * EN + SQ get higher priority; other locales stay listed at lower priority.
 */
import { writeFileSync, readdirSync, existsSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SUPPORTED_LANGS, HREFLANG_MAP } from "./languages.mjs";
import { INDEXABLE_PRERENDER_PATHS } from "./seo-inject.mjs";
import { localizedPath } from "./localized-routes.mjs";

const ORIGIN = "https://verifykm.com";
/** EN + SQ first in the urlset, then remaining langs. */
const LANGS = [
  ...SUPPORTED_LANGS.filter((l) => l === "en" || l === "sq"),
  ...SUPPORTED_LANGS.filter((l) => l !== "en" && l !== "sq"),
];
const PATHS = INDEXABLE_PRERENDER_PATHS;

const HREFLANG = HREFLANG_MAP;
const PRIORITY_LANGS = new Set(["en", "sq"]);

const dir = dirname(fileURLToPath(import.meta.url));
const publicDir = join(dir, "..", "public");
const pagesOut = join(publicDir, "sitemap-pages.xml");
const indexOut = join(publicDir, "sitemap.xml");
const lastmod = new Date().toISOString().slice(0, 10);

function loc(lang, canonicalPath) {
  // English home = apex (https://verifykm.com/) so GSC indexes the main domain.
  if ((!canonicalPath || canonicalPath === "/") && lang === "en") return `${ORIGIN}/`;
  return `${ORIGIN}${localizedPath(lang, canonicalPath)}`;
}

/** Drop VIN shards — marketing-only SEO policy. */
function clearVinShards() {
  if (!existsSync(publicDir)) return 0;
  let n = 0;
  for (const name of readdirSync(publicDir)) {
    if (/^sitemap-vins-\d+\.xml$/i.test(name)) {
      unlinkSync(join(publicDir, name));
      n += 1;
    }
  }
  return n;
}

function pathPriority(path, lang) {
  const primary = PRIORITY_LANGS.has(lang);
  if (path === "" || path === "/") {
    return primary ? "1.0" : "0.6";
  }
  if (path.startsWith("/api-b2b")) return primary ? "0.35" : "0.15";
  if (
    path === "/pricing"
    || path === "/free-vin-decoder"
    || path === "/how-it-works"
    || path === "/faq"
  ) {
    return primary ? "0.95" : "0.55";
  }
  if (path.startsWith("/cars")) return primary ? "0.9" : "0.5";
  if (path.startsWith("/blog")) return primary ? "0.85" : "0.5";
  return primary ? "0.8" : "0.45";
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
      path === "" || path === "/"
        ? "weekly"
        : path.startsWith("/api-b2b")
          ? "yearly"
          : "monthly";
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

const removedVinShards = clearVinShards();

const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${ORIGIN}/sitemap-pages.xml</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>
</sitemapindex>
`;

writeFileSync(indexOut, indexXml, "utf8");
console.log(
  `Wrote ${urls.length} page URLs → public/sitemap-pages.xml; sitemap index → public/sitemap.xml (VIN SEO off` +
    (removedVinShards ? `; removed ${removedVinShards} VIN shard(s)` : "") +
    `)`,
);
