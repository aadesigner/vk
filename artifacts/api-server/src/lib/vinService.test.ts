import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inferAccidentSeverityFromUsd, inferAccidentSeverityFromLossAmount } from "@workspace/accident-severity";

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://localhost:5432/verifykm_test";
});

import {
  extractLotDamages,
  extractLotTitle,
  extractKoreanOwnerHistory,
  dedupeOwnerHistory,
  dedupeRegistryHistoryEvents,
  extractRegistryHistoryFromLots,
  extractRecallHistoryFromLots,
  isKoreanInsuranceClaimRecord,
  isSalvageTitle,
  titleIndicatesFlood,
  textIndicatesFlood,
  accidentIndicatesFlood,
  normalizeCarstatResponse,
  parseKoreanInspectAccident,
  parseLotOdometerKm,
  resolveLatestOdometerKm,
  resolveLotEventDate,
  resolveVehicleCountry,
  pickBestLotPhotoUrls,
  pickDisplayLotPhotoUrls,
  pickRicherVinReportData,
  pickVinReportDataForServe,
  mergeVinPhotoLists,
  preserveManualMileageAnnotations,
  isStaleKoreanReport,
  isStaleCachedReport,
  isMissingAuction360Media,
  isPartialCarstatPhotoCache,
  isCarstatMirroredPreviewUrl,
  vinDataHasCorruptObjectMarker,
  vinReportDataRichnessScore,
  isKoreanRecallRegistryItem,
  repairEncarMisParsedIsoDate,
  sanitizeReportIsoDate,
  classifyKoreanRegistryTitle,
  normalizeHistoryGroupDate,
  mapRegistryEventToAccident,
  resolveRegistryAccidentLossAmount,
} from "./vinService";

describe("accident severity USD tiers", () => {
  it("classifies damage by $1,300 / $3,000 thresholds", () => {
    expect(inferAccidentSeverityFromUsd(500)).toBe("minor");
    expect(inferAccidentSeverityFromUsd(1299)).toBe("minor");
    expect(inferAccidentSeverityFromUsd(1300)).toBe("moderate");
    expect(inferAccidentSeverityFromUsd(2999)).toBe("moderate");
    expect(inferAccidentSeverityFromUsd(3000)).toBe("major");
  });

  it("does not invent minor when amount is missing or non-positive", () => {
    expect(inferAccidentSeverityFromUsd(0)).toBeNull();
    expect(inferAccidentSeverityFromUsd(-1)).toBeNull();
    expect(inferAccidentSeverityFromLossAmount(null)).toBeNull();
    expect(inferAccidentSeverityFromLossAmount(0)).toBeNull();
  });
});

describe("normalizeCarstatResponse accident keep without invented severity", () => {
  it("keeps standard accidents that have type/date but no loss amount", () => {
    const normalized = normalizeCarstatResponse({
      year: 2018,
      vin: "KNATEST0000000001",
      manufacturer: { name: "Hyundai" },
      model: { name: "Sonata" },
      lots: [{
        domain: { name: "example_com" },
        location: { country: { iso: "us", name: "us" } },
        details: {
          insurance_v2: {
            accidentCnt: 1,
            accidents: [
              { date: "2021-04-16", type: "collision", description: "Front impact" },
            ],
          },
        },
      }],
    });

    expect(normalized.accidents).toHaveLength(1);
    expect(normalized.accidents?.[0]?.severity).toBeNull();
    expect(normalized.accidents?.[0]?.date).toBe("2021-04-16");
    expect(normalized.accidentCount).toBe(1);
  });

  it("still maps Korean insurance claims and registry when claim amounts are present", () => {
    const normalized = normalizeCarstatResponse({
      year: 2018,
      vin: "KNATEST0000000002",
      manufacturer: { name: "Hyundai" },
      model: { name: "Sonata" },
      lots: [{
        domain: { name: "encar_com" },
        location: { country: { iso: "kr", name: "kr" } },
        details: {
          history: [{
            date: "2021-04",
            content: [{
              title: "Insurance processing",
              sub: "own damage\nRepair cost 1,200,000won",
            }],
          }],
          insurance_v2: {
            accidentCnt: 1,
            accidents: [
              { date: "2021-04-16", type: "2", insuranceBenefit: 1_200_000, partCost: 800_000 },
            ],
          },
        },
      }],
    });

    expect(normalized.insuranceClaims).toHaveLength(1);
    expect(normalized.accidents?.length).toBeGreaterThan(0);
    expect(normalized.registryHistory?.length).toBeGreaterThan(0);
  });
});

describe("parseLotOdometerKm", () => {
  it("converts US auction miles to km", () => {
    expect(parseLotOdometerKm({ odometer: { mi: 100_000 } })).toBe(160_934);
  });

  it("prefers km when both km and mi are present", () => {
    expect(parseLotOdometerKm({ odometer: { km: 50_000, mi: 100_000 } })).toBe(50_000);
  });
});

describe("resolveVehicleCountry", () => {
  it("picks the country seen on the most lots", () => {
    expect(resolveVehicleCountry([
      { location: { country: { iso: "us" } } },
      { location: { country: { iso: "us" } } },
      { location: { country: { iso: "ca" } } },
    ])).toBe("us");
  });
});

describe("resolveLatestOdometerKm", () => {
  it("uses the highest mileage across listing and registry history", () => {
    expect(resolveLatestOdometerKm({
      odometer: 160_000,
      mileageHistory: [{ odometer: 161_404 }],
      registryHistory: [{
        mileage: 170_500,
        details: [{ label: "Driving distance during inspection", value: "77,675km" }],
      }],
      ownerHistory: [{ mileage: 168_000 }],
    })).toBe(170_500);
  });

  it("prefers Korean registry mileage over inflated US auction conversion", () => {
    expect(resolveLatestOdometerKm({
      country: "kr",
      odometer: 301_000,
      mileageHistory: [{ odometer: 301_000, source: "na_auction" }],
      registryHistory: [{ mileage: 245_000 }],
    })).toBe(245_000);
  });
});

describe("extractLotDamages", () => {
  it("reads Carstat damage.main / damage.second", () => {
    const result = extractLotDamages({
      main: { id: 3, name: "Front End" },
      second: { id: 37, name: "Side" },
    });
    expect(result.primary).toBe("Front End");
    expect(result.secondary).toBe("Side");
    expect(result.combined).toBe("Front End; Side");
  });

  it("handles flat string damage", () => {
    const result = extractLotDamages("rear end");
    expect(result.primary).toBe("rear end");
    expect(result.secondary).toBeNull();
  });
});

describe("isSalvageTitle", () => {
  it("detects salvage titles from auction lots", () => {
    expect(isSalvageTitle("Bv - Salvage Title")).toBe(true);
    expect(isSalvageTitle("Ab - Bos - Salvage")).toBe(true);
    expect(isSalvageTitle("Clean Title")).toBe(false);
  });

  it("does not treat Alberta bill-of-sale codes as salvage", () => {
    expect(isSalvageTitle("Ab - Bos")).toBe(false);
    expect(isSalvageTitle("CA - Clean Title")).toBe(false);
  });
});

describe("NA flood text detection", () => {
  it("matches damage and title flood wording", () => {
    expect(textIndicatesFlood("Water/Flood")).toBe(true);
    expect(textIndicatesFlood("Water / Flood")).toBe(true);
    expect(textIndicatesFlood("water damage")).toBe(true);
    expect(textIndicatesFlood("Front End")).toBe(false);
    expect(titleIndicatesFlood("La - Cert Of Title-Flood")).toBe(true);
    expect(titleIndicatesFlood("Flood Salvage")).toBe(true);
    expect(titleIndicatesFlood("La - Cert Of Title-Salvage")).toBe(false);
    expect(accidentIndicatesFlood({ type: "flood" })).toBe(true);
    expect(accidentIndicatesFlood({ primaryDamage: "water_flood" })).toBe(true);
    expect(accidentIndicatesFlood({ primaryDamage: "Front End" })).toBe(false);
  });
});

describe("normalizeCarstatResponse NA flood flags", () => {
  it("flags flood from auction Water/Flood damage", () => {
    const normalized = normalizeCarstatResponse({
      year: 2018,
      vin: "1HGCM82633A004352",
      manufacturer: { name: "Honda" },
      model: { name: "Accord" },
      lots: [{
        sale_date: "2024-05-01",
        title: { name: "CA - Clean Title" },
        damage: { main: { name: "Water/Flood" }, second: null },
        domain: { name: "copart_com" },
        location: { country: { iso: "us", name: "United States" } },
        odometer: { mi: 80_000 },
        status: { name: "sold" },
      }],
    });

    expect(normalized.isFlooded).toBe(true);
    expect(normalized.floodCount).toBe(1);
    expect(normalized.accidents?.some((a) => textIndicatesFlood(a.primaryDamage))).toBe(false);
  });

  it("flags flood from title/certificate flood brand, not bare salvage", () => {
    const flooded = normalizeCarstatResponse({
      year: 2017,
      vin: "1HGCM82633A004353",
      manufacturer: { name: "Honda" },
      model: { name: "Civic" },
      lots: [{
        sale_date: "2023-08-12",
        detailed_title: { name: "La - Cert Of Title-Flood" },
        domain: { name: "copart_com" },
        location: { country: { iso: "us", name: "United States" } },
        odometer: { mi: 90_000 },
        status: { name: "sold" },
      }],
    });
    expect(flooded.isFlooded).toBe(true);
    expect(flooded.floodCount).toBe(1);

    const salvageOnly = normalizeCarstatResponse({
      year: 2017,
      vin: "1HGCM82633A004354",
      manufacturer: { name: "Honda" },
      model: { name: "Civic" },
      lots: [{
        sale_date: "2023-08-12",
        detailed_title: { name: "La - Cert Of Title-Salvage" },
        domain: { name: "copart_com" },
        location: { country: { iso: "us", name: "United States" } },
        odometer: { mi: 90_000 },
        status: { name: "sold" },
      }],
    });
    expect(salvageOnly.isSalvage).toBe(true);
    expect(salvageOnly.isFlooded ?? null).toBeNull();
  });

  it("flags flood from insurance accident type / primaryDamage", () => {
    const normalized = normalizeCarstatResponse({
      year: 2016,
      vin: "1HGCM82633A004355",
      manufacturer: { name: "Honda" },
      model: { name: "Fit" },
      lots: [{
        domain: { name: "copart_com" },
        location: { country: { iso: "us", name: "United States" } },
        details: {
          insurance_v2: {
            accidents: [
              { date: "2022-01-15", type: "flood", primary_damage: "water_flood" },
              { date: "2021-06-01", type: "collision", primary_damage: "Front End" },
            ],
          },
        },
      }],
    });

    expect(normalized.isFlooded).toBe(true);
    expect(normalized.floodCount).toBe(1);
    expect(normalized.accidents?.some((a) => a.type === "flood")).toBe(false);
    expect(normalized.accidents?.some((a) => a.primaryDamage === "Front End")).toBe(true);
  });
});

describe("normalizeCarstatResponse", () => {
  it("maps US/Canada auction salvage, title, and split damage", () => {
    const normalized = normalizeCarstatResponse({
      year: 2015,
      vin: "3VWD07AJ5FM204748",
      manufacturer: { name: "Volkswagen" },
      model: { name: "Jetta" },
      body_type: { name: "sedan" },
      color: { name: "black" },
      engine: { name: "1.8l 4" },
      transmission: { name: "automatic" },
      fuel: { name: "gas" },
      cylinders: 4,
      lots: [{
        sale_date: "2025-11-13T21:55:12.000000Z",
        bid: 1700,
        final_bid: 1700,
        status: { name: "sold" },
        title: { name: "Bv - Salvage Title" },
        detailed_title: { name: "Ab - Bos - Salvage" },
        damage: {
          main: { name: "Front End" },
          second: { name: "Side" },
        },
        condition: { name: "run_and_drives" },
        odometer: { km: 368361 },
        domain: { name: "copart_com" },
        location: {
          country: { iso: "ca", name: "Canada" },
          city: { name: "nisku" },
          state: { code: "ab" },
        },
        images: { downloaded: ["https://example.com/1.webp"] },
        details: null,
      }],
    });

    expect(normalized.isSalvage).toBe(true);
    expect(normalized.titleStatus).toBe("Ab - Bos - Salvage");
    expect(normalized.auctionHistory?.[0]?.primaryDamage).toBe("Front End");
    expect(normalized.auctionHistory?.[0]?.secondaryDamage).toBe("Side");
    expect(normalized.mileageHistory?.[0]?.primaryDamage).toBe("Front End");
    expect(normalized.accidents).toHaveLength(1);
    expect(normalized.accidents?.[0]?.primaryDamage).toBe("Front End");
    expect(normalized.accidents?.[0]?.secondaryDamage).toBe("Side");
    expect(normalized.accidents?.[0]?.type).toBe("auction");
    expect(normalized.accidents?.[0]?.description).toBe("Ab - Bos - Salvage");
    expect(normalized.accidents?.[0]?.severity).toBe("total_loss");
    expect(normalized.accidentCount).toBe(1);
  });

  it("does not treat clean-title auction listings as accidents when there is no damage", () => {
    const normalized = normalizeCarstatResponse({
      year: 2016,
      vin: "WBA7G6104GG509390",
      manufacturer: { name: "BMW" },
      model: { name: "7 Series" },
      lots: [
        {
          sale_date: "2022-03-01",
          title: { name: "Clean Title" },
          domain: { name: "copart_com" },
          location: { country: { iso: "us", name: "United States" } },
          odometer: { mi: 42_000 },
          status: { name: "sold" },
        },
        {
          sale_date: "2023-06-12",
          title: { name: "Clean Title" },
          detailed_title: { name: "CA - Clean Title" },
          domain: { name: "iaai_com" },
          location: { country: { iso: "us", name: "United States" } },
          odometer: { mi: 58_000 },
          status: { name: "sold" },
        },
        {
          sale_date: "2024-01-20",
          title: { name: "Clean Title" },
          damage: { main: { name: "Front End" }, second: null },
          domain: { name: "copart_com" },
          location: { country: { iso: "us", name: "United States" } },
          odometer: { mi: 61_000 },
          status: { name: "sold" },
        },
      ],
    });

    expect(normalized.accidents).toHaveLength(1);
    expect(normalized.accidents?.[0]?.primaryDamage).toBe("Front End");
    expect(normalized.accidents?.[0]?.type).toBe("auction");
    expect(normalized.accidentCount).toBe(1);
    expect(normalized.auctionHistory?.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps salvage-title auction lots in the accident list with the title text", () => {
    const normalized = normalizeCarstatResponse({
      year: 2016,
      vin: "WBA7G6104GG509390",
      manufacturer: { name: "BMW" },
      model: { name: "7 Series" },
      lots: [{
        sale_date: "2024-02-11",
        title: { name: "CA - Salvage Title" },
        detailed_title: { name: "CA - Salvage Title" },
        domain: { name: "copart_com" },
        location: { country: { iso: "us", name: "United States" } },
        odometer: { mi: 61_000 },
        status: { name: "sold" },
      }],
    });

    expect(normalized.isSalvage).toBe(true);
    expect(normalized.accidents).toHaveLength(1);
    expect(normalized.accidents?.[0]?.type).toBe("auction");
    expect(normalized.accidents?.[0]?.description).toBe("CA - Salvage Title");
    expect(normalized.accidents?.[0]?.severity).toBe("total_loss");
    expect(normalized.accidentCount).toBe(1);
  });

  it("reads odometer from miles-only US Copart lots", () => {
    const normalized = normalizeCarstatResponse({
      year: 2018,
      vin: "1HGBH41JXMN109186",
      manufacturer: { name: "Honda" },
      model: { name: "Civic" },
      lots: [{
        odometer: { mi: 62_137 },
        domain: { name: "copart_com" },
        location: { country: { iso: "us" } },
        status: { name: "sold" },
        sale_date: "2024-01-10",
      }],
    });

    expect(normalized.odometer).toBe(100_000);
    expect(normalized.mileageHistory?.[0]?.odometer).toBe(100_000);
  });

  it("extracts registry history when details.history exists regardless of country", () => {
    const normalized = normalizeCarstatResponse({
      year: 2020,
      vin: "TESTVIN1234567890",
      manufacturer: { name: "BMW" },
      model: { name: "3 Series" },
      lots: [{
        domain: { name: "encar_com" },
        location: { country: { iso: "de" } },
        details: {
          history: [{
            date: "March 1",
            content: [{
              title: "Car inspection completed",
              sub: "regular inspection\nMileage 45,000km",
              "Driving distance during inspection": "45,000km",
            }],
          }],
        },
      }],
    });

    expect(normalized.registryHistory).toHaveLength(1);
    expect(normalized.registryHistory?.[0]?.mileage).toBe(45_000);
    expect(normalized.country).toBe("de");
  });

  it("maps Korea Encar: insurance claims populate accident history while keeping separate sections", () => {
    const normalized = normalizeCarstatResponse({
      year: 2020,
      vin: "WBAGW4107LCD28117",
      manufacturer: { name: "BMW" },
      model: { name: "8er" },
      body_type: { name: "sport_car" },
      color: { name: "blue" },
      engine: { name: "B57D30B" },
      transmission: { name: "automatic" },
      fuel: { name: "diesel" },
      hp: 320,
      lots: [{
        domain: { name: "encar_com" },
        odometer: { km: 101410 },
        final_bid: 35849,
        buy_now: 35849,
        bid: 35849,
        status: { name: "sold" },
        condition: { name: "run_and_drives" },
        damage: { main: null, second: null },
        location: { country: { iso: "kr", name: "kr" }, city: { name: "Seoul" } },
        details: {
          history: [{
            date: "February 24",
            content: [{
              title: "Car inspection completed",
              sub: "regular inspection\nMileage 77,675km",
              "Driving distance during inspection": "77,675km",
            }],
          }],
          inspect: {
            accident_summary: {
              accident: "doesn't exist",
              exterior1rank: "doesn't exist",
              exterior2rank: "yes",
              main_framework: "doesn't exist",
              simple_repair: "yes",
            },
          },
          insurance_v2: {
            accidentCnt: 4,
            myAccidentCnt: 3,
            otherAccidentCnt: 1,
            ownerChangeCnt: 3,
            accidents: [
              { date: "2025-04-24", type: "2", insuranceBenefit: 7060220, partCost: 3191000 },
              { date: "2024-09-05", type: "2", insuranceBenefit: 2566720, partCost: 1599330 },
              { date: "2024-08-05", type: "1", insuranceBenefit: 1389200 },
              { date: "2021-10-30", type: "3", insuranceBenefit: 1669566, partCost: 237993 },
            ],
          },
        },
      }, {
        domain: { name: "encar_com" },
        odometer: { km: 101404 },
        final_bid: 36979,
        location: { country: { iso: "kr" } },
        details: { insurance_v2: { accidentCnt: 4 } },
      }],
    });

    expect(normalized.accidentCount).toBe(4);
    expect(normalized.accidents).toHaveLength(4);
    expect(normalized.accidents?.[0]?.type).toBe("insurance");
    expect(normalized.insuranceClaims).toHaveLength(4);
    expect(normalized.insuranceClaims?.[0]?.type).toBe("insurance_third_party");
    expect(normalized.insuranceClaims?.[0]?.lossAmount).toBe(7060220);
    expect(normalized.auctionHistory).toHaveLength(1);
    expect(normalized.mileageHistory).toHaveLength(1);
    expect(normalized.registryHistory?.length).toBeGreaterThan(0);
    expect(normalized.registryHistory?.some((e) => e.type === "inspection")).toBe(true);
  });

  it("maps Korea floodTotalLossCnt and robberCnt that ImportMotor shows", () => {
    const normalized = normalizeCarstatResponse({
      year: 2019,
      vin: "WDDUG8JB2KA456113",
      manufacturer: { name: "Benz" },
      model: { name: "S-Class" },
      lots: [{
        domain: { name: "encar_com" },
        odometer: { km: 50000 },
        location: { country: { iso: "kr", name: "kr" } },
        details: {
          insurance_v2: {
            ownerChangeCnt: 2,
            ownerChanges: ["2024-10-14", "2023-06-29"],
            floodTotalLossCnt: 4,
            floodTotalLossCost: 4_060_218,
            robberCnt: 0,
            totalLossCnt: 0,
            accidents: [
              { date: "2022-12-21", type: "1", insuranceBenefit: 5_928_477 },
              { date: "2023-06-26", type: "2", insuranceBenefit: 1_398_650 },
            ],
          },
        },
      }],
    });

    expect(normalized.insuranceClaims).toHaveLength(2);
    expect(normalized.accidents?.some((a) => a.type === "flood")).toBe(false);
    expect(normalized.isFlooded).toBe(true);
    expect(normalized.floodCount).toBe(4);
    expect(normalized.floodLossAmount).toBe(4_060_218);
    expect(normalized.ownerCount).toBeGreaterThanOrEqual(3);
    expect(normalized.ownerHistory?.map((o) => o.date)).toEqual(
      expect.arrayContaining(["2024-10-14", "2023-06-29"]),
    );
    expect(normalized.isStolen).toBe(false);
  });

  it("merges ownerChanges from a secondary lot when the richest claim lot lacks them", () => {
    const normalized = normalizeCarstatResponse({
      year: 2019,
      vin: "WDDUG8JB2KA456113",
      manufacturer: { name: "Benz" },
      model: { name: "S-Class" },
      lots: [
        {
          domain: { name: "encar_com" },
          location: { country: { iso: "kr", name: "kr" } },
          details: {
            insurance_v2: {
              ownerChangeCnt: 0,
              floodTotalLossCnt: 0,
              accidents: [
                { date: "2022-12-21", type: "1", insuranceBenefit: 5_928_477 },
              ],
            },
          },
        },
        {
          domain: { name: "encar_com" },
          location: { country: { iso: "kr", name: "kr" } },
          details: {
            insurance_v2: {
              ownerChangeCnt: 2,
              ownerChanges: ["2024-10-14", "2023-06-29"],
              carInfoChanges: [{ carNo: "61부XXXX", date: "2019-07-31" }],
              floodTotalLossCnt: 0,
              accidents: [],
            },
          },
        },
      ],
    });

    expect(normalized.insuranceClaims?.length).toBeGreaterThan(0);
    expect(normalized.isFlooded).toBe(false);
    expect(normalized.ownerHistory?.map((o) => o.date)).toEqual(
      expect.arrayContaining(["2024-10-14", "2023-06-29", "2019-07-31"]),
    );
    expect(normalized.ownerCount).toBeGreaterThanOrEqual(3);
  });

  it("does not treat otherAccidentCnt as flood (ImportMotor mistranslates that row)", () => {
    const normalized = normalizeCarstatResponse({
      year: 2019,
      vin: "WDDUG8JB2KA456113",
      manufacturer: { name: "Benz" },
      model: { name: "S-Class" },
      lots: [{
        domain: { name: "encar_com" },
        location: { country: { iso: "kr", name: "kr" } },
        details: {
          insurance_v2: {
            floodTotalLossCnt: 0,
            otherAccidentCnt: 4,
            otherAccidentCost: 4_060_218,
            myAccidentCnt: 1,
            myAccidentCost: 5_928_477,
            robberCnt: 0,
            totalLossCnt: 0,
            accidents: [
              { date: "2022-12-21", type: "1", insuranceBenefit: 5_928_477 },
              { date: "2023-06-26", type: "2", insuranceBenefit: 1_398_650 },
            ],
          },
        },
      }],
    });

    expect(normalized.isFlooded).toBe(false);
    expect(normalized.floodCount).toBe(0);
    expect(normalized.floodLossAmount ?? null).toBeNull();
    expect(normalized.insuranceClaims?.length).toBeGreaterThan(0);
  });

  it("does not synthesize engine from hp when engine.name is missing", () => {
    const normalized = normalizeCarstatResponse({
      year: 2019,
      vin: "TESTVIN1234567890",
      manufacturer: { name: "Audi" },
      model: { name: "A4" },
      hp: 170,
      lots: [],
    });

    expect(normalized.engine).toBeNull();
    expect(normalized.hp).toBe(170);
  });
});

describe("extractRegistryHistoryFromLots", () => {
  it("maps Encar details.history into registry timeline events", () => {
    const events = extractRegistryHistoryFromLots([{
      details: {
        history: [
          {
            date: "January 20",
            content: [{
              title: "New car delivery (corporate name)",
              sub: "Busanjin-gu, Busan Metropolitan City",
              "Production country": "germany",
              "First registration date": "January 3, 2020",
              "New car list price": "136.6 million won",
            }],
          },
          {
            date: "February 24",
            content: [{
              title: "Car inspection completed",
              sub: "regular inspection\nMileage 77,675km",
              "Inspection date": "February 2, 2024",
              "Driving distance during inspection": "77,675km",
              "Inspection category": "regular inspection",
              "inspection station": "Gangnam Automobile Inspection Center",
            }],
          },
        ],
      },
    }]);

    expect(events).toHaveLength(2);
    expect(events[0]?.type).toBe("inspection");
    expect(events[0]?.date).toBe("2024-02-02");
    expect(events[0]?.mileage).toBe(77675);
    expect(events[1]?.type).toBe("new_car_delivery");
    expect(events[1]?.date).toBe("2020-01-03");
    expect(events[1]?.amount).toBe("136,600,000 won");
  });

  it("scales under-reported Encar new car list prices (13.57M → 135.7M)", () => {
    const events = extractRegistryHistoryFromLots([{
      details: {
        history: [{
          date: "November 20",
          content: [{
            title: "New car shipment (corporate name)",
            sub: "Yeongdeungpo -gu, Seoul",
            "New car list price": "13.57 million won",
            "First buyer": "corporation",
          }],
        }],
      },
    }]);

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("new_car_delivery");
    expect(events[0]?.amount).toBe("135,700,000 won");
    expect(events[0]?.details?.find((r) => r.label === "New car list price")?.value).toBe(
      "135,700,000 won",
    );
  });

  it("does not treat Encar drone mileage typos as registry locations", () => {
    const events = extractRegistryHistoryFromLots([{
      details: {
        history: [{
          date: "November 15",
          content: [{
            title: "Automobile inspection completed",
            sub: "Regular inspection\nDrone 76,113km",
            "Inspection date": "November 15, 2024",
            "Drone during inspection": "76,113km",
            Inspection: "Regular inspection",
            "Inspection center": "Seongsan Motor Inspection Center",
          }],
        }],
      },
    }]);

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("inspection");
    expect(events[0]?.mileage).toBe(76_113);
    expect(events[0]?.location).toBeNull();
    expect(events[0]?.subtitle).toBe("Regular inspection");
  });

  it("uses Date of occurrence for insurance events instead of month-only group headers", () => {
    const events = extractRegistryHistoryFromLots([{
      details: {
        history: [
          {
            date: "February 24",
            content: [{
              title: "Insurance processing after damage",
              "Date of occurrence": "September 5, 2024",
              "Total repair cost": "2,566,720 won",
            }],
          },
          {
            date: "October 30",
            content: [{
              title: "Insurance processing after damage",
              "Date of occurrence": "October 30, 2021",
              "Total repair cost": "1,669,566 won",
            }],
          },
        ],
      },
    }]);

    expect(events).toHaveLength(2);
    expect(events[0]?.type).toBe("insurance_event");
    expect(events[0]?.date).toBe("2024-09-05");
    expect(events[1]?.date).toBe("2021-10-30");
  });

  it("parses Encar group headers as month+year, not year-2001 calendar dates", () => {
    const events = extractRegistryHistoryFromLots([{
      details: {
        history: [{
          date: "January 20",
          content: [{
            title: "Insurance processing after damage",
            "Total repair cost": "1,000,000 won",
          }],
        }],
      },
    }]);

    expect(events).toHaveLength(1);
    expect(events[0]?.date).toBe("2020-01-01");
    expect(events[0]?.date).not.toBe("2001-01-20");
  });
});

describe("normalizeEventDate via insurance claims", () => {
  it("parses YYYYMMDD compact insurance dates without treating them as Unix timestamps", () => {
    const normalized = normalizeCarstatResponse({
      year: 2020,
      vin: "TESTVIN123456789",
      manufacturer: { name: "BMW" },
      lots: [{
        domain: { name: "encar_com" },
        location: { country: { iso: "kr" } },
        details: {
          insurance_v2: {
            accidents: [
              { date: "20211030", type: "3", insuranceBenefit: 1669566 },
            ],
          },
        },
      }],
    });

    expect(normalized.insuranceClaims?.[0]?.date).toBe("2021-10-30");
    expect(normalized.accidents?.[0]?.date).toBe("2021-10-30");
  });
});

describe("resolveLotEventDate", () => {
  it("uses final_bid_updated_at when Encar sale_date is null", () => {
    expect(resolveLotEventDate({
      sale_date: null,
      final_bid: 35849,
      final_bid_updated_at: "2026-06-07T12:23:29.000000Z",
      status: { name: "sold" },
    })).toBe("2026-06-07");
  });

  it("prefers sale_date when US auction provides it", () => {
    expect(resolveLotEventDate({
      sale_date: "2021-03-15",
      final_bid_updated_at: "2026-06-07T12:23:29.000000Z",
      status: { name: "sold" },
    })).toBe("2021-03-15");
  });

  it("reads sale_date from nested provider objects", () => {
    expect(resolveLotEventDate({
      sale_date: { date: "2024-06-18T15:30:00.000000Z" },
      final_bid: 8500,
      status: { name: "sold" },
      domain: { name: "copart_com" },
      location: { country: { iso: "us" } },
    })).toBe("2024-06-18");
  });

  it("uses bid timestamps for NA auction lots with final_bid even when status is not sold", () => {
    expect(resolveLotEventDate({
      sale_date: null,
      final_bid: 9200,
      final_bid_updated_at: "2024-08-02T12:00:00.000000Z",
      status: { name: "approved" },
      domain: { name: "iaai_com" },
      location: { country: { iso: "us" } },
    })).toBe("2024-08-02");
  });
});

describe("normalizeCarstatResponse marketData", () => {
  it("uses best NA auction lot for marketData when lots[0] is a marketplace listing", () => {
    const normalized = normalizeCarstatResponse({
      year: 2022,
      vin: "5YFS4MCE0NP127131",
      manufacturer: { name: "Toyota" },
      model: { name: "Corolla Cross" },
      lots: [
        {
          domain: { name: "facebook_com" },
          location: { country: { iso: "us" } },
          bid: 15_000,
          updated_at: "2025-01-01T00:00:00.000000Z",
        },
        {
          domain: { name: "copart_com" },
          location: { country: { iso: "us" }, city: { name: "Dallas" }, state: { code: "tx" } },
          sale_date: "2024-06-18T15:30:00.000000Z",
          final_bid: 8500,
          status: { name: "sold" },
          title: { name: "Clean Title" },
          odometer: { mi: 45_000 },
        },
      ],
    });

    expect(normalized.marketData?.lastAuctionPrice).toBe(8500);
    expect(normalized.marketData?.lastAuctionDate).toBe("2024-06-18");
    const copartAuction = normalized.auctionHistory?.find((e) => e.finalPrice === 8500);
    expect(copartAuction?.date).toBe("2024-06-18");
  });

  it("parses US slash-format sale_date on auction lots", () => {
    const normalized = normalizeCarstatResponse({
      year: 2022,
      vin: "5YFS4MCE0NP127131",
      manufacturer: { name: "Toyota" },
      model: { name: "Corolla Cross" },
      lots: [{
        domain: { name: "copart_com" },
        location: { country: { iso: "us" } },
        sale_date: "06/18/2024",
        final_bid: 8500,
        status: { name: "sold" },
      }],
    });

    expect(normalized.marketData?.lastAuctionDate).toBe("2024-06-18");
  });
});

describe("extractKoreanOwnerHistory", () => {
  it("reads ownership transfers from Encar details.history with dates and mileage", () => {
    const owners = extractKoreanOwnerHistory([{
      details: {
        history: [{
          date: "April 19",
          content: [{
            title: "Ownership",
            sub: "Relocation of the party transaction\n87,100 km of mileage",
            flag: "Direct",
            "Change date": "April 16, 2019",
            "Drown distance when changing": "87,100 km",
            Transaction: "Relocation of the party transaction",
          }],
        }, {
          date: "May 21",
          content: [{
            title: "Ownership",
            "Change date": "May 18, 2021",
            "Drown distance when changing": "115,000 km",
            Transaction: "Relocation of the party transaction",
          }],
        }],
        insurance_v2: { ownerChangeCnt: 2 },
      },
    }], { ownerChangeCnt: 2 });

    expect(owners).toHaveLength(2);
    expect(owners[0]?.date).toBe("2021-05-18");
    expect(owners[0]?.mileage).toBe(115000);
    expect(owners[1]?.date).toBe("2019-04-16");
    expect(owners[1]?.mileage).toBe(87100);
  });

  it("parses ownerChanges when Carstat sends date objects", () => {
    const owners = extractKoreanOwnerHistory([{ details: {} }], {
      ownerChangeCnt: 2,
      ownerChanges: [
        { date: "2024-10-14" },
        { date: "2023-06-29" },
      ],
    });
    expect(owners.map((o) => o.date)).toEqual(["2024-10-14", "2023-06-29"]);
    expect(owners.every((o) => o.lotStatus === "Owner change")).toBe(true);
  });

  it("merges insurance ownerChanges with history ownership rows (does not drop either)", () => {
    const owners = extractKoreanOwnerHistory([{
      details: {
        history: [{
          date: "July 19",
          content: [{
            title: "Owner change",
            "Change date": "June 29, 2023",
            Transaction: "Owner change",
          }, {
            title: "First vehicle number",
            "Initial registration date": "July 31, 2019",
            "Previous plate": "61부****",
          }],
        }],
      },
    }], {
      ownerChangeCnt: 2,
      ownerChanges: ["2024-10-14", "2023-06-29"],
    });

    expect(owners.map((o) => o.date)).toEqual([
      "2024-10-14",
      "2023-06-29",
      "2019-07-31",
    ]);
  });

  it("deduplicates repeated ownership rows with the same date and mileage", () => {
    const owners = extractKoreanOwnerHistory([{
      details: {
        history: [{
          date: "April 19",
          content: [
            {
              title: "Ownership",
              "Change date": "April 16, 2019",
              "Drown distance when changing": "87,100 km",
              Transaction: "Relocation of the party transaction",
            },
            {
              title: "Ownership",
              "Change date": "April 16, 2019",
              "Drown distance when changing": "87,100 km",
              Transaction: "Relocation of the party transaction",
            },
          ],
        }],
      },
    }], {});

    expect(owners).toHaveLength(1);
    expect(owners[0]?.date).toBe("2019-04-16");
    expect(owners[0]?.mileage).toBe(87100);
  });

  it("deduplicates duplicate insurance ownerChanges dates", () => {
    const owners = extractKoreanOwnerHistory([{ details: {} }], {
      ownerChanges: ["2024-12-24", "2024-12-24", "2025-01-13"],
    });
    expect(owners).toHaveLength(2);
    expect(owners.map((o) => o.date)).toEqual(["2025-01-13", "2024-12-24"]);
  });
});

describe("dedupeOwnerHistory", () => {
  it("keeps distinct transfers and drops exact duplicates", () => {
    const input = [
      { date: "2021-05-18", mileage: 115000, lotStatus: "sold", location: null, auctionPrice: null, condition: null },
      { date: "2021-05-18", mileage: 115000, lotStatus: "sold", location: null, auctionPrice: null, condition: null },
      { date: "2019-04-16", mileage: 87100, lotStatus: "sold", location: null, auctionPrice: null, condition: null },
    ];
    expect(dedupeOwnerHistory(input)).toHaveLength(2);
  });

  it("collapses the same transfer when only status labels differ", () => {
    const input = [
      {
        date: "2019-04-16",
        mileage: 87100,
        lotStatus: "Direct",
        location: null,
        auctionPrice: null,
        condition: null,
      },
      {
        date: "April 16, 2019",
        mileage: 87100,
        lotStatus: "Relocation of the party transaction",
        location: null,
        auctionPrice: null,
        condition: null,
      },
    ];
    expect(dedupeOwnerHistory(input, 2015)).toHaveLength(1);
    expect(dedupeOwnerHistory(input, 2015)[0]?.lotStatus).toBeTruthy();
  });
});

describe("isKoreanInsuranceClaimRecord", () => {
  it("detects Korean national insurance payout rows", () => {
    expect(isKoreanInsuranceClaimRecord({ type: "2", insuranceBenefit: 1000 })).toBe(true);
    expect(isKoreanInsuranceClaimRecord({ type: "collision", severity: "minor" })).toBe(false);
  });
});

describe("parseKoreanInspectAccident", () => {
  it("reads Encar inspection summary", () => {
    const result = parseKoreanInspectAccident({
      inspect: {
        accident_summary: {
          accident: "doesn't exist",
          main_framework: "doesn't exist",
          exterior2rank: "yes",
          simple_repair: "yes",
        },
      },
    });
    expect(result.hasStructuralAccident).toBe(false);
    expect(result.hasMinorRepair).toBe(true);
  });
});

describe("pickBestLotPhotoUrls", () => {
  it("uses only the highest tier per lot (no thumbnail duplicates)", () => {
    expect(pickBestLotPhotoUrls({
      downloaded: ["https://cdn/hd-1.jpg", "https://cdn/hd-2.jpg"],
      big: ["https://cdn/big-1.jpg"],
      thumbnail: ["https://cdn/thumb-1.jpg"],
    })).toEqual(["https://cdn/hd-1.jpg", "https://cdn/hd-2.jpg"]);
  });

  it("prefers full big gallery when downloaded cache is partial", () => {
    const big = Array.from({ length: 20 }, (_, i) => `https://cdn/big-${i + 1}.jpg`);
    expect(pickBestLotPhotoUrls({
      downloaded: ["https://cdn/cached-1.webp", "https://cdn/cached-2.webp"],
      big,
      normal: big,
    })).toEqual(big);
  });

  it("falls back to big/normal/thumbnail when higher tiers are empty", () => {
    expect(pickBestLotPhotoUrls({
      big: ["https://cdn/big.jpg"],
      thumbnail: ["https://cdn/thumb.jpg"],
    })).toEqual(["https://cdn/big.jpg"]);
    expect(pickBestLotPhotoUrls({ thumbnail: ["https://cdn/thumb.jpg"] }))
      .toEqual(["https://cdn/thumb.jpg"]);
  });

  it("prefers higher-quality tier when counts tie (normal over partial downloaded cache)", () => {
    expect(pickBestLotPhotoUrls({
      downloaded: ["https://cdn/cached-1.webp", "https://cdn/cached-2.webp"],
      normal: ["https://cdn/a-n.jpg", "https://cdn/b-n.jpg"],
      thumbnail: ["https://cdn/a-t.jpg", "https://cdn/b-t.jpg"],
    })).toEqual(["https://cdn/a-n.jpg", "https://cdn/b-n.jpg"]);
  });

  it("pickDisplayLotPhotoUrls prefers normal over big when counts tie", () => {
    const normal = ["https://cdn/a-n.jpg", "https://cdn/b-n.jpg"];
    const big = ["https://cdn/a-b.jpg", "https://cdn/b-b.jpg"];
    expect(pickDisplayLotPhotoUrls({ normal, big })).toEqual(normal);
    expect(pickBestLotPhotoUrls({ normal, big })).toEqual(big);
  });

  it("does not use Copart/IAA 360 exterior/interior frames as the main gallery", () => {
    const normal = Array.from({ length: 12 }, (_, i) => `https://cdn/n-${i}.jpg`);
    const big = Array.from({ length: 12 }, (_, i) => `https://cdn/b-${i}.jpg`);
    const exterior = Array.from({ length: 64 }, (_, i) => `https://cdn/ext-${i}.jpg`);
    const interior = Array.from({ length: 48 }, (_, i) => `https://cdn/int-${i}.jpg`);
    expect(pickBestLotPhotoUrls({ normal, big, exterior, interior })).toEqual(big);
    expect(pickDisplayLotPhotoUrls({ normal, big, exterior, interior })).toEqual(normal);

    const normalized = normalizeCarstatResponse({
      year: 2014,
      vin: "WDDLJ9BB6EA096494",
      manufacturer: { name: "Mercedes-Benz" },
      model: { name: "CLA" },
      lots: [{
        domain: { name: "copart_com" },
        images: { normal, big, exterior, interior },
      }],
    });
    expect(normalized.photos).toEqual(normal);
    expect(normalized.photosHd).toEqual(big);
    expect(normalized.photos360Exterior).toEqual(exterior);
    expect(normalized.photos360Interior).toEqual(interior);
  });

  it("extracts interior spin from alternate keys and object maps", () => {
    const normal = Array.from({ length: 8 }, (_, i) => `https://cdn/n-${i}.jpg`);
    const exterior = Array.from({ length: 16 }, (_, i) => `https://cdn/ext/${i}.jpg`);
    const interiorObj: Record<string, string> = {};
    for (let i = 0; i < 12; i++) interiorObj[String(i)] = `https://cdn/int/${i}.jpg`;

    const normalized = normalizeCarstatResponse({
      year: 2014,
      vin: "WDDLJ9BB6EA096494",
      manufacturer: { name: "Mercedes-Benz" },
      model: { name: "CLA" },
      lots: [{
        domain: { name: "iaai_com" },
        images: { normal, Exterior_360: exterior, Interior360: interiorObj },
      }],
    });
    expect(normalized.photos360Exterior).toEqual(exterior);
    expect(normalized.photos360Interior).toHaveLength(12);
  });

  it("splits mixed exterior spin URLs into cabin vs body when interior tier is missing", () => {
    const normal = Array.from({ length: 8 }, (_, i) => `https://cdn/n-${i}.jpg`);
    const mixed = [
      ...Array.from({ length: 20 }, (_, i) => `https://cdn/360/ext/frame-${i}.jpg`),
      ...Array.from({ length: 16 }, (_, i) => `https://cdn/360/int/frame-${i}.jpg`),
    ];
    const normalized = normalizeCarstatResponse({
      year: 2014,
      vin: "WDDLJ9BB6EA096494",
      manufacturer: { name: "Mercedes-Benz" },
      model: { name: "CLA" },
      lots: [{
        domain: { name: "copart_com" },
        images: { normal, exterior: mixed },
      }],
    });
    expect(normalized.photos360Exterior?.length).toBeGreaterThanOrEqual(20);
    expect(normalized.photos360Interior?.length).toBe(16);
  });

  it("extracts IAAI external_panorama_url when exterior/interior frame arrays are null", () => {
    const normal = Array.from({ length: 8 }, (_, i) => `https://cdn/n-${i}.jpg`);
    const embed =
      "https://vis.iaai.com/Home/ThreeSixtyView?keys=SID-45976616~STP-1~INT-1&iframeview=true";
    const normalized = normalizeCarstatResponse({
      year: 2018,
      vin: "5UXKR0C59J0Y06117",
      manufacturer: { name: "BMW" },
      model: { name: "X5" },
      lots: [{
        domain: { name: "iaai_com" },
        images: {
          normal,
          exterior: null,
          interior: null,
          external_panorama_url: embed,
        },
      }],
    });
    expect(normalized.photos360Exterior).toBeUndefined();
    expect(normalized.photos360Interior).toBeUndefined();
    expect(normalized.photos360EmbedUrl).toBe(embed);
    expect(normalized.photos360EmbedExteriorUrl).toContain("STP-1");
    expect(normalized.photos360EmbedExteriorUrl).not.toContain("INT-1");
    expect(normalized.photos360EmbedInteriorUrl).toContain("INT-1");
    expect(normalized.photos360EmbedInteriorUrl).not.toContain("STP-1");
  });

  it("rejects non-auction panorama hosts", () => {
    const normal = Array.from({ length: 4 }, (_, i) => `https://cdn/n-${i}.jpg`);
    const normalized = normalizeCarstatResponse({
      year: 2018,
      vin: "5UXKR0C59J0Y06117",
      manufacturer: { name: "BMW" },
      model: { name: "X5" },
      lots: [{
        domain: { name: "iaai_com" },
        images: {
          normal,
          exterior: null,
          interior: null,
          external_panorama_url: "https://evil.example/pwn",
        },
      }],
    });
    expect(normalized.photos360EmbedUrl).toBeUndefined();
  });

  it("marks IAAI auction catalog rows without 360 media as stale", () => {
    const stale = {
      country: "US",
      photos: Array.from({ length: 12 }, (_, i) => `https://cdn/n-${i}.jpg`),
      mileageHistory: [{ source: "na_auction", date: "2024-01-01", odometer: 10000 }],
      auctionHistory: [{ date: "2024-01-01", finalPrice: 1000 }],
    };
    expect(isMissingAuction360Media(stale)).toBe(true);
    expect(isStaleCachedReport(stale)).toBe(true);
    expect(isMissingAuction360Media({
      ...stale,
      photos360EmbedUrl: "https://vis.iaai.com/Home/ThreeSixtyView?keys=SID-1~STP-1&iframeview=true",
    })).toBe(false);
  });

  it("stores mid-size photos for display and HD for lightbox when both tiers exist", () => {
    const normal = Array.from({ length: 10 }, (_, i) => `https://cdn/n-${i}.jpg`);
    const big = Array.from({ length: 10 }, (_, i) => `https://cdn/b-${i}.jpg`);
    const normalized = normalizeCarstatResponse({
      year: 2020,
      vin: "WBA3V7106FJ995387",
      manufacturer: { name: "BMW" },
      model: { name: "3 Series" },
      lots: [{
        domain: { name: "copart_com" },
        images: { normal, big },
      }],
    });
    expect(normalized.photos).toEqual(normal);
    expect(normalized.photosHd).toEqual(big);
  });

  it("normalizes Carstat response without mixing resolution tiers", () => {
    const normalized = normalizeCarstatResponse({
      year: 2020,
      vin: "WBA3V7106FJ995387",
      manufacturer: { name: "BMW" },
      model: { name: "3 Series" },
      lots: [{
        domain: { name: "encar_com" },
        images: {
          downloaded: ["https://cdn/a-hd.jpg", "https://cdn/b-hd.jpg"],
          normal: ["https://cdn/a-n.jpg", "https://cdn/b-n.jpg"],
          thumbnail: ["https://cdn/a-t.jpg", "https://cdn/b-t.jpg"],
        },
      }],
    });
    expect(normalized.photos).toEqual(["https://cdn/a-n.jpg", "https://cdn/b-n.jpg"]);
  });

  it("uses full Encar gallery when downloaded cache is partial", () => {
    const gallery = Array.from({ length: 20 }, (_, i) => `https://encar/photo-${i + 1}.jpg`);
    const normalized = normalizeCarstatResponse({
      year: 2024,
      vin: "WBAGV8106RCR24769",
      manufacturer: { name: "BMW" },
      model: { name: "8 Series" },
      lots: [{
        domain: { name: "encar_com" },
        images: {
          downloaded: ["https://carstat/1.webp", "https://carstat/2.webp"],
          big: gallery,
        },
      }],
    });
    expect(normalized.photos).toHaveLength(20);
    expect(normalized.photos?.[0]).toBe("https://encar/photo-1.jpg");
  });

  it("reads images when lot.images is a flat array", () => {
    const gallery = Array.from({ length: 12 }, (_, i) => `https://encar/img-${i}.jpg`);
    const normalized = normalizeCarstatResponse({
      year: 2015,
      vin: "TESTVIN1234567890",
      manufacturer: { name: "BMW" },
      model: { name: "7 Series" },
      lots: [{
        domain: { name: "encar_com" },
        images: gallery,
      }],
    });
    expect(normalized.photos).toHaveLength(12);
  });
});

describe("mergeVinPhotoLists", () => {
  it("prefers longer photo lists first when merging", () => {
    const merged = mergeVinPhotoLists(
      ["https://cdn/a.jpg", "https://cdn/b.jpg"],
      Array.from({ length: 10 }, (_, i) => `https://encar/${i}.jpg`),
    );
    expect(merged).toHaveLength(12);
    expect(merged[0]).toBe("https://encar/0.jpg");
  });
});

describe("preserveManualMileageAnnotations", () => {
  it("copies manual description/location onto matching provider mileage rows", () => {
    const previous = [
      { date: "2024-01-15", odometer: 50000, description: "Oil change", location: "Tirana" },
      { date: "2023-06-01", odometer: 40000, description: "Brakes" },
    ];
    const incoming = [
      { date: "2024-01-15", odometer: 50000, source: "listing", unit: "km" },
      { date: "2023-06-01", odometer: 40000, source: "listing", unit: "km" },
      { date: "2025-01-01", odometer: 60000, source: "listing", unit: "km" },
    ];
    expect(preserveManualMileageAnnotations(incoming, previous)).toEqual([
      {
        date: "2024-01-15",
        odometer: 50000,
        source: "listing",
        unit: "km",
        description: "Oil change",
        location: "Tirana",
      },
      {
        date: "2023-06-01",
        odometer: 40000,
        source: "listing",
        unit: "km",
        description: "Brakes",
      },
      { date: "2025-01-01", odometer: 60000, source: "listing", unit: "km" },
    ]);
  });

  it("does not overwrite an incoming description", () => {
    const previous = [{ date: "2024-01-15", odometer: 50000, description: "manual" }];
    const incoming = [{ date: "2024-01-15", odometer: 50000, description: "from-provider" }];
    expect(preserveManualMileageAnnotations(incoming, previous)).toEqual([
      { date: "2024-01-15", odometer: 50000, description: "from-provider" },
    ]);
  });
});

describe("pickRicherVinReportData", () => {
  it("prefers payload with registry timeline over catalog without it", () => {
    const catalog = { country: "kr", insuranceClaims: [{ date: "2020-01-01" }], registryHistory: [] };
    const lookup = {
      country: "kr",
      insuranceClaims: [{ date: "2020-01-01" }],
      registryHistory: [{ type: "inspection", date: "April 2017" }],
    };
    expect(pickRicherVinReportData(catalog, lookup)).toEqual(lookup);
    expect(vinReportDataRichnessScore(lookup)).toBeGreaterThan(vinReportDataRichnessScore(catalog));
  });

  it("carries frozen krwPerUsd from catalog when richer lookup lacks it", () => {
    const catalog = { country: "kr", krwPerUsd: 1500, registryHistory: [] };
    const lookup = {
      country: "kr",
      registryHistory: [{ type: "inspection", date: "April 2017" }],
    };
    expect(pickRicherVinReportData(catalog, lookup)).toEqual({
      country: "kr",
      registryHistory: [{ type: "inspection", date: "April 2017" }],
      krwPerUsd: 1500,
    });
  });

  it("merges photos from both catalog and lookup up to 24", () => {
    const catalog = {
      country: "kr",
      registryHistory: [{ type: "inspection", date: "2020-01-01" }],
      photos: ["https://cdn/a.jpg", "https://cdn/b.jpg"],
    };
    const lookup = {
      country: "kr",
      photos: Array.from({ length: 20 }, (_, i) => `https://encar/${i}.jpg`),
    };
    const merged = pickRicherVinReportData(catalog, lookup);
    expect(merged?.photos).toHaveLength(22);
    expect(merged?.photos?.[0]).toBe("https://encar/0.jpg");
    expect(merged?.photos).toContain("https://cdn/a.jpg");
  });
});

describe("pickVinReportDataForServe", () => {
  it("uses newer lookup odometer over stale catalog (admin mileage edit)", () => {
    const catalogUpdatedAt = new Date("2026-01-01T00:00:00Z");
    const lookupUpdatedAt = new Date("2026-06-24T12:00:00Z");
    const catalog = {
      make: "BMW",
      model: "7 Series",
      year: 2016,
      odometer: 150_000,
      mileageHistory: [{ date: "2024-01-01", odometer: 150_000 }],
    };
    const lookup = {
      odometer: 315_707,
      mileageHistory: [{ date: "2026-06-01", odometer: 315_707 }],
    };
    expect(pickVinReportDataForServe(catalog, catalogUpdatedAt, lookup, lookupUpdatedAt)).toMatchObject({
      odometer: 315_707,
    });
    const merged = pickVinReportDataForServe(catalog, catalogUpdatedAt, lookup, lookupUpdatedAt);
    expect(merged?.mileageHistory).toEqual(
      expect.arrayContaining([
        { date: "2026-06-01", odometer: 315_707 },
      ]),
    );
  });

  it("uses newer catalog over stale lookup when catalog was saved later", () => {
    const catalogUpdatedAt = new Date("2026-06-24T12:00:00Z");
    const lookupUpdatedAt = new Date("2026-01-01T00:00:00Z");
    const catalog = {
      odometer: 42000,
      mileageHistory: [{ date: "2026-06-01", odometer: 42000 }],
    };
    const lookup = {
      odometer: 99000,
      mileageHistory: [
        { date: "2024-01-01", odometer: 80000 },
        { date: "2025-01-01", odometer: 99000 },
      ],
    };
    expect(pickVinReportDataForServe(catalog, catalogUpdatedAt, lookup, lookupUpdatedAt)).toMatchObject({
      odometer: 42000,
    });
    const merged = pickVinReportDataForServe(catalog, catalogUpdatedAt, lookup, lookupUpdatedAt);
    expect(merged?.mileageHistory).toEqual(
      expect.arrayContaining([
        { date: "2026-06-01", odometer: 42000 },
      ]),
    );
  });

  it("unions mileage history when timestamps tie", () => {
    const ts = new Date("2026-06-01T00:00:00Z");
    const catalog = {
      odometer: 315_707,
      mileageHistory: [{ date: "2026-06-01", odometer: 315_707 }],
    };
    const lookup = {
      odometer: 315_707,
      mileageHistory: [{ date: "2025-01-01", odometer: 280_000 }],
    };
    const merged = pickVinReportDataForServe(catalog, ts, lookup, ts);
    expect(merged?.odometer).toBe(315_707);
    expect(merged?.mileageHistory).toHaveLength(2);
  });

  it("uses locked catalog mileage only when odometerLocked", () => {
    const ts = new Date("2026-06-01T00:00:00Z");
    const catalog = {
      odometer: 42_000,
      odometerLocked: true,
      mileageHistory: [{ date: "2026-06-01", odometer: 42_000 }],
    };
    const lookup = {
      odometer: 99_000,
      mileageHistory: [{ date: "2024-01-01", odometer: 99_000 }],
    };
    const merged = pickVinReportDataForServe(catalog, ts, lookup, ts);
    expect(merged?.odometer).toBe(42_000);
    expect(merged?.mileageHistory).toHaveLength(1);
    expect(merged?.mileageHistory).toEqual([{ date: "2026-06-01", odometer: 42_000 }]);
  });
});

describe("isStaleKoreanReport", () => {
  it("flags Korean reports with claims but no registry history", () => {
    expect(isStaleKoreanReport({
      country: "kr",
      insuranceClaims: [{ date: "2020-01-01" }],
      registryHistory: [],
    })).toBe(true);
    expect(isStaleKoreanReport({
      country: "kr",
      insuranceClaims: [{ date: "2020-01-01" }],
      registryHistory: [{ type: "inspection" }],
      photos: Array.from({ length: 8 }, (_, i) => `https://cdn/${i}.jpg`),
    })).toBe(false);
    expect(isStaleKoreanReport({
      country: "kr",
      insuranceClaims: [{ date: "2020-01-01" }],
      registryHistory: [{ type: "inspection" }],
      photos: ["https://cdn/a.jpg", "https://cdn/b.jpg"],
    })).toBe(true);
    expect(isStaleKoreanReport({
      country: "kr",
      insuranceClaims: [{}, {}, {}, {}],
      registryHistory: [{ type: "inspection" }],
      ownerCount: 4,
      photos: Array.from({ length: 10 }, (_, i) => `https://cdn/${i}.jpg`),
    })).toBe(true);
    expect(isStaleKoreanReport({ country: "us", insuranceClaims: [{ date: "2020-01-01" }] })).toBe(false);
  });
});

describe("isCarstatMirroredPreviewUrl", () => {
  it("detects i2.carstat.dev and carstat.dev webp mirrors", () => {
    expect(isCarstatMirroredPreviewUrl("https://i2.carstat.dev/copart/toyota/1.webp")).toBe(true);
    expect(isCarstatMirroredPreviewUrl("https://carstat.dev/cache/encar/2.webp")).toBe(true);
    expect(isCarstatMirroredPreviewUrl("https://encar.com/photo-1.jpg")).toBe(false);
    expect(isCarstatMirroredPreviewUrl("https://cs.copart.com/v1/photo.jpg")).toBe(false);
  });
});

describe("vinDataHasCorruptObjectMarker", () => {
  it("detects literal [object Object] strings without JSON.stringify", () => {
    expect(vinDataHasCorruptObjectMarker({ make: "[object Object]", model: "Civic" })).toBe(true);
    expect(vinDataHasCorruptObjectMarker({ nested: { history: ["ok", "[object Object]"] } })).toBe(true);
  });

  it("ignores clean report payloads", () => {
    expect(vinDataHasCorruptObjectMarker({
      make: "Honda",
      model: "Civic",
      mileageHistory: [{ date: "2020-01-01", odometer: 50000 }],
    })).toBe(false);
  });

  it("matches JSON.stringify probe semantics for mixed trees", () => {
    const corrupt = { photos: ["https://x.test/1.jpg"], notes: "[object Object]" };
    expect(vinDataHasCorruptObjectMarker(corrupt)).toBe(
      JSON.stringify(corrupt).includes("[object Object]"),
    );
  });
});

describe("isPartialCarstatPhotoCache / isStaleCachedReport", () => {
  const copartCache = Array.from({ length: 5 }, (_, i) =>
    `https://i2.carstat.dev/copart/toyota/camry/2007/${i + 1}.webp`);

  it("flags USA Copart rows that only stored partial Carstat webp cache", () => {
    const row = { country: "us", photos: copartCache };
    expect(isPartialCarstatPhotoCache(row)).toBe(true);
    expect(isStaleCachedReport(row)).toBe(true);
    expect(isStaleKoreanReport(row)).toBe(false);
  });

  it("flags Korean Encar rows with only Carstat webp previews", () => {
    const row = {
      country: "kr",
      photos: [
        "https://carstat.dev/cache/encar/1.webp",
        "https://carstat.dev/cache/encar/2.webp",
      ],
      registryHistory: [],
      insuranceClaims: [],
    };
    expect(isPartialCarstatPhotoCache(row)).toBe(true);
    expect(isStaleCachedReport(row)).toBe(true);
    expect(isStaleKoreanReport(row)).toBe(true);
  });

  it("flags Korean rows with Carstat previews even when registry is not extracted yet", () => {
    const row = {
      country: "kr",
      photos: ["https://i2.carstat.dev/encar/bmw/1.webp"],
      ownerCount: 1,
    };
    expect(isStaleKoreanReport(row)).toBe(true);
    expect(isStaleCachedReport(row)).toBe(true);
  });

  it("does not flag Korean rows with a short but native Encar gallery and no registry", () => {
    const row = {
      country: "kr",
      photos: [
        "https://img.encar.com/photo-1.jpg",
        "https://img.encar.com/photo-2.jpg",
        "https://img.encar.com/photo-3.jpg",
      ],
      registryHistory: [],
    };
    expect(isPartialCarstatPhotoCache(row)).toBe(false);
    expect(isStaleKoreanReport(row)).toBe(false);
    expect(isStaleCachedReport(row)).toBe(false);
  });

  it("does not flag full Copart galleries already stored on the row", () => {
    const row = {
      country: "us",
      photos: Array.from({ length: 12 }, (_, i) => `https://cs.copart.com/v1/photo-${i}.jpg`),
    };
    expect(isPartialCarstatPhotoCache(row)).toBe(false);
    expect(isStaleCachedReport(row)).toBe(false);
  });
});

describe("pickLotHistoryBlocks merge", () => {
  it("merges registry content from all lots instead of keeping only the longest block", () => {
    const events = extractRegistryHistoryFromLots([
      {
        details: {
          history: [{
            date: "February 24",
            content: [{
              title: "Car inspection completed",
              sub: "regular inspection\nMileage 77,675km",
              "Driving distance during inspection": "77,675km",
            }],
          }],
        },
      },
      {
        details: {
          history: [{
            date: "January 20",
            content: [{
              title: "New car delivery (corporate name)",
              "New car list price": "136.6 million won",
            }, {
              title: "Insurance processing after damage",
              "Date of occurrence": "September 5, 2024",
              "Total repair cost": "2,566,720 won",
            }],
          }],
        },
      },
    ]);

    expect(events.some((e) => e.type === "inspection")).toBe(true);
    expect(events.some((e) => e.type === "new_car_delivery")).toBe(true);
    expect(events.some((e) => e.type === "insurance_event")).toBe(true);
    expect(events.length).toBeGreaterThanOrEqual(3);
  });
});

describe("repairEncarMisParsedIsoDate", () => {
  it("fixes legacy 2001-MM-DD Encar header mis-parses using vehicle year", () => {
    expect(repairEncarMisParsedIsoDate("2001-01-20", 2020)).toBe("2020-01-01");
    expect(repairEncarMisParsedIsoDate("2001-08-23", 2020)).toBe("2023-08-01");
  });
});

describe("sanitizeReportIsoDate", () => {
  it("rejects insurance dates before the car model year", () => {
    expect(sanitizeReportIsoDate("2019-03-15", 2020)).toBeNull();
  });

  it("normalizes US auction calendar strings to ISO", () => {
    expect(sanitizeReportIsoDate("May 18, 2021", 2018)).toBe("2021-05-18");
    expect(sanitizeReportIsoDate("05/18/2021", 2018)).toBe("2021-05-18");
    expect(sanitizeReportIsoDate("2021-05", 2018)).toBe("2021-05-01");
  });
});

describe("classifyKoreanRegistryTitle", () => {
  it("classifies non-insurance with spaced hyphen", () => {
    expect(classifyKoreanRegistryTitle("Non -insurance")).toBe("no_insurance");
    expect(classifyKoreanRegistryTitle("New car shipment (corporate name)")).toBe("new_car_delivery");
  });
});

describe("isKoreanRecallRegistryItem", () => {
  it("detects recall rows from Encar history content", () => {
    expect(isKoreanRecallRegistryItem({
      title: "[Ride and indoor devices] Included in the recall target",
      sub: "Recall completion",
      flag: "Recall completion",
      "Recall date": "February 13, 2019",
    })).toBe(true);
    expect(isKoreanRecallRegistryItem({
      title: "Automobile inspection completed",
      sub: "Comprehensive examination 86,730 km of mileage",
    })).toBe(false);
  });
});

describe("extractRegistryHistoryFromLots — WBA3V7106FJ995387 shape", () => {
  it("maps full Encar registry timeline including multi-item groups", () => {
    const events = extractRegistryHistoryFromLots([{
      domain: { name: "encar_com" },
      details: {
        history: [
          {
            date: "April 15, April 15",
            content: [{
              title: "New car shipment (corporate name)",
              sub: "Anyang-si, Gyeonggi-do\nNo new car shipment is no information",
              flag: "Corporation",
              "Production country": "germany",
              "Production date": "November 07, 2014",
              "Initial registration date": "April 27, 2015",
              "First buyer": "corporation",
              "Address when purchasing": "Anyang-si, Gyeonggi-do",
            }, {
              title: "Non -insurance",
              sub: "Unregistered period: April 2005 -April 2019",
              period: "April 2015 -April 2019 (Total 48 months)",
            }],
          },
          {
            date: "April 19",
            content: [{
              title: "Automobile inspection completed",
              sub: "Comprehensive examination 86,730 km of mileage",
              "Inspection date": "April 10, 2019",
              "Drone during inspection": "86,730 km",
              Inspection: "Comprehensive examination",
              "Inspection center": "Hyundai Special Industrial Co., Ltd.",
            }, {
              title: "Ownership",
              sub: "Relocation of the party transaction 87,100 km of mileage",
              flag: "Direct",
              "Change date": "April 16, 2019",
              "Drown distance when changing": "87,100 km",
              Transaction: "Relocation of the party transaction",
            }],
          },
          {
            date: "February 19",
            content: [{
              title: "[Ride and indoor devices] Included in the recall target",
              sub: "Recall completion",
              flag: "Recall completion",
              "Recall date": "February 13, 2019",
              Target: "Produced vehicles between (January 03, 2014 and June 30, 2017)",
              Correction: "Driver's seat airbag inflator replacement",
            }],
          },
        ],
      },
    }]);

    expect(events.length).toBeGreaterThanOrEqual(4);
    expect(events.some((e) => e.type === "new_car_delivery")).toBe(true);
    expect(events.some((e) => e.type === "no_insurance")).toBe(true);
    expect(events.some((e) => e.type === "inspection" && e.mileage === 86_730)).toBe(true);
    expect(events.some((e) => e.type === "owner_change" && e.mileage === 87_100)).toBe(true);
    expect(events.some((e) => e.type === "recall")).toBe(false);
    expect(events.every((e) => !/recall/i.test(e.title ?? "") && !/recall/i.test(e.subtitle ?? ""))).toBe(true);

    const byType = Object.fromEntries(events.map((e) => [e.type, e]));
    expect(byType.new_car_delivery?.date).toBe("2015-04-27");
    expect(byType.no_insurance?.date).toBe("2019-04-01");
    expect(byType.inspection?.date).toBe("2019-04-10");
    expect(byType.owner_change?.date).toBe("2019-04-16");
  });

  it("extracts recalls into a separate timeline", () => {
    const recalls = extractRecallHistoryFromLots([{
      domain: { name: "encar_com" },
      details: {
        history: [{
          date: "February 19",
          content: [{
            title: "[Ride and indoor devices] Included in the recall target",
            sub: "Recall completion",
            flag: "Recall completion",
            "Recall date": "February 13, 2019",
            Target: "Produced vehicles between (January 03, 2014 and June 30, 2017)",
            Correction: "Driver's seat airbag inflator replacement",
          }],
        }],
      },
    }]);

    expect(recalls).toHaveLength(1);
    expect(recalls[0]?.type).toBe("recall");
    expect(recalls[0]?.date).toBe("2019-02-13");
    expect(recalls[0]?.details?.some((d) => /correction/i.test(d.label))).toBe(true);
  });

  it("deduplicates identical registry rows across relisted Encar lots", () => {
    const lot = {
      details: {
        history: [{
          date: "April 19",
          content: [{
            title: "Automobile inspection completed",
            "Inspection date": "April 10, 2019",
            "Drone during inspection": "86,730 km",
          }],
        }],
      },
    };
    const once = extractRegistryHistoryFromLots([lot]);
    const twice = extractRegistryHistoryFromLots([lot, lot]);
    expect(once).toHaveLength(1);
    expect(twice).toHaveLength(1);
    expect(twice[0]?.date).toBe("2019-04-10");
  });

  it("orders mileage-only rows by group date then mileage", () => {
    const events = extractRegistryHistoryFromLots([{
      details: {
        history: [
          {
            date: "January 20",
            content: [{ title: "Car inspection completed", sub: "Mileage 15,309 km" }],
          },
          {
            date: "April 19",
            content: [{ title: "Car inspection completed", sub: "Mileage 70,260 km" }],
          },
          {
            date: "February 24",
            content: [{ title: "Car inspection completed", sub: "Mileage 73,765 km" }],
          },
        ],
      },
    }]);
    expect(events.map((e) => e.mileage)).toEqual([73_765, 15_309, 70_260]);
  });

  it("keeps distinct insurance events on the same day when repair costs differ", () => {
    const events = extractRegistryHistoryFromLots([{
      details: {
        history: [{
          date: "February 24",
          content: [
            {
              title: "Insurance processing after damage",
              "Date of occurrence": "September 5, 2024",
              "Total repair cost": "2,566,720 won",
            },
            {
              title: "Insurance processing after damage",
              "Date of occurrence": "September 5, 2024",
              "Total repair cost": "1,200,000 won",
            },
          ],
        }],
      },
    }]);
    expect(events).toHaveLength(2);
  });
});

describe("resolveRegistryAccidentLossAmount", () => {
  it("uses total repair cost only, not new car list price", () => {
    const amount = resolveRegistryAccidentLossAmount({
      type: "insurance_event",
      title: "Insurance processing after damage",
      date: "2021-10-30",
      amount: "306,000,000 won",
      details: [
        { label: "New car list price", value: "306,000,000 won" },
        { label: "Total repair cost", value: "1,369,200 won" },
      ],
    });
    expect(amount).toBe(1_369_200);
  });

  it("returns null for inflated repair cost values", () => {
    const amount = resolveRegistryAccidentLossAmount({
      type: "insurance_event",
      details: [{ label: "Total repair cost", value: "306,000,000 won" }],
    });
    expect(amount).toBeNull();
  });

  it("returns null when only list price is present", () => {
    const amount = resolveRegistryAccidentLossAmount({
      type: "insurance_event",
      amount: "306,000,000 won",
      details: [{ label: "New car list price", value: "306,000,000 won" }],
    });
    expect(amount).toBeNull();
  });
});

describe("mapRegistryEventToAccident", () => {
  it("does not attach inflated list price as accident damage", () => {
    const accident = mapRegistryEventToAccident({
      type: "insurance_event",
      title: "Insurance processing after damage",
      date: "2021-10-30",
      amount: "306,000,000 won",
      details: [{ label: "New car list price", value: "306,000,000 won" }],
    }, "kr");
    expect(accident?.lossAmount).toBeNull();
    expect(accident?.type).toBe("registry");
  });
});

describe("normalizeHistoryGroupDate", () => {
  it("unwraps duplicated Encar headers", () => {
    expect(normalizeHistoryGroupDate("April 15, April 15")).toBe("April 15");
    expect(normalizeHistoryGroupDate("January 20")).toBe("January 20");
  });
});

describe("dedupeRegistryHistoryEvents", () => {
  it("keeps the richer row when normalized dates collide", () => {
    const events = dedupeRegistryHistoryEvents([
      { type: "inspection", date: "2001-08-23", title: "Car inspection completed", mileage: 50_000 },
      { type: "inspection", date: "2023-08-01", title: "Car inspection completed", mileage: 50_000, subtitle: "regular inspection" },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]?.subtitle).toBe("regular inspection");
  });
});

describe("WBA5V510XKAJ52378 — provider total loss drives salvage flag", () => {
  it("flags isSalvage from insurance_v2.totalLossCnt (not invented)", () => {
    const fixturePath = join(
      dirname(fileURLToPath(import.meta.url)),
      "fixtures",
      "WBA5V510XKAJ52378-carstat-raw.json",
    );
    const raw = JSON.parse(readFileSync(fixturePath, "utf8"));
    const insurance = raw.data?.lots?.[0]?.details?.insurance_v2;
    expect(insurance?.totalLossCnt).toBe(1);
    expect(insurance?.totalLossDate).toBe("2020-12-05");

    const normalized = normalizeCarstatResponse(raw);

    expect(normalized.country).toBe("kr");
    expect(normalized.isSalvage).toBe(true);
    expect(normalized.accidentCount).toBe(5);

    const totalLossEvents = (normalized.accidents ?? []).filter((a) => a.severity === "total_loss");
    expect(totalLossEvents.some((a) => a.date?.startsWith("2020-12-05"))).toBe(true);
  });
});
