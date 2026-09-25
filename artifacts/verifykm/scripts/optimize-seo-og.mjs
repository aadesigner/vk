/**
 * Re-compress OG WebP assets in public/seo/og with shared settings.
 *
 * Usage:
 *   node scripts/optimize-seo-og.mjs
 *   SEO_OG_LANGS=ro node scripts/optimize-seo-og.mjs
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compressOgWebpBuffer } from "./seo-og-compress.mjs";
import { SEO_OG_WEBP_QUALITY, SEO_OG_WEBP_EFFORT } from "./seo-og-config.mjs";

const dir = dirname(fileURLToPath(import.meta.url));
const ogDir = join(dir, "..", "public", "seo", "og");
const langFilter = process.env.SEO_OG_LANGS
  ? new Set(process.env.SEO_OG_LANGS.split(",").map((s) => s.trim()).filter(Boolean))
  : null;

const files = readdirSync(ogDir)
  .filter((f) => f.endsWith(".webp"))
  .filter((f) => {
    if (!langFilter) return true;
    const lang = f.replace(/^.+-([a-z]{2})\.webp$/, "$1");
    return langFilter.has(lang);
  })
  .sort();

let optimized = 0;
let saved = 0;

for (const file of files) {
  const src = join(ogDir, file);
  const before = statSync(src).size;
  const buf = await compressOgWebpBuffer(readFileSync(src));
  const after = buf.length;
  if (after <= before) {
    writeFileSync(src, buf);
    optimized += 1;
    saved += before - after;
    console.log(`${file}: ${Math.round(before / 1024)}KB → ${Math.round(after / 1024)}KB`);
  } else {
    console.log(`${file}: kept ${Math.round(before / 1024)}KB (recompress larger)`);
  }
}

console.log(
  `\nDone — ${optimized}/${files.length} optimized (q${SEO_OG_WEBP_QUALITY}, effort ${SEO_OG_WEBP_EFFORT}), saved ${Math.round(saved / 1024)}KB`,
);
