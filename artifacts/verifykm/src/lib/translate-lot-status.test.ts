import { describe, it, expect } from "vitest";
import { translateLotStatus } from "./translate-lot-status";

const t = (key: string) => ({
  label_sale: "Shitje",
  label_sold: "Shitur",
  label_run_and_drives: "Punon dhe lëviz",
  label_wait: "Në pritje",
}[key] ?? key);

describe("translateLotStatus", () => {
  it("translates Encar/Carstat sale status", () => {
    expect(translateLotStatus(t, "sale")).toBe("Shitje");
  });

  it("translates sold and condition tokens", () => {
    expect(translateLotStatus(t, "sold")).toBe("Shitur");
    expect(translateLotStatus(t, "run_and_drives")).toBe("Punon dhe lëviz");
  });

  it("normalizes spaced provider values", () => {
    expect(translateLotStatus(t, "run and drives")).toBe("Punon dhe lëviz");
  });
});
