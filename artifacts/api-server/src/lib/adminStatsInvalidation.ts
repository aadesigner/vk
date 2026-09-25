/** Decoupled hook so payment routes can bust admin stats cache without importing admin routes. */
let invalidateHook: (() => void) | undefined;

export function registerAdminStatsInvalidationHook(fn: () => void): void {
  invalidateHook = fn;
}

export function invalidateAdminStatsCache(): void {
  invalidateHook?.();
}
