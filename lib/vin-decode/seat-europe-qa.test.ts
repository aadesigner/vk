/**
 * SEAT free-decoder QA — EU ZZZ homologation + VS6/VS7 letter lines.
 *
 * Contract:
 * - Model from 2-char type after ZZZ (or VS6/VS7 letter@4); never invent from pos-7 alone.
 * - Year from ISO position 10 (same as other VAG EU; not Ford XX).
 * - KN = Tarraco (SEAT), never Cupra León.
 * - Cupra Formentor/Born stay Cupra via global-brands.
 * - Shared platforms use slash labels (Ibiza/Cordoba, León/Toledo, Altea/Toledo).
 */
import { describe, expect, it } from "vitest";
import { decodeVin, decodeSeatEuModel, decodeGlobalBrand, decodeLocalSeries } from "./index";

describe("SEAT Europe QA — model regressions", () => {
  it("VSSZZZ5FZ… → León 5F; letter year omitted without verified window", () => {
    const vin = "VSSZZZ5FZFR123456";
    const r = decodeVin(vin);
    expect(r.make).toBe("SEAT");
    expect(r.model).toMatch(/León/i);
    expect(r.model).toContain("5F");
    // Letter F without a verified 5F production window → null
    expect(r.year).toBeNull();
  });

  it("VSSZZZ6FZ… late MY still Ibiza 6F (open year label)", () => {
    const vin = "VSSZZZ6FZPR123456";
    const r = decodeVin(vin);
    expect(r.make).toBe("SEAT");
    expect(r.model).toMatch(/Ibiza/i);
    expect(r.model).toContain("6F");
    expect(r.model).toMatch(/2017–/);
    // Letter P without a verified 6F production window → null
    expect(r.year).toBeNull();
  });

  it("VSSZZZKNZ… → SEAT Tarraco, not Cupra León", () => {
    const vin = "VSSZZZKNZLR123456";
    expect(decodeGlobalBrand(vin).makeOverride).toBeNull();
    expect(decodeGlobalBrand(vin).model).toBeNull();
    const r = decodeVin(vin);
    expect(r.make).toBe("SEAT");
    expect(r.model).toMatch(/Tarraco/i);
    expect(r.model).toContain("KN");
    expect(r.model).not.toMatch(/Le[oó]n/i);
    // Letter L without a verified KN production window → null
    expect(r.year).toBeNull();
  });

  it("VSSZZZKM… stays Cupra Formentor", () => {
    const r = decodeVin("VSSZZZKM7MR123456");
    expect(r.make).toBe("Cupra");
    expect(r.model).toBe("Formentor");
    expect(decodeLocalSeries("VSSZZZKM7MR123456")).toBe("KM");
  });

  it("VSSZZZKC… → Cupra Born (KC exclusive)", () => {
    const r = decodeVin("VSSZZZKC7PR123456");
    expect(r.make).toBe("Cupra");
    expect(r.model).toBe("Born");
    expect(decodeLocalSeries("VSSZZZKC7PR123456")).toBe("KC");
  });

  it("VSSZZZ7NZ… → Alhambra Mk2", () => {
    const r = decodeVin("VSSZZZ7NZLR123456");
    expect(r.make).toBe("SEAT");
    expect(r.model).toMatch(/Alhambra/i);
    expect(r.model).toContain("7N");
  });

  it("VSSZZZ5PZ… shared Altea / Toledo label", () => {
    expect(decodeSeatEuModel("VSSZZZ5PZCR025966")).toMatch(/Altea \/ Toledo/);
  });

  it("VSSZZZ1MZ… shared León / Toledo label", () => {
    expect(decodeSeatEuModel("VSSZZZ1MZ9R123456")).toMatch(/León \/ Toledo/);
  });

  it("VSSZZZKL… León Mk4; KJ Ibiza; KH Ateca; K7 Arona", () => {
    expect(decodeVin("VSSZZZKLZPR123456").model).toMatch(/León.*KL/i);
    expect(decodeVin("VSSZZZKJZPR123456").model).toMatch(/Ibiza.*KJ/i);
    expect(decodeVin("VSSZZZKHZNR123456").model).toMatch(/Ateca.*KH/i);
    expect(decodeVin("VSSZZZK7ZPR123456").model).toMatch(/Arona.*K7/i);
  });

  it("unknown type stays null (no invent)", () => {
    const r = decodeVin("VSSZZZ2FZFR123456");
    expect(r.make).toBe("SEAT");
    expect(r.model).toBeNull();
  });

  it("VS6/VS7 letter lines stay SEAT; Ford XX layout not treated as letter line", () => {
    expect(decodeVin("VS6A1Z7E5MR123456")).toMatchObject({ make: "SEAT", model: "Ibiza" });
    expect(decodeVin("VS7B1Z7E5MR123456").model).toBe("Ateca");
    expect(decodeVin("VS7T1Z7E5MR123456").model).toBe("Tarraco");
    expect(decodeVin("VS6M1Z7E5MR123456").model).toBe("Mii");
    // Digit body + XX is Ford Spain layout — not a SEAT VS6A–M letter model
    expect(decodeSeatEuModel("VS65XXGBC5FD12345")).toBeNull();
  });
});
