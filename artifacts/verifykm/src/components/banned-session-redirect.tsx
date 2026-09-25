import { useEffect } from "react";
import { useLocation } from "wouter";
import { AUTH_BANNED_STORAGE_KEY } from "@/lib/auth-context";
import { SUPPORTED_LANGS, type Language } from "@/lib/languages";
import { pathFor } from "@/lib/localized-routes";

/** Sends users with a revoked banned session to sign-in with the suspension message. */
export function BannedSessionRedirect() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (sessionStorage.getItem(AUTH_BANNED_STORAGE_KEY) !== "1") return;
    sessionStorage.removeItem(AUTH_BANNED_STORAGE_KEY);
    const lang = (SUPPORTED_LANGS.find((code) =>
      window.location.pathname.startsWith(`/${code}/`) || window.location.pathname === `/${code}`,
    ) ?? "en") as Language;
    setLocation(`${pathFor(lang, "sign_in")}?error=banned`);
  }, [setLocation]);

  return null;
}
