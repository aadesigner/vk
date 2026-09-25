import { describe, expect, it } from "vitest";
import { normalizeBlockedIp, normalizeBlockedDevice } from "./accessBlockNormalize.js";

describe("normalizeBlockedIp", () => {
  it("accepts ipv4", () => {
    expect(normalizeBlockedIp("203.0.113.10")).toBe("203.0.113.10");
  });

  it("strips ipv4-mapped prefix", () => {
    expect(normalizeBlockedIp("::ffff:203.0.113.10")).toBe("203.0.113.10");
  });

  it("accepts ipv6 cidr keys from ipKeyGenerator", () => {
    expect(normalizeBlockedIp("2001:db8:85a3::/64")).toBe("2001:db8:85a3::/64");
  });

  it("rejects unknown", () => {
    expect(normalizeBlockedIp("unknown")).toBeNull();
  });
});

describe("normalizeBlockedDevice", () => {
  it("accepts sha256 hex", () => {
    const hash = "a".repeat(64);
    expect(normalizeBlockedDevice(hash)).toBe(hash);
  });

  it("rejects short values", () => {
    expect(normalizeBlockedDevice("abc")).toBeNull();
  });
});
