/** Fire Meta CompleteRegistration once per browser session (email + OAuth signup). */

export const COMPLETE_REGISTRATION_FIRED_KEY = "verifykm_complete_registration_fired";
export const COMPLETE_REGISTRATION_PENDING_KEY = "verifykm_complete_registration_pending";

function storageGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* private mode / blocked storage */
  }
}

function storageRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function pushDataLayer(): void {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: "complete_registration" });
}

function firePixel(): boolean {
  if (typeof window.fbq !== "function") return false;
  window.fbq("track", "CompleteRegistration");
  return true;
}

/** Record a signup conversion. Safe to call more than once — sessionStorage dedupes. */
export function trackCompleteRegistration(): void {
  if (typeof window === "undefined") return;
  if (storageGet(COMPLETE_REGISTRATION_FIRED_KEY) === "1") return;

  pushDataLayer();

  if (firePixel()) {
    storageSet(COMPLETE_REGISTRATION_FIRED_KEY, "1");
    storageRemove(COMPLETE_REGISTRATION_PENDING_KEY);
    return;
  }

  storageSet(COMPLETE_REGISTRATION_PENDING_KEY, "1");
}

/** Pixel loads after public-settings — flush a signup that happened first. */
export function flushPendingCompleteRegistration(): void {
  if (typeof window === "undefined") return;
  if (storageGet(COMPLETE_REGISTRATION_FIRED_KEY) === "1") return;
  if (storageGet(COMPLETE_REGISTRATION_PENDING_KEY) !== "1") return;
  if (!firePixel()) return;
  storageSet(COMPLETE_REGISTRATION_FIRED_KEY, "1");
  storageRemove(COMPLETE_REGISTRATION_PENDING_KEY);
}

/** OAuth success redirects with ?signup=1. Strip it so refresh does not re-fire. */
export function consumeSignupQueryFlag(): boolean {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  if (url.searchParams.get("signup") !== "1") return false;
  url.searchParams.delete("signup");
  const search = url.searchParams.toString();
  const next = `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
  window.history.replaceState(window.history.state, "", next);
  return true;
}
