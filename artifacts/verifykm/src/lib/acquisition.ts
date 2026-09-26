/**
 * First-touch marketing acquisition (client).
 * Captures UTM / click ids / referrer once into localStorage (90d) and a short cookie for OAuth.
 */

export type AcquisitionBucket =
  | "paid_ads"
  | "organic_social"
  | "google"
  | "referral"
  | "direct"
  | "unknown";

export type AcquisitionPayload = {
  bucket: AcquisitionBucket;
  channel: string;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  clickId?: string | null;
  referrer?: string | null;
  capturedAt: string;
};

const STORAGE_KEY = "verifykm_acquisition_v1";
const COOKIE_NAME = "vk_acq";
const TTL_MS = 90 * 24 * 60 * 60 * 1000;
const COOKIE_MAX_AGE_SEC = 10 * 60;

const PAID_MEDIUMS = new Set([
  "cpc",
  "ppc",
  "paid",
  "paidsocial",
  "paid_social",
  "paid-social",
  "display",
  "retargeting",
  "remarketing",
]);

type Stored = { payload: AcquisitionPayload; expiresAt: number };

function hostOnly(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return u.hostname.replace(/^www\./i, "").toLowerCase().slice(0, 200) || null;
  } catch {
    return null;
  }
}

function param(sp: URLSearchParams, key: string): string | null {
  const v = sp.get(key)?.trim();
  return v ? v.slice(0, 128) : null;
}

function isPaidMedium(medium: string | null): boolean {
  if (!medium) return false;
  return PAID_MEDIUMS.has(medium.toLowerCase());
}

function socialKind(host: string | null): "instagram" | "facebook" | "tiktok" | "x" | "linkedin" | null {
  if (!host) return null;
  if (/(^|\.)instagram\.com$/i.test(host) || host === "l.instagram.com") return "instagram";
  if (/(^|\.)(facebook|fb|fb\.me)\.com$/i.test(host) || host.endsWith(".facebook.com")) return "facebook";
  if (/(^|\.)tiktok\.com$/i.test(host)) return "tiktok";
  if (/(^|\.)(twitter|x)\.com$/i.test(host) || host === "t.co") return "x";
  if (/(^|\.)(linkedin|lnkd\.in)/i.test(host)) return "linkedin";
  return null;
}

function isGoogleHost(host: string | null): boolean {
  if (!host) return false;
  return /(^|\.)google\./i.test(host) || host === "google.com" || host.endsWith(".googleusercontent.com");
}

function isSelfHost(referrerHost: string | null): boolean {
  if (!referrerHost || typeof window === "undefined") return false;
  const self = window.location.hostname.replace(/^www\./i, "").toLowerCase();
  return referrerHost === self || referrerHost.endsWith(`.${self}`);
}

function sourceBrand(source: string | null): string | null {
  if (!source) return null;
  const s = source.toLowerCase();
  if (/^(meta|facebook|fb)$/.test(s)) return "meta";
  if (/^(ig|instagram)$/.test(s)) return "instagram";
  if (/^tiktok$/.test(s)) return "tiktok";
  if (/^(google|adwords|adsense)$/.test(s)) return "google";
  if (/^(twitter|x)$/.test(s)) return "x";
  if (/^linkedin$/.test(s)) return "linkedin";
  return null;
}

/** Classify current landing URL + document.referrer. */
export function classifyAcquisition(
  href: string = typeof window !== "undefined" ? window.location.href : "",
  referrerUrl: string = typeof document !== "undefined" ? document.referrer : "",
): AcquisitionPayload {
  let sp: URLSearchParams;
  try {
    sp = new URL(href).searchParams;
  } catch {
    sp = new URLSearchParams();
  }

  const source = param(sp, "utm_source");
  const medium = param(sp, "utm_medium");
  const campaign = param(sp, "utm_campaign");
  const fbclid = param(sp, "fbclid");
  const gclid = param(sp, "gclid");
  const ttclid = param(sp, "ttclid");
  const msclkid = param(sp, "msclkid");
  const igShare = param(sp, "igshid") ?? param(sp, "igsh");
  const referrer = hostOnly(referrerUrl);
  const extReferrer = isSelfHost(referrer) ? null : referrer;
  const brand = sourceBrand(source);
  const social = socialKind(extReferrer);
  const capturedAt = new Date().toISOString();
  const metaClickId = fbclid;

  const base = {
    source,
    medium,
    campaign,
    referrer: extReferrer,
    capturedAt,
  };

  // Ad-specific click ids only. fbclid is NOT ad-specific — Instagram and
  // Facebook append it to bio, story, post, and DM links as well as ads.
  if (gclid) {
    return { ...base, bucket: "paid_ads", channel: "google_ads", clickId: gclid };
  }
  if (ttclid) {
    return { ...base, bucket: "paid_ads", channel: "tiktok_ads", clickId: ttclid };
  }
  if (msclkid) {
    return { ...base, bucket: "paid_ads", channel: "bing_ads", clickId: msclkid };
  }

  // Paid UTMs — required to count Meta / Instagram as ads
  if (isPaidMedium(medium) || medium?.toLowerCase() === "paid_social") {
    let channel = "paid_ads";
    if (brand === "meta" || brand === "facebook") channel = "meta_ads";
    else if (brand === "instagram") channel = "instagram_ads";
    else if (brand === "tiktok") channel = "tiktok_ads";
    else if (brand === "google") channel = "google_ads";
    else if (brand === "x") channel = "x_ads";
    else if (brand === "linkedin") channel = "linkedin_ads";
    else if (source) channel = `${source.slice(0, 24)}_ads`;
    return { ...base, bucket: "paid_ads", channel, clickId: metaClickId };
  }

  // Organic social referrer (Instagram in-app often still sends l.instagram.com)
  if (social) {
    const channel =
      social === "instagram" ? "instagram_social"
        : social === "facebook" ? "facebook_social"
          : social === "tiktok" ? "tiktok_social"
            : social === "x" ? "x_social"
              : "linkedin_social";
    return { ...base, bucket: "organic_social", channel, clickId: metaClickId };
  }

  // Instagram share links (in-app browser often strips the referrer)
  if (igShare || brand === "instagram") {
    return { ...base, bucket: "organic_social", channel: "instagram_social", clickId: metaClickId };
  }

  // Bare fbclid = Meta organic click, not an ad
  if (fbclid) {
    const channel = brand === "meta" || brand === "facebook" ? "facebook_social" : "meta_social";
    return { ...base, bucket: "organic_social", channel, clickId: fbclid };
  }

  // Google organic (referrer or utm without paid)
  if (isGoogleHost(extReferrer) || brand === "google") {
    return { ...base, bucket: "google", channel: "google_organic", clickId: null };
  }

  // Other UTM source without paid → referral-ish tagged traffic
  if (source) {
    return {
      ...base,
      bucket: "referral",
      channel: source.slice(0, 40).toLowerCase(),
      clickId: null,
    };
  }

  // External website
  if (extReferrer) {
    return {
      ...base,
      bucket: "referral",
      channel: "referral",
      clickId: null,
    };
  }

  // Typed URL / bookmark / Chrome link / stripped referrer
  return {
    ...base,
    bucket: "direct",
    channel: "direct",
    clickId: null,
  };
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

/** Write short-lived cookie so OAuth callback can read first-touch (SameSite=Lax). */
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
      clickId: p.clickId ?? undefined,
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

/** Capture first-touch once (idempotent). Safe to call on every app load. */
export function captureAcquisitionOnce(): AcquisitionPayload {
  const existing = readStored();
  if (existing) {
    syncAcquisitionCookie(existing.payload);
    return existing.payload;
  }
  const payload = classifyAcquisition();
  writeStored(payload);
  syncAcquisitionCookie(payload);
  return payload;
}

export function getStoredAcquisition(): AcquisitionPayload | null {
  return readStored()?.payload ?? null;
}
