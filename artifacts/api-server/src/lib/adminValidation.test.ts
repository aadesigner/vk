import { describe, expect, it } from "vitest";
import { validateBoundedSettingsPatch } from "./adminValidation.js";

describe("validateBoundedSettingsPatch", () => {
  it("rejects zero maxFailedLogins", () => {
    expect(validateBoundedSettingsPatch({ maxFailedLogins: 0 })).toMatch(/maxFailedLogins/);
  });

  it("accepts in-range security settings", () => {
    expect(validateBoundedSettingsPatch({
      maxFailedLogins: 5,
      lockoutMinutes: 30,
      vinRatePerMinute: 20,
    })).toBeNull();
  });

  it("accepts zero for disabled retention and unlimited limits", () => {
    expect(validateBoundedSettingsPatch({
      logRetentionDays: 0,
      failedTxnRetentionDays: 0,
      maxVinsPerDay: 0,
      rateLimit: 0,
      registerMaxPerHour: 0,
      vinRatePerMinute: 0,
    })).toBeNull();
  });
});
