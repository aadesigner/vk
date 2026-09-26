import { describe, expect, it } from "vitest";
import {
  sanitizeAcquisitionPayload,
  parseAcquisitionCookieValue,
  acquisitionToUserFields,
} from "./acquisition.js";

describe("acquisition sanitize", () => {
  it("accepts valid payload", () => {
    const p = sanitizeAcquisitionPayload({
      bucket: "paid_ads",
      channel: "meta_ads",
      source: "meta",
      medium: "paid",
      campaign: "vin_al",
      clickId: "abc",
      referrer: "l.facebook.com",
      landingPath: "/sq",
      inApp: "instagram",
      capturedAt: new Date().toISOString(),
    });
    expect(p?.bucket).toBe("paid_ads");
    expect(p?.channel).toBe("meta_ads");
    expect(p?.landingPath).toBe("/sq");
    expect(p?.inApp).toBe("instagram");
  });

  it("rejects unknown bucket", () => {
    expect(sanitizeAcquisitionPayload({ bucket: "hack", channel: "x" })).toBeNull();
  });

  it("parses base64url cookie", () => {
    const json = JSON.stringify({
      bucket: "direct",
      channel: "direct",
      capturedAt: new Date().toISOString(),
    });
    const b64 = Buffer.from(json, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const p = parseAcquisitionCookieValue(b64);
    expect(p?.bucket).toBe("direct");
    const fields = acquisitionToUserFields(p);
    expect(fields?.acquisitionBucket).toBe("direct");
  });
});
