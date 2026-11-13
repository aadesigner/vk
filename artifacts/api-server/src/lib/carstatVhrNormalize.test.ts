import { describe, expect, it } from "vitest";
import {
  hasStructuredVhrReport,
  normalizeCarstatVhrJsonPayloads,
  parseVehicleTitle,
  simplifyInspectionAccidentDescription,
} from "./carstatVhrNormalize.js";

describe("carstatVhrNormalize", () => {
  it("parses vehicle titles", () => {
    expect(parseVehicleTitle("2018 Honda CR-V EX AWD")).toEqual({
      year: 2018,
      make: "Honda",
      model: "CR-V",
      trim: "EX AWD",
    });
  });

  it("maps schema v2 vehicles + listings into structured report fields", () => {
    const out = normalizeCarstatVhrJsonPayloads([
      {
        schema_version: 2,
        vin: "7FARW2H56JE022576",
        language: "en",
        source: {
          id: 2,
          sections: [
            {
              type: "vehicles",
              items: [
                {
                  year: 2018,
                  title: "2018 Honda CR-V EX AWD",
                  body_type: 5,
                  fuel: 4,
                  transmission: 1,
                  hp: 190,
                  engine_size: 1498,
                },
              ],
            },
            {
              type: "listings",
              items: [
                {
                  auction_at: "2026-08-12T10:00:00Z",
                  odometer: 93420,
                  price: 19950,
                  main_damage_id: 1,
                  second_damage_id: 2,
                  condition_label: "run and drives",
                  marketplace: "copart.com",
                  country_iso: "US",
                  location_details: { country: "US", city: "Houston", region: "TX" },
                  images: ["https://v-h-r.b-cdn.net/vhr/media/demo.webp"],
                  source_data: { currency: "USD", odometer_unit: "km" },
                },
              ],
            },
            {
              type: "equipment",
              items: [
                {
                  options: [
                    {
                      id: 101,
                      name_translations: { en: "Adaptive cruise control" },
                      description_translations: { en: "Demo" },
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    ], { vin: "7FARW2H56JE022576" });

    expect(out.dataSource).toBe("carstat_vhr");
    expect(out.make).toBe("Honda");
    expect(out.model).toBe("CR-V");
    expect(out.year).toBe(2018);
    expect(out.bodyType).toBe("SUV");
    expect(out.fuelType).toBe("Gasoline");
    expect(out.transmission).toBe("Automatic");
    expect(out.odometer).toBe(93420);
    expect(out.mileageHistory?.length).toBe(1);
    expect(out.auctionHistory?.length).toBe(1);
    expect(out.auctionHistory?.[0]?.primaryDamage).toBe("Front End");
    expect(out.auctionHistory?.[0]?.secondaryDamage).toBe("Rear End");
    // Listing damage ids alone must not invent accident rows.
    expect(out.accidents?.length ?? 0).toBe(0);
    expect(out.photos?.[0]).toContain("v-h-r.b-cdn.net");
    expect(out.vehicleExtras?.some((x) => x.label === "Adaptive cruise control")).toBe(true);
    expect(out.marketData?.lastAuctionPrice).toBe(19950);
    expect(hasStructuredVhrReport({ ...out, dataSource: "carstat_vhr" })).toBe(true);
  });

  it("does not mix Archive Alpha EU stubs / Euro 6 / marketplace-as-service onto US Copart cars", () => {
    const out = normalizeCarstatVhrJsonPayloads(
      [
        {
          schema_version: 2,
          vin: "7FARW2H56JE022576",
          source: {
            id: 1,
            sections: [
              {
                type: "vehicles",
                items: [{ year: 2018, title: "2018 Honda CR-V EX AWD" }],
              },
              {
                type: "listings",
                items: [
                  {
                    sale_date: "2026-04-15",
                    final_price: 11550,
                    currency: "USD",
                    marketplace: "copart.com",
                    country_iso: "US",
                    odometer_km: 89420,
                    status_label: "sold",
                  },
                ],
              },
            ],
          },
        },
        {
          schema_version: 2,
          vin: "7FARW2H56JE022576",
          source: {
            id: 2,
            sections: [
              {
                type: "listings",
                items: [
                  {
                    auction_at: "2026-08-12T10:00:00Z",
                    price: 19950,
                    marketplace: "European marketplace",
                    country_iso: "DE",
                    location_details: { country: "DE", city: "Houston", region: "TX, Demo region" },
                    source_data: {
                      currency: "USD",
                      emissions: { standard: "Euro 6", co2_g_km: 151 },
                      service_history: {
                        records_count: 3,
                        last_service_at: "2026-06-20",
                        last_service_odometer_km: 91920,
                      },
                    },
                  },
                  {
                    auction_at: "2026-07-02T09:00:00Z",
                    price: 20950,
                    marketplace: "Korean marketplace",
                    country_iso: "KR",
                    source_data: {
                      currency: "USD",
                      emissions: { standard: "Euro 6", co2_g_km: 151 },
                      service_history: {
                        records_count: 3,
                        last_service_at: "2026-06-20",
                        last_service_odometer_km: 91920,
                      },
                    },
                  },
                ],
              },
            ],
          },
        },
      ],
      { vin: "7FARW2H56JE022576" },
    );

    expect(out.make).toBe("Honda");
    expect(out.country).toMatch(/United States|US/i);
    expect(out.auctionHistory?.length).toBe(1);
    expect(out.auctionHistory?.[0]?.finalPrice).toBe(11550);
    expect(out.serviceHistory?.length ?? 0).toBe(0);
    expect(out.vehicleExtras?.some((x) => /euro\s*6/i.test(x.value ?? ""))).toBe(false);
    expect(out.vehicleExtras?.some((x) => /co₂|co2/i.test(x.label ?? ""))).toBe(false);
    expect(out.insuranceClaims?.length ?? 0).toBe(0);
  });

  it("collapses same-day near-duplicate mileage from Copart + marketplace stubs into one row", () => {
    const out = normalizeCarstatVhrJsonPayloads(
      [
        {
          schema_version: 2,
          vin: "7FARW2H56JE022576",
          source: {
            id: 1,
            sections: [
              {
                type: "listings",
                items: [
                  {
                    sale_date: "2026-08-12T10:00:00Z",
                    odometer_km: 93540,
                    final_price: 11200,
                    currency: "USD",
                    marketplace: "copart.com",
                    main_damage: "Front bumper repaired",
                    second_damage: "Minor body scratches",
                    status_label: "sold",
                    country_iso: "US",
                  },
                  {
                    sale_date: "2026-08-12T10:00:00Z",
                    odometer_km: 93580,
                    final_price: 11200,
                    currency: "USD",
                    marketplace: "US auction",
                    main_damage_id: 8,
                    status_label: "sold",
                    country_iso: "US",
                  },
                  {
                    sale_date: "2026-08-12T10:00:00Z",
                    odometer_km: 93500,
                    final_price: 18500,
                    currency: "USD",
                    marketplace: "Korean marketplace",
                    main_damage_id: 8,
                    status_label: "sold",
                    country_iso: "KR",
                  },
                ],
              },
            ],
          },
        },
      ],
      { vin: "7FARW2H56JE022576" },
    );

    const day = (out.mileageHistory ?? []).filter((m) => String(m.date ?? "").startsWith("2026-08-12"));
    expect(day).toHaveLength(1);
    expect(day[0]?.source).toMatch(/Copart/i);
    expect(day[0]?.odometer).toBe(93540);
    expect(day[0]?.primaryDamage).toMatch(/Front bumper repaired/i);
  });

  it("keeps pre-accident amounts intact and drops DE Houston mashup auctions on US VINs", () => {
    const out = normalizeCarstatVhrJsonPayloads(
      [
        {
          schema_version: 2,
          vin: "7FARW2H56JE022576",
          source: {
            id: 1,
            sections: [
              {
                type: "listings",
                items: [
                  {
                    sale_date: "2026-04-15",
                    final_price: 11550,
                    pre_accident_price: 20200,
                    currency: "USD",
                    marketplace: "copart.com",
                    country_iso: "US",
                    location_details: { country: "US", city: "Dallas", region: "TX" },
                    status_label: "sold",
                  },
                  {
                    sale_date: "2026-06-15",
                    final_price: 12950,
                    pre_accident_price: 21600,
                    currency: "USD",
                    marketplace: "iaai.com",
                    country_iso: "US",
                    status_label: "sold",
                  },
                  {
                    sale_date: "2026-08-15",
                    final_price: 24000350,
                    pre_accident_price: 24009000,
                    currency: "KRW",
                    marketplace: "encar.com",
                    country_id: 122,
                    status_label: "sold",
                  },
                ],
              },
            ],
          },
        },
        {
          schema_version: 2,
          source: {
            id: 3,
            sections: [
              {
                type: "listings",
                items: [
                  {
                    sale_date: "2026-08-12",
                    final_price: 19950,
                    currency: "USD",
                    auction_name: "European vehicle auction",
                    seller_country: "DE",
                    seller_location: "Houston",
                    location_details: { country: "DE", city: "Houston", region: "TX" },
                    emission_standard: "Euro 6",
                    status_label: "sold",
                  },
                ],
              },
            ],
          },
        },
      ],
      { vin: "7FARW2H56JE022576" },
    );

    expect(out.auctionHistory?.some((a) => /DE|Germany/i.test(String(a.country ?? "")))).toBe(false);
    expect(out.auctionHistory?.every((a) => !/houston/i.test(String(a.city ?? "")))).toBe(true);
    const pre = out.vehicleExtras?.filter((x) => x.label === "Pre-accident value") ?? [];
    expect(pre.every((x) => !/KRW/i.test(x.value ?? ""))).toBe(true);
    expect(pre.some((x) => /20,200 USD/.test(x.value ?? ""))).toBe(true);
    expect(pre.every((x) => !/^20 · 200/.test(x.value ?? ""))).toBe(true);
  });

  it("replaces illustrative Carstat demo Jeep photos with Honda CR-V stock", () => {
    const jeep =
      "https://v-h-r.b-cdn.net/vhr/media/017760110fc426b7d79008da1c0427467829a05cd60dcfdb3ca4a5a9a0b39f42.webp";
    const out = normalizeCarstatVhrJsonPayloads(
      [
        {
          schema_version: 2,
          vin: "7FARW2H56JE022576",
          example_note: "FREE DEMONSTRATION. Photographs are illustrative.",
          source: {
            id: 1,
            sections: [
              {
                type: "vehicles",
                items: [{ year: 2018, title: "2018 Honda CR-V EX AWD" }],
              },
              {
                type: "listings",
                items: [
                  {
                    sale_date: "2026-04-15T14:00:00Z",
                    final_price: 11550,
                    currency: "USD",
                    marketplace: "copart.com",
                    images: [jeep],
                  },
                ],
              },
            ],
          },
        },
      ],
      { vin: "7FARW2H56JE022576" },
    );

    expect(out.make).toBe("Honda");
    expect(out.photos).toEqual(["/demo-cars/honda-crv.jpg"]);
    expect(out.photosHd).toEqual(["/demo-cars/honda-crv.jpg"]);
  });

  it("keeps Copart mileage + vehicle specs when sale_date is null (uses report date)", () => {
    const out = normalizeCarstatVhrJsonPayloads([
      {
        schema_version: 2,
        generated_at: "2026-10-24T00:20:00Z",
        source: {
          id: 1,
          sections: [
            {
              type: "vehicles",
              items: [{
                title: "2026 Toyota Corola",
                year: 2026,
                fuel_label: "gasoline",
                color_label: "black",
                body_type_label: "sedan",
                transmission_label: "automatic",
                cylinders: 4,
                vehicle_type_label: "automobile",
              }],
            },
            {
              type: "listings",
              items: [{
                sale_date: null,
                odometer_km: 32955,
                odometer_mi: 20477,
                lot: "72438206",
                marketplace: "copart.com",
                currency: "USD",
                condition_label: "run and drives",
                main_damage_id: 3,
                keys_available: true,
                archived: false,
                images: ["https://example.com/a.jpg"],
              }],
            },
          ],
        },
      },
    ], { vin: "5YFB4MDE0TP377402" });

    expect(out.odometer).toBe(32955);
    expect(out.mileageHistory?.some((m) => m.odometer === 32955 && m.source === "Copart")).toBe(true);
    expect(out.mileageHistory?.find((m) => m.odometer === 32955)?.date).toBe("2026-10-24");
    expect(out.isSalvage).toBe(true);
    expect(out.mileageHistory?.some((m) => /#?\d{5,}/.test(m.lotStatus ?? ""))).toBe(false);
    expect(out.auctionHistory?.some((a) => /#?\d{5,}/.test(a.lotStatus ?? ""))).toBe(false);
    expect(out.vehicleExtras?.some((x) => /listing id/i.test(x.label ?? ""))).toBe(false);
    expect(out.fuelType).toMatch(/Gasoline/i);
    expect(out.color).toMatch(/black/i);
    expect(out.cylinders).toBe(4);
    expect(out.vehicleExtras?.some((x) => x.label === "Odometer (miles)" && x.value?.includes("20,477"))).toBe(true);
    expect(out.vehicleExtras?.some((x) => x.label === "Keys")).toBe(true);
    expect(out.photos?.length).toBe(1);
  });

  it("maps ACV / repair / price_history averages into marketData + extras", () => {
    const out = normalizeCarstatVhrJsonPayloads([
      {
        schema_version: 2,
        source: {
          id: 1,
          sections: [
            {
              type: "listings",
              items: [
                {
                  sale_date: "2026-04-15T14:00:00Z",
                  odometer_km: 89420,
                  final_price: 11550,
                  bid: 10700,
                  buy_now_price: 13200,
                  pre_accident_price: 20200,
                  estimate_repair_price: 1750,
                  actual_cash_value: 19700,
                  keys_available: true,
                  airbags_label: "intact",
                  marketplace: "copart.com",
                  currency: "USD",
                  price_history: [
                    { date: "2026-04-10", price: 9700, bid: 9000 },
                    { date: "2026-04-15", price: 11200, final_bid: 11200 },
                  ],
                },
              ],
            },
          ],
        },
      },
    ], { vin: "7FARW2H56JE022576" });

    expect(out.marketData?.estimatedValue).toBe(19700);
    expect(out.marketData?.lastAuctionPrice).toBe(11550);
    expect(out.vehicleExtras?.some((x) => x.label === "Actual cash value (ACV)")).toBe(true);
    expect(out.vehicleExtras?.some((x) => x.label === "Estimated repair cost")).toBe(true);
    expect(out.vehicleExtras?.some((x) => x.label === "Average price" && x.value?.includes("USD"))).toBe(true);
    // price_history feeds averages/extras only — not auction timeline rows.
    expect(out.auctionHistory?.some((a) => a.lotStatus === "Price history")).toBe(false);
    expect(out.auctionHistory?.length).toBe(1);
  });

  it("does not label Korean-won-scale amounts as EUR/USD", () => {
    const out = normalizeCarstatVhrJsonPayloads([
      {
        schema_version: 2,
        source: {
          id: 3,
          sections: [
            {
              type: "listings",
              items: [
                {
                  sale_date: "2026-08-15",
                  price: 41_500_000,
                  currency: "eur",
                  marketplace: "European vehicle auction",
                  seller_country: "DE",
                  price_history: [
                    { date: "2026-07-01", price_with_tax: "41,500,000 EUR" },
                    { date: "2026-08-01", price_with_tax: "40,900,000 EUR" },
                  ],
                },
              ],
            },
          ],
        },
      },
      // European VIN so the EU listing is kept (NA VINs drop EU mashups).
    ], { vin: "WVWZZZ3CZCE064077" });

    expect(out.marketData?.currency).toBe("KRW");
    expect(out.marketData?.lastAuctionPrice).toBe(41_500_000);
    expect(out.vehicleExtras?.some((x) => x.label === "Average price" && x.value?.includes("EUR"))).toBe(false);
    expect(out.vehicleExtras?.some((x) => x.label === "Average price" && /KRW/.test(x.value ?? ""))).toBe(true);
  });

  it("maps archive-beta listing identity + EUR pricing on European VINs", () => {
    const out = normalizeCarstatVhrJsonPayloads([
      {
        schema_version: 2,
        source: {
          id: 3,
          sections: [
            {
              type: "listings",
              items: [
                {
                  make: "Volkswagen",
                  model: "Passat",
                  first_reg_year: 2012,
                  trim_line: "Comfortline",
                  body_color: "Grey",
                  fuel_type: "Petrol",
                  gear_box: "Automatic",
                  engine_descr: "1.8L gasoline",
                  hp: 160,
                  mileage: 93420,
                  mileage_name: "km",
                  main_damage: "Front bumper repaired",
                  second_damage: "Minor body scratches",
                  price: 19950,
                  price_with_tax: 19950,
                  price_without_tax: 16764.71,
                  currency: "eur",
                  seller_country: "DE",
                  seller_location: "Berlin",
                  auction_name: "European vehicle auction",
                  sale_date: "2026-08-12",
                  days_to_sell: 41,
                  seats: 5,
                  price_history: [
                    { date: "2026-07-02", price_with_tax: "20,950.00 EUR" },
                    { date: "2026-08-01", price_with_tax: "19,950.00 EUR" },
                  ],
                },
              ],
            },
          ],
        },
      },
    ], { vin: "WVWZZZ3CZCE064077" });

    expect(out.make).toMatch(/Volkswagen|VW/i);
    expect(out.model).toMatch(/Passat/i);
    expect(out.year).toBe(2012);
    expect(out.color).toBe("Grey");
    expect(out.auctionHistory?.[0]?.primaryDamage).toBe("Front bumper repaired");
    expect(out.auctionHistory?.[0]?.currency).toBe("EUR");
    expect(out.marketData?.estimatedValue).toBe(20450);
    expect(out.vehicleExtras?.some((x) => x.label === "Price without tax")).toBe(true);
    expect(out.country).toMatch(/Germany|DE|Europe/i);
  });

  it("keeps Copart damage ids and drops Encar mashups on US-origin VINs", () => {
    const out = normalizeCarstatVhrJsonPayloads([
      {
        schema_version: 2,
        source: {
          id: 1,
          sections: [
            {
              type: "listings",
              items: [
                {
                  sale_date: "2026-04-15T14:00:00Z",
                  odometer_km: 89420,
                  final_price: 11550,
                  bid: 10700,
                  buy_now_price: 13200,
                  main_damage_id: 1,
                  second_damage_id: 2,
                  condition_label: "run and drives",
                  status_label: "sold",
                  marketplace: "copart.com",
                  listing_type: "auction",
                  lot: "DEMO-1",
                  currency: "USD",
                  country_id: 1,
                },
                {
                  sale_date: "2026-08-15T14:00:00Z",
                  odometer_km: 92420,
                  final_price: 24000350,
                  marketplace: "encar.com",
                  listing_type: "marketplace",
                  currency: "KRW",
                  condition_label: "run and drives",
                  status_label: "sold",
                  main_damage_id: 1,
                  second_damage_id: 2,
                  country_id: 122,
                  korean_history: {
                    inspect: {
                      overall_result: "minor_repairs",
                      body_panels: [
                        { part: "front_bumper", action: "repainted" },
                      ],
                    },
                    insurance: {
                      accidents: [
                        { date: "2026-02-03", currency: "KRW", own_damage: 1280000, third_party_damage: 0 },
                      ],
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    ], { vin: "7FARW2H56JE022576" });

    expect(out.auctionHistory?.length).toBe(1);
    expect(out.auctionHistory?.[0]?.primaryDamage).toBe("Front End");
    expect(out.auctionHistory?.[0]?.lotStatus).toBe("Sold");
    expect(out.auctionHistory?.[0]?.country).toBe("US");
    expect(out.mileageHistory?.some((m) => /Copart/i.test(m.source ?? ""))).toBe(true);
    expect(out.mileageHistory?.some((m) => /Encar|Korean/i.test(m.source ?? ""))).toBe(false);
    expect(out.insuranceClaims?.length ?? 0).toBe(0);
    expect(out.accidents?.some((a) => a.type === "insurance")).toBe(false);
    expect(out.vehicleExtras?.some((x) => x.label === "Front Bumper")).toBe(false);
    expect(out.country).toMatch(/United States|US/i);
  });

  it("extracts Archive Alpha US auction price/odo/damage without EU/KR stubs", () => {
    const out = normalizeCarstatVhrJsonPayloads([
      {
        schema_version: 2,
        vin: "7FARW2H56JE022576",
        source: {
          id: 2,
          sections: [
            {
              type: "vehicles",
              items: [{ year: 2018, title: "2018 Honda CR-V EX AWD", fuel_label: "gasoline", body_type_label: "suv" }],
            },
            {
              type: "listings",
              items: [
                {
                  auction_at: "2026-08-12T10:00:00Z",
                  price: 19950,
                  marketplace: "European marketplace",
                  country_iso: "DE",
                  odometer: 93420,
                  location_details: { country: "DE", city: "Berlin", region: "Demo region" },
                  source_data: { currency: "USD", emissions: { standard: "Euro 6" } },
                },
                {
                  auction_at: "2026-08-12T10:00:00Z",
                  price: 11200,
                  marketplace: "US auction",
                  country_iso: "US",
                  odometer: 93580,
                  damage: 17,
                  second_damage: 22,
                  location_details: { country: "US", city: "Houston", region: "Demo region" },
                  source_data: {
                    currency: "USD",
                    emissions: { standard: "Euro 6", co2_g_km: 151 },
                    service_history: { records_count: 3, last_service_at: "2026-06-20" },
                  },
                },
              ],
            },
          ],
        },
      },
    ], { vin: "7FARW2H56JE022576" });

    expect(out.auctionHistory?.length).toBe(1);
    expect(out.auctionHistory?.[0]?.finalPrice).toBe(11200);
    expect(out.auctionHistory?.[0]?.currency).toBe("USD");
    expect(out.auctionHistory?.[0]?.city).toMatch(/Houston/i);
    expect(out.mileageHistory?.length).toBe(1);
    expect(out.mileageHistory?.[0]?.odometer).toBe(93580);
    expect(out.mileageHistory?.[0]?.source).toMatch(/US Auction/i);
    expect(out.serviceHistory?.length ?? 0).toBe(0);
    expect(out.vehicleExtras?.some((x) => /euro\s*6/i.test(x.value ?? ""))).toBe(false);
  });

  it("maps korean_insurance sections into claims / owners / identity", () => {
    const out = normalizeCarstatVhrJsonPayloads([
      {
        schema_version: 2,
        source: {
          id: 68,
          sections: [
            {
              type: "korean_insurance",
              items: [{ korea_section: "car_info", data: { brand: "Kia", model: "K3", year: "2021", fuel: "Gasoline" } }],
            },
            {
              type: "korean_insurance",
              items: [{
                korea_section: "ownership",
                data: {
                  owner_count: 1,
                  owner_changes: [{ date: "2021-03-17", type: "Initial registration" }],
                },
              }],
            },
            {
              type: "korean_insurance",
              items: [{
                korea_section: "accidents_detail",
                data: {
                  items: [
                    {
                      date: "2025-04-26",
                      parts_description: ["Rear bumper assembly (replacement)"],
                      center: [{ paid: 6217990, parts: 1986250, labor: 1181540, paint: 1220930, type: "1" }],
                    },
                    {
                      date: "2024-11-08",
                      left: [{ paid: 67680, parts: 10000, labor: 20000, paint: 5000, type: "1" }],
                      center: [{ paid: 99200, parts: 30000, labor: 40000, paint: 10000, type: "3" }],
                      right: [{ paid: 100000, parts: 50000, labor: 25000, paint: 15000, type: "3" }],
                    },
                  ],
                  has_uninsured_period: true,
                  uninsured_period_text: "2023-01-01 ~ 2023-02-15",
                },
              }],
            },
            {
              type: "korean_insurance",
              items: [{
                korea_section: "special_conditions",
                data: { flood: { count: 0 }, theft: { count: 0 }, total_loss: { count: 0 } },
              }],
            },
            {
              type: "korean_insurance",
              items: [{
                korea_section: "mileage",
                data: {
                  has_data: true,
                  list: [
                    { date: "2025-04-18", km: "93 000", source: "Car insurance company" },
                    { date: "2024-04-15", km: "75 383", source: "Car insurance company" },
                  ],
                  last: { date: "2025-04-18", km: "93 000", source: "Car insurance company" },
                },
              }],
            },
            {
              type: "korean_insurance",
              items: [{ korea_section: "price", data: "744~ 1 031" }],
            },
            {
              type: "korean_insurance",
              items: [{ korea_section: "recall_campaigns", data: { status: "done", data: null } }],
            },
            {
              type: "korean_insurance",
              items: [{
                korea_section: "export_declaration",
                data: {
                  status: "done",
                  data: {
                    export_date: "2026-02-01",
                    model_name: "K3",
                    first_registration_date: "2021-03-17",
                    fuel_name: "Gasoline",
                    engine_displacement: 1598,
                    color_name: "White",
                    seats_count: 5,
                    mileage: 106526,
                    is_total_loss: false,
                    length: 4655,
                    width: 1800,
                    height: 1440,
                  },
                },
              }],
            },
            {
              type: "korean_insurance",
              items: [{
                korea_section: "summary",
                data: {
                  total_loss: 0,
                  theft: 0,
                  flood: 0,
                  my_damage_count: 4,
                  my_damage_sum: 8891909,
                  other_damage_count: 1,
                  other_damage_sum: 1629590,
                  owner_count: 1,
                  registration_number: "287러8406",
                  report_date: "2026-01-19",
                },
              }],
            },
          ],
        },
      },
    ], { vin: "KNAF241BEMA915413" });

    expect(out.make).toBe("Kia");
    expect(out.model).toBe("K3");
    expect(out.year).toBe(2021);
    expect(out.ownerHistory?.length).toBe(1);
    expect(out.insuranceClaims?.[0]?.lossAmount).toBe(6217990);
    expect(out.insuranceClaims?.[0]?.type).toBe("insurance_own_damage");
    const novClaimAccident = out.accidents?.find((a) => a.date === "2024-11-08");
    expect(novClaimAccident?.lossAmount).toBe(266880);
    const novTyped = out.insuranceClaims?.filter((c) => c.date === "2024-11-08") ?? [];
    expect(novTyped.length).toBe(3);
    expect(novTyped.some((c) => c.type === "insurance_own_damage" && c.lossAmount === 67680)).toBe(true);
    expect(novTyped.some((c) => c.type === "insurance_third_party" && c.lossAmount === 100000)).toBe(true);
    expect(out.accidents?.some((a) => a.type === "insurance")).toBe(true);
    expect(out.isFlooded).toBe(false);
    expect(out.country).toMatch(/Korea|KR/i);
    expect(out.odometer).toBe(106526);
    expect(out.mileageHistory?.some((m) => m.odometer === 93000)).toBe(true);
    expect(out.mileageHistory?.some((m) => m.odometer === 106526 && m.source === "Export declaration")).toBe(true);
    expect(out.marketData?.estimatedValue).toBe(8_875_000);
    expect(out.marketData?.currency).toBe("KRW");
    expect(out.vehicleExtras?.some((x) => x.label === "Korean market price")).toBe(true);
    expect(out.vehicleExtras?.some((x) => x.label === "Recall campaigns" && x.value === "None recorded")).toBe(true);
    expect(out.vehicleExtras?.some((x) => x.label === "Export date")).toBe(true);
    expect(out.vehicleExtras?.some((x) => x.label === "Own damage claims")).toBe(true);
    expect(out.vehicleExtras?.some((x) => x.label === "Uninsured period")).toBe(true);
    expect(out.isFlooded).toBe(false);
    expect(out.isSalvage).toBe(false);
    expect(out.registryHistory?.some((e) => e.type === "insurance" || e.type === "ownership")).toBe(true);
    expect(out.registryHistory?.some((e) => e.type === "first_registration" && e.date === "2021-03-17")).toBe(true);
    expect(out.registryHistory?.some((e) => e.type === "export" && e.date === "2026-02-01")).toBe(true);
    expect(out.registryHistory?.some((e) => e.type === "no_insurance")).toBe(true);
    expect(out.vehicleExtras?.some((x) => x.label === "Export total loss" && x.value === "No")).toBe(true);
  });

  it("flags salvage when export declaration marks total loss", () => {
    const out = normalizeCarstatVhrJsonPayloads([
      {
        schema_version: 2,
        vin: "KNAF241BEMA915413",
        source: {
          id: 68,
          sections: [{
            type: "korean_insurance",
            items: [{
              korea_section: "export_declaration",
              data: {
                status: "done",
                data: {
                  export_date: "2026-02-01",
                  model_name: "K3",
                  is_total_loss: true,
                  total_loss_description: "Economic total loss",
                  mileage: 106526,
                },
              },
            }],
          }],
        },
      },
    ], { vin: "KNAF241BEMA915413" });

    expect(out.isSalvage).toBe(true);
    expect(out.vehicleExtras?.some((x) => x.label === "Export total loss" && /Economic total loss|Yes/i.test(x.value ?? ""))).toBe(true);
    expect(out.accidents?.some((a) => a.type === "total_loss")).toBe(true);
    expect(out.registryHistory?.some((e) => e.type === "total_loss")).toBe(true);
  });

  it("does not let korean_insurance car_info overwrite US WMI identity/country", () => {
    const out = normalizeCarstatVhrJsonPayloads(
      [
        {
          schema_version: 2,
          source: {
            id: 1,
            sections: [
              {
                type: "vehicles",
                items: [{ year: 2018, title: "2018 Honda CR-V EX AWD" }],
              },
            ],
          },
        },
        {
          schema_version: 2,
          source: {
            id: 68,
            sections: [
              {
                type: "korean_insurance",
                items: [{ korea_section: "car_info", data: { brand: "Kia", model: "K3", year: "2021", fuel: "Gasoline" } }],
              },
            ],
          },
        },
      ],
      { vin: "7FARW2H56JE022576" },
    );

    expect(out.make).toBe("Honda");
    expect(out.model).toBe("CR-V");
    expect(out.country).toMatch(/United States|US/i);
  });

  it("maps history section vehicle_snapshot + events", () => {
    const out = normalizeCarstatVhrJsonPayloads([
      {
        schema_version: 2,
        source: {
          id: 5,
          sections: [
            {
              type: "history",
              items: [{
                checked_at: "2026-08-30T00:00:00+00:00",
                vehicle_snapshot: {
                  brand: "HYUNDAI",
                  model: "CASPER",
                  year: 2022,
                  mileage_km: 75647,
                  fuel_type: "Gasoline",
                  title: "HYUNDAI CASPER Gasoline 1.0",
                },
                summary: { owner_change_count: 3 },
                checks: [{ id: "flood_history", source_label: "Water/Flood Damage", result_key: "not_present" }],
                events: [{
                  occurred_at: "2026-03-11T00:00:00+00:00",
                  type_key: "owner_change",
                  source_label: "Transfer of Ownership",
                }],
              }],
            },
          ],
        },
      },
    ], { vin: "KMHB3518BNW003977" });

    expect(out.make).toMatch(/Hyundai/i);
    expect(out.year).toBe(2022);
    expect(out.odometer).toBe(75647);
    expect(out.ownerHistory?.length).toBe(1);
    expect(out.isFlooded).toBe(false);
    expect(out.vehicleExtras?.some((x) => x.label === "Water/Flood Damage")).toBe(false);
    expect(out.registryHistory?.some((e) => /flood/i.test(e.title ?? ""))).toBe(false);
  });

  it("maps inspection JSON (vehicle_snapshot + findings) into structured fields", () => {
    const out = normalizeCarstatVhrJsonPayloads([
      {
        schema_version: 2,
        source: {
          id: 4,
          sections: [
            {
              type: "inspections",
              items: [
                {
                  inspected_at: "2026-09-18T10:30:00Z",
                  vehicle_snapshot: {
                    title: "2018 Honda CR-V EX AWD",
                    make: "Honda",
                    model: "CR-V",
                    year: 2018,
                    body_type: "suv",
                    fuel: "gasoline",
                    odometer: { value: 93420, unit: "km" },
                  },
                  media: [{ image: "https://v-h-r.b-cdn.net/vhr/media/demo.webp" }],
                  source_claims: [{
                    type_key: "accident",
                    source_label: "Recorded body repair",
                    description: "Bumper repair",
                    result_key: "issue",
                  }],
                  checked_items: [{
                    id: "check-1",
                    result_key: "issue",
                    part_label: "Front Bumper",
                    description: "Cosmetic repair",
                    issue_type_keys: ["repaired", "accident_trace"],
                    accident_relevance_key: "cosmetic",
                  }],
                  conclusions: {
                    evaluation_score: "82/100",
                    notes: "Minor repairs",
                    overall_result_key: "issue",
                    accident_status_key: "ok",
                  },
                },
              ],
            },
          ],
        },
      },
    ]);

    expect(out.make).toBe("Honda");
    expect(out.year).toBe(2018);
    expect(out.odometer).toBe(93420);
    expect(out.mileageHistory?.length).toBe(1);
    expect(out.accidents?.length).toBeGreaterThanOrEqual(1);
    expect(out.serviceHistory?.some((s) => s.title === "Vehicle inspection")).toBe(true);
    expect(out.photos?.[0]).toContain("v-h-r.b-cdn.net");
    expect(out.vehicleExtras?.some((x) => x.label === "Front Bumper")).toBe(true);
    expect(hasStructuredVhrReport({ ...out, dataSource: "carstat_vhr" })).toBe(true);
  });

  it("maps inspection measurements and listing provenance extras", () => {
    const insp = normalizeCarstatVhrJsonPayloads([
      {
        schema_version: 2,
        source: {
          id: 4,
          sections: [{
            type: "inspections",
            items: [{
              inspected_at: "2026-09-08T00:00:00Z",
              vehicle_snapshot: { title: "2021 Genesis G70", year: 2021, mileage_km: 98000 },
              checked_items: [{
                result_key: "unknown",
                part_label: "Carbon monoxide emissions",
                measurements: [{ type_key: "emissions_co", value_number: 0.02, unit_key: "percent", id: "emissions_co_measurement" }],
              }],
            }],
          }],
        },
      },
    ], { vin: "KMTG341ABMU089876" });
    expect(insp.vehicleExtras?.some((x) => /0\.02/.test(x.value ?? "") && /percent/i.test(x.value ?? ""))).toBe(true);

    const listing = normalizeCarstatVhrJsonPayloads([
      {
        schema_version: 2,
        source: {
          id: 2,
          sections: [{
            type: "listings",
            items: [{
              listing_id: "DEMO-LIST-1",
              sale_date: "2026-08-12",
              created_at: "2026-07-02T09:00:00Z",
              last_seen_at: "2026-08-12T12:00:00Z",
              odometer_km: 90000,
              marketplace: "example.com",
              currency: "EUR",
              location_details: { city: "Berlin", region: "BE", country: "DE" },
            }],
          }],
        },
      },
    ], { vin: "WVWZZZ3CZCE064077" });
    expect(listing.vehicleExtras?.some((x) => /listing id/i.test(x.label ?? ""))).toBe(false);
    expect(listing.vehicleExtras?.some((x) => x.label === "First seen")).toBe(true);
    expect(listing.vehicleExtras?.some((x) => x.label === "Last seen")).toBe(true);
    expect(listing.auctionHistory?.[0]?.city).toBe("Berlin");
  });

  it("does not invent accidents from clear inspection claims (없음 / ok)", () => {
    const out = normalizeCarstatVhrJsonPayloads([
      {
        schema_version: 2,
        source: {
          id: 4,
          sections: [{
            type: "inspections",
            items: [{
              inspected_at: "2026-09-18T10:30:00Z",
              vehicle_snapshot: { title: "G70", year: 2021, mileage_km: 98583 },
              source_claims: [
                { result_key: "ok", source_label: "Accident history", description: "없음", type_key: "accident" },
                { result_key: "issue", source_label: "Simple repair history", description: "있음", type_key: "simple_repair" },
              ],
              checked_items: [
                { result_key: "ok", part_label: "Engine", description: "양호" },
                {
                  result_key: "issue",
                  part_label: "Front door left",
                  description: "Repaired or welded",
                  issue_type_keys: ["repaired", "accident_trace"],
                  accident_relevance_key: "cosmetic",
                },
              ],
            }],
          }],
        },
      },
    ], { vin: "KMTG341ABMU089876" });

    expect(out.odometer).toBe(98583);
    expect(out.model).toBe("G70");
    expect(out.make).toMatch(/Genesis|Hyundai|Kia/i);
    expect(out.accidents?.some((a) => /없음|Accident history/i.test(a.description ?? ""))).toBe(false);
    expect(out.accidents?.some((a) => /Front door left|Simple repair/i.test(a.description ?? "") || a.primaryDamage === "Front door left" || a.primaryDamage === "Simple repair history")).toBe(true);
    expect(out.vehicleExtras?.some((x) => x.label === "Accident history" && /none|clear|ok/i.test(x.value))).toBe(true);
  });

  it("maps history events into registry timeline; usage checks stay in extras", () => {
    const out = normalizeCarstatVhrJsonPayloads([
      {
        schema_version: 2,
        source: {
          id: 5,
          sections: [{
            type: "history",
            items: [{
              checked_at: "2026-08-30T00:00:00+00:00",
              vehicle_snapshot: {
                brand: "HYUNDAI",
                model: "CASPER",
                year: 2022,
                mileage_km: 75647,
                fuel_type: "Gasoline",
                title: "HYUNDAI CASPER Gasoline 1.0",
              },
              summary: { owner_change_count: 3 },
              checks: [
                { id: "flood_history", source_label: "Water/Flood Damage", result_key: "not_present" },
                { id: "total_loss_history", source_label: "Total Loss", result_key: "not_present" },
                { id: "rental_use_history", source_label: "Rental", result_key: "present" },
                { id: "business_use_history", source_label: "Business", result_key: "present" },
                { id: "government_use_history", source_label: "Government", result_key: "present" },
                { id: "special_usage_history", source_label: "Special Usage", result_key: "present" },
              ],
              events: [{
                occurred_at: "2026-03-11T00:00:00+00:00",
                type_key: "owner_change",
                source_label: "Transfer of Ownership",
                details: [{ value_text: "Personal Car", source_label: "usage" }],
              }],
            }],
          }],
        },
      },
    ], { vin: "KMHB3518BNW003977" });

    expect(out.registryHistory?.some((e) => e.title === "Transfer of Ownership")).toBe(true);
    // Usage/flag checks must not appear as fake dated timeline rows ("… · Present").
    expect(out.registryHistory?.some((e) => e.title === "Business")).toBe(false);
    expect(out.registryHistory?.some((e) => e.title === "Rental")).toBe(false);
    expect(out.registryHistory?.some((e) => e.title === "Government")).toBe(false);
    expect(out.registryHistory?.some((e) => e.title === "Special Usage")).toBe(false);
    expect(out.registryHistory?.some((e) => e.subtitle === "Present")).toBe(false);
    expect(out.vehicleExtras?.some((x) => x.label === "Business" && x.value === "Yes")).toBe(true);
    expect(out.vehicleExtras?.some((x) => x.label === "Government" && x.value === "Yes")).toBe(true);
    // Absent flood/total-loss → silent (flags only), never "Not present" timeline rows.
    expect(out.registryHistory?.some((e) => /flood|total\s*loss/i.test(e.title ?? ""))).toBe(false);
    expect(out.isFlooded).toBe(false);
    expect(out.isSalvage).toBe(false);
    expect(out.isTaxi).toBe(true);
  });

  it("merges auction archives + Korean insurance into one coherent report", () => {
    const out = normalizeCarstatVhrJsonPayloads([
      {
        schema_version: 2,
        source: {
          id: 1,
          sections: [{
            type: "listings",
            items: [{
              sale_date: "2026-04-15",
              final_price: 11550,
              actual_cash_value: 19700,
              marketplace: "copart.com",
              currency: "USD",
              odometer_km: 89420,
              main_damage_id: 1,
              condition_label: "run and drives",
            }],
          }],
        },
      },
      {
        schema_version: 2,
        source: {
          id: 68,
          sections: [
            { type: "korean_insurance", items: [{ korea_section: "car_info", data: { brand: "Kia", model: "K3", year: "2021", trim: "Prestige", trim_options: "ABS, Smart Key", fuel: "Gasoline" } }] },
            { type: "korean_insurance", items: [{ korea_section: "ownership", data: { owner_count: 1, owner_changes: [{ date: "2021-03-17", type: "Initial registration" }] } }] },
            { type: "korean_insurance", items: [{ korea_section: "accidents_detail", data: { items: [{ date: "2025-04-26", center: [{ paid: 6217990, parts: 100, labor: 100, paint: 100 }] }], totals: { my_damage: 8891909, other_damage: 1629590 } } }] },
            { type: "korean_insurance", items: [{ korea_section: "special_conditions", data: { flood: { count: 0 }, theft: { count: 0 }, total_loss: { count: 0 } } }] },
            { type: "korean_insurance", items: [{ korea_section: "price", data: "744~ 1 031" }] },
            { type: "korean_insurance", items: [{ korea_section: "summary", data: { total_loss: 0, theft: 0, flood: 0, my_damage_count: 4, owner_count: 1 } }] },
          ],
        },
      },
      {
        schema_version: 2,
        source: {
          id: 4,
          sections: [{
            type: "inspections",
            items: [{
              inspected_at: "2026-09-18T10:30:00Z",
              vehicle_snapshot: { title: "K3", year: 2021, mileage_km: 93000 },
              source_claims: [{ result_key: "issue", source_label: "Simple repair history", description: "있음", type_key: "simple_repair" }],
              checked_items: [{ result_key: "ok", part_label: "Engine", description: "양호" }],
            }],
          }],
        },
      },
    ], { vin: "KNAF241BEMA915413" });

    expect(out.make).toMatch(/Kia/i);
    expect(out.model).toBe("K3");
    expect(out.year).toBe(2021);
    expect(out.trim).toBe("Prestige");
    expect(out.auctionHistory?.length).toBeGreaterThan(0);
    expect(out.insuranceClaims?.some((c) => c.lossAmount === 6217990)).toBe(true);
    expect(out.accidents?.some((a) => a.type === "insurance")).toBe(true);
    expect(out.registryHistory?.some((e) => e.type === "insurance" || e.type === "ownership")).toBe(true);
    expect(out.serviceHistory?.some((s) => /inspection/i.test(s.title ?? ""))).toBe(true);
    expect(out.vehicleExtras?.some((x) => x.label === "Trim options")).toBe(true);
    expect(out.vehicleExtras?.some((x) => x.label === "Korean market price")).toBe(true);
    expect(out.marketData?.currency).toBe("KRW");
    expect(out.marketData?.estimatedValue).toBe(8_875_000);
    expect(out.isFlooded).toBe(false);
    // Copart archive presence marks salvage by default.
    expect(out.isSalvage).toBe(true);
  });

  it("keeps USD market values for US-origin VINs even when Encar KRW listings exist", () => {
    const out = normalizeCarstatVhrJsonPayloads([
      {
        schema_version: 2,
        source: {
          id: 1,
          sections: [{
            type: "listings",
            items: [
              {
                sale_date: "2026-04-15",
                final_price: 11550,
                actual_cash_value: 19700,
                marketplace: "copart.com",
                currency: "USD",
                odometer_km: 89420,
              },
              {
                sale_date: "2026-08-15",
                final_price: 24000350,
                actual_cash_value: 24008500,
                marketplace: "encar.com",
                currency: "KRW",
                odometer_km: 92420,
              },
            ],
          }],
        },
      },
    ], { vin: "7FARW2H56JE022576" });

    expect(out.marketData?.currency).toBe("USD");
    expect(out.marketData?.estimatedValue).toBe(19700);
    expect(out.marketData?.lastAuctionPrice).toBe(11550);
    expect(out.country).toMatch(/United States|US/i);
  });

  it("simplifies body-map inspection accident titles", () => {
    expect(
      simplifyInspectionAccidentDescription(
        "Front fender",
        "Marked in abnormal body parts section · Body map position 31: Replaced",
      ),
    ).toBe("Front fender: Replaced");
    expect(
      simplifyInspectionAccidentDescription("Front Bumper", "Cosmetic repair"),
    ).toBe("Front Bumper: Cosmetic repair");
  });

  it("keeps KR as catalog country for EU WMI cars with real Korean insurance", () => {
    const out = normalizeCarstatVhrJsonPayloads([
      {
        schema_version: 2,
        vin: "WDDHF0CB9EA796317",
        source: {
          id: 68,
          sections: [
            {
              type: "korean_insurance",
              items: [{
                korea_section: "accidents_detail",
                data: {
                  items: [{
                    date: "2021-06-15",
                    center: [{ type: "1", paid: 850000, parts: 400000, labor: 300000, paint: 150000 }],
                  }],
                },
              }],
            },
          ],
        },
      },
    ], { vin: "WDDHF0CB9EA796317" });

    expect(out.country).toMatch(/^KR$|Korea/i);
    expect(out.accidents?.length).toBeGreaterThanOrEqual(1);
  });
});
