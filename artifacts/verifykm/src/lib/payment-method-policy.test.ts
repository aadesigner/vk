/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { isPaypalHiddenForCheckout } from "./payment-method-policy";

describe("isPaypalHiddenForCheckout", () => {
  it("hides PayPal for German UI language regardless of country", () => {
    expect(isPaypalHiddenForCheckout({ language: "de", countryCode: null })).toBe(true);
    expect(isPaypalHiddenForCheckout({ language: "de", countryCode: "US" })).toBe(true);
    expect(isPaypalHiddenForCheckout({ language: "DE", countryCode: null })).toBe(true);
  });

  it("hides PayPal for restricted profile countries on non-German language", () => {
    for (const country of ["DE", "AT", "IT", "GR", "FR", "MK", "de", "it", "mk"]) {
      expect(
        isPaypalHiddenForCheckout({ language: "en", countryCode: country }),
        country,
      ).toBe(true);
    }
  });

  it("shows PayPal for other languages without a restricted country", () => {
    expect(isPaypalHiddenForCheckout({ language: "en", countryCode: null })).toBe(false);
    expect(isPaypalHiddenForCheckout({ language: "en", countryCode: "US" })).toBe(false);
    expect(isPaypalHiddenForCheckout({ language: "fr", countryCode: null })).toBe(false);
    expect(isPaypalHiddenForCheckout({ language: "fr", countryCode: "US" })).toBe(false);
    expect(isPaypalHiddenForCheckout({ language: "sq", countryCode: "AL" })).toBe(false);
  });

  it("hides PayPal for French language only when country is restricted (not by language alone)", () => {
    expect(isPaypalHiddenForCheckout({ language: "fr", countryCode: "FR" })).toBe(true);
    expect(isPaypalHiddenForCheckout({ language: "fr", countryCode: null })).toBe(false);
  });
});
