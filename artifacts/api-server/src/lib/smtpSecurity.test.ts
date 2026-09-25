import { describe, expect, it } from "vitest";
import { normalizeSmtpSecurity, smtpTransportSecurity } from "./smtpSecurity.js";

describe("smtpSecurity", () => {
  it("defaults to STARTTLS", () => {
    expect(normalizeSmtpSecurity(null)).toBe("starttls");
    expect(normalizeSmtpSecurity(undefined, 587)).toBe("starttls");
  });

  it("infers SSL from port 465 when unset", () => {
    expect(normalizeSmtpSecurity(null, 465)).toBe("ssl");
  });

  it("maps levels to nodemailer options", () => {
    expect(smtpTransportSecurity("ssl")).toEqual({ secure: true });
    expect(smtpTransportSecurity("starttls")).toEqual({ secure: false, requireTLS: true });
    expect(smtpTransportSecurity("none")).toEqual({ secure: false, requireTLS: false });
  });
});
