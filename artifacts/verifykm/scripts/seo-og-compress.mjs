/**
 * Shared WebP compression for OG preview images (1200×630).
 */
import sharp from "sharp";
import {
  SEO_OG_WIDTH,
  SEO_OG_HEIGHT,
  SEO_OG_WEBP_QUALITY,
  SEO_OG_WEBP_EFFORT,
} from "./seo-og-config.mjs";

export async function compressOgWebp(input, destPath) {
  let pipeline = sharp(input);
  const meta = await pipeline.metadata();
  if (meta.width !== SEO_OG_WIDTH || meta.height !== SEO_OG_HEIGHT) {
    pipeline = sharp(input).resize(SEO_OG_WIDTH, SEO_OG_HEIGHT, { fit: "cover", position: "top" });
  }
  await pipeline
    .webp({
      quality: SEO_OG_WEBP_QUALITY,
      effort: SEO_OG_WEBP_EFFORT,
      smartSubsample: true,
    })
    .toFile(destPath);
}

/** In-memory recompress (for optimize pass without temp files). */
export async function compressOgWebpBuffer(input) {
  let pipeline = sharp(input);
  const meta = await pipeline.metadata();
  if (meta.width !== SEO_OG_WIDTH || meta.height !== SEO_OG_HEIGHT) {
    pipeline = sharp(input).resize(SEO_OG_WIDTH, SEO_OG_HEIGHT, { fit: "cover", position: "top" });
  }
  return pipeline
    .webp({
      quality: SEO_OG_WEBP_QUALITY,
      effort: SEO_OG_WEBP_EFFORT,
      smartSubsample: true,
    })
    .toBuffer();
}
