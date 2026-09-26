/**
 * Card-sized demo car photos (self-hosted in public/demo-cars).
 * Cards are ~360–450px wide; 720px is 2× retina. Writes JPEG + WebP.
 * Run: node artifacts/verifykm/scripts/optimize-demo-car-photos.mjs
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const CARD_WIDTH = 720;
const JPEG_QUALITY = 68;
const WEBP_QUALITY = 58;

export async function optimizeDemoCarVariants(buf) {
  const base = sharp(buf, { failOn: "none" }).rotate();
  const meta = await base.metadata();
  const width = meta.width ?? 0;
  const resized =
    width > CARD_WIDTH ? base.resize(CARD_WIDTH, null, { withoutEnlargement: true }) : base;
  const [jpg, webp] = await Promise.all([
    resized.clone().jpeg({ quality: JPEG_QUALITY, mozjpeg: true, progressive: true }).toBuffer(),
    resized.clone().webp({ quality: WEBP_QUALITY, effort: 6 }).toBuffer(),
  ]);
  return { jpg, webp };
}

/** @deprecated use optimizeDemoCarVariants */
export async function optimizeDemoCarJpeg(buf) {
  const { jpg } = await optimizeDemoCarVariants(buf);
  return jpg;
}

const dirs = [
  join(dirname(fileURLToPath(import.meta.url)), "..", "public", "demo-cars"),
  join(dirname(fileURLToPath(import.meta.url)), "..", "src", "assets", "demo-cars"),
];

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  let saved = 0;
  let count = 0;
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((name) => name.toLowerCase().endsWith(".jpg"))) {
      const jpgPath = join(dir, file);
      const webpPath = join(dir, file.replace(/\.jpg$/i, ".webp"));
      const before = readFileSync(jpgPath);
      const { jpg, webp } = await optimizeDemoCarVariants(before);
      writeFileSync(jpgPath, jpg);
      writeFileSync(webpPath, webp);
      saved += Math.max(0, before.length - webp.length);
      count += 1;
      console.log(
        `${file}: ${Math.round(before.length / 1024)}KB → jpg ${Math.round(jpg.length / 1024)}KB / webp ${Math.round(webp.length / 1024)}KB`,
      );
    }
  }
  console.log(`Wrote ${count} card JPEG+WebP pair(s)`);
}
