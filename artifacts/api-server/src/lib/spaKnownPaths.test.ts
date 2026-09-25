import { describe, expect, it } from "vitest";
import { isKnownSpaPath } from "./spaKnownPaths.js";

describe("isKnownSpaPath", () => {
  it("allows marketing, auth, and admin shells", () => {
    expect(isKnownSpaPath("/")).toBe(true);
    expect(isKnownSpaPath("/en")).toBe(true);
    expect(isKnownSpaPath("/sq/pricing")).toBe(true);
    expect(isKnownSpaPath("/en/cars/usa")).toBe(true);
    expect(isKnownSpaPath("/en/cars-from-usa")).toBe(true);
    expect(isKnownSpaPath("/sq/makina-nga-korea")).toBe(true);
    expect(isKnownSpaPath("/en/cars/japan")).toBe(true);
    expect(isKnownSpaPath("/de/sign-in")).toBe(true);
    expect(isKnownSpaPath("/adminx")).toBe(true);
    expect(isKnownSpaPath("/adminx/users")).toBe(true);
    expect(isKnownSpaPath("/usa-cars")).toBe(true);
    expect(isKnownSpaPath("/pricing")).toBe(true);
  });

  it("allows VIN and lookup id routes", () => {
    expect(isKnownSpaPath("/en/vin/1HGBH41JXMN109186")).toBe(true);
    expect(isKnownSpaPath("/en/vin/processing")).toBe(true);
    expect(isKnownSpaPath("/en/vin/42")).toBe(true);
    expect(isKnownSpaPath("/ka")).toBe(true);
    expect(isKnownSpaPath("/ka/pricing")).toBe(true);
    expect(isKnownSpaPath("/ka/vin/1HGBH41JXMN109186")).toBe(true);
  });

  it("rejects unknown soft-404 paths", () => {
    expect(isKnownSpaPath("/en/not-a-real-page")).toBe(false);
    expect(isKnownSpaPath("/totally-random")).toBe(false);
    expect(isKnownSpaPath("/en/vin/too-short")).toBe(false);
    expect(isKnownSpaPath("/en/cars/mars")).toBe(false);
  });
});
