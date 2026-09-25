/**
 * After Vite build: write per-language/route index.html with baked-in SEO meta.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SEO_LANGS,
  getPrerenderPaths,
  injectSeoIntoHtml,
} from "./seo-inject.mjs";
import { localizeCanonicalRest, localizedPath } from "./localized-routes.mjs";

const dir = dirname(fileURLToPath(import.meta.url));
const dist = join(dir, "..", "dist", "public");
const template = readFileSync(join(dist, "index.html"), "utf8");
const basePath = (process.env.BASE_PATH ?? "/").replace(/\/$/, "");

let count = 0;

for (const lang of SEO_LANGS) {
  for (const rest of getPrerenderPaths()) {
    const urlPath = localizedPath(lang, rest);
    const html = injectSeoIntoHtml(template, urlPath, basePath);
    const localizedRest = localizeCanonicalRest(lang, rest);
    const outDir = localizedRest
      ? join(dist, lang, ...localizedRest.split("/").filter(Boolean))
      : join(dist, lang);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "index.html"), html, "utf8");
    count++;
  }
}

// Root fallback — English home (for hosts that only serve /index.html)
writeFileSync(
  join(dist, "index.html"),
  injectSeoIntoHtml(template, "/en", basePath),
  "utf8",
);

console.log(`Prerendered ${count} localized HTML shells (+ root fallback) → dist/public/`);
