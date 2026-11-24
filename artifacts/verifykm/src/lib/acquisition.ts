/**
 * First-touch marketing acquisition (client).
 * Server also stamps vk_acq on the first HTML request (Referer + URL).
 */

import {
  classifyAcquisition as classifyAcquisitionCore,
  isStrongerAcquisition,
  pickStrongerAcquisition,
  type AcquisitionBucket,
  type AcquisitionPayload,
} from "../../../api-server/src/lib/acquisitionClassify";

export type { AcquisitionBucket, AcquisitionPayload };
export { isStrongerAcquisition, pickStrongerAcquisition };

const STORAGE_KEY = "verifykm_acquisition_v1";
const COOKIE_NAME = "vk_acq";
const TTL_MS = 90 * 24 * 60 * 60 * 1000;
const COOKIE_MAX_AGE_SEC = 90 * 24 * 60 * 60;

type Stored = { payload: AcquisitionPayload; expiresAt: number };

export function classifyAcquisition(
  href: string = typeof window !== "undefined" ? window.location.href : "",
  referrerUrl: string = typeof document !== "undefined" ? document.referrer : "",
  userAgent: string = typeof navigator !== "undefined" ? navigator.userAgent : "",
): AcquisitionPayload {
  const selfHost = typeof window !== "undefined" ? window.location.hostname : null;
  return classifyAcquisitionCore(href, referrerUrl, userAgent, selfHost);
}

/** Add first-touch UTMs to share / profile links without overwriting existing tags. */
export function tagAcquisitionUrl(
  raw: string,
  source: string,
  medium = "social",
  campaign = "share",
): string {
  try {
    const u = new URL(raw);
    if (u.searchParams.get("utm_source")) return u.toString();
    u.searchParams.set("utm_source", source.slice(0, 40));
    u.searchParams.set("utm_medium", medium.slice(0, 40));
    u.searchParams.set("utm_campaign", campaign.slice(0, 60));
    return u.toString();
  } catch {
    return raw;
  }
}

function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed?.payload?.bucket || !parsed.expiresAt) return null;
    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(payload: AcquisitionPayload): void {
  try {
    const stored: Stored = { payload, expiresAt: Date.now() + TTL_MS };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // private mode / quota — ignore
  }
}

function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(raw: string): string {
  const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function readCookiePayload(): AcquisitionPayload | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )vk_acq=([^;]*)/);
  if (!match?.[1]) return null;
  try {
    const json = decodeURIComponent(match[1]).startsWith("{")
      ? decodeURIComponent(match[1])
      : fromBase64Url(decodeURIComponent(match[1]));
    const parsed = JSON.parse(json) as AcquisitionPayload;
    return parsed?.bucket ? parsed : null;
  } catch {
    return null;
  }
}

/** First-party cookie — 90 days so signup / OAuth still have the landing. */
export function syncAcquisitionCookie(payload?: AcquisitionPayload | null): void {
  if (typeof document === "undefined") return;
  const p = payload ?? getStoredAcquisition();
  if (!p) return;
  try {
    const compact = {
      bucket: p.bucket,
      channel: p.channel,
      source: p.source ?? undefined,
      medium: p.medium ?? undefined,
      campaign: p.campaign ?? undefined,
      content: p.content ?? undefined,
      term: p.term ?? undefined,
      clickId: p.clickId ?? undefined,
      clickIdType: p.clickIdType ?? undefined,
      landingPath: p.landingPath ?? undefined,
      device: p.device ?? undefined,
      referrer: p.referrer ?? undefined,
      capturedAt: p.capturedAt,
    };
    const val = toBase64Url(JSON.stringify(compact));
    const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE_NAME}=${val}; Path=/; Max-Age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax${secure}`;
  } catch {
    // ignore
  }
}

function acquisitionFingerprint(p: AcquisitionPayload): string {
  return [
    p.bucket,
    p.channel,
    p.source ?? "",
    p.medium ?? "",
    p.campaign ?? "",
    p.clickId ?? "",
    p.landingPath ?? "",
  ].join("|");
}

/** Capture first real source. Safe to call on every navigation (no-op when unchanged). */
export function captureAcquisitionOnce(): AcquisitionPayload {
  const incoming = classifyAcquisition();
  const stored = readStored()?.payload ?? null;
  const fromCookie = readCookiePayload();
  const existing = pickStrongerAcquisition(stored, fromCookie);
  const next = existing && !isStrongerAcquisition(existing, incoming) ? existing : incoming;
  if (existing && acquisitionFingerprint(existing) === acquisitionFingerprint(next)) {
    return existing;
  }
  writeStored(next);
  syncAcquisitionCookie(next);
  return next;
}

export function getStoredAcquisition(): AcquisitionPayload | null {
  return pickStrongerAcquisition(readStored()?.payload ?? null, readCookiePayload());
}
