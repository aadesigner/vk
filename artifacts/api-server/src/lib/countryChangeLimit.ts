/** Max profile country / nationality changes per UTC calendar day. */
export const MAX_COUNTRY_CHANGES_PER_DAY = 2;

export function utcDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function countryChangesRemaining(
  changeDay: string | null | undefined,
  changeCount: number | null | undefined,
  now = new Date(),
): number {
  const today = utcDayKey(now);
  const used = changeDay === today ? Math.max(0, Number(changeCount ?? 0)) : 0;
  return Math.max(0, MAX_COUNTRY_CHANGES_PER_DAY - used);
}

export function nextCountryChangeCount(
  changeDay: string | null | undefined,
  changeCount: number | null | undefined,
  now = new Date(),
): { day: string; count: number } {
  const today = utcDayKey(now);
  const prev = changeDay === today ? Math.max(0, Number(changeCount ?? 0)) : 0;
  return { day: today, count: prev + 1 };
}
