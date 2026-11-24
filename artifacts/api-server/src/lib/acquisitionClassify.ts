/**
 * Pure first-touch classification. Used by the HTML cookie stamp and the browser.
 * fbclid is not treated as a paid click — Meta adds it to organic links too.
 */

export type AcquisitionBucket =
  | "paid_ads"
  | "organic_social"
  | "google"
  | "offline"
  | "referral"
  | "direct"
  | "unknown";

export type AcquisitionClickIdType = "gclid" | "fbclid" | "ttclid" | "msclkid" | "other";

export type AcquisitionDevice = "mobile" | "desktop" | "tablet" | "in_app";

export type AcquisitionPayload = {
  bucket: AcquisitionBucket;
  channel: string;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  content?: string | null;
  term?: string | null;
  clickId?: string | null;
  clickIdType?: AcquisitionClickIdType | null;
  landingPath?: string | null;
  device?: AcquisitionDevice | null;
  referrer?: string | null;
  capturedAt: string;
};

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

/** QR / print / local campaigns (e.g. ?utm_source=van&utm_medium=qr). */
const OFFLINE_MEDIUMS = new Set([
  "qr",
  "qrcode",
  "qr_code",
  "qr-code",
  "offline",
  "print",
  "flyer",
  "poster",
  "event",
  "local",
  "ooh",
  "outdoor",
]);

/** Known offline campaign sources even without utm_medium (QR stickers, vans, etc.). */
const OFFLINE_SOURCES = new Set([
  "van",
  "qr",
  "qrcode",
  "flyer",
  "poster",
  "event",
  "offline",
  "print",
]);

const BUCKET_RANK: Record<AcquisitionBucket, number> = {
  paid_ads: 60,
  google: 50,
  organic_social: 40,
  offline: 35,
  referral: 25,
  direct: 10,
  unknown: 0,
};

type SocialKind =
  | "instagram"
  | "facebook"
  | "messenger"
  | "tiktok"
  | "x"
  | "linkedin"
  | "whatsapp"
  | "youtube"
  | "pinterest"
  | "reddit"
  | "snapchat";

function hostOnly(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return u.hostname.replace(/^www\./i, "").toLowerCase().slice(0, 200) || null;
  } catch {
    return null;
  }
}

function param(sp: URLSearchParams, key: string, max = 128): string | null {
  const v = sp.get(key)?.trim();
  return v ? v.slice(0, max) : null;
}

function landingPathFromUrl(href: string): string | null {
  try {
    const u = new URL(href);
    const path = (u.pathname || "/").replace(/\/{2,}/g, "/").slice(0, 160);
    // Keep only safe marketing query keys (no tokens/emails).
    const keep = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id"];
    const q = new URLSearchParams();
    for (const k of keep) {
      const v = u.searchParams.get(k)?.trim();
      if (v) q.set(k, v.slice(0, 64));
    }
    const qs = q.toString();
    const full = qs ? `${path}?${qs}` : path;
    return full.slice(0, 200) || null;
  } catch {
    return null;
  }
}

function detectDevice(userAgent: string): AcquisitionDevice {
  if (!userAgent) return "desktop";
  if (/Instagram|FBAN|FBAV|FB_IAB|Messenger|TikTok|Twitter|LinkedInApp|WhatsApp/i.test(userAgent)) {
    return "in_app";
  }
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent)) return "tablet";
  if (/Mobi|Android|iPhone|iPod|webOS|BlackBerry|IEMobile/i.test(userAgent)) return "mobile";
  return "desktop";
}

function isPaidMedium(medium: string | null): boolean {
  if (!medium) return false;
  return PAID_MEDIUMS.has(medium.toLowerCase());
}

function isOfflineMedium(medium: string | null): boolean {
  if (!medium) return false;
  const m = medium.toLowerCase();
  return OFFLINE_MEDIUMS.has(m) || m.startsWith("qr");
}

function isOfflineSource(source: string | null): boolean {
  if (!source) return false;
  const s = source.toLowerCase();
  return OFFLINE_SOURCES.has(s) || s.startsWith("qr_") || s.startsWith("qr-");
}

/** Stable offline channel id: qr_van, offline_flyer, qr, … */
function offlineChannel(source: string | null, medium: string | null): string {
  const s = (source ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 28);
  const m = (medium ?? "").toLowerCase();
  const qrish = !m || m.startsWith("qr") || m === "qrcode" || m === "qr_code" || m === "qr-code";
  if (s) return `${qrish ? "qr" : "offline"}_${s}`.slice(0, 40);
  return qrish ? "qr" : "offline";
}

function hasUtmSignal(p: Pick<AcquisitionPayload, "source" | "medium" | "campaign" | "content" | "term" | "clickId">): boolean {
  return Boolean(p.source || p.medium || p.campaign || p.content || p.term || p.clickId);
}

function socialKind(host: string | null): SocialKind | null {
  if (!host) return null;
  if (
    /(^|\.)instagram\.com$/i.test(host)
    || host === "ig.me"
    || /(^|\.)threads\.net$/i.test(host)
    || /(^|\.)threads\.com$/i.test(host)
  ) {
    return "instagram";
  }
  if (
    /(^|\.)messenger\.com$/i.test(host)
    || host === "m.me"
    || host === "l.messenger.com"
  ) {
    return "messenger";
  }
  if (
    /(^|\.)facebook\.com$/i.test(host)
    || /(^|\.)fb\.com$/i.test(host)
    || host === "fb.me"
    || host.endsWith(".fb.me")
  ) {
    return "facebook";
  }
  if (/(^|\.)tiktok\.com$/i.test(host)) return "tiktok";
  if (/(^|\.)(twitter|x)\.com$/i.test(host) || host === "t.co") return "x";
  if (/(^|\.)linkedin\.com$/i.test(host) || host === "lnkd.in" || host.endsWith(".lnkd.in")) return "linkedin";
  if (/(^|\.)whatsapp\.com$/i.test(host) || host === "wa.me") return "whatsapp";
  if (/(^|\.)youtube\.com$/i.test(host) || host === "youtu.be") return "youtube";
  if (/(^|\.)pinterest\.com$/i.test(host) || host === "pin.it") return "pinterest";
  if (/(^|\.)reddit\.com$/i.test(host)) return "reddit";
  if (/(^|\.)snapchat\.com$/i.test(host)) return "snapchat";
  return null;
}

function inAppSocial(userAgent: string): SocialKind | null {
  if (!userAgent) return null;
  if (/Instagram|Threads/i.test(userAgent)) return "instagram";
  if (/FBAN|FBAV|FB_IAB|FB4A|FBIOS/i.test(userAgent)) return "facebook";
  if (/Messenger/i.test(userAgent)) return "messenger";
  if (/TikTok/i.test(userAgent)) return "tiktok";
  if (/\bTwitter/i.test(userAgent)) return "x";
  if (/LinkedIn/i.test(userAgent)) return "linkedin";
  if (/WhatsApp/i.test(userAgent)) return "whatsapp";
  return null;
}

function organicChannel(kind: SocialKind): string {
  switch (kind) {
    case "instagram": return "instagram_social";
    case "facebook": return "facebook_social";
    case "messenger": return "messenger";
    case "tiktok": return "tiktok_social";
    case "x": return "x_social";
    case "linkedin": return "linkedin_social";
    case "whatsapp": return "whatsapp_social";
    case "youtube": return "youtube_social";
    case "pinterest": return "pinterest_social";
    case "reddit": return "reddit_social";
    case "snapchat": return "snapchat_social";
  }
}

function paidChannel(kind: SocialKind | "meta" | "google" | string | null, source: string | null): string {
  if (kind === "instagram") return "instagram_ads";
  if (kind === "facebook" || kind === "meta" || kind === "messenger") return "meta_ads";
  if (kind === "tiktok") return "tiktok_ads";
  if (kind === "x") return "x_ads";
  if (kind === "linkedin") return "linkedin_ads";
  if (kind === "google") return "google_ads";
  if (source) return `${source.slice(0, 24)}_ads`;
  return "paid_ads";
}

function isGoogleHost(host: string | null): boolean {
  if (!host) return false;
  return /(^|\.)google\./i.test(host) || host === "google.com" || host.endsWith(".googleusercontent.com");
}

function isSelfHost(referrerHost: string | null, selfHost: string | null | undefined): boolean {
  if (!referrerHost || !selfHost) return false;
  const self = selfHost.replace(/^www\./i, "").toLowerCase();
  return referrerHost === self || referrerHost.endsWith(`.${self}`);
}

function sourceBrand(source: string | null): SocialKind | "meta" | "google" | null {
  if (!source) return null;
  const s = source.toLowerCase();
  if (/^(ig|instagram|insta|threads)$/.test(s)) return "instagram";
  if (/^(messenger|msg)$/.test(s)) return "messenger";
  if (/^(meta|facebook|fb)$/.test(s)) return "meta";
  if (/^tiktok$/.test(s)) return "tiktok";
  if (/^(google|adwords|adsense)$/.test(s)) return "google";
  if (/^(twitter|x)$/.test(s)) return "x";
  if (/^linkedin$/.test(s)) return "linkedin";
  if (/^(whatsapp|wa)$/.test(s)) return "whatsapp";
  if (/^(youtube|yt)$/.test(s)) return "youtube";
  if (/^pinterest$/.test(s)) return "pinterest";
  if (/^reddit$/.test(s)) return "reddit";
  if (/^snapchat$/.test(s)) return "snapchat";
  return null;
}

function brandToSocial(brand: SocialKind | "meta" | "google" | null): SocialKind | null {
  if (!brand || brand === "google") return null;
  if (brand === "meta") return "facebook";
  return brand;
}

export function classifyAcquisition(
  href: string,
  referrerUrl = "",
  userAgent = "",
  selfHost?: string | null,
): AcquisitionPayload {
  let pageHost = selfHost ? selfHost.replace(/^www\./i, "").toLowerCase() : null;
  let sp: URLSearchParams;
  try {
    const u = new URL(href);
    sp = u.searchParams;
    pageHost = pageHost ?? u.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    sp = new URLSearchParams();
  }

  const source = param(sp, "utm_source");
  const medium = param(sp, "utm_medium");
  const campaign = param(sp, "utm_campaign");
  const content = param(sp, "utm_content", 128);
  const term = param(sp, "utm_term", 128);
  const fbclid = param(sp, "fbclid");
  const gclid = param(sp, "gclid");
  const ttclid = param(sp, "ttclid");
  const msclkid = param(sp, "msclkid");
  const referrer = hostOnly(referrerUrl);
  const extReferrer = isSelfHost(referrer, pageHost) ? null : referrer;
  const brand = sourceBrand(source);
  const social = socialKind(extReferrer) ?? inAppSocial(userAgent);
  const capturedAt = new Date().toISOString();
  const landingPath = landingPathFromUrl(href);
  const device = detectDevice(userAgent);

  const base = {
    source,
    medium,
    campaign,
    content,
    term,
    landingPath,
    device,
    referrer: extReferrer,
    capturedAt,
  };

  if (gclid) {
    return {
      ...base,
      bucket: "paid_ads",
      channel: "google_ads",
      clickId: gclid,
      clickIdType: "gclid",
    };
  }
  if (ttclid) {
    return {
      ...base,
      bucket: "paid_ads",
      channel: "tiktok_ads",
      clickId: ttclid,
      clickIdType: "ttclid",
    };
  }
  if (msclkid) {
    return {
      ...base,
      bucket: "paid_ads",
      channel: "bing_ads",
      clickId: msclkid,
      clickIdType: "msclkid",
    };
  }

  if (isPaidMedium(medium) || medium?.toLowerCase() === "paid_social") {
    const kind = brandToSocial(brand) ?? social;
    return {
      ...base,
      bucket: "paid_ads",
      channel: paidChannel(kind ?? brand, source),
      clickId: fbclid,
      clickIdType: fbclid ? "fbclid" : null,
    };
  }

  // QR / print / local campaigns before generic social/referral so van+qr stays visible.
  if (isOfflineMedium(medium) || isOfflineSource(source)) {
    return {
      ...base,
      bucket: "offline",
      channel: offlineChannel(source, medium),
      clickId: fbclid,
      clickIdType: fbclid ? "fbclid" : null,
    };
  }

  if (social) {
    return {
      ...base,
      bucket: "organic_social",
      channel: organicChannel(social),
      clickId: fbclid,
      clickIdType: fbclid ? "fbclid" : null,
    };
  }

  const tagged = brandToSocial(brand);
  if (tagged) {
    return {
      ...base,
      bucket: "organic_social",
      channel: organicChannel(tagged),
      clickId: fbclid,
      clickIdType: fbclid ? "fbclid" : null,
    };
  }

  if (fbclid) {
    return {
      ...base,
      bucket: "organic_social",
      channel: "facebook_social",
      clickId: fbclid,
      clickIdType: "fbclid",
    };
  }

  if (isGoogleHost(extReferrer) || brand === "google") {
    return { ...base, bucket: "google", channel: "google_organic", clickId: null, clickIdType: null };
  }

  if (source) {
    return {
      ...base,
      bucket: "referral",
      channel: source.slice(0, 40).toLowerCase(),
      clickId: null,
      clickIdType: null,
    };
  }

  if (extReferrer) {
    return {
      ...base,
      bucket: "referral",
      channel: "referral",
      clickId: null,
      clickIdType: null,
    };
  }

  return {
    ...base,
    bucket: "direct",
    channel: "direct",
    clickId: null,
    clickIdType: null,
  };
}

function acquisitionStrength(p: AcquisitionPayload): number {
  let score = BUCKET_RANK[p.bucket] ?? 0;
  if (hasUtmSignal(p)) score += 8;
  if (p.clickId) score += 6;
  if (p.campaign) score += 2;
  if (p.landingPath && p.landingPath.includes("utm_")) score += 1;
  // Prefer specific social over generic facebook when Meta wraps Insta/Messenger.
  if (p.channel === "instagram_social" || p.channel === "messenger") score += 1;
  return score;
}

/**
 * First-touch lock: keep the first meaningful source.
 * Only upgrade from weak (direct/unknown), refine Meta family, or replace
 * bare untagged referral with a tagged campaign (QR / UTM).
 */
export function isStrongerAcquisition(
  existing: AcquisitionPayload,
  incoming: AcquisitionPayload,
): boolean {
  if (existing.channel === "facebook_social" && incoming.channel === "instagram_social") return true;
  if (existing.channel === "facebook_social" && incoming.channel === "messenger") return true;

  const existingWeak = existing.bucket === "direct" || existing.bucket === "unknown";
  if (existingWeak) {
    return acquisitionStrength(incoming) > acquisitionStrength(existing);
  }

  // Untagged referrer → QR/offline or other UTM campaign on a later pageview.
  if (
    existing.bucket === "referral"
    && !hasUtmSignal(existing)
    && hasUtmSignal(incoming)
    && acquisitionStrength(incoming) > acquisitionStrength(existing)
  ) {
    return true;
  }

  return false;
}

export function pickStrongerAcquisition(
  a: AcquisitionPayload | null,
  b: AcquisitionPayload | null,
): AcquisitionPayload | null {
  if (!a) return b;
  if (!b) return a;
  return isStrongerAcquisition(a, b) ? b : a;
}
