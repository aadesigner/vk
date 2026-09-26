import type { CachedVinImage } from "./vinImageCache.js";

/** Resize a cached original for hero/thumbs. Falls back to null if sharp is missing. */
export async function resizeVinImageForDisplay(
  body: Buffer,
  width: number,
): Promise<CachedVinImage | null> {
  if (!body.length || width <= 0) return null;
  try {
    const sharp = (await import("sharp")).default;
    const out = await sharp(body, { failOn: "none" })
      .rotate()
      .resize(width, null, { withoutEnlargement: true })
      .jpeg({ quality: 72, mozjpeg: true, progressive: true })
      .toBuffer();
    if (!out.length) return null;
    return { contentType: "image/jpeg", body: out };
  } catch {
    return null;
  }
}
