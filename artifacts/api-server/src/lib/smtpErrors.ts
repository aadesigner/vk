/** Turn nodemailer / Node network errors into admin-friendly SMTP messages. */

export type SmtpErrorDetail = {
  error: string;
  hint?: string;
  code?: string;
};

function lower(msg: string): string {
  return msg.toLowerCase();
}

export function formatSmtpConfigError(reason: "disabled" | "host" | "user" | "pass"): SmtpErrorDetail {
  switch (reason) {
    case "disabled":
      return {
        error: "SMTP is disabled.",
        hint: "Turn on “Enable SMTP” in settings, then test again.",
        code: "SMTP_DISABLED",
      };
    case "host":
      return {
        error: "SMTP host is missing.",
        hint: "Enter your mail server hostname (e.g. smtp.gmail.com, smtp.office365.com).",
        code: "SMTP_HOST_MISSING",
      };
    case "user":
      return {
        error: "SMTP username is missing.",
        hint: "Enter the mailbox username or email address used to authenticate.",
        code: "SMTP_USER_MISSING",
      };
    case "pass":
      return {
        error: "SMTP password is missing.",
        hint: "Enter the SMTP password or app password. If you already saved one, leave the field blank and test again — otherwise type it before testing.",
        code: "SMTP_PASS_MISSING",
      };
  }
}

export function formatSmtpTransportError(err: unknown): SmtpErrorDetail {
  const raw = err instanceof Error ? err.message : String(err);
  const msg = lower(raw);
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: unknown }).code ?? "")
      : undefined;

  if (msg.includes("column") && msg.includes("does not exist")) {
    return {
      error: "Database schema is out of date for email settings.",
      hint: "Redeploy/restart the API server so schema patches run, then try again.",
      code: "DB_SCHEMA",
    };
  }

  if (
    code === "EAUTH"
    || msg.includes("invalid login")
    || msg.includes("authentication failed")
    || msg.includes("username and password not accepted")
    || msg.includes("bad credentials")
  ) {
    return {
      error: "SMTP authentication failed.",
      hint: "Check the username and password. For Gmail/Outlook, use an app password — not your normal login password.",
      code: "SMTP_AUTH",
    };
  }

  if (
    msg.includes("self signed certificate")
    || msg.includes("unable to verify the first certificate")
    || msg.includes("certificate")
      && (msg.includes("verify") || msg.includes("trust"))
  ) {
    return {
      error: "SMTP TLS certificate could not be verified.",
      hint: "If your mail server uses a self-signed certificate, set SMTP_INSECURE=true on the API server (Railway variables). Prefer a provider with a valid TLS cert when possible.",
      code: "SMTP_TLS_CERT",
    };
  }

  if (
    msg.includes("wrong version number")
    || msg.includes("ssl routines")
    || msg.includes("does not support starttls")
    || msg.includes("must issue a starttls")
  ) {
    return {
      error: "SMTP security mode does not match this server.",
      hint: "Try a different security setting: port 587 → STARTTLS, port 465 → SSL/TLS. Port 25 or plain relay → None.",
      code: "SMTP_SECURITY_MISMATCH",
    };
  }

  if (
    code === "ECONNREFUSED"
    || code === "ENOTFOUND"
    || code === "EHOSTUNREACH"
    || msg.includes("getaddrinfo")
    || msg.includes("connection refused")
  ) {
    return {
      error: "Could not connect to the SMTP server.",
      hint: "Check the host name, port, and that your hosting provider allows outbound SMTP (some block port 25/587).",
      code: "SMTP_CONNECT",
    };
  }

  if (
    code === "ETIMEDOUT"
    || code === "ESOCKET"
    || msg.includes("timeout")
    || msg.includes("greeting never received")
    || msg.includes("connection closed")
  ) {
    return {
      error: "SMTP connection timed out.",
      hint: "The server did not respond in time. Verify host/port, firewall rules, and try SSL on port 465 if STARTTLS on 587 fails.",
      code: "SMTP_TIMEOUT",
    };
  }

  if (msg.includes("recipient") && msg.includes("rejected")) {
    return {
      error: "The mail server rejected the recipient address.",
      hint: "Use a valid inbox address for the test. Some SMTP relays only allow sending to verified domains.",
      code: "SMTP_RECIPIENT",
    };
  }

  return {
    error: raw || "Unknown SMTP error.",
    hint: "Double-check host, port, security mode, username, and password. See API logs for the full error if this persists.",
    code: code || "SMTP_UNKNOWN",
  };
}
