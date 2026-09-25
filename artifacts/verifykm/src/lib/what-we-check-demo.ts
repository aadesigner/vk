import type { WhatWeCheckMarket } from "./what-we-check-features";
import { demoCarPhotoUrl } from "./demo-car-photos";

export type WwcDemoFinding = {
  labelKey: string;
  valueKey: string;
  tone: "positive" | "negative" | "neutral";
};

export type WwcDemoHistoryRow = {
  date: string;
  primary: string;
  primaryKey?: string;
  detailKey: string;
};

export type WwcDemoReport = {
  vin: string;
  vehicleTitle: string;
  make: string;
  model: string;
  year: number;
  trim: string;
  engine: string;
  transmission: string;
  fuelKey: string;
  colorKey: string;
  bodyKey: string;
  odometer: number;
  score: string;
  scoreLabelKey: "report_caution" | "report_clean" | "report_risk";
  originKey: string;
  photoUrl: string;
  ownerCount: number;
  findings: Record<"mileage" | "accidents" | "salvage" | "theft", WwcDemoFinding>;
  mileageRows: WwcDemoHistoryRow[];
  accidentRows: WwcDemoHistoryRow[];
  ownerRows: WwcDemoHistoryRow[];
};

const KOREA_DEMO: WwcDemoReport = {
  vin: "KNDPM3AC9K7583241",
  vehicleTitle: "2019 Kia Sportage",
  make: "Kia",
  model: "Sportage",
  year: 2019,
  trim: "GT-Line 2.0 CRDi",
  engine: "2.0 CRDi",
  transmission: "Automatic",
  fuelKey: "wwc_demo_fuel_diesel",
  colorKey: "wwc_demo_color_white",
  bodyKey: "wwc_demo_body_suv",
  odometer: 138_600,
  score: "6.4",
  scoreLabelKey: "report_caution",
  originKey: "country_korea_name",
  photoUrl: demoCarPhotoUrl("kia-sportage.jpg"),
  ownerCount: 3,
  findings: {
    mileage: { labelKey: "mock_label_mileage", valueKey: "wwc_preview_mileage_status", tone: "negative" },
    accidents: { labelKey: "mock_label_accidents", valueKey: "wwc_preview_accidents_status", tone: "negative" },
    salvage: { labelKey: "mock_label_salvage", valueKey: "wwc_preview_salvage_status", tone: "positive" },
    theft: { labelKey: "mock_label_stolen", valueKey: "wwc_preview_theft_status", tone: "positive" },
  },
  mileageRows: [
    { date: "2019-11", primary: "42,100 km", detailKey: "wwc_demo_row_registration" },
    { date: "2021-04", primary: "89,200 km", detailKey: "wwc_demo_row_insurance" },
    { date: "2022-03", primary: "64,500 km", detailKey: "wwc_demo_row_rollback" },
    { date: "2023-08", primary: "138,600 km", detailKey: "wwc_demo_row_auction" },
  ],
  accidentRows: [
    { date: "2022-06", primary: "", primaryKey: "wwc_demo_event_front", detailKey: "wwc_demo_row_repair_front" },
    { date: "2020-03", primary: "", primaryKey: "wwc_demo_event_rear", detailKey: "wwc_demo_row_repair_rear" },
  ],
  ownerRows: [
    { date: "2023-01", primary: "", primaryKey: "wwc_demo_owner_private", detailKey: "wwc_demo_row_owner_private" },
    { date: "2021-07", primary: "", primaryKey: "wwc_demo_owner_fleet", detailKey: "wwc_demo_row_owner_fleet" },
    { date: "2019-11", primary: "", primaryKey: "wwc_demo_owner_dealer", detailKey: "wwc_demo_row_owner_dealer" },
  ],
};

const MARKET_DEMOS: Partial<Record<WhatWeCheckMarket, Partial<WwcDemoReport>>> = {
  usa: {
    vehicleTitle: "2018 Honda CR-V",
    make: "Honda",
    model: "CR-V",
    year: 2018,
    trim: "EX 2.0 i-VTEC",
    engine: "2.0 i-VTEC",
    originKey: "country_usa_name",
    photoUrl: demoCarPhotoUrl("honda-crv.jpg"),
    vin: "2HKRW2H50JH612847",
  },
  canada: {
    vehicleTitle: "2022 Toyota RAV4",
    make: "Toyota",
    model: "RAV4",
    year: 2022,
    trim: "XLE AWD",
    engine: "2.5L",
    originKey: "country_canada_name",
    photoUrl: demoCarPhotoUrl("toyota-rav4.jpg"),
    vin: "2T3P1RFV8NW218394",
  },
  china: {
    vehicleTitle: "BYD Han EV",
    make: "BYD",
    model: "Han",
    year: 2023,
    trim: "EV Premium",
    engine: "Electric",
    fuelKey: "wwc_demo_fuel_electric",
    originKey: "country_china_name",
    photoUrl: demoCarPhotoUrl("byd-han-ev.jpg"),
    vin: "LC0C76C45N0123456",
  },
  japan: {
    vehicleTitle: "Toyota Prius",
    make: "Toyota",
    model: "Prius",
    year: 2021,
    trim: "S",
    engine: "1.8 Hybrid",
    originKey: "country_japan_name",
    photoUrl: demoCarPhotoUrl("toyota-prius.jpg"),
    vin: "JTDKN3DU5A0123456",
  },
  uae: {
    vehicleTitle: "2019 Mercedes-Benz C200",
    make: "Mercedes-Benz",
    model: "C-Class",
    year: 2019,
    trim: "C200 Avantgarde",
    engine: "2.0 Turbo",
    originKey: "country_uae_name",
    photoUrl: demoCarPhotoUrl("mercedes-c-class.jpg"),
    vin: "WDDWF4KB0KR123456",
  },
};

export function getWhatWeCheckDemoReport(market?: WhatWeCheckMarket): WwcDemoReport {
  const base = KOREA_DEMO;
  if (!market || market === "korea") return base;
  const patch = MARKET_DEMOS[market];
  if (!patch) return base;
  return { ...base, ...patch };
}
