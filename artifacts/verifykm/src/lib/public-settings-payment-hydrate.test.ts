import { describe, expect, it } from "vitest";
import { isPublicPaymentSettingsHydrated } from "@/lib/public-settings";

describe("isPublicPaymentSettingsHydrated", () => {
  it("treats OAuth-only seed (dataUpdatedAt 0, no providers) as not ready", () => {
    expect(
      isPublicPaymentSettingsHydrated(
        { paypalClientId: null, pokEnabled: false },
        { isLoading: false, dataUpdatedAt: 0 },
      ),
    ).toBe(false);
  });

  it("is ready after a real API fetch even when PayPal is unset", () => {
    expect(
      isPublicPaymentSettingsHydrated(
        { paypalClientId: null, pokEnabled: false },
        { isLoading: false, dataUpdatedAt: 1_700_000_000_000 },
      ),
    ).toBe(true);
  });

  it("is ready early if provider fields are already present", () => {
    expect(
      isPublicPaymentSettingsHydrated(
        { paypalClientId: "AZl-test", pokEnabled: false },
        { isLoading: false, dataUpdatedAt: 0 },
      ),
    ).toBe(true);
    expect(
      isPublicPaymentSettingsHydrated(
        { paypalClientId: null, pokEnabled: true },
        { isLoading: false, dataUpdatedAt: 0 },
      ),
    ).toBe(true);
  });

  it("is not ready while loading or missing settings", () => {
    expect(
      isPublicPaymentSettingsHydrated(undefined, { isLoading: true, dataUpdatedAt: 0 }),
    ).toBe(false);
    expect(
      isPublicPaymentSettingsHydrated(null, { isLoading: false, dataUpdatedAt: 0 }),
    ).toBe(false);
  });
});
