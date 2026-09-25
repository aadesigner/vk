/** Short in-process dedupe — prevents duplicate transactional emails from races/retries. */

const DEDUPE_WINDOW_MS = 10 * 60 * 1000;
const recentDeliveries = new Map<string, number>();

export function claimEmailDelivery(key: string): boolean {
  const now = Date.now();
  const last = recentDeliveries.get(key);
  if (last != null && now - last < DEDUPE_WINDOW_MS) return false;
  recentDeliveries.set(key, now);
  if (recentDeliveries.size > 5000) {
    for (const [k, t] of recentDeliveries) {
      if (now - t > DEDUPE_WINDOW_MS) recentDeliveries.delete(k);
    }
  }
  return true;
}

export function vinReadyEmailDeliveryKey(lookupId: number, email: string): string {
  return `vinready:${lookupId}:${email.trim().toLowerCase()}`;
}
