import type { SystemSettings } from "@workspace/db";

function trimmed(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export function isGoogleOAuthConfigured(settings: SystemSettings | null | undefined): boolean {
  if (!settings || settings.googleLoginEnabled === false) return false;
  return !!trimmed(settings.googleClientId) && !!trimmed(settings.googleClientSecret);
}

export function isFacebookOAuthConfigured(settings: SystemSettings | null | undefined): boolean {
  if (!settings || settings.facebookLoginEnabled === false) return false;
  return !!trimmed(settings.facebookAppId) && !!trimmed(settings.facebookAppSecret);
}

/** Inherit missing OAuth / payment credentials from an older settings row. */
export function mergeMissingCredentials(
  target: SystemSettings,
  donor: SystemSettings,
): SystemSettings {
  const pick = (current: string | null | undefined, fallback: string | null | undefined): string | null => {
    const value = trimmed(current) || trimmed(fallback);
    return value || null;
  };

  return {
    ...target,
    paypalClientId: pick(target.paypalClientId, donor.paypalClientId),
    paypalClientSecret: pick(target.paypalClientSecret, donor.paypalClientSecret),
    pokMerchantId: pick(
      (target as SystemSettings & { pokMerchantId?: string | null }).pokMerchantId,
      (donor as SystemSettings & { pokMerchantId?: string | null }).pokMerchantId,
    ),
    pokKeyId: pick(
      (target as SystemSettings & { pokKeyId?: string | null }).pokKeyId,
      (donor as SystemSettings & { pokKeyId?: string | null }).pokKeyId,
    ),
    pokKeySecret: pick(
      (target as SystemSettings & { pokKeySecret?: string | null }).pokKeySecret,
      (donor as SystemSettings & { pokKeySecret?: string | null }).pokKeySecret,
    ),
    googleClientId: pick(target.googleClientId, donor.googleClientId),
    googleClientSecret: pick(target.googleClientSecret, donor.googleClientSecret),
    facebookAppId: pick(target.facebookAppId, donor.facebookAppId),
    facebookAppSecret: pick(target.facebookAppSecret, donor.facebookAppSecret),
    recaptchaSecretKey: pick(target.recaptchaSecretKey, donor.recaptchaSecretKey),
    smtpPass: pick(target.smtpPass, donor.smtpPass),
    paypalSandbox: target.paypalSandbox ?? donor.paypalSandbox,
    paypalEnableCards: target.paypalEnableCards ?? donor.paypalEnableCards,
    pokEnv:
      (target as SystemSettings & { pokEnv?: string | null }).pokEnv
      ?? (donor as SystemSettings & { pokEnv?: string | null }).pokEnv
      ?? "production",
  };
}
