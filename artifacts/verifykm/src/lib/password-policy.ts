export const PASSWORD_MIN_LENGTH = 6;

export type PasswordRequirementId = "length" | "letter" | "number";

export type PasswordCheck = {
  id: PasswordRequirementId;
  met: boolean;
};

export type PasswordStrength = 0 | 1 | 2 | 3;

export function getPasswordChecks(pw: string): PasswordCheck[] {
  return [
    { id: "length", met: pw.length >= PASSWORD_MIN_LENGTH },
    { id: "letter", met: /[A-Za-z]/.test(pw) },
    { id: "number", met: /[0-9]/.test(pw) },
  ];
}

export function getPasswordStrength(pw: string): PasswordStrength {
  if (!pw) return 0;
  const met = getPasswordChecks(pw).filter((c) => c.met).length;
  return Math.min(3, met) as PasswordStrength;
}

/** Minimum bar for registration / password set: 6+ chars, one letter, one digit. */
export function isPasswordStrongEnough(pw: string): boolean {
  return getPasswordChecks(pw).every((c) => c.met);
}

export type PasswordIssueCode =
  | "PASSWORD_TOO_SHORT"
  | "PASSWORD_NEEDS_LETTER"
  | "PASSWORD_NEEDS_NUMBER";

export function getPasswordIssueCode(pw: string): PasswordIssueCode | null {
  const checks = getPasswordChecks(pw);
  const missing = checks.find((c) => !c.met);
  if (!missing) return null;
  if (missing.id === "length") return "PASSWORD_TOO_SHORT";
  if (missing.id === "letter") return "PASSWORD_NEEDS_LETTER";
  return "PASSWORD_NEEDS_NUMBER";
}

export function getPasswordErrorMessage(t: (key: string) => string, password: string): string {
  const code = getPasswordIssueCode(password);
  if (code === "PASSWORD_TOO_SHORT") return t("reset_password_too_short");
  if (code === "PASSWORD_NEEDS_LETTER") return t("error_password_needs_letter");
  if (code === "PASSWORD_NEEDS_NUMBER") return t("error_password_needs_number");
  return t("error_password_weak");
}
