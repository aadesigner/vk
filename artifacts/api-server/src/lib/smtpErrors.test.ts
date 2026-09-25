import { describe, it, expect } from "vitest";
import { formatSmtpConfigError, formatSmtpTransportError } from "./smtpErrors.js";

describe("smtpErrors", () => {
  it("maps missing password to a helpful hint", () => {
    const out = formatSmtpConfigError("pass");
    expect(out.error).toMatch(/password/i);
    expect(out.hint).toBeTruthy();
    expect(out.code).toBe("SMTP_PASS_MISSING");
  });

  it("maps auth failures", () => {
    const out = formatSmtpTransportError(Object.assign(new Error("Invalid login: 535"), { code: "EAUTH" }));
    expect(out.code).toBe("SMTP_AUTH");
    expect(out.hint).toMatch(/app password/i);
  });

  it("maps TLS/security mismatch", () => {
    const out = formatSmtpTransportError(new Error("wrong version number"));
    expect(out.code).toBe("SMTP_SECURITY_MISMATCH");
  });
});
