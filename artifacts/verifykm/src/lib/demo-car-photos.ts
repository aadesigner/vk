/**
 * Demo car photos live in public/demo-cars (copied to dist on build).
 * Refresh: node artifacts/verifykm/scripts/fetch-demo-car-photos.mjs
 */
export function demoCarPhotoUrl(file: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}/demo-cars/${encodeURIComponent(file)}`;
}
