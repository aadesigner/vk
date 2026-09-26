import { describe, it, expect } from "vitest";
import { buildEmailBase, emailBrandLogoUrl } from "./emailLayout.js";

describe("emailLayout", () => {
  it("uses the white brand logo on a dark header", () => {
    const html = buildEmailBase("<p>Hi</p>", undefined, "https://verifykm.com");
    expect(html).toContain('src="https://verifykm.com/brand/logo.png"');
    expect(html).toContain('bgcolor="#040d08"');
    expect(html).not.toContain('bgcolor="#16a34a"');
    expect(html).not.toContain("km<span");
  });

  it("builds logo URL from site settings", () => {
    expect(emailBrandLogoUrl("https://example.com/")).toBe("https://example.com/brand/logo.png");
  });
});
