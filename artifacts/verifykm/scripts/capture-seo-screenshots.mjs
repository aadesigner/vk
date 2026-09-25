/**
 * Capture localized OG preview images for all public frontend pages (not auth/admin).
 *
 * Usage (from repo root or artifacts/verifykm):
 *   pnpm --filter @workspace/verifykm run build
 *   pnpm --filter @workspace/verifykm run seo:capture-screenshots
 *
 * Optional: SEO_CAPTURE_URL=http://127.0.0.1:4173 (skip starting preview server)
 */
import { spawn } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SEO_OG_LANGS,
  SEO_OG_PAGES,
  SEO_OG_WIDTH,
  SEO_OG_HEIGHT,
  seoOgImageRelPath,
} from "./seo-og-config.mjs";
import { localizedPath } from "./localized-routes.mjs";
import { compressOgWebp } from "./seo-og-compress.mjs";

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, "..");
const outDir = join(root, "public", "seo", "og");
const distDir = join(root, "dist", "public");

const PREVIEW_PORT = Number(process.env.SEO_CAPTURE_PORT ?? 4173);
const EXTERNAL_URL = process.env.SEO_CAPTURE_URL?.replace(/\/$/, "");
const CAPTURE_LANGS = process.env.SEO_CAPTURE_LANGS
  ? process.env.SEO_CAPTURE_LANGS.split(",").map((s) => s.trim()).filter(Boolean)
  : null;
const CAPTURE_PAGES = process.env.SEO_CAPTURE_PAGES
  ? process.env.SEO_CAPTURE_PAGES.split(",").map((s) => s.trim()).filter(Boolean)
  : null;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function compressToWebp(pngBuffer, destPath) {
  await compressOgWebp(pngBuffer, destPath);
}

function waitForHttp(url, attempts = 60) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const tick = async () => {
      n += 1;
      try {
        const res = await fetch(url, { redirect: "manual" });
        if (res.ok || res.status === 304 || res.status < 500) {
          resolve();
          return;
        }
      } catch { /* retry */ }
      if (n >= attempts) {
        reject(new Error(`Server not ready at ${url}`));
        return;
      }
      setTimeout(tick, 500);
    };
    tick();
  });
}

function startPreview() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "npx",
      ["vite", "preview", "--config", "vite.config.ts", "--host", "127.0.0.1", "--port", String(PREVIEW_PORT)],
      { cwd: root, stdio: ["ignore", "pipe", "pipe"], shell: true, env: { ...process.env, NODE_ENV: "production" } },
    );
    let started = false;
    const onData = (chunk) => {
      const text = chunk.toString();
      if (!started && /Local:\s+http/i.test(text)) {
        started = true;
        resolve(child);
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("error", reject);
    child.on("exit", (code) => {
      if (!started) reject(new Error(`vite preview exited with code ${code}`));
    });
    setTimeout(() => {
      if (!started) resolve(child);
    }, 15_000);
  });
}

async function main() {
  if (!EXTERNAL_URL && !existsSync(join(distDir, "index.html"))) {
    console.error("Missing dist/public/index.html — run `pnpm run build` in artifacts/verifykm first.");
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });

  let previewProc;
  const baseUrl = EXTERNAL_URL ?? `http://127.0.0.1:${PREVIEW_PORT}`;
  if (!EXTERNAL_URL) {
    previewProc = await startPreview();
    await waitForHttp(`${baseUrl}/en`);
  }

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: SEO_OG_WIDTH, height: SEO_OG_HEIGHT },
    deviceScaleFactor: 2,
    colorScheme: "light",
  });
  const page = await context.newPage();

  let count = 0;
  const langs = CAPTURE_LANGS?.length ? SEO_OG_LANGS.filter((l) => CAPTURE_LANGS.includes(l)) : SEO_OG_LANGS;
  if (langs.length === 0) {
    console.error("No languages matched SEO_CAPTURE_LANGS");
    process.exit(1);
  }
  const pages = CAPTURE_PAGES?.length
    ? SEO_OG_PAGES.filter((p) => CAPTURE_PAGES.includes(p.pageKey))
    : SEO_OG_PAGES;
  if (pages.length === 0) {
    console.error("No pages matched SEO_CAPTURE_PAGES");
    process.exit(1);
  }
  try {
    for (const { pageKey, rest } of pages) {
      for (const lang of langs) {
        const urlPath = localizedPath(lang, rest);
        const url = `${baseUrl}${urlPath}`;
        process.stdout.write(`Capturing ${pageKey} (${lang})… `);
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
        await page.waitForSelector("h1", { timeout: 20_000 });
        await page.evaluate(async () => {
          await document.fonts?.ready;
          document.querySelector("[data-announcement-bar]")?.remove();
          const imgs = [...document.images].filter((img) => {
            const r = img.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.top < 630;
          });
          await Promise.all(imgs.map((img) => {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            return new Promise((resolve) => {
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
              setTimeout(resolve, 4000);
            });
          }));
        });
        await sleep(700);
        const png = await page.screenshot({
          type: "png",
          clip: { x: 0, y: 0, width: SEO_OG_WIDTH, height: SEO_OG_HEIGHT },
        });
        const rel = seoOgImageRelPath(pageKey, lang);
        const dest = join(root, "public", rel.replace(/^\//, ""));
        mkdirSync(dirname(dest), { recursive: true });
        await compressToWebp(png, dest);
        count += 1;
        console.log(rel);
      }
    }
  } finally {
    await browser.close();
    if (previewProc && !previewProc.killed) {
      previewProc.kill("SIGTERM");
    }
  }

  console.log(`\nDone — ${count} WebP OG images → public/seo/og/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
