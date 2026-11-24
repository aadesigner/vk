import { describe, expect, it } from "vitest";
import {
  sanitizeAcquisitionPayload,
  parseAcquisitionCookieValue,
  encodeAcquisitionCookieValue,
  resolveAcquisitionForSignup,
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
      capturedAt: new Date().toISOString(),
    });
    expect(p?.bucket).toBe("paid_ads");
    expect(p?.channel).toBe("meta_ads");
  });

  it("rejects unknown bucket", () => {
    expect(sanitizeAcquisitionPayload({ bucket: "hack", channel: "x" })).toBeNull();
  });

  it("accepts offline / QR van bucket", () => {
    const p = sanitizeAcquisitionPayload({
      bucket: "offline",
      channel: "qr_van",
      source: "van",
      medium: "qr",
      capturedAt: new Date().toISOString(),
    });
    expect(p?.bucket).toBe("offline");
    expect(p?.channel).toBe("qr_van");
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

  it("prefers server instagram cookie over a direct body payload", () => {
    const cookie = encodeAcquisitionCookieValue({
      bucket: "organic_social",
      channel: "instagram_social",
      referrer: "l.instagram.com",
      capturedAt: new Date().toISOString(),
    });
    const fields = resolveAcquisitionForSignup(
      { acquisition: { bucket: "direct", channel: "direct" } },
      cookie,
    );
    expect(fields?.acquisitionChannel).toBe("instagram_social");
    expect(fields?.acquisitionBucket).toBe("organic_social");
  });
});
