/** Serialize provider local-report fetches per VIN across all users (single-process). */
const chains = new Map<string, Promise<unknown>>();

export async function withGlobalVinProviderLock<T>(
  vin: string,
  fn: () => Promise<T>,
): Promise<T> {
  const key = vin.trim().toUpperCase();
  const prev = chains.get(key) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  chains.set(key, run);
  try {
    return await run;
  } finally {
    if (chains.get(key) === run) chains.delete(key);
  }
}
