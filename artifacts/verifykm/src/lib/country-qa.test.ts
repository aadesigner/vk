import { describe, expect, it } from "vitest";
import { decodeCountry } from "@workspace/vin-decode";
import { formatCountryName, countryLabelsFromT } from "./format-country-name";
import {
  ADMIN_COUNTRY_CODES,
  buildCountrySelectOptions,
  resolveCountrySelectValue,
} from "./vehicle-attr-options";

const UI_LANGS = ["en", "de", "es", "fr", "sq", "pl", "ro", "bg", "ka", "ar", "uk", "ru", "zh"] as const;

const t = (key: string) => {
  const map: Record<string, string> = {
    country_usa_name: "USA",
    country_korea_name: "South Korea",
    country_canada_name: "Canada",
  };
  return map[key] ?? key;
};

describe("country QA — admin catalog select", () => {
  it("lists France and Spain as separate options", () => {
    const options = buildCountrySelectOptions(
      (code) => formatCountryName(code, "en", countryLabelsFromT(t)),
      "",
    );
    const values = options.map((o) => o.value);
    expect(values).toContain("fr");
    expect(values).toContain("es");
    const fr = options.find((o) => o.value === "fr");
    const es = options.find((o) => o.value === "es");
    expect(fr?.label).toBe("France");
    expect(es?.label).toBe("Spain");
    expect(fr?.label).not.toBe(es?.label);
  });

  it("preserves legacy combined country values without wiping", () => {
    expect(resolveCountrySelectValue("France/Spain")).toBe("France/Spain");
    expect(resolveCountrySelectValue("fr")).toBe("fr");
    expect(resolveCountrySelectValue("es")).toBe("es");

    const options = buildCountrySelectOptions(
      (code) => formatCountryName(code, "en", countryLabelsFromT(t)),
      "France/Spain",
    );
    const legacy = options.find((o) => o.value === "France/Spain");
    expect(legacy).toBeDefined();
    expect(legacy?.label).toContain("(current)");
    expect(legacy?.label).toMatch(/France/);
    expect(legacy?.label).toMatch(/Spain/);
  });

  it("localizes every admin country code in all UI languages", () => {
    for (const lang of UI_LANGS) {
      for (const code of ADMIN_COUNTRY_CODES) {
        const label = formatCountryName(code, lang, countryLabelsFromT(t));
        expect(label, `${code} @ ${lang}`).toBeTruthy();
        expect(label.toLowerCase(), `${code} @ ${lang}`).not.toBe(code);
      }
    }
  });

  it("keeps market overrides for us/kr/ca", () => {
    const labels = countryLabelsFromT(t);
    expect(formatCountryName("us", "en", labels)).toBe("USA");
    expect(formatCountryName("kr", "en", labels)).toBe("South Korea");
    expect(formatCountryName("ca", "en", labels)).toBe("Canada");
  });
});

describe("country QA — VIN origin decode", () => {
  it("splits France vs Spain when WMI is known", () => {
    expect(decodeCountry("VF1RZ00000A123456")).toBe("France");
    expect(decodeCountry("VS6ZZZ5FZMR123456")).toBe("Spain");
  });

  it("falls back to combined label for ambiguous V-prefix (legacy-safe)", () => {
    expect(decodeCountry("VXX0000000A123456")).toBe("France/Spain");
  });

  it("translates stored combined labels for display", () => {
    expect(formatCountryName("France/Spain", "de")).toBe("Frankreich / Spanien");
    expect(formatCountryName("france/spain", "fr")).toBe("France / Espagne");
  });
});
