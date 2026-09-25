import {
  decodeVin,
  decodeCountry,
  decodeLocalSeries,
  decodeVinLocalFree,
  isPlausibleMake,
  isPlausibleModel,
  isYearLikeModelName,
} from "@workspace/vin-decode";

export type VinPeekIdentity = {
  make: string | null;
  model: string | null;
  year: number | null;
  /**
   * Generation production window when exact model year is not in the VIN
   * (e.g. Euro Mercedes Baumuster / classic BMW ETK). Never a guessed single year.
   */
  modelYearRange: string | null;
  series: string | null;
  trim: string | null;
  engine: string | null;
  country: string | null;
  wmi: string;
  decodeSource: "cache" | "local";
};

type CacheHint = {
  make?: unknown;
  model?: unknown;
  year?: unknown;
};

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t || null;
}

function asYear(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d{4}$/.test(value.trim())) {
    return parseInt(value.trim(), 10);
  }
  return null;
}

function plausibleYear(year: number | null): number | null {
  if (year == null) return null;
  const max = new Date().getFullYear() + 2;
  return year >= 1980 && year <= max ? year : null;
}

function plausibleTrim(trim: string | null, vin: string): string | null {
  if (!trim) return null;
  const t = trim.trim();
  if (t.length < 1 || t.length > 48) return null;
  const compact = t.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (compact.length >= 10 && /^[A-Z0-9]+$/.test(compact) && !/[AEIOU]/.test(compact)) return null;
  if (compact.length >= 8 && vin.toUpperCase().includes(compact)) return null;
  return t;
}

function pickCachedField(
  cached: unknown,
  decoded: string | null,
  vin: string,
  kind: "make" | "model",
): string | null {
  const raw = asString(cached);
  if (raw) {
    const ok = kind === "make" ? isPlausibleMake(raw, vin) : isPlausibleModel(raw, vin);
    if (ok) return raw;
  }
  return decoded;
}

/** Fast local identity — WMI make, model line, model year. No NHTSA round-trip. */
function fromLocalDecode(vin: string): VinPeekIdentity {
  const local = decodeVin(vin);
  let model = isPlausibleModel(local.model, vin) ? local.model : null;
  if (isYearLikeModelName(model)) model = null;
  const series = plausibleTrim(decodeLocalSeries(vin, model), vin);
  // Same generation-window contract as free decoder — never invent a single year.
  const free = local.year == null ? decodeVinLocalFree(vin) : null;
  return {
    make: isPlausibleMake(local.make, vin) ? local.make : null,
    model,
    year: local.year,
    modelYearRange: free?.modelYearRange ?? null,
    series,
    trim: null,
    engine: local.engineDecoded,
    country: local.country ?? decodeCountry(vin),
    wmi: local.wmi,
    decodeSource: "local",
  };
}

/**
 * Checkout / peek identity decode.
 * Uses local tables only (make, year, optional model) — instant, no VPIC wait.
 * Rich NHTSA merge stays on GET /api/vin/decode-free for the free decoder page.
 */
export async function decodeVinPeek(
  vin: string,
  _checkDigitValid: boolean,
  cache?: CacheHint | null,
): Promise<VinPeekIdentity> {
  const base = fromLocalDecode(vin);

  if (!cache) return base;

  const cachedMake = pickCachedField(cache.make, base.make, vin, "make");
  const cachedModel = pickCachedField(cache.model, base.model, vin, "model");
  const cachedYear = plausibleYear(asYear(cache.year)) ?? base.year;
  const usedCache =
    (cachedMake !== base.make && asString(cache.make) != null) ||
    (cachedModel !== base.model && asString(cache.model) != null) ||
    (cachedYear !== base.year && asYear(cache.year) != null);

  return {
    make: cachedMake,
    model: cachedModel,
    year: cachedYear,
    // Keep generation window only when we still lack an exact year.
    modelYearRange: cachedYear != null ? null : base.modelYearRange,
    series: base.series,
    trim: base.trim,
    engine: base.engine,
    country: base.country,
    wmi: base.wmi,
    decodeSource: usedCache ? "cache" : base.decodeSource,
  };
}

function looksLikeGibberish(value: string): boolean {
  const t = value.trim();
  if (t.length < 8) return false;
  const compact = t.replace(/[^A-Za-z0-9]/g, "");
  if (compact.length < 8) return false;
  if (/^[A-Z0-9]+$/.test(compact) && !/[AEIOUaeiou]/.test(compact)) return true;
  if (compact.length >= 12 && /^[A-Z0-9]+$/.test(compact) && !/\s/.test(t)) return true;
  return false;
}

function fieldLooksValid(value: string | null | undefined, vin: string): boolean {
  if (!value) return false;
  const t = value.trim();
  if (!t || looksLikeGibberish(t)) return false;
  const compact = t.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (compact.length >= 4 && vin.toUpperCase().includes(compact)) return false;
  return true;
}

/** Same rules as checkout free-decoder trust check — make alone is enough. */
export function isTrustworthyVinIdentity(identity: VinPeekIdentity, vin: string): boolean {
  return fieldLooksValid(identity.make, vin);
}

export { isPlausibleMake, isPlausibleModel };
