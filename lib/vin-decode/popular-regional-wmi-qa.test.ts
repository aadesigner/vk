/**
 * Regional WMI make+country QA for popular brands beyond Toyota-only gaps.
 *
 * Sources: NHTSA DecodeWMI + GetWMIsForManufacturer (Honda/Nissan/Audi/VW/Kia/Ford/MB).
 * Contract: make must resolve; models only when separately verified.
 * Country overrides: U5Y→Slovakia, XP7→Germany, 7FA/7PD/…→United States (not NZ).
 */
import { describe, expect, it } from "vitest";
import { decodeVin, decodeVinLocalFree } from "./index";

type Case = {
  vin: string;
  label: string;
  make: string;
  country: string;
  /** When set, model must stay null (make-only WMI). */
  modelNull?: boolean;
};

function assertCase(c: Case) {
  expect(c.vin).toHaveLength(17);
  const r = decodeVin(c.vin);
  expect(r.make, c.label).toBe(c.make);
  expect(r.country, c.label).toBe(c.country);
  if (c.modelNull) expect(r.model, c.label).toBeNull();

  // Local-free peek exposes country as countryOfOrigin.
  const free = decodeVinLocalFree(c.vin);
  expect(free?.make, `${c.label} free`).toBe(c.make);
  expect(free?.countryOfOrigin, `${c.label} free country`).toBe(c.country);
}

describe("popular regional WMI — Kia / Audi / VW / Nissan / Infiniti", () => {
  const cases: Case[] = [
    {
      vin: "U5YHM51BAGL253105",
      label: "Kia Slovakia U5Y (Žilina)",
      make: "Kia",
      country: "Slovakia",
      modelNull: true,
    },
    {
      vin: "WU1ZZZ4G0LL012345",
      label: "Audi Sport WU1 MPV",
      make: "Audi",
      country: "Germany",
    },
    {
      vin: "1V1BC6B97G6123456",
      label: "Volkswagen USA 1V1 truck WMI",
      make: "Volkswagen",
      country: "United States",
    },
    {
      vin: "3N8CM0AP0JL012345",
      label: "Nissan Mexico 3N8 MPV",
      make: "Nissan",
      country: "Mexico",
      modelNull: true,
    },
    {
      vin: "3PCALADN0NF012345",
      label: "Nissan Mexico 3PC (shared Infiniti → Nissan default)",
      make: "Nissan",
      country: "Mexico",
      modelNull: true,
    },
    {
      vin: "SJKBDAM15U0123456",
      label: "Nissan UK SJK",
      make: "Nissan",
      country: "United Kingdom",
      modelNull: true,
    },
    {
      vin: "5N3AA08C08N012345",
      label: "Infiniti USA 5N3",
      make: "Infiniti",
      country: "United States",
    },
    {
      vin: "JNRAS08U0XW012345",
      label: "Infiniti Japan JNR",
      make: "Infiniti",
      country: "Japan",
    },
  ];
  for (const c of cases) it(c.label, () => assertCase(c));
});

describe("popular regional WMI — Honda / Acura / Ford / Lincoln / MB", () => {
  const cases: Case[] = [
    {
      vin: "7FAYG2H7XNE012345",
      label: "Honda USA 7FA (not New Zealand)",
      make: "Honda",
      country: "United States",
      modelNull: true,
    },
    {
      vin: "3DHAY2H7XRE012345",
      label: "Honda Mexico 3DH",
      make: "Honda",
      country: "Mexico",
      modelNull: true,
    },
    {
      vin: "3HDAY2H7XRE012345",
      label: "Honda Mexico 3HD (shared Acura → Honda default)",
      make: "Honda",
      country: "Mexico",
      modelNull: true,
    },
    {
      vin: "3HGCM563X3G012345",
      label: "Honda Mexico 3HG",
      make: "Honda",
      country: "Mexico",
    },
    {
      vin: "5KBPE36409H012345",
      label: "Honda USA 5KB",
      make: "Honda",
      country: "United States",
    },
    {
      vin: "5KCPE36409H012345",
      label: "Acura USA 5KC",
      make: "Acura",
      country: "United States",
    },
    {
      vin: "19VYA31558A012345",
      label: "Acura USA 19V",
      make: "Acura",
      country: "United States",
    },
    {
      vin: "2HNYD28257H012345",
      label: "Acura Canada 2HN",
      make: "Acura",
      country: "Canada",
    },
    {
      vin: "SHSRR2850CU012345",
      label: "Honda UK SHS",
      make: "Honda",
      country: "United Kingdom",
    },
    {
      vin: "JHLRE48507C012345",
      label: "Honda Japan JHL",
      make: "Honda",
      country: "Japan",
    },
    {
      vin: "NM0LS7E75H1123456",
      label: "Ford Turkey NM0 (Transit)",
      make: "Ford",
      country: "Turkey",
      modelNull: true,
    },
    {
      vin: "MAJ6S3GL5HC123456",
      label: "Ford India MAJ",
      make: "Ford",
      country: "India",
      modelNull: true,
    },
    {
      vin: "5LMCJ2C9XHU012345",
      label: "Lincoln USA 5LM",
      make: "Lincoln",
      country: "United States",
    },
    {
      vin: "3LN6L5SU5JR012345",
      label: "Lincoln Mexico 3LN",
      make: "Lincoln",
      country: "Mexico",
    },
    {
      vin: "2LMDJ8JK5EBL12345",
      label: "Lincoln Canada 2LM",
      make: "Lincoln",
      country: "Canada",
    },
    {
      vin: "WD4PE7CD5JP123456",
      label: "Mercedes-Benz WD4 MPV",
      make: "Mercedes-Benz",
      country: "Germany",
    },
    {
      vin: "WD8PE7CD5JP123456",
      label: "Mercedes-Benz USA WD8",
      make: "Mercedes-Benz",
      country: "United States",
    },
  ];
  for (const c of cases) it(c.label, () => assertCase(c));
});

describe("popular regional WMI — Tesla Berlin / premium already covered stay green", () => {
  it("XP7 Tesla Berlin is Germany not Russia", () => {
    const r = decodeVin("XP7YGCEE0NB123456");
    expect(r.make).toBe("Tesla");
    expect(r.country).toBe("Germany");
  });

  it("core premium WMIs still resolve", () => {
    expect(decodeVin("WBA8E9C50HK123456").make).toBe("BMW");
    expect(decodeVin("WAUZZZ8V0KA123456").make).toBe("Audi");
    expect(decodeVin("WVWZZZ3CZWE123456").make).toBe("Volkswagen");
    expect(decodeVin("WP0AA2A79KS123456").make).toBe("Porsche");
    expect(decodeVin("SALGS2SE0HA123456").make).toBe("Land Rover");
    expect(decodeVin("5YJ3E1EA0KF123456").make).toBe("Tesla");
    expect(decodeVin("LGXCE4CB0P0123456").make).toBe("BYD");
    expect(decodeVin("KMHD281BGBU123456").make).toBe("Hyundai");
  });
});
