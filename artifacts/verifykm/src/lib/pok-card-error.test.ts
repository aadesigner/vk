import { describe, expect, it } from "vitest";
import { pokCardErrorI18nKey } from "./pok-card-error";

describe("pokCardErrorI18nKey", () => {
  it("maps validation / form to check-details copy", () => {
    expect(pokCardErrorI18nKey({ type: "VALIDATION_ERROR", message: "secret stack" }))
      .toBe("checkout_error_card_validation");
    expect(pokCardErrorI18nKey({ type: "FORM_ERROR", message: "http://pok.internal/x" }))
      .toBe("checkout_error_card_validation");
  });

  it("maps general / unknown to safe failed copy (never uses raw message)", () => {
    expect(pokCardErrorI18nKey({ type: "GENERAL_ERROR", message: "Failed to process card, wrong" }))
      .toBe("checkout_error_card_failed");
    expect(pokCardErrorI18nKey({ message: "anything technical" }))
      .toBe("checkout_error_card_failed");
    expect(pokCardErrorI18nKey(undefined)).toBe("checkout_error_card_failed");
  });
});
