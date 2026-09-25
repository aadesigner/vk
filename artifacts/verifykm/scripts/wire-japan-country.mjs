/**
 * Wire Japan into TS/JS allowlists after add-japan-country.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repo = path.resolve(root, "../..");

function patch(file, replacements) {
  const p = path.isAbsolute(file) ? file : path.join(root, file);
  let s = fs.readFileSync(p, "utf8");
  const orig = s;
  for (const [a, b] of replacements) {
    if (!s.includes(a)) {
      console.warn("MISS", path.relative(repo, p), JSON.stringify(a).slice(0, 80));
      continue;
    }
    s = s.split(a).join(b);
  }
  if (s !== orig) {
    fs.writeFileSync(p, s);
    console.log("patched", path.relative(repo, p));
  }
}

const setOld = '["usa", "korea", "canada", "china", "uae"]';
const setNew = '["usa", "korea", "canada", "china", "japan", "uae"]';

patch("src/lib/seo-pages.ts", [
  [setOld.replace(/\[/g, 'new Set([').replace(/\]/g, "])"), setNew.replace(/\[/g, 'new Set([').replace(/\]/g, "])")],
  ['"/cars/china": "country_china",\n  "/cars/uae": "country_uae",', '"/cars/china": "country_china",\n  "/cars/japan": "country_japan",\n  "/cars/uae": "country_uae",'],
  [': slug === "china" ? "country_china"\n          : slug === "uae"', ': slug === "china" ? "country_china"\n          : slug === "japan" ? "country_japan"\n            : slug === "uae"'],
  ['|| pageKey === "country_china" || pageKey === "country_uae")', '|| pageKey === "country_china" || pageKey === "country_japan" || pageKey === "country_uae")'],
]);

// Fix VALID_COUNTRY_SLUGS if first replace failed due to formatting
patch("src/lib/seo-pages.ts", [
  ['new Set(["usa", "korea", "canada", "china", "uae"])', 'new Set(["usa", "korea", "canada", "china", "japan", "uae"])'],
]);

patch("../api-server/src/lib/spaKnownPaths.ts", [
  ['new Set(["usa", "korea", "canada", "china", "uae"])', 'new Set(["usa", "korea", "canada", "china", "japan", "uae"])'],
]);

patch("../../lib/marketing-page-seo/marketing-meta-seo.ts", [
  ['new Set(["usa", "korea", "canada", "china", "uae"])', 'new Set(["usa", "korea", "canada", "china", "japan", "uae"])'],
  ['"/cars/china": "country_china",', '"/cars/china": "country_china",\n  "/cars/japan": "country_japan",'],
  ['"country_china",', '"country_china",\n  "country_japan",'],
  ['if (slug === "china") return "country_china";', 'if (slug === "china") return "country_china";\n      if (slug === "japan") return "country_japan";'],
]);

patch("../../lib/marketing-page-seo/index.ts", [
  ['"country_china",\n  "country_uae",', '"country_china",\n  "country_japan",\n  "country_uae",'],
]);

patch("scripts/seo-inject.mjs", [
  ['new Set(["usa", "korea", "canada", "china", "uae"])', 'new Set(["usa", "korea", "canada", "china", "japan", "uae"])'],
]);

patch("scripts/qa-seo.mjs", [
  ['"country_china", "country_uae"', '"country_china", "country_japan", "country_uae"'],
  ['["usa", "korea", "canada", "china", "uae"]', '["usa", "korea", "canada", "china", "japan", "uae"]'],
]);

patch("scripts/generate-seo-bootstrap.mjs", [
  ['["usa", "korea", "canada", "china", "uae"]', '["usa", "korea", "canada", "china", "japan", "uae"]'],
  ['"country_china", "country_uae"', '"country_china", "country_japan", "country_uae"'],
]);

patch("scripts/country-page-json-ld.mjs", [
  ['["country_usa", "country_korea", "country_canada", "country_china", "country_uae"]', '["country_usa", "country_korea", "country_canada", "country_china", "country_japan", "country_uae"]'],
]);

patch("scripts/seo-og-config.mjs", [
  ['{ pageKey: "country_china", rest: "/cars/china" },', '{ pageKey: "country_china", rest: "/cars/china" },\n  { pageKey: "country_japan", rest: "/cars/japan" },'],
]);

patch("scripts/country-favicon-config.mjs", [
  ['country_china: "china",\n  country_uae: "uae",', 'country_china: "china",\n  country_japan: "japan",\n  country_uae: "uae",'],
]);

patch("scripts/generate-country-favicons.mjs", [
  ['china: "cn",\n  uae: "ae",', 'china: "cn",\n  japan: "jp",\n  uae: "ae",'],
]);

patch("src/lib/country-favicons.ts", [
  ['"usa" | "korea" | "canada" | "china" | "uae"', '"usa" | "korea" | "canada" | "china" | "japan" | "uae"'],
  ['country_china: "china",\n  country_uae: "uae",', 'country_china: "china",\n  country_japan: "japan",\n  country_uae: "uae",'],
]);

patch("src/lib/seo-og-images.ts", [
  ['"country_china",', '"country_china",\n  "country_japan",'],
]);

patch("src/lib/prefetch-route.ts", [
  ['["usa", "korea", "canada", "china", "uae"]', '["usa", "korea", "canada", "china", "japan", "uae"]'],
]);

patch("src/lib/flag-alt.ts", [
  ['cn: "country_china_name",', 'cn: "country_china_name",\n  jp: "country_japan_name",'],
]);

patch("src/lib/country-names-all-locales.ts", [
  ['"country_china_name",\n  "country_uae_name",', '"country_china_name",\n  "country_japan_name",\n  "country_uae_name",'],
]);

patch("src/lib/home-stats.ts", [
  ['| "country_china_name"\n    | "country_uae_name"', '| "country_china_name"\n    | "country_japan_name"\n    | "country_uae_name"'],
  ['flag: "us" | "kr" | "ca" | "cn" | "ae"', 'flag: "us" | "kr" | "ca" | "cn" | "jp" | "ae"'],
  [
    '{ id: "china", value: "350M+", label: t("home_stat_china"), nameKey: "country_china_name", flag: "cn" },\n    { id: "uae"',
    '{ id: "china", value: "350M+", label: t("home_stat_china"), nameKey: "country_china_name", flag: "cn" },\n    { id: "japan", value: "78M+", label: t("home_stat_japan"), nameKey: "country_japan_name", flag: "jp" },\n    { id: "uae"',
  ],
]);

console.log("wire done");
