/** Visitors stay signed in for at least this long (cookie + JWT). */
export const MIN_SESSION_DAYS = 14;
export const DEFAULT_SESSION_DAYS = 30;

export function clampSessionDays(days: number | null | undefined): number {
  if (days == null || !Number.isFinite(days)) return DEFAULT_SESSION_DAYS;
  return Math.min(365, Math.max(MIN_SESSION_DAYS, Math.round(days)));
}
