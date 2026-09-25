import { describe, expect, it } from "vitest";
import { decodeVin } from "./vinDecoder";
import { decodeSeatEuHomologation, decodeSeatEuModel, formatSeatDisplay } from "./seat-eu";
import { decodeGlobalBrand } from "./global-brands";

describe("SEAT EU homologation", () => {
  it("decodes León Mk3 with platform and years", () => {
    const hit = decodeSeatEuHomologation("VSSZZZ5FZFR123456");
    expect(hit?.model).toBe("León");
    expect(hit?.platform).toBe("5F");
    expect(hit?.years).toBe("2012–2020");
    expect(decodeSeatEuModel("VSSZZZ5FZFR123456")).toBe("León (5F, 2012–2020)");
  });

  it("decodes Altea / Toledo from 5P homologation", () => {
    const hit = decodeSeatEuHomologation("VSSZZZ5PZCR025966");
    expect(hit?.model).toBe("Altea / Toledo");
    expect(hit?.platform).toBe("5P");
  });

  it("decodes Ateca from KH homologation", () => {
    expect(decodeSeatEuModel("VSSZZZKHZFR123456")).toContain("Ateca");
    expect(decodeSeatEuModel("VSSZZZKHZFR123456")).toContain("KH");
  });

  it("decodes León Mk4 from KL homologation", () => {
    expect(decodeSeatEuModel("VSSZZZKLZPR123456")).toContain("León");
    expect(decodeSeatEuModel("VSSZZZKLZPR123456")).toContain("KL");
    expect(decodeSeatEuModel("VSSZZZKLZPR123456")).toContain("2020");
  });

  it("decodes Ibiza Mk5 from 6F homologation", () => {
    expect(decodeSeatEuModel("VSSZZZ6FZPR123456")).toContain("Ibiza");
    expect(decodeSeatEuModel("VSSZZZ6FZPR123456")).toContain("6F");
  });

  it("decodes Arona from K7 homologation", () => {
    expect(decodeSeatEuModel("VSSZZZK7ZPR123456")).toContain("Arona");
  });

  it("does not invent model from unknown 2-char / pos-7 alone", () => {
    expect(decodeSeatEuModel("VSSZZZ2FZFR123456")).toBeNull();
  });

  it("decodes Alhambra Mk2 from 7N homologation", () => {
    expect(decodeSeatEuModel("VSSZZZ7NZLR123456")).toContain("Alhambra");
    expect(decodeSeatEuModel("VSSZZZ7NZLR123456")).toContain("7N");
  });

  it("decodes León Mk2 from 1P homologation", () => {
    expect(decodeSeatEuModel("VSSZZZ1PZFR123456")).toContain("León");
    expect(decodeSeatEuModel("VSSZZZ1PZFR123456")).toContain("1P");
  });

  it("decodes VS6/VS7 four-char WMI prefixes", () => {
    expect(decodeSeatEuModel("VS6A1Z7E5MR123456")).toBe("Ibiza");
    expect(decodeSeatEuModel("VS7B1Z7E5MR123456")).toBe("Ateca");
    expect(decodeSeatEuModel("VS7T1Z7E5MR123456")).toBe("Tarraco");
  });

  it("formatSeatDisplay omits empty meta", () => {
    expect(formatSeatDisplay({ model: "León", platform: null, years: null })).toBe("León");
  });
});

describe("decodeVin SEAT integration", () => {
  it("returns León with generation for Mk3 VIN", () => {
    const r = decodeVin("VSSZZZ5FZFR123456");
    expect(r.make).toBe("SEAT");
    expect(r.model).toContain("León");
    expect(r.model).toContain("5F");
  });

  it("keeps Cupra Formentor separate from SEAT", () => {
    const cupra = decodeGlobalBrand("VSSZZZKM7MR123456");
    expect(cupra.makeOverride).toBe("Cupra");
    expect(cupra.model).toBe("Formentor");

    const r = decodeVin("VSSZZZKM7MR123456");
    expect(r.make).toBe("Cupra");
    expect(r.model).toBe("Formentor");
  });

  it("still decodes León Mk2 EU ZZZ via 1P", () => {
    const r = decodeVin("VSSZZZ1PZFR123456");
    expect(r.make).toBe("SEAT");
    expect(r.model).toContain("León");
  });

  it("unknown SEAT type stays null (no pos-7 invent)", () => {
    const r = decodeVin("VSSZZZ2FZFR123456");
    expect(r.make).toBe("SEAT");
    expect(r.model).toBeNull();
  });
});
