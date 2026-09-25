import { describe, expect, it } from "vitest";
import {
  getPasswordChecks,
  getPasswordStrength,
  isPasswordStrongEnough,
  getPasswordIssueCode,
} from "./password-policy";

describe("password-policy", () => {
  it("rejects passwords missing requirements", () => {
    expect(isPasswordStrongEnough("pass")).toBe(false);
    expect(isPasswordStrongEnough("123456")).toBe(false);
    expect(isPasswordStrongEnough("abcde")).toBe(false);
  });

  it("accepts passwords meeting policy", () => {
    expect(isPasswordStrongEnough("pass12")).toBe(true);
    expect(isPasswordStrongEnough("ABC123")).toBe(true);
    expect(isPasswordStrongEnough("hello9")).toBe(true);
  });

  it("reports the first missing requirement", () => {
    expect(getPasswordIssueCode("abc")).toBe("PASSWORD_TOO_SHORT");
    expect(getPasswordIssueCode("123456")).toBe("PASSWORD_NEEDS_LETTER");
    expect(getPasswordIssueCode("abcdef")).toBe("PASSWORD_NEEDS_NUMBER");
    expect(getPasswordIssueCode("pass12")).toBe(null);
  });

  it("scores strength by met requirement count", () => {
    expect(getPasswordStrength("")).toBe(0);
    expect(getPasswordStrength("abc")).toBe(1);
    expect(getPasswordStrength("abcdef")).toBe(2);
    expect(getPasswordStrength("pass12")).toBe(3);
  });

  it("tracks individual checks", () => {
    const checks = getPasswordChecks("ab1");
    expect(checks.find((c) => c.id === "length")?.met).toBe(false);
    expect(checks.find((c) => c.id === "letter")?.met).toBe(true);
    expect(checks.find((c) => c.id === "number")?.met).toBe(true);
  });
});
