import { describe, expect, it } from "vitest";
import {
  dedupeServiceHistory,
  extractServiceRecordId,
  serviceHistoryDedupeKey,
} from "./history-dedupe";

describe("service history performance inspection dedupe", () => {
  it("extracts record ids", () => {
    expect(extractServiceRecordId("Korean performance inspection — record #8026005635 — issued 2024-09-27"))
      .toBe("8026005635");
  });

  it("collapses same record id with different title tails", () => {
    const rows = dedupeServiceHistory([
      {
        date: "2026-07-24",
        mileage: 22121,
        title: "Korean performance inspection — record #8026005635 — issued 2024-09-27 — 22,121 km — structure/frame: Good — valid 2024-09-27 → 2028-09-26",
      },
      {
        date: "2026-07-24",
        mileage: 22121,
        title: "Korean performance inspection— record #8026005635— issued 2024-09-27— 22,121 km— structure/frame: Good— vehicle condition: Good— valid 2024-09-27 → 2028-09-26— first registered 2024-09-27",
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toContain("vehicle condition");
    expect(serviceHistoryDedupeKey(rows[0]!)).toBe("rec:8026005635");
  });
});
