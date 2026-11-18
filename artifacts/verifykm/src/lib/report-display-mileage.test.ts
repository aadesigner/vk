import { describe, expect, it } from "vitest";
import {
  ensureInitialRegistrationMileage,
  ensureRegistryMileageHistory,
  resolveFirstRegistrationDate,
  formatMileageHistorySource,
  sanitizeMileageHistory,
} from "./report-display";

describe("ensureInitialRegistrationMileage", () => {
  it("adds a 1 km first-registration start when history exists", () => {
    const out = ensureInitialRegistrationMileage(
      [{ date: "2024-06-01", odometer: 22000, unit: "km", source: "inspection" }],
      { firstRegistrationDate: "2020-03-15", vehicleYear: 2020 },
    );
    expect(out).toHaveLength(2);
    expect(out.some((e) => e.odometer === 1 && e.source === "First registration")).toBe(true);
    expect(out.find((e) => e.odometer === 1)?.date).toBe("2020-03-15");
  });

  it("does not invent history when empty", () => {
    expect(ensureInitialRegistrationMileage([], { vehicleYear: 2020 })).toEqual([]);
  });

  it("relabels an existing 1 km reading", () => {
    const out = ensureInitialRegistrationMileage(
      [{ date: "2020-03-15", odometer: 1, unit: "km", source: "export" }],
      { firstRegistrationDate: "2020-03-15" },
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.source).toBe("First registration");
  });
});

describe("resolveFirstRegistrationDate", () => {
  it("reads registry first_registration", () => {
    expect(
      resolveFirstRegistrationDate([{ type: "first_registration", date: "2019-04-01" }]),
    ).toBe("2019-04-01");
  });
});

describe("formatMileageHistorySource", () => {
  it("localizes first registration", () => {
    const t = (k: string) => (k === "registry_field_first_registration" ? "First registration" : k);
    expect(formatMileageHistorySource("First registration", t)).toBe("First registration");
    expect(formatMileageHistorySource("Initial registration", t)).toBe("First registration");
  });

  it("localizes insurance / export / used-car-mall sources", () => {
    const dict: Record<string, string> = {
      provider_mileage_source_insurance: "Kompani sigurimi makinash",
      provider_mileage_source_used_car_mall: "Treg makinash të përdorura",
      registry_type_export: "Deklarata e eksportit",
    };
    const t = (k: string) => dict[k] ?? k;
    expect(formatMileageHistorySource("Car insurance company", t)).toBe("Kompani sigurimi makinash");
    expect(formatMileageHistorySource("Used car shopping mall", t)).toBe("Treg makinash të përdorura");
    expect(formatMileageHistorySource("Export declaration", t)).toBe("Deklarata e eksportit");
  });

  it("localizes bare inspection source", () => {
    const t = (k: string) => (k === "provider_inspection" ? "Inspektim" : k);
    expect(formatMileageHistorySource("inspection", t)).toBe("Inspektim");
    expect(formatMileageHistorySource("Inspection", t)).toBe("Inspektim");
  });
});

describe("ensureRegistryMileageHistory", () => {
  it("adds dated Korean registry km into the mileage timeline", () => {
    const out = ensureRegistryMileageHistory(
      [{ date: "2025-12-20", odometer: 156_676, unit: "km", source: "listing" }],
      [
        { date: "2024-02-24", type: "inspection", title: "Car inspection completed", mileage: 77_675 },
        { date: "2023-06-01", type: "owner_change", title: "Owner change", mileage: 62_100 },
        { date: null, type: "inspection", title: "No date", mileage: 50_000 },
      ],
    );
    expect(out.some((e) => e.odometer === 77_675 && e.source === "Korean inspection")).toBe(true);
    expect(out.some((e) => e.odometer === 62_100 && e.source === "Korean ownership")).toBe(true);
    expect(out.some((e) => e.odometer === 50_000)).toBe(false);
  });

  it("does not duplicate an existing odometer reading", () => {
    const out = ensureRegistryMileageHistory(
      [{ date: "2024-02-24", odometer: 77_675, unit: "km", source: "Korean inspection" }],
      [{ date: "2024-02-24", type: "inspection", mileage: 77_675 }],
    );
    expect(out).toHaveLength(1);
  });
});

describe("sanitizeMileageHistory listing price", () => {
  it("strips sale price and lot chips from listing mileage rows", () => {
    const out = sanitizeMileageHistory([
      {
        date: "2025-12-20",
        odometer: 156_676,
        unit: "km",
        source: "listing",
        auctionPrice: 8196,
        condition: "Run & Drives",
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.auctionPrice).toBeNull();
    expect(out[0]?.condition).toBeNull();
    expect(out[0]?.odometer).toBe(156_676);
  });

  it("strips legacy Carstat lots that omit source but still carry sale chips", () => {
    const out = sanitizeMileageHistory([
      {
        date: null,
        odometer: 137_498,
        unit: "km",
        auctionPrice: 9597,
        condition: "run_and_drives",
        lotStatus: "sold",
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.source).toBe("listing");
    expect(out[0]?.auctionPrice).toBeNull();
    expect(out[0]?.condition).toBeNull();
    expect(out[0]?.lotStatus).toBeNull();
    expect(out[0]?.odometer).toBe(137_498);
  });
});
