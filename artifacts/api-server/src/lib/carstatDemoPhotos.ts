/**
 * Carstat playground / free-demo reports reuse unrelated auction photos
 * (e.g. Jeep Grand Cherokee media on a Honda CR-V VIN). Detect that and
 * prefer make/model stock art served by the kmcheck frontend.
 */

/** Media hashes known to belong to a different make than some demo VINs claim. */
const MEDIA_HASH_MAKES: Record<string, string[]> = {
  // Jeep Grand Cherokee (VIN 1C4RJGAG3PC525071) — reused on Honda demo listings
  "017760110fc426b7d79008da1c0427467829a05cd60dcfdb3ca4a5a9a0b39f42": ["jeep"],
  "0d61f374ace5f42d797b32d1a5d778ed5d32141eb814a58eaa4260951c6d4069": ["jeep"],
  "1b318fc67535e0fd24862870e53e535c992d7a1aec2b786dee4e1f78f69fe804": ["jeep"],
  // Genesis GV70 dealership shot — reused on Honda demo Encar row
  "0e4b387392c55a9b232be41ae36dbbf82c1b7e3724e16e032408f48ad85b229f": ["genesis"],
};

/** Same files as artifacts/kmcheck/public/demo-cars (same-origin on the report UI). */
const STOCK_BY_MAKE_MODEL: Array<{ test: RegExp; file: string }> = [
  { test: /honda.*cr[-\s]?v/i, file: "honda-crv.jpg" },
  { test: /toyota.*rav\s?4/i, file: "toyota-rav4.jpg" },
  { test: /ford.*f[-\s]?150/i, file: "ford-f150.jpg" },
  { test: /nissan.*altima/i, file: "nissan-altima.jpg" },
  { test: /chevrolet|chevy.*malibu/i, file: "chevy-malibu.jpg" },
  { test: /bmw.*3\s?20/i, file: "bmw-320i.jpg" },
  { test: /mercedes.*c[-\s]?class|mercedes.*c\s?200|mercedes.*c\s?180/i, file: "mercedes-c-class.jpg" },
  { test: /volkswagen|vw.*tiguan/i, file: "vw-tiguan.jpg" },
  { test: /hyundai.*tucson/i, file: "hyundai-tucson.jpg" },
  { test: /hyundai.*grandeur/i, file: "hyundai-grandeur.jpg" },
  { test: /kia.*sportage/i, file: "kia-sportage.jpg" },
  { test: /kia.*carnival/i, file: "kia-carnival.jpg" },
  { test: /kia.*k8/i, file: "kia-k8.jpg" },
  { test: /honda.*civic/i, file: "honda-civic.jpg" },
  { test: /toyota.*prius/i, file: "toyota-prius.jpg" },
  { test: /subaru.*forester/i, file: "subaru-forester.jpg" },
  { test: /nissan.*qashqai/i, file: "nissan-qashqai.jpg" },
];

export function isCarstatIllustrativeDemoPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  const note = String((payload as Record<string, unknown>).example_note ?? "");
  if (!note.trim()) return false;
  return /demonstrat|illustrative|fictional|playground|example\s+only/i.test(note);
}

export function carstatMediaHash(url: string): string | null {
  const m = url.match(/\/vhr\/media\/([a-f0-9]{32,})(?:\.[a-z0-9]+)?(?:\?|$)/i);
  return m?.[1]?.toLowerCase() ?? null;
}

function makeTokens(make: string | null | undefined): string[] {
  const raw = (make ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!raw) return [];
  const parts = raw.split(/\s+/).filter(Boolean);
  if (/chevrolet|chevy/.test(raw)) parts.push("chevrolet", "chevy");
  if (/mercedes/.test(raw)) parts.push("mercedes");
  if (/volkswagen|\bvw\b/.test(raw)) parts.push("volkswagen", "vw");
  return [...new Set(parts)];
}

/** Drop CDN frames that are known to belong to a different make. */
export function photoMatchesVehicleMake(url: string, make: string | null | undefined): boolean {
  const hash = carstatMediaHash(url);
  if (!hash) return true;
  const owners = MEDIA_HASH_MAKES[hash];
  if (!owners?.length) return true;
  const tokens = makeTokens(make);
  if (tokens.length === 0) return false;
  return owners.some((owner) => tokens.some((t) => t.includes(owner) || owner.includes(t)));
}

export function stockPhotoPathForMakeModel(
  make: string | null | undefined,
  model: string | null | undefined,
): string | null {
  const blob = `${make ?? ""} ${model ?? ""}`.trim();
  if (!blob) return null;
  for (const row of STOCK_BY_MAKE_MODEL) {
    if (row.test.test(blob)) return `/demo-cars/${row.file}`;
  }
  return null;
}

/**
 * For illustrative Carstat demos, replace provider collage with make-matched stock.
 * For live reports, only strip known cross-VIN misattributed media hashes.
 */
export function resolveCarstatReportPhotos(opts: {
  photos: string[];
  photosHd: string[];
  make: string | null | undefined;
  model: string | null | undefined;
  illustrativeDemo: boolean;
}): { photos: string[]; photosHd: string[] } {
  const make = opts.make ?? null;
  const stock = stockPhotoPathForMakeModel(make, opts.model);

  if (opts.illustrativeDemo) {
    if (stock) return { photos: [stock], photosHd: [stock] };
    return { photos: [], photosHd: [] };
  }

  const photos = opts.photos.filter((u) => photoMatchesVehicleMake(u, make)).slice(0, 24);
  const photosHd = opts.photosHd.filter((u) => photoMatchesVehicleMake(u, make)).slice(0, 24);

  if (photos.length === 0 && stock && opts.photos.length > 0) {
    return { photos: [stock], photosHd: [stock] };
  }
  return { photos, photosHd };
}
