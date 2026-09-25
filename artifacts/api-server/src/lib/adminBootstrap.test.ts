import { afterEach, describe, expect, it, vi } from "vitest";
import { adminEmailMatches } from "./adminBootstrap.js";

describe("adminEmailMatches", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("matches ADMIN_EMAIL case-insensitively", () => {
    vi.stubEnv("ADMIN_EMAIL", "Admin@Example.com");
    expect(adminEmailMatches("admin@example.com")).toBe(true);
    expect(adminEmailMatches("other@example.com")).toBe(false);
  });

  it("returns false when ADMIN_EMAIL is unset", () => {
    vi.stubEnv("ADMIN_EMAIL", "");
    expect(adminEmailMatches("admin@example.com")).toBe(false);
  });
});
