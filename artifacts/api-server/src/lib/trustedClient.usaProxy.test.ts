import { describe, expect, it } from "vitest";
import { isExemptApiPath } from "./trustedClient.js";

describe("isExemptApiPath USA report proxies", () => {
  it("exempts pdf/html proxy navigations (no client guard header possible)", () => {
    expect(isExemptApiPath("/vin/42/pdf-proxy")).toBe(true);
    expect(isExemptApiPath("/vin/42/html-proxy")).toBe(true);
    expect(isExemptApiPath("/api/vin/42/pdf-proxy")).toBe(true);
    expect(isExemptApiPath("/api/vin/42/html-proxy")).toBe(true);
  });

  it("does not exempt unrelated vin routes", () => {
    expect(isExemptApiPath("/vin/42")).toBe(false);
    expect(isExemptApiPath("/vin/peek/ABC")).toBe(false);
  });

  it("still exempts image proxy and oauth", () => {
    expect(isExemptApiPath("/vin/image")).toBe(true);
    expect(isExemptApiPath("/auth/google")).toBe(true);
  });
});
