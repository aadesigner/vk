/** SMTP transport security modes for nodemailer. */
export type SmtpSecurityLevel = "starttls" | "ssl" | "none";

const VALID_LEVELS = new Set<SmtpSecurityLevel>(["starttls", "ssl", "none"]);

export function normalizeSmtpSecurity(
  raw: unknown,
  port?: number | null,
): SmtpSecurityLevel {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "ssl" || s === "tls" || s === "smtps") return "ssl";
  if (s === "none" || s === "plain") return "none";
  if (s === "starttls" || s === "tls-start") return "starttls";
  if (port === 465) return "ssl";
  return "starttls";
}

export function isValidSmtpSecurity(raw: unknown): raw is SmtpSecurityLevel {
  return VALID_LEVELS.has(String(raw ?? "").trim().toLowerCase() as SmtpSecurityLevel);
}

export type SmtpTransportSecurity = {
  secure: boolean;
  requireTLS?: boolean;
};

/** Map admin security level to nodemailer transport flags. */
export function smtpTransportSecurity(
  level: SmtpSecurityLevel,
): SmtpTransportSecurity {
  switch (level) {
    case "ssl":
      return { secure: true };
    case "none":
      return { secure: false, requireTLS: false };
    case "starttls":
    default:
      return { secure: false, requireTLS: true };
  }
}
