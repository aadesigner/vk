import { describe, expect, it } from "vitest";
import { classifyAcquisition, isStrongerAcquisition } from "./acquisitionClassify.js";

describe("server classifyAcquisition", () => {
  it("maps instagram referrer plus fbclid to Insta social", () => {
    const r = classifyAcquisition(
      "https://kmcheck.com/sq/?fbclid=IgAbc",
      "https://l.instagram.com/",
      "Mozilla/5.0",
      "kmcheck.com",
    );
    expect(r.bucket).toBe("organic_social");
    expect(r.channel).toBe("instagram_social");
  });

  it("does not treat fbclid as an ad", () => {
    const r = classifyAcquisition("https://kmcheck.com/sq/?fbclid=abc", "", "", "kmcheck.com");
    expect(r.bucket).toBe("organic_social");
    expect(r.channel).not.toMatch(/ads/);
  });

  it("maps QR van campaign to offline / qr_van", () => {
    const withMedium = classifyAcquisition(
      "https://kmcheck.com/sq/?utm_source=van&utm_medium=qr&utm_campaign=local",
      "",
      "",
      "kmcheck.com",
    );
    expect(withMedium.bucket).toBe("offline");
    expect(withMedium.channel).toBe("qr_van");
    expect(withMedium.source).toBe("van");
    expect(withMedium.medium).toBe("qr");

    const sourceOnly = classifyAcquisition(
      "https://kmcheck.com/sq/?utm_source=van",
      "",
      "",
      "kmcheck.com",
    );
    expect(sourceOnly.bucket).toBe("offline");
    expect(sourceOnly.channel).toBe("qr_van");
  });

  it("keeps first-touch QR van (does not overwrite with a later ad)", () => {
    const offline = classifyAcquisition("https://kmcheck.com/sq/?utm_source=van&utm_medium=qr", "", "", "kmcheck.com");
    const paid = classifyAcquisition("https://kmcheck.com/sq/?gclid=abc", "", "", "kmcheck.com");
    expect(isStrongerAcquisition(offline, paid)).toBe(false);
    expect(isStrongerAcquisition(paid, offline)).toBe(false);
  });

  it("upgrades direct to QR van", () => {
    const direct = classifyAcquisition("https://kmcheck.com/sq/", "", "", "kmcheck.com");
    const qr = classifyAcquisition("https://kmcheck.com/sq/?utm_source=van&utm_medium=qr", "", "", "kmcheck.com");
    expect(isStrongerAcquisition(direct, qr)).toBe(true);
  });
});
