export type CountryMarket = "usa" | "korea" | "canada" | "china" | "japan" | "uae";

export type CountryMapConfig = {
  geographyName: string;
  /** Immediate neighbors — visible but subdued */
  nearbyGeographyNames: string[];
  /** Wider region — ghost context, fades toward the edges */
  extendedGeographyNames: string[];
  projection: {
    type: "geoNaturalEarth1" | "geoMercator" | "geoConicConformal";
    scale: number;
    center: [number, number];
    rotate?: [number, number];
    parallels?: [number, number];
  };
  flagCode: "us" | "ca" | "kr" | "cn" | "jp" | "ae";
  markerCoordinates: [number, number];
  liveCityIds: string[];
};

const COUNTRY_MAP_CONFIGS: Record<CountryMarket, CountryMapConfig> = {
  korea: {
    geographyName: "South Korea",
    nearbyGeographyNames: ["North Korea", "Japan", "China", "Taiwan"],
    extendedGeographyNames: ["Russia"],
    /** Natural Earth — correct peninsula + Japan proportions at regional zoom */
    projection: {
      type: "geoNaturalEarth1",
      scale: 4400,
      center: [128.0, 36.5],
    },
    flagCode: "kr",
    markerCoordinates: [127.8, 36.2],
    liveCityIds: ["seoul", "busan", "incheon"],
  },
  usa: {
    geographyName: "United States of America",
    nearbyGeographyNames: ["Canada", "Mexico"],
    extendedGeographyNames: ["Cuba", "Guatemala", "Bahamas"],
    projection: { type: "geoNaturalEarth1", scale: 900, center: [-98, 39] },
    flagCode: "us",
    markerCoordinates: [-98, 39],
    liveCityIds: [
      "nyc", "la", "chicago", "houston", "miami", "dallas",
      "atlanta", "denver", "phoenix", "seattle",
    ],
  },
  canada: {
    geographyName: "Canada",
    nearbyGeographyNames: ["United States of America"],
    extendedGeographyNames: ["Greenland", "Mexico"],
    projection: { type: "geoNaturalEarth1", scale: 750, center: [-96, 62] },
    flagCode: "ca",
    markerCoordinates: [-96, 62],
    liveCityIds: ["toronto", "vancouver", "montreal", "calgary"],
  },
  china: {
    geographyName: "China",
    nearbyGeographyNames: ["South Korea", "North Korea", "Japan", "Taiwan", "Mongolia", "India"],
    extendedGeographyNames: ["Russia", "Vietnam", "Philippines", "Kazakhstan"],
    projection: { type: "geoNaturalEarth1", scale: 950, center: [104, 35] },
    flagCode: "cn",
    markerCoordinates: [104, 35],
    liveCityIds: ["shanghai", "beijing", "guangzhou", "shenzhen", "chengdu"],
  },
  japan: {
    geographyName: "Japan",
    nearbyGeographyNames: ["South Korea", "North Korea", "China", "Taiwan", "Russia"],
    extendedGeographyNames: ["Philippines", "Mongolia"],
    projection: { type: "geoNaturalEarth1", scale: 2200, center: [138, 36] },
    flagCode: "jp",
    markerCoordinates: [138.5, 36],
    liveCityIds: ["tokyo", "osaka", "nagoya", "yokohama", "fukuoka"],
  },
  uae: {
    geographyName: "United Arab Emirates",
    nearbyGeographyNames: ["Saudi Arabia", "Oman", "Iran", "Qatar"],
    extendedGeographyNames: ["Iraq", "Kuwait", "Bahrain", "Yemen"],
    projection: { type: "geoNaturalEarth1", scale: 4800, center: [55.3, 24.5] },
    flagCode: "ae",
    markerCoordinates: [55.3, 25.2],
    liveCityIds: ["dubai", "abu-dhabi", "sharjah"],
  },
};

/** Slugs with the map-hero layout enabled — expand after prototype review. */
export const COUNTRY_MAP_ENABLED_SLUGS: CountryMarket[] = [];

export function getCountryMapConfig(slug: CountryMarket): CountryMapConfig {
  return COUNTRY_MAP_CONFIGS[slug];
}

export function isCountryMapHeroEnabled(slug: string): slug is CountryMarket {
  return (COUNTRY_MAP_ENABLED_SLUGS as string[]).includes(slug);
}

/** Approximate centroid longitude for east-west fade on context countries. */
export const GEOGRAPHY_LON: Record<string, number> = {
  "South Korea": 127.8,
  "North Korea": 127.2,
  Japan: 138.0,
  China: 104.0,
  Taiwan: 121.0,
  Russia: 100.0,
  Philippines: 122.0,
  Mongolia: 103.0,
  Vietnam: 108.0,
};

export function geographyTier(
  name: string,
  config: CountryMapConfig,
): "focus" | "near" | "extended" | null {
  if (name === config.geographyName) return "focus";
  if (config.nearbyGeographyNames.includes(name)) return "near";
  if (config.extendedGeographyNames.includes(name)) return "extended";
  return null;
}

/** Fade context countries further east so the right side dissolves naturally. */
export function eastFadeMultiplier(name: string, centerLon: number): number {
  const lon = GEOGRAPHY_LON[name];
  if (lon == null) return 1;
  const delta = lon - centerLon;
  if (delta <= 4) return 1;
  return Math.max(0.12, 1 - (delta - 4) / 36);
}
