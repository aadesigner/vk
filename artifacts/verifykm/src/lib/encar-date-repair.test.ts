import { describe, it, expect } from "vitest";
import {
  repairEncarMisParsedIsoDate,
  repairEnglishMonthYearLabel,
  sanitizeReportIsoDate,
} from "./encar-date-repair";

describe("encar date repair", () => {
  it("repairs 2001-01-20 as January 2020 Encar header", () => {
    expect(repairEncarMisParsedIsoDate("2001-01-20", 2020)).toBe("2020-01-01");
  });

  it("repairs 2001-08-23 as August 2023 Encar header (not August 23, 2001)", () => {
    expect(repairEncarMisParsedIsoDate("2001-08-23", 2020)).toBe("2023-08-01");
    expect(sanitizeReportIsoDate("2001-08-23", 2020)).toBe("2023-08-01");
  });

  it("repairs English text August 23, 2001", () => {
    expect(repairEnglishMonthYearLabel("August 23, 2001", 2020)).toBe("2023-08-01");
  });

  it("drops dates before the vehicle production year", () => {
    expect(sanitizeReportIsoDate("2018-05-12", 2020)).toBeNull();
    expect(sanitizeReportIsoDate("2021-10-30", 2020)).toBe("2021-10-30");
  });

  it("leaves plausible pre-2010 calendar dates on older vehicles", () => {
    expect(sanitizeReportIsoDate("2001-06-15", 1998)).toBe("2001-06-15");
  });

  it("normalizes US auction calendar strings to ISO", () => {
    expect(sanitizeReportIsoDate("May 18, 2021", 2018)).toBe("2021-05-18");
    expect(sanitizeReportIsoDate("05/18/2021", 2018)).toBe("2021-05-18");
    expect(sanitizeReportIsoDate("2021-05", 2018)).toBe("2021-05-01");
  });
});
