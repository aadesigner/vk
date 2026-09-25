/**
 * Careful make/model coverage: Saab, Cupra-exclusive badges, Genesis US,
 * Polestar 3, Lucid Gravity/Air (NHTSA WMIs). No inventing on shared lines.
 */
import { describe, expect, it } from "vitest";
import { decodeVin } from "./index";

function pad(prefix: string, yearChar = "N"): string {
  const base = (prefix.toUpperCase() + "00000000000000000").slice(0, 17).split("");
  base[9] = yearChar;
  return base.join("");
}

describe("Saab YS3", () => {
  it("YS3F… → 9-3 (NHTSA descriptor YS3FD…)", () => {
    const r = decodeVin("YS3FD49Y241012345");
    expect(r.make).toBe("Saab");
    expect(r.model).toBe("9-3");
    expect(r.year).toBe(2004);
    expect(r.country).toBe("Sweden");
  });

  it("YS3D… → 9-3", () => {
    const r = decodeVin("YS3DF78K861234567");
    expect(r.make).toBe("Saab");
    expect(r.model).toBe("9-3");
    expect(r.year).toBe(2006);
  });

  it("YS3E → 9-5", () => {
    const r = decodeVin("YS3EH49G261234567");
    expect(r.make).toBe("Saab");
    expect(r.model).toBe("9-5");
    expect(r.year).toBe(2006);
  });

  it("unknown YS3 line stays make-only", () => {
    const r = decodeVin(pad("YS3Z", "9"));
    expect(r.make).toBe("Saab");
    expect(r.model).toBeNull();
  });
});

describe("Cupra badge — exclusive lines only", () => {
  it("VSSZZZKM → Cupra Formentor", () => {
    const r = decodeVin(pad("VSSZZZKM", "N"));
    expect(r.make).toBe("Cupra");
    expect(r.model).toContain("Formentor");
  });

  it("VSSZZZKC → Cupra Born (KC exclusive)", () => {
    const r = decodeVin(pad("VSSZZZKC", "P"));
    expect(r.make).toBe("Cupra");
    expect(r.model).toContain("Born");
  });

  it("VSSZZZKL León stays SEAT (shared with Cupra León — no invent)", () => {
    const r = decodeVin(pad("VSSZZZKL", "N"));
    expect(r.make).toBe("SEAT");
    expect(r.model).toContain("León");
  });

  it("VSSZZZKN Tarraco stays SEAT (not Cupra León)", () => {
    const r = decodeVin(pad("VSSZZZKN", "N"));
    expect(r.make).toBe("SEAT");
    expect(r.model).toContain("Tarraco");
  });
});

describe("Genesis US Alabama (5NMM)", () => {
  it("5NMMCET… → Genesis GV70 (NHTSA-verified)", () => {
    const r = decodeVin("5NMMCET10PH000214");
    expect(r.make).toBe("Genesis");
    expect(r.model).toBe("GV70");
    expect(r.year).toBe(2023);
  });

  it("sibling Hyundai Tucson 5NMJ stays Hyundai", () => {
    const r = decodeVin(pad("5NMJB3AE0", "P"));
    expect(r.make).toBe("Hyundai");
    expect(r.model).toBe("Tucson");
  });

  it("sibling Hyundai Santa Fe 5NMS stays Hyundai", () => {
    const r = decodeVin(pad("5NMS4DAE0", "R"));
    expect(r.make).toBe("Hyundai");
    expect(r.model).toContain("Santa Fe");
  });
});

describe("VinFast", () => {
  it("China RLLVC → VF8", () => {
    const r = decodeVin(pad("RLLVC", "N"));
    expect(r.make).toBe("VinFast");
    expect(r.model).toBe("VF8");
  });

  it("US 5VF stays make-only (no verified US VDS yet)", () => {
    const r = decodeVin(pad("5VFZ", "R"));
    expect(r.make).toBe("VinFast");
    expect(r.model).toBeNull();
  });
});

describe("Polestar 3", () => {
  it("YSR Sweden MPV → Polestar 3", () => {
    const r = decodeVin("YSREJ3YB0SG123456");
    expect(r.make).toBe("Polestar");
    expect(r.model).toBe("Polestar 3");
    // Letter S without a verified Polestar 3 window → null
    expect(r.year).toBeNull();
  });

  it("7SY USA MPV Performance motor → Polestar 3", () => {
    const r = decodeVin("7SYEE3YB0SG123456");
    expect(r.make).toBe("Polestar");
    expect(r.model).toBe("Polestar 3");
  });

  it("bare YSR stays make-only", () => {
    const r = decodeVin(pad("YSRZ", "S"));
    expect(r.make).toBe("Polestar");
    expect(r.model).toBeNull();
  });
});

describe("Lucid Air / Gravity", () => {
  it("7UUG… → Gravity (NHTSA ErrorCode 0)", () => {
    const r = decodeVin("7UUG1GHL4SA012345");
    expect(r.make).toBe("Lucid");
    expect(r.model).toBe("Gravity");
    // Letter S without a verified Lucid Gravity window → null
    expect(r.year).toBeNull();
    expect(r.fuelType).toBe("Electric");
  });

  it("50E… → Air (NHTSA passenger WMI)", () => {
    const r = decodeVin(pad("50EAAAA", "S"));
    expect(r.make).toBe("Lucid");
    expect(r.model).toBe("Air");
    expect(r.fuelType).toBe("Electric");
  });

  it("7UU without G stays make-only", () => {
    const r = decodeVin(pad("7UUZ", "S"));
    expect(r.make).toBe("Lucid");
    expect(r.model).toBeNull();
  });

  it("legacy 5LABP Air still resolves", () => {
    const r = decodeVin(pad("5LABP", "N"));
    expect(r.make).toBe("Lucid");
    expect(r.model).toBe("Air");
  });
});
