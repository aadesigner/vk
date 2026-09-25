/** Earliest model year we offered paid history lookups for (gate currently disabled). */
export const MIN_VEHICLE_LOOKUP_YEAR = 2008;

export function plausibleDecodedYear(year: number | null | undefined): year is number {
  if (year == null || !Number.isFinite(year)) return false;
  const max = new Date().getFullYear() + 2;
  return year >= 1980 && year <= max;
}

/** Year gate disabled — checkout/peek no longer block pre-2008 decodes. */
export function isVehicleTooOldForLookup(_year: number | null | undefined): boolean {
  return false;
}

export function isVehicleEligibleForHistoryLookup(year: number | null | undefined): boolean {
  return !isVehicleTooOldForLookup(year);
}
