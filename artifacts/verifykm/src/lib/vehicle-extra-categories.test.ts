import { describe, expect, it } from "vitest";
import {
  categorizeVehicleExtra,
  partitionVehicleExtras,
} from "./vehicle-extra-categories";

describe("categorizeVehicleExtra", () => {
  it("skips identity fields already shown in Vehicle Info", () => {
    expect(categorizeVehicleExtra({ label: "Fuel" })).toBe("skip");
    expect(categorizeVehicleExtra({ key: "color", label: "Paint" })).toBe("skip");
  });

  it("splits Korea fields into focused buckets", () => {
    expect(categorizeVehicleExtra({ key: "kr_spec_abs", label: "Abs" })).toBe("equipment");
    expect(categorizeVehicleExtra({ key: "kr_trim_options", label: "Trim options" })).toBe("equipment");
    expect(categorizeVehicleExtra({ key: "kr_parts_paint", label: "Repair parts · Paint" })).toBe("korean_repairs");
    expect(categorizeVehicleExtra({ key: "kr_export_date", label: "Export date" })).toBe("korean_export");
    expect(categorizeVehicleExtra({ key: "kr_usage_rent", label: "Rent" })).toBe("history");
    expect(categorizeVehicleExtra({ key: "kr_market_price", label: "Korean market price" })).toBe("skip");
    expect(categorizeVehicleExtra({ key: "kr_uninsured_period", label: "Uninsured period" })).toBe("korean");
    expect(categorizeVehicleExtra({ key: "kr_summary_own_damage", label: "Own damage claims" })).toBe("korean");
  });

  it("routes known non-Korea buckets", () => {
    expect(categorizeVehicleExtra({ key: "equip_sunroof", label: "Sunroof" })).toBe("equipment");
    expect(categorizeVehicleExtra({ key: "listing_id", label: "Listing ID" })).toBe("skip");
    expect(categorizeVehicleExtra({ key: "history_listing_id", label: "History listing ID" })).toBe("skip");
    expect(categorizeVehicleExtra({ key: "insp_emissions", label: "Emissions CO" })).toBe("inspection");
    expect(categorizeVehicleExtra({ key: "history_coverage", label: "History coverage" })).toBe("history");
    expect(categorizeVehicleExtra({ label: "Mystery flag" })).toBe("other");
  });
});

describe("partitionVehicleExtras", () => {
  it("drops blanks, identity rows, listing ids, and redundant all-parts rollup", () => {
    const parts = partitionVehicleExtras([
      { label: "Fuel", value: "Gasoline" },
      { label: "Sunroof", value: "Yes", key: "equip_sunroof" },
      { label: "Listing ID", value: "123", key: "listing_id" },
      { label: "Repair parts · Paint", value: "Hood", key: "kr_parts_paint" },
      { label: "All repaired parts", value: "Hood; Door", key: "kr_parts_all" },
      { label: "Empty", value: "  " },
    ]);
    expect(parts.equipment).toHaveLength(1);
    expect(parts.listing).toHaveLength(0);
    expect(parts.korean_repairs).toHaveLength(1);
    expect(parts.korean_repairs[0]?.key).toBe("kr_parts_paint");
    expect(parts.other).toHaveLength(0);
  });
});
