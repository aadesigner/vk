/**
 * Download VIN help dialog photos from Wikimedia Commons (CC-licensed).
 * Run: node artifacts/verifykm/scripts/fetch-vin-help-photos.mjs
 */
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "vin-help");
mkdirSync(OUT, { recursive: true });

/** @type {Array<{ out: string; candidates: string[] }>} */
const PHOTOS = [
  {
    out: "windshield-vin.jpg",
    candidates: [
      "VIN - IMG 0467.JPG",
      "VIN - Fahrgestellnummer IMG 0470.JPG",
    ],
  },
  {
    out: "door-jamb-vin.jpg",
    candidates: [
      "VIN - Audi 80-90 B4.JPG",
      "Fahrgestellnummer.jpg",
      "Typenschild 425.820.jpg",
      "Umístění VIN.jpg",
    ],
  },
  {
    out: "registration-doc.jpg",
    candidates: [
      "1947 - Vehicle Registration Card - Allentown PA.jpg",
      "1950 - Vehicle Registration Card - Allentown PA.jpg",
      "Vehicle Registration Card - Allentown PA.jpg",
      "SPECIMEN EU Greek Vehicle Registration from 2004.jpg",
    ],
  },
  {
    out: "insurance-card.svg",
    candidates: [],
    /** Bundled English SVG — Wikimedia insurance samples are often non-English (e.g. Taiwan). */
    skipFetch: true,
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wikiThumbUrl(fileName) {
  const title = `File:${fileName}`;
  const params = new URLSearchParams({
    action: "query",
    titles: title,
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: "1280",
    format: "json",
    origin: "*",
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { "User-Agent": "VerifyKMVinHelpScript/1.0 (https://verifykm.com)" },
  });
  if (!res.ok) throw new Error(`API ${res.status} for ${fileName}`);
  const json = await res.json();
  const pages = json.query?.pages ?? {};
  const page = Object.values(pages)[0];
  if (!page || page.missing === "") throw new Error(`Missing file: ${fileName}`);
  const info = page.imageinfo?.[0];
  const url = info?.thumburl ?? info?.url;
  if (!url) throw new Error(`No URL for ${fileName}`);
  return url;
}

async function download(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "VerifyKMVinHelpScript/1.0 (https://verifykm.com)" },
  });
  if (!res.ok) throw new Error(`Download ${res.status}: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

let failed = 0;
for (const photo of PHOTOS) {
  if (photo.skipFetch) {
    console.log(`Skipping ${photo.out} (bundled asset)`);
    continue;
  }
  process.stdout.write(`Fetching ${photo.out} … `);
  let saved = false;
  for (const wiki of photo.candidates) {
    try {
      await sleep(2500);
      const url = await wikiThumbUrl(wiki);
      const buf = await download(url);
      writeFileSync(join(OUT, photo.out), buf);
      console.log(`ok from "${wiki}" (${Math.round(buf.length / 1024)} KB)`);
      saved = true;
      break;
    } catch (err) {
      process.stdout.write(`\n  skip "${wiki}": ${err.message}\n  `);
    }
  }
  if (!saved) {
    failed += 1;
    console.log("FAILED (no candidate worked)");
  }
}

if (failed > 0) process.exitCode = 1;
