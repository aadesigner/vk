import { describe, expect, it } from "vitest";
import {
  normalizeDamagePartLabel,
  parseCarDamageFromRepairExtras,
} from "./car-damage-zones";

describe("parseCarDamageFromRepairExtras", () => {
  it("dedupes the same panel across repair/paint/replace rows", () => {
    expect(normalizeDamagePartLabel("Trunk / tailgateRepaired")).toBe("Trunk / tailgate Repaired");
    const hits = parseCarDamageFromRepairExtras([
      {
        key: "kr_parts_repair",
        label: "Repair parts · Repair",
        value: "Trunk interior (repair); Trunk / tailgateRepaired",
      },
      {
        key: "kr_parts_paint",
        label: "Repair parts · Paint",
        value: "Trunk interior (painting)",
      },
      {
        key: "kr_parts_replace",
        label: "Repair parts · Replace",
        value: "Trunk interior (replacement)",
      },
    ]);
    const trunk = hits.find((h) => h.zone === "trunk");
    expect(trunk).toBeTruthy();
    expect(trunk!.labels.filter((l) => /trunk interior/i.test(l))).toHaveLength(1);
    expect(trunk!.labels.some((l) => /tailgate\s+Repaired/i.test(l))).toBe(true);
  });

  it("maps Korea repair part rows onto body zones with severity", () => {
    const hits = parseCarDamageFromRepairExtras([
      {
        key: "kr_parts_paint",
        label: "Repair parts · Paint",
        value: "Front bumper surface repair (painting); Rear door (left) surface repair (painting)",
      },
      {
        key: "kr_parts_replace",
        label: "Repair parts · Replace",
        value: "Front door (left) (replace); Rear bumper assembly (replacement)",
      },
      {
        key: "kr_parts_sheet_metal",
        label: "Repair parts · Sheet Metal",
        value: "Rear Quarter Panel (Fuel Filler Side | Rear Fender | Outer) (Left) (Sheet Metal)",
      },
      {
        key: "kr_parts_all",
        label: "All repaired parts",
        value: "Should be ignored when category rows exist",
      },
    ]);

    const byZone = Object.fromEntries(hits.map((h) => [h.zone, h.severity]));
    expect(byZone.front_bumper).toBe("paint");
    expect(byZone.rear_door_l).toBe("paint");
    expect(byZone.front_door_l).toBe("replace");
    expect(byZone.rear_bumper).toBe("replace");
    expect(byZone.rear_fender_l).toBe("sheet_metal");
  });
});
