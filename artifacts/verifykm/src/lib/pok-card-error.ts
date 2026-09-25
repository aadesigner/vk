import type { PaymentErrorResponse } from "@nebula-ltd/pok-payments-js";

/**
 * Map POK SDK card errors → our i18n keys only.
 * Never forward raw SDK messages (may contain internal / partner details).
 */
export function pokCardErrorI18nKey(error: PaymentErrorResponse | null | undefined): string {
  switch (error?.type) {
    case "VALIDATION_ERROR":
    case "FORM_ERROR":
      return "checkout_error_card_validation";
    case "GENERAL_ERROR":
      return "checkout_error_card_failed";
    default:
      return "checkout_error_card_failed";
  }
}
