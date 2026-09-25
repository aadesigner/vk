import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { confirmPokOrderWithRetry } from "./pok-checkout-confirm";

describe("confirmPokOrderWithRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns success on first ok response", async () => {
    const fetchConfirm = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, paymentId: 1 }), { status: 200 }),
    );
    const result = await confirmPokOrderWithRetry(fetchConfirm, { maxAttempts: 3, retryDelaysMs: [100] });
    expect(result.ok).toBe(true);
    expect(fetchConfirm).toHaveBeenCalledTimes(1);
  });

  it("retries PAYMENT_NOT_COMPLETED then succeeds", async () => {
    const fetchConfirm = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "PAYMENT_NOT_COMPLETED", retryable: true }), { status: 402 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, paymentId: 2 }), { status: 200 }),
      );

    const promise = confirmPokOrderWithRetry(fetchConfirm, { maxAttempts: 3, retryDelaysMs: [100] });
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.ok).toBe(true);
    expect(fetchConfirm).toHaveBeenCalledTimes(2);
  });

  it("stops retrying on non-retryable errors", async () => {
    const fetchConfirm = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "PAYMENT_AMOUNT_MISMATCH", retryable: false }), { status: 402 }),
    );
    const result = await confirmPokOrderWithRetry(fetchConfirm, { maxAttempts: 4, retryDelaysMs: [100] });
    expect(result.ok).toBe(false);
    expect(fetchConfirm).toHaveBeenCalledTimes(1);
  });
});
