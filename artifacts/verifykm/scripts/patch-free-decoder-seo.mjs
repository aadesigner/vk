/**
 * Merge free-decoder SEO i18n keys into all locale files + update seo-data.json
 * Run: node scripts/patch-free-decoder-seo.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SUPPORTED_LANGS } from "./languages.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, "..");
const i18nDir = path.join(root, "src", "i18n");
const seoPath = path.join(root, "src", "lib", "seo-data.json");

const data = JSON.parse(
  fs.readFileSync(path.join(dir, "data", "free-decoder-seo-i18n.json"), "utf8"),
);

for (const lang of SUPPORTED_LANGS) {
  const patch = data.i18n[lang];
  if (!patch) {
    console.error(`Missing i18n patch for ${lang}`);
    process.exit(1);
  }
  const filePath = path.join(i18nDir, `${lang}.json`);
  const existing = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const merged = { ...existing, ...patch };
  fs.writeFileSync(filePath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  console.log(`OK i18n/${lang}.json (+${Object.keys(patch).length} keys)`);
}

const seo = JSON.parse(fs.readFileSync(seoPath, "utf8"));
if (!seo.free_decoder) seo.free_decoder = {};
for (const lang of SUPPORTED_LANGS) {
  const meta = data.seo[lang];
  if (!meta) {
    console.error(`Missing seo patch for ${lang}`);
    process.exit(1);
  }
  seo.free_decoder[lang] = { ...seo.free_decoder[lang], ...meta };
}
fs.writeFileSync(seoPath, `${JSON.stringify(seo, null, 2)}\n`, "utf8");
console.log("OK seo-data.json free_decoder meta");
