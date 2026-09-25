const TRANSLIT: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
};

const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/** US / Canada / Mexico market VINs (ISO region 1–5) require the position-9 check digit. */
export function isNorthAmericanMarketVin(vin: string): boolean {
  const first = vin.trim().toUpperCase()[0];
  return first >= "1" && first <= "5";
}

export function validateCheckDigit(vin: string): boolean {
  const up = vin.toUpperCase();
  if (up.length !== 17) return false;
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const v = TRANSLIT[up[i]];
    if (v === undefined) return false;
    sum += v * WEIGHTS[i];
  }
  const rem = sum % 11;
  return up[8] === (rem === 10 ? "X" : String(rem));
}

/** For display/API: EU and other non-NA VINs skip check-digit validation (not applicable). */
export function resolveCheckDigitValid(vin: string): boolean {
  const normalized = vin.trim().toUpperCase();
  if (!isNorthAmericanMarketVin(normalized)) return true;
  return validateCheckDigit(normalized);
}
