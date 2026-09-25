import { describe, expect, it } from "vitest";
import { hasMileageRollback } from "./vin-condition-score";

describe("hasMileageRollback noise tolerance", () => {
  it("ignores ≤50 km dips in the same calendar year", () => {
    expect(
      hasMileageRollback([
        { date: "2026-03-01", odometer: 87_000 },
        { date: "2026-03-15", odometer: 86_998 },
        { date: "2026-04-01", odometer: 86_960 },
      ]),
    ).toBe(false);
  });

  it("flags >50 km dips even in the same year", () => {
    expect(
      hasMileageRollback([
        { date: "2026-03-01", odometer: 87_000 },
        { date: "2026-04-01", odometer: 86_900 },
      ]),
    ).toBe(true);
  });

  it("flags any drop across different calendar years", () => {
    expect(
      hasMileageRollback([
        { date: "2025-12-20", odometer: 50_010 },
        { date: "2026-01-05", odometer: 50_000 },
      ]),
    ).toBe(true);
  });

  it("does not flag increasing mileage", () => {
    expect(
      hasMileageRollback([
        { date: "2024-01-01", odometer: 10_000 },
        { date: "2025-01-01", odometer: 25_000 },
      ]),
    ).toBe(false);
  });
});
