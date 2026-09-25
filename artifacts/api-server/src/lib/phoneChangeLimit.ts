import {
  MAX_COUNTRY_CHANGES_PER_DAY,
  countryChangesRemaining,
  nextCountryChangeCount,
} from "./countryChangeLimit.js";

/** Same daily quota as country / nationality (2 per UTC day). */
export const MAX_PHONE_CHANGES_PER_DAY = MAX_COUNTRY_CHANGES_PER_DAY;

export function phoneChangesRemaining(
  changeDay: string | null | undefined,
  changeCount: number | null | undefined,
  now = new Date(),
): number {
  return countryChangesRemaining(changeDay, changeCount, now);
}

export function nextPhoneChangeCount(
  changeDay: string | null | undefined,
  changeCount: number | null | undefined,
  now = new Date(),
): { day: string; count: number } {
  return nextCountryChangeCount(changeDay, changeCount, now);
}
