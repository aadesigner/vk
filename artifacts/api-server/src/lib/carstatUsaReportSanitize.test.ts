import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://localhost:5432/kmcheck_test";
});

import {
  assertAllowedUsaReportUrl,
  redactCarstatUsaDataForClient,
  sanitizeUsaReportHtml,
} from "./carstatUsaReportSanitize.js";

describe("carstatUsaReportSanitize", () => {
  it("redacts upstream URLs from client payloads", () => {
    const out = redactCarstatUsaDataForClient({
      dataSource: "carstat_usa",
      pdfReport: {
        type: "carfax",
        pdfUrl: null,
        htmlUrl: "https://report-cars.b-cdn.net/reports/carfax/x.html",
        vehicle: "HONDA",
        fetchedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    const pr = out.pdfReport as Record<string, unknown>;
    expect(pr.htmlUrl).toBeNull();
    expect(pr.pdfUrl).toBeNull();
    expect(pr.hasHtml).toBe(true);
    expect(pr.hasPdf).toBe(false);
  });

  it("allows known report CDN hosts only", () => {
    expect(() => assertAllowedUsaReportUrl("https://report-cars.b-cdn.net/a.html")).not.toThrow();
    expect(() => assertAllowedUsaReportUrl("https://evil.example/a.html")).toThrow();
  });

  it("sanitizes HTML title, injects brand hide, and neuters carfax links", () => {
    const html = `<!DOCTYPE html><html><head>
      <meta http-equiv="Content-Security-Policy" content="frame-ancestors 'none'">
      <meta http-equiv="X-Frame-Options" content="DENY">
      <title>CARFAX Vehicle History</title>
      <link rel="stylesheet" href="https://static.carfax.com/app.css">
    </head><body>
      <img src="https://vhrjs.s3.us-east-1.amazonaws.com/CarfaxLogo.svg" alt="CARFAX">
      <a href="https://www.carfax.com/company/about">about</a>
    </body></html>`;
    const out = sanitizeUsaReportHtml(html);
    expect(out).toContain("<title>Vehicle history report</title>");
    expect(out).toContain("km-usa-brand-hide");
    expect(out).toContain('href="#"');
    expect(out).not.toContain("https://www.carfax.com/company/about");
    expect(out).not.toContain("frame-ancestors");
    expect(out).not.toContain("X-Frame-Options");
    // Asset URLs must survive (report would otherwise blank / CSP-block).
    expect(out).toContain("https://static.carfax.com/app.css");
  });
});
