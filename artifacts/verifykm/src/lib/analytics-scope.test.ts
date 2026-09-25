import { describe, expect, it } from "vitest";
import { isPublicAnalyticsPath, isSiteTrackingPath } from "./analytics-scope";

describe("isPublicAnalyticsPath", () => {
  it("allows marketing and checkout routes", () => {
    expect(isPublicAnalyticsPath("/en")).toBe(true);
    expect(isPublicAnalyticsPath("/en/cars/usa")).toBe(true);
    expect(isPublicAnalyticsPath("/en/checkout")).toBe(true);
    expect(isPublicAnalyticsPath("/en/sign-in")).toBe(true);
    expect(isPublicAnalyticsPath("/sq/pricing")).toBe(true);
  });

  it("blocks all /adminx routes", () => {
    expect(isPublicAnalyticsPath("/adminx")).toBe(false);
    expect(isPublicAnalyticsPath("/adminx/")).toBe(false);
    expect(isPublicAnalyticsPath("/adminx/users")).toBe(false);
    expect(isPublicAnalyticsPath("/adminx/analytics")).toBe(false);
    expect(isPublicAnalyticsPath("/adminx/settings?tab=email")).toBe(false);
  });

  it("blocks signed-in client dashboard shell", () => {
    expect(isPublicAnalyticsPath("/en/dashboard")).toBe(false);
    expect(isPublicAnalyticsPath("/en/dashboard/")).toBe(false);
    expect(isPublicAnalyticsPath("/en/dashboard/account")).toBe(false);
    expect(isPublicAnalyticsPath("/sq/dashboard/help")).toBe(false);
    expect(isPublicAnalyticsPath("/de/dashboard?tab=1")).toBe(false);
    expect(isPublicAnalyticsPath("/en/purchases")).toBe(false);
    expect(isPublicAnalyticsPath("/sq/purchases/")).toBe(false);
  });
});

describe("isSiteTrackingPath", () => {
  it("allows public and client area", () => {
    expect(isSiteTrackingPath("/en")).toBe(true);
    expect(isSiteTrackingPath("/en/pricing")).toBe(true);
    expect(isSiteTrackingPath("/en/dashboard")).toBe(true);
    expect(isSiteTrackingPath("/sq/purchases")).toBe(true);
    expect(isSiteTrackingPath("/en/checkout")).toBe(true);
  });

  it("blocks admin only", () => {
    expect(isSiteTrackingPath("/adminx")).toBe(false);
    expect(isSiteTrackingPath("/adminx/analytics")).toBe(false);
  });
});
