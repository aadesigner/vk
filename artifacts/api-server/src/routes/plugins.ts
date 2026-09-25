import { Router } from "express";
import rateLimit from "express-rate-limit";
import { isCrawlerUserAgent } from "../lib/crawlerDetection.js";
import { resolveRequestCountryCodeAsync } from "../lib/geoCountry.js";
import { getPluginSettings } from "../lib/pluginSettingsCache.js";
import { resolveLanguageForCountry } from "../lib/pluginSettings.js";
import { shouldSkipPublicRateLimit } from "../lib/clientGuard.js";

const router = Router();

const geoLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => shouldSkipPublicRateLimit(req),
  message: { error: "Too many requests." },
});

/**
 * GET /plugins/geo-language — lightweight geo language hint for real visitors only.
 * Does not redirect; client applies replace navigation. Crawlers always get null.
 */
router.get("/plugins/geo-language", geoLimiter, async (req, res) => {
  const ua = req.headers["user-agent"];
  if (isCrawlerUserAgent(ua)) {
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ enabled: false, suggestedLanguage: null, countryCode: null, crawler: true });
    return;
  }

  const settings = await getPluginSettings();
  const plugin = settings.geoLanguageRedirect;
  if (!plugin.enabled) {
    res.setHeader("Cache-Control", "public, max-age=120");
    res.json({ enabled: false, suggestedLanguage: null, countryCode: null });
    return;
  }

  const countryCode = await resolveRequestCountryCodeAsync(req);
  const suggestedLanguage = resolveLanguageForCountry(countryCode, settings);

  res.setHeader("Cache-Control", "private, no-store");
  res.json({
    enabled: true,
    suggestedLanguage,
    countryCode,
    rememberUserChoice: plugin.rememberUserChoice,
  });
});

export default router;
