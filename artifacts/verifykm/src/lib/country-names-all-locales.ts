export const COVERAGE_COUNTRY_NAME_KEYS = [
  "country_usa_name",
  "country_korea_name",
  "country_canada_name",
  "country_china_name",
  "country_japan_name",
  "country_uae_name",
] as const;

export type CoverageCountryNameKey = (typeof COVERAGE_COUNTRY_NAME_KEYS)[number];
