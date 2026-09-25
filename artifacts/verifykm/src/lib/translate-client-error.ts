type TFn = (key: string) => string;

function matchError(error: string | undefined, patterns: RegExp[]): boolean {
  if (!error) return false;
  return patterns.some((p) => p.test(error));
}

/** API `code` values → i18n keys (covers server codes regardless of casing). */
const ERROR_CODE_KEYS: Record<string, string> = {
  RATE_LIMIT: "error_rate_limit",
  banned: "auth_error_banned",
  BANNED: "auth_error_banned",
  MAINTENANCE: "maintenance_body",
  VIN_LOOKUP_DISABLED: "maintenance_feature_vin_reports",
  VIN_NO_DATA: "vin_not_in_db",
  VIN_CHECK_UNAVAILABLE: "checkout_check_unavailable_desc",
  PROVIDER_UNAVAILABLE: "checkout_check_unavailable_desc",
  PROVIDER_NOT_CONFIGURED: "checkout_check_unavailable_desc",
  PROVIDER_RATE_LIMIT: "error_rate_limit",
  NO_PROVIDER: "checkout_check_unavailable_desc",
  SIGN_IN_REQUIRED: "free_decoder_register_required",
  RECAPTCHA_FAILED: "error_recaptcha_failed",
  RECAPTCHA_REQUIRED: "error_recaptcha_failed",
  PAYMENT_REQUIRED: "checkout_error_payment_fetch",
  PAYMENT_NOT_FOUND: "checkout_error_payment_create",
  PAYMENT_NOT_COMPLETED: "checkout_error_payment_failed",
  PAYMENT_AMOUNT_MISMATCH: "checkout_error_payment_failed",
  PAYMENT_CAPTURE_FAILED: "checkout_error_capture",
  PAYMENT_CONFIRM_FAILED: "checkout_error_capture",
  PAYMENT_NOT_CONFIGURED: "checkout_payment_not_configured",
  POK_CREATE_FAILED: "checkout_error_payment_create",
  POK_CREATE_TIMEOUT: "checkout_error_payment_create",
  POK_NOT_CONFIGURED: "checkout_payment_not_configured",
  COUPON_LIMIT: "checkout_error_coupon_inactive",
  INVALID_AMOUNT: "checkout_error_payment_create",
  USE_PAYPAL_FREE_PATH: "checkout_error_payment_create",
  INVALID_ORDER_ID: "checkout_error_payment_create",
  VIN_MISMATCH: "checkout_error_payment_create",
  VIN_INVALID: "vin_error_invalid_chars",
  INVALID_VIN: "vin_error_length",
  ALREADY_UNLOCKED: "checkout_already_unlocked",
  INSUFFICIENT_CREDITS: "checkout_insufficient_credits",
  PASSWORD_TOO_SHORT: "reset_password_too_short",
  PASSWORD_NEEDS_LETTER: "error_password_needs_letter",
  PASSWORD_NEEDS_LOWERCASE: "error_password_needs_letter",
  PASSWORD_NEEDS_UPPERCASE: "error_password_needs_letter",
  PASSWORD_NEEDS_NUMBER: "error_password_needs_number",
  PASSWORD_ALREADY_SET: "error_password_already_set",
  UNAUTHORIZED: "report_sign_in_required",
  FORBIDDEN: "report_access_denied",
  NOT_FOUND: "report_not_found",
};

function translateByCode(t: TFn, code?: string): string | null {
  if (!code) return null;
  const key = ERROR_CODE_KEYS[code] ?? ERROR_CODE_KEYS[code.toUpperCase()];
  if (!key) return null;
  const msg = t(key);
  return msg !== key ? msg : null;
}

function isInternalErrorMessage(error: string): boolean {
  return /internal server error|unexpected error|econnrefused|etimedout|socket hang up/i.test(error);
}

/** Provider/stack traces, merchant paths, and raw HTTP payloads must never reach the UI. */
function isUnsafeClientErrorMessage(error: string): boolean {
  if (isInternalErrorMessage(error)) return true;
  if (error.length > 160) return true;
  return /[{}<>]|https?:\/\/|\/merchants\/|sdk-orders|csAuthentication|access[_-]?token|keySecret|keyId|Bearer\s|pokpay|statusCode|stack|at \w+\s*\(|ECONN|ENOTFOUND|postgres|drizzle/i.test(
    error,
  );
}

/** Maps API / PayPal English error strings and codes to i18n keys for all client pages. */
export function translateClientError(t: TFn, code?: string, error?: string): string {
  const fromCode = translateByCode(t, code);
  if (fromCode) return fromCode;

  if (code === "RATE_LIMIT" || matchError(error, [/too many requests/i, /rate limit/i])) {
    return t("error_rate_limit");
  }
  if (matchError(error, [/failed to fetch/i, /networkerror/i, /network error/i, /load failed/i])) {
    return t("error_network");
  }
  if (matchError(error, [/internal server error/i])) {
    return t("error_server_busy");
  }
  if (matchError(error, [/vin not found/i, /no vehicle history data found/i, /no history data/i])) {
    return t("vin_not_in_db");
  }
  if (matchError(error, [/no active vin data provider/i, /no active vin provider/i])) {
    return t("checkout_check_unavailable_desc");
  }
  if (matchError(error, [/coupon has expired/i, /coupon.*expired/i])) {
    return t("checkout_error_coupon_inactive");
  }
  if (matchError(error, [/invalid or inactive coupon/i])) {
    return t("checkout_error_coupon_inactive");
  }
  if (matchError(error, [/invalid coupon code format/i, /^invalid coupon$/i])) {
    return t("checkout_error_invalid_coupon");
  }
  if (matchError(error, [/coupon usage limit reached/i])) {
    return t("checkout_error_coupon_inactive");
  }
  if (matchError(error, [/too many coupon attempts/i])) {
    return t("checkout_error_coupon_rate_limit");
  }
  if (matchError(error, [/payment required/i, /valid payment required/i])) {
    return t("checkout_error_payment_fetch");
  }
  if (matchError(error, [/payment not found/i])) {
    return t("checkout_error_payment_create");
  }
  if (matchError(error, [/payment was not completed/i])) {
    return t("checkout_error_payment_failed");
  }
  if (matchError(error, [/failed to capture payment/i, /payment capture failed/i])) {
    return t("checkout_error_capture");
  }
  if (matchError(error, [/payment is for a different vin/i])) {
    return t("checkout_error_payment_create");
  }
  if (matchError(error, [/failed validation for manual report/i])) {
    return t("vin_error_invalid_chars");
  }
  if (matchError(error, [/already have access/i])) {
    return t("checkout_already_unlocked");
  }
  if (matchError(error, [/failed to create payment/i, /failed to create card payment/i, /order creation failed/i, /failed to create order/i])) {
    return t("checkout_error_payment_create");
  }
  if (matchError(error, [/failed to fetch vin data/i])) {
    return t("checkout_error_payment_fetch");
  }
  if (matchError(error, [/payment system not configured/i])) {
    return t("checkout_payment_not_configured");
  }
  if (matchError(error, [/paypal failed to load/i])) {
    return t("checkout_error_paypal_load");
  }
  if (matchError(error, [/payment failed/i])) {
    return t("checkout_error_payment_failed");
  }
  if (matchError(error, [/card fields not ready/i])) {
    return t("checkout_error_card_not_ready");
  }
  if (matchError(error, [/card declined/i])) {
    return t("checkout_error_card_declined");
  }
  if (matchError(error, [/card payment failed/i])) {
    return t("checkout_error_card_failed");
  }
  if (matchError(error, [/sign in required/i, /^unauthorized$/i])) {
    return t("free_decoder_register_required");
  }
  if (matchError(error, [/invalid vin/i, /vin must be exactly 17/i])) {
    return t("vin_error_length");
  }
  if (matchError(error, [/too many password reset/i])) {
    return t("error_forgot_rate_limit");
  }
  if (matchError(error, [/security verification required/i, /security check failed/i, /recaptcha/i])) {
    return t("error_recaptcha_failed");
  }
  if (matchError(error, [/invalid email or password/i])) {
    return t("auth_error_invalid_credentials");
  }
  if (matchError(error, [/too many failed login attempts/i, /too many login attempts/i])) {
    return t("auth_error_login_lockout");
  }
  if (matchError(error, [/account has been suspended/i, /account suspended/i])) {
    return t("auth_error_banned");
  }
  if (matchError(error, [/at least 6 characters/i, /at least 8 characters/i])) {
    return t("reset_password_too_short");
  }
  if (matchError(error, [/include a letter/i, /lowercase letter/i, /uppercase letter/i])) {
    return t("error_password_needs_letter");
  }
  if (matchError(error, [/include a number/i])) {
    return t("error_password_needs_number");
  }
  if (matchError(error, [/password is already set/i])) {
    return t("error_password_already_set");
  }
  if (matchError(error, [/daily limit.*free decodes/i])) {
    return t("free_decoder_daily_limit");
  }
  if (matchError(error, [/free vin decoder is currently disabled/i])) {
    return t("free_decoder_disabled");
  }
  if (matchError(error, [/account with this email already exists/i, /email already exists/i])) {
    return t("auth_error_email_exists");
  }
  if (matchError(error, [/failed to create account/i])) {
    return t("auth_error_signup_failed");
  }
  if (matchError(error, [/vin lookup not found/i, /^not found$/i])) {
    return t("report_not_found");
  }
  if (matchError(error, [/access to this report has been revoked/i, /report has been revoked/i])) {
    return t("report_access_denied");
  }
  if (matchError(error, [/^forbidden$/i])) {
    return t("report_access_denied");
  }
  if (matchError(error, [/maintenance/i, /temporarily unavailable/i])) {
    return t("maintenance_body");
  }

  if (error && !isUnsafeClientErrorMessage(error)) {
    return error;
  }

  return t("error_request_failed");
}

export function translateCouponError(t: TFn, error?: string): string {
  if (!error) return t("checkout_error_invalid_coupon");
  return translateClientError(t, undefined, error);
}

export function translateAuthOAuthError(t: TFn, oauthError: string | null): string {
  if (!oauthError) return "";
  const key = `auth_error_${oauthError}`;
  const translated = t(key);
  return translated !== key ? translated : t("auth_error_signin_failed");
}
