/**
 * First-touch acquisition sanitizer for signup / OAuth.
 * Client classifies; server re-whitelists and length-caps before DB insert.
 */

export const ACQUISITION_COOKIE = "vk_acq";

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
  capturedAt?: string | null;
};

export type AcquisitionUserFields = {
  acquisitionBucket: AcquisitionBucket;
  acquisitionChannel: string;
  acquisitionSource?: string;
  acquisitionMedium?: string;
  acquisitionCampaign?: string;
  acquisitionClickId?: string;
  acquisitionReferrer?: string;
  acquisitionCapturedAt?: Date;
};

const BUCKETS = new Set<AcquisitionBucket>([
  "paid_ads",
  "organic_social",
  "google",
  "referral",
  "direct",
  "unknown",
]);

const MAX = {
  channel: 48,
  source: 64,
  medium: 64,
  campaign: 128,
  clickId: 128,
  referrer: 200,
} as const;

function clip(raw: unknown, max: number): string | undefined {
  if (typeof raw !== "string") return undefined;
  const s = raw.trim().slice(0, max);
  if (!s) return undefined;
  // Reject control chars / obvious junk
  if (/[\u0000-\u001f\u007f]/.test(s)) return undefined;
  return s;
}

function parseCapturedAt(raw: unknown): Date | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  // Ignore absurd future / ancient dates
  const now = Date.now();
  if (d.getTime() > now + 86_400_000) return undefined;
  if (d.getTime() < now - 400 * 86_400_000) return undefined;
  return d;
}

export function sanitizeAcquisitionPayload(raw: unknown): AcquisitionPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const bucketRaw = String(o.bucket ?? "").trim().toLowerCase();
  if (!BUCKETS.has(bucketRaw as AcquisitionBucket)) return null;
  const bucket = bucketRaw as AcquisitionBucket;
  const channel = clip(o.channel, MAX.channel)?.toLowerCase() ?? bucket;
  return {
    bucket,
    channel,
    source: clip(o.source, MAX.source)?.toLowerCase() ?? null,
    medium: clip(o.medium, MAX.medium)?.toLowerCase() ?? null,
    campaign: clip(o.campaign, MAX.campaign) ?? null,
    clickId: clip(o.clickId ?? o.click_id, MAX.clickId) ?? null,
    referrer: clip(o.referrer, MAX.referrer)?.toLowerCase() ?? null,
    capturedAt: typeof o.capturedAt === "string" ? o.capturedAt : typeof o.captured_at === "string" ? o.captured_at : null,
  };
}

/** Decode cookie value (base64url JSON or plain JSON). */
export function parseAcquisitionCookieValue(raw: string | undefined): AcquisitionPayload | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    let json = trimmed;
    // base64url
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
  return {
    acquisitionBucket: payload.bucket,
    acquisitionChannel: payload.channel,
    acquisitionSource: payload.source ?? undefined,
    acquisitionMedium: payload.medium ?? undefined,
    acquisitionCampaign: payload.campaign ?? undefined,
    acquisitionClickId: payload.clickId ?? undefined,
    acquisitionReferrer: payload.referrer ?? undefined,
    acquisitionCapturedAt: capturedAt,
  };
}

export function resolveAcquisitionForSignup(
  body: unknown,
  cookieRaw: string | undefined,
): AcquisitionUserFields | null {
  const fromBody =
    body && typeof body === "object" && "acquisition" in (body as object)
      ? sanitizeAcquisitionPayload((body as { acquisition?: unknown }).acquisition)
      : null;
  return acquisitionToUserFields(fromBody ?? parseAcquisitionCookieValue(cookieRaw));
}
