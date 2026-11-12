import { beforeEach, describe, expect, it } from "vitest";
import {
  isPendingVinEnabledCached,
  setPendingVinEnabledCache,
} from "./pendingVinSettingsCache.js";

describe("pendingVinSettingsCache", () => {
  beforeEach(() => {
    setPendingVinEnabledCache(true);
  });

  it("defaults to enabled", () => {
    expect(isPendingVinEnabledCached()).toBe(true);
  });

  it("write-through disables pending immediately", () => {
    setPendingVinEnabledCache(false);
    expect(isPendingVinEnabledCached()).toBe(false);
  });
});
