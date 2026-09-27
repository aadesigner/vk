import { describe, expect, it } from "vitest";
import {
  computeVinConditionScore,
  floodScorePenalty,
  scoreInputFromLookup,
  scoreInputFromPublic,
} from "./vin-condition-score";

const t = (key: string) => key;

const cleanCar = {
  odometer: 40_000,
  year: 2022,
  ownerCount: 1,
  accidents: [] as Array<{ severity?: string | null }>,
  accidentCount: 0,
};

describe("floodScorePenalty", () => {
  it("takes 2.5 when the car is not already low", () => {
    expect(floodScorePenalty(9.5)).toBe(2.5);
    expect(floodScorePenalty(6)).toBe(2.5);
  });

  it("takes 1.5 when the score is already low", () => {
    expect(floodScorePenalty(5.9)).toBe(1.5);
    expect(floodScorePenalty(4)).toBe(1.5);
  });

  it("takes 1.0 when the score is already very low", () => {
    expect(floodScorePenalty(3.9)).toBe(1);
    expect(floodScorePenalty(2)).toBe(1);
  });
});

describe("computeVinConditionScore flood", () => {
  it("drops 2.5 on a flooded car that was otherwise in good shape", () => {
    const clear = computeVinConditionScore(cleanCar, t);
    const flooded = computeVinConditionScore({ ...cleanCar, isFlooded: true }, t);
    expect(clear?.score).toBe("9.5");
    expect(flooded?.score).toBe("7.0");
  });

  it("uses the smaller hit when salvage already crushed the score", () => {
    const salvage = computeVinConditionScore({ ...cleanCar, isSalvage: true }, t);
    const flooded = computeVinConditionScore({
      ...cleanCar,
      isSalvage: true,
      isFlooded: true,
    }, t);
    // salvage: 10-6=4 → finalize 3.5; flood on 4 is 1.5 → 2.5 → finalize 2.0
    expect(salvage?.score).toBe("3.5");
    expect(flooded?.score).toBe("2.0");
    expect(Number(flooded?.score)).toBeLessThan(Number(salvage?.score));
  });

  it("does not change the score when flood is assessed clear", () => {
    const clear = computeVinConditionScore({ ...cleanCar, isFlooded: false }, t);
    expect(clear?.score).toBe("9.5");
  });

  it("maps public flooded + lookup isFlooded into the score input", () => {
    expect(scoreInputFromPublic({ flooded: true })?.isFlooded).toBe(true);
    expect(scoreInputFromLookup({ isFlooded: true })?.isFlooded).toBe(true);
    expect(scoreInputFromLookup({ isFlooded: false })?.isFlooded).toBe(false);
  });
});
