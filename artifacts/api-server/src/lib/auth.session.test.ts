import { describe, expect, it } from "vitest";
import { clampSessionDays, MIN_SESSION_DAYS, DEFAULT_SESSION_DAYS } from "./sessionPolicy.js";

describe("clampSessionDays", () => {
  it("defaults to 30 days", () => {
    expect(clampSessionDays(undefined)).toBe(DEFAULT_SESSION_DAYS);
    expect(clampSessionDays(null)).toBe(DEFAULT_SESSION_DAYS);
  });

  it("enforces a 14-day minimum", () => {
    expect(clampSessionDays(1)).toBe(MIN_SESSION_DAYS);
    expect(clampSessionDays(7)).toBe(MIN_SESSION_DAYS);
    expect(clampSessionDays(14)).toBe(14);
  });

  it("caps at 365 days", () => {
    expect(clampSessionDays(500)).toBe(365);
  });
});
