import { describe, expect, it } from "vitest";
import {
  resolveAccidentSeverityForDisplay,
  accidentSeverityStyle,
} from "./accident-display";

describe("resolveAccidentSeverityForDisplay", () => {
  it("does not treat missing price as a small accident", () => {
    expect(resolveAccidentSeverityForDisplay({}, {})).toBe("unknown");
    expect(resolveAccidentSeverityForDisplay({ lossAmount: null }, {})).toBe("unknown");
    expect(resolveAccidentSeverityForDisplay({ lossAmount: 0 }, {})).toBe("unknown");
  });

  it("keeps explicit provider severity when there is no amount", () => {
    expect(resolveAccidentSeverityForDisplay({ severity: "major" }, {})).toBe("major");
    expect(resolveAccidentSeverityForDisplay({ severity: "minor" }, {})).toBe("minor");
  });

  it("infers from positive loss amount", () => {
    expect(resolveAccidentSeverityForDisplay({ lossAmount: 500 }, {})).toBe("minor");
    expect(resolveAccidentSeverityForDisplay({ lossAmount: 5000 }, {})).toBe("major");
  });
});

describe("accidentSeverityStyle", () => {
  it("uses neutral styling for unknown severity", () => {
    const style = accidentSeverityStyle("unknown");
    expect(style.card).toContain("border-border");
    expect(style.dot).not.toContain("yellow");
  });
});
