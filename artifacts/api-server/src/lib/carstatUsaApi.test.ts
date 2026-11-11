import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://localhost:5432/kmcheck_test";
});

import {
  checkRecordsUrl,
  reportUrl,
  balanceUrl,
  pickPreferredReportType,
  parseVehicleLabel,
  stripBase64FromReportBody,
  isCarstatUsaPdfPayload,
} from "./carstatUsaApi.js";

describe("carstatUsaApi helpers", () => {
  it("builds check-records and report URLs with exclude_base_64", () => {
    const base = "https://carstat.dev";
    expect(checkRecordsUrl(base, "7FARW2H56JE022576")).toBe(
      "https://carstat.dev/api/reports/check-records/7FARW2H56JE022576",
    );
    expect(reportUrl(base, "carfax", "7FARW2H56JE022576")).toContain("exclude_base_64=1");
    expect(reportUrl(base, "autocheck", "7FARW2H56JE022576")).toContain("/api/reports/autocheck/");
    expect(balanceUrl(base)).toBe("https://carstat.dev/api/reports/balance");
  });

  it("prefers carfax when both have records", () => {
    expect(pickPreferredReportType({ carfax: 13, autocheck: 17 })).toBe("carfax");
    expect(pickPreferredReportType({ carfax: 0, autocheck: 5 })).toBe("autocheck");
    expect(pickPreferredReportType({ carfax: 0, autocheck: 0 })).toBeNull();
  });

  it("parses vehicle labels", () => {
    expect(parseVehicleLabel("HONDA CR-V EX 2018")).toEqual({
      make: "HONDA",
      model: "CR-V",
      year: 2018,
      trim: "EX",
    });
  });

  it("strips base64 from report bodies", () => {
    const cleaned = stripBase64FromReportBody({
      html: "https://x/a.html",
      pdf: "https://x/a.pdf",
      base64: "AAAA",
      id: 1,
    });
    expect(cleaned.base64).toBeUndefined();
    expect(cleaned.pdf).toBe("https://x/a.pdf");
  });

  it("detects carstat_usa HTML report payloads", () => {
    expect(
      isCarstatUsaPdfPayload({
        dataSource: "carstat_usa",
        pdfReport: { type: "carfax", pdfUrl: "https://x/a.pdf", htmlUrl: "https://x/a.html" },
      }),
    ).toBe(true);
    expect(
      isCarstatUsaPdfPayload({
        dataSource: "carstat_usa",
        pdfReport: { type: "carfax", pdfUrl: "https://x/a.pdf", htmlUrl: null },
      }),
    ).toBe(false);
    expect(isCarstatUsaPdfPayload({ dataSource: "getcarapi" })).toBe(false);
    expect(
      isCarstatUsaPdfPayload({
        dataSource: "carstat_usa",
        pdfReport: { type: "carfax", pdfUrl: null, htmlUrl: null },
      }),
    ).toBe(false);
  });
});
