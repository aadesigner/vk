import { describe, expect, it } from "vitest";
import {
  buildAttrSelectOptions,
  resolveBodySelectValue,
  resolveColorSelectValue,
  resolveFuelSelectValue,
  resolveTransmissionSelectValue,
  translateColor,
  ADMIN_FUEL_OPTIONS,
} from "./vehicle-attr-options";

const t = (key: string) => key === "fuel_petrol" ? "Petrol / Gasoline" : key;

describe("vehicle-attr-options", () => {
  it("resolves fuel aliases to canonical select values", () => {
    expect(resolveFuelSelectValue("Petrol")).toBe("gasoline");
    expect(resolveFuelSelectValue("PHEV")).toBe("plug-in hybrid");
    expect(resolveFuelSelectValue("Gasoline")).toBe("gasoline");
  });

  it("resolves transmission / body / color aliases", () => {
    expect(resolveTransmissionSelectValue("dual-clutch")).toBe("dct");
    expect(resolveBodySelectValue("saloon")).toBe("sedan");
    expect(resolveColorSelectValue("grey")).toBe("gray");
  });

  it("keeps unknown current values in select options", () => {
    const options = buildAttrSelectOptions(t, ADMIN_FUEL_OPTIONS, "bioethanol-blend", "—", resolveFuelSelectValue);
    expect(options.some((o) => o.value === "bioethanol-blend")).toBe(true);
    expect(options.find((o) => o.value === "gasoline")?.label).toBe("Petrol / Gasoline");
  });

  it("translates colors via i18n map", () => {
    const tr = (key: string) => (key === "color_white" ? "Білий" : key);
    expect(translateColor(tr, "white")).toBe("Білий");
    expect(translateColor(tr, "Neon Lime")).toBe("Neon Lime");
  });
});
