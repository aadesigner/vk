import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  CHUNK_RELOAD_KEY,
  clearChunkReloadState,
  isChunkLoadError,
  shouldAttemptChunkReload,
} from "./lazy-with-retry";

describe("isChunkLoadError", () => {
  it("detects common dynamic import failures", () => {
    expect(isChunkLoadError(new Error("Failed to fetch dynamically imported module"))).toBe(true);
    expect(isChunkLoadError(new Error("Importing a module script failed."))).toBe(true);
    expect(isChunkLoadError(new Error("Unexpected token '<'"))).toBe(true);
    expect(isChunkLoadError(new Error("Expected a JavaScript module but got text/html"))).toBe(true);
    expect(isChunkLoadError(new Error("Load failed"))).toBe(true);
    expect(isChunkLoadError(new Error("error fetching dynamically imported module: /assets/x.js"))).toBe(true);
  });

  it("ignores unrelated errors and generic API fetch failures", () => {
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false);
    // Must NOT treat normal network/API failures as chunk errors (would reload mid-checkout).
    expect(isChunkLoadError(new TypeError("Failed to fetch"))).toBe(false);
    expect(isChunkLoadError(new Error("cancelled"))).toBe(false);
  });
});

describe("shouldAttemptChunkReload", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", { location: { reload: vi.fn(), href: "https://verifykm.com/en", origin: "https://verifykm.com", replace: vi.fn() } });
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => { store.clear(); },
    });
  });

  it("allows three soft reload attempts within the window", () => {
    expect(shouldAttemptChunkReload()).toBe(true);
    expect(shouldAttemptChunkReload()).toBe(true);
    expect(shouldAttemptChunkReload()).toBe(true);
    expect(shouldAttemptChunkReload()).toBe(false);
  });

  it("resets after a successful chunk load", () => {
    shouldAttemptChunkReload();
    clearChunkReloadState();
    expect(shouldAttemptChunkReload()).toBe(true);
    expect(sessionStorage.getItem(CHUNK_RELOAD_KEY)).not.toBe("1");
  });
});
