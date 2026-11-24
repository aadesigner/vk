import type { Request, Response, NextFunction } from "express";
import { ACQUISITION_COOKIE, encodeAcquisitionCookieValue, parseAcquisitionCookieValue } from "./acquisition.js";
import { classifyAcquisition, isStrongerAcquisition } from "./acquisitionClassify.js";
import { isCrawlerUserAgent } from "./crawlerDetection.js";

const COOKIE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_COOKIE_CHARS = 800;
const ASSET_RE = /\.(?:js|mjs|css|map|woff2?|png|jpe?g|webp|svg|ico|gif|txt|xml)$/i;

export function isHtmlAcquisitionRequest(req: Pick<Request, "method" | "path" | "headers">): boolean {
  if (req.method !== "GET") return false;
  const path = req.path || "";
  if (path.startsWith("/api")) return false;
  if (path.includes("/assets/")) return false;
  if (ASSET_RE.test(path)) return false;
  const accept = String(req.headers.accept ?? "");
  if (accept.includes("application/json") && !accept.includes("text/html")) return false;
  if (isCrawlerUserAgent(typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null)) {
    return false;
  }
  return true;
}

function requestHref(req: Request): string {
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "verifykm.com")
    .split(",")[0]
    .trim();
  const proto = String(req.headers["x-forwarded-proto"] ?? req.protocol ?? "https")
    .split(",")[0]
    .trim();
  return `${proto}://${host}${req.originalUrl}`;
}

function requestHost(req: Request): string {
  return String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "")
    .split(",")[0]
    .trim()
    .replace(/:\d+$/, "")
    .replace(/^www\./i, "")
    .toLowerCase();
}

function hasUsableSignal(channel: string, bucket: string): boolean {
  return bucket !== "direct" && bucket !== "unknown";
}

/**
 * First-touch cookie on a real browser HTML GET.
 * Does not change HTML, SEO tags, or cache policy. Skips bots, assets, APIs, and empty/direct hits
 * so Google and CDNs never see a tracking Set-Cookie on a normal crawl.
 */
export function htmlAcquisitionCookie(req: Request, res: Response, next: NextFunction): void {
  if (!isHtmlAcquisitionRequest(req)) {
    next();
    return;
  }

  const incoming = classifyAcquisition(
    requestHref(req),
    typeof req.headers.referer === "string" ? req.headers.referer : "",
    typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : "",
    requestHost(req),
  );

  const existing = parseAcquisitionCookieValue(
    typeof req.cookies?.[ACQUISITION_COOKIE] === "string" ? req.cookies[ACQUISITION_COOKIE] : undefined,
  );

  if (existing) {
    if (!isStrongerAcquisition(existing, incoming)) {
      next();
      return;
    }
  } else if (!hasUsableSignal(incoming.channel, incoming.bucket)) {
    next();
    return;
  }

  const value = encodeAcquisitionCookieValue(incoming);
  if (!value || value.length > MAX_COOKIE_CHARS) {
    next();
    return;
  }

  const secure = req.secure || String(req.headers["x-forwarded-proto"] ?? "").includes("https");
  res.cookie(ACQUISITION_COOKIE, value, {
    path: "/",
    maxAge: COOKIE_MAX_AGE_MS,
    sameSite: "lax",
    secure,
    httpOnly: false,
  });
  next();
}
