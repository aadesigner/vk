import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const i18nDir = path.join(__dirname, "../src/i18n");
const en = JSON.parse(fs.readFileSync(path.join(i18nDir, "en.json"), "utf8"));
const enKeys = Object.keys(en);

const parts = [];
for (let i = 0; i < 6; i++) {
  const partPath = path.join(__dirname, `ro-part-${i}.json`);
  if (!fs.existsSync(partPath)) {
    console.error(`Missing ${partPath}`);
    process.exit(1);
  }
  parts.push(JSON.parse(fs.readFileSync(partPath, "utf8")));
}

const ro = Object.assign({}, ...parts);
const roKeys = Object.keys(ro);

const missing = enKeys.filter((k) => !(k in ro));
const extra = roKeys.filter((k) => !(k in en));

if (missing.length) {
  console.error("Missing keys:", missing.length, missing.slice(0, 10));
  process.exit(1);
}
if (extra.length) {
  console.error("Extra keys:", extra.length, extra.slice(0, 10));
  process.exit(1);
}

const ordered = {};
for (const key of enKeys) {
  ordered[key] = ro[key];
}

const outPath = path.join(i18nDir, "ro.json");
fs.writeFileSync(outPath, JSON.stringify(ordered, null, 2) + "\n", "utf8");
console.log("Wrote", outPath, "with", Object.keys(ordered).length, "keys");
