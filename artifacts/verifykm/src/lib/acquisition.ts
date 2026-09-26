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

type SocialBrand =
  | "instagram"
  | "threads"
  | "facebook"
  | "messenger"
  | "tiktok"
  | "x"
  | "linkedin"
  | "youtube"
  | "whatsapp"
  | "telegram"
  | "reddit"
  | "pinterest"
  | "snapchat";

type TrafficBrand = SocialBrand | "google";

const SOCIAL_ORGANIC_CHANNEL: Record<SocialBrand, string> = {
  instagram: "instagram_social",
  threads: "threads_social",
  facebook: "facebook_social",
  messenger: "messenger_social",
  tiktok: "tiktok_social",
  x: "x_social",
  linkedin: "linkedin_social",
  youtube: "youtube_social",
  whatsapp: "whatsapp_social",
  telegram: "telegram_social",
  reddit: "reddit_social",
  pinterest: "pinterest_social",
  snapchat: "snapchat_social",
};

type Stored = { payload: AcquisitionPayload; expiresAt: number };

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

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

function socialKind(host: string | null): SocialBrand | null {
  if (!host) return null;
  if (hostMatches(host, "instagram.com")) return "instagram";
  if (hostMatches(host, "threads.net")) return "threads";
  if (hostMatches(host, "facebook.com") || hostMatches(host, "fb.com") || host === "fb.me") return "facebook";
  if (hostMatches(host, "messenger.com")) return "messenger";
  if (hostMatches(host, "tiktok.com")) return "tiktok";
  if (hostMatches(host, "twitter.com") || hostMatches(host, "x.com") || host === "t.co") return "x";
  if (hostMatches(host, "linkedin.com") || host === "lnkd.in") return "linkedin";
  if (hostMatches(host, "youtube.com") || host === "youtu.be" || hostMatches(host, "youtube-nocookie.com")) return "youtube";
  if (hostMatches(host, "whatsapp.com") || host === "wa.me") return "whatsapp";
  if (host === "t.me" || host === "telegram.me" || hostMatches(host, "telegram.org")) return "telegram";
  if (hostMatches(host, "reddit.com") || host === "redd.it") return "reddit";
  if (hostMatches(host, "pinterest.com") || host === "pin.it") return "pinterest";
  if (hostMatches(host, "snapchat.com")) return "snapchat";
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

function sourceBrand(source: string | null): TrafficBrand | null {
  if (!source) return null;
  const s = source.toLowerCase();
  if (/^(meta|facebook|fb)$/.test(s)) return "facebook";
  if (/^(ig|instagram|insta)$/.test(s)) return "instagram";
  if (/^threads$/.test(s)) return "threads";
  if (/^(tiktok|tt)$/.test(s)) return "tiktok";
  if (/^(google|adwords|adsense)$/.test(s)) return "google";
  if (/^(twitter|x)$/.test(s)) return "x";
  if (/^(linkedin|li)$/.test(s)) return "linkedin";
  if (/^(youtube|yt)$/.test(s)) return "youtube";
  if (/^(whatsapp|wa)$/.test(s)) return "whatsapp";
  if (/^(telegram|tg)$/.test(s)) return "telegram";
  if (/^reddit$/.test(s)) return "reddit";
  if (/^(pinterest|pin)$/.test(s)) return "pinterest";
  if (/^(snapchat|snap)$/.test(s)) return "snapchat";
  if (/^(messenger|msg)$/.test(s)) return "messenger";
  return null;
}

function paidChannelForBrand(brand: TrafficBrand | null, source: string | null): string {
  if (brand === "facebook" || brand === "messenger") return "meta_ads";
  if (brand === "instagram" || brand === "threads") return "instagram_ads";
  if (brand === "tiktok") return "tiktok_ads";
  if (brand === "google") return "google_ads";
  if (brand === "x") return "x_ads";
  if (brand === "linkedin") return "linkedin_ads";
  if (brand === "youtube") return "youtube_ads";
  if (brand === "whatsapp") return "whatsapp_ads";
  if (brand === "telegram") return "telegram_ads";
  if (brand === "reddit") return "reddit_ads";
  if (brand === "pinterest") return "pinterest_ads";
  if (brand === "snapchat") return "snapchat_ads";
  if (source) return `${source.slice(0, 24)}_ads`;
  return "paid_ads";
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
  const gclid = param(sp, "gclid") ?? param(sp, "gbraid") ?? param(sp, "wbraid");
  const ttclid = param(sp, "ttclid");
  const msclkid = param(sp, "msclkid");
  const twclid = param(sp, "twclid");
  const liFatId = param(sp, "li_fat_id");
  const igShare = param(sp, "igshid") ?? param(sp, "igsh");
  const referrer = hostOnly(referrerUrl);
  const extReferrer = isSelfHost(referrer) ? null : referrer;
  const brand = sourceBrand(source);
  const social = socialKind(extReferrer);
  const capturedAt = new Date().toISOString();
  const clickId = fbclid ?? gclid ?? ttclid ?? msclkid ?? twclid ?? liFatId;

  const base = {
    source,
    medium,
    campaign,
    referrer: extReferrer,
    capturedAt,
  };

  // Ad-only click ids. fbclid is excluded — Instagram/Facebook add it to organic links too.
  if (gclid) {
    return { ...base, bucket: "paid_ads", channel: "google_ads", clickId: gclid };
  }
  if (ttclid) {
    return { ...base, bucket: "paid_ads", channel: "tiktok_ads", clickId: ttclid };
  }
  if (msclkid) {
    return { ...base, bucket: "paid_ads", channel: "bing_ads", clickId: msclkid };
  }
  if (twclid) {
    return { ...base, bucket: "paid_ads", channel: "x_ads", clickId: twclid };
  }
  if (liFatId) {
    return { ...base, bucket: "paid_ads", channel: "linkedin_ads", clickId: liFatId };
  }

  // Paid UTMs — required to count Meta / Instagram as ads
  if (isPaidMedium(medium) || medium?.toLowerCase() === "paid_social") {
    return {
      ...base,
      bucket: "paid_ads",
      channel: paidChannelForBrand(brand, source),
      clickId,
    };
  }

  // Organic social referrer (Instagram in-app often still sends l.instagram.com)
  if (social) {
    return { ...base, bucket: "organic_social", channel: SOCIAL_ORGANIC_CHANNEL[social], clickId };
  }

  // Instagram share links (in-app browser often strips the referrer)
  if (igShare) {
    return { ...base, bucket: "organic_social", channel: "instagram_social", clickId };
  }

  // Unpaid social UTMs (utm_source=tiktok, facebook, x, … without a paid medium)
  if (brand && brand !== "google") {
    return { ...base, bucket: "organic_social", channel: SOCIAL_ORGANIC_CHANNEL[brand], clickId };
  }

  // Bare fbclid = Meta organic click, not an ad
  if (fbclid) {
    return { ...base, bucket: "organic_social", channel: "meta_social", clickId: fbclid };
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
