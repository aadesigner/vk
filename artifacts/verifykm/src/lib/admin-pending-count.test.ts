import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchAdminPendingCount } from "./admin-pending-count";

describe("fetchAdminPendingCount", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns open count from JSON", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ open: 7 }),
    } as Response);

    await expect(fetchAdminPendingCount()).resolves.toEqual({ open: 7 });
  });

  it("coerces invalid open to 0", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ open: "nope" }),
    } as Response);

    await expect(fetchAdminPendingCount()).resolves.toEqual({ open: 0 });
  });

  it("throws on non-OK response", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as Response);

    await expect(fetchAdminPendingCount()).rejects.toThrow(/503/);
  });
});
