type VinPeekLike = {
  vin: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  series?: string | null;
  trim?: string | null;
  engine?: string | null;
};

function norm(s: string): string {
  return s.trim();
}

/** Random-looking token: long all-caps alphanumeric with no vowels (e.g. ASDFASDFASDF). */
function looksLikeGibberish(value: string): boolean {
  const t = norm(value);
  if (t.length < 8) return false;
  const compact = t.replace(/[^A-Za-z0-9]/g, "");
  if (compact.length < 8) return false;
  if (/^[A-Z0-9]+$/.test(compact) && !/[AEIOUaeiou]/.test(compact)) return true;
  if (compact.length >= 12 && /^[A-Z0-9]+$/.test(compact) && !/\s/.test(t)) return true;
  return false;
}

function overlapsVinChars(value: string, vin: string): boolean {
  const compact = norm(value).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (compact.length < 4) return false;
  return vin.toUpperCase().includes(compact);
}

function fieldLooksValid(value: string | null | undefined, vin: string): boolean {
  if (!value) return false;
  const t = norm(value);
  if (!t) return false;
  if (looksLikeGibberish(t)) return false;
  if (overlapsVinChars(t, vin)) return false;
  return true;
}

function plausibleYear(year: number | null | undefined): boolean {
  if (year == null || !Number.isFinite(year)) return false;
  return year >= 1980 && year <= new Date().getFullYear() + 2;
}

/** Peek response belongs to the VIN currently in the input (guards stale React Query data). */
export function peekMatchesVin(peek: VinPeekLike | null | undefined, vin: string): boolean {
  const normalized = vin.trim().toUpperCase();
  if (!normalized || !peek?.vin) return false;
  return peek.vin.trim().toUpperCase() === normalized;
}

/** True when decoder returned a plausible make (model/year optional extras). */
export function isTrustworthyVinDecode(peek: VinPeekLike): boolean {
  return fieldLooksValid(peek.make, peek.vin);
}

export type VinPeekAvailability = {
  manualPending?: boolean;
  dataAvailable?: boolean;
  checkUnavailable?: boolean;
};

/** Valid free decode + no local/provider data yet — prompt user to verify every character. */
export function shouldShowPendingVinDoubleCheck(
  peek: VinPeekLike & VinPeekAvailability,
): boolean {
  if (!peek.manualPending) return false;
  if (peek.dataAvailable !== true) return false;
  if (peek.checkUnavailable) return false;
  return isTrustworthyVinDecode(peek);
}

/**
 * Checkout preview title ONLY: make, or make + year when year is available.
 * Never include model or generation ranges in checkout preview.
 */
export function formatVehicleTitle(peek: VinPeekLike): string | null {
  if (!isTrustworthyVinDecode(peek)) return null;
  const parts: string[] = [];
  if (peek.make) parts.push(peek.make);
  if (plausibleYear(peek.year ?? null)) parts.push(String(peek.year));
  return parts.join(" ") || null;
}

export function formatVehiclePreview(peek: VinPeekLike): string | null {
  if (!isTrustworthyVinDecode(peek)) return null;
  const parts: (string | number)[] = [];
  if (peek.year != null) parts.push(peek.year);
  if (peek.make) parts.push(peek.make);
  if (peek.model) parts.push(peek.model);
  const line = parts.join(" ");
  if (!line) return null;
  const grade = peek.trim && fieldLooksValid(peek.trim, peek.vin)
    ? peek.trim
    : (peek.series && fieldLooksValid(peek.series, peek.vin) ? peek.series : null);
  if (grade) return `${line} · ${grade}`;
  return line;
}

export function formatEnginePreview(peek: VinPeekLike): string | null {
  if (!peek.engine || !isTrustworthyVinDecode(peek)) return null;
  const t = norm(peek.engine);
  if (!t || looksLikeGibberish(t)) return null;
  return t;
}
