import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { clearAuthCache, readAuthCache, writeAuthCache } from "@/lib/auth-session-cache";
import { invalidateClientAreaQueries } from "@/lib/client-area-queries";
import type { AuthUser } from "@/lib/auth-types";

export type { AuthUser } from "@/lib/auth-types";

export class ApiRequestError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
  }
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export const AUTH_BANNED_STORAGE_KEY = "verifykm_auth_banned";

interface AuthContextValue {
  user: AuthUser | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  login: (email: string, password: string, recaptchaToken?: string) => Promise<void>;
  register: (email: string, password: string, name?: string, recaptchaToken?: string, countryCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

type MeResponse = { user: AuthUser | null; banned?: boolean; sessionExpiresAt?: string };

function persistUserSession(user: AuthUser | null, sessionExpiresAt?: string): void {
  if (!user || user.isBanned) {
    clearAuthCache();
    return;
  }
  writeAuthCache(user, sessionExpiresAt);
}

function applyMeResponse(data: MeResponse): AuthUser | null {
  if (data.banned || data.user?.isBanned) {
    sessionStorage.setItem(AUTH_BANNED_STORAGE_KEY, "1");
    return null;
  }
  return data.user ?? null;
}

function assertActiveUser(user: AuthUser | undefined): asserts user is AuthUser {
  if (!user || user.isBanned) {
    throw new ApiRequestError("Your account has been suspended.", "banned");
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(() => readAuthCache());
  const [isLoaded, setIsLoaded] = useState(true);
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  // Clear client data on logout or account switch — not on fresh login (null → user),
  // which would race with dashboard queries and leave reports stuck loading.
  useEffect(() => {
    const curId = user?.id ?? null;
    const prevId = prevUserIdRef.current;

    if (prevId !== undefined && prevId !== curId) {
      const switchingAccount = prevId != null && curId != null && prevId !== curId;
      const loggingOut = prevId != null && curId == null;

      if (switchingAccount || loggingOut) {
        void queryClient.removeQueries({
          predicate: (query) => {
            const root = query.queryKey[0];
            if (typeof root !== "string") return false;
            return (
              root.startsWith("/api/user/")
              || root === "/api/vin"
              || root.startsWith("/api/vin/")
            );
          },
        });
      }

      if (curId != null && (switchingAccount || loggingOut)) {
        invalidateClientAreaQueries(queryClient);
      }
    }

    prevUserIdRef.current = curId;
  }, [user?.id, queryClient]);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch(`${basePath}/api/auth/me`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          const data = await res.json().catch(() => ({})) as MeResponse;
          if (data.banned) sessionStorage.setItem(AUTH_BANNED_STORAGE_KEY, "1");
          clearAuthCache();
          setUser(null);
        }
        return;
      }
      const data = await res.json() as MeResponse;
      const nextUser = applyMeResponse(data);
      setUser(nextUser);
      persistUserSession(nextUser, data.sessionExpiresAt);
    } catch {
      // Keep existing session on transient network errors — do not force logout.
    }
  }, []);

  useEffect(() => {
    // Never block first paint on /api/auth/me — cached user is already in state; guests render immediately.
    setIsLoaded(true);
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string, recaptchaToken?: string) => {
    const res = await fetch(`${basePath}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password, recaptchaToken }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = await res.json().catch(() => ({})) as { user?: AuthUser; error?: string; code?: string };
    if (!res.ok) throw new ApiRequestError(data.error ?? "Login failed", data.code);
    assertActiveUser(data.user);
    setUser(data.user ?? null);
    persistUserSession(data.user ?? null);
    invalidateClientAreaQueries(queryClient);
  }, [queryClient]);

  const register = useCallback(async (
    email: string,
    password: string,
    name?: string,
    recaptchaToken?: string,
    countryCode?: string,
  ) => {
    const { captureAcquisitionOnce, getStoredAcquisition } = await import("@/lib/acquisition");
    captureAcquisitionOnce();
    const acquisition = getStoredAcquisition();
    const res = await fetch(`${basePath}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password, name, countryCode, recaptchaToken, acquisition }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = await res.json().catch(() => ({})) as { user?: AuthUser; error?: string; code?: string };
    if (!res.ok) throw new ApiRequestError(data.error ?? "Registration failed", data.code);
    assertActiveUser(data.user);
    setUser(data.user ?? null);
    persistUserSession(data.user ?? null);
    invalidateClientAreaQueries(queryClient);
  }, [queryClient]);

  const logout = useCallback(async () => {
    try {
      await fetch(`${basePath}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Clear local session even when the network fails (tab closed, offline, etc.)
    }
    clearAuthCache();
    setUser(null);
  }, []);

  const isSignedIn = user !== null && !user.isBanned;

  return (
    <AuthContext.Provider value={{
      user,
      isLoaded,
      isSignedIn,
      login,
      register,
      logout,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
