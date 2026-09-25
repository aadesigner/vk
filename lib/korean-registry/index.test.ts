import { describe, expect, it } from "vitest";
import {
  hasExplicitRegistryMileage,
  normalizeKrwAmountText,
  parseKoreanListPriceKrw,
  formatKoreanListPriceAmountText,
  resolveRegistryDisplayAmount,
  resolveRegistryDisplayMileage,
  resolveKoreanDisplayKrw,
  sanitizeKoreanRepairKrwAmount,
  stripRegistrySubtitleNoise,
  isEncarMileageTypoLine,
  sanitizeRegistryLocation,
} from "./index";

describe("resolveRegistryDisplayMileage", () => {
  it("hides mileage on insurance events", () => {
    expect(resolveRegistryDisplayMileage({
      type: "insurance_event",
      mileage: 301_000,
      details: [{ label: "Total repair cost", value: "2,566,720 won" }],
    })).toBeNull();
  });

  it("shows inspection mileage from KOTSA fields", () => {
    expect(resolveRegistryDisplayMileage({
      type: "inspection",
      mileage: 86_730,
      details: [{ label: "Drone during inspection", value: "86,730 km" }],
    })).toBe(86_730);
  });

  it("drops listing odometer leaked onto events without KOTSA mileage", () => {
    expect(resolveRegistryDisplayMileage({
      type: "inspection",
      mileage: 301_000,
      details: [{ label: "Inspection category", value: "regular inspection" }],
    }, { listingOdometer: 301_000 })).toBeNull();
  });
});

describe("normalizeKrwAmountText", () => {
  it("adds won suffix to plain numeric repair costs", () => {
    expect(normalizeKrwAmountText("2566720")).toBe("2,566,720 won");
  });

  it("does not treat 9+ digit list prices as bare repair costs", () => {
    expect(normalizeKrwAmountText("306000000")).toBe("306000000");
  });

  it("leaves formatted won strings unchanged", () => {
    expect(normalizeKrwAmountText("2,566,720 won")).toBe("2,566,720 won");
  });
});

describe("sanitizeKoreanRepairKrwAmount", () => {
  it("rejects new-car-scale list prices mislabeled as repair", () => {
    expect(sanitizeKoreanRepairKrwAmount(306_000_000)).toBeNull();
    expect(sanitizeKoreanRepairKrwAmount(871_000_000)).toBeNull();
  });

  it("prefers part/labor breakdown when benefit is inflated", () => {
    expect(sanitizeKoreanRepairKrwAmount(306_000_000, {
      partCost: 2_500_000,
      laborCost: 800_000,
      paintingCost: 200_000,
    })).toBe(3_500_000);
  });

  it("keeps plausible repair payouts", () => {
    expect(sanitizeKoreanRepairKrwAmount(2_566_720)).toBe(2_566_720);
  });
});

describe("parseKoreanListPriceKrw", () => {
  it("scales under-reported Encar million-won list prices by 10×", () => {
    expect(parseKoreanListPriceKrw("13.57 million won")).toBe(135_700_000);
    expect(formatKoreanListPriceAmountText("13.57 million won")).toBe("135,700,000 won");
  });

  it("leaves correctly scaled million-won list prices unchanged", () => {
    expect(parseKoreanListPriceKrw("136.6 million won")).toBe(136_600_000);
  });

  it("accepts full-scale won strings", () => {
    expect(parseKoreanListPriceKrw("135,700,000 won")).toBe(135_700_000);
  });
});

describe("resolveKoreanDisplayKrw", () => {
  it("shows list prices above repair cap", () => {
    expect(resolveKoreanDisplayKrw("135,700,000 won", "New car list price")).toBe(135_700_000);
  });

  it("still caps repair costs", () => {
    expect(resolveKoreanDisplayKrw("306,000,000 won", "Total repair cost")).toBeNull();
  });
});

describe("resolveRegistryDisplayAmount", () => {
  it("hides list price chips on insurance events", () => {
    expect(resolveRegistryDisplayAmount({
      type: "insurance_event",
      amount: "306,000,000 won",
      details: [{ label: "New car list price", value: "306,000,000 won" }],
    })).toBeNull();
  });

  it("shows sanitized repair cost when present", () => {
    expect(resolveRegistryDisplayAmount({
      type: "insurance_event",
      details: [{ label: "Total repair cost", value: "2,566,720 won" }],
    })).toBe("2,566,720 won");
  });

  it("drops inflated repair cost in details", () => {
    expect(resolveRegistryDisplayAmount({
      type: "insurance_event",
      details: [{ label: "Total repair cost", value: "306,000,000 won" }],
    })).toBeNull();
  });

  it("scales new car delivery list price from Encar million-won format", () => {
    expect(resolveRegistryDisplayAmount({
      type: "new_car_delivery",
      details: [{ label: "New car list price", value: "13.57 million won" }],
    })).toBe("135,700,000 won");
  });
});

describe("stripRegistrySubtitleNoise", () => {
  it("removes extracted repair cost from subtitle", () => {
    expect(stripRegistrySubtitleNoise("Busan · total 2,566,720 won", null)).toBe("Busan");
  });

  it("removes Encar drone/drown mileage typos from subtitle", () => {
    expect(stripRegistrySubtitleNoise("Regular inspection · Drone 76,113km", 76_113))
      .toBe("Regular inspection");
    expect(stripRegistrySubtitleNoise("Drown 87,100 km", 87_100)).toBeNull();
  });
});

describe("sanitizeRegistryLocation", () => {
  it("drops mileage typo lines mis-tagged as locations", () => {
    expect(sanitizeRegistryLocation("Drone 76,113km")).toBeNull();
    expect(sanitizeRegistryLocation("Drown 87,100 km")).toBeNull();
    expect(sanitizeRegistryLocation("Yeongdeungpo-gu, Seoul")).toBe("Yeongdeungpo-gu, Seoul");
  });

  it("detects Encar mileage typo lines", () => {
    expect(isEncarMileageTypoLine("Drone 76,113km")).toBe(true);
    expect(isEncarMileageTypoLine("Busan")).toBe(false);
  });
});

describe("hasExplicitRegistryMileage", () => {
  it("detects KOTSA mileage detail rows", () => {
    expect(hasExplicitRegistryMileage({
      details: [{ label: "Driving distance during inspection", value: "245,000 km" }],
    })).toBe(true);
  });
});
