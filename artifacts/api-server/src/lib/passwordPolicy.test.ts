import { describe, expect, it } from "vitest";
import { validatePassword } from "./passwordPolicy.js";

describe("validatePassword", () => {
  it("rejects short passwords", () => {
    const r = validatePassword("ab1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("PASSWORD_TOO_SHORT");
  });

  it("rejects missing letter", () => {
    const r = validatePassword("123456");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("PASSWORD_NEEDS_LETTER");
  });

  it("rejects missing number", () => {
    const r = validatePassword("abcdef");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("PASSWORD_NEEDS_NUMBER");
  });

  it("accepts strong enough passwords", () => {
    expect(validatePassword("pass12").ok).toBe(true);
    expect(validatePassword("ABC123").ok).toBe(true);
    expect(validatePassword("hello9").ok).toBe(true);
  });
});
