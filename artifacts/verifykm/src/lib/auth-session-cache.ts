import type { AuthUser } from "@/lib/auth-types";

const STORAGE_KEY = "verifykm_auth_cache";
/** Match server MIN_SESSION_DAYS — cache is a UX hint only; cookie is authoritative. */
const MIN_CACHE_MS = 14 * 24 * 60 * 60 * 1000;

type AuthCacheEntry = {
  user: AuthUser;
  savedAt: number;
  sessionExpiresAt?: string;
};

export function readAuthCache(): AuthUser | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthCacheEntry;
    if (!parsed.user?.id) return null;

    const expiresAt = parsed.sessionExpiresAt
      ? Date.parse(parsed.sessionExpiresAt)
      : parsed.savedAt + MIN_CACHE_MS;
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      clearAuthCache();
      return null;
    }
    if (Date.now() - parsed.savedAt > MIN_CACHE_MS) {
      clearAuthCache();
      return null;
    }

    return parsed.user;
  } catch {
    return null;
  }
}

export function writeAuthCache(user: AuthUser, sessionExpiresAt?: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    const entry: AuthCacheEntry = {
      user,
      savedAt: Date.now(),
      ...(sessionExpiresAt ? { sessionExpiresAt } : {}),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Private mode / quota — cookie session still works.
  }
}

export function clearAuthCache(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
