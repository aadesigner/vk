/**
 * Snapshot B2B SEO titles/descriptions for Node prerender + seo-bootstrap.
 * Run: pnpm exec tsx scripts/build-b2b-seo-data.ts
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SUPPORTED_LANGS, type Language } from "../src/lib/languages";
import { getB2bCopy, getRegionHeadlineLabel } from "../src/pages/api-b2b/copy";
import { API_B2B_REGIONS } from "../src/pages/api-b2b/regions";

const __dir = dirname(fileURLToPath(import.meta.url));
/** Node prerender / seo-bootstrap */
const outPath = join(__dir, "b2b-seo-data.json");
/** SPA resolveApiB2bSeo — keep in sync so seo-pages never imports api-b2b/copy.ts */
const spaOutPath = join(__dir, "../src/lib/b2b-seo-data.json");

type SeoEntry = { title: string; description: string };
type PageMap = Record<string, Record<string, SeoEntry>>;

const paths = [
  "/api-b2b",
  "/api-b2b/plans",
  "/api-b2b/contact",
  "/api-b2b/vin-decoder",
  ...API_B2B_REGIONS.map((r) => `/api-b2b/${r.slug}`),
] as const;

const data: PageMap = {};

for (const rest of paths) {
  data[rest] = {};
  for (const lang of SUPPORTED_LANGS) {
    const c = getB2bCopy(lang as Language);
    let title = c.seoHomeTitle;
    let description = c.seoHomeDesc;
    const tail = rest.replace(/^\/api-b2b/, "") || "";
    if (tail === "/plans") {
      title = c.seoPlansTitle;
      description = c.seoPlansDesc;
    } else if (tail === "/contact") {
      title = c.seoContactTitle;
      description = c.seoContactDesc;
    } else if (tail === "/vin-decoder") {
      title = c.seoDecoderTitle;
      description = c.seoDecoderDesc;
    } else if (tail.startsWith("/")) {
      const slug = tail.slice(1);
      const region = API_B2B_REGIONS.find((r) => r.slug === slug);
      if (region) {
        const label = getRegionHeadlineLabel(c, region.slug, lang as Language);
        title = c.seoRegionTitle.replace(/\{region\}/g, label);
        description = c.seoRegionDesc.replace(/\{region\}/g, label);
      }
    }
    data[rest][lang] = { title, description };
  }
}

const json = `${JSON.stringify(data, null, 2)}\n`;
writeFileSync(outPath, json, "utf8");
writeFileSync(spaOutPath, json, "utf8");
console.log(`Wrote ${outPath} and ${spaOutPath} (${paths.length} paths × ${SUPPORTED_LANGS.length} langs)`);
