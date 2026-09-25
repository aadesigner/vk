/**
 * Cupra platform codes on VSS/VS7 (shared WMI with SEAT).
 * Keep lightweight — model resolution stays in global-brands.ts.
 */

const CUPRA_PLATFORM: Record<string, string> = {
  VSSZZZKM: "KM", // Formentor
  VSSZZZK1: "K1", // Born
  VSSZZZKP: "MEB", // Born
  VSSZZZKC: "KC", // Born (Cupra-exclusive)
  // KN is SEAT Tarraco — never map to Cupra León (KL).
  VS7ZZZKM: "KM", // Terramar
};

export function matchCupraPlatform(vin: string): string | null {
  const u = vin.toUpperCase();
  for (const len of [8, 7]) {
    const hit = CUPRA_PLATFORM[u.slice(0, len)];
    if (hit) return hit;
  }
  return null;
}
