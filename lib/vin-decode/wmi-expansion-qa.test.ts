/**
 * NHTSA GetWMIsForManufacturer additions.
 * Make only. Model stays null. Year is null when the year position is unverified
 * (a digit must not become 2001; a letter must not become 1980/1981).
 */
import { describe, expect, it } from "vitest";
import { decodeVin, decodeVinLocalFree } from "./index";

type Row = { wmi: string; make: string; country: string; yearNull: boolean };

const ROWS: Row[] = [
  { wmi: "1F1", make: "Ford", country: "United States", yearNull: false },
  { wmi: "1F7", make: "Ford", country: "United States", yearNull: false },
  { wmi: "1FL", make: "Ford", country: "United States", yearNull: false },
  { wmi: "1MR", make: "Ford", country: "United States", yearNull: false },
  { wmi: "2ME", make: "Ford", country: "Canada", yearNull: false },
  { wmi: "2MR", make: "Ford", country: "Canada", yearNull: false },
  { wmi: "3MA", make: "Ford", country: "Mexico", yearNull: false },
  { wmi: "3ME", make: "Ford", country: "Mexico", yearNull: false },
  { wmi: "4F3", make: "Ford", country: "United States", yearNull: false },
  { wmi: "4M2", make: "Ford", country: "United States", yearNull: false },
  { wmi: "4M4", make: "Ford", country: "United States", yearNull: false },
  { wmi: "4N2", make: "Ford", country: "United States", yearNull: false },
  { wmi: "4N4", make: "Ford", country: "United States", yearNull: false },
  { wmi: "5LT", make: "Ford", country: "United States", yearNull: false },
  { wmi: "6MP", make: "Ford", country: "Australia", yearNull: false },
  { wmi: "5TB", make: "Toyota", country: "United States", yearNull: false },
  { wmi: "7SV", make: "Toyota", country: "United States", yearNull: false },
  { wmi: "2HJ", make: "Honda", country: "Canada", yearNull: false },
  { wmi: "2HU", make: "Honda", country: "Canada", yearNull: false },
  { wmi: "JH1", make: "Honda", country: "Japan", yearNull: false },
  { wmi: "JR2", make: "Honda", country: "Japan", yearNull: false },
  { wmi: "KME", make: "Hyundai", country: "South Korea", yearNull: false },
  { wmi: "KPH", make: "Hyundai", country: "South Korea", yearNull: false },
  { wmi: "JC1", make: "Mazda", country: "Japan", yearNull: false },
  { wmi: "JC2", make: "Mazda", country: "Japan", yearNull: false },
  { wmi: "JM2", make: "Mazda", country: "Japan", yearNull: false },
  { wmi: "JF3", make: "Subaru", country: "Japan", yearNull: false },
  { wmi: "JF4", make: "Subaru", country: "Japan", yearNull: false },
  { wmi: "4A3", make: "Mitsubishi", country: "United States", yearNull: false },
  { wmi: "4A4", make: "Mitsubishi", country: "United States", yearNull: false },
  { wmi: "4P3", make: "Mitsubishi", country: "United States", yearNull: false },
  { wmi: "JA7", make: "Mitsubishi", country: "Japan", yearNull: false },
  { wmi: "JB4", make: "Mitsubishi", country: "Japan", yearNull: false },
  { wmi: "JB7", make: "Mitsubishi", country: "Japan", yearNull: false },
  { wmi: "JE4", make: "Mitsubishi", country: "Japan", yearNull: false },
  { wmi: "JJ3", make: "Mitsubishi", country: "Japan", yearNull: false },
  { wmi: "JP3", make: "Mitsubishi", country: "Japan", yearNull: false },
  { wmi: "JP4", make: "Mitsubishi", country: "Japan", yearNull: false },
  { wmi: "JP7", make: "Mitsubishi", country: "Japan", yearNull: false },
  { wmi: "JW7", make: "Mitsubishi", country: "Japan", yearNull: false },
  { wmi: "ML3", make: "Mitsubishi", country: "Thailand", yearNull: false },
  { wmi: "MP3", make: "Mitsubishi", country: "Thailand", yearNull: false },
  { wmi: "JNT", make: "Nissan", country: "Japan", yearNull: false },
  { wmi: "JG7", make: "Suzuki", country: "Japan", yearNull: false },
  { wmi: "5Z6", make: "Suzuki", country: "United States", yearNull: false },
  { wmi: "KL5", make: "Suzuki", country: "South Korea", yearNull: true },
  { wmi: "J81", make: "Isuzu", country: "Japan", yearNull: false },
  { wmi: "J8Z", make: "Isuzu", country: "Japan", yearNull: false },
  { wmi: "JAE", make: "Isuzu", country: "Japan", yearNull: false },
  { wmi: "KPS", make: "SsangYong", country: "South Korea", yearNull: false },
  { wmi: "JD1", make: "Daihatsu", country: "Japan", yearNull: false },
  { wmi: "JD2", make: "Daihatsu", country: "Japan", yearNull: false },
  { wmi: "1MB", make: "Mercedes-Benz", country: "United States", yearNull: true },
  { wmi: "8BT", make: "Mercedes-Benz", country: "Argentina", yearNull: true },
  { wmi: "8BU", make: "Mercedes-Benz", country: "Argentina", yearNull: true },
  { wmi: "9DB", make: "Mercedes-Benz", country: "Brazil", yearNull: true },
  { wmi: "W1H", make: "Mercedes-Benz", country: "Germany", yearNull: true },
  { wmi: "W1Y", make: "Mercedes-Benz", country: "Germany", yearNull: true },
  { wmi: "W2W", make: "Mercedes-Benz", country: "Germany", yearNull: true },
  { wmi: "W2Y", make: "Mercedes-Benz", country: "Germany", yearNull: true },
  { wmi: "WD0", make: "Mercedes-Benz", country: "Germany", yearNull: true },
  { wmi: "WD3", make: "Mercedes-Benz", country: "Germany", yearNull: true },
  { wmi: "WYB", make: "Mercedes-Benz", country: "Germany", yearNull: true },
  { wmi: "1WA", make: "Volvo", country: "United States", yearNull: true },
  { wmi: "1WU", make: "Volvo", country: "United States", yearNull: true },
  { wmi: "3V4", make: "Volvo", country: "Mexico", yearNull: true },
  { wmi: "3X1", make: "Volvo", country: "Mexico", yearNull: true },
  { wmi: "4V1", make: "Volvo", country: "United States", yearNull: true },
  { wmi: "4V3", make: "Volvo", country: "United States", yearNull: true },
  { wmi: "4V4", make: "Volvo", country: "United States", yearNull: true },
  { wmi: "4V6", make: "Volvo", country: "United States", yearNull: true },
  { wmi: "4VA", make: "Volvo", country: "United States", yearNull: true },
  { wmi: "4VD", make: "Volvo", country: "United States", yearNull: true },
  { wmi: "4VG", make: "Volvo", country: "United States", yearNull: true },
  { wmi: "4VJ", make: "Volvo", country: "United States", yearNull: true },
  { wmi: "9BV", make: "Volvo", country: "Brazil", yearNull: true },
  { wmi: "W04", make: "Opel", country: "Germany", yearNull: true },
  { wmi: "W06", make: "Opel", country: "Germany", yearNull: true },
  { wmi: "W08", make: "Opel", country: "Germany", yearNull: true },
  { wmi: "ZAS", make: "Alfa Romeo", country: "Italy", yearNull: true },
  { wmi: "ZFD", make: "Ferrari", country: "Italy", yearNull: true },
  { wmi: "ZSG", make: "Ferrari", country: "Italy", yearNull: true },
  { wmi: "ZPB", make: "Lamborghini", country: "Italy", yearNull: true },
  { wmi: "ZC2", make: "Maserati", country: "Italy", yearNull: true },
  { wmi: "ZN6", make: "Maserati", country: "Italy", yearNull: true },
  { wmi: "SJA", make: "Bentley", country: "United Kingdom", yearNull: true },
  { wmi: "SD7", make: "Aston Martin", country: "United Kingdom", yearNull: true },
  { wmi: "SD8", make: "Moke", country: "United Kingdom", yearNull: true },
  { wmi: "7GB", make: "Mahindra", country: "United States", yearNull: true },
  { wmi: "MCU", make: "Mahindra", country: "India", yearNull: true },
  { wmi: "MCV", make: "Mahindra", country: "India", yearNull: true },
  { wmi: "LJU", make: "Lotus", country: "China", yearNull: true },
  { wmi: "SC6", make: "INEOS", country: "United Kingdom", yearNull: true },
  { wmi: "SH7", make: "INEOS", country: "United Kingdom", yearNull: true },
  { wmi: "YK1", make: "Saab", country: "Finland", yearNull: true },
  { wmi: "514", make: "Fisker", country: "United States", yearNull: true },
  { wmi: "YH4", make: "Fisker", country: "Sweden/Finland", yearNull: true },
  { wmi: "1HP", make: "International", country: "United States", yearNull: true },
  { wmi: "1HS", make: "International", country: "United States", yearNull: true },
  { wmi: "3HR", make: "International", country: "Mexico", yearNull: true },
  { wmi: "3HS", make: "International", country: "Mexico", yearNull: true },
  { wmi: "93M", make: "International", country: "Brazil", yearNull: true },
  { wmi: "93S", make: "International", country: "Brazil", yearNull: true },
  { wmi: "1XK", make: "Kenworth", country: "United States", yearNull: true },
  { wmi: "2XK", make: "Kenworth", country: "Canada", yearNull: true },
  { wmi: "3NM", make: "Kenworth", country: "Mexico", yearNull: true },
  { wmi: "3WK", make: "Kenworth", country: "Mexico", yearNull: true },
  { wmi: "3WM", make: "Kenworth", country: "Mexico", yearNull: true },
  { wmi: "3XK", make: "Kenworth", country: "Mexico", yearNull: true },
  { wmi: "SFN", make: "Kenworth", country: "United Kingdom", yearNull: true },
  { wmi: "1XP", make: "Peterbilt", country: "United States", yearNull: true },
  { wmi: "2XP", make: "Peterbilt", country: "Canada", yearNull: true },
  { wmi: "3WP", make: "Peterbilt", country: "Mexico", yearNull: true },
  { wmi: "2FU", make: "Freightliner", country: "Canada", yearNull: true },
  { wmi: "AFV", make: "Freightliner", country: "South Africa", yearNull: true },
  { wmi: "KFB", make: "Freightliner", country: "Israel", yearNull: true },
  { wmi: "RSB", make: "Freightliner", country: "Saudi Arabia", yearNull: true },
  { wmi: "2AZ", make: "Hino", country: "Canada", yearNull: true },
  { wmi: "7H4", make: "Hino", country: "United States", yearNull: true },
  { wmi: "JH7", make: "Hino", country: "Japan", yearNull: true },
  { wmi: "JHA", make: "Hino", country: "Japan", yearNull: true },
];

function vin(wmi: string, yearCode: string): string {
  return `${wmi}9BCDEX${yearCode}A123456`;
}

describe("NHTSA WMI expansion — make only, no invented year", () => {
  it("covers every added WMI", () => {
    expect(ROWS).toHaveLength(121);
    expect(new Set(ROWS.map((r) => r.wmi)).size).toBe(ROWS.length);
  });

  it.each(ROWS)("$wmi is $make / $country, model null, letter year not 1980", (row) => {
    const full = vin(row.wmi, "A");
    expect(full).toHaveLength(17);
    const r = decodeVin(full);
    expect(r.make, row.wmi).toBe(row.make);
    expect(r.country, row.wmi).toBe(row.country);
    expect(r.model, row.wmi).toBeNull();
    expect(r.year, row.wmi).toBeNull();
    const free = decodeVinLocalFree(full);
    expect(free?.make, row.wmi).toBe(row.make);
    expect(free?.countryOfOrigin, row.wmi).toBe(row.country);
  });

  it("digit position 10 stays null when the year layout is unverified", () => {
    for (const row of ROWS.filter((r) => r.yearNull)) {
      const r = decodeVin(vin(row.wmi, "1"));
      expect(r.year, row.wmi).toBeNull();
      expect(r.make, row.wmi).toBe(row.make);
    }
  });

  it("Ford 1F1 keeps a unique ISO digit year and still refuses 1980", () => {
    expect(decodeVin(vin("1F1", "1")).year).toBe(2001);
    expect(decodeVin(vin("1F1", "A")).year).toBeNull();
  });
});
