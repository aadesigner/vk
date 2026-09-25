/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { readAuthFieldValue } from "./auth-form-values";

describe("readAuthFieldValue", () => {
  it("reads named input from a form", () => {
    const form = document.createElement("form");
    const email = document.createElement("input");
    email.name = "email";
    email.value = "user@example.com";
    form.appendChild(email);

    expect(readAuthFieldValue(form, "email", "")).toBe("user@example.com");
  });

  it("falls back when the field is missing", () => {
    const form = document.createElement("form");
    expect(readAuthFieldValue(form, "password", "fallback")).toBe("fallback");
  });
});
