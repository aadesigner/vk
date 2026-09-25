import { useEffect, useRef, useCallback, useState } from "react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const SCRIPT_WAIT_MS = 10_000;
const POLL_MS = 100;

/** Mirror server: reCAPTCHA keys are domain-bound and fail on LAN / Tailscale. */
function isClientPrivateDevHost(): boolean {
  if (import.meta.env.PROD) return false;
  const hostname = window.location.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".ts.net")) {
    return true;
  }
  const parts = hostname.split(".").map(Number);
  if (parts.length === 4 && parts.every((p) => Number.isInteger(p) && p >= 0 && p <= 255)) {
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  return false;
}

declare global {
  interface Window {
    grecaptcha: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

type RcSettings = { enabled: boolean; siteKey: string | null };

let _cached: RcSettings | null = null;
let _inflight: Promise<RcSettings> | null = null;

export function fetchRecaptchaSettings(): Promise<RcSettings> {
  if (_cached) return Promise.resolve(_cached);
  if (_inflight) return _inflight;
  _inflight = fetch(`${basePath}/api/payments/public-settings`)
    .then(r => r.json())
    .then((d: { recaptchaEnabled?: boolean; recaptchaSiteKey?: string | null }) => {
      const privateDev = isClientPrivateDevHost();
      _cached = {
        enabled: !!d.recaptchaEnabled && !privateDev,
        siteKey: privateDev ? null : (d.recaptchaSiteKey ?? null),
      };
      return _cached;
    })
    .catch(() => ({ enabled: false, siteKey: null } as RcSettings))
    .finally(() => { _inflight = null; });
  return _inflight;
}

function waitForGrecaptcha(siteKey: string, timeoutMs = SCRIPT_WAIT_MS): Promise<boolean> {
  return new Promise((resolve) => {
    const onReady = () => {
      if (typeof window.grecaptcha === "undefined") {
        resolve(false);
        return;
      }
      window.grecaptcha.ready(() => resolve(true));
    };

    if (typeof window.grecaptcha !== "undefined") {
      onReady();
      return;
    }

    const deadline = Date.now() + timeoutMs;
    const poll = setInterval(() => {
      if (typeof window.grecaptcha !== "undefined") {
        clearInterval(poll);
        onReady();
      } else if (Date.now() >= deadline) {
        clearInterval(poll);
        resolve(false);
      }
    }, POLL_MS);
  });
}

function injectRecaptchaScript(siteKey: string): void {
  if (document.getElementById("recaptcha-v3-script")) return;
  const script = document.createElement("script");
  script.id = "recaptcha-v3-script";
  // recaptcha.net loads in more regions / privacy browsers than google.com alone
  script.src = `https://www.recaptcha.net/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
  script.async = true;
  document.head.appendChild(script);
}

/** Run execute() — call from pointerdown/touchstart while the user gesture is still active (iOS). */
export function executeRecaptchaToken(siteKey: string, action: string): Promise<string | null> {
  if (!siteKey || typeof window === "undefined") return Promise.resolve(null);
  if (typeof window.grecaptcha === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    window.grecaptcha.ready(() => {
      void window.grecaptcha.execute(siteKey, { action })
        .then((token) => resolve(token))
        .catch(() => resolve(null));
    });
  });
}

/** Primed gesture token → quick execute → full wait/load retries. */
export async function resolveRecaptchaToken(opts: {
  enabled: boolean;
  siteKey: string | null;
  action: string;
  primed: Promise<string | null> | null;
  getToken: (action: string) => Promise<string | null>;
}): Promise<string | null> {
  if (!opts.enabled || !opts.siteKey) return null;

  if (opts.primed) {
    const fromPrime = await opts.primed;
    if (fromPrime) return fromPrime;
  }

  const quick = await executeRecaptchaToken(opts.siteKey, opts.action);
  if (quick) return quick;

  return obtainRecaptchaToken(opts.getToken, true, opts.action);
}

export function clearRecaptchaSettingsCache(): void {
  _cached = null;
}

/** Inject script (if needed) and wait until grecaptcha is callable. */
export async function ensureRecaptchaReady(siteKey: string): Promise<boolean> {
  if (!siteKey) return false;
  injectRecaptchaScript(siteKey);
  return waitForGrecaptcha(siteKey);
}

export function useRecaptcha() {
  const [settings, setSettings] = useState<RcSettings>({ enabled: false, siteKey: null });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const scriptInjected = useRef(false);

  useEffect(() => {
    fetchRecaptchaSettings().then((s) => {
      setSettings(s);
      setSettingsLoaded(true);
    });
  }, []);

  useEffect(() => {
    const { enabled, siteKey } = settings;
    if (!enabled || !siteKey) {
      setScriptReady(true);
      return;
    }

    setScriptReady(false);
    if (!scriptInjected.current) {
      injectRecaptchaScript(siteKey);
      scriptInjected.current = true;
    }

    let cancelled = false;
    waitForGrecaptcha(siteKey).then((ok) => {
      if (!cancelled) setScriptReady(ok);
    });
    return () => { cancelled = true; };
  }, [settings.enabled, settings.siteKey]);

  const getToken = useCallback(async (action = "default"): Promise<string | null> => {
    const current = await fetchRecaptchaSettings();
    if (!current.enabled || !current.siteKey) return null;

    if (!document.getElementById("recaptcha-v3-script")) {
      injectRecaptchaScript(current.siteKey);
    }

    const ready = await waitForGrecaptcha(current.siteKey);
    if (!ready) return null;

    return executeRecaptchaToken(current.siteKey, action);
  }, []);

  const enabled = settings.enabled && !!settings.siteKey;
  const ready = settingsLoaded && (!enabled || scriptReady);

  return { getToken, executeRecaptchaToken, enabled, ready, settingsLoaded, siteKey: settings.siteKey };
}

/** Wait briefly and retry — checkout must not POST without a token when reCAPTCHA is on. */
export async function obtainRecaptchaToken(
  getToken: (action?: string) => Promise<string | null>,
  enabled: boolean,
  action = "checkout",
): Promise<string | null> {
  if (!enabled) return null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const token = await getToken(action);
    if (token) return token;
    if (attempt < 7) {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  return null;
}
