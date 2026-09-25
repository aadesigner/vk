/**
 * Batch-translate en-chunk-*.json → pl-part-*.json via MyMemory API.
 * Preserves {{placeholders}} and HTML-ish tags.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHUNKS = 6;

const PLACEHOLDER_RE = /\{\{[^}]+\}\}|<[^>]+>/g;

function protect(str) {
  const tokens = [];
  const safe = String(str).replace(PLACEHOLDER_RE, (m) => {
    const id = `__PH${tokens.length}__`;
    tokens.push({ id, m });
    return id;
  });
  return { safe, tokens };
}

function restore(str, tokens) {
  let out = str;
  for (const { id, m } of tokens) {
    out = out.split(id).join(m);
  }
  return out;
}

async function translateText(text) {
  const { safe, tokens } = protect(text);
  if (!safe.trim()) return text;

  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q", safe.slice(0, 4500));
  url.searchParams.set("langpair", "en|pl");

  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url);
    if (!res.ok) {
      await sleep(1500 * (attempt + 1));
      continue;
    }
    const data = await res.json();
    const translated = data?.responseData?.translatedText;
    if (translated) return restore(translated, tokens);
    await sleep(1500 * (attempt + 1));
  }
  throw new Error(`translate failed: ${text.slice(0, 80)}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function translateChunk(i) {
  const inPath = path.join(__dirname, `en-chunk-${i}.json`);
  const outPath = path.join(__dirname, `pl-part-${i}.json`);
  const chunk = JSON.parse(fs.readFileSync(inPath, "utf8"));
  const out = {};
  const keys = Object.keys(chunk);
  console.log(`chunk ${i}: ${keys.length} keys`);

  for (let j = 0; j < keys.length; j++) {
    const key = keys[j];
    out[key] = await translateText(chunk[key]);
    if ((j + 1) % 25 === 0) console.log(`  chunk ${i}: ${j + 1}/${keys.length}`);
    await sleep(350);
  }

  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`wrote ${outPath}`);
}

const start = Number(process.argv[2] ?? 0);
const end = Number(process.argv[3] ?? CHUNKS - 1);
for (let i = start; i <= end; i++) {
  await translateChunk(i);
}
