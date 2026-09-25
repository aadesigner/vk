import { describe, expect, it } from "vitest";
import { vinReportPaymentLabel } from "./vinReportPaymentLabel.js";

describe("vinReportPaymentLabel", () => {
  it("uses make plus last 5 VIN characters when the brand is known", () => {
    expect(vinReportPaymentLabel("WAUZZZ8R9BA025736")).toBe("VIN - Audi *25736");
    expect(vinReportPaymentLabel("WVWZZZ1KZDW015901")).toBe("VIN - Volkswagen *15901");
  });

  it("keeps letters in the last 5 VIN characters, not only 0-9", () => {
    expect(vinReportPaymentLabel("ZZZZZZZZZZZZZAB12C")).toBe("VIN - *AB12C");
  });

  it("uses only characters safe for PayPal/POK descriptors", () => {
    const samples = [
      "WAUZZZ8R9BA025736",
      "WVWZZZ1KZDW015901",
      "ZZZZZZZZZZZZZ12345",
      "ZZZZZZZZZZZZZAB12C",
      "",
      "   ",
    ];
    for (const vin of samples) {
      const label = vinReportPaymentLabel(vin);
      expect(label.length).toBeGreaterThan(0);
      expect(label.length).toBeLessThanOrEqual(127);
      expect(label.startsWith("VIN - ")).toBe(true);
      expect(label).toContain("*");
      expect(label).not.toMatch(/[()]/);
    }
  });
});
