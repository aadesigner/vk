import express, { type Express, type Request, type Response } from "express";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parseVinPagePath, buildLockedHistorySummary, extractLockedPreviewSignals } from "@workspace/vin-page-seo";
import { logger } from "./logger.js";
import { resolveLockedPreviewPhotoSources, vinHasReportData } from "./vinService.js";
import { buildVinSeoFromCatalogData, catalogDataToVinSeoVehicle } from "./vinPageSeo.js";
import { buildImageProxyUrl, VIN_IMAGE_CARD_WIDTH } from "./imageProxy.js";
import { buildVinOnlyFallbackSeo, injectVinPageSeoIntoHtml } from "./vinSeoHtmlInject.js";
import { injectMarketingPageSeoFromPath } from "./marketingSeoHtmlInject.js";
import { isKnownSpaPath } from "./spaKnownPaths.js";
import { isCrawlerUserAgent } from "./crawlerDetection.js";

/** BCP 47 tags for Content-Language — keep in sync with verifykm scripts/languages.mjs */
const CONTENT_LANGUAGE_MAP: Record<string, string> = {
  en: "en",
  de: "de",
  es: "es",
  fr: "fr",
  sq: "sq-AL",
  pl: "pl",
  ro: "ro",
  bg: "bg",
  ka: "ka",
  ar: "ar",
  uk: "uk-UA",
  ru: "ru",
  zh: "zh-Hans",
};

const LANG_PATH_RE = /^\/(en|de|es|fr|sq|pl|ro|bg|ka|ar|uk|ru|zh)(?:\/|$)/;

function applyContentLanguageHeader(res: Response, reqPath: string): void {
  const m = reqPath.match(LANG_PATH_RE);
  if (!m) return;
  res.setHeader("Content-Language", CONTENT_LANGUAGE_MAP[m[1]] ?? m[1]);
}

const ONE_YEAR_SEC = 31_536_000;
const ONE_DAY_SEC = 86_400;

/** Missing build assets must 404 — never return index.html (breaks dynamic import). */
const STATIC_ASSET_PATH_RE = /\.(?:js|mjs|css|map|woff2?|png|jpe?g|webp|svg|ico|gif|txt|xml)$/i;

function isStaticAssetRequest(reqPath: string): boolean {
  const path = reqPath.toLowerCase();
  return path.includes("/assets/") || STATIC_ASSET_PATH_RE.test(path);
}

function resolvePublicDir(): string | null {
  const fromEnv = process.env.PUBLIC_DIR?.trim();
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  const candidates = [
    path.resolve(process.cwd(), "artifacts/verifykm/dist/public"),
    path.resolve(process.cwd(), "../verifykm/dist/public"),
    path.resolve(process.cwd(), "dist/public"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function setCacheHeaders(res: Response, maxAgeSec: number, immutable = false): void {
  const cacheControl = immutable
    ? `public, max-age=${maxAgeSec}, immutable`
    : `public, max-age=${maxAgeSec}, stale-while-revalidate=${maxAgeSec}`;
  res.setHeader("Cache-Control", cacheControl);
  res.setHeader("Expires", new Date(Date.now() + maxAgeSec * 1000).toUTCString());
}

function cachePolicyForFile(filePath: string): { maxAgeSec: number; immutable: boolean } | null {
  const base = path.basename(filePath).toLowerCase();
  if (filePath.endsWith(".html")) {
    // Must never be cached: HTML points at hashed /assets/* chunks that change every deploy.
    return { maxAgeSec: 0, immutable: false };
  }

  if (
    base === "favicon.ico"
    || base.startsWith("favicon-")
    || base === "favicon.png"
    || base === "apple-touch-icon.png"
    || filePath.includes(`${path.sep}assets${path.sep}`)
  ) {
    return { maxAgeSec: ONE_YEAR_SEC, immutable: true };
  }

  if (/\.(?:js|css|woff2?|png|jpe?g|webp|svg|ico|txt|xml)$/.test(filePath)) {
    return { maxAgeSec: ONE_DAY_SEC, immutable: false };
  }

  return null;
}

function applyStaticCacheHeaders(res: Response, filePath: string): void {
  const policy = cachePolicyForFile(filePath);
  if (!policy) return;
  if (policy.maxAgeSec <= 0) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    return;
  }
  setCacheHeaders(res, policy.maxAgeSec, policy.immutable);
}

function requestOrigin(req: Request): string {
  const fromEnv = process.env.SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const host = req.headers.host;
  if (!host) return "https://verifykm.com";
  const forwarded = req.headers["x-forwarded-proto"];
  const proto = (typeof forwarded === "string" ? forwarded.split(",")[0] : forwarded)
    ?? (req.secure ? "https" : "http");
  return `${proto}://${host}`.replace(/\/$/, "");
}

let cachedIndexHtml: string | null = null;
let cachedIndexMtimeMs = 0;

/** Re-read index.html when the file changes (deploy without process restart). */
function loadIndexHtml(publicDir: string): string {
  const indexPath = path.join(publicDir, "index.html");
  const mtimeMs = existsSync(indexPath) ? statSync(indexPath).mtimeMs : 0;
  if (!cachedIndexHtml || mtimeMs !== cachedIndexMtimeMs) {
    cachedIndexHtml = readFileSync(indexPath, "utf8");
    cachedIndexMtimeMs = mtimeMs;
  }
  return cachedIndexHtml;
}

async function injectVinCatalogSeo(html: string, reqPath: string, origin: string): Promise<string> {
  const parsed = parseVinPagePath(reqPath.replace(/\/$/, "") || "/");
  if (!parsed) return html;

  try {
    const report = await vinHasReportData(parsed.vin);
    if (!report) {
      const seo = buildVinOnlyFallbackSeo(parsed.lang, parsed.vin, origin);
      return injectVinPageSeoIntoHtml(html, seo, parsed.lang, origin);
    }

    const d = report.dataSource;
    const lockedPreviewSources = await resolveLockedPreviewPhotoSources(parsed.vin, d);
    const thumbnailUrl = lockedPreviewSources[0]
      ? buildImageProxyUrl(lockedPreviewSources[0], { mediaVersion: report.mediaVersion, width: VIN_IMAGE_CARD_WIDTH })
      : null;

    if (!thumbnailUrl) {
      const seo = buildVinOnlyFallbackSeo(parsed.lang, parsed.vin, origin);
      return injectVinPageSeoIntoHtml(html, seo, parsed.lang, origin);
    }

    const vehicle = catalogDataToVinSeoVehicle(parsed.vin, d, thumbnailUrl);
    const seo = buildVinSeoFromCatalogData(parsed.lang, parsed.vin, d, {
      thumbnailUrl,
      origin,
      isUnlocked: false,
    });
    const summary = buildLockedHistorySummary(
      parsed.lang,
      vehicle,
      extractLockedPreviewSignals(d as Record<string, unknown>),
    );
    return injectVinPageSeoIntoHtml(html, seo, parsed.lang, origin, vehicle, summary);
  } catch (err) {
    logger.warn({ err, path: reqPath }, "VIN SEO HTML inject failed");
    return html;
  }
}

function spaRelativePath(reqPath: string): string {
  const trimmed = reqPath.replace(/\/+$/, "") || "/";
  const safe = path.normalize(trimmed).replace(/^(\.\.(\/|\\|$))+/, "");
  if (safe === "/" || safe === ".") return "";
  return safe.replace(/^[/\\]+/, "");
}

function sendSpaFile(publicDir: string, reqPath: string, res: Response): boolean {
  // Match sitemap/canonical paths (no trailing slash) and legacy slashed URLs.
  const relative = spaRelativePath(reqPath);
  const direct = path.join(publicDir, relative);
  if (existsSync(direct) && statSync(direct).isFile()) {
    applyStaticCacheHeaders(res, direct);
    if (direct.endsWith(".html")) applyContentLanguageHeader(res, reqPath);
    res.sendFile(direct, (err) => {
      if (!err) return;
      logger.error({ err, file: direct, path: reqPath }, "static sendFile failed");
      if (!res.headersSent) {
        res.status(500).type("text/plain").send("File unavailable");
      }
    });
    return true;
  }
  const withIndex = path.join(publicDir, relative, "index.html");
  if (existsSync(withIndex) && statSync(withIndex).isFile()) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    applyContentLanguageHeader(res, reqPath);
    res.sendFile(withIndex, (err) => {
      if (!err) return;
      logger.error({ err, file: withIndex, path: reqPath }, "static index sendFile failed");
      if (!res.headersSent) {
        res.status(500).type("text/plain").send("File unavailable");
      }
    });
    return true;
  }
  return false;
}

async function sendSpaFallback(publicDir: string, reqPath: string, req: Request, res: Response): Promise<boolean> {
  const fallback = path.join(publicDir, "index.html");
  if (!existsSync(fallback)) return false;

  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  applyContentLanguageHeader(res, reqPath);
  const origin = requestOrigin(req);
  let html = loadIndexHtml(publicDir);
  html = await injectVinCatalogSeo(html, req.path, origin);
  html = injectMarketingPageSeoFromPath(html, req.path, origin);
  res.type("html").send(html);
  return true;
}

/** Real HTTP 404 shell — SPA NotFound can still hydrate; do not use English-home SEO. */
function sendHardNotFound(publicDir: string, req: Request, res: Response): boolean {
  const fallback = path.join(publicDir, "index.html");
  if (!existsSync(fallback)) return false;

  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  let html = loadIndexHtml(publicDir);
  html = html
    .replace(/\n?\s*<meta name="robots"[^>]*>/gi, "")
    .replace(/<title>[^<]*<\/title>/i, "<title>Page Not Found | verifykm.com</title>");
  if (!/<meta name="robots"/i.test(html)) {
    html = html.replace(
      /<\/title>/i,
      `</title>\n    <meta name="robots" content="noindex, nofollow" />`,
    );
  }
  res.status(404).type("html").send(html);
  return true;
}

const SITEMAP_FILE_RE = /^\/(sitemap\.xml|sitemap-pages\.xml|sitemap-vins-\d+\.xml)$/i;

/**
 * Dedicated sitemap handlers — always return application/xml (never SPA HTML),
 * and log sendFile failures instead of letting Express fall through oddly.
 */
function mountSitemapRoutes(app: Express, publicDir: string): void {
  app.get(SITEMAP_FILE_RE, (req: Request, res: Response) => {
    const base = path.basename(req.path);
    if (!/^(sitemap\.xml|sitemap-pages\.xml|sitemap-vins-\d+\.xml)$/i.test(base)) {
      res.status(404).type("text/plain").send("Not found");
      return;
    }
    const filePath = path.join(publicDir, base);
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      res.status(404).type("application/xml").send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<error>sitemap not found</error>\n`,
      );
      return;
    }
    applyStaticCacheHeaders(res, filePath);
    res.type("application/xml");
    res.sendFile(filePath, (err) => {
      if (!err) return;
      logger.error({ err, file: filePath }, "sitemap sendFile failed");
      if (!res.headersSent) {
        res.status(500).type("text/plain").send("Sitemap temporarily unavailable");
      }
    });
  });
}

/** Serve built verifykm frontend (production / Railway single-service deploy). */
export function mountStaticSite(app: Express): string | null {
  if (process.env.SERVE_STATIC === "false") return null;

  const publicDir = resolvePublicDir();
  if (!publicDir) {
    if (process.env.NODE_ENV === "production") {
      logger.warn("PUBLIC_DIR not found — API-only mode (no static site)");
    }
    return null;
  }

  // Before express.static + SPA fallback so sitemap always returns XML.
  mountSitemapRoutes(app, publicDir);

  app.use(
    express.static(publicDir, {
      index: false,
      // Sitemap/canonicals use no trailing slash. Default redirect:true 301s
      // /en/pricing → /en/pricing/ (prerender dirs), which GSC flags and the SPA strips again.
      // Fall through to sendSpaFile, which serves …/index.html at the unsashed URL.
      redirect: false,
      maxAge: process.env.NODE_ENV === "production" ? "1d" : 0,
      setHeaders(res, filePath) {
        applyStaticCacheHeaders(res, filePath);
      },
    }),
  );

  app.get(/^(?!\/api\/).*/, async (req: Request, res: Response) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.status(405).end();
      return;
    }
    // Soft-duplicate fix: `/` and `/en` both served English home (200 + canonical /en).
    // Crawlers get a stable 301 → /en. Real visitors keep SPA RootLangRedirect (geo/cookie).
    if (
      (req.path === "/" || req.path === "/index.html")
      && isCrawlerUserAgent(req.get("user-agent"))
    ) {
      const q = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
      res.redirect(301, `/en${q}`);
      return;
    }
    const urlPath = req.path === "/" ? "/index.html" : req.path;
    if (sendSpaFile(publicDir, urlPath, res)) return;
    if (isStaticAssetRequest(req.path)) {
      res.status(404).type("text/plain").send("Not found");
      return;
    }
    // Unknown routes: real 404 (not English home with status 200).
    if (!isKnownSpaPath(req.path)) {
      if (sendHardNotFound(publicDir, req, res)) return;
      res.status(404).send("Not found");
      return;
    }
    if (await sendSpaFallback(publicDir, urlPath, req, res)) return;
    res.status(404).send("Not found");
  });

  logger.info({ publicDir }, "Serving static site");
  return publicDir;
}
