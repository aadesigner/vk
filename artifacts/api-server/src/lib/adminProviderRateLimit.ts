const WINDOW_MS = 60 * 60 * 1000;
const MAX_PROVIDER_ACTIONS = 20;

const actionLog = new Map<string, number[]>();

/** Cap admin actions that may trigger paid provider API calls. */
export function consumeAdminProviderAction(adminId: string): boolean {
  const now = Date.now();
  const recent = (actionLog.get(adminId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PROVIDER_ACTIONS) return false;
  recent.push(now);
  actionLog.set(adminId, recent);
  return true;
}

export function adminProviderRateLimitMessage(): string {
  return `Provider action limit reached (${MAX_PROVIDER_ACTIONS} per hour). Try again later.`;
}
