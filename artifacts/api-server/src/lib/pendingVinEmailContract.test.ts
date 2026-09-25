import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const pendingSrc = readFileSync(join(here, "pendingVinService.ts"), "utf8");
const vinRouteSrc = readFileSync(join(here, "../routes/vin.ts"), "utf8");
const fulfillmentSrc = readFileSync(join(here, "vinFulfillmentService.ts"), "utf8");

/** Extract source between `export … function Name` and the next export function / EOF. */
function exportRegion(src: string, exportName: string): string {
  const patterns = [
    `export async function ${exportName}`,
    `export function ${exportName}`,
  ];
  let start = -1;
  for (const p of patterns) {
    start = src.indexOf(p);
    if (start >= 0) break;
  }
  expect(start, `missing export ${exportName}`).toBeGreaterThanOrEqual(0);
  const nextAsync = src.indexOf("\nexport async function ", start + 1);
  const nextSync = src.indexOf("\nexport function ", start + 1);
  const candidates = [nextAsync, nextSync].filter((n) => n > start);
  const next = candidates.length ? Math.min(...candidates) : -1;
  return next === -1 ? src.slice(start) : src.slice(start, next);
}

describe("pending VIN customer email contract", () => {
  it("does not email customers when a pending VIN is first paid / fulfilled", () => {
    const region = exportRegion(pendingSrc, "fulfillManualPendingVinLookup");
    expect(region).not.toContain("fireVinReadyEmailForUser");
    expect(region).not.toContain("notifyPurchasersOnPendingPublish");
    expect(region).toContain("firePendingVinAdminNotification");
    expect(region).toMatch(/Intentionally no customer report-ready email/);
  });

  it("does not email customers when an admin saves a draft", () => {
    const region = exportRegion(pendingSrc, "savePendingVinCheckDraft");
    expect(region).not.toContain("fireVinReadyEmailForUser");
    expect(region).not.toContain("notifyPurchasersOnPendingPublish");
    expect(region).toMatch(/never emails customers|Draft save only/i);
  });

  it("emails customers only on publish, via the same helper as instant fulfillment", () => {
    const publish = exportRegion(pendingSrc, "publishPendingVinCheck");
    expect(publish).toContain("notifyPurchasersOnPendingPublish");
    expect(publish).not.toMatch(/fireVinReadyEmailForUser\s*\(/);
    // Must not await the notifier — SMTP must stay off the publish critical path.
    expect(publish).not.toMatch(/await\s+notifyPurchasersOnPendingPublish/);

    const notify = exportRegion(pendingSrc, "notifyPurchasersOnPendingPublish");
    expect(notify).toContain("fireVinReadyEmailForUser");
    expect(notify).toContain("setImmediate");
    expect(notify).not.toContain("Promise.allSettled");
    expect(notify).toMatch(/Identical helper \+ template as catalog\/cache\/provider instant fulfillment/);
  });

  it("keeps the sync manual_pending route free of customer emails until publish", () => {
    expect(vinRouteSrc).toMatch(/Manual pending: no customer email until admin publishes/);
    const idx = vinRouteSrc.indexOf('source: "manual_pending"');
    expect(idx).toBeGreaterThanOrEqual(0);
    const window = vinRouteSrc.slice(idx, idx + 500);
    expect(window).not.toContain("fireVinReadyEmailForUser");
  });

  it("keeps the async provider→pending fallback free of customer emails until publish", () => {
    expect(fulfillmentSrc).toMatch(/Manual pending fallback: no customer email until admin publishes/);
    const idx = fulfillmentSrc.indexOf("manual_pending_async_fallback");
    expect(idx).toBeGreaterThanOrEqual(0);
    const window = fulfillmentSrc.slice(Math.max(0, idx - 400), idx + 200);
    expect(window).not.toContain("fireVinReadyEmailForUser");
  });
});
