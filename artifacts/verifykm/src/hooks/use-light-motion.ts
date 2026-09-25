import { useSyncExternalStore } from "react";

/**
 * True on phones / touch UIs / reduced-motion — skip enter animations that
 * keep report cards and headings at opacity:0 until Framer fires (feels like
 * laggy scroll/first paint on Safari iOS).
 */
const LIGHT_MQ =
  "(max-width: 767px), (pointer: coarse), (prefers-reduced-motion: reduce)";

function subscribe(onStoreChange: () => void) {
  const mq = window.matchMedia(LIGHT_MQ);
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getSnapshot() {
  return window.matchMedia(LIGHT_MQ).matches;
}

function getServerSnapshot() {
  return true;
}

export function useLightMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Sync read for effects outside React (prefetch / warmup gates). */
export function isLightMotionEnv(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia(LIGHT_MQ).matches;
}

/** Skip decode/prefetch work when the device is weak or Data Saver is on. */
export function shouldDeferHeavyClientWarmup(): boolean {
  if (typeof window === "undefined") return true;
  if (isLightMotionEnv()) return true;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return true;
  return false;
}
