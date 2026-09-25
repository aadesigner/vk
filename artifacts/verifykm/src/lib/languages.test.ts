import { describe, expect, it } from "vitest";
import {
  localeHomePath,
  replaceLangInPath,
  shouldSoftNavigateClick,
  SUPPORTED_LANGS,
} from "./languages";

describe("localeHomePath", () => {
  it("returns /{lang} for every supported language", () => {
    for (const lang of SUPPORTED_LANGS) {
      expect(localeHomePath(lang)).toBe(`/${lang}`);
    }
  });
});

describe("replaceLangInPath", () => {
  it("swaps the leading locale segment", () => {
    expect(replaceLangInPath("/en/pricing", "en", "sq")).toBe("/sq/pricing"); // prefix-only; use remapPathForLang for slug remap
    expect(replaceLangInPath("/sq", "sq", "de")).toBe("/de");
    expect(replaceLangInPath("/en/cars/usa", "en", "fr")).toBe("/fr/cars/usa");
  });

  it("falls back to locale home when prefix does not match", () => {
    expect(replaceLangInPath("/pricing", "en", "sq")).toBe("/sq");
  });
});

describe("shouldSoftNavigateClick", () => {
  it("allows plain left clicks", () => {
    expect(
      shouldSoftNavigateClick({
        defaultPrevented: false,
        button: 0,
        metaKey: false,
        altKey: false,
        ctrlKey: false,
        shiftKey: false,
      }),
    ).toBe(true);
  });

  it("skips modified or non-primary clicks", () => {
    expect(
      shouldSoftNavigateClick({
        defaultPrevented: false,
        button: 0,
        metaKey: true,
        altKey: false,
        ctrlKey: false,
        shiftKey: false,
      }),
    ).toBe(false);
    expect(
      shouldSoftNavigateClick({
        defaultPrevented: false,
        button: 1,
        metaKey: false,
        altKey: false,
        ctrlKey: false,
        shiftKey: false,
      }),
    ).toBe(false);
  });
});
