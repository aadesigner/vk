import { describe, it, expect, vi, beforeEach } from "vitest";

describe("vinShareToken", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.JWT_SECRET = "test-secret-for-share-token";
  });

  it("signs and verifies a VIN share token", async () => {
    const { signVinShareToken, verifyVinShareToken } = await import("./vinShareToken.js");
    const vin = "1HGBH41JXMN109186";
    const token = signVinShareToken(vin);
    expect(verifyVinShareToken(token)).toBe(vin);
  });

  it("rejects tampered tokens", async () => {
    const { signVinShareToken, verifyVinShareToken } = await import("./vinShareToken.js");
    const token = signVinShareToken("1HGBH41JXMN109186");
    expect(verifyVinShareToken(token + "x")).toBeNull();
  });
});
