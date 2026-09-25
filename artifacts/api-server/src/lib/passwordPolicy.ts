export const PASSWORD_MIN_LENGTH = 6;

export type PasswordValidationResult =
  | { ok: true }
  | { ok: false; code: string; error: string };

export function validatePassword(password: string): PasswordValidationResult {
  if (!password || typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      code: "PASSWORD_TOO_SHORT",
      error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    };
  }
  if (!/[A-Za-z]/.test(password)) {
    return {
      ok: false,
      code: "PASSWORD_NEEDS_LETTER",
      error: "Password must include a letter",
    };
  }
  if (!/[0-9]/.test(password)) {
    return {
      ok: false,
      code: "PASSWORD_NEEDS_NUMBER",
      error: "Password must include a number",
    };
  }
  return { ok: true };
}
