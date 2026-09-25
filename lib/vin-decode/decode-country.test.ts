import { describe, expect, it } from "vitest";
import { decodeCountry } from "./vinDecoder";

describe("decodeCountry WMI refinement", () => {
  it("splits France and Spain on V-prefix WMIs", () => {
    expect(decodeCountry("VF1RZ00000A123456")).toBe("France");
    expect(decodeCountry("VF3RZ00000A123456")).toBe("France");
    expect(decodeCountry("VS6ZZZ5FZMR123456")).toBe("Spain");
    expect(decodeCountry("VSSZZZ6JZAR123456")).toBe("Spain");
  });

  it("splits Sweden on Y-prefix Volvo WMIs", () => {
    expect(decodeCountry("YV1LZ00000A123456")).toBe("Sweden");
  });

  it("returns combined label when V WMI cannot be split", () => {
    expect(decodeCountry("VXX0000000A123456")).toBe("France/Spain");
  });
});
