import { describe, expect, it } from "vitest";
import {
  injectMarketingPageMetaFromPath,
  injectMarketingPageSeoFromPath,
  injectMarketingPageSsrFromPath,
} from "./marketingSeoHtmlInject.js";

const SAMPLE_HTML = `<!DOCTYPE html>
<html lang="en">
<head><title>verifykm.com</title>
<meta name="description" content="Check real mileage, hidden accidents, salvage titles, theft records and full car history with your VIN. Instant vehicle history report at verifykm.com." />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/assets/index.js"></script>
</body>
</html>`;

const ORIGIN = "https://verifykm.com";

describe("marketingSeoHtmlInject", () => {
  it("injects localized meta description for SQ home (replaces English fallback)", () => {
    const sq = injectMarketingPageMetaFromPath(SAMPLE_HTML, "/sq", ORIGIN);
    expect(sq).toContain('lang="sq"');
    expect(sq).toMatch(/meta name="description" content="[^"]*Kontroll kilometrash/i);
    expect(sq).not.toContain("Check real mileage, hidden accidents");
    expect(sq).toContain('href="https://verifykm.com/sq"');
  });

  it("injects localized H1 for EN and SQ home paths", () => {
    const en = injectMarketingPageSsrFromPath(SAMPLE_HTML, "/en");
    const sq = injectMarketingPageSsrFromPath(SAMPLE_HTML, "/sq");
    expect(en).toContain('<main id="verifykm-page-ssr"');
    expect(en).toMatch(/<h1>[^<]*mileage/i);
    expect(sq).toMatch(/<h1>[^<]*Kontroll/i);
  });

  it("combines meta + SSR for SPA fallback", () => {
    const html = injectMarketingPageSeoFromPath(SAMPLE_HTML, "/sq", ORIGIN);
    expect(html).toMatch(/meta name="description" content="[^"]*Kontroll kilometrash/i);
    expect(html).toMatch(/<h1>[^<]*Kontroll/i);
  });

  it("injects pricing page SSR body", () => {
    const html = injectMarketingPageSsrFromPath(SAMPLE_HTML, "/en/pricing");
    expect(html).toMatch(/<h1>[^<]*payment/i);
  });

  it("skips non-marketing routes", () => {
    const html = injectMarketingPageSsrFromPath(SAMPLE_HTML, "/en/dashboard");
    expect(html).not.toContain("verifykm-page-ssr");
  });
});
