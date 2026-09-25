import { describe, expect, it } from "vitest";
import {
  buildVinPageDescription,
  buildVinPageTitle,
  buildVinPageSeo,
  buildVinSsrBodyContent,
  isIndexableVinRest,
  normalizeVin,
  parseVinPagePath,
} from "@workspace/vin-page-seo";
import { injectVinPageSeoIntoHtml } from "./vinSeoHtmlInject.js";
import { catalogDataToVinSeoVehicle } from "./vinPageSeo.js";

const SAMPLE_HTML = `<!DOCTYPE html>
<html><head><title>verifykm.com</title></head><body>
<div id="root"><div class="app-boot-shell"></div></div>
<script type="module" src="/src/main.tsx"></script>
</body></html>`;

describe("vin-page-seo", () => {
  it("indexes catalog VIN paths but not processing", () => {
    expect(isIndexableVinRest("/vin/WBA3V7106FJ995387")).toBe(true);
    expect(isIndexableVinRest("/vin/processing")).toBe(false);
    expect(isIndexableVinRest("/vin/SHORT")).toBe(false);
  });

  it("builds rich title and description from public vehicle fields", () => {
    const vin = "WBA3V7106FJ995387";
    const title = buildVinPageTitle("en", {
      vin,
      year: 2015,
      make: "BMW",
      model: "3 Series",
      engine: "2.0L",
      country: "KR",
    });
    expect(title).toContain("2015 BMW 3 Series");
    expect(title).toBe(`2015 BMW 3 Series — ${vin}`);

    const desc = buildVinPageDescription("en", {
      vin,
      year: 2015,
      make: "BMW",
      model: "3 Series",
      engine: "2.0L",
    }, { locked: false });
    expect(desc).toContain(vin);
    expect(desc).toContain("mileage");
    expect(desc).toContain("accidents");
    expect(desc).toContain("ownership history");
    expect(desc).toContain("2.0L");
  });

  it("builds Chinese VIN page title and parses zh path", () => {
    const vin = "WBA3V7106FJ995387";
    expect(parseVinPagePath(`/zh/vin/${vin}`)).toEqual({
      lang: "zh",
      vin,
      rest: `/vin/${vin}`,
    });
    const title = buildVinPageTitle("zh", {
      vin,
      year: 2015,
      make: "BMW",
      model: "3 Series",
    });
    expect(title).toBe(`2015 BMW 3 Series — ${vin}`);
    expect(title).not.toContain("(");
  });

  it("builds Polish VIN page title and description", () => {
    const vin = "WBA3V7106FJ995387";
    const title = buildVinPageTitle("pl", {
      vin,
      year: 2015,
      make: "BMW",
      model: "3 Series",
    });
    expect(title).toBe(`2015 BMW 3 Series — ${vin}`);

    const desc = buildVinPageDescription("pl", { vin, year: 2015, make: "BMW", model: "3 Series" }, { locked: false });
    expect(desc).toContain(vin);
    expect(desc).toContain("przebieg");
    expect(desc).toContain("wypadki");
    expect(desc).toContain("verifykm.com");
  });

  it("builds Polish VIN-only fallback SEO strings", () => {
    const vin = "1HGBH41JXMN109186";
    const seo = buildVinPageSeo("pl", { vin }, "https://verifykm.com");
    expect(seo.title).toContain("raport historii pojazdu");
    expect(seo.title).toContain(vin);
    expect(seo.description).toContain("Podgląd VIN");
    expect(seo.canonicalPath).toBe("/pl/vin/1HGBH41JXMN109186");
  });

  it("builds Romanian VIN page title and description", () => {
    const vin = "WBA3V7106FJ995387";
    const title = buildVinPageTitle("ro", {
      vin,
      year: 2015,
      make: "BMW",
      model: "3 Series",
    });
    expect(title).toBe(`2015 BMW 3 Series — ${vin}`);

    const desc = buildVinPageDescription("ro", { vin, year: 2015, make: "BMW", model: "3 Series" }, { locked: false });
    expect(desc).toContain(vin);
    expect(desc).toContain("kilometraj");
    expect(desc).toContain("accidente");
    expect(desc).toContain("verifykm.com");
  });

  it("builds Romanian VIN-only fallback SEO strings", () => {
    const vin = "1HGBH41JXMN109186";
    const seo = buildVinPageSeo("ro", { vin }, "https://verifykm.com");
    expect(seo.title).toContain("raport istoric vehicul");
    expect(seo.title).toContain(vin);
    expect(seo.description).toContain("Previzualizare VIN");
    expect(seo.canonicalPath).toBe("/ro/vin/1HGBH41JXMN109186");
  });

  it("resolves absolute og image URLs", () => {
    const seo = buildVinPageSeo(
      "en",
      {
        vin: "1HGBH41JXMN109186",
        make: "Honda",
        model: "Accord",
        year: 1991,
        thumbnailUrl: "/api/vin/image?token=abc",
      },
      "https://verifykm.com",
    );
    expect(seo.ogImage).toBe("https://verifykm.com/api/vin/image?token=abc");
    expect(seo.ogImageAlt).toBe("1991 Honda Accord");
  });

  it("builds German VIN-only fallback SEO strings", () => {
    const vin = "1HGBH41JXMN109186";
    const seo = buildVinPageSeo("de", { vin }, "https://verifykm.com");
    expect(seo.title).toContain("Fahrzeughistorienbericht");
    expect(seo.description).toContain("Vorschau");
    expect(seo.canonicalPath).toBe("/de/vin/1HGBH41JXMN109186");
  });

  it("uses locked preview descriptions by default for catalog pages", () => {
    const vin = "WBA3V7106FJ995387";
    const locked = buildVinPageDescription("en", {
      vin,
      year: 2015,
      make: "BMW",
      model: "3 Series",
    });
    expect(locked).toContain("Preview");
    expect(locked).toContain("unlock");

    const unlocked = buildVinPageSeo(
      "en",
      { vin, year: 2015, make: "BMW", model: "3 Series" },
      "https://verifykm.com",
      { isUnlocked: true },
    );
    expect(unlocked.description).toContain("Check");
    expect(unlocked.description).toContain("mileage");
  });

  it("builds SSR body content from public catalog fields only", () => {
    const body = buildVinSsrBodyContent("en", {
      vin: "WBA3V7106FJ995387",
      year: 2015,
      make: "BMW",
      model: "3 Series",
      engine: "2.0L",
      transmission: "Automatic",
      color: "Black",
      country: "KR",
    });
    expect(body?.heading).toBe("2015 BMW 3 Series");
    expect(body?.vin).toBe("WBA3V7106FJ995387");
    expect(body?.specs.map((s) => s.label)).toEqual(
      expect.arrayContaining(["Make", "Model", "Year", "Engine"]),
    );
    expect(body?.intro).toContain("2015 BMW 3 Series");
    expect(body?.cta).toContain("verifykm.com");
  });

  it("injects SSR body and locked meta for catalog VIN HTML", () => {
    const vin = "WBA3V7106FJ995387";
    const vehicle = catalogDataToVinSeoVehicle(vin, {
      year: 2015,
      make: "BMW",
      model: "3 Series",
      engine: "2.0L",
      country: "KR",
    }, "/api/vin/image?token=abc");
    const seo = buildVinPageSeo("en", vehicle, "https://verifykm.com", { isUnlocked: false });
    const html = injectVinPageSeoIntoHtml(SAMPLE_HTML, seo, "en", "https://verifykm.com", vehicle);

    expect(html).toContain('id="verifykm-vin-ssr"');
    expect(html).toContain("<h1>2015 BMW 3 Series</h1>");
    expect(html).toContain("WBA3V7106FJ995387");
    expect(html).toContain('content="index, follow"');
    expect(html).toContain("Preview 2015 BMW 3 Series");
    expect(html).toContain('href="/en/pricing"');
    expect(html).toContain("app-boot-shell");
    expect(html.indexOf('id="verifykm-vin-ssr"')).toBeGreaterThan(html.indexOf("</div>"));
  });

  it("noindexes catalog pages without a preview image", () => {
    const seo = buildVinPageSeo(
      "en",
      { vin: "1HGBH41JXMN109186", make: "Honda", model: "Accord", year: 1991 },
      "https://verifykm.com",
    );
    expect(seo.noIndex).toBe(true);
    expect(seo.jsonLd).toHaveLength(0);
    expect(seo.ogImage).toBeUndefined();
  });

  it("emits WebPage + Vehicle JSON-LD when preview image exists", () => {
    const seo = buildVinPageSeo(
      "en",
      {
        vin: "1HGBH41JXMN109186",
        make: "Honda",
        model: "Accord",
        year: 1991,
        thumbnailUrl: "/api/vin/image?token=abc",
      },
      "https://verifykm.com",
    );
    expect(seo.noIndex).toBe(false);
    expect(seo.jsonLd).toHaveLength(2);
    expect(seo.canonicalPath).toBe("/en/vin/1HGBH41JXMN109186");
    expect(normalizeVin("1hgbh41jxmn109186")).toBe("1HGBH41JXMN109186");
  });
});
