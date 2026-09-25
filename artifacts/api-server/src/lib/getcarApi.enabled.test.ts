import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  setGetCarApiEnabledCache,
  invalidateGetCarApiSettingsCache,
} from "./getcarApiSettingsCache.js";
import { checkGetCarApiExists, getGetCarApiConfig, resolveGetCarApiConfig } from "./getcarApi.js";

describe("GetCarAPI admin enable/disable gate", () => {
  const prevKey = process.env.GETCARAPI_API_KEY;

  beforeEach(() => {
    process.env.GETCARAPI_API_KEY = "vdi_test";
    process.env.GETCARAPI_BASE_URL = "https://getcarapi.com";
    setGetCarApiEnabledCache(true);
  });

  afterEach(() => {
    if (prevKey === undefined) delete process.env.GETCARAPI_API_KEY;
    else process.env.GETCARAPI_API_KEY = prevKey;
    setGetCarApiEnabledCache(true);
    invalidateGetCarApiSettingsCache();
    vi.unstubAllGlobals();
  });

  it("getGetCarApiConfig returns null when disabled even with API key", () => {
    setGetCarApiEnabledCache(false);
    expect(getGetCarApiConfig()).toBeNull();
  });

  it("resolveGetCarApiConfig returns config when enabled", async () => {
    setGetCarApiEnabledCache(true);
    // Keep lastFetch fresh so ensure does not overwrite from DB during this unit test.
    setGetCarApiEnabledCache(true);
    const cfg = await resolveGetCarApiConfig();
    expect(cfg?.apiKey).toBe("vdi_test");
  });

  it("checkGetCarApiExists does not hit the network when disabled", async () => {
    setGetCarApiEnabledCache(false);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await checkGetCarApiExists("WDDUX8GB8JA397509");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.status).toBe("unavailable");
  });
});
