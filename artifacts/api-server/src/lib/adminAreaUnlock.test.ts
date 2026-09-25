import { afterEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://test:test@127.0.0.1:5432/test";
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "unit-test-secret";
});

import {
  ADMIN_UNLOCK_DAYS,
  isAdminAreaPinEnabled,
  verifyAdminAreaPin,
  signAdminUnlockToken,
  verifyAdminUnlockToken,
} from "./adminAreaUnlock.js";

describe("adminAreaUnlock", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is disabled when ADMIN_AREA_PIN is unset", () => {
    vi.stubEnv("ADMIN_AREA_PIN", "");
    expect(isAdminAreaPinEnabled()).toBe(false);
    expect(verifyAdminAreaPin("anything")).toBe(true);
  });

  it("verifies PIN with constant-time hash compare", () => {
    vi.stubEnv("ADMIN_AREA_PIN", "test-pin-12345");
    expect(isAdminAreaPinEnabled()).toBe(true);
    expect(verifyAdminAreaPin("test-pin-12345")).toBe(true);
    expect(verifyAdminAreaPin("wrong")).toBe(false);
  });

  it("issues unlock tokens bound to admin user id", async () => {
    vi.stubEnv("JWT_SECRET", "unit-test-secret");
    const token = await signAdminUnlockToken("admin-user-1");
    await expect(verifyAdminUnlockToken(token)).resolves.toBe("admin-user-1");
    await expect(verifyAdminUnlockToken(token)).resolves.toBe("admin-user-1");
    expect(ADMIN_UNLOCK_DAYS).toBe(7);
  });
});
