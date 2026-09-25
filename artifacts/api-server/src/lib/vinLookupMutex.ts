/** Serialize concurrent POST /vin/lookup for the same user+VIN (single-process). */
const chains = new Map<string, Promise<unknown>>();

export async function withUserVinLookupLock<T>(
  userId: string,
  vin: string,
  fn: () => Promise<T>,
): Promise<T> {
  const key = `${userId}:${vin.toUpperCase()}`;
  const prev = chains.get(key) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  chains.set(key, run);
  try {
    return await run;
  } finally {
    if (chains.get(key) === run) chains.delete(key);
  }
}
