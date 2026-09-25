import { describe, expect, it } from "vitest";
import { translateFuelType } from "./translate-fuel-type";

const t = (key: string) => ({
  fuel_petrol: "Benzinë",
  fuel_diesel: "Naftë",
  fuel_electric: "Elektrik",
  fuel_hybrid: "Hibrid",
  fuel_phev: "Hibrid me karikues",
}[key] ?? key);

describe("translateFuelType", () => {
  it("translates common API fuel names", () => {
    expect(translateFuelType(t, "gas")).toBe("Benzinë");
    expect(translateFuelType(t, "diesel")).toBe("Naftë");
    expect(translateFuelType(t, "Diesel")).toBe("Naftë");
    expect(translateFuelType(t, "plug-in hybrid")).toBe("Hibrid me karikues");
  });
});
