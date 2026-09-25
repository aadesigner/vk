/**
 * Shared entry-language geo for `/` and unprefixed paths (unit-tested helpers).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const storage: Record<string, string> = {};

vi.stubGlobal("localStorage", {
  getItem: (k: string) => storage[k] ?? null,
  setItem: (k: string, v: string) => {
    storage[k] = v;
  },
  removeItem: (k: string) => {
    delete storage[k];
  },
});

vi.stubGlobal("sessionStorage", {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
});

describe("shared entry language geo", () => {
  beforeEach(() => {
    for (const k of Object.keys(storage)) delete storage[k];
    vi.resetModules();
  });

  it("resolveEntryLanguageSync is null until preference or prior evaluation", async () => {
    const { resolveEntryLanguageSync } = await import("./geo-language-client");
    const { setStoredLangPreference, markGeoLanguageEvaluated } = await import("./lang-preference");

    expect(resolveEntryLanguageSync()).toBeNull();

    markGeoLanguageEvaluated();
    expect(resolveEntryLanguageSync()).toBe("en");

    for (const k of Object.keys(storage)) delete storage[k];
    setStoredLangPreference("de");
    expect(resolveEntryLanguageSync()).toBe("de");
  });

  it("stored preference from unprefixed geo sticks for homepage entry", async () => {
    const { resolveEntryLanguageSync } = await import("./geo-language-client");
    const { setStoredLangPreference, markGeoLanguageEvaluated } = await import("./lang-preference");

    // Simulate first visit to /cars/usa → geo picked sq
    setStoredLangPreference("sq");
    markGeoLanguageEvaluated();

    expect(resolveEntryLanguageSync()).toBe("sq");
  });

  it("manual language switch overrides and stops further geo", async () => {
    const { resolveEntryLanguageSync } = await import("./geo-language-client");
    const { setStoredLangPreference, markGeoLanguageEvaluated } = await import("./lang-preference");

    setStoredLangPreference("sq");
    markGeoLanguageEvaluated();
    setStoredLangPreference("en");

    expect(resolveEntryLanguageSync()).toBe("en");
  });
});
