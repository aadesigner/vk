import { afterEach, describe, expect, it, vi } from "vitest";
import { isBlockedProviderHost, validateProviderBaseUrl } from "./providerUrl.js";

describe("validateProviderBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts public HTTPS URLs", () => {
    const result = validateProviderBaseUrl("https://carstat.dev/api");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.normalized).toBe("https://carstat.dev/api");
  });

  it("rejects localhost and metadata hosts", () => {
    expect(validateProviderBaseUrl("https://localhost/report").ok).toBe(false);
    expect(validateProviderBaseUrl("http://169.254.169.254/").ok).toBe(false);
    expect(isBlockedProviderHost("10.0.0.5")).toBe(true);
  });

  it("rejects HTTP in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(validateProviderBaseUrl("http://carstat.dev").ok).toBe(false);
  });
});
