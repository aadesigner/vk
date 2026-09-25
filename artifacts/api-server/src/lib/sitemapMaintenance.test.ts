import { describe, expect, it } from "vitest";
import { removeVinUrlBlocks } from "./sitemapMaintenance.js";

describe("removeVinUrlBlocks", () => {
  it("removes url blocks for the VIN across languages", () => {
    const xml = `<?xml version="1.0"?>
<urlset>
  <url>
    <loc>https://verifykm.com/en/vin/5YFS4MCE0NP127131</loc>
  </url>
  <url>
    <loc>https://verifykm.com/sq/vin/5YFS4MCE0NP127131</loc>
  </url>
  <url>
    <loc>https://verifykm.com/en/about</loc>
  </url>
</urlset>`;

    const out = removeVinUrlBlocks(xml, "5YFS4MCE0NP127131");
    expect(out).not.toContain("5YFS4MCE0NP127131");
    expect(out).toContain("/en/about");
  });

  it("removes a single en+hreflang VIN entry (sharded format)", () => {
    const xml = `<?xml version="1.0"?>
<urlset xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://verifykm.com/en/vin/JM1BPAM7XK1234567</loc>
    <xhtml:link rel="alternate" hreflang="sq-AL" href="https://verifykm.com/sq/vin/JM1BPAM7XK1234567" />
  </url>
  <url>
    <loc>https://verifykm.com/en/vin/OTHERVIN000000001</loc>
  </url>
</urlset>`;

    const out = removeVinUrlBlocks(xml, "JM1BPAM7XK1234567");
    expect(out).not.toContain("JM1BPAM7XK1234567");
    expect(out).toContain("OTHERVIN000000001");
  });
});
