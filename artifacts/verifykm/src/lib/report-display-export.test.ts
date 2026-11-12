import { describe, expect, it } from "vitest";
import { ensureExportRegistryEvent, sanitizeRegistryHistory } from "./report-display";

describe("ensureExportRegistryEvent", () => {
  it("adds export to registry when date/mileage only exist in mileage history", () => {
    const out = ensureExportRegistryEvent(
      [{ date: "2024-01-10", type: "inspection", title: "Inspection", mileage: 50000 }],
      [{ date: "2025-06-18", odometer: 94210, source: "Export declaration" }],
    );
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({
      date: "2025-06-18",
      type: "export",
      title: "Export declaration",
      mileage: 94210,
    });
  });

  it("keeps export mileage through sanitize when bridged from mileage", () => {
    const bridged = ensureExportRegistryEvent(
      [],
      [{ date: "2025-06-18", odometer: 94210, source: "Export declaration" }],
    );
    const out = sanitizeRegistryHistory(bridged);
    expect(out).toHaveLength(1);
    expect(out[0]?.type).toBe("export");
    expect(out[0]?.date).toBe("2025-06-18");
    expect(out[0]?.mileage).toBe(94210);
  });
});
