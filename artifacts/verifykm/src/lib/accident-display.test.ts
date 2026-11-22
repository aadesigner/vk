import { describe, expect, it } from "vitest";
import {
  resolveAccidentSeverityForDisplay,
  accidentSeverityStyle,
  isPartsListAccidentDescription,
  resolveAccidentCostBreakdown,
} from "./accident-display";

describe("resolveAccidentSeverityForDisplay", () => {
  it("does not treat missing price as a small accident", () => {
    expect(resolveAccidentSeverityForDisplay({}, {})).toBe("unknown");
    expect(resolveAccidentSeverityForDisplay({ lossAmount: null }, {})).toBe("unknown");
    expect(resolveAccidentSeverityForDisplay({ lossAmount: 0 }, {})).toBe("unknown");
  });

  it("keeps explicit provider severity when there is no amount", () => {
    expect(resolveAccidentSeverityForDisplay({ severity: "major" }, {})).toBe("major");
    expect(resolveAccidentSeverityForDisplay({ severity: "minor" }, {})).toBe("minor");
  });

  it("infers from positive loss amount", () => {
    expect(resolveAccidentSeverityForDisplay({ lossAmount: 500 }, {})).toBe("minor");
    expect(resolveAccidentSeverityForDisplay({ lossAmount: 5000 }, {})).toBe("major");
  });

  it("infers from KRW parts/labor/paint when lossAmount is missing", () => {
    expect(
      resolveAccidentSeverityForDisplay(
        {
          type: "insurance",
          country: "KR",
          currency: "KRW",
          partCost: 1_502_800,
          laborCost: 1_003_760,
          paintingCost: 1_556_510,
        },
        { vehicleCountry: "KR", hasKoreanInsuranceClaims: true },
      ),
    ).toBe("moderate");
  });

  it("infers from same-day insurance claims when accident has no amount", () => {
    expect(
      resolveAccidentSeverityForDisplay(
        {
          date: "2024-11-08",
          type: "insurance",
          country: "KR",
          currency: "KRW",
          description: "Rear door (left) (replace)",
        },
        {
          vehicleCountry: "KR",
          hasKoreanInsuranceClaims: true,
          insuranceClaims: [
            { date: "2024-11-08", lossAmount: 266_880, partCost: 90_000, laborCost: 60_000, paintingCost: 25_000 },
          ],
        },
      ),
    ).toBe("minor");
  });
});

describe("accidentSeverityStyle", () => {
  it("uses neutral styling for unknown severity", () => {
    const style = accidentSeverityStyle("unknown");
    expect(style.card).toContain("border-border");
    expect(style.dot).not.toContain("yellow");
  });
});

describe("accident cost vs parts list", () => {
  it("detects repaired-parts dumps", () => {
    expect(
      isPartsListAccidentDescription(
        "Rear door (left) surface repair (painting); Rear bumper assembly (replacement)",
      ),
    ).toBe(true);
    expect(
      isPartsListAccidentDescription(
        "Paid 266,880 KRW · Parts 1,502,800 KRW · Labor 1,003,760 KRW · Paint 1,556,510 KRW",
      ),
    ).toBe(false);
  });

  it("resolves parts/labor/paint from same-day insurance claims", () => {
    const costs = resolveAccidentCostBreakdown(
      { date: "2024-11-08", lossAmount: 266880, description: "Rear door (left) (replace); Rear bumper (replacement)" },
      [
        { date: "2024-11-08", lossAmount: 67680, partCost: 10000, laborCost: 20000, paintingCost: 5000 },
        { date: "2024-11-08", lossAmount: 199200, partCost: 80000, laborCost: 40000, paintingCost: 20000 },
      ],
    );
    expect(costs.partCost).toBe(90000);
    expect(costs.laborCost).toBe(60000);
    expect(costs.paintingCost).toBe(25000);
    expect(costs.lossAmount).toBe(266880);
  });
});
