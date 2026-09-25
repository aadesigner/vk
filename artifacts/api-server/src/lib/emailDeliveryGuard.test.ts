import { describe, expect, it } from "vitest";
import { claimEmailDelivery, vinReadyEmailDeliveryKey } from "./emailDeliveryGuard.js";

describe("emailDeliveryGuard", () => {
  it("blocks duplicate delivery within the dedupe window", () => {
    const key = vinReadyEmailDeliveryKey(42, "user@example.com");
    expect(claimEmailDelivery(key)).toBe(true);
    expect(claimEmailDelivery(key)).toBe(false);
  });
});
