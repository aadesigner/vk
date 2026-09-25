import { describe, expect, it } from "vitest";
import type { Language } from "@/i18n/context";
import {
  translateKoreanProviderPhrase,
  translateKoreanProviderText,
  translateProviderChartLabel,
  translateProviderDate,
  translateProviderDateInText,
  translateProviderMultiline,
  translateRegistryFieldValue,
  localizeProviderDate,
  formatDayMonthYearNumeric,
  formatNumericDateAsDayMonthYear,
  translateInsuranceClaimDescription,
} from "./korean-provider-text";

const ENGLISH_MONTH =
  /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b/i;

const NON_EN_LANGUAGES: Language[] = ["de", "es", "fr", "sq", "pl", "ro", "bg", "ka", "ar", "uk", "ru", "zh"];

const t = (key: string) => {
  const dict: Record<string, string> = {
    provider_txn_party_relocation: "Relocation between parties",
    provider_txn_trader_transfer: "Trader transfer",
    provider_inspection_regular: "Regular inspection",
    provider_mileage_word: "Mileage",
    provider_of_mileage: "recorded mileage",
    provider_million_won_unit: "million KRW",
    registry_type_inspection: "Inspection completed",
    provider_change_registration: "Registration change",
    insurance_desc_parts: "Pièces",
    insurance_desc_labor: "Main-d'œuvre",
    insurance_desc_paint: "Peinture",
  };
  return dict[key] ?? key;
};

describe("translateProviderDate", () => {
  it("localizes English month-day", () => {
    expect(translateProviderDate("June 22", "en")).toMatch(/June\s+22/);
    expect(translateProviderDate("June 22", "uk")).toMatch(/22/);
  });

  it("localizes ISO dates", () => {
    const result = translateProviderDate("2025-04-24", "en");
    expect(result).toMatch(/April/);
    expect(result).toMatch(/24/);
  });

  it("localizes ISO timestamps", () => {
    const result = translateProviderDate("2025-11-13T21:55:12.000000Z", "sq");
    expect(result).toMatch(/2025/);
    expect(result).not.toBe("2025-11-13T21:55:12.000000Z");
  });

  it("localizes compact YYYYMMDD dates", () => {
    const result = translateProviderDate("20250424", "sq");
    expect(result).toMatch(/2025/);
    expect(result).not.toBe("20250424");
  });

  it("localizes ownership history English month dates", () => {
    expect(translateProviderDate("April 16, 2019", "en")).toMatch(/April.*16.*2019/);
    expect(translateProviderDate("April 16, 2019", "sq")).not.toMatch(/^April/);
    expect(translateProviderDate("May 18, 2021", "uk")).not.toMatch(/^May/);
  });

  it("localizes insurance claim style dates including September", () => {
    expect(translateProviderDate("September 12, 2024", "en")).toMatch(/September.*12.*2024/);
    expect(translateProviderDate("September 12, 2024", "sq")).not.toMatch(/^September/);
    expect(translateProviderDate("September 12,2024", "sq")).not.toMatch(/^September/);
    expect(translateProviderDate("2024-09-12", "sq")).not.toMatch(/^2024-09-12/);
  });

  it("localizes abbreviated English month dates", () => {
    expect(translateProviderDate("Apr 16, 2019", "sq")).not.toMatch(/^Apr/);
    expect(translateProviderDate("Jan 13, 2025", "ru")).not.toMatch(/^Jan/);
  });

  it("localizes month-day without year", () => {
    expect(translateProviderDate("February 24", "sq")).not.toMatch(/^February/);
    expect(translateProviderDate("June 22", "uk")).not.toMatch(/^June/);
  });

  it("localizes day-first English dates", () => {
    const result = translateProviderDate("16 April 2019", "sq");
    expect(result).toMatch(/2019/);
    expect(result).not.toMatch(/^16 April/);
  });

  it("localizes YYYY-MM month labels", () => {
    expect(translateProviderDate("2021-05", "sq")).not.toMatch(/^2021-05/);
    expect(translateProviderDate("2021-05", "uk")).not.toMatch(/May/i);
  });

  it("localizes chart axis labels", () => {
    expect(translateProviderChartLabel("2021-05-18", "sq")).not.toMatch(/^2021/);
    expect(translateProviderChartLabel("2021-05-18", "sq")).not.toMatch(/May/i);
    expect(translateProviderChartLabel("April 16, 2019", "uk")).not.toMatch(/^April/);
    expect(translateProviderChartLabel("May 21", "sq")).not.toMatch(/^May/);
  });

  it("localizes ISO auction dates for market data display", () => {
    const result = localizeProviderDate("2026-06-07T12:23:29.000000Z", "sq");
    expect(result).not.toMatch(/^2026-06-07/);
    expect(result).not.toMatch(/June/i);
  });

  it("localizes US auction date strings for every non-English language", () => {
    const samples = ["May 18, 2021", "05/18/2021", "2021-05-18", "2021-05-18T00:00:00.000Z"];
    for (const lang of NON_EN_LANGUAGES) {
      for (const input of samples) {
        const result = localizeProviderDate(input, lang, 2018);
        expect(result, `${lang} ${input}`).toBeTruthy();
        expect(result!, `${lang} ${input}`).not.toMatch(ENGLISH_MONTH);
      }
    }
  });

  it("localizes Encar month+year headers in text", () => {
    const result = translateProviderDateInText("Insurance event January 20", "sq");
    expect(result).not.toMatch(/January/);
    expect(result).toMatch(/2020/);
  });

  it("localizes English month-year labels", () => {
    expect(translateProviderDate("July 2015", "sq")).not.toMatch(/^July/);
    expect(translateProviderDate("July 2015", "ar")).not.toMatch(/^July/);
  });

  it("localizes embedded month ranges in longer text", () => {
    const result = translateProviderDateInText("April 2015 - April 2019", "sq");
    expect(result).not.toMatch(/April/);
    expect(result).toMatch(/2015/);
    expect(result).toMatch(/2019/);
  });

  it("localizes recall target production ranges", () => {
    const result = translateProviderDateInText(
      "Produced vehicles between (January 03, 2014 and June 30, 2017)",
      "sq",
    );
    expect(result).not.toMatch(/January|June/);
    expect(result).toMatch(/2014/);
    expect(result).toMatch(/2017/);
  });

  it("localizes unregistered period subtitles", () => {
    const result = translateProviderMultiline(t, "sq", "Unregistered period: April 2005 -April 2019");
    expect(result).not.toMatch(/April/);
    expect(result).toMatch(/2005/);
    expect(result).toMatch(/2019/);
  });

  it("localizes registry-style month-day and period fields", () => {
    expect(localizeProviderDate("February 24", "sq")).not.toMatch(/^February/);
    expect(localizeProviderDate("September 12, 2024", "sq")).not.toMatch(/^September/);
    expect(localizeProviderDate("April 2015 - April 2019", "sq")).not.toMatch(/April/);
  });

  it("translates month names in every non-English language", () => {
    const samples = [
      { input: "2001-08-23", vehicleYear: 2020, expectYear: "2023" },
      { input: "2023-08-01", vehicleYear: null, expectYear: "2023" },
      { input: "2021-10-30", vehicleYear: 2020, expectYear: "2021" },
      { input: "August 23, 2001", vehicleYear: 2020, expectYear: "2023" },
    ];
    for (const lang of NON_EN_LANGUAGES) {
      for (const { input, vehicleYear, expectYear } of samples) {
        const result = localizeProviderDate(input, lang, vehicleYear);
        expect(result, `${lang} ${input}`).toBeTruthy();
        expect(result!, `${lang} ${input}`).not.toMatch(ENGLISH_MONTH);
        expect(result!, `${lang} ${input}`).toMatch(expectYear);
      }
    }
  });

  it("uses localized month names for Encar month+year headers in every language", () => {
    for (const lang of ["en", ...NON_EN_LANGUAGES] as Language[]) {
      const result = localizeProviderDate("January 20", lang, 2020);
      expect(result).toMatch(/2020/);
      if (lang !== "en") expect(result!).not.toMatch(ENGLISH_MONTH);
    }
  });

  it("formats US vehicle dates as DD/MM/YYYY (en) or localized months (sq)", () => {
    expect(formatDayMonthYearNumeric(18, 6, 2024)).toBe("18/06/2024");
    expect(formatNumericDateAsDayMonthYear("2024-06-18")).toBe("18/06/2024");
    expect(formatNumericDateAsDayMonthYear("06/18/2024", { assumeUsSlashOrder: true })).toBe("18/06/2024");
    expect(localizeProviderDate("2024-06-18", "en", null, "us")).toBe("18/06/2024");
    expect(localizeProviderDate("05/18/2021", "sq", 2018, "usa")).toMatch(/maj/i);
    expect(localizeProviderDate("05/18/2021", "sq", 2018, "usa")).not.toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(localizeProviderDate("May 18, 2021", "uk", null, "us")).toBe("18/05/2021");
  });

  it("uses compact DD/MM/YY chart labels for US vehicles", () => {
    expect(translateProviderChartLabel("2021-05-18", "en", "us")).toBe("18/05/21");
    expect(translateProviderChartLabel("05/18/2021", "sq", "usa")).toBe("18/05/21");
  });

  it("localizes chart month labels for Albanian (no English Oct/May stubs)", () => {
    expect(translateProviderChartLabel("2025-10-04", "sq")).toMatch(/tet/i);
    expect(translateProviderChartLabel("2025-10-04", "sq")).not.toMatch(/Oct/i);
    expect(translateProviderChartLabel("2021-05-18", "sq")).toMatch(/maj/i);
    expect(translateProviderChartLabel("2021-05-18", "sq")).not.toMatch(/May/i);
    expect(translateProviderChartLabel("Oct 4, 2025", "sq")).toMatch(/tet/i);
    expect(translateProviderChartLabel("Oct 4", "sq")).toMatch(/tet/i);
  });

  it("uses Albanian month names for ISO and mileage-style dates", () => {
    expect(localizeProviderDate("2024-03-15", "sq", 2020, "de")).toMatch(/mars/i);
    expect(localizeProviderDate("2025-10-04", "sq", 2020, "kr")).toMatch(/tetor/i);
    expect(localizeProviderDate("2025-10-04T00:00:00.000Z", "sq", 2020, "kr")).toMatch(/tetor/i);
    expect(localizeProviderDate("2021-05-18", "sq", 2018, "usa")).toMatch(/maj/i);
  });

  it("falls back to numeric dates for ownership history instead of hiding them", () => {
    const auctionOwnerDate = "2025-10-04";
    expect(localizeProviderDate(auctionOwnerDate, "en", 2020, "kr")).toBeTruthy();
    expect(localizeProviderDate(auctionOwnerDate, "sq", 2020, "kr")).toMatch(/tetor/i);
    expect(localizeProviderDate("April 16, 2019", "sq", 2020, "kr")).toMatch(/2019/);
    expect(localizeProviderDate("2025-10-04T00:00:00.000Z", "sq", 2020, "kr")).toBeTruthy();
  });
});

describe("translateKoreanProviderPhrase", () => {
  it("translates transaction types", () => {
    expect(translateKoreanProviderPhrase(t, "Relocation of the party transaction"))
      .toBe("Relocation between parties");
    expect(translateKoreanProviderPhrase(t, "Trader transactions transfer"))
      .toBe("Trader transfer");
  });

  it("translates full insurance damage title including to my car", () => {
    const dict = {
      ...t,
      provider_processing_insurance_damage: "Sigurimi mbas dëmtimit të makinës sime",
    };
    const trSq = (key: string) => (dict as Record<string, string>)[key] ?? key;
    expect(translateKoreanProviderText(trSq, "Insurance processing after damage to my car"))
      .toBe("Sigurimi mbas dëmtimit të makinës sime");
    expect(translateKoreanProviderText(trSq, "Insurance processing after damage"))
      .toBe("Sigurimi mbas dëmtimit të makinës sime");
  });
});

describe("translateProviderMultiline", () => {
  it("translates inspection subtitle lines", () => {
    expect(translateProviderMultiline(t, "en", "regular inspection\nMileage 77,675km"))
      .toBe("Regular inspection · Mileage 77,675 km");
  });

  it("rewrites Encar drone mileage typos in subtitle lines", () => {
    expect(translateProviderMultiline(t, "en", "Regular inspection\nDrone 76,113km"))
      .toBe("Regular inspection · Mileage 76,113 km");
  });

  it("translates comprehensive examination mileage line", () => {
    const dict = { ...t, provider_inspection_comprehensive_exam: "Comprehensive examination", provider_of_mileage: "recorded mileage" };
    const tr = (key: string) => (dict as Record<string, string>)[key] ?? key;
    expect(translateProviderMultiline(tr, "sq", "Comprehensive examination 86,730 km of mileage"))
      .toContain("86,730");
  });
});

describe("translateInsuranceClaimDescription", () => {
  it("translates parts, labor, and paint even when labor is the first token", () => {
    expect(translateInsuranceClaimDescription(t, "labor ₩300,000"))
      .toBe("Main-d'œuvre ₩300,000");
    expect(translateInsuranceClaimDescription(t, "parts ₩800,000, labor ₩300,000, paint ₩50,000"))
      .toBe("Pièces ₩800,000, Main-d'œuvre ₩300,000, Peinture ₩50,000");
  });
});

describe("translateRegistryFieldValue", () => {
  it("translates transaction field values", () => {
    expect(translateRegistryFieldValue(t, "en", "Transaction", "Trader transactions transfer"))
      .toBe("Trader transfer");
  });
});
