import type { GeoLanguageRuleForm } from "@/lib/plugin-config";

/** Mirrors server `DEFAULT_GEO_LANGUAGE_RULES` for admin plugin UI. */
export const DEFAULT_GEO_LANGUAGE_RULES: GeoLanguageRuleForm[] = [
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
