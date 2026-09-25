export type FreeDecodeResult = {
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  manufacturer: string | null;
  vehicleType: string | null;
  bodyStyle: string | null;
  engineCylinders: string | null;
  engineDisplacementL: string | null;
  engineDecoded: string | null;
  engineCode: string | null;
  fuelType: string | null;
  driveType: string | null;
  transmissionStyle: string | null;
  plantCountry: string | null;
  plantCity: string | null;
  plantCode: string | null;
  countryOfOrigin: string | null;
  wmi: string;
  checkDigitValid: boolean;
  source: "nhtsa" | "local" | "hybrid";
  diagnostics?: import("@workspace/vin-decode").VinDiagnostic[];
};

const CACHE_KEY = "verifykm_free_decode_v2";
const CACHE_MAX = 20;

function readCache(): Record<string, FreeDecodeResult> {
  if (typeof sessionStorage === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) as Record<string, FreeDecodeResult> : {};
  } catch {
    return {};
  }
}

function writeCache(map: Record<string, FreeDecodeResult>): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(map));
  } catch {
    // Quota exceeded — drop oldest half
    const keys = Object.keys(map);
    const trimmed = Object.fromEntries(
      keys.slice(-Math.ceil(CACHE_MAX / 2)).map((k) => [k, map[k]]),
    );
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
    } catch {
      // ignore
    }
  }
}

export function getCachedFreeDecode(vin: string): FreeDecodeResult | null {
  const normalized = vin.trim().toUpperCase();
  return readCache()[normalized] ?? null;
}

export function setCachedFreeDecode(result: FreeDecodeResult): void {
  const normalized = result.vin.trim().toUpperCase();
  const map = readCache();
  map[normalized] = result;
  const keys = Object.keys(map);
  if (keys.length > CACHE_MAX) {
    for (const k of keys.slice(0, keys.length - CACHE_MAX)) delete map[k];
  }
  writeCache(map);
}
