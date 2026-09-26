import { describe, expect, it } from "vitest";
import {
  classifyAcquisition,
  detectInAppBrowser,
  shouldUpgradeAcquisition,
  tagAcquisitionUrl,
} from "./acquisition";

describe("classifyAcquisition", () => {
  it("does not treat a bare fbclid as a paid ad", () => {
    const r = classifyAcquisition(
      "https://verifykm.com/sq/?fbclid=abc123",
      "",
    );
    expect(r.bucket).toBe("organic_social");
    expect(r.channel).toBe("meta_social");
    expect(r.clickId).toBe("abc123");
  });

  it("maps instagram referrer plus fbclid to organic instagram", () => {
    const r = classifyAcquisition(
      "https://verifykm.com/sq/?fbclid=abc123",
      "https://l.instagram.com/",
    );
    expect(r.bucket).toBe("organic_social");
    expect(r.channel).toBe("instagram_social");
    expect(r.clickId).toBe("abc123");
  });

  it("maps instagram share params to organic instagram when referrer is stripped", () => {
    const r = classifyAcquisition(
      "https://verifykm.com/en/?igshid=MzRlODBiNWFlZA==",
      "",
    );
    expect(r.bucket).toBe("organic_social");
    expect(r.channel).toBe("instagram_social");
  });

  it("still maps paid utm plus fbclid to meta ads", () => {
    const r = classifyAcquisition(
      "https://verifykm.com/sq/?utm_source=instagram&utm_medium=paid&fbclid=abc123",
      "",
    );
    expect(r.bucket).toBe("paid_ads");
    expect(r.channel).toBe("instagram_ads");
    expect(r.clickId).toBe("abc123");
  });

  it("maps gclid to google ads", () => {
    const r = classifyAcquisition("https://verifykm.com/en/?gclid=xyz", "");
    expect(r.bucket).toBe("paid_ads");
    expect(r.channel).toBe("google_ads");
  });

  it("maps paid utm meta", () => {
    const r = classifyAcquisition(
      "https://verifykm.com/sq/?utm_source=meta&utm_medium=paid&utm_campaign=vin_al",
      "",
    );
    expect(r.bucket).toBe("paid_ads");
    expect(r.channel).toBe("meta_ads");
    expect(r.campaign).toBe("vin_al");
  });

  it("maps instagram referrer to organic social", () => {
    const r = classifyAcquisition(
      "https://verifykm.com/sq/",
      "https://l.instagram.com/",
    );
    expect(r.bucket).toBe("organic_social");
    expect(r.channel).toBe("instagram_social");
    expect(r.referrer).toBe("l.instagram.com");
  });

  it("maps google referrer to google organic", () => {
    const r = classifyAcquisition(
      "https://verifykm.com/en/",
      "https://www.google.com/",
    );
    expect(r.bucket).toBe("google");
    expect(r.channel).toBe("google_organic");
  });

  it("maps other sites to referral", () => {
    const r = classifyAcquisition(
      "https://verifykm.com/en/",
      "https://partner.example.com/page",
    );
    expect(r.bucket).toBe("referral");
    expect(r.referrer).toBe("partner.example.com");
  });

  it("maps empty referrer to direct", () => {
    const r = classifyAcquisition("https://verifykm.com/en/", "");
    expect(r.bucket).toBe("direct");
    expect(r.channel).toBe("direct");
  });

  it("maps unpaid social utm sources to organic, not ads or referral", () => {
    expect(classifyAcquisition("https://verifykm.com/en/?utm_source=tiktok", "").channel).toBe("tiktok_social");
    expect(classifyAcquisition("https://verifykm.com/en/?utm_source=facebook", "").channel).toBe("facebook_social");
    expect(classifyAcquisition("https://verifykm.com/en/?utm_source=twitter&utm_medium=social", "").channel).toBe("x_social");
    expect(classifyAcquisition("https://verifykm.com/en/?utm_source=linkedin", "").channel).toBe("linkedin_social");
    expect(classifyAcquisition("https://verifykm.com/en/?utm_source=youtube", "").bucket).toBe("organic_social");
  });

  it("maps social referrers to the matching organic channel", () => {
    expect(classifyAcquisition("https://verifykm.com/en/", "https://www.tiktok.com/").channel).toBe("tiktok_social");
    expect(classifyAcquisition("https://verifykm.com/en/", "https://t.co/abc").channel).toBe("x_social");
    expect(classifyAcquisition("https://verifykm.com/en/", "https://lnkd.in/xyz").channel).toBe("linkedin_social");
    expect(classifyAcquisition("https://verifykm.com/en/", "https://www.facebook.com/").channel).toBe("facebook_social");
    expect(classifyAcquisition("https://verifykm.com/en/", "https://fb.me/x").channel).toBe("facebook_social");
    expect(classifyAcquisition("https://verifykm.com/en/", "https://www.threads.net/").channel).toBe("threads_social");
    expect(classifyAcquisition("https://verifykm.com/en/", "https://youtu.be/abc").channel).toBe("youtube_social");
    expect(classifyAcquisition("https://verifykm.com/en/", "https://wa.me/").channel).toBe("whatsapp_social");
  });

  it("still maps ad-only click ids to paid", () => {
    expect(classifyAcquisition("https://verifykm.com/en/?ttclid=tt", "").channel).toBe("tiktok_ads");
    expect(classifyAcquisition("https://verifykm.com/en/?twclid=tw", "").channel).toBe("x_ads");
    expect(classifyAcquisition("https://verifykm.com/en/?li_fat_id=li", "").channel).toBe("linkedin_ads");
  });

  it("maps instagram in-app browser without referrer to instagram social", () => {
    const r = classifyAcquisition(
      "https://verifykm.com/sq/?fbclid=abc",
      "",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Instagram 192.168.1.2",
    );
    expect(r.bucket).toBe("organic_social");
    expect(r.channel).toBe("instagram_social");
    expect(r.inApp).toBe("instagram");
    expect(r.landingPath).toBe("/sq");
  });

  it("maps tiktok in-app browser without referrer to tiktok social", () => {
    const r = classifyAcquisition(
      "https://verifykm.com/en/",
      "",
      "Mozilla/5.0 Linux BytedanceWebview TikTok 32.0",
    );
    expect(r.channel).toBe("tiktok_social");
    expect(r.inApp).toBe("tiktok");
  });

  it("upgrades a weak direct capture when a later hit is social", () => {
    const first = classifyAcquisition("https://verifykm.com/en/", "");
    const later = classifyAcquisition(
      "https://verifykm.com/en/?fbclid=x",
      "",
      "Instagram 1.0",
    );
    expect(first.channel).toBe("direct");
    expect(shouldUpgradeAcquisition(first, later)).toBe(true);
    expect(shouldUpgradeAcquisition(later, first)).toBe(false);
  });

  it("does not overwrite a paid first-touch with organic", () => {
    const paid = classifyAcquisition("https://verifykm.com/en/?gclid=abc", "");
    const social = classifyAcquisition("https://verifykm.com/en/", "https://l.instagram.com/");
    expect(shouldUpgradeAcquisition(paid, social)).toBe(false);
  });

  it("tags share urls without clobbering existing utms", () => {
    const tagged = tagAcquisitionUrl("https://verifykm.com/en/vin/ABC", "whatsapp", "social", "report_share");
    expect(tagged).toContain("utm_source=whatsapp");
    const kept = tagAcquisitionUrl(tagged, "telegram", "social", "report_share");
    expect(kept).toContain("utm_source=whatsapp");
  });
});

describe("detectInAppBrowser", () => {
  it("recognizes instagram and facebook webviews", () => {
    expect(detectInAppBrowser("Instagram 12.0")).toBe("instagram");
    expect(detectInAppBrowser("FBAN/FBIOS")).toBe("facebook");
    expect(detectInAppBrowser("Mozilla/5.0 Chrome/120")).toBeNull();
  });
});
