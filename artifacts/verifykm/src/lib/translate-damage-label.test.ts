import { describe, expect, it } from "vitest";
import {
  translateBodyPanelLabel,
  translateBodyRepairExtrasText,
  translateRepairActionLabel,
} from "./translate-damage-label";

const dict: Record<string, string> = {
  provider_odometer: "Kilometrazhi",
  damage_zone_front_fender_l: "Krahu i përparmë (i majtë)",
  damage_zone_front_door_r: "Dera e përparme (e djathtë)",
  damage_zone_hood: "Kapota",
  damage_zone_front_bumper: "Parakolp i përparmë",
  damage_severity_replace: "I zëvendësuar",
};

const t = (key: string) => dict[key] ?? key;

describe("translateBodyPanelLabel", () => {
  it("maps common auction / provider panel wordings", () => {
    expect(translateBodyPanelLabel(t, "Front fender left")).toBe(dict.damage_zone_front_fender_l);
    expect(translateBodyPanelLabel(t, "Front fender (left)")).toBe(dict.damage_zone_front_fender_l);
    expect(translateBodyPanelLabel(t, "Left front fender")).toBe(dict.damage_zone_front_fender_l);
    expect(translateBodyPanelLabel(t, "Front door right")).toBe(dict.damage_zone_front_door_r);
  });
});

describe("translateRepairActionLabel", () => {
  it("maps Replaced / Painted style values", () => {
    expect(translateRepairActionLabel(t, "Replaced")).toBe("I zëvendësuar");
  });
});

describe("translateBodyRepairExtrasText", () => {
  it("translates odometer and multi-part panel lists", () => {
    expect(translateBodyRepairExtrasText(t, "Odometer")).toBe("Kilometrazhi");
    expect(translateBodyRepairExtrasText(t, "Hood; Front bumper")).toBe(
      "Kapota; Parakolp i përparmë",
    );
  });
});
