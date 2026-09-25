import { describe, expect, it } from "vitest";
import {
  normalizeAppPath,
  pathNormalizeRedirectTarget,
  splitRouterLocation,
} from "./normalize-app-path";

describe("normalizeAppPath", () => {
  it("strips trailing slashes", () => {
    expect(normalizeAppPath("/adminx/users/")).toBe("/adminx/users");
    expect(normalizeAppPath("/adminx/")).toBe("/adminx");
  });

  it("collapses repeated slashes", () => {
    expect(normalizeAppPath("/adminx//users")).toBe("/adminx/users");
  });

  it("leaves root and normalized paths unchanged", () => {
    expect(normalizeAppPath("/")).toBe("/");
    expect(normalizeAppPath("/adminx/users")).toBe("/adminx/users");
  });
});

describe("splitRouterLocation", () => {
  it("preserves query strings and hashes", () => {
    expect(splitRouterLocation("/adminx/users/?tab=1#x")).toEqual({
      pathname: "/adminx/users/",
      suffix: "?tab=1#x",
    });
  });
});

describe("pathNormalizeRedirectTarget", () => {
  it("keeps referral vin and utm query when stripping trailing slash", () => {
    const path = normalizeAppPath("/sq/checkout/");
    expect(
      pathNormalizeRedirectTarget(
        path,
        "?vin=LVYPSAKVDLP082054&utm_source=kilometra&utm_medium=referral&utm_campaign=kilometra_al",
      ),
    ).toBe(
      "/sq/checkout?vin=LVYPSAKVDLP082054&utm_source=kilometra&utm_medium=referral&utm_campaign=kilometra_al",
    );
  });

  it("accepts search without leading ? and preserves hash", () => {
    expect(pathNormalizeRedirectTarget("/en/sign-up", "vin=ABC", "#top")).toBe(
      "/en/sign-up?vin=ABC#top",
    );
  });
});
