import { describe, it, expect } from "vitest";
import { buildEmailBase, emailBrandLogoUrl, EMAIL_BRAND } from "./emailLayout.js";

describe("emailLayout", () => {
  it("uses the transparent wordmark on a navy header with cyan accent", () => {
    const html = buildEmailBase("<p>Hi</p>", undefined, "https://verifykm.com");
    expect(html).toContain('src="https://verifykm.com/brand/logo-nav.png"');
    expect(html).toContain("background-color:transparent");
    expect(html).toContain(`bgcolor="${EMAIL_BRAND.navy}"`);
    expect(html).toContain(`bgcolor="${EMAIL_BRAND.cyan}"`);
    expect(html).not.toContain("/brand/logo.png");
    expect(html).not.toContain("#16a34a");
    expect(html).not.toContain("#22c55e");
    expect(html).not.toContain("km<span");
  });

  it("builds logo URL from site settings", () => {
    expect(emailBrandLogoUrl("https://example.com/")).toBe("https://example.com/brand/logo-nav.png");
  });
});
