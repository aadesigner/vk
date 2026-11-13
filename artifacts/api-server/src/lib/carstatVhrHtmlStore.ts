/**
 * Durable Carstat VHR HTML report store (per VIN + sourceId).
 * Provider CDN links expire; keep a sanitized gzip snapshot on disk.
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { logger } from "./logger.js";
import { assertAllowedVhrReportUrl, sanitizeVhrReportHtml } from "./carstatVhrReportSanitize.js";

export type VhrHtmlStoreMeta = {
  vin: string;
  sourceId: number;
  savedAt: string;
  byteLengthRaw: number;
  byteLengthGzip: number;
  sourceHtmlUrlHost?: string;
};

function storeDir(): string {
  return (
    process.env.CARSTAT_VHR_HTML_CACHE_DIR?.trim()
    || path.join(process.cwd(), ".cache", "carstat-vhr-html")
  );
}

function normalizeVin(vin: string): string {
  return vin.trim().toUpperCase();
}

function keyFor(vin: string, sourceId: number): string {
  return crypto
    .createHash("sha256")
    .update(`${normalizeVin(vin)}:${sourceId}`)
    .digest("hex")
    .slice(0, 32);
}

function pathsFor(vin: string, sourceId: number): { bodyPath: string; metaPath: string } {
  const key = keyFor(vin, sourceId);
  const dir = storeDir();
  return {
    bodyPath: path.join(dir, `${key}.html.gz`),
    metaPath: path.join(dir, `${key}.json`),
  };
}

async function ensureStoreDir(): Promise<void> {
  await fs.mkdir(storeDir(), { recursive: true });
}

export async function readStoredVhrHtml(vin: string, sourceId: number): Promise<string | null> {
  const normalized = normalizeVin(vin);
  if (!normalized || !Number.isFinite(sourceId)) return null;
  const { bodyPath } = pathsFor(normalized, sourceId);
  try {
    const gz = await fs.readFile(bodyPath);
    const html = gunzipSync(gz).toString("utf8");
    if (!html || html.length < 32) return null;
    return html;
  } catch {
    return null;
  }
}

export async function writeStoredVhrHtml(
  vin: string,
  sourceId: number,
  sanitizedHtml: string,
  opts?: { sourceHtmlUrl?: string | null },
): Promise<VhrHtmlStoreMeta | null> {
  const normalized = normalizeVin(vin);
  if (!normalized || !sanitizedHtml.trim() || !Number.isFinite(sourceId)) return null;

  await ensureStoreDir();
  const { bodyPath, metaPath } = pathsFor(normalized, sourceId);
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

  const meta: VhrHtmlStoreMeta = {
    vin: normalized,
    sourceId,
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
      msg: "carstat_vhr_html_stored",
      vin: normalized,
      sourceId,
      gzipBytes: gz.length,
      rawBytes: rawBuf.length,
    });
    return meta;
  } catch (err) {
    logger.warn({ err, vin: normalized, sourceId }, "carstat_vhr_html_store_write_failed");
    try { await fs.unlink(tmpBody); } catch { /* ignore */ }
    try { await fs.unlink(tmpMeta); } catch { /* ignore */ }
    return null;
  }
}

export async function fetchSanitizeAndStoreVhrHtml(
  vin: string,
  sourceId: number,
  htmlUrl: string,
): Promise<string> {
  assertAllowedVhrReportUrl(htmlUrl);
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
  const sanitized = sanitizeVhrReportHtml(raw);
  void writeStoredVhrHtml(vin, sourceId, sanitized, { sourceHtmlUrl: htmlUrl });
  return sanitized;
}

/** Best-effort warm of disk store after paid VHR fulfill (does not throw). */
export function warmVhrHtmlStore(
  vin: string,
  sourceId: number,
  htmlUrl: string | null | undefined,
): void {
  const url = typeof htmlUrl === "string" ? htmlUrl.trim() : "";
  if (!url || !Number.isFinite(sourceId)) return;
  void (async () => {
    const existing = await readStoredVhrHtml(vin, sourceId);
    if (existing) return;
    await fetchSanitizeAndStoreVhrHtml(vin, sourceId, url);
  })().catch((err) => {
    logger.warn({ err, vin, sourceId }, "carstat_vhr_html_warm_failed");
  });
}
