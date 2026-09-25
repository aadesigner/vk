import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { isAdminAppPath } from "@/lib/admin-routes";
import { isTrackablePresencePath } from "@/lib/presence-path";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const HEARTBEAT_MS = 60_000;
const MIN_RESEND_MS = 55_000;

/** Lightweight signed-in presence on public pages — heartbeat every ~60s, no page tracking. */
export function PresenceHeartbeat() {
  const { isSignedIn, isLoaded } = useAuth();
  const [location] = useLocation();
  const lastSentAtRef = useRef(0);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const pathname = location.split("?")[0]?.split("#")[0] ?? location;
    if (isAdminAppPath(pathname) || !isTrackablePresencePath(pathname)) return;

    const ping = () => {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastSentAtRef.current < MIN_RESEND_MS) return;
      lastSentAtRef.current = now;
      const ctrl = new AbortController();
      const timer = window.setTimeout(() => ctrl.abort(), 8_000);
      void fetch(`${basePath}/api/auth/presence`, {
        method: "POST",
        credentials: "include",
        signal: ctrl.signal,
        keepalive: true,
      })
        .catch(() => {})
        .finally(() => window.clearTimeout(timer));
    };

    ping();
    const intervalId = window.setInterval(ping, HEARTBEAT_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isLoaded, isSignedIn, location]);

  return null;
}
