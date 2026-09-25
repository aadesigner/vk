import {
  existsSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
  renameSync,
  readFileSync,
} from "node:fs";
import path from "node:path";

const ORIGIN = "https://verifykm.com";
const MAX_URLS_PER_SHARD = 25_000;

/** Keep in sync with artifacts/verifykm/scripts/languages.mjs */
const LANGS = ["en", "de", "es", "fr", "sq", "pl", "ro", "bg", "ka", "ar", "uk", "ru", "zh"] as const;
const HREFLANG: Record<(typeof LANGS)[number], string> = {
  en: "en",
  de: "de",
  es: "es",
  fr: "fr",
  sq: "sq-AL",
  pl: "pl",
  ro: "ro",
  bg: "bg",
  ka: "ka",
  ar: "ar",
  uk: "uk-UA",
  ru: "ru",
  zh: "zh-Hans",
};

function collectPublicDirs(): string[] {
  const dirs: string[] = [];
  const fromEnv = process.env.PUBLIC_DIR?.trim();
  if (fromEnv) dirs.push(fromEnv);

  const candidates = [
    path.resolve(process.cwd(), "artifacts/verifykm/dist/public"),
    path.resolve(process.cwd(), "../verifykm/dist/public"),
    path.resolve(process.cwd(), "artifacts/verifykm/public"),
    path.resolve(process.cwd(), "../verifykm/public"),
    path.resolve(process.cwd(), "dist/public"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate) && !dirs.includes(candidate)) dirs.push(candidate);
  }
  return dirs;
}

/**
 * Prefer the deployed static dir that already has sitemap-pages.xml
 * (Railway PUBLIC_DIR / vite dist/public).
 */
function resolveSitemapPublicDir(): string | null {
  for (const dir of collectPublicDirs()) {
    if (existsSync(path.join(dir, "sitemap-pages.xml"))) return dir;
  }
  return collectPublicDirs()[0] ?? null;
}

/**
 * VIN URLs live only in sitemap-vins-*.xml shards (not the marketing pages urlset
 * or the sitemap index).
 */
export function collectVinSitemapPaths(): string[] {
  const paths: string[] = [];
  for (const dir of collectPublicDirs()) {
    let names: string[] = [];
    try {
      names = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!/^sitemap-vins-\d+\.xml$/i.test(name)) continue;
      const full = path.join(dir, name);
      if (!paths.includes(full)) paths.push(full);
    }
  }
  return paths;
}

function collectSitemapPaths(): string[] {
  return collectVinSitemapPaths();
}

/** Remove every `<url>` block whose loc contains `/vin/{vin}`. */
export function removeVinUrlBlocks(xml: string, vin: string): string {
  const escaped = vin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blockRe = new RegExp(`\\s*<url>[\\s\\S]*?\\/vin\\/${escaped}[\\s\\S]*?<\\/url>`, "gi");
  return xml.replace(blockRe, "");
}

/** Strip VIN URLs from every VIN shard sitemap on disk (build output + source). */
export function removeVinFromSitemaps(vin: string): boolean {
  const normalized = vin.trim().toUpperCase();
  let updated = false;
  for (const file of collectSitemapPaths()) {
    try {
      const before = readFileSync(file, "utf8");
      const after = removeVinUrlBlocks(before, normalized);
      if (after !== before) {
        writeFileSync(file, after, "utf8");
        updated = true;
      }
    } catch {
      // missing or unreadable — skip
    }
  }
  return updated;
}

function writeAtomic(filePath: string, contents: string): void {
  const tmp = `${filePath}.${process.pid}.tmp`;
  writeFileSync(tmp, contents, "utf8");
  renameSync(tmp, filePath);
}

function clearVinShardsInDir(dir: string): void {
  for (const name of readdirSync(dir)) {
    if (/^sitemap-vins-\d+\.xml$/i.test(name)) {
      unlinkSync(path.join(dir, name));
    }
  }
}

function urlEntryForVin(vin: string, lastmod: string): string {
  const vinPath = `/vin/${vin}`;
  const alternates = LANGS.map(
    (l) =>
      `    <xhtml:link rel="alternate" hreflang="${HREFLANG[l]}" href="${ORIGIN}/${l}${vinPath}" />`,
  ).join("\n");
  const xDefault = `    <xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}/en${vinPath}" />`;
  return `  <url>
    <loc>${ORIGIN}/en${vinPath}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
${alternates}
${xDefault}
  </url>`;
}

function wrapUrlset(urlBlocks: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlBlocks.join("\n")}
</urlset>
`;
}

function writeSitemapIndex(publicDir: string, vinShardNames: string[], lastmod: string): void {
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
  writeAtomic(
    path.join(publicDir, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</sitemapindex>
`,
  );
}

export type VinSitemapRefreshResult = {
  publicDir: string;
  vinCount: number;
  shardCount: number;
};

/**
 * Rebuild VIN sitemap shards + sitemap index at runtime (Railway build cannot
 * reach postgres.railway.internal). Safe to call on a warm DB connection.
 */
export async function refreshVinSitemapShards(): Promise<VinSitemapRefreshResult | null> {
  const publicDir = resolveSitemapPublicDir();
  if (!publicDir) return null;
  if (!existsSync(path.join(publicDir, "sitemap-pages.xml"))) return null;

  const { desc, sql } = await import("drizzle-orm");
  const { db, vinCatalogTable } = await import("@workspace/db");
  const { CATALOG_HAS_PREVIEW_PHOTO_SQL } = await import("./vinCatalogImport.js");

  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({
      vin: vinCatalogTable.vin,
      updatedAt: vinCatalogTable.updatedAt,
    })
    .from(vinCatalogTable)
    .where(sql.raw(CATALOG_HAS_PREVIEW_PHOTO_SQL))
    .orderBy(desc(vinCatalogTable.updatedAt))
    .limit(50_000);

  clearVinShardsInDir(publicDir);

  if (rows.length === 0) {
    writeSitemapIndex(publicDir, [], today);
    return { publicDir, vinCount: 0, shardCount: 0 };
  }

  const entries = rows.map((row) => {
    const vin = String(row.vin).toUpperCase();
    const lastmod = row.updatedAt
      ? new Date(row.updatedAt).toISOString().slice(0, 10)
      : today;
    return urlEntryForVin(vin, lastmod);
  });

  const shardNames: string[] = [];
  for (let i = 0; i < entries.length; i += MAX_URLS_PER_SHARD) {
    const chunk = entries.slice(i, i + MAX_URLS_PER_SHARD);
    const name = `sitemap-vins-${shardNames.length + 1}.xml`;
    writeAtomic(path.join(publicDir, name), wrapUrlset(chunk));
    shardNames.push(name);
  }

  writeSitemapIndex(publicDir, shardNames, today);
  return { publicDir, vinCount: rows.length, shardCount: shardNames.length };
}
