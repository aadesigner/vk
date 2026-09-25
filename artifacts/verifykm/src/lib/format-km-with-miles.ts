const KM_PER_MILE = 1.609344;

export function kmToMiles(km: number): number {
  return Math.round(km / KM_PER_MILE);
}

/** e.g. "(85,438 miles)" */
export function formatMilesInParens(km: number, t: (key: string) => string): string {
  return t("mileage_miles_in_parens")
    .replace("{miles}", kmToMiles(km).toLocaleString());
}
