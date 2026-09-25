import { describe, expect, it } from "vitest";
import { notifyVinLookupPublished, waitForVinLookupPublish } from "./vinLookupNotify.js";

describe("vinLookupNotify", () => {
  it("wakes waiters when publish is signaled", async () => {
    const started = Date.now();
    const done = waitForVinLookupPublish("1HGBH41JXMN109186", 30_000);
    setTimeout(() => notifyVinLookupPublished("1hgBH41JXMN109186"), 40);
    await done;
    expect(Date.now() - started).toBeLessThan(500);
  });

  it("resolves on timeout when no publish", async () => {
    const started = Date.now();
    await waitForVinLookupPublish("WBAGV8106RCR24769", 80);
    expect(Date.now() - started).toBeGreaterThanOrEqual(70);
  });
});
