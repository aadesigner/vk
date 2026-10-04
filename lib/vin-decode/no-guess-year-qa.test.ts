/**
 * HARD no-guess year audit — every popular brand / market sample.
 *
 * Contract (non-negotiable):
 * 1. Never invent an ISO 30-year cycle (no prefer-old, no prefer-recent).
 * 2. If pos.10 is a letter and BOTH cycles are still calendar-plausible,
 *    decodeVin.year must NOT be the older twin.
 * 3. The Typ 16 / 1981 class of bug must never recur.
 *
 * Prefer null year over a wrong decade.
 */
import { describe, expect, it } from "vitest";
import {
  decodeVin,
  isoModelYearCandidates,
  maxPlausibleModelYear,
  resolveIsoModelYear,
} from "./index";

const LETTERS = "ABCDEFGHJKLMNPRSTVWXY";

function assertNoPreferOldYear(vin: string, label: string): void {
  expect(vin, label).toHaveLength(17);
  const r = decodeVin(vin);
  const code = vin[9] ?? "";
  const maxY = maxPlausibleModelYear();
  const plausible = isoModelYearCandidates(code).filter((y) => y >= 1980 && y <= maxY);
  if (r.year == null) return;
  if (plausible.length < 2) return;
  const older = Math.min(...plausible);
  const newer = Math.max(...plausible);
  expect(
    r.year,
    `${label}: invented older ISO cycle ${older} while ${newer} is still plausible (VIN ${vin})`,
  ).not.toBe(older);
  // If a year is emitted under ambiguity, it must be the newer twin (floor window).
  expect(r.year, `${label}: year must be a plausible ISO candidate`).toBe(newer);
}

function zzz(wmi: string, type78: string, year: string, serial = "M133566"): string {
  return `${wmi}ZZZ${type78}Z${year}${serial}`.slice(0, 17);
}

function pad(prefix: string, yearChar: string): string {
  const base = (prefix.toUpperCase() + "00000000000000000").slice(0, 17).split("");
  base[9] = yearChar;
  return base.join("");
}

describe("no-guess year — ISO core never prefer-old", () => {
  it("old ceiling windows never invent 1980s/1990s from letters while +30 is live", () => {
    for (const ch of LETTERS) {
      expect(resolveIsoModelYear(ch, { from: 1979, to: 1992 }), ch).toBeNull();
      expect(resolveIsoModelYear(ch, { from: 1980, to: 2000 }), ch).toBeNull();
      expect(resolveIsoModelYear(ch, { from: 1983, to: 2009 }), ch).toBeNull();
    }
  });

  it("modern floor windows may confirm the newer twin only", () => {
    expect(resolveIsoModelYear("A", { from: 2010, to: 2099 })).toBe(2010);
    expect(resolveIsoModelYear("B", { from: 2010, to: 2099 })).toBe(2011);
    expect(resolveIsoModelYear("N", { from: 2018, to: 2099 })).toBe(2022);
    expect(resolveIsoModelYear("P", { from: 2018, to: 2099 })).toBe(2023);
  });
});

describe("no-guess year — Typ 16 regression (the 1981 bug)", () => {
  const years = [...LETTERS, "1", "5", "9"];
  for (const y of years) {
    it(`WVWZZZ16 + year ${y} never invents old-cycle year`, () => {
      const vin = zzz("WVW", "16", y);
      assertNoPreferOldYear(vin, `Typ16/${y}`);
      const r = decodeVin(vin);
      expect(r.make).toBe("Volkswagen");
      // Letter B was the production incident.
      if (y === "B") {
        expect(r.year).toBeNull();
        expect(r.model).toBeNull();
      }
    });
  }

  it("exact incident VIN WVWZZZ16ZBM133566 is not 1981", () => {
    const r = decodeVin("WVWZZZ16ZBM133566");
    expect(r.make).toBe("Volkswagen");
    expect(r.year).not.toBe(1981);
    expect(r.year).toBeNull();
    expect(r.model).toBeNull();
  });
});

describe("no-guess year — popular brands sweep (letter years)", () => {
  const samples: { label: string; vin: string }[] = [
    // Volkswagen / Audi / Škoda / SEAT / Porsche
    { label: "VW Golf AU", vin: zzz("WVW", "AU", "B") },
    { label: "VW Golf CD", vin: zzz("WVW", "CD", "B") },
    { label: "VW Passat 3C", vin: zzz("WVW", "3C", "B") },
    { label: "VW Tiguan 5N", vin: zzz("WVW", "5N", "B") },
    { label: "VW Polo 6R", vin: zzz("WVW", "6R", "A") },
    { label: "VW Golf 1K", vin: zzz("WVW", "1K", "A") },
    { label: "VW Golf 1J", vin: zzz("WVW", "1J", "A") },
    { label: "Audi A4 8K", vin: zzz("WAU", "8K", "B") },
    { label: "Audi A3 8V", vin: zzz("WAU", "8V", "A") },
    { label: "Škoda Octavia NX", vin: zzz("TMB", "NX", "B") },
    { label: "SEAT Leon 5F", vin: zzz("VSS", "5F", "A") },
    { label: "Porsche 911", vin: "WP0ZZZ99ZBS123456" },

    // BMW / Mercedes / MINI
    { label: "BMW 3 Series", vin: "WBA8E9G50BNU12345" },
    { label: "BMW X5", vin: "WBAKS610X0L123456" },
    { label: "MB C-Class", vin: "WDD205037BA123456" },
    { label: "MB E-Class letter", vin: "WDDHF5KB6BA123456" },
    { label: "MINI Cooper", vin: "WMWXP7C55B2123456" },

    // Toyota / Honda / Nissan / Hyundai / Kia
    { label: "Toyota Camry US", vin: pad("4T1B11", "B") },
    { label: "Toyota RAV4 JP", vin: pad("JTMB1R", "A") },
    { label: "Honda Civic US", vin: pad("1HGCM5", "B") },
    { label: "Nissan Altima", vin: pad("1N4BL4", "A") },
    { label: "Hyundai Elantra", vin: pad("KMHD64", "B") },
    { label: "Kia Sportage KR", vin: pad("KNDP3C", "A") },
    { label: "Kia Slovakia U5Y", vin: pad("U5YHM5", "B") },

    // Volvo / Tesla / BYD / Ford / Land Rover
    { label: "Volvo XC60 EU", vin: "YV4DA0AA0B1234567" },
    { label: "Volvo S60 EU", vin: "YV1FA0AA0A1234567" },
    { label: "Tesla Model 3", vin: pad("5YJ3E1EA", "B") },
    { label: "Tesla Berlin", vin: pad("XP7YGCEE", "A") },
    { label: "BYD Atto 3", vin: pad("LGXCE4CB", "B") },
    { label: "Ford Focus EU", vin: pad("WF0AXX", "A") },
    { label: "Land Rover SAL", vin: pad("SALGA2", "B") },
    { label: "Jaguar SAJ", vin: pad("SAJXA4", "A") },

    // US trucks / volume
    { label: "Ford F-150", vin: pad("1FTEW1", "B") },
    { label: "Chevy Silverado", vin: pad("1GCUYE", "A") },
    { label: "Ram 1500", vin: pad("1C6SRF", "B") },
  ];

  for (const s of samples) {
    it(`${s.label} (${s.vin.slice(0, 10)}…) never prefer-old`, () => {
      assertNoPreferOldYear(s.vin, s.label);
    });
  }
});

describe("no-guess year — letter A–Y matrix on high-volume WMIs", () => {
  const wmis = [
    "WVWZZZAUZ", // Golf Mk7
    "WVWZZZ3CZ", // Passat
    "WAUZZZ8KZ", // Audi A4
    "TMBZZZNXZ", // Škoda Octavia
    "YV4DA0AA0", // Volvo XC60
    "WDD205037", // MB C-Class
    "WBA8E9G50", // BMW
    "5YJ3E1EA0", // Tesla
    "KMHD641BG", // Hyundai Elantra
    "SALGA2BE0", // Land Rover
  ];

  for (const prefix of wmis) {
    it(`${prefix}* letter years never invent older ISO twin`, () => {
      for (const y of LETTERS) {
        const vin = pad(prefix, y);
        assertNoPreferOldYear(vin, `${prefix}/${y}`);
      }
    });
  }
});
