export function isPlausibleModel(model: string | null, vin: string): boolean {
  if (!model) return false;
  const m = model.trim();
  if (m.length < 2 || m.length > 48) return false;
  const compact = m.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (compact.length >= 10 && /^[A-Z0-9]+$/.test(compact) && !/[AEIOU]/.test(compact)) return false;
  if (compact.length >= 6 && vin.toUpperCase().includes(compact)) return false;
  return true;
}

export function isPlausibleMake(make: string | null, vin: string): boolean {
  if (!make) return false;
  const m = make.trim();
  if (m.length < 2 || m.length > 32) return false;
  const compact = m.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (compact.length >= 8 && /^[A-Z0-9]+$/.test(compact) && !/[AEIOU]/.test(compact)) return false;
  if (compact.length >= 6 && vin.toUpperCase().includes(compact)) return false;
  return true;
}

/** True when a 4-digit model string is really a mis-decoded year (e.g. "2002"), not "3008" or "500". */
export function isYearLikeModelName(model: string | null | undefined): boolean {
  if (!model) return false;
  const t = model.trim();
  if (!/^\d{4}$/.test(t)) return false;
  const n = parseInt(t, 10);
  const max = new Date().getFullYear() + 2;
  return n >= 1980 && n <= max;
}
