/**
 * Download lipis/flag-icons 4x3 SVGs into public/flags/4x3/
 * so FlagImg does not hit jsDelivr on every mobile sidebar open.
 *
 * Run: node scripts/fetch-flag-icons.mjs
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dir, "../public/flags/4x3");
const VERSION = "7.5.0";
const CDN = `https://cdn.jsdelivr.net/npm/flag-icons@${VERSION}/flags/4x3`;

/** Codes used by langs, markets, admin/geo, vehicle attrs, testimonials. */
const CODES = [
  // Languages
  "gb", "de", "es", "fr", "al", "pl", "ro", "bg", "ge", "sa", "ua", "ru", "cn",
  // Markets / nav
  "us", "kr", "ca", "jp", "ae", "xk",
  // Vehicle attrs extras
  "it", "nl", "au", "mx", "se", "no", "dk", "fi",
  // Geo plugin / admin countries
  "mk", "me", "by", "kz", "kg", "tw", "hk", "mo", "sg",
  "at", "ch", "li", "be", "lu", "mc",
  "ar", "co", "pe", "cl", "ve", "ec", "gt", "bo", "do", "hn", "py", "sv", "ni", "cr", "pa", "uy",
  "tr", "rs", "ba",
  "eg", "iq", "jo", "lb", "kw", "qa", "bh", "om", "ma", "dz", "tn", "ly", "ye", "ps", "il", "sy",
  "sd", "mr", "dj", "so", "km",
];

mkdirSync(outDir, { recursive: true });

const unique = [...new Set(CODES.map((c) => c.toLowerCase()))];
let ok = 0;
let skipped = 0;
let failed = 0;

for (const code of unique) {
  const dest = join(outDir, `${code}.svg`);
  if (existsSync(dest)) {
    skipped++;
    continue;
  }
  const url = `${CDN}/${code}.svg`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`FAIL ${code}: HTTP ${res.status}`);
      failed++;
      continue;
    }
    const svg = await res.text();
    if (!svg.includes("<svg")) {
      console.warn(`FAIL ${code}: not an SVG`);
      failed++;
      continue;
    }
    writeFileSync(dest, svg, "utf8");
    ok++;
    console.log(`OK ${code}`);
  } catch (err) {
    console.warn(`FAIL ${code}:`, err?.message ?? err);
    failed++;
  }
}

console.log(`Done — downloaded ${ok}, skipped ${skipped}, failed ${failed} → ${outDir}`);
if (failed > 0) process.exitCode = 1;
