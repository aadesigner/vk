/**
 * Recompress demo-car JPEGs for card-sized display (~960px).
 * Run: node artifacts/verifykm/scripts/optimize-demo-car-photos.mjs
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const MAX_WIDTH = 960;
const JPEG_QUALITY = 74;

export async function optimizeDemoCarJpeg(buf) {
  const img = sharp(buf, { failOn: "none" });
  const meta = await img.metadata();
  const width = meta.width ?? 0;
  const pipeline =
    width > MAX_WIDTH ? img.resize(MAX_WIDTH, null, { withoutEnlargement: true }) : img;
  return pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true, progressive: true }).toBuffer();
}

const dirs = [
  join(dirname(fileURLToPath(import.meta.url)), "..", "public", "demo-cars"),
  join(dirname(fileURLToPath(import.meta.url)), "..", "src", "assets", "demo-cars"),
];

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (!isCli) {
  // imported as helper
} else {
  let saved = 0;
  let count = 0;
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((name) => name.toLowerCase().endsWith(".jpg"))) {
      const path = join(dir, file);
      const before = readFileSync(path);
      const after = await optimizeDemoCarJpeg(before);
      if (after.length < before.length) {
        writeFileSync(path, after);
        saved += before.length - after.length;
        count += 1;
        console.log(`${file}: ${Math.round(before.length / 1024)}KB → ${Math.round(after.length / 1024)}KB`);
      }
    }
  }
  console.log(`Optimized ${count} demo car JPEG(s), saved ${Math.round(saved / 1024)}KB`);
}
