import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeCarstatVhrJsonPayloads } from "./carstatVhrNormalize.js";

const ROOT = resolve(import.meta.dirname, "../..");
const VIN = "7FARW2H56JE022576";
const SOURCE_IDS = [1, 2, 3] as const;

function load(id: number) {
  const path = resolve(ROOT, `tmp-full-${id}.json`);
  if (!existsSync(path)) throw new Error(`Missing ${path}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function brief(norm: ReturnType<typeof normalizeCarstatVhrJsonPayloads>) {
  return {
    make: norm.make,
    model: norm.model,
    year: norm.year,
    trim: norm.trim,
    country: norm.country,
    color: norm.color,
    fuelType: norm.fuelType,
    bodyType: norm.bodyType,
    engine: norm.engine,
    hp: norm.hp,
    odometer: norm.odometer,
    photos: (norm.photos || []).length,
    mileage: (norm.mileageHistory || []).map((m) => ({
      date: m.date,
      value: (m as { value?: number; mileage?: number }).value ?? (m as { mileage?: number }).mileage,
      unit: m.unit,
      source: m.source,
    })),
    auctions: (norm.auctionHistory || []).map((a) => ({
      date: a.date,
      source: a.source,
      lot: a.lotNumber,
      price: a.price,
      currency: a.currency,
      odo: a.odometer,
      damage: a.damage,
      place: (a as { location?: string; place?: string }).location ?? (a as { place?: string }).place,
      status: a.status,
    })),
    accidents: (norm.accidents || []).map((a) => ({
      date: a.date,
      type: a.type,
      description: a.description,
      cost: a.cost,
    })),
    claims: (norm.insuranceClaims || []).map((c) => ({
      date: c.date,
      amount: c.amount,
      currency: c.currency,
      description: c.description,
    })),
    extrasCount: (norm.vehicleExtras || []).length,
    extrasSample: (norm.vehicleExtras || []).slice(0, 12).map((e) => `${e.label}=${e.value}`),
  };
}

describe("demo VIN 3-market extraction (sources 1+2+3)", () => {
  const payloads = SOURCE_IDS.map((id) => ({ id, json: load(id) }));

  it("extracts make/model/year/photos/auctions/mileage from each provider", () => {
    const report: Record<string, unknown> = { vin: VIN, perSource: {}, merged: null, issues: [] as string[] };
    const issues = report.issues as string[];

    for (const { id, json } of payloads) {
      const norm = normalizeCarstatVhrJsonPayloads([json], { vin: VIN });
      const b = brief(norm);
      const listings =
        (json.source?.sections || []).find((s: { type: string }) => s.type === "listings")?.items || [];
      (report.perSource as Record<string, unknown>)[id] = {
        name: json.source?.name,
        rawListingCount: listings.length,
        ...b,
      };

      expect(b.make, `source ${id} make`).toBeTruthy();
      expect(b.photos, `source ${id} photos`).toBeGreaterThan(0);
      expect(b.auctions.length, `source ${id} auctions`).toBeGreaterThan(0);
      // USA VIN: only NA sale markets (no Encar/Berlin/KR stubs).
      expect(
        b.auctions.every((a) => !/KR|DE|Korea|Germany/i.test(String(a.place ?? "") + String((a as { country?: string }).country ?? ""))),
        `source ${id} foreign auction on US VIN`,
      ).toBe(true);
      expect(
        b.mileage.every((m) => !/encar|korean|european/i.test(String(m.source ?? ""))),
        `source ${id} foreign mileage on US VIN`,
      ).toBe(true);

      for (const a of b.auctions) {
        expect(String(a.source || ""), `source ${id} auction label`).not.toMatch(/^(Copart|IAAI)·Sold$/i);
        expect(String(a.place || ""), `source ${id} place`).not.toMatch(/houston.*germany|germany.*houston/i);
      }
      if (String(b.country).includes("United States")) {
        for (const c of b.claims) {
          expect(JSON.stringify(c), `source ${id} KR on US`).not.toMatch(/₩|KRW/);
        }
      }
      if (!b.mileage.length && listings.some((it: Record<string, unknown>) => it.odometer_km || it.odometer_mi || it.odometer || it.mileage)) {
        issues.push(`${id}: odo in raw, empty mileageHistory`);
      }
    }

    const merged = normalizeCarstatVhrJsonPayloads(
      payloads.map((p) => p.json),
      { vin: VIN },
    );
    const mb = brief(merged);
    report.merged = mb;

    expect(mb.make).toMatch(/Honda/i);
    expect(mb.model).toMatch(/CR-?V/i);
    expect(mb.year).toBe(2018);
    expect(mb.photos).toBeGreaterThan(0);
    expect(mb.auctions.length).toBeGreaterThan(0);
    expect(mb.mileage.length).toBeGreaterThan(0);

    const byDate: Record<string, number> = {};
    for (const m of mb.mileage) {
      const d = String(m.date || "").slice(0, 10);
      byDate[d] = (byDate[d] || 0) + 1;
    }
    const multi = Object.entries(byDate).filter(([, n]) => n > 1);
    expect(multi, `same-day multi mileage: ${JSON.stringify(multi)}`).toEqual([]);
    expect(issues).toEqual([]);
    expect(report.perSource).toBeTruthy();
  });
});
