import { describe, expect, it } from "vitest";
import {
  moodNeedleAngle,
  resolveAdminRevenueMood,
  revenueToClusterSpeed,
} from "./admin-revenue-mood";

describe("resolveAdminRevenueMood", () => {
  it("maps EUR thresholds to mood tiers", () => {
    expect(resolveAdminRevenueMood(0).id).toBe("eco");
    expect(resolveAdminRevenueMood(99.99).id).toBe("eco");
    expect(resolveAdminRevenueMood(100).id).toBe("cruise");
    expect(resolveAdminRevenueMood(179).id).toBe("cruise");
    expect(resolveAdminRevenueMood(180).id).toBe("charge");
    expect(resolveAdminRevenueMood(239).id).toBe("charge");
    expect(resolveAdminRevenueMood(240).id).toBe("heat");
    expect(resolveAdminRevenueMood(279).id).toBe("heat");
    expect(resolveAdminRevenueMood(280).id).toBe("blaze");
    expect(resolveAdminRevenueMood(349).id).toBe("blaze");
    expect(resolveAdminRevenueMood(350).id).toBe("supercar");
    expect(resolveAdminRevenueMood(999).id).toBe("supercar");
  });

  it("keeps primary channel strings parseable and intensity ordered", () => {
    const eco = resolveAdminRevenueMood(10);
    const superCar = resolveAdminRevenueMood(500);
    expect(eco.primary).toMatch(/^\d+ \d+% \d+%$/);
    expect(superCar.intensity).toBeGreaterThan(eco.intensity);
  });
});

describe("revenueToClusterSpeed / moodNeedleAngle", () => {
  it("maps revenue to speed like a cluster, climbing with sales", () => {
    expect(revenueToClusterSpeed(0)).toBe(0);
    expect(revenueToClusterSpeed(175)).toBe(150);
    expect(revenueToClusterSpeed(350)).toBe(300);
    expect(revenueToClusterSpeed(500)).toBeGreaterThan(300);
    expect(revenueToClusterSpeed(500)).toBeLessThanOrEqual(340);
  });

  it("sweeps the needle left→right with intensity", () => {
    expect(moodNeedleAngle(0)).toBe(-135);
    expect(moodNeedleAngle(0.5)).toBe(0);
    expect(moodNeedleAngle(1)).toBe(135);
  });
});
