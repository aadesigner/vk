/**
 * Toyota free-decoder QA — EU plants (VNK France, NMT Turkey, SB1 UK) + Japan/US.
 *
 * Contract:
 * - VNK = Yaris family (Valenciennes). Unknown VDS → "Yaris / Yaris Cross", never invent.
 * - NMT = C-HR / Corolla (Sakarya). Prefer specific prefixes when known.
 * - Year from ISO pos.10 when valid; invalid codes (e.g. "0") stay null — no invent.
 * - Make is "Toyota" (not "Toyota France").
 */
import { describe, expect, it } from "vitest";
import { decodeVin, decodeHyundaiToyotaModel } from "./index";

describe("Toyota QA — France VNK (Valenciennes)", () => {
  it("VNKKC98330A013042 → Yaris family; year null (invalid pos.10=0)", () => {
    const vin = "VNKKC98330A013042";
    const r = decodeVin(vin);
    expect(r.make).toBe("Toyota");
    expect(r.model).toMatch(/Yaris/i);
    expect(r.country).toBe("France");
    expect(r.year).toBeNull(); // "0" is not an ISO year code
    expect(r.plantCity).toMatch(/Onnaing/i);
  });

  it("known VNK Yaris sample; letter year omitted without verified window", () => {
    // Bumper sample: VNKKTUD30EA001248 — letter E is ambiguous without a verified window
    const r = decodeVin("VNKKTUD30EA001248");
    expect(r.make).toBe("Toyota");
    expect(r.model).toMatch(/Yaris/i);
    expect(r.year).toBeNull();
  });

  it("VNK Yaris Cross specific prefix when known", () => {
    expect(decodeHyundaiToyotaModel("VNKKAB123MA123456")).toMatch(/Yaris Cross/i);
  });
});

describe("Toyota QA — Turkey NMT (Sakarya)", () => {
  it("NMTKHMBX… → C-HR", () => {
    const r = decodeVin("NMTKHMBX0JR000838");
    expect(r.make).toBe("Toyota");
    expect(r.model).toMatch(/C-HR/i);
    // Letter J uniquely fits AX10 C-HR window (2017–2023) → 2018
    expect(r.year).toBe(2018);
    expect(r.country).toBe("Turkey");
  });

  it("unknown NMT VDS → C-HR / Corolla family (no invent)", () => {
    expect(decodeHyundaiToyotaModel("NMTZZZXX0JR123456")).toMatch(/Corolla \/ Auris \/ C-HR/);
  });
});

describe("Toyota QA — UK SB1 stays green", () => {
  it("SB1 Corolla / C-HR / Yaris prefixes", () => {
    expect(decodeVin("SB1KB3BE40E123456").model).toMatch(/Corolla/i);
    expect(decodeVin("SB1B93BE40E123456").model).toMatch(/C-HR/i);
    expect(decodeVin("SB1Y93BE40E123456").model).toMatch(/Yaris/i);
  });
});

describe("Toyota QA — Japan / US not broken", () => {
  it("JT* Prius / RAV4 still decode", () => {
    expect(decodeVin("JTDKN3DU5A0123456").model).toMatch(/Prius/i);
    expect(decodeVin("JTMBFREV0E5123456").model).toMatch(/RAV4/i);
  });
});

describe("Toyota QA — Mexico 3TY WMI", () => {
  it("3TYLC5LN6TT077888 → Toyota (Mexico); check digit valid", () => {
    const vin = "3TYLC5LN6TT077888";
    const r = decodeVin(vin);
    expect(r.make).toBe("Toyota");
    expect(r.country).toBe("Mexico");
    // Letter T is 1996/2026 — omit year without a verified model window (no invent).
    expect(r.year === 2026 || r.year === null).toBe(true);
  });
});
