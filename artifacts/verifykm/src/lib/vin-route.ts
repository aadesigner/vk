/** 17-char VIN (no I, O, Q). Must be checked before parseInt — digit-leading VINs parse as numeric IDs. */
export const VIN_17_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

export function normalizeRouteVin(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isVin17(raw: string): boolean {
  return VIN_17_RE.test(normalizeRouteVin(raw));
}

export type VinRouteParam =
  | { kind: "vin"; vin: string }
  | { kind: "lookupId"; lookupId: number };

export function parseVinRouteParam(raw: string): VinRouteParam | null {
  const vinUpper = normalizeRouteVin(raw);
  if (isVin17(vinUpper)) {
    return { kind: "vin", vin: vinUpper };
  }
  const lookupId = parseInt(raw, 10);
  if (Number.isNaN(lookupId)) return null;
  return { kind: "lookupId", lookupId };
}
