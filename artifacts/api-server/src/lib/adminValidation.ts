const INT = (value: unknown, min: number, max: number, label: string): string | null => {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) {
    return `${label} must be an integer between ${min} and ${max}`;
  }
  return null;
};

const FLOAT = (value: unknown, min: number, max: number, label: string): string | null => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    return `${label} must be between ${min} and ${max}`;
  }
  return null;
};

const SECURITY_BOUNDS: Record<string, { kind: "int" | "float"; min: number; max: number; label: string }> = {
  maxFailedLogins: { kind: "int", min: 1, max: 100, label: "maxFailedLogins" },
  lockoutMinutes: { kind: "int", min: 1, max: 1440, label: "lockoutMinutes" },
  adminMaxFailedLogins: { kind: "int", min: 1, max: 100, label: "adminMaxFailedLogins" },
  adminLockoutMinutes: { kind: "int", min: 1, max: 1440, label: "adminLockoutMinutes" },
  registerMaxPerHour: { kind: "int", min: 0, max: 1000, label: "registerMaxPerHour" },
  vinRatePerMinute: { kind: "int", min: 0, max: 1000, label: "vinRatePerMinute" },
  recaptchaMinScore: { kind: "float", min: 0, max: 1, label: "recaptchaMinScore" },
  rateLimit: { kind: "int", min: 0, max: 1000, label: "rateLimit" },
  rateLimitWindow: { kind: "int", min: 10, max: 3600, label: "rateLimitWindow" },
  maxVinsPerDay: { kind: "int", min: 0, max: 10_000, label: "maxVinsPerDay" },
  freeVinDecoderDailyLimit: { kind: "int", min: 0, max: 10_000, label: "freeVinDecoderDailyLimit" },
  sessionDays: { kind: "int", min: 14, max: 365, label: "sessionDays" },
  logRetentionDays: { kind: "int", min: 0, max: 3650, label: "logRetentionDays" },
  failedTxnRetentionDays: { kind: "int", min: 0, max: 3650, label: "failedTxnRetentionDays" },
  smtpPort: { kind: "int", min: 1, max: 65535, label: "smtpPort" },
  krwPerUsd: { kind: "float", min: 1, max: 100_000, label: "krwPerUsd" },
};

export function validateBoundedSettingsPatch(patch: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(patch)) {
    const bounds = SECURITY_BOUNDS[key];
    if (!bounds || value === undefined) continue;
    const err = bounds.kind === "int"
      ? INT(value, bounds.min, bounds.max, bounds.label)
      : FLOAT(value, bounds.min, bounds.max, bounds.label);
    if (err) return err;
  }
  return null;
}

export function validateSmtpSecurity(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim().toLowerCase();
  if (s === "starttls" || s === "ssl" || s === "none") return null;
  return "smtpSecurity must be starttls, ssl, or none";
}

const ALLOWED_LINK_SCHEMES = new Set(["https:", "http:"]);

export function validateAnnouncementLinkUrl(raw: string | null | undefined): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw == null || raw === "") return { ok: true, value: null };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "linkUrl must be a valid absolute URL" };
  }
  if (!ALLOWED_LINK_SCHEMES.has(parsed.protocol)) {
    return { ok: false, error: "linkUrl must use http or https" };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: "linkUrl must not include credentials" };
  }
  return { ok: true, value: trimmed };
}
