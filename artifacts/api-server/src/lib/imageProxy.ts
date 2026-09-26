import crypto from "crypto";
import { isAllowedImageHost } from "./imageHostAllowlist.js";

function deriveKey(): Buffer {
  const secret = process.env.JWT_SECRET ?? "dev-insecure-secret-change-in-production";
  return crypto.createHash("sha256").update(secret).digest();
}

/** Stable IV per URL so proxy URLs stay cacheable across API responses. */
function ivForUrl(url: string): Buffer {
  return crypto.createHash("sha256").update(`vin-img:${url}`).digest().subarray(0, 12);
}

/** Tokens valid through end of tomorrow UTC — stable within a calendar day per upstream URL. */
function tokenExpirySec(): number {
  const now = Math.floor(Date.now() / 1000);
  const dayStart = Math.floor(now / 86400) * 86400;
  return dayStart + 86400 * 2;
}

export function signImageToken(url: string): string {
  const key = deriveKey();
  const iv = ivForUrl(url);
  const plaintext = JSON.stringify({
    url,
    exp: tokenExpirySec(),
  });
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64url"),
    encrypted.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

export function verifyImageToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const key = deriveKey();
    const iv = Buffer.from(parts[0], "base64url");
    const encrypted = Buffer.from(parts[1], "base64url");
    const tag = Buffer.from(parts[2], "base64url");
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plaintext = decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
    const { url, exp } = JSON.parse(plaintext) as { url?: string; exp?: number };
    if (!url || typeof url !== "string") return null;
    if (typeof exp === "number" && exp < Math.floor(Date.now() / 1000)) return null;
    return url;
  } catch {
    return null;
  }
}

/** Card / hero display width — enough for 2–3× retina, not full provider originals. */
export const VIN_IMAGE_CARD_WIDTH = 960;
export const VIN_IMAGE_DISPLAY_WIDTHS = [480, 720, 960, 1280] as const;

export function parseVinImageWidth(raw: unknown): number | null {
  const n = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : Number.NaN;
  return (VIN_IMAGE_DISPLAY_WIDTHS as readonly number[]).includes(n) ? n : null;
}

/** Append ?w= to a proxied VIN image URL (idempotent). */
export function withVinImageDisplayWidth(url: string, width = VIN_IMAGE_CARD_WIDTH): string {
  if (!url.includes("/api/vin/image")) return url;
  if (/[?&]w=\d+/.test(url)) return url;
  const parsed = parseVinImageWidth(width);
  if (!parsed) return url;
  return `${url}${url.includes("?") ? "&" : "?"}w=${parsed}`;
}

export function buildImageProxyUrl(
  upstreamUrl: string,
  opts?: { baseApiUrl?: string; mediaVersion?: number; width?: number },
): string {
  const base = (opts?.baseApiUrl ?? "").replace(/\/$/, "");
  const token = encodeURIComponent(signImageToken(upstreamUrl));
  let url = `${base}/api/vin/image?token=${token}`;
  if (opts?.mediaVersion != null && Number.isFinite(opts.mediaVersion)) {
    url += `&v=${opts.mediaVersion}`;
  }
  const width = parseVinImageWidth(opts?.width);
  if (width) url += `&w=${width}`;
  return url;
}

/** Proxy known CDNs; pass through admin-pasted URLs so reports can use any public HTTPS image. */
export function resolveVinPhotoUrlForClient(
  upstreamUrl: string,
  opts?: { baseApiUrl?: string; mediaVersion?: number; width?: number },
): string {
  if (upstreamUrl.startsWith("/api/vin/image")) {
    return opts?.width ? withVinImageDisplayWidth(upstreamUrl, opts.width) : upstreamUrl;
  }
  try {
    const parsed = new URL(upstreamUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return upstreamUrl;
    if (isAllowedImageHost(parsed.hostname)) {
      return buildImageProxyUrl(upstreamUrl, opts);
    }
  } catch {
    return upstreamUrl;
  }
  return upstreamUrl;
}

export function proxyPhotos(
  photos: unknown,
  baseApiUrl: string,
  mediaVersion?: number,
): string[] {
  if (!Array.isArray(photos)) return [];
  return (photos as unknown[]).flatMap((p) => {
    if (typeof p !== "string" || !p) return [];
    return [resolveVinPhotoUrlForClient(p, { baseApiUrl, mediaVersion })];
  });
}

export function transformVinPhotoData(
  data: unknown,
  mediaVersion?: number,
): unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const record = data as Record<string, unknown>;
  const result: Record<string, unknown> = { ...record };
  if (Array.isArray(record.photos)) {
    result.photos = (record.photos as unknown[])
      .filter((p): p is string => typeof p === "string" && p.length > 0)
      .map((p) => resolveVinPhotoUrlForClient(p, { mediaVersion, width: VIN_IMAGE_CARD_WIDTH }));
  }
  if (Array.isArray(record.photosHd)) {
    result.photosHd = (record.photosHd as unknown[])
      .filter((p): p is string => typeof p === "string" && p.length > 0)
      .map((p) => resolveVinPhotoUrlForClient(p, { mediaVersion }));
  }
  if (Array.isArray(record.photos360Exterior)) {
    result.photos360Exterior = (record.photos360Exterior as unknown[])
      .filter((p): p is string => typeof p === "string" && p.length > 0)
      .map((p) => resolveVinPhotoUrlForClient(p, { mediaVersion }));
  }
  if (Array.isArray(record.photos360Interior)) {
    result.photos360Interior = (record.photos360Interior as unknown[])
      .filter((p): p is string => typeof p === "string" && p.length > 0)
      .map((p) => resolveVinPhotoUrlForClient(p, { mediaVersion }));
  }
  if (typeof record.thumbnailUrl === "string" && record.thumbnailUrl) {
    result.thumbnailUrl = resolveVinPhotoUrlForClient(record.thumbnailUrl, {
      mediaVersion,
      width: VIN_IMAGE_CARD_WIDTH,
    });
  }
  if (Array.isArray(record.photoAlternates)) {
    result.photoAlternates = (record.photoAlternates as unknown[]).map((p) => {
      if (typeof p !== "string" || !p) return null;
      return resolveVinPhotoUrlForClient(p, { mediaVersion, width: VIN_IMAGE_CARD_WIDTH });
    });
  }
  return result;
}
