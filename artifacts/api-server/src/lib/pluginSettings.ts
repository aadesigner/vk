export const PLUGIN_LANGS = ["en", "de", "es", "fr", "sq", "pl", "ro", "bg", "ka", "ar", "uk", "ru", "zh"] as const;
export type PluginLanguage = (typeof PLUGIN_LANGS)[number];
/** Chinese-speaking regions — default geo redirect target is `zh` (Simplified). */
export const CHINESE_SPEAKING_COUNTRIES = ["CN", "TW", "HK", "MO", "SG"] as const;
/** Georgia — default geo redirect target is `ka` (Georgian). */
export const GEORGIAN_GEO_COUNTRIES = ["GE"] as const;


/** Never geo-redirect these ISO codes — even if added to a rule by mistake. */
export const GEO_REDIRECT_BLOCKLIST = ["IL"] as const;

export type GeoLanguageRule = {
  countries: string[];
  language: PluginLanguage;
};

export type GeoLanguageRedirectPlugin = {
  enabled: boolean;
  /** When true, a manual language switch is stored and overrides geo redirect. */
  rememberUserChoice: boolean;
  rules: GeoLanguageRule[];
};

export type PluginSettings = {
  geoLanguageRedirect: GeoLanguageRedirectPlugin;
};

/** Pre-configured country → language rules (first match wins). */
export const DEFAULT_GEO_LANGUAGE_RULES: GeoLanguageRule[] = [
  { countries: ["AL", "XK", "MK", "ME"], language: "sq" },
  { countries: ["DE", "AT", "LI", "CH"], language: "de" },
  {
    countries: [
      "ES", "MX", "AR", "CO", "PE", "CL", "VE", "EC", "GT", "BO", "DO", "HN", "PY", "SV", "NI", "CR", "PA", "UY",
    ],
    language: "es",
  },
  { countries: ["FR", "BE", "LU", "MC"], language: "fr" },
  { countries: ["UA"], language: "uk" },
  { countries: ["RO", "MD"], language: "ro" },
  { countries: ["PL"], language: "pl" },
  { countries: ["BG"], language: "bg" },
  { countries: ["GE"], language: "ka" },
  {
    countries: [
      "SA", "AE", "EG", "IQ", "JO", "LB", "KW", "QA", "BH", "OM",
      "MA", "DZ", "TN", "LY", "YE", "PS", "SY", "SD", "MR", "DJ", "SO", "KM",
    ],
    language: "ar",
  },
  { countries: ["RU", "BY", "KZ", "KG"], language: "ru" },
  { countries: ["CN", "TW", "HK", "MO", "SG"], language: "zh" },
];

export const DEFAULT_PLUGIN_SETTINGS: PluginSettings = {
  geoLanguageRedirect: {
    enabled: true,
    rememberUserChoice: true,
    rules: DEFAULT_GEO_LANGUAGE_RULES,
  },
};

const LANG_SET = new Set<string>(PLUGIN_LANGS);
const COUNTRY_RE = /^[A-Z]{2}$/;
const BLOCKLIST = new Set<string>(GEO_REDIRECT_BLOCKLIST);

function isBlocklistedCountry(code: string): boolean {
  return BLOCKLIST.has(code);
}

function normalizeCountry(code: unknown): string | null {
  if (typeof code !== "string") return null;
  const upper = code.trim().toUpperCase();
  if (!COUNTRY_RE.test(upper)) return null;
  return upper;
}

function normalizeLanguage(value: unknown): PluginLanguage | null {
  if (typeof value !== "string") return null;
  const lower = value.trim().toLowerCase();
  return LANG_SET.has(lower) ? (lower as PluginLanguage) : null;
}

export function normalizeGeoLanguageRules(input: unknown): GeoLanguageRule[] {
  if (!Array.isArray(input)) return [];
  const out: GeoLanguageRule[] = [];
  for (const row of input) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const language = normalizeLanguage((row as { language?: unknown }).language);
    if (!language) continue;
    const rawCountries = (row as { countries?: unknown }).countries;
    const countries: string[] = [];
    if (Array.isArray(rawCountries)) {
      for (const c of rawCountries) {
        const norm = normalizeCountry(c);
        if (norm && !countries.includes(norm) && !isBlocklistedCountry(norm)) countries.push(norm);
      }
    }
    if (countries.length === 0) continue;
    out.push({ countries, language });
  }
  return out;
}

export function mergeMissingChineseGeoRule(settings: PluginSettings): PluginSettings {
  const assigned = new Set(settings.geoLanguageRedirect.rules.flatMap((rule) => rule.countries));
  const missing = CHINESE_SPEAKING_COUNTRIES.filter((code) => !assigned.has(code));
  if (missing.length === 0) return settings;

  const rules = settings.geoLanguageRedirect.rules.map((rule) => ({
    countries: [...rule.countries],
    language: rule.language,
  }));
  const zhRule = rules.find((rule) => rule.language === "zh");
  if (zhRule) {
    for (const code of missing) {
      if (!zhRule.countries.includes(code)) zhRule.countries.push(code);
    }
  } else {
    rules.push({ countries: [...missing], language: "zh" });
  }

  return normalizePluginSettings({
    geoLanguageRedirect: {
      ...settings.geoLanguageRedirect,
      rules,
    },
  });
}

/** Ensure GE → ka exists on installs that saved plugin_settings before Georgian was added. */
export function mergeMissingGeorgianGeoRule(settings: PluginSettings): PluginSettings {
  const assigned = new Set(settings.geoLanguageRedirect.rules.flatMap((rule) => rule.countries));
  const missing = GEORGIAN_GEO_COUNTRIES.filter((code) => !assigned.has(code));
  if (missing.length === 0) return settings;

  const rules = settings.geoLanguageRedirect.rules.map((rule) => ({
    countries: [...rule.countries],
    language: rule.language,
  }));
  const kaRule = rules.find((rule) => rule.language === "ka");
  if (kaRule) {
    for (const code of missing) {
      if (!kaRule.countries.includes(code)) kaRule.countries.push(code);
    }
  } else {
    // Keep picker-adjacent order: after BG rule when present, else append.
    const bgIdx = rules.findIndex((rule) => rule.language === "bg");
    const entry = { countries: [...missing], language: "ka" as const };
    if (bgIdx >= 0) rules.splice(bgIdx + 1, 0, entry);
    else rules.push(entry);
  }

  return normalizePluginSettings({
    geoLanguageRedirect: {
      ...settings.geoLanguageRedirect,
      rules,
    },
  });
}

export function normalizePluginSettings(input: unknown): PluginSettings {
  const base = { ...DEFAULT_PLUGIN_SETTINGS };
  if (!input || typeof input !== "object" || Array.isArray(input)) return base;
  const obj = input as Record<string, unknown>;
  const geo = obj.geoLanguageRedirect;
  if (!geo || typeof geo !== "object" || Array.isArray(geo)) return base;
  const g = geo as Record<string, unknown>;
  const rules = normalizeGeoLanguageRules(g.rules);
  return {
    geoLanguageRedirect: {
      enabled: g.enabled !== false,
      rememberUserChoice: g.rememberUserChoice !== false,
      rules: rules.length > 0 ? rules : DEFAULT_PLUGIN_SETTINGS.geoLanguageRedirect.rules,
    },
  };
}

export function resolveLanguageForCountry(
  countryCode: string | null,
  settings: PluginSettings,
): PluginLanguage | null {
  if (!countryCode || !settings.geoLanguageRedirect.enabled) return null;
  const upper = countryCode.toUpperCase();
  if (isBlocklistedCountry(upper)) return null;
  for (const rule of settings.geoLanguageRedirect.rules) {
    if (rule.countries.includes(upper)) return rule.language;
  }
  return null;
}
