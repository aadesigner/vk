import { describe, expect, it } from "vitest";
import { isInAppWebViewUserAgent, requestUserAgent } from "./inAppWebView.js";

describe("isInAppWebViewUserAgent", () => {
  it("matches Instagram", () => {
    expect(isInAppWebViewUserAgent("Mozilla/5.0 Instagram 192.168.1.2.111")).toBe(true);
  });

  it("matches Facebook in-app", () => {
    expect(isInAppWebViewUserAgent("Mozilla/5.0 FBAN/FBIOS FBAV/1.0")).toBe(true);
  });

  it("matches Messenger", () => {
    expect(isInAppWebViewUserAgent("Mozilla/5.0 Messenger/192.168.2.2.117")).toBe(true);
    expect(isInAppWebViewUserAgent("Mozilla/5.0 [FB_IAB/Orca-Android;FBAV/450.0]")).toBe(true);
  });

  it("does not match normal Chrome", () => {
    expect(
      isInAppWebViewUserAgent(
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/128.0.0.0 Mobile Safari/537.36",
      ),
    ).toBe(false);
  });
});

describe("requestUserAgent", () => {
  it("reads a string header", () => {
    expect(requestUserAgent({ "user-agent": "Instagram" })).toBe("Instagram");
  });
});
