import type { QueryClient } from "@tanstack/react-query";
import { STATIC_QUERY_OPTIONS } from "@/lib/query-options";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Single React Query key for GET /api/payments/public-settings (all consumers share cache). */
export const PUBLIC_SETTINGS_QUERY_KEY = ["/api/payments/public-settings"] as const;

export type PublicSettingsPayload = Record<string, unknown>;

export type OAuthPublicFlags = {
  googleEnabled: boolean;
  facebookEnabled: boolean;
};

const OAUTH_FLAGS_SESSION_KEY = "verifykm_oauth_public_flags";

export function parseOAuthPublicFlags(payload: PublicSettingsPayload | undefined): OAuthPublicFlags {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { googleEnabled: false, facebookEnabled: false };
  }
  return {
    googleEnabled: !!payload.googleEnabled,
    facebookEnabled: !!payload.facebookEnabled,
  };
}

/** Last known-good OAuth flags from a successful public-settings response (survives refetch blips). */
export function readPersistedOAuthFlags(): OAuthPublicFlags | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(OAUTH_FLAGS_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OAuthPublicFlags>;
    const flags: OAuthPublicFlags = {
      googleEnabled: !!parsed.googleEnabled,
      facebookEnabled: !!parsed.facebookEnabled,
    };
    return flags.googleEnabled || flags.facebookEnabled ? flags : null;
  } catch {
    return null;
  }
}

export function persistOAuthFlags(flags: OAuthPublicFlags): void {
  if (typeof sessionStorage === "undefined") return;
  if (flags.googleEnabled || flags.facebookEnabled) {
    sessionStorage.setItem(OAUTH_FLAGS_SESSION_KEY, JSON.stringify(flags));
  } else {
    sessionStorage.removeItem(OAUTH_FLAGS_SESSION_KEY);
  }
}

export function oauthFlagsAnyEnabled(flags: OAuthPublicFlags | null | undefined): boolean {
  return !!(flags?.googleEnabled || flags?.facebookEnabled);
}

/** Seed React Query from session so OAuth buttons survive a full reload after cancel/back. */
export function readPersistedOAuthAsPublicSettings(): PublicSettingsPayload | undefined {
  const flags = readPersistedOAuthFlags();
  if (!flags) return undefined;
  return {
    googleEnabled: flags.googleEnabled,
    facebookEnabled: flags.facebookEnabled,
  };
}

/**
 * Prefer a live API response when it enables providers. If the API suddenly returns all-off
 * but we recently had providers enabled, keep the cached flags (transient refetch blip).
 */
export function resolveOAuthPublicFlags(
  live: OAuthPublicFlags | null,
  cached: OAuthPublicFlags | null,
): OAuthPublicFlags {
  const empty: OAuthPublicFlags = { googleEnabled: false, facebookEnabled: false };
  if (!live) return cached ?? empty;
  if (oauthFlagsAnyEnabled(live)) return live;
  if (oauthFlagsAnyEnabled(cached)) return cached!;
  return live;
}

export async function fetchPublicSettings(signal?: AbortSignal): Promise<PublicSettingsPayload> {
  const r = await fetch(`${basePath}/api/payments/public-settings`, { signal });
  if (!r.ok) throw new Error(`public_settings_${r.status}`);
  const json = await r.json() as PublicSettingsPayload;
  const flags = parseOAuthPublicFlags(json);
  if (oauthFlagsAnyEnabled(flags)) {
    persistOAuthFlags(flags);
  }
  return json;
}

/**
 * OAuth session seeds use initialDataUpdatedAt: 0 and omit PayPal/POK fields.
 * Until a real /public-settings fetch lands (dataUpdatedAt > 0), treat payment
 * config as still loading — never as "not configured".
 */
export function isPublicPaymentSettingsHydrated(
  settings: { paypalClientId?: string | null; pokEnabled?: boolean } | null | undefined,
  opts: { isLoading: boolean; dataUpdatedAt: number },
): boolean {
  if (opts.isLoading || !settings) return false;
  if (opts.dataUpdatedAt > 0) return true;
  // Already have provider fields (e.g. partial cache merge) — safe to proceed.
  return !!settings.paypalClientId || settings.pokEnabled === true;
}

export function publicSettingsQueryOptions() {
  const persisted = readPersistedOAuthAsPublicSettings();
  return {
    queryKey: PUBLIC_SETTINGS_QUERY_KEY,
    queryFn: ({ signal }: { signal?: AbortSignal }) => fetchPublicSettings(signal),
    initialData: persisted,
    initialDataUpdatedAt: persisted ? 0 : undefined,
    placeholderData: (previous: PublicSettingsPayload | undefined) =>
      previous ?? readPersistedOAuthAsPublicSettings(),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 400,
  };
}

/** Idle warm-cache for marketing + client shells. */
export function prefetchPublicSettings(queryClient: QueryClient): void {
  void queryClient.prefetchQuery({
    ...publicSettingsQueryOptions(),
    ...STATIC_QUERY_OPTIONS,
  });
}
