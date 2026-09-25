import { describe, it, expect } from "vitest";
import {
  isFacebookOAuthConfigured,
  isGoogleOAuthConfigured,
  mergeMissingCredentials,
} from "./oauthSettings.js";

const baseRow = {
  id: 2,
  googleLoginEnabled: true,
  googleClientId: null,
  googleClientSecret: null,
  facebookLoginEnabled: true,
  facebookAppId: null,
  facebookAppSecret: null,
  linkedinLoginEnabled: true,
  linkedinClientId: null,
  linkedinClientSecret: null,
  paypalClientId: null,
  paypalClientSecret: null,
  recaptchaSecretKey: null,
  smtpPass: null,
  paypalSandbox: true,
  paypalEnableCards: true,
} as never;

describe("oauthSettings", () => {
  it("detects configured providers only when enabled with id and secret", () => {
    expect(isGoogleOAuthConfigured({
      ...baseRow,
      googleClientId: "id",
      googleClientSecret: "secret",
    })).toBe(true);
    expect(isGoogleOAuthConfigured({
      ...baseRow,
      googleLoginEnabled: false,
      googleClientId: "id",
      googleClientSecret: "secret",
    })).toBe(false);
    expect(isGoogleOAuthConfigured({
      ...baseRow,
      googleClientId: "id",
    })).toBe(false);

    expect(isFacebookOAuthConfigured({
      ...baseRow,
      facebookAppId: "app",
      facebookAppSecret: "secret",
    })).toBe(true);
    expect(isFacebookOAuthConfigured({
      ...baseRow,
      facebookAppId: "app",
    })).toBe(false);
  });

  it("merges missing OAuth credentials from older settings rows", () => {
    const latest = {
      ...baseRow,
      googleClientId: "new-google-id",
    };
    const older = {
      ...baseRow,
      id: 1,
      googleClientSecret: "old-google-secret",
      facebookAppId: "fb-app",
      facebookAppSecret: "fb-secret",
    };

    const merged = mergeMissingCredentials(latest, older);
    expect(merged.googleClientId).toBe("new-google-id");
    expect(merged.googleClientSecret).toBe("old-google-secret");
    expect(merged.facebookAppId).toBe("fb-app");
    expect(merged.facebookAppSecret).toBe("fb-secret");
  });

  it("prefers non-empty values on the target row over donor fallbacks", () => {
    const latest = {
      ...baseRow,
      googleClientId: "latest-id",
      googleClientSecret: "latest-secret",
    };
    const older = {
      ...baseRow,
      id: 1,
      googleClientId: "old-id",
      googleClientSecret: "old-secret",
    };

    const merged = mergeMissingCredentials(latest, older);
    expect(merged.googleClientId).toBe("latest-id");
    expect(merged.googleClientSecret).toBe("latest-secret");
  });
});
