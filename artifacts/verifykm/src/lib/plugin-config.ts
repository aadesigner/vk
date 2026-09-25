import { DEFAULT_GEO_LANGUAGE_RULES } from "@/lib/geo-language-defaults";

/** ISO 3166-1 alpha-2 codes available in the geo redirect plugin admin UI. */
export const GEO_PLUGIN_COUNTRIES = [
  { code: "AL", name: "Albania" },
  { code: "XK", name: "Kosovo" },
  { code: "MK", name: "North Macedonia" },
  { code: "ME", name: "Montenegro" },
  { code: "UA", name: "Ukraine" },
  { code: "RU", name: "Russia" },
  { code: "BY", name: "Belarus" },
  { code: "KZ", name: "Kazakhstan" },
  { code: "KG", name: "Kyrgyzstan" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "KR", name: "South Korea" },
  { code: "CN", name: "China" },
  { code: "TW", name: "Taiwan" },
  { code: "HK", name: "Hong Kong" },
  { code: "MO", name: "Macau" },
  { code: "SG", name: "Singapore" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "AT", name: "Austria" },
  { code: "CH", name: "Switzerland" },
  { code: "LI", name: "Liechtenstein" },
  { code: "FR", name: "France" },
  { code: "BE", name: "Belgium" },
  { code: "LU", name: "Luxembourg" },
  { code: "MC", name: "Monaco" },
  { code: "BG", name: "Bulgaria" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "MX", name: "Mexico" },
  { code: "AR", name: "Argentina" },
  { code: "CO", name: "Colombia" },
  { code: "PE", name: "Peru" },
  { code: "CL", name: "Chile" },
  { code: "VE", name: "Venezuela" },
  { code: "EC", name: "Ecuador" },
  { code: "GT", name: "Guatemala" },
  { code: "BO", name: "Bolivia" },
  { code: "DO", name: "Dominican Republic" },
  { code: "HN", name: "Honduras" },
  { code: "PY", name: "Paraguay" },
  { code: "SV", name: "El Salvador" },
  { code: "NI", name: "Nicaragua" },
  { code: "CR", name: "Costa Rica" },
  { code: "PA", name: "Panama" },
  { code: "UY", name: "Uruguay" },
  { code: "TR", name: "Turkey" },
  { code: "PL", name: "Poland" },
  { code: "GE", name: "Georgia" },
  { code: "RO", name: "Romania" },
  { code: "RS", name: "Serbia" },
  { code: "BA", name: "Bosnia and Herzegovina" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "EG", name: "Egypt" },
  { code: "IQ", name: "Iraq" },
  { code: "JO", name: "Jordan" },
  { code: "LB", name: "Lebanon" },
  { code: "KW", name: "Kuwait" },
  { code: "QA", name: "Qatar" },
  { code: "BH", name: "Bahrain" },
  { code: "OM", name: "Oman" },
  { code: "MA", name: "Morocco" },
  { code: "DZ", name: "Algeria" },
  { code: "TN", name: "Tunisia" },
  { code: "LY", name: "Libya" },
  { code: "YE", name: "Yemen" },
  { code: "PS", name: "Palestine" },
  { code: "IL", name: "Israel" },
  { code: "SY", name: "Syria" },
  { code: "SD", name: "Sudan" },
  { code: "MR", name: "Mauritania" },
  { code: "DJ", name: "Djibouti" },
  { code: "SO", name: "Somalia" },
  { code: "KM", name: "Comoros" },
] as const;

export const PLUGIN_LANGUAGE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "de", label: "German (Deutsch)" },
  { code: "es", label: "Spanish (Español)" },
  { code: "fr", label: "French (Français)" },
  { code: "sq", label: "Albanian (Shqip)" },
  { code: "pl", label: "Polish (Polski)" },
  { code: "ro", label: "Romanian (Română)" },
  { code: "bg", label: "Bulgarian (Български)" },
  { code: "ka", label: "Georgian (ქართული)" },
  { code: "ar", label: "Arabic" },
  { code: "uk", label: "Ukrainian" },
  { code: "ru", label: "Russian" },
  { code: "zh", label: "Chinese (中文)" },
] as const;

export type PluginLanguageCode = (typeof PLUGIN_LANGUAGE_OPTIONS)[number]["code"];

export type GeoLanguageRuleForm = {
  countries: string[];
  language: PluginLanguageCode;
};

export type GeoRedirectPluginForm = {
  enabled: boolean;
  rememberUserChoice: boolean;
  rules: GeoLanguageRuleForm[];
};

export type PluginsForm = {
  geoLanguageRedirect: GeoRedirectPluginForm;
};

export const DEFAULT_PLUGINS_FORM: PluginsForm = {
  geoLanguageRedirect: {
    enabled: true,
    rememberUserChoice: true,
    rules: DEFAULT_GEO_LANGUAGE_RULES,
  },
};
