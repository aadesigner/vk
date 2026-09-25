import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("scheduleDbKeepalive", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("pings the pool after the initial delay and on interval", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] });
    vi.doMock("@workspace/db", () => ({ pool: { query } }));
    vi.doMock("./logger.js", () => ({
      logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
    }));

    const { scheduleDbKeepalive } = await import("./dbKeepalive.js");
    scheduleDbKeepalive();
    scheduleDbKeepalive(); // idempotent

    expect(query).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith("SELECT 1");

    await vi.advanceTimersByTimeAsync(90_000);
    expect(query).toHaveBeenCalledTimes(2);
  });
});
