import { describe, it, expect, vi } from "vitest";
import {
  applySocialLoginTestOverrides,
  buildOAuthRedirectUri,
  resolveSiteOrigin,
  verifyFacebookCredentials,
  verifyGoogleCredentials,
} from "./oauthSocialLoginTest.js";

describe("oauthSocialLoginTest", () => {
  it("builds provider callback URLs", () => {
    expect(buildOAuthRedirectUri("https://verifykm.com", "google")).toBe(
      "https://verifykm.com/api/auth/google/callback",
    );
    expect(buildOAuthRedirectUri("https://verifykm.com", "facebook")).toBe(
      "https://verifykm.com/api/auth/facebook/callback",
    );
  });

  it("resolves site origin from proxy headers", () => {
    expect(resolveSiteOrigin("https", "verifykm.com")).toBe("https://verifykm.com");
    expect(resolveSiteOrigin("https, http", "verifykm.com, proxy.internal")).toBe("https://verifykm.com");
  });

  it("merges unsaved admin form overrides for testing", () => {
    const base = {
      id: 1,
      googleLoginEnabled: true,
      googleClientId: "saved-id",
      googleClientSecret: "saved-secret",
    } as never;
    const merged = applySocialLoginTestOverrides(base, {
      googleClientSecret: "draft-secret",
    });
    expect(merged?.googleClientSecret).toBe("draft-secret");
    expect(merged?.googleClientId).toBe("saved-id");
  });

  it("accepts valid Google credentials when invalid_grant is returned", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "invalid_grant" }),
    });
    const result = await verifyGoogleCredentials(
      "client-id",
      "client-secret",
      "https://verifykm.com/api/auth/google/callback",
      fetchFn as never,
    );
    expect(result.ok).toBe(true);
  });

  it("rejects invalid Google credentials", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "invalid_client" }),
    });
    const result = await verifyGoogleCredentials(
      "bad-id",
      "bad-secret",
      "https://verifykm.com/api/auth/google/callback",
      fetchFn as never,
    );
    expect(result.ok).toBe(false);
  });

  it("accepts valid Facebook credentials", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: "app-token" }),
    });
    const result = await verifyFacebookCredentials("app-id", "app-secret", fetchFn as never);
    expect(result.ok).toBe(true);
  });
});
