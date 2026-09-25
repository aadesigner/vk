/**
 * Generates self-hosted flag favicons for country car pages (usa, korea, canada).
 * Uses lipis/flag-icons 1:1 SVGs (designed for square) with supersampled downscale.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { COUNTRY_PAGE_FAVICON_SLUGS } from "./country-favicon-config.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");

const FLAG_ICONS_VERSION = "7.5.0";

const FLAG_CODES = {
  usa: "us",
  korea: "kr",
  canada: "ca",
  china: "cn",
  japan: "jp",
  uae: "ae",
};

const SIZES = [
  { size: 16, name: (slug) => `favicon-${slug}-16x16.png` },
  { size: 32, name: (slug) => `favicon-${slug}-32x32.png` },
  { size: 180, name: (slug) => `apple-touch-icon-${slug}.png` },
];

/** 4× render then Lanczos downscale for crisp tab icons at 16–32px. */
const SUPERSAMPLE = 4;

async function fetchFlagSvg(code) {
  const url = `https://cdn.jsdelivr.net/npm/flag-icons@${FLAG_ICONS_VERSION}/flags/1x1/${code}.svg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function renderSquareFavicon(svgBuffer, size) {
  const hi = size * SUPERSAMPLE;
  return sharp(svgBuffer)
    .resize(hi, hi, { fit: "fill" })
    .resize(size, size, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

for (const slug of Object.values(COUNTRY_PAGE_FAVICON_SLUGS)) {
  const code = FLAG_CODES[slug];
  const source = await fetchFlagSvg(code);

  for (const { size, name } of SIZES) {
    const out = path.join(publicDir, name(slug));
    const png = await renderSquareFavicon(source, size);
    fs.writeFileSync(out, png);
    console.log(`Wrote ${path.basename(out)} (${size}x${size}, ${png.length} bytes)`);
  }
}
