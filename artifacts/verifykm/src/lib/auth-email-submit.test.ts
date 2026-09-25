/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import {
  readAuthCredentials,
  validateAuthSignupInput,
  resolveAuthRecaptchaToken,
} from "./auth-email-submit";

vi.mock("@/hooks/use-recaptcha", () => ({
  executeRecaptchaToken: vi.fn(async (siteKey: string, action: string) => {
    if (siteKey === "fail-quick") return null;
    return `token-${action}`;
  }),
}));

describe("readAuthCredentials", () => {
  it("reads live DOM values for mobile autofill", () => {
    const form = document.createElement("form");
    for (const [name, value] of [
      ["email", "user@example.com"],
      ["password", "Str0ng-Pass"],
      ["name", "Alex"],
    ]) {
      const input = document.createElement("input");
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }

    expect(readAuthCredentials(form, { email: "", password: "", name: "" })).toEqual({
      email: "user@example.com",
      password: "Str0ng-Pass",
      name: "Alex",
    });
  });
});

describe("validateAuthSignupInput", () => {
  const t = (key: string) => key;

  it("requires terms", () => {
    const result = validateAuthSignupInput(
      { email: "a@b.com", password: "pass12", name: "" },
      false,
      t,
      "AL",
    );
    expect(result).toEqual({ ok: false, error: "auth_error_terms_required" });
  });

  it("requires country", () => {
    const result = validateAuthSignupInput(
      { email: "a@b.com", password: "Xk9-mPq2-Rn4v", name: "" },
      true,
      t,
      "",
    );
    expect(result).toEqual({ ok: false, error: "auth_error_country_required" });
  });

  it("accepts strong passwords from password managers", () => {
    const result = validateAuthSignupInput(
      { email: "a@b.com", password: "Xk9-mPq2-Rn4v", name: "" },
      true,
      t,
      "AL",
    );
    expect(result).toEqual({ ok: true });
  });
});

describe("resolveAuthRecaptchaToken", () => {
  it("uses primed token first", async () => {
    const token = await resolveAuthRecaptchaToken({
      enabled: true,
      siteKey: "site",
      action: "register",
      primed: Promise.resolve("primed-token"),
      getToken: async () => "slow-token",
    });
    expect(token).toBe("primed-token");
  });

  it("falls back to getToken when quick execute fails", async () => {
    const token = await resolveAuthRecaptchaToken({
      enabled: true,
      siteKey: "fail-quick",
      action: "register",
      primed: null,
      getToken: async () => "slow-token",
    });
    expect(token).toBe("slow-token");
  });

  it("returns undefined when disabled", async () => {
    const token = await resolveAuthRecaptchaToken({
      enabled: false,
      siteKey: "site",
      action: "register",
      primed: Promise.resolve("x"),
      getToken: async () => "y",
    });
    expect(token).toBeUndefined();
  });
});
