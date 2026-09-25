import { describe, expect, it } from "vitest";
import { milesToKm, readingToKm, parseOdometerNumber } from "./provider-pdf-miles";
import {
  cleanHistoryLocation,
  cleanHistoryNote,
  cleanModelName,
  detectProviderPdfKind,
  extractHistoryLocation,
  extractHistoryOdometerKm,
  extractVinsFromText,
  parseEngine,
  parseProviderPdfText,
  parseVehicleCountry,
  sanitizeCustomerFacingText,
  splitEventComment,
} from "./provider-pdf-parse";
import { applyProviderPdfToForm } from "./provider-pdf-apply";
import { EMPTY_VIN_CATALOG_FORM } from "@/components/admin/vin-catalog-data-form";

const SAMPLE_VIN = "1HGCM82633A004352";
const OTHER_VIN = "5YJSA1E14HF000001";
const AUDI_VIN = "WAUZZZ4G0DN000001";
const TIGUAN_VIN = "3VV0B7AX5KM000001";

const CARFAX_FIXTURE = `
CARFAX Vehicle History Report
VIN: ${SAMPLE_VIN}
Year: 2019
Make: Honda
Model: Civic EX
Engine: 2.0L I4 Turbo
Transmission: Automatic
Fuel Type: Gasoline
Body Style: Sedan
Exterior Color: Blue - vehicle noted
Title: Clean Title
Number of Owners: 2
Odometer: 45,230 miles

Accident / Damage History
03/15/2021 Collision reported 32,100 miles Austin, TX Front impact damage

Owner History
01/10/2019 Title issued Personal lease Houston, TX 12 miles
06/20/2021 Sold / Ownership transferred 33,400 miles Austin, TX

Odometer History
01/10/2019 12 miles Title / Registration
03/15/2021 32,100 miles Accident reported
11/02/2023 45,230 miles Inspection

Service History
05/12/2020 Oil change and filter replaced 28,400 miles Austin, TX
09/01/2022 Brake pads replaced 40,100 miles Austin, TX
`;

const AUTOCHECK_FIXTURE = `
AutoCheck Vehicle History Report
Experian AutoCheck
VIN ${SAMPLE_VIN}
2018 Toyota Camry SE
Engine 2.5L I4
Transmission Automatic
Fuel Gasoline
Body Sedan
Color White - vehicle
Owners 1
Last reported odometer 28,500 mi
Title brand: Salvage
Accident Information
07/04/2020 Accident 18,200 miles Dallas, TX Side impact
`;

const AUDI_FIXTURE = `
CARFAX Vehicle History Report
VIN: ${AUDI_VIN}
Year: 2013
Make: Audi
Model: A6 Prestige
Engine: 3.0L V6 TFSI Supercharged
Fuel Type: Gasoline
Body Style: Sedan
Detailed Vehicle History
01/05/2012 10 miles Title issued
06/15/2025 90,000 miles Service oil change
`;

const CANADA_TIGUAN_FIXTURE = `
CARFAX Canada Vehicle History Report
VIN: ${TIGUAN_VIN}
Year: 2019
Make: Volkswagen
Model: Tiguan S 164
Engine: 2.0L I4 F DOHC 16V Gasoline
Transmission Automatic
Fuel Type: Gasoline
Body Style: SUV
Ontario Motor Vehicle Dept.
Detailed Vehicle History
01/10/2019 Title / Registration 12 km Source: Ontario Ministry of Transportation
06/15/2021 Service performed Oil change 80,000 km Source: Ontario Dealer
03/20/2024 Odometer reading 164,532 km Source: Ontario Motor Vehicle Dept.
Toronto, ON registration renewal
`;

describe("provider-pdf-miles", () => {
  it("converts miles to km", () => {
    expect(milesToKm(1000)).toBe(1609);
    expect(milesToKm(45230)).toBe(Math.round(45230 * 1.609344));
  });

  it("parses odometer numbers with commas", () => {
    expect(parseOdometerNumber("45,230")).toBe(45230);
    expect(parseOdometerNumber("bad")).toBeNull();
  });

  it("respects explicit km unit", () => {
    expect(readingToKm(50000, "km")).toBe(50000);
    expect(readingToKm(1000, "miles")).toBe(1609);
  });
});

describe("cleanHistoryNote", () => {
  it("strips mileage and dates from notes", () => {
    const note = cleanHistoryNote("05/12/2020 Oil change 28,400 miles Austin, TX");
    expect(note.toLowerCase()).toContain("oil change");
    expect(note).not.toMatch(/28,?400/);
    expect(note).not.toMatch(/05\/12\/2020/);
  });
});

describe("history comment / location split", () => {
  it("maps Source to location; event text to description", () => {
    const rest =
      "Title / Registration 12 km Source: Ontario Ministry of Transportation Clear title issued";
    expect(extractHistoryLocation(rest)).toMatch(/Ontario Ministry/i);
    const { titleStatus, description } = splitEventComment(rest);
    // Non-service events live in description
    expect(`${titleStatus} ${description}`.toLowerCase()).toMatch(/title|registration|clear/i);
    expect(description.toLowerCase()).not.toMatch(/ontario ministry/i);
    expect(description.toLowerCase()).not.toMatch(/^source/);
  });

  it("keeps dealer card junk out of title/description; Source → location", () => {
    const rest =
      "11 mi Doral Volkswagen 305-477-6666 doralvw.com/ 4.5 / 5.0 230 Customer Favorites Vehicle serviced";
    expect(extractHistoryLocation(rest)).toMatch(/Doral Volkswagen/i);
    expect(extractHistoryLocation(rest)).not.toMatch(/305|doralvw|4\.5|Favorites/i);
    const { titleStatus, description } = splitEventComment(rest);
    expect(titleStatus).toMatch(/Vehicle serviced/i);
    expect(titleStatus).not.toMatch(/Doral|305|doralvw/i);
    expect(description).not.toMatch(/doralvw|fbclid|Customer Favorites|305/i);
  });

  it("does not merge ministry + next dealer into location", () => {
    const rest =
      "163,420 mi Ontario Ministry of Transportation Odometer reading reported";
    expect(extractHistoryLocation(rest)).toBe("Ontario Ministry of Transportation");
    expect(extractHistoryLocation(rest)).not.toMatch(/Gc Tire|905|reported/i);
    const bleed =
      "Ontario Ministry of Transportation reported Gc Tire And Auto 905-456-2610";
    expect(cleanHistoryLocation(bleed)).toBe("Ontario Ministry of Transportation");
  });

  it("strips provider brand from customer-facing phrases", () => {
    expect(sanitizeCustomerFacingText("No total loss reported to CARFAX.")).toBe(
      "No total loss reported.",
    );
    expect(sanitizeCustomerFacingText("No accidents or damage reported to CARFAX")).toBe(
      "No accidents or damage reported",
    );
    expect(sanitizeCustomerFacingText("Vehicle serviced at dealer")).not.toMatch(/carfax/i);
  });

  it("strips tirecraft url junk from Gc Tire service row", () => {
    const rest =
      "164,714 mi Gc Tire And Auto Brampton, ON 905-456-2610 tirecraft.com/tirecraft- brampton/? fbclid=iwar2vzrsznpmisjfx j4yteh8aub9t8fgbypq_xzv 0gi7tisfxd6osa92tng4 Vehicle serviced";
    expect(extractHistoryLocation(rest)).toBe("Gc Tire And Auto Brampton, ON");
    expect(extractHistoryLocation(rest)).not.toMatch(/tirecraft|fbclid|905|j4yte|brampton \?/i);
    const { titleStatus, description } = splitEventComment(rest);
    expect(titleStatus).toMatch(/Vehicle serviced/i);
    expect(description).not.toMatch(/tirecraft|fbclid|456/i);
  });

  it("keeps Registration issued or renewed intact", () => {
    const rest = "not reported Ontario Ministry of Transportation Registration issued or renewed";
    const { titleStatus, description } = splitEventComment(rest);
    expect(titleStatus).toBe("");
    expect(description).toBe("Registration issued or renewed");
    expect(extractHistoryLocation(rest)).toBe("Ontario Ministry of Transportation");
  });

  it("puts Passed Ontario safety inspection entirely in description", () => {
    const rest =
      "3,572 mi Ontario Ministry of Transportation Passed Ontario safety standards inspection";
    const { titleStatus, description } = splitEventComment(rest);
    expect(titleStatus).toBe("");
    expect(description).toBe("Passed Ontario safety standards inspection");
    expect(description).not.toMatch(/^Passed Ontario$/i);
  });

  it("does not mix registration with ignition/spark shop work", () => {
    const rest =
      "not reported Ontario Ministry of Transportation Registration issued or renewed Ignition coil(s) replaced - Spark plug(s) replaced - Four tires mounted";
    const { titleStatus, description, orphanWork } = splitEventComment(rest);
    expect(titleStatus).toBe("");
    expect(description).toBe("Registration issued or renewed");
    expect(description).not.toMatch(/ignition|spark|tire/i);
    expect(orphanWork.some((w) => /ignition|spark/i.test(w))).toBe(true);
  });

  it("does not use table header Comments as location", () => {
    expect(cleanHistoryLocation("Comments")).toBe("");
    expect(extractHistoryLocation("Source Comments 3,572 mi Ontario Ministry of Transportation Odometer reading reported")).toBe(
      "Ontario Ministry of Transportation",
    );
  });

  it("Vehicle serviced keeps work in description, not import/title noise", () => {
    const svc = splitEventComment("11 mi Doral Volkswagen Vehicle serviced");
    expect(svc.titleStatus).toBe("Vehicle serviced");

    const importRow = splitEventComment(
      "not reported Vehicle Importer Vehicle exported from Michigan and imported to Ontario",
    );
    expect(importRow.titleStatus).toBe("");
    expect(importRow.description).toMatch(/Vehicle exported/i);
    expect(importRow.description).not.toMatch(/Vehicle serviced/i);
  });

  it("strips mileage bleed from model names", () => {
    expect(cleanModelName("Tiguan S 164", "Volkswagen")).toBe("Tiguan S");
    expect(cleanModelName("Volkswagen Tiguan S 164", "Volkswagen")).toBe("Tiguan S");
  });

  it("strips fuel words from engine", () => {
    const eng = parseEngine("Engine: 2.0L I4 F DOHC 16V Gasoline");
    expect(eng).toMatch(/2\.0L/i);
    expect(eng).toMatch(/I4/i);
    expect(eng).not.toMatch(/gasoline/i);
    expect(eng).not.toMatch(/\bF\b/);
  });

  it("selects Canada when Ontario appears", () => {
    expect(parseVehicleCountry(CANADA_TIGUAN_FIXTURE)).toBe("ca");
  });
});

describe("provider-pdf-parse", () => {
  it("detects Carfax and AutoCheck", () => {
    expect(detectProviderPdfKind(CARFAX_FIXTURE)).toBe("carfax");
    expect(detectProviderPdfKind(AUTOCHECK_FIXTURE)).toBe("autocheck");
  });

  it("extracts VINs", () => {
    expect(extractVinsFromText(CARFAX_FIXTURE)).toContain(SAMPLE_VIN);
  });

  it("fails on empty / tiny text", () => {
    expect(parseProviderPdfText("hi", SAMPLE_VIN).ok).toBe(false);
  });

  it("fails when PDF VIN mismatches pending VIN", () => {
    const r = parseProviderPdfText(CARFAX_FIXTURE, OTHER_VIN);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/does not match/i);
  });

  it("parses Carfax specs without color or provider_pdf source", () => {
    const r = parseProviderPdfText(CARFAX_FIXTURE, SAMPLE_VIN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.form.year).toBe("2019");
    expect(r.form.make).toBe("Honda");
    expect(r.form.model).toMatch(/Civic/i);
    expect(r.form.engine).toMatch(/2\.0L/i);
    expect(r.form.fuelType).toBe("gasoline");
    expect(r.form.transmission).toBe("automatic");
    expect(r.form.bodyType).toBe("sedan");
    expect(r.form.color).toBe("");
    expect(r.form.odometer).toBe(String(milesToKm(45230)));
    expect(r.form.mileageHistory.every((m) => m.source === "")).toBe(true);
    // Highest mileage first
    const odos = r.form.mileageHistory.map((m) => Number(m.odometer));
    expect(odos).toEqual([...odos].sort((a, b) => b - a));
    // Service rows
    expect(r.form.serviceHistory.length).toBeGreaterThanOrEqual(1);
    expect(r.form.serviceHistory[0]!.description.toLowerCase()).not.toMatch(/miles/);
  });

  it("parses Canada Tiguan: model, engine, fuel, transmission, country, latest km, location", () => {
    const r = parseProviderPdfText(CANADA_TIGUAN_FIXTURE, TIGUAN_VIN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.form.make).toMatch(/Volkswagen/i);
    expect(r.form.model).toBe("Tiguan S");
    expect(r.form.model).not.toMatch(/164/);
    expect(r.form.engine).not.toMatch(/gasoline/i);
    expect(r.form.fuelType).toBe("gasoline");
    expect(r.form.transmission).toBe("automatic");
    expect(r.form.country).toBe("ca");
    expect(r.form.odometer).toBe("164532");
    expect(r.form.mileageHistory.some((m) => m.location.toLowerCase().includes("ontario"))).toBe(true);
    expect(
      r.form.mileageHistory.every((m) => !/ontario/i.test(m.description)),
    ).toBe(true);
    expect(
      r.form.mileageHistory.some(
        (m) => m.titleStatus.length > 0 || m.description.length > 0,
      ),
    ).toBe(true);
  });

  it("uses labeled model year; keeps 2012/2025 history dates with real miles (not year-as-odo)", () => {
    const r = parseProviderPdfText(AUDI_FIXTURE, AUDI_VIN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Model year from header — not confused with history dates
    expect(r.form.year).toBe("2013");
    expect(r.form.make).toBe("Audi");
    expect(r.form.model).toMatch(/A6 Prestige/i);
    expect(r.form.engine).toMatch(/3\.0L/i);
    expect(r.form.engine).toMatch(/V6/i);
    expect(r.form.color).toBe("");

    // History years stay — mileage uses real readings, never 2012/2025 as odometer
    const odoValues = r.form.mileageHistory.map((m) => Number(m.odometer));
    expect(odoValues).not.toContain(2012);
    expect(odoValues).not.toContain(2025);
    expect(odoValues).not.toContain(milesToKm(2012));
    expect(odoValues).not.toContain(milesToKm(2025));

    const dates = [
      ...r.form.mileageHistory.map((m) => m.date),
      ...r.form.serviceHistory.map((s) => s.date),
      ...r.form.ownerHistory.map((o) => o.date),
    ];
    expect(dates.some((d) => d.startsWith("2012"))).toBe(true);
    expect(dates.some((d) => d.startsWith("2025"))).toBe(true);
    expect(odoValues).toContain(milesToKm(10));
    expect(odoValues).toContain(milesToKm(90000));
  });

  it("does not treat calendar years as mileage readings", () => {
    expect(extractHistoryOdometerKm("Title issued Houston, TX", "2012-01-05")).toBe("");
    expect(extractHistoryOdometerKm("2012 Title issued", "2012-01-05")).toBe("");
    expect(extractHistoryOdometerKm("10 miles Title issued", "2012-01-05")).toBe(
      String(milesToKm(10)),
    );
    expect(extractHistoryOdometerKm("90,000 miles Service oil change", "2025-06-15")).toBe(
      String(milesToKm(90000)),
    );
  });

  it("ignores not reported and Odometer reported as comment bleed", () => {
    expect(
      extractHistoryOdometerKm(
        "not reported Ontario Ministry of Transportation Registration issued or renewed Odometer reported as 174,068 kilometers",
        "2021-07-29",
      ),
    ).toBe("");
    expect(
      extractHistoryOdometerKm(
        "not reported Ontario Ministry of Transportation Passed Ontario safety standards inspection Odometer reported as 262,999 kilometers",
        "2026-07-29",
      ),
    ).toBe("");
    expect(
      extractHistoryOdometerKm(
        "123,859 mi Ontario Ministry of Transportation Odometer reading reported",
        "2021-07-08",
      ),
    ).toBe(String(milesToKm(123859)));
  });

  it("parses engine richly", () => {
    expect(parseEngine("Engine: 3.0L V6 TFSI Supercharged\nFuel: Gasoline")).toMatch(/3\.0L.*V6/i);
  });

  it("parses AutoCheck salvage", () => {
    const r = parseProviderPdfText(AUTOCHECK_FIXTURE, SAMPLE_VIN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.form.make).toMatch(/Toyota/i);
    expect(r.form.isSalvage).toBe(true);
    expect(r.form.color).toBe("");
    expect(r.form.transmission).toBe("automatic");
  });
});

describe("provider-pdf-apply", () => {
  it("replaces draft but keeps photos", () => {
    const current = {
      ...EMPTY_VIN_CATALOG_FORM,
      make: "Old",
      photos: ["https://cdn.example.com/a.jpg"],
    };
    const parsed = parseProviderPdfText(CARFAX_FIXTURE, SAMPLE_VIN);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const next = applyProviderPdfToForm(current, parsed.form);
    expect(next.make).toBe("Honda");
    expect(next.photos).toEqual(["https://cdn.example.com/a.jpg"]);
    expect(next.color).toBe("");
  });
});
