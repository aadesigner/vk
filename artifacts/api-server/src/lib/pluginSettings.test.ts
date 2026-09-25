import { describe, it, expect } from "vitest";
import {
  normalizePluginSettings,
  resolveLanguageForCountry,
  mergeMissingChineseGeoRule,
  mergeMissingGeorgianGeoRule,
  DEFAULT_PLUGIN_SETTINGS,
} from "./pluginSettings.js";
import { isCrawlerUserAgent } from "./crawlerDetection.js";

describe("pluginSettings", () => {
  it("normalizes geo redirect rules", () => {
    const s = normalizePluginSettings({
      geoLanguageRedirect: {
        enabled: true,
        rememberUserChoice: false,
        rules: [
          { countries: ["al", "XK", "bad"], language: "sq" },
          { countries: ["UA"], language: "uk" },
          { countries: [], language: "en" },
        ],
      },
    });
    expect(s.geoLanguageRedirect.enabled).toBe(true);
    expect(s.geoLanguageRedirect.rememberUserChoice).toBe(false);
    expect(s.geoLanguageRedirect.rules[0]?.countries).toEqual(["AL", "XK"]);
  });

  it("resolves language for country when enabled", () => {
    const settings = normalizePluginSettings({
      geoLanguageRedirect: {
        enabled: true,
        rules: DEFAULT_PLUGIN_SETTINGS.geoLanguageRedirect.rules,
      },
    });
    expect(resolveLanguageForCountry("DE", settings)).toBe("de");
    expect(resolveLanguageForCountry("AT", settings)).toBe("de");
    expect(resolveLanguageForCountry("CH", settings)).toBe("de");
    expect(resolveLanguageForCountry("FR", settings)).toBe("fr");
    expect(resolveLanguageForCountry("BE", settings)).toBe("fr");
    expect(resolveLanguageForCountry("BG", settings)).toBe("bg");
    expect(resolveLanguageForCountry("AL", settings)).toBe("sq");
    expect(resolveLanguageForCountry("MK", settings)).toBe("sq");
    expect(resolveLanguageForCountry("MX", settings)).toBe("es");
    expect(resolveLanguageForCountry("ES", settings)).toBe("es");
    expect(resolveLanguageForCountry("CO", settings)).toBe("es");
    expect(resolveLanguageForCountry("AR", settings)).toBe("es");
    expect(resolveLanguageForCountry("PE", settings)).toBe("es");
    expect(resolveLanguageForCountry("UA", settings)).toBe("uk");
    expect(resolveLanguageForCountry("RO", settings)).toBe("ro");
    expect(resolveLanguageForCountry("MD", settings)).toBe("ro");
    expect(resolveLanguageForCountry("PL", settings)).toBe("pl");
    expect(resolveLanguageForCountry("GE", settings)).toBe("ka");
    expect(resolveLanguageForCountry("SA", settings)).toBe("ar");
    expect(resolveLanguageForCountry("PS", settings)).toBe("ar");
    expect(resolveLanguageForCountry("RU", settings)).toBe("ru");
    expect(resolveLanguageForCountry("CN", settings)).toBe("zh");
    expect(resolveLanguageForCountry("TW", settings)).toBe("zh");
    expect(resolveLanguageForCountry("HK", settings)).toBe("zh");
    expect(resolveLanguageForCountry("SG", settings)).toBe("zh");
    expect(resolveLanguageForCountry("US", settings)).toBeNull();
    expect(resolveLanguageForCountry("IL", settings)).toBeNull();
  });

  it("never redirects blocklisted countries even if present in a rule", () => {
    const settings = normalizePluginSettings({
      geoLanguageRedirect: {
        enabled: true,
        rules: [{ countries: ["IL", "PS"], language: "ar" }],
      },
    });
    expect(settings.geoLanguageRedirect.rules[0]?.countries).toEqual(["PS"]);
    expect(resolveLanguageForCountry("IL", settings)).toBeNull();
    expect(resolveLanguageForCountry("PS", settings)).toBe("ar");
  });

  it("returns null when plugin disabled", () => {
    const disabled = normalizePluginSettings({
      geoLanguageRedirect: { enabled: false, rules: DEFAULT_PLUGIN_SETTINGS.geoLanguageRedirect.rules },
    });
    expect(resolveLanguageForCountry("AL", disabled)).toBeNull();
  });

  it("accepts zh in normalized rules", () => {
    const settings = normalizePluginSettings({
      geoLanguageRedirect: {
        enabled: true,
        rules: [{ countries: ["CN", "TW"], language: "zh" }],
      },
    });
    expect(settings.geoLanguageRedirect.rules[0]?.language).toBe("zh");
    expect(resolveLanguageForCountry("CN", settings)).toBe("zh");
  });

  it("merges missing Chinese regions into existing plugin settings", () => {
    const current = normalizePluginSettings({
      geoLanguageRedirect: {
        enabled: true,
        rules: DEFAULT_PLUGIN_SETTINGS.geoLanguageRedirect.rules.filter((r) => r.language !== "zh"),
      },
    });
    const merged = mergeMissingChineseGeoRule(current);
    expect(resolveLanguageForCountry("CN", merged)).toBe("zh");
    expect(resolveLanguageForCountry("TW", merged)).toBe("zh");
  });

  it("accepts ka in normalized rules", () => {
    const settings = normalizePluginSettings({
      geoLanguageRedirect: {
        enabled: true,
        rules: [{ countries: ["GE"], language: "ka" }],
      },
    });
    expect(settings.geoLanguageRedirect.rules[0]?.language).toBe("ka");
    expect(resolveLanguageForCountry("GE", settings)).toBe("ka");
  });

  it("merges missing Georgian geo rule into existing plugin settings", () => {
    const current = normalizePluginSettings({
      geoLanguageRedirect: {
        enabled: true,
        rules: DEFAULT_PLUGIN_SETTINGS.geoLanguageRedirect.rules.filter((r) => r.language !== "ka"),
      },
    });
    const merged = mergeMissingGeorgianGeoRule(current);
    expect(resolveLanguageForCountry("GE", merged)).toBe("ka");
  });
});

describe("crawlerDetection", () => {
  it("detects common crawlers", () => {
    expect(isCrawlerUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
    expect(isCrawlerUserAgent("facebookexternalhit/1.1")).toBe(true);
    expect(isCrawlerUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0")).toBe(false);
  });
});
