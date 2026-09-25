/** Resolve display (hero/thumbs) vs HD (lightbox) photo lists from report data. */
export function resolveReportPhotoSets(data: {
  photos?: string[] | null;
  photosHd?: string[] | null;
  photoAlternates?: Array<string | null> | null;
  thumbnailUrl?: string | null;
} | null | undefined): {
  photos: string[];
  photosHd: string[];
  photoAlternates: Array<string | null>;
} {
  if (!data) return { photos: [], photosHd: [], photoAlternates: [] };
  const photos = (
    Array.isArray(data.photos) && data.photos.length > 0
      ? data.photos
      : data.thumbnailUrl
        ? [data.thumbnailUrl]
        : []
  ).filter((p): p is string => typeof p === "string" && p.length > 0);

  const hdRaw = Array.isArray(data.photosHd)
    ? data.photosHd.filter((p): p is string => typeof p === "string" && p.length > 0)
    : [];
  const photosHd = hdRaw.length > 0 ? hdRaw : photos;

  const rawAlts = Array.isArray(data.photoAlternates) ? data.photoAlternates : [];
  const photoAlternates = photos.map((_, i) => {
    const alt = rawAlts[i];
    return typeof alt === "string" && alt.length > 0 && alt !== photos[i] ? alt : null;
  });

  return { photos, photosHd, photoAlternates };
}

/** Next index whose URL is not marked failed (wraps). Null if every photo failed. */
export function nextAvailablePhotoIndex(
  photos: string[],
  fromIndex: number,
  failedByUrl: Record<string, boolean>,
  direction: 1 | -1 = 1,
): number | null {
  const n = photos.length;
  if (n === 0) return null;
  for (let step = 1; step <= n; step++) {
    const i = ((fromIndex + direction * step) % n + n) % n;
    const url = photos[i];
    if (url && !failedByUrl[url]) return i;
  }
  return null;
}

/** First working photo index starting at `startIndex` (inclusive). */
export function firstAvailablePhotoIndex(
  photos: string[],
  failedByUrl: Record<string, boolean>,
  startIndex = 0,
): number | null {
  const n = photos.length;
  if (n === 0) return null;
  for (let step = 0; step < n; step++) {
    const i = (startIndex + step) % n;
    const url = photos[i];
    if (url && !failedByUrl[url]) return i;
  }
  return null;
}

/** Effective URL for a gallery slot after optional CDN→source swap. */
export function resolvePhotoSlotUrl(
  photos: string[],
  index: number,
  overrides: Record<number, string>,
): string | null {
  return overrides[index] ?? photos[index] ?? null;
}
