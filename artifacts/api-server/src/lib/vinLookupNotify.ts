/** In-process waiters — wakes client long-polls when admin publishes a pending VIN. */

type Waiter = {
  resolve: () => void;
  timer: ReturnType<typeof setTimeout>;
};

const waitersByVin = new Map<string, Set<Waiter>>();

function vinKey(vin: string): string {
  return vin.trim().toUpperCase();
}

/** Hold until admin publish signals this VIN or timeout (then client reconnects). */
export function waitForVinLookupPublish(vin: string, timeoutMs: number): Promise<void> {
  const key = vinKey(vin);
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const set = waitersByVin.get(key);
      set?.delete(waiter);
      if (set?.size === 0) waitersByVin.delete(key);
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    const waiter: Waiter = { resolve: finish, timer };
    if (!waitersByVin.has(key)) waitersByVin.set(key, new Set());
    waitersByVin.get(key)!.add(waiter);
  });
}

/** Call after pending VIN is published — releases waiting report tabs for this VIN. */
export function notifyVinLookupPublished(vin: string): void {
  const key = vinKey(vin);
  const set = waitersByVin.get(key);
  if (!set?.size) return;
  for (const waiter of set) {
    clearTimeout(waiter.timer);
    waiter.resolve();
  }
  waitersByVin.delete(key);
}
