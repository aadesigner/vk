export const PENDING_VIN_KEY = "pending_vin";
import { pathFor } from "@/lib/localized-routes";
export const CHECKOUT_VIN_KEY = "checkout_vin";
/** Survives some sessionStorage loss (tab restore); cleared when checkout consumes it. */
export const REFERRAL_VIN_KEY = "verifykm_referral_vin";
export const AUTH_RETURN_PATH_KEY = "auth_return_path";
export const DECODER_PENDING_VIN_KEY = "decoder_pending_vin";
export const PAYPAL_CHECKOUT_SESSION_KEY = "verifykm_paypal_checkout";
/** Set when redirecting to checkout after auth — checkout must prefill VIN only, not auto-start payment. */
export const CHECKOUT_PREFILL_ONLY_KEY = "checkout_prefill_only";

export type PaypalCheckoutSessionPhase = "approval" | "capture";

export type PaypalCheckoutSession = {
  orderId: string;
  vin: string;
  /** `approval` = order created, user has not finished PayPal yet; `capture` = approved, capture may be retried. */
  phase?: PaypalCheckoutSessionPhase;
};

const PAYPAL_ORDER_ID_RE = /^[A-Z0-9]{8,20}$/;

export function readPaypalCheckoutSession(): PaypalCheckoutSession | null {
  if (typeof sessionStorage === "undefined") return null;
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(PAYPAL_CHECKOUT_SESSION_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { orderId?: string; vin?: string; phase?: string };
    const orderId = parsed.orderId?.toUpperCase() ?? "";
    const vin = normalizeCheckoutVin(parsed.vin ?? "");
    if (!PAYPAL_ORDER_ID_RE.test(orderId) || !VIN_FORMAT_RE.test(vin)) return null;
    const phase =
      parsed.phase === "capture" ? "capture" : parsed.phase === "approval" ? "approval" : undefined;
    return { orderId, vin, phase };
  } catch {
    return null;
  }
}

export function writePaypalCheckoutSession(session: PaypalCheckoutSession): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(
    PAYPAL_CHECKOUT_SESSION_KEY,
    JSON.stringify({
      orderId: session.orderId.toUpperCase(),
      vin: normalizeCheckoutVin(session.vin),
      phase: session.phase,
    }),
  );
}

export function markPaypalCheckoutAwaitingApproval(orderId: string, vin: string): void {
  writePaypalCheckoutSession({ orderId, vin, phase: "approval" });
}

export function markPaypalCheckoutCapturePending(orderId: string, vin: string): void {
  writePaypalCheckoutSession({ orderId, vin, phase: "capture" });
}

/** True when refresh should retry capture (user approved in PayPal). */
export function shouldResumePaypalCapture(session: PaypalCheckoutSession): boolean {
  return session.phase === "capture";
}

export const VIN_FORMAT_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

export type PendingVinPeek = {
  dataAvailable?: boolean;
  fromCache?: boolean;
  alreadyUnlocked?: boolean;
  manualPending?: boolean;
};

export function normalizeCheckoutVin(vin: string): string {
  return vin.trim().toUpperCase();
}

/** URL / referral candidates: strip spaces and dashes, then normalize. */
export function sanitizeVinCandidate(vin: string): string {
  return normalizeCheckoutVin(vin).replace(/[\s-]/g, "");
}

function writeReferralVinBackup(vin: string): void {
  try {
    localStorage.setItem(REFERRAL_VIN_KEY, vin);
  } catch { /* private browsing */ }
}

function readReferralVinBackup(): string | null {
  try {
    const raw = localStorage.getItem(REFERRAL_VIN_KEY);
    if (!raw) return null;
    const normalized = sanitizeVinCandidate(raw);
    if (!VIN_FORMAT_RE.test(normalized)) {
      localStorage.removeItem(REFERRAL_VIN_KEY);
      return null;
    }
    return normalized;
  } catch {
    return null;
  }
}

function clearReferralVinBackup(): void {
  try {
    localStorage.removeItem(REFERRAL_VIN_KEY);
  } catch { /* private browsing */ }
}

/** Read pending/checkout VIN from sessionStorage; clears invalid entries. */
export function readStoredPendingVin(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(PENDING_VIN_KEY) || sessionStorage.getItem(CHECKOUT_VIN_KEY);
  if (!raw) return readReferralVinBackup();
  const normalized = sanitizeVinCandidate(raw);
  if (!VIN_FORMAT_RE.test(normalized)) {
    sessionStorage.removeItem(PENDING_VIN_KEY);
    sessionStorage.removeItem(CHECKOUT_VIN_KEY);
    return readReferralVinBackup();
  }
  return normalized;
}

export function clearStoredPendingVin(): void {
  sessionStorage.removeItem(PENDING_VIN_KEY);
  sessionStorage.removeItem(CHECKOUT_VIN_KEY);
  clearReferralVinBackup();
}

/** True when VIN is in local-exists / catalog and the user has not already unlocked it. */
export function isEligiblePendingVin(peek: PendingVinPeek): boolean {
  if (peek.alreadyUnlocked) return false;
  if (peek.dataAvailable === true) return true;
  if (peek.fromCache === true) return true;
  return false;
}

/** Persist VIN for checkout (session + local backup). Returns normalized VIN or null if invalid. */
export function persistVinForCheckout(vin: string): string | null {
  const normalized = sanitizeVinCandidate(vin);
  if (!VIN_FORMAT_RE.test(normalized)) return null;
  try {
    sessionStorage.setItem(CHECKOUT_VIN_KEY, normalized);
    sessionStorage.setItem(PENDING_VIN_KEY, normalized);
  } catch { /* private browsing */ }
  writeReferralVinBackup(normalized);
  return normalized;
}

/**
 * Resolve VIN for checkout prefill: URL ?vin= → session → localStorage backup.
 * Does not change payment / unlock behavior — display/handoff only.
 *
 * When `?vin=` is present in the URL it always wins: a new (even invalid) VIN must
 * never resurrect a previously stored checkout VIN.
 */
export function resolveCheckoutPrefillVin(
  search: string = typeof window !== "undefined" ? window.location.search : "",
): string | null {
  const params = new URLSearchParams(search);
  if (params.has("vin")) {
    const urlVin = params.get("vin") ?? "";
    const fromUrl = persistVinForCheckout(urlVin);
    if (fromUrl) return fromUrl;
    // Explicit but invalid/incomplete — show the attempt, clear stale stored VINs
    clearStoredPendingVin();
    const attempted = sanitizeVinCandidate(urlVin);
    return attempted || null;
  }
  return readStoredPendingVin();
}

export type UnlockCheckoutTarget = {
  href: string;
  vin: string;
};

/**
 * Where guests land when a VIN check requires an account (register, not login).
 * Keep ?vin= (and existing UTM params) in the URL so post-auth checkout still works
 * if sessionStorage is flaky (referral redirects, private mode, www/non-www switches).
 */
export function guestVinAuthPath(language: string, vin?: string | null): string {
  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  );
  const normalized = vin ? sanitizeVinCandidate(vin) : "";
  if (VIN_FORMAT_RE.test(normalized)) {
    params.set("vin", normalized);
  }
  const qs = params.toString();
  const base = pathFor(language as import("@/lib/languages").Language, "sign_up");
  return `${base}${qs ? `?${qs}` : ""}`;
}

/** Full-page navigation to guest auth — guarantees ?vin= lands in the address bar. */
export function assignGuestVinAuth(language: string, vin?: string | null): void {
  const path = guestVinAuthPath(language, vin);
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  window.location.assign(`${base}${path}`);
}

/**
 * Build navigation target when user unlocks a full report from a decoded VIN.
 * - Signed in → checkout with ?vin= (also in sessionStorage)
 * - Signed out → sign-up; pending_vin is kept for post-auth redirect (see auth.tsx)
 */
export function buildUnlockCheckoutTarget(
  vin: string,
  language: string,
  isSignedIn: boolean,
): UnlockCheckoutTarget | null {
  const normalized = persistVinForCheckout(vin);
  if (!normalized) return null;

  if (isSignedIn) {
    return {
      vin: normalized,
      href: pathFor(language, "checkout", { query: `vin=${encodeURIComponent(normalized)}` }),
    };
  }

  return {
    vin: normalized,
    href: guestVinAuthPath(language, normalized),
  };
}

/** Guest VIN check → sign-up with pending VIN stored (unified across marketing pages). */
export function redirectGuestForVinCheckout(vin: string, language: string): string | null {
  const normalized = persistVinForCheckout(vin);
  if (!normalized) return null;
  return guestVinAuthPath(language, normalized);
}

/** Capture ?vin= from the current URL into sessionStorage (auth / referral landings). */
export function captureVinFromSearch(search: string = typeof window !== "undefined" ? window.location.search : ""): string | null {
  const urlVin = new URLSearchParams(search).get("vin");
  if (!urlVin) return null;
  return persistVinForCheckout(urlVin);
}

export function clearCheckoutPaymentResumeState(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(PAYPAL_CHECKOUT_SESSION_KEY);
  sessionStorage.removeItem(PAYPAL_CREDIT_PACK_SESSION_KEY);
}

export const PAYPAL_CREDIT_PACK_SESSION_KEY = "verifykm_paypal_credit_pack";

export type PaypalCreditPackSession = {
  orderId: string;
  packId: string;
  phase?: PaypalCheckoutSessionPhase;
};

export function readPaypalCreditPackSession(): PaypalCreditPackSession | null {
  if (typeof sessionStorage === "undefined") return null;
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(PAYPAL_CREDIT_PACK_SESSION_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { orderId?: string; packId?: string; phase?: string };
    const orderId = parsed.orderId?.toUpperCase() ?? "";
    const packId = parsed.packId ?? "";
    if (!PAYPAL_ORDER_ID_RE.test(orderId)) return null;
    if (packId !== "pack3" && packId !== "pack5") return null;
    const phase =
      parsed.phase === "capture" ? "capture" : parsed.phase === "approval" ? "approval" : undefined;
    return { orderId, packId, phase };
  } catch {
    return null;
  }
}

export function writePaypalCreditPackSession(session: PaypalCreditPackSession): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(
    PAYPAL_CREDIT_PACK_SESSION_KEY,
    JSON.stringify({
      orderId: session.orderId.toUpperCase(),
      packId: session.packId,
      phase: session.phase,
    }),
  );
}

export function markPaypalCreditPackAwaitingApproval(orderId: string, packId: string): void {
  writePaypalCreditPackSession({ orderId, packId, phase: "approval" });
}

export function markPaypalCreditPackCapturePending(orderId: string, packId: string): void {
  writePaypalCreditPackSession({ orderId, packId, phase: "capture" });
}

export function clearPaypalCreditPackSession(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(PAYPAL_CREDIT_PACK_SESSION_KEY);
}

export function shouldResumePaypalCreditPackCapture(session: PaypalCreditPackSession): boolean {
  return session.phase === "capture";
}

export function markCheckoutPrefillOnly(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(CHECKOUT_PREFILL_ONLY_KEY, "1");
}

export function buildPrefillOnlyCheckoutPath(vin: string, language: string): string | null {
  const normalized = normalizeCheckoutVin(vin);
  if (!VIN_FORMAT_RE.test(normalized)) return null;
  sessionStorage.setItem(CHECKOUT_VIN_KEY, normalized);
  clearCheckoutPaymentResumeState();
  markCheckoutPrefillOnly();
  return pathFor(language, "checkout", { query: `vin=${encodeURIComponent(normalized)}` });
}

/** True once after post-auth checkout redirect; clears the flag when read. */
export function consumeCheckoutPrefillOnly(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  const flagged = sessionStorage.getItem(CHECKOUT_PREFILL_ONLY_KEY) === "1";
  if (flagged) sessionStorage.removeItem(CHECKOUT_PREFILL_ONLY_KEY);
  return flagged;
}

function preparePostAuthCheckoutLanding(): void {
  clearCheckoutPaymentResumeState();
  markCheckoutPrefillOnly();
}

/** After auth, where to send the user if a checkout VIN is waiting. */
export function getPostAuthCheckoutPath(language: string): string | null {
  const pending = sessionStorage.getItem(PENDING_VIN_KEY);
  if (pending) {
    const normalized = persistVinForCheckout(pending);
    if (normalized) {
      try { sessionStorage.removeItem(PENDING_VIN_KEY); } catch { /* ignore */ }
      preparePostAuthCheckoutLanding();
      return pathFor(language, "checkout", { query: `vin=${encodeURIComponent(normalized)}` });
    }
  }
  const stored = sessionStorage.getItem(CHECKOUT_VIN_KEY) || readReferralVinBackup();
  if (stored) {
    const normalized = persistVinForCheckout(stored);
    if (normalized) {
      try { sessionStorage.removeItem(PENDING_VIN_KEY); } catch { /* ignore */ }
      preparePostAuthCheckoutLanding();
      return pathFor(language, "checkout", { query: `vin=${encodeURIComponent(normalized)}` });
    }
  }
  return null;
}

export function getPostAuthRedirectPath(language: string): string {
  const returnPath = sessionStorage.getItem(AUTH_RETURN_PATH_KEY);
  if (returnPath) {
    sessionStorage.removeItem(AUTH_RETURN_PATH_KEY);
    return returnPath.startsWith("/") ? returnPath : `/${language}${returnPath}`;
  }
  return getPostAuthCheckoutPath(language) ?? pathFor(language, "dashboard");
}

/** Full page load for checkout avoids stale lazy chunks right after sign-up. */
export function applyPostAuthRedirect(path: string, setLocation: (path: string) => void): void {
  if (path.includes("/checkout") || path.includes("/credits/")) {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    window.location.assign(`${base}${path.startsWith("/") ? path : `/${path}`}`);
    return;
  }
  setLocation(path);
}
