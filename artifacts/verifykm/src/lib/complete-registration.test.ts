/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COMPLETE_REGISTRATION_FIRED_KEY,
  COMPLETE_REGISTRATION_PENDING_KEY,
  consumeSignupQueryFlag,
  flushPendingCompleteRegistration,
  trackCompleteRegistration,
} from "./complete-registration";

describe("trackCompleteRegistration", () => {
  afterEach(() => {
    sessionStorage.clear();
    delete window.fbq;
    window.dataLayer = [];
    vi.unstubAllGlobals();
  });

  it("fires pixel and dataLayer once", () => {
    const fbq = vi.fn();
    window.fbq = fbq as typeof window.fbq;
    window.dataLayer = [];

    trackCompleteRegistration();
    trackCompleteRegistration();

    expect(fbq).toHaveBeenCalledTimes(1);
    expect(fbq).toHaveBeenCalledWith("track", "CompleteRegistration");
    expect(window.dataLayer).toEqual([{ event: "complete_registration" }]);
    expect(sessionStorage.getItem(COMPLETE_REGISTRATION_FIRED_KEY)).toBe("1");
  });

  it("queues until the pixel is injected", () => {
    window.dataLayer = [];
    trackCompleteRegistration();
    expect(sessionStorage.getItem(COMPLETE_REGISTRATION_PENDING_KEY)).toBe("1");

    const fbq = vi.fn();
    window.fbq = fbq as typeof window.fbq;
    flushPendingCompleteRegistration();
    expect(fbq).toHaveBeenCalledWith("track", "CompleteRegistration");
    expect(sessionStorage.getItem(COMPLETE_REGISTRATION_FIRED_KEY)).toBe("1");
  });

  it("consumes signup=1 from the URL", () => {
    window.history.replaceState({}, "", "/en/dashboard?signup=1&vin=ABC");
    expect(consumeSignupQueryFlag()).toBe(true);
    expect(window.location.search).toBe("?vin=ABC");
    expect(consumeSignupQueryFlag()).toBe(false);
  });
});
