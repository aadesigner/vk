/**
 * Demo car photos live in public/demo-cars (copied to dist on build).
 * Card-sized JPEG + WebP from scripts/optimize-demo-car-photos.mjs.
 * Refresh: node artifacts/verifykm/scripts/fetch-demo-car-photos.mjs
 */
const base = () => import.meta.env.BASE_URL.replace(/\/$/, "");

export function demoCarPhotoUrl(file: string): string {
  return `${base()}/demo-cars/${encodeURIComponent(file)}`;
}

/** WebP sibling for a /demo-cars/*.jpg URL (same basename). */
export function demoCarPhotoWebpUrl(src: string): string | null {
  if (!src || !/\.jpe?g(?:\?|$)/i.test(src)) return null;
  return src.replace(/\.jpe?g/i, ".webp");
}
