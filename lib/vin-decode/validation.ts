export const VIN_CHARSET_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

export type VinFormatIssue =
  | { kind: "length"; actual: number }
  | { kind: "invalid_chars"; chars: string[]; hasBannedLetter: boolean };

export function inspectVinFormat(vin: string): VinFormatIssue | null {
  const v = vin.trim().toUpperCase();
  if (v.length !== 17) return { kind: "length", actual: v.length };
  if (VIN_CHARSET_RE.test(v)) return null;
  const invalidChars = [...new Set(v.split("").filter((c) => !/^[A-HJ-NPR-Z0-9]$/.test(c)))];
  return {
    kind: "invalid_chars",
    chars: invalidChars,
    hasBannedLetter: invalidChars.some((c) => ["I", "O", "Q"].includes(c)),
  };
}

export function isValidVinFormat(vin: string): boolean {
  return inspectVinFormat(vin) === null;
}
