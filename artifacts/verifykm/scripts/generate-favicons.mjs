/**
 * Generates small, cache-friendly favicon assets from public/favicon.png (source mark).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const source = path.join(publicDir, "favicon.png");

if (!fs.existsSync(source)) {
  console.warn("generate-favicons: source public/favicon.png not found, skipping");
  process.exit(0);
}

const outputs = [
  { file: "favicon-16x16.png", size: 16 },
  { file: "favicon-32x32.png", size: 32 },
  { file: "apple-touch-icon.png", size: 180 },
];

for (const { file, size } of outputs) {
  const out = path.join(publicDir, file);
  await sharp(source)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(out);
  const bytes = fs.statSync(out).size;
  console.log(`Wrote ${file} (${size}x${size}, ${bytes} bytes)`);
}
