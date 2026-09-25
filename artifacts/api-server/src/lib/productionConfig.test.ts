import { afterEach, describe, expect, it, vi } from "vitest";
import { assertProductionConfig, exitOnProductionConfigFailure } from "./productionConfig.js";

describe("assertProductionConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("no-ops outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(() => assertProductionConfig()).not.toThrow();
  });

  it("throws in production without CLIENT_GUARD_TOKEN", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CLIENT_GUARD_TOKEN", "");
    vi.stubEnv("JWT_SECRET", "secret");
    vi.stubEnv("ADMIN_AREA_PIN", "pin");
    expect(() => assertProductionConfig()).toThrow(/CLIENT_GUARD_TOKEN/);
  });

  it("throws in production without ADMIN_AREA_PIN", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CLIENT_GUARD_TOKEN", "guard");
    vi.stubEnv("JWT_SECRET", "secret");
    vi.stubEnv("ADMIN_AREA_PIN", "");
    expect(() => assertProductionConfig()).toThrow(/ADMIN_AREA_PIN/);
  });

  it("exitOnProductionConfigFailure calls process.exit when misconfigured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CLIENT_GUARD_TOKEN", "");
    vi.stubEnv("JWT_SECRET", "secret");
    vi.stubEnv("ADMIN_AREA_PIN", "pin");
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as typeof process.exit);
    exitOnProductionConfigFailure();
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it("passes in production with CLIENT_GUARD_TOKEN", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CLIENT_GUARD_TOKEN", "secret-token");
    vi.stubEnv("JWT_SECRET", "jwt-secret");
    vi.stubEnv("ADMIN_AREA_PIN", "long-random-pin");
    expect(() => assertProductionConfig()).not.toThrow();
  });
});
