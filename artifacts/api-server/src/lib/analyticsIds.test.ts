import { describe, it, expect } from "vitest";
import {
  normalizeGtmContainerId,
  normalizeGaMeasurementId,
  normalizeClarityProjectId,
  normalizeMetaPixelId,
  resolveClarityProjectId,
  validateAnalyticsSettingsPatch,
  validateAnalyticsSettingsMerged,
} from "./analyticsIds.js";

describe("normalizeGtmContainerId", () => {
  it("accepts valid GTM IDs", () => {
    expect(normalizeGtmContainerId("gtm-abc123")).toBe("GTM-ABC123");
    expect(normalizeGtmContainerId(" GTM-ABC123 ")).toBe("GTM-ABC123");
  });

  it("rejects invalid IDs", () => {
    expect(normalizeGtmContainerId("G-ABC123")).toBeNull();
    expect(normalizeGtmContainerId("")).toBeNull();
  });
});

describe("normalizeGaMeasurementId", () => {
  it("accepts GA4 and UA IDs", () => {
    expect(normalizeGaMeasurementId("g-abc123xyz")).toBe("G-ABC123XYZ");
    expect(normalizeGaMeasurementId("UA-123456-1")).toBe("UA-123456-1");
  });

  it("rejects invalid IDs", () => {
    expect(normalizeGaMeasurementId("GTM-ABC")).toBeNull();
  });
});

describe("normalizeClarityProjectId", () => {
  it("accepts valid Clarity project IDs", () => {
    expect(normalizeClarityProjectId("xltusyn0a9")).toBe("xltusyn0a9");
    expect(normalizeClarityProjectId(" XLTUSYN0A9 ")).toBe("xltusyn0a9");
  });

  it("rejects invalid IDs", () => {
    expect(normalizeClarityProjectId("ab")).toBeNull();
    expect(normalizeClarityProjectId("bad-id!")).toBeNull();
  });
});

describe("normalizeMetaPixelId", () => {
  it("accepts numeric pixel IDs", () => {
    expect(normalizeMetaPixelId("123456789012345")).toBe("123456789012345");
    expect(normalizeMetaPixelId(" 9876543210 ")).toBe("9876543210");
  });

  it("rejects invalid IDs", () => {
    expect(normalizeMetaPixelId("")).toBeNull();
    expect(normalizeMetaPixelId("abc")).toBeNull();
    expect(normalizeMetaPixelId("12")).toBeNull();
    expect(normalizeMetaPixelId("123456789012345678901")).toBeNull();
  });
});

describe("resolveClarityProjectId", () => {
  it("prefers DB value over env", () => {
    const prev = process.env.CLARITY_PROJECT_ID;
    process.env.CLARITY_PROJECT_ID = "envonly12";
    expect(resolveClarityProjectId({ analyticsClarityProjectId: "dbvalue01" })).toBe("dbvalue01");
    process.env.CLARITY_PROJECT_ID = prev;
  });

  it("falls back to env when DB is empty", () => {
    const prev = process.env.CLARITY_PROJECT_ID;
    process.env.CLARITY_PROJECT_ID = "envonly12";
    expect(resolveClarityProjectId({ analyticsClarityProjectId: null })).toBe("envonly12");
    process.env.CLARITY_PROJECT_ID = prev;
  });
});

describe("validateAnalyticsSettingsPatch", () => {
  it("requires container ID when GTM is enabled", () => {
    const patch = { analyticsGtmEnabled: true, analyticsGtmContainerId: null };
    expect(validateAnalyticsSettingsPatch(patch)).toContain("container ID");
  });

  it("normalizes valid IDs in patch", () => {
    const patch = { analyticsGtmContainerId: "gtm-abc123" };
    expect(validateAnalyticsSettingsPatch(patch)).toBeNull();
    expect(patch.analyticsGtmContainerId).toBe("GTM-ABC123");
  });

  it("normalizes Clarity project ID in patch", () => {
    const patch = { analyticsClarityProjectId: " XLTUSYN0A9 " };
    expect(validateAnalyticsSettingsPatch(patch)).toBeNull();
    expect(patch.analyticsClarityProjectId).toBe("xltusyn0a9");
  });

  it("requires Pixel ID when Meta Pixel is enabled", () => {
    const patch = { analyticsMetaPixelEnabled: true, analyticsMetaPixelId: null };
    expect(validateAnalyticsSettingsPatch(patch)).toContain("Pixel ID");
  });

  it("normalizes Meta Pixel ID in patch", () => {
    const patch = { analyticsMetaPixelId: " 123456789012345 " };
    expect(validateAnalyticsSettingsPatch(patch)).toBeNull();
    expect(patch.analyticsMetaPixelId).toBe("123456789012345");
  });
});

describe("validateAnalyticsSettingsMerged", () => {
  it("allows Clarity enabled with env-only project ID", () => {
    const prev = process.env.CLARITY_PROJECT_ID;
    process.env.CLARITY_PROJECT_ID = "envonly12";
    expect(
      validateAnalyticsSettingsMerged(
        { analyticsClarityEnabled: true, analyticsClarityProjectId: null },
        null,
      ),
    ).toBeNull();
    process.env.CLARITY_PROJECT_ID = prev;
  });

  it("requires Meta Pixel ID when enabled", () => {
    expect(
      validateAnalyticsSettingsMerged(
        { analyticsMetaPixelEnabled: true, analyticsMetaPixelId: null },
        null,
      ),
    ).toContain("Pixel ID");
  });
});
