import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHECKOUT_PREFILL_ONLY_KEY,
  CHECKOUT_VIN_KEY,
  PAYPAL_CHECKOUT_SESSION_KEY,
  PENDING_VIN_KEY,
  REFERRAL_VIN_KEY,
  clearCheckoutPaymentResumeState,
  clearStoredPendingVin,
  consumeCheckoutPrefillOnly,
  getPostAuthCheckoutPath,
  guestVinAuthPath,
  markCheckoutPrefillOnly,
  markPaypalCheckoutAwaitingApproval,
  markPaypalCheckoutCapturePending,
  persistVinForCheckout,
  readPaypalCheckoutSession,
  resolveCheckoutPrefillVin,
  shouldResumePaypalCapture,
} from "./checkout-vin-flow";

describe("getPostAuthCheckoutPath", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("redirects to checkout with VIN and marks prefill-only landing", () => {
    sessionStorage.setItem(PENDING_VIN_KEY, "1HGBH41JXMN109186");
    sessionStorage.setItem(PAYPAL_CHECKOUT_SESSION_KEY, JSON.stringify({ orderId: "ABC12345", vin: "1HGBH41JXMN109186" }));

    expect(getPostAuthCheckoutPath("en")).toBe("/en/checkout?vin=1HGBH41JXMN109186");
    expect(sessionStorage.getItem(PENDING_VIN_KEY)).toBeNull();
    expect(sessionStorage.getItem(CHECKOUT_VIN_KEY)).toBe("1HGBH41JXMN109186");
    expect(sessionStorage.getItem(PAYPAL_CHECKOUT_SESSION_KEY)).toBeNull();
    expect(sessionStorage.getItem(CHECKOUT_PREFILL_ONLY_KEY)).toBe("1");
  });

  it("uses stored checkout VIN when pending is absent", () => {
    sessionStorage.setItem(CHECKOUT_VIN_KEY, "WBA3A5G59DNP26082");

    expect(getPostAuthCheckoutPath("de")).toBe("/de/checkout?vin=WBA3A5G59DNP26082");
    expect(sessionStorage.getItem(CHECKOUT_PREFILL_ONLY_KEY)).toBe("1");
  });

  it("returns null when no VIN is waiting", () => {
    expect(getPostAuthCheckoutPath("en")).toBeNull();
    expect(sessionStorage.getItem(CHECKOUT_PREFILL_ONLY_KEY)).toBeNull();
  });
});

describe("guestVinAuthPath", () => {
  it("includes vin query for valid 17-char VINs", () => {
    expect(guestVinAuthPath("sq", "lvypsakvdlp082054")).toContain("vin=LVYPSAKVDLP082054");
    expect(guestVinAuthPath("sq", "lvypsakvdlp082054").startsWith("/sq/sign-up?")).toBe(true);
  });

  it("omits vin query when missing or invalid", () => {
    expect(guestVinAuthPath("en")).toBe("/en/sign-up");
    expect(guestVinAuthPath("en", "SHORT")).toBe("/en/sign-up");
  });
});

describe("checkout prefill helpers", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("consumeCheckoutPrefillOnly reads the flag once", () => {
    markCheckoutPrefillOnly();
    expect(consumeCheckoutPrefillOnly()).toBe(true);
    expect(consumeCheckoutPrefillOnly()).toBe(false);
  });

  it("clearCheckoutPaymentResumeState removes PayPal session", () => {
    sessionStorage.setItem(PAYPAL_CHECKOUT_SESSION_KEY, "{}");
    clearCheckoutPaymentResumeState();
    expect(sessionStorage.getItem(PAYPAL_CHECKOUT_SESSION_KEY)).toBeNull();
  });

  it("tracks PayPal session phase for resume", () => {
    markPaypalCheckoutAwaitingApproval("abc12345", "1HGBH41JXMN109186");
    expect(readPaypalCheckoutSession()).toEqual({
      orderId: "ABC12345",
      vin: "1HGBH41JXMN109186",
      phase: "approval",
    });
    markPaypalCheckoutCapturePending("abc12345", "1HGBH41JXMN109186");
    expect(readPaypalCheckoutSession()?.phase).toBe("capture");
    expect(shouldResumePaypalCapture(readPaypalCheckoutSession()!)).toBe(true);
  });

  it("legacy PayPal sessions without phase restore approval UI, not capture", () => {
    sessionStorage.setItem(
      PAYPAL_CHECKOUT_SESSION_KEY,
      JSON.stringify({ orderId: "ABC12345", vin: "1HGBH41JXMN109186" }),
    );
    const session = readPaypalCheckoutSession();
    expect(session?.phase).toBeUndefined();
    expect(shouldResumePaypalCapture(session!)).toBe(false);
  });

  it("rejects invalid PayPal session payloads", () => {
    sessionStorage.setItem(PAYPAL_CHECKOUT_SESSION_KEY, JSON.stringify({ orderId: "x", vin: "short" }));
    expect(readPaypalCheckoutSession()).toBeNull();
  });
});

describe("resolveCheckoutPrefillVin", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("uses a valid ?vin= and replaces a previously stored VIN", () => {
    persistVinForCheckout("1HGBH41JXMN109186");
    expect(resolveCheckoutPrefillVin("?vin=WBA3A5G59DNP26082")).toBe("WBA3A5G59DNP26082");
    expect(sessionStorage.getItem(CHECKOUT_VIN_KEY)).toBe("WBA3A5G59DNP26082");
  });

  it("does not resurrect an old VIN when ?vin= is present but invalid", () => {
    persistVinForCheckout("1HGBH41JXMN109186");
    expect(resolveCheckoutPrefillVin("?vin=WRONGVIN")).toBe("WRONGVIN");
    expect(sessionStorage.getItem(CHECKOUT_VIN_KEY)).toBeNull();
    expect(localStorage.getItem(REFERRAL_VIN_KEY)).toBeNull();
  });

  it("falls back to stored VIN only when ?vin= is absent", () => {
    persistVinForCheckout("1HGBH41JXMN109186");
    expect(resolveCheckoutPrefillVin("")).toBe("1HGBH41JXMN109186");
  });
});
