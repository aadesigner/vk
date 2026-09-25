import type { systemSettingsTable } from "@workspace/db";
import {
  isFacebookOAuthConfigured,
  isGoogleOAuthConfigured,
} from "./oauthSettings.js";

type SettingsRow = typeof systemSettingsTable.$inferSelect;

/** Strip secret fields from settings rows before sending to the admin UI. */
export function sanitizeAdminSettings(settings: SettingsRow) {
  const {
    paypalClientSecret,
    recaptchaSecretKey,
    googleClientSecret,
    facebookAppSecret,
    linkedinClientSecret: _linkedinClientSecret,
    smtpPass,
    pokKeySecret,
    ...safe
  } = settings as SettingsRow & { pokKeySecret?: string | null };
  return {
    ...safe,
    getcarApiEnabled: (settings as SettingsRow & { getcarApiEnabled?: boolean }).getcarApiEnabled ?? true,
    getcarApiKeyConfigured: !!process.env["GETCARAPI_API_KEY"]?.trim(),
    hasPaypalSecret: !!paypalClientSecret?.trim(),
    hasRecaptchaSecret: !!recaptchaSecretKey?.trim(),
    hasGoogleSecret: !!googleClientSecret?.trim(),
    hasFacebookSecret: !!facebookAppSecret?.trim(),
    hasSmtpPass: !!smtpPass?.trim(),
    hasPokSecret: !!pokKeySecret?.trim(),
    googleButtonVisible: isGoogleOAuthConfigured(settings),
    facebookButtonVisible: isFacebookOAuthConfigured(settings),
  };
}
