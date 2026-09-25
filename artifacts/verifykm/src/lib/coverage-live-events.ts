export type CoverageLiveEventKey =
  | "live_feed_ping_accident"
  | "live_feed_ping_auction"
  | "live_feed_ping_insurance"
  | "live_feed_ping_salvage"
  | "live_feed_ping_theft";

export const COVERAGE_LIVE_EVENT_KEYS: CoverageLiveEventKey[] = [
  "live_feed_ping_accident",
  "live_feed_ping_auction",
  "live_feed_ping_insurance",
  "live_feed_ping_salvage",
  "live_feed_ping_theft",
];

export type CoverageLiveCity = {
  id: string;
  coordinates: [number, number];
  cityLabelKey: string;
  region: "americas" | "asia";
};

/** Decorative city pool — illustrative pings only, not real provider data. */
export const COVERAGE_LIVE_CITIES: CoverageLiveCity[] = [
  { id: "nyc", coordinates: [-74.0, 40.7], cityLabelKey: "live_city_nyc", region: "americas" },
  { id: "la", coordinates: [-118.25, 34.05], cityLabelKey: "live_city_la", region: "americas" },
  { id: "chicago", coordinates: [-87.62, 41.88], cityLabelKey: "live_city_chicago", region: "americas" },
  { id: "houston", coordinates: [-95.37, 29.76], cityLabelKey: "live_city_houston", region: "americas" },
  { id: "miami", coordinates: [-80.19, 25.76], cityLabelKey: "live_city_miami", region: "americas" },
  { id: "dallas", coordinates: [-96.8, 32.78], cityLabelKey: "live_city_dallas", region: "americas" },
  { id: "atlanta", coordinates: [-84.39, 33.75], cityLabelKey: "live_city_atlanta", region: "americas" },
  { id: "denver", coordinates: [-104.99, 39.74], cityLabelKey: "live_city_denver", region: "americas" },
  { id: "phoenix", coordinates: [-112.07, 33.45], cityLabelKey: "live_city_phoenix", region: "americas" },
  { id: "seattle", coordinates: [-122.33, 47.61], cityLabelKey: "live_city_seattle", region: "americas" },
  { id: "toronto", coordinates: [-79.38, 43.65], cityLabelKey: "live_city_toronto", region: "americas" },
  { id: "vancouver", coordinates: [-123.12, 49.28], cityLabelKey: "live_city_vancouver", region: "americas" },
  { id: "montreal", coordinates: [-73.57, 45.5], cityLabelKey: "live_city_montreal", region: "americas" },
  { id: "calgary", coordinates: [-114.07, 51.05], cityLabelKey: "live_city_calgary", region: "americas" },
  { id: "seoul", coordinates: [126.98, 37.57], cityLabelKey: "live_city_seoul", region: "asia" },
  { id: "busan", coordinates: [129.08, 35.18], cityLabelKey: "live_city_busan", region: "asia" },
  { id: "incheon", coordinates: [126.71, 37.46], cityLabelKey: "live_city_incheon", region: "asia" },
  { id: "shanghai", coordinates: [121.47, 31.23], cityLabelKey: "live_city_shanghai", region: "asia" },
  { id: "beijing", coordinates: [116.4, 39.9], cityLabelKey: "live_city_beijing", region: "asia" },
  { id: "guangzhou", coordinates: [113.26, 23.13], cityLabelKey: "live_city_guangzhou", region: "asia" },
  { id: "shenzhen", coordinates: [114.06, 22.55], cityLabelKey: "live_city_shenzhen", region: "asia" },
  { id: "chengdu", coordinates: [104.07, 30.67], cityLabelKey: "live_city_chengdu", region: "asia" },
  { id: "tokyo", coordinates: [139.69, 35.69], cityLabelKey: "live_city_tokyo", region: "asia" },
  { id: "osaka", coordinates: [135.5, 34.69], cityLabelKey: "live_city_osaka", region: "asia" },
  { id: "nagoya", coordinates: [136.91, 35.18], cityLabelKey: "live_city_nagoya", region: "asia" },
  { id: "yokohama", coordinates: [139.64, 35.44], cityLabelKey: "live_city_yokohama", region: "asia" },
  { id: "fukuoka", coordinates: [130.4, 33.59], cityLabelKey: "live_city_fukuoka", region: "asia" },
  { id: "dubai", coordinates: [55.27, 25.2], cityLabelKey: "live_city_dubai", region: "asia" },
  { id: "abu-dhabi", coordinates: [54.37, 24.45], cityLabelKey: "live_city_abu_dhabi", region: "asia" },
  { id: "sharjah", coordinates: [55.39, 25.35], cityLabelKey: "live_city_sharjah", region: "asia" },
];

export type MapLivePingRegion = "americas" | "asia";

export function citiesForMapRegion(region: MapLivePingRegion): CoverageLiveCity[] {
  return COVERAGE_LIVE_CITIES.filter((c) => c.region === region);
}

export function citiesForCountry(cityIds: string[]): CoverageLiveCity[] {
  const idSet = new Set(cityIds);
  return COVERAGE_LIVE_CITIES.filter((c) => idSet.has(c.id));
}

export type ActiveMapLivePing = {
  pingId: string;
  city: CoverageLiveCity;
  eventKey: CoverageLiveEventKey;
  showLabel: boolean;
};
