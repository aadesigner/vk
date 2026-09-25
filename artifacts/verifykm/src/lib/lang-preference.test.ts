import { describe, expect, it } from "vitest";
import { englishPrefixRedirectTarget, pathNeedingLangPrefix, buildLocalizedPath } from "./lang-preference";

describe("englishPrefixRedirectTarget", () => {
  it("prepends /en when path has no language prefix", () => {
    expect(englishPrefixRedirectTarget("/cars/usa")).toBe("/en/cars/usa");
    expect(englishPrefixRedirectTarget("/vin/1HGBH41JXMN109186")).toBe("/en/vin/1HGBH41JXMN109186");
    expect(englishPrefixRedirectTarget("/pricing")).toBe("/en/pricing");
    expect(englishPrefixRedirectTarget("/checkout")).toBe("/en/checkout");
    expect(englishPrefixRedirectTarget("/sign-in")).toBe("/en/sign-in");
    expect(englishPrefixRedirectTarget("/dashboard")).toBe("/en/dashboard");
    expect(englishPrefixRedirectTarget("/free-vin-decoder")).toBe("/en/free-vin-decoder");
  });

  it("leaves prefixed paths unchanged", () => {
    expect(englishPrefixRedirectTarget("/en/cars/usa")).toBeNull();
    expect(englishPrefixRedirectTarget("/sq/pricing")).toBeNull();
    expect(englishPrefixRedirectTarget("/ro/pricing")).toBeNull();
    expect(englishPrefixRedirectTarget("/ar/vin/ABC")).toBeNull();
    expect(englishPrefixRedirectTarget("/en")).toBeNull();
  });

  it("maps unsupported two-letter lang slugs to /en/…", () => {
    expect(englishPrefixRedirectTarget("/xx/pricing")).toBe("/en/pricing");
    expect(englishPrefixRedirectTarget("/zz/cars/usa")).toBe("/en/cars/usa");
  });

  it("leaves supported de/fr/bg prefixes unchanged", () => {
    expect(englishPrefixRedirectTarget("/fr/pricing")).toBeNull();
    expect(englishPrefixRedirectTarget("/de/cars/usa")).toBeNull();
    expect(englishPrefixRedirectTarget("/bg/faq")).toBeNull();
  });

  it("exempts root, admin, and legacy country paths", () => {
    expect(englishPrefixRedirectTarget("/")).toBeNull();
    expect(englishPrefixRedirectTarget("/adminx/users")).toBeNull();
    expect(englishPrefixRedirectTarget("/usa-cars")).toBeNull();
  });
});

describe("pathNeedingLangPrefix", () => {
  it("returns path tail for unprefixed routes", () => {
    expect(pathNeedingLangPrefix("/vin/ABC")).toBe("vin/ABC");
    expect(pathNeedingLangPrefix("/pricing")).toBe("pricing");
  });

  it("returns null for localized paths", () => {
    expect(pathNeedingLangPrefix("/sq/pricing")).toBeNull();
    expect(pathNeedingLangPrefix("/en")).toBeNull();
  });
});

describe("buildLocalizedPath", () => {
  it("builds lang-prefixed paths", () => {
    expect(buildLocalizedPath("sq", "pricing")).toBe("/sq/pricing");
    expect(buildLocalizedPath("en", "")).toBe("/en");
  });
});
