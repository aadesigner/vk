import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://localhost:5432/kmcheck_test";
});

import {
  setCarstatUsaApiEnabledCache,
  invalidateCarstatUsaApiSettingsCache,
} from "./carstatUsaApiSettingsCache.js";
import { checkCarstatUsaRecords, getCarstatUsaApiConfigSync } from "./carstatUsaApi.js";

describe("Carstat USA API admin enable/disable gate", () => {
  beforeEach(() => {
    setCarstatUsaApiEnabledCache(false);
  });

  afterEach(() => {
    setCarstatUsaApiEnabledCache(false);
    invalidateCarstatUsaApiSettingsCache();
    vi.unstubAllGlobals();
  });

  it("getCarstatUsaApiConfigSync returns null when disabled even with credentials", () => {
    setCarstatUsaApiEnabledCache(false);
    expect(
      getCarstatUsaApiConfigSync({ apiKey: "test-key", baseUrl: "https://carstat.dev" }),
    ).toBeNull();
  });

  it("getCarstatUsaApiConfigSync returns credentials when enabled", () => {
    setCarstatUsaApiEnabledCache(true);
    expect(
      getCarstatUsaApiConfigSync({ apiKey: "test-key", baseUrl: "https://carstat.dev" }),
    ).toEqual({ apiKey: "test-key", baseUrl: "https://carstat.dev" });
  });

  it("checkCarstatUsaRecords does not hit the network when disabled", async () => {
    setCarstatUsaApiEnabledCache(false);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await checkCarstatUsaRecords("7FARW2H56JE022576");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.status).toBe("unavailable");
  });
});
