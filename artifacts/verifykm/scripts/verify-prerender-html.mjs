/**
 * Post-build: every sitemap/indexable route must have a prerendered shell per language
 * with localized title, lang attribute, and index robots meta.
 *
 * Titles/descriptions are HTML-escaped in shells (& → &amp;), so comparisons must
 * use the same escaping as seo-inject.mjs.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  INDEXABLE_PRERENDER_PATHS,
  SEO_LANGS,
  resolveSeoForPath,
} from "./seo-inject.mjs";
import { localizeCanonicalRest, localizedPath } from "./localized-routes.mjs";

const dir = dirname(fileURLToPath(import.meta.url));
const dist = join(dir, "..", "dist", "public");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

if (!existsSync(dist)) {
  console.error("verify-prerender-html: dist/public missing — run vite build first");
  process.exit(1);
}

let errors = 0;
const expectedCount = INDEXABLE_PRERENDER_PATHS.length * SEO_LANGS.length;

for (const lang of SEO_LANGS) {
  for (const rest of INDEXABLE_PRERENDER_PATHS) {
    const localizedRest = localizeCanonicalRest(lang, rest);
    const file = localizedRest
      ? join(dist, lang, ...localizedRest.split("/").filter(Boolean), "index.html")
      : join(dist, lang, "index.html");
    const urlPath = localizedPath(lang, rest);

    if (!existsSync(file)) {
      console.error(`MISSING prerender shell: ${urlPath} → ${file}`);
      errors++;
      continue;
    }

    const html = readFileSync(file, "utf8");
    const seo = resolveSeoForPath(urlPath);

    if (seo.noIndex) {
      console.error(`UNEXPECTED noindex on indexable prerender: ${urlPath}`);
      errors++;
    }

    if (!html.includes(`lang="${lang}"`)) {
      console.error(`MISSING html lang="${lang}" on ${urlPath}`);
      errors++;
    }

    const titleInHtml = escapeHtml(seo.title);
    if (!html.includes(titleInHtml)) {
      console.error(`TITLE not baked into HTML for ${urlPath}`);
      console.error(`  expected fragment: ${seo.title.slice(0, 60)}…`);
      errors++;
    }

    if (!html.includes('content="index, follow"')) {
      console.error(`MISSING index,follow robots on ${urlPath}`);
      errors++;
    }

    const descriptionInHtml = escapeHtml(seo.description);
    if (!html.includes(descriptionInHtml)) {
      console.error(`DESCRIPTION not baked into HTML for ${urlPath}`);
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`verify-prerender-html FAILED — ${errors} issue(s) (${expectedCount} shells expected)`);
  process.exit(1);
}

console.log(
  `OK — ${expectedCount} prerendered indexable shells (${INDEXABLE_PRERENDER_PATHS.length} routes × ${SEO_LANGS.length} languages)`,
);
