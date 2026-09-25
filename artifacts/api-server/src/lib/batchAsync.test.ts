import { describe, expect, it } from "vitest";
import { createConcurrencyLimiter, mapInBatches, yieldEventLoop } from "./batchAsync.js";

describe("mapInBatches", () => {
  it("processes all items in chunks", async () => {
    const seen: number[] = [];
    await mapInBatches([1, 2, 3, 4, 5], 2, async (n) => {
      seen.push(n);
    });
    expect(seen).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("createConcurrencyLimiter", () => {
  it("never runs more than max jobs at once", async () => {
    const limiter = createConcurrencyLimiter(2);
    let active = 0;
    let peak = 0;

    await Promise.all(
      Array.from({ length: 6 }, () =>
        limiter.run(async () => {
          active += 1;
          peak = Math.max(peak, active);
          await new Promise((r) => setTimeout(r, 20));
          active -= 1;
        }),
      ),
    );

    expect(peak).toBeLessThanOrEqual(2);
    expect(active).toBe(0);
  });
});

describe("yieldEventLoop", () => {
  it("resolves on a later turn", async () => {
    let turned = false;
    const p = yieldEventLoop().then(() => {
      turned = true;
    });
    expect(turned).toBe(false);
    await p;
    expect(turned).toBe(true);
  });
});
