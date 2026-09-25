import { useEffect, useState } from "react";
import { NAV_MENU_WARMUP_SOURCES } from "@/lib/nav-assets";
import { shouldDeferHeavyClientWarmup } from "@/hooks/use-light-motion";

/**
 * Keeps navbar flag/logo bitmaps decoded after first paint (mobile sheet remounts).
 * On phones we still warm this small set — just later — so sidebar open is instant
 * without competing with the hero CTA on first paint.
 */
export function NavAssetWarmup() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const light = shouldDeferHeavyClientWarmup();
    // Desktop: sooner. Mobile/Save-Data: after first paint settles.
    const delayMs = light ? 1_800 : 700;
    const idleTimeout = light ? 4_000 : 2_500;

    let idleId: number | undefined;
    const start = window.setTimeout(() => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(() => setReady(true), { timeout: idleTimeout });
      } else {
        setReady(true);
      }
    }, delayMs);
    return () => {
      window.clearTimeout(start);
      if (idleId != null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
    };
  }, []);

  if (!ready) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed -left-[9999px] top-0 h-0 w-0 overflow-hidden opacity-0"
      tabIndex={-1}
    >
      {NAV_MENU_WARMUP_SOURCES.map((src) => (
        <img key={src} src={src} alt="" width={1} height={1} decoding="async" />
      ))}
    </div>
  );
}
