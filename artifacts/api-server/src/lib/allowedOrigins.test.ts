import { afterEach, describe, expect, it } from "vitest";
import { getAllowedOrigins, isAllowedOrigin } from "./allowedOrigins.js";

describe("getAllowedOrigins www/apex twins", () => {
  const prevCors = process.env.CORS_ORIGIN;
  const prevSite = process.env.SITE_URL;

  afterEach(() => {
    if (prevCors === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = prevCors;
    if (prevSite === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = prevSite;
  });

  it("allows www when SITE_URL is apex", () => {
    process.env.SITE_URL = "https://verifykm.com";
    process.env.CORS_ORIGIN = "";
    const origins = getAllowedOrigins();
    expect(origins).toContain("https://verifykm.com");
    expect(origins).toContain("https://www.verifykm.com");
    expect(isAllowedOrigin("https://www.verifykm.com")).toBe(true);
  });

  it("does not invent www.localhost", () => {
    process.env.SITE_URL = "";
    process.env.CORS_ORIGIN = "";
    const origins = getAllowedOrigins();
    expect(origins.every((o) => !o.includes("www.localhost"))).toBe(true);
  });
});
