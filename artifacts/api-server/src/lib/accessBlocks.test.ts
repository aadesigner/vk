import { describe, expect, it } from "vitest";
import { normalizeBlockedCountry, normalizeBlockedIp } from "./accessBlockNormalize.js";
import { isExemptAccessBlockPath } from "./accessBlockPolicy.js";

describe("normalizeBlockedIp", () => {
  it("accepts IPv4", () => {
    expect(normalizeBlockedIp("203.0.113.10")).toBe("203.0.113.10");
  });

  it("strips IPv4-mapped prefix", () => {
    expect(normalizeBlockedIp("::ffff:192.168.1.5")).toBe("192.168.1.5");
  });

  it("rejects invalid values", () => {
    expect(normalizeBlockedIp("unknown")).toBeNull();
    expect(normalizeBlockedIp("not-an-ip")).toBeNull();
  });
});

describe("normalizeBlockedCountry", () => {
  it("uppercases valid ISO codes", () => {
    expect(normalizeBlockedCountry("ru")).toBe("RU");
  });

  it("rejects invalid codes", () => {
    expect(normalizeBlockedCountry("RUS")).toBeNull();
    expect(normalizeBlockedCountry("XX")).toBeNull();
  });
});

describe("isExemptAccessBlockPath", () => {
  it("exempts admin and health", () => {
    expect(isExemptAccessBlockPath("/healthz")).toBe(true);
    expect(isExemptAccessBlockPath("/admin/security/blocks")).toBe(true);
    expect(isExemptAccessBlockPath("/plugins/geo-language")).toBe(true);
  });

  it("does not exempt auth or vin", () => {
    expect(isExemptAccessBlockPath("/auth/login")).toBe(false);
    expect(isExemptAccessBlockPath("/vin/decode-free")).toBe(false);
  });
});
