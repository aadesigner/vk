/**
 * Durable Carstat USA/Canada HTML report store.
 * Provider CDN links expire (~10 days). We keep a sanitized gzip snapshot per VIN on disk
 * (~70KB typical) so catalog / re-purchases keep working without RAM bloat or DB blobs.
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { logger } from "./logger.js";
import { assertAllowedUsaReportUrl, sanitizeUsaReportHtml } from "./carstatUsaReportSanitize.js";

export type UsaHtmlStoreMeta = {
  vin: string;
  savedAt: string;
  byteLengthRaw: number;
  byteLengthGzip: number;
  sourceHtmlUrlHost?: string;
};

function storeDir(): string {
  return (
    process.env.CARSTAT_USA_HTML_CACHE_DIR?.trim()
    || path.join(process.cwd(), ".cache", "carstat-usa-html")
  );
}

function normalizeVin(vin: string): string {
  return vin.trim().toUpperCase();
}

function keyForVin(vin: string): string {
  return crypto.createHash("sha256").update(normalizeVin(vin)).digest("hex").slice(0, 32);
}

function pathsForVin(vin: string): { bodyPath: string; metaPath: string } {
  const key = keyForVin(vin);
  const dir = storeDir();
  return {
    bodyPath: path.join(dir, `${key}.html.gz`),
    metaPath: path.join(dir, `${key}.json`),
  };
}

async function ensureStoreDir(): Promise<void> {
  await fs.mkdir(storeDir(), { recursive: true });
}

/** Read sanitized HTML from disk, or null if missing/corrupt. */
export async function readStoredUsaHtml(vin: string): Promise<string | null> {
  const normalized = normalizeVin(vin);
  if (!normalized) return null;
  const { bodyPath } = pathsForVin(normalized);
  try {
    const gz = await fs.readFile(bodyPath);
    const html = gunzipSync(gz).toString("utf8");
    if (!html || html.length < 32) return null;
    return html;
  } catch {
    return null;
  }
}

/** Persist already-sanitized HTML (gzip). Fire-and-forget safe. */
export async function writeStoredUsaHtml(
  vin: string,
  sanitizedHtml: string,
  opts?: { sourceHtmlUrl?: string | null },
): Promise<UsaHtmlStoreMeta | null> {
  const normalized = normalizeVin(vin);
  if (!normalized || !sanitizedHtml.trim()) return null;

  await ensureStoreDir();
  const { bodyPath, metaPath } = pathsForVin(normalized);
  const rawBuf = Buffer.from(sanitizedHtml, "utf8");
  const gz = gzipSync(rawBuf, { level: 9 });

  let sourceHtmlUrlHost: string | undefined;
  const src = opts?.sourceHtmlUrl?.trim();
  if (src) {
    try {
      sourceHtmlUrlHost = new URL(src).hostname;
    } catch {
      /* ignore */
    }
  }

  const meta: UsaHtmlStoreMeta = {
    vin: normalized,
    savedAt: new Date().toISOString(),
    byteLengthRaw: rawBuf.length,
    byteLengthGzip: gz.length,
    sourceHtmlUrlHost,
  };

  const tmpBody = `${bodyPath}.${process.pid}.tmp`;
  const tmpMeta = `${metaPath}.${process.pid}.tmp`;
  try {
    await fs.writeFile(tmpBody, gz);
    await fs.writeFile(tmpMeta, JSON.stringify(meta));
    await fs.rename(tmpBody, bodyPath);
    await fs.rename(tmpMeta, metaPath);
    logger.info({
      msg: "carstat_usa_html_stored",
      vin: normalized,
      gzipBytes: gz.length,
      rawBytes: rawBuf.length,
    });
    return meta;
  } catch (err) {
    logger.warn({ err, vin: normalized }, "carstat_usa_html_store_write_failed");
    try { await fs.unlink(tmpBody); } catch { /* ignore */ }
    try { await fs.unlink(tmpMeta); } catch { /* ignore */ }
    return null;
  }
}

/**
 * Fetch upstream HTML, sanitize, store, return sanitized body.
 * SSRF-guarded via allowlist.
 */
export async function fetchSanitizeAndStoreUsaHtml(
  vin: string,
  htmlUrl: string,
): Promise<string> {
  assertAllowedUsaReportUrl(htmlUrl);
  const upstream = await fetch(htmlUrl, {
    signal: AbortSignal.timeout(60_000),
    headers: { Accept: "text/html,*/*" },
  });
  if (!upstream.ok) {
    throw Object.assign(new Error(`Upstream HTML fetch failed (${upstream.status})`), {
      status: upstream.status,
    });
  }
  const raw = await upstream.text();
  const sanitized = sanitizeUsaReportHtml(raw);
  void writeStoredUsaHtml(vin, sanitized, { sourceHtmlUrl: htmlUrl });
  return sanitized;
}

/** Best-effort warm of disk store after paid USA fulfill (does not throw). */
export function warmUsaHtmlStore(vin: string, htmlUrl: string | null | undefined): void {
  const url = typeof htmlUrl === "string" ? htmlUrl.trim() : "";
  if (!url) return;
  void (async () => {
    const existing = await readStoredUsaHtml(vin);
    if (existing) return;
    await fetchSanitizeAndStoreUsaHtml(vin, url);
  })().catch((err) => {
    logger.warn({ err, vin }, "carstat_usa_html_warm_failed");
  });
}
