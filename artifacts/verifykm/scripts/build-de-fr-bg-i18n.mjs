import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const i18nDir = path.join(__dirname, "../src/i18n");
const en = JSON.parse(fs.readFileSync(path.join(i18nDir, "en.json"), "utf8"));
const enKeys = Object.keys(en);

/** @returns {"ok" | "skip" | "fail"} */
function mergeLocale(prefix, outFile) {
  const parts = [];
  for (let i = 0; i < 6; i++) {
    const partPath = path.join(__dirname, `${prefix}-part-${i}.json`);
    if (!fs.existsSync(partPath)) {
      if (i === 0) return "skip";
      console.log(`Skipping ${prefix} — incomplete part set (missing ${partPath})`);
      return "skip";
    }
    parts.push(JSON.parse(fs.readFileSync(partPath, "utf8")));
  }

  const merged = Object.assign({}, ...parts);
  const mergedKeys = Object.keys(merged);

  const missing = enKeys.filter((k) => !(k in merged));
  const extra = mergedKeys.filter((k) => !(k in en));

  if (missing.length) {
    console.error(`[${prefix}] Missing keys:`, missing.length, missing.slice(0, 10));
    return "fail";
  }
  if (extra.length) {
    console.error(`[${prefix}] Extra keys:`, extra.length, extra.slice(0, 10));
    return "fail";
  }

  const ordered = {};
  for (const key of enKeys) {
    ordered[key] = merged[key];
  }

  const outPath = path.join(i18nDir, outFile);
  fs.writeFileSync(outPath, JSON.stringify(ordered, null, 2) + "\n", "utf8");
  console.log("Wrote", outPath, "with", Object.keys(ordered).length, "keys");
  return "ok";
}

let anyFailed = false;
for (const [prefix, outFile] of [
  ["de", "de.json"],
  ["fr", "fr.json"],
  ["bg", "bg.json"],
]) {
  const result = mergeLocale(prefix, outFile);
  if (result === "fail") anyFailed = true;
}

if (anyFailed) process.exit(1);
