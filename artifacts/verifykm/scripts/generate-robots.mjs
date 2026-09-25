/**
 * Generates public/robots.txt — explicit per-language Disallow paths (no wildcards;
 * many SEO auditors reject wildcard Disallow paths as invalid syntax).
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SUPPORTED_LANGS } from "./languages.mjs";

const ORIGIN = process.env.SITE_ORIGIN?.trim() || "https://verifykm.com";
const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, "..");

const PRIVATE_SUFFIXES = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/set-password",
  "/dashboard",
  "/checkout",
  "/purchases",
  "/vin/processing",
];

const lines = ["User-agent: *", "Allow: /", "", "Disallow: /adminx"];

for (const lang of SUPPORTED_LANGS) {
  for (const suffix of PRIVATE_SUFFIXES) {
    lines.push(`Disallow: /${lang}${suffix}`);
  }
}

lines.push("", `Sitemap: ${ORIGIN.replace(/\/$/, "")}/sitemap.xml`, "");

writeFileSync(join(root, "public", "robots.txt"), lines.join("\n"), "utf8");
console.log(`Wrote public/robots.txt (${SUPPORTED_LANGS.length} langs × ${PRIVATE_SUFFIXES.length} private routes)`);
