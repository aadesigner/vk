import { describe, expect, it } from "vitest";
import {
  convertKrwToUsd,
  DEFAULT_KRW_PER_USD,
  defaultAmountCurrencyForCountry,
  formatAdminAmountPreview,
  formatKoreanInsuranceAmount,
  formatKoreanWonFromText,
  parseKrwFromText,
  resolveAmountDisplayCurrency,
  resolveKrwPerUsd,
  shouldFormatAccidentLossAsKrw,
} from "./korean-currency";
import { formatInsuranceAmount } from "./insurance-claims";

describe("korean-currency", () => {
  it("converts KRW to USD using admin rate", () => {
    expect(convertKrwToUsd(7_060_220, 1537)).toBeCloseTo(4593.5, 0);
  });

  it("formats USD primary with won in parentheses", () => {
    expect(formatKoreanInsuranceAmount(7_060_220, 1537)).toBe("$4,594 (₩7,060,220)");
  });

  it("uses default rate when admin rate is invalid", () => {
    expect(resolveKrwPerUsd(0)).toBe(DEFAULT_KRW_PER_USD);
    expect(resolveKrwPerUsd(null)).toBe(DEFAULT_KRW_PER_USD);
    expect(DEFAULT_KRW_PER_USD).toBe(1415);
  });

  it("parses won from provider text", () => {
    expect(parseKrwFromText("2,566,720 won")).toBe(2_566_720);
    expect(parseKrwFromText("136.6 million won")).toBe(136_600_000);
    expect(parseKrwFromText("₩7060220")).toBe(7_060_220);
  });

  it("formats won text to USD primary string", () => {
    expect(formatKoreanWonFromText("2,566,720 won", 1537)).toBe("$1,670 (₩2,566,720)");
    expect(formatKoreanWonFromText("136.6 million won", 1537)).toBe("$88,874 (₩136,600,000)");
  });

  it("defaults currency by country: KR→KRW, US/CA→USD, Europe→EUR", () => {
    expect(defaultAmountCurrencyForCountry("kr")).toBe("KRW");
    expect(defaultAmountCurrencyForCountry("us")).toBe("USD");
    expect(defaultAmountCurrencyForCountry("ca")).toBe("USD");
    expect(defaultAmountCurrencyForCountry("de")).toBe("EUR");
    expect(defaultAmountCurrencyForCountry("Germany")).toBe("EUR");
    expect(defaultAmountCurrencyForCountry("DEU")).toBe("EUR");
    expect(defaultAmountCurrencyForCountry("al")).toBe("EUR");
    expect(defaultAmountCurrencyForCountry("fr")).toBe("EUR");
    expect(defaultAmountCurrencyForCountry("France")).toBe("EUR");
    expect(defaultAmountCurrencyForCountry("South Korea")).toBe("KRW");
  });

  it("admin USD preview omits won conversion unless vehicle is Korean", () => {
    expect(formatAdminAmountPreview("5000", "USD", 1415, "us")).toBe("Users see $5,000");
    expect(formatAdminAmountPreview("5000", "USD", 1415, "ca")).toBe("Users see $5,000");
    expect(formatAdminAmountPreview("5000", "USD", 1415, "kr")).toBe(
      "Users see $5,000 · ≈ ₩7,075,000",
    );
    expect(formatAdminAmountPreview("5000", "EUR", 1415, "us")).toBe("Users see €5,000");
  });
});

describe("formatInsuranceAmount", () => {
  it("shows USD + won for Korean reports only", () => {
    expect(formatInsuranceAmount(7_060_220, "kr", 1537)).toBe("$4,594 (₩7,060,220)");
    expect(formatInsuranceAmount(5000, "us")).toBe("$5,000");
    expect(formatInsuranceAmount(5000, "de")).toBe("€5,000");
  });

  it("treats Korean insurance accidents as KRW even when vehicle country is US", () => {
    expect(formatInsuranceAmount(199_000, "us", 1537, {
      accidentType: "insurance",
      hasKoreanInsuranceClaims: true,
    })).toBe("$129 (₩199,000)");
  });
});

describe("shouldFormatAccidentLossAsKrw", () => {
  it("formats insurance/registry accidents as KRW without kr country", () => {
    expect(shouldFormatAccidentLossAsKrw({
      vehicleCountry: "us",
      accidentType: "insurance",
      hasKoreanInsuranceClaims: true,
    })).toBe(true);
  });

  it("prefers explicit row currency over country heuristics", () => {
    expect(shouldFormatAccidentLossAsKrw({
      currency: "USD",
      vehicleCountry: "kr",
      accidentType: "collision",
    })).toBe(false);
    expect(shouldFormatAccidentLossAsKrw({
      currency: "KRW",
      vehicleCountry: "us",
      accidentType: "collision",
    })).toBe(true);
    expect(resolveAmountDisplayCurrency({
      currency: "EUR",
      vehicleCountry: "us",
    })).toBe("EUR");
  });
});

describe("formatInsuranceAmount with currency", () => {
  it("shows USD only when currency is USD even for KR vehicle", () => {
    expect(formatInsuranceAmount(5_000_000, "kr", 1537, { currency: "USD" })).toBe("$5,000,000");
  });

  it("shows won when currency is KRW", () => {
    expect(formatInsuranceAmount(5_000_000, "us", 1537, { currency: "KRW" })).toBe("$3,253 (₩5,000,000)");
  });

  it("shows euro when currency is EUR", () => {
    expect(formatInsuranceAmount(3500, "us", 1537, { currency: "EUR" })).toBe("€3,500");
  });
});
