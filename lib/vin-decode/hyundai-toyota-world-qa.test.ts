/**
 * Worldwide Hyundai / Toyota free-decoder QA.
 *
 * Contract:
 * - Recognize manufacturer and origin across regional production WMIs.
 * - Use verified VDS prefixes where available; otherwise return a conservative
 *   plant/model family, never a made-up exact model.
 * - Preserve ISO year decoding only when position 10 contains a valid year code.
 */
import { describe, expect, it } from "vitest";
import { decodeVin } from "./index";

describe("Toyota worldwide QA", () => {
  it("Thailand MR0FR → Hilux", () => {
    const r = decodeVin("MR0FR22GX00643527");
    expect(r).toMatchObject({ make: "Toyota", model: "Hilux", country: "Thailand" });
    expect(r.year).toBeNull(); // regional VIN uses 0 at pos.10
  });

  it("South Africa AHTFR → Hilux", () => {
    const r = decodeVin("AHTFR22G106090796");
    expect(r).toMatchObject({ make: "Toyota", model: "Hilux", country: "South Africa" });
  });

  it("Indonesia MHF model prefixes distinguish Innova and Fortuner", () => {
    expect(decodeVin("MHFKW42GGB2194382")).toMatchObject({
      make: "Toyota",
      model: "Innova",
      country: "Indonesia",
    });
    expect(decodeVin("MHFZR69G9B3024738").model).toBe("Fortuner");
  });

  it("Argentina / Brazil / India unknown VDS return conservative plant families", () => {
    expect(decodeVin("8AJZZZZZ0PR123456")).toMatchObject({
      make: "Toyota",
      model: "Hilux / Fortuner",
    });
    expect(decodeVin("9BRZZZZZ0PR123456")).toMatchObject({
      make: "Toyota",
      model: "Corolla / Etios / Yaris",
    });
    expect(decodeVin("MBJZZZZZ0PR123456")).toMatchObject({
      make: "Toyota",
      country: "India",
    });
  });

  it("China Toyota JVs are Toyota, not Volvo", () => {
    expect(decodeVin("LFMZZZZZ0PR123456").make).toBe("Toyota");
    expect(decodeVin("LVGZZZZZ0PR123456").make).toBe("Toyota");
  });

  it("Mexico 3TM / 3MY identify Tacoma and Yaris", () => {
    expect(decodeVin("3TMZZZZZ0PR123456").model).toBe("Tacoma");
    expect(decodeVin("3MYZZZZZ0PR123456").model).toBe("Yaris");
  });

  it("Proace VF1BT is Toyota make; WZ1 Supra is Austria; YAR family is Yaris", () => {
    expect(decodeVin("VF1BT9000PR123456")).toMatchObject({
      make: "Toyota",
      model: "Toyota Proace",
    });
    expect(decodeVin("WZ1ZZZSY0L0123456")).toMatchObject({
      make: "Toyota",
      model: "GR Supra",
      country: "Austria",
    });
    expect(decodeVin("YARZZZZZ0A0123456").model).toBe("Yaris");
  });

  it("Thailand MR0BA3 recall-backed Hilux prefix", () => {
    expect(decodeVin("MR0BA3CD0PR123456").model).toBe("Hilux");
  });
});

describe("Hyundai worldwide QA", () => {
  it("India MAL real i20 prefix", () => {
    const r = decodeVin("MALAN51BLHM692929");
    expect(r).toMatchObject({ make: "Hyundai", model: "i20", country: "India", year: null });
  });

  it("China LBE is Beijing Hyundai, not Mercedes", () => {
    expect(decodeVin("LBEDZZZZ0PR123456")).toMatchObject({
      make: "Hyundai",
      model: "Elantra",
      country: "China",
    });
    expect(decodeVin("LBEJZZZZ0PR123456").model).toBe("Tucson");
  });

  it("Brazil 9BH unknown model remains HB20 / Creta family", () => {
    expect(decodeVin("9BHBG51CAKP035487")).toMatchObject({
      make: "Hyundai",
      model: "HB20 / Creta",
      country: "Brazil",
      year: null,
    });
  });

  it("Indonesia, Russia, Singapore and new US plant WMIs resolve Hyundai", () => {
    expect(decodeVin("MF3ZZZZZ0PR123456")).toMatchObject({
      make: "Hyundai",
      model: "IONIQ 5 / Creta / Stargazer",
      country: "Indonesia",
    });
    expect(decodeVin("Z94ZZZZZ0PR123456")).toMatchObject({
      make: "Hyundai",
      model: "Solaris / Creta",
      country: "Russia",
    });
    expect(decodeVin("PFDZZZZZ0PR123456").make).toBe("Hyundai");
    expect(decodeVin("7YAZZZZZ0PY123456").make).toBe("Hyundai");
  });

  it("LNY remains Yuejin and is not stolen by Hyundai", () => {
    expect(decodeVin("LNYZZZZZ0PR123456").make).toBe("Yuejin");
  });

  it("bare KMHR does not invent Santa Fe (Venue/Palisade/Kona line)", () => {
    // Longer KMHR581/681/281 still resolve; bare KMHR* without those stays null.
    expect(decodeVin("KMHR999BGNU123456").model).toBeNull();
    expect(decodeVin("KMHR281BGNU123456").model).toBe("Venue");
    expect(decodeVin("KMHR681BGNU123456").model).toBe("Kona");
  });

  it("D-line hatch/wagon is i30, sedan stays Elantra", () => {
    // KMHD251 (body '5' = 5-door hatch, i30 diesel) must be i30 GD, not Elantra.
    expect(decodeVin("KMHD251UBEU098635")).toMatchObject({
      make: "Hyundai",
      model: "i30",
      year: 2014,
    });
    // Sedans (body '4') on the D-line remain Elantra.
    expect(decodeVin("KMHD641FBEU123456").model).toBe("Elantra");
    expect(decodeVin("KMHDN41BBFU111111").model).toBe("Elantra");
  });

  it("L-line 2011–2019 is i40 (not Sonata / IONIQ)", () => {
    expect(decodeVin("KMHLC81UADU063188")).toMatchObject({
      make: "Hyundai",
      model: "i40",
      year: 2013,
    });
    expect(decodeVin("KMHLC41UACU005431").model).toBe("i40");
    // MY2020+ L-line Sonata DN8 must not regress to i40.
    expect(decodeVin("KMHL24JJ0LA009507").model).toBe("Sonata");
  });
});
