import { describe, expect, it } from "vitest";
import { classifyAcquisition, isStrongerAcquisition, tagAcquisitionUrl } from "./acquisition";

describe("classifyAcquisition", () => {
  it("does not treat fbclid as an ad", () => {
    const r = classifyAcquisition("https://kmcheck.com/sq/?fbclid=abc123", "");
    expect(r.bucket).toBe("organic_social");
    expect(r.channel).toBe("facebook_social");
    expect(r.clickId).toBe("abc123");
  });

  it("maps instagram referrer plus fbclid to Insta social", () => {
    const r = classifyAcquisition(
      "https://kmcheck.com/sq/?fbclid=IgAbc",
      "https://l.instagram.com/",
    );
    expect(r.bucket).toBe("organic_social");
    expect(r.channel).toBe("instagram_social");
  });

  it("maps facebook referrer plus fbclid to FB social", () => {
    const r = classifyAcquisition(
      "https://kmcheck.com/en/?fbclid=IwAR",
      "https://l.facebook.com/",
    );
    expect(r.bucket).toBe("organic_social");
    expect(r.channel).toBe("facebook_social");
  });

  it("maps Instagram in-app browser plus fbclid to Insta social", () => {
    const r = classifyAcquisition(
      "https://kmcheck.com/sq/?fbclid=IgApp",
      "",
      "Mozilla/5.0 Instagram 192.168.2.2.111",
    );
    expect(r.bucket).toBe("organic_social");
    expect(r.channel).toBe("instagram_social");
  });

  it("maps Facebook in-app browser plus fbclid to FB social", () => {
    const r = classifyAcquisition(
      "https://kmcheck.com/en/?fbclid=FbApp",
      "",
      "Mozilla/5.0 FBAN/FBIOS FBAV/1.0",
    );
    expect(r.bucket).toBe("organic_social");
    expect(r.channel).toBe("facebook_social");
  });

  it("maps Threads referrer to Insta social", () => {
    const r = classifyAcquisition("https://kmcheck.com/en/", "https://www.threads.net/@x");
    expect(r.channel).toBe("instagram_social");
  });

  it("maps messenger referrer to Messenger", () => {
    const r = classifyAcquisition("https://kmcheck.com/en/", "https://l.messenger.com/");
    expect(r.bucket).toBe("organic_social");
    expect(r.channel).toBe("messenger");
  });

  it("maps tiktok referrer to TikTok social, not ads", () => {
    const r = classifyAcquisition("https://kmcheck.com/en/", "https://www.tiktok.com/@x");
    expect(r.bucket).toBe("organic_social");
    expect(r.channel).toBe("tiktok_social");
  });

  it("maps ttclid to TikTok ads", () => {
    const r = classifyAcquisition("https://kmcheck.com/en/?ttclid=tt1", "");
    expect(r.bucket).toBe("paid_ads");
    expect(r.channel).toBe("tiktok_ads");
  });

  it("maps X / t.co referrer to X social", () => {
    const r = classifyAcquisition("https://kmcheck.com/en/", "https://t.co/abc");
    expect(r.bucket).toBe("organic_social");
    expect(r.channel).toBe("x_social");
  });

  it("maps LinkedIn short link to LinkedIn social", () => {
    const r = classifyAcquisition("https://kmcheck.com/en/", "https://lnkd.in/abcd");
    expect(r.bucket).toBe("organic_social");
    expect(r.channel).toBe("linkedin_social");
  });

  it("maps WhatsApp referrer to WhatsApp social", () => {
    const r = classifyAcquisition("https://kmcheck.com/en/", "https://wa.me/");
    expect(r.channel).toBe("whatsapp_social");
  });

  it("maps paid instagram utm to ads even with fbclid", () => {
    const r = classifyAcquisition(
      "https://kmcheck.com/sq/?utm_source=instagram&utm_medium=paid&fbclid=xyz",
      "https://l.instagram.com/",
    );
    expect(r.bucket).toBe("paid_ads");
    expect(r.channel).toBe("instagram_ads");
  });

  it("maps utm_source=tiktok without paid medium to TikTok social", () => {
    const r = classifyAcquisition("https://kmcheck.com/en/?utm_source=tiktok&utm_medium=social", "");
    expect(r.bucket).toBe("organic_social");
    expect(r.channel).toBe("tiktok_social");
  });

  it("maps gclid to google ads", () => {
    const r = classifyAcquisition("https://kmcheck.com/en/?gclid=xyz", "");
    expect(r.bucket).toBe("paid_ads");
    expect(r.channel).toBe("google_ads");
  });

  it("maps paid utm meta", () => {
    const r = classifyAcquisition(
      "https://kmcheck.com/sq/?utm_source=meta&utm_medium=paid&utm_campaign=vin_al",
      "",
    );
    expect(r.bucket).toBe("paid_ads");
    expect(r.channel).toBe("meta_ads");
    expect(r.campaign).toBe("vin_al");
  });

  it("maps instagram referrer to organic social", () => {
    const r = classifyAcquisition("https://kmcheck.com/sq/", "https://l.instagram.com/");
    expect(r.bucket).toBe("organic_social");
    expect(r.channel).toBe("instagram_social");
    expect(r.referrer).toBe("l.instagram.com");
  });

  it("maps google referrer to google organic", () => {
    const r = classifyAcquisition("https://kmcheck.com/en/", "https://www.google.com/");
    expect(r.bucket).toBe("google");
    expect(r.channel).toBe("google_organic");
  });

  it("maps other sites to referral", () => {
    const r = classifyAcquisition("https://kmcheck.com/en/", "https://partner.example.com/page");
    expect(r.bucket).toBe("referral");
    expect(r.referrer).toBe("partner.example.com");
  });

  it("maps empty referrer to direct", () => {
    const r = classifyAcquisition("https://kmcheck.com/en/", "");
    expect(r.bucket).toBe("direct");
    expect(r.channel).toBe("direct");
  });

  it("maps QR van utm to offline qr_van", () => {
    const r = classifyAcquisition("https://kmcheck.com/sq/?utm_source=van&utm_medium=qr", "");
    expect(r.bucket).toBe("offline");
    expect(r.channel).toBe("qr_van");
  });

  it("maps utm_source=van alone to offline qr_van", () => {
    const r = classifyAcquisition("https://kmcheck.com/sq/?utm_source=van", "");
    expect(r.bucket).toBe("offline");
    expect(r.channel).toBe("qr_van");
  });

  it("upgrades a direct first hit when Instagram arrives later", () => {
    const first = classifyAcquisition("https://kmcheck.com/en/", "");
    const later = classifyAcquisition("https://kmcheck.com/sq/?fbclid=Ig", "https://l.instagram.com/");
    expect(isStrongerAcquisition(first, later)).toBe(true);
    expect(isStrongerAcquisition(later, first)).toBe(false);
  });

  it("does not replace Instagram social with a later ad guess", () => {
    const insta = classifyAcquisition("https://kmcheck.com/sq/", "https://l.instagram.com/");
    const googleAd = classifyAcquisition("https://kmcheck.com/en/?gclid=1", "");
    expect(isStrongerAcquisition(insta, googleAd)).toBe(false);
  });

  it("tags share URLs without overwriting existing UTMs", () => {
    const tagged = tagAcquisitionUrl("https://verifykm.com/en/vin/ABC", "whatsapp", "social", "report_share");
    expect(tagged).toContain("utm_source=whatsapp");
    const kept = tagAcquisitionUrl(tagged, "telegram", "social", "report_share");
    expect(kept).toBe(tagged);
  });
});
