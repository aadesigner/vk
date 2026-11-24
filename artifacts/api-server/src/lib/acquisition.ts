/**
 * First-touch acquisition sanitizer for signup / OAuth.
 * Client classifies; server re-whitelists and length-caps before DB insert.
 */

export const ACQUISITION_COOKIE = "vk_acq";

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
  capturedAt?: string | null;
};

export type AcquisitionUserFields = {
  acquisitionBucket: AcquisitionBucket;
  acquisitionChannel: string;
  acquisitionSource?: string;
  acquisitionMedium?: string;
  acquisitionCampaign?: string;
  acquisitionContent?: string;
  acquisitionTerm?: string;
  acquisitionClickId?: string;
  acquisitionClickIdType?: string;
  acquisitionLandingPath?: string;
  acquisitionDevice?: string;
  acquisitionReferrer?: string;
  acquisitionCapturedAt?: Date;
};

const BUCKETS = new Set<AcquisitionBucket>([
  "paid_ads",
  "organic_social",
  "google",
  "offline",
  "referral",
  "direct",
  "unknown",
]);

const CLICK_ID_TYPES = new Set<AcquisitionClickIdType>([
  "gclid",
  "fbclid",
  "ttclid",
  "msclkid",
  "other",
]);

const DEVICES = new Set<AcquisitionDevice>([
  "mobile",
  "desktop",
  "tablet",
  "in_app",
]);

const MAX = {
  channel: 48,
  source: 64,
  medium: 64,
  campaign: 128,
  content: 128,
  term: 128,
  clickId: 128,
  clickIdType: 16,
  landingPath: 200,
  device: 16,
  referrer: 200,
} as const;

function clip(raw: unknown, max: number): string | undefined {
  if (typeof raw !== "string") return undefined;
  const s = raw.trim().slice(0, max);
  if (!s) return undefined;
  if (/[\u0000-\u001f\u007f]/.test(s)) return undefined;
  return s;
}

function parseCapturedAt(raw: unknown): Date | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  const now = Date.now();
  if (d.getTime() > now + 86_400_000) return undefined;
  if (d.getTime() < now - 400 * 86_400_000) return undefined;
  return d;
}

function inferClickIdType(clickId: string | undefined, explicit: string | undefined): AcquisitionClickIdType | undefined {
  if (explicit && CLICK_ID_TYPES.has(explicit as AcquisitionClickIdType)) {
    return explicit as AcquisitionClickIdType;
  }
  if (!clickId) return undefined;
  return "other";
}

export function sanitizeAcquisitionPayload(raw: unknown): AcquisitionPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const bucketRaw = String(o.bucket ?? "").trim().toLowerCase();
  if (!BUCKETS.has(bucketRaw as AcquisitionBucket)) return null;
  const bucket = bucketRaw as AcquisitionBucket;
  const channel = clip(o.channel, MAX.channel)?.toLowerCase() ?? bucket;
  const clickId = clip(o.clickId ?? o.click_id, MAX.clickId);
  const clickIdTypeRaw = clip(o.clickIdType ?? o.click_id_type, MAX.clickIdType)?.toLowerCase();
  const deviceRaw = clip(o.device, MAX.device)?.toLowerCase();
  return {
    bucket,
    channel,
    source: clip(o.source, MAX.source)?.toLowerCase() ?? null,
    medium: clip(o.medium, MAX.medium)?.toLowerCase() ?? null,
    campaign: clip(o.campaign, MAX.campaign) ?? null,
    content: clip(o.content, MAX.content) ?? null,
    term: clip(o.term, MAX.term) ?? null,
    clickId: clickId ?? null,
    clickIdType: inferClickIdType(clickId, clickIdTypeRaw) ?? null,
    landingPath: clip(o.landingPath ?? o.landing_path, MAX.landingPath) ?? null,
    device: deviceRaw && DEVICES.has(deviceRaw as AcquisitionDevice)
      ? (deviceRaw as AcquisitionDevice)
      : null,
    referrer: clip(o.referrer, MAX.referrer)?.toLowerCase() ?? null,
    capturedAt: typeof o.capturedAt === "string"
      ? o.capturedAt
      : typeof o.captured_at === "string"
        ? o.captured_at
        : null,
  };
}

/** Decode cookie value (base64url JSON or plain JSON). */
export function encodeAcquisitionCookieValue(payload: AcquisitionPayload): string {
  const compact = {
    bucket: payload.bucket,
    channel: payload.channel,
    source: payload.source ?? undefined,
    medium: payload.medium ?? undefined,
    campaign: payload.campaign ?? undefined,
    content: payload.content ?? undefined,
    term: payload.term ?? undefined,
    clickId: payload.clickId ?? undefined,
    clickIdType: payload.clickIdType ?? undefined,
    landingPath: payload.landingPath ?? undefined,
    device: payload.device ?? undefined,
    referrer: payload.referrer ?? undefined,
    capturedAt: payload.capturedAt,
  };
  return Buffer.from(JSON.stringify(compact), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function parseAcquisitionCookieValue(raw: string | undefined): AcquisitionPayload | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    let json = trimmed;
    if (!trimmed.startsWith("{")) {
      const b64 = trimmed.replace(/-/g, "+").replace(/_/g, "/");
      const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
      json = Buffer.from(b64 + pad, "base64").toString("utf8");
    }
    return sanitizeAcquisitionPayload(JSON.parse(json));
  } catch {
    return null;
  }
}

export function acquisitionToUserFields(payload: AcquisitionPayload | null): AcquisitionUserFields | null {
  if (!payload) return null;
  const capturedAt = parseCapturedAt(payload.capturedAt) ?? new Date();
  const fields: AcquisitionUserFields = {
    acquisitionBucket: payload.bucket,
    acquisitionChannel: payload.channel,
    acquisitionCapturedAt: capturedAt,
  };
  // Only set optional columns when present — avoids wiping / sending undefined to drizzle inserts.
  if (payload.source) fields.acquisitionSource = payload.source;
  if (payload.medium) fields.acquisitionMedium = payload.medium;
  if (payload.campaign) fields.acquisitionCampaign = payload.campaign;
  if (payload.content) fields.acquisitionContent = payload.content;
  if (payload.term) fields.acquisitionTerm = payload.term;
  if (payload.clickId) fields.acquisitionClickId = payload.clickId;
  if (payload.clickIdType) fields.acquisitionClickIdType = payload.clickIdType;
  if (payload.landingPath) fields.acquisitionLandingPath = payload.landingPath;
  if (payload.device) fields.acquisitionDevice = payload.device;
  if (payload.referrer) fields.acquisitionReferrer = payload.referrer;
  return fields;
}

/** Drop newer optional columns so signup still works before schema patches land. */
export function withoutExtendedAcquisitionFields(
  fields: AcquisitionUserFields,
): AcquisitionUserFields {
  const {
    acquisitionContent: _c,
    acquisitionTerm: _t,
    acquisitionClickIdType: _ct,
    acquisitionLandingPath: _lp,
    acquisitionDevice: _d,
    ...rest
  } = fields;
  return rest;
}

export function isMissingColumnError(err: unknown): boolean {
  return !!(
    err
    && typeof err === "object"
    && "code" in err
    && (err as { code: string }).code === "42703"
  );
}

export function resolveAcquisitionForSignup(
  body: unknown,
  cookieRaw: string | undefined,
): AcquisitionUserFields | null {
  const fromBody =
    body && typeof body === "object" && "acquisition" in (body as object)
      ? sanitizeAcquisitionPayload((body as { acquisition?: unknown }).acquisition)
      : null;
  const fromCookie = parseAcquisitionCookieValue(cookieRaw);
  const chosen = pickSignupPayload(fromBody, fromCookie);
  return acquisitionToUserFields(chosen);
}

function enrichPayload(
  primary: AcquisitionPayload,
  secondary: AcquisitionPayload | null,
): AcquisitionPayload {
  if (!secondary) return primary;
  return {
    ...primary,
    content: primary.content || secondary.content || null,
    term: primary.term || secondary.term || null,
    landingPath: primary.landingPath || secondary.landingPath || null,
    device: primary.device || secondary.device || null,
    clickIdType: primary.clickIdType || secondary.clickIdType || null,
    clickId: primary.clickId || secondary.clickId || null,
    campaign: primary.campaign || secondary.campaign || null,
    source: primary.source || secondary.source || null,
    medium: primary.medium || secondary.medium || null,
  };
}

function pickSignupPayload(
  fromBody: AcquisitionPayload | null,
  fromCookie: AcquisitionPayload | null,
): AcquisitionPayload | null {
  if (!fromBody) return fromCookie;
  if (!fromCookie) return fromBody;
  const bodyWeak = fromBody.bucket === "direct" || fromBody.bucket === "unknown";
  const cookieWeak = fromCookie.bucket === "direct" || fromCookie.bucket === "unknown";
  if (bodyWeak && !cookieWeak) return enrichPayload(fromCookie, fromBody);
  if (fromCookie.channel === "instagram_social" && fromBody.channel === "facebook_social") {
    return enrichPayload(fromCookie, fromBody);
  }
  if (fromCookie.channel === "messenger" && fromBody.channel === "facebook_social") {
    return enrichPayload(fromCookie, fromBody);
  }
  return enrichPayload(fromBody, fromCookie);
}
