import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { parseProviderPdfText } from "./provider-pdf-parse";

describe("real Carfax Tiguan PDF extract", () => {
  const text = readFileSync(new URL("./fixtures-tiguan-carfax.txt", import.meta.url), "utf8");
  const r = parseProviderPdfText(text, "WVGAV7AX1CW554218");

  it("parses ok with 4 owners and clean mileage fields", () => {
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.form.ownerCount).toBe("4");
    expect(r.form.ownerHistory.every((o) => !/-01-01$/.test(o.date))).toBe(true);
    // No invented Jan-1 purchase-year owner rows
    expect(r.form.ownerHistory.some((o) => o.date === "2012-01-01" || o.date === "2026-01-01")).toBe(false);
    expect(r.form.model).toMatch(/Tiguan/i);
    expect(r.form.model).not.toMatch(/164/);
    expect(r.form.odometer).toBe(String(Math.round(164714 * 1.609344)));

    const junkRe =
      /tirecraft|fbclid|customer favorites|doralvw|westherr|schmitts\.com|\d\.\d\s*\/\s*\d/i;

    for (const m of r.form.mileageHistory) {
      expect(junkRe.test(m.titleStatus), `title junk: ${m.titleStatus}`).toBe(false);
      expect(junkRe.test(m.description), `desc junk: ${m.description}`).toBe(false);
      expect(junkRe.test(m.location), `loc junk: ${m.location}`).toBe(false);
      expect(m.titleStatus).not.toMatch(/Doral Volkswagen\s*305/i);
      expect(m.location).not.toMatch(/reported.*Gc Tire|Gc Tire.*905/i);
      expect(`${m.titleStatus} ${m.description} ${m.location}`).not.toMatch(/carfax/i);
    }

    for (const s of r.form.serviceHistory) {
      expect(junkRe.test(`${s.title} ${s.description} ${s.location}`), `svc junk: ${s.title}|${s.description}|${s.location}`).toBe(false);
      expect(`${s.title} ${s.description} ${s.location}`).not.toMatch(/carfax/i);
    }

    const doral = r.form.mileageHistory.find((m) => m.date.startsWith("2012-01-28"));
    expect(doral?.location).toMatch(/Doral Volkswagen/i);
    expect(doral?.titleStatus).toMatch(/Vehicle serviced/i);

    const tire = r.form.mileageHistory.find((m) => m.date.startsWith("2026-04-20"));
    expect(tire?.location).toBe("Gc Tire And Auto Brampton, ON");
    expect(tire?.location).not.toMatch(/j4yte|fbclid|tirecraft|0gi7/i);
    expect(tire?.titleStatus).toMatch(/Vehicle serviced/i);
    expect(tire?.description).toMatch(/Brake pads replaced/i);
    expect(tire?.description).toMatch(/Tire\(s\) changed|Brakes checked/i);
    expect(tire?.description).not.toMatch(/tirecraft|fbclid|Comments/i);
    expect(tire?.odometer).toBe(String(Math.round(164714 * 1.609344)));

    // Mileage column said "not reported" — do not invent km from "Odometer reported as …"
    expect(r.form.mileageHistory.find((m) => m.date.startsWith("2026-07-29"))).toBeUndefined();
    expect(r.form.mileageHistory.find((m) => m.date.startsWith("2021-07-29"))).toBeUndefined();
    expect(r.form.mileageHistory.find((m) => m.date.startsWith("2013-07-29"))).toBeUndefined();
    // Dec 2025 Georgetown was "not reported" (205,375 km note is bleed from 127,614 mi)
    expect(r.form.mileageHistory.find((m) => m.date.startsWith("2025-12-01"))).toBeUndefined();

    // Legitimate column readings still convert (163,420 mi → ~262,999 km)
    expect(
      r.form.mileageHistory.some(
        (m) => m.date.startsWith("2026-03-20") && m.odometer === String(Math.round(163420 * 1.609344)),
      ),
    ).toBe(true);

    // Chronological readings must not invent rollbacks from comment bleed
    const byDate = [...r.form.mileageHistory]
      .filter((m) => m.date && m.odometer)
      .sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < byDate.length; i++) {
      const prev = Number(byDate[i - 1]!.odometer);
      const cur = Number(byDate[i]!.odometer);
      expect(
        cur + 500 >= prev,
        `rollback ${byDate[i - 1]!.date} ${prev} → ${byDate[i]!.date} ${cur}`,
      ).toBe(true);
    }

    // Registration rows with no mileage column stay out of mileage history
    expect(
      r.form.mileageHistory.every(
        (m) => !/^registration issued or renewed$/i.test(m.description.trim()),
      ),
    ).toBe(true);

    // Shop work from PDF dumps should land on Vehicle serviced, not stay empty for the Gc Tire visit
    const tireSvc = r.form.serviceHistory.find((s) => s.date.startsWith("2026-04-20"));
    expect(tireSvc?.description ?? "").toMatch(/Brake|Tire/i);

    // Do not clone the same shop-work blob onto every Humberview visit
    const humberDescs = r.form.serviceHistory
      .filter((s) => /humberview/i.test(s.location) && s.description.trim())
      .map((s) => s.description);
    if (humberDescs.length >= 3) {
      const unique = new Set(humberDescs);
      expect(unique.size).toBeGreaterThan(1);
    }

    for (const s of r.form.serviceHistory) {
      expect(s.description).not.toMatch(/importer|michigan|first owner|title issued|pre-delivery|titled or registered/i);
      expect(s.location).not.toMatch(/importer|manufacturer/i);
      expect(s.title).not.toMatch(/importer|michigan|title issued/i);
      expect(s.description).not.toMatch(/odometer reported as/i);
    }
  });
});
