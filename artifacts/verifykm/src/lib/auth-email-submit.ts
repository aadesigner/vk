import { resolveRecaptchaToken } from "@/hooks/use-recaptcha";
import { readAuthFieldValue } from "@/lib/auth-form-values";
import { getPasswordErrorMessage, isPasswordStrongEnough } from "@/lib/password-policy";

export type AuthCredentials = {
  email: string;
  password: string;
  name: string;
};

export function readAuthCredentials(
  form: HTMLFormElement,
  fallbacks: AuthCredentials,
): AuthCredentials {
  return {
    email: readAuthFieldValue(form, "email", fallbacks.email).trim(),
    password: readAuthFieldValue(form, "password", fallbacks.password),
    name: readAuthFieldValue(form, "name", fallbacks.name).trim(),
  };
}

export function validateAuthSignupInput(
  creds: AuthCredentials,
  acceptedTerms: boolean,
  t: (key: string) => string,
  countryCode?: string,
): { ok: true } | { ok: false; error: string } {
  if (!acceptedTerms) {
    return { ok: false, error: t("auth_error_terms_required") };
  }
  if (!countryCode?.trim()) {
    return { ok: false, error: t("auth_error_country_required") };
  }
  if (!isPasswordStrongEnough(creds.password)) {
    return { ok: false, error: getPasswordErrorMessage(t, creds.password) };
  }
  return { ok: true };
}

/** Resolve a reCAPTCHA token: primed gesture token → quick execute → full wait/load path. */
export async function resolveAuthRecaptchaToken(opts: {
  enabled: boolean;
  siteKey: string | null;
  action: string;
  primed: Promise<string | null> | null;
  getToken: (action: string) => Promise<string | null>;
}): Promise<string | undefined> {
  const token = await resolveRecaptchaToken(opts);
  return token ?? undefined;
}
