/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import {
  buildPokPaymentInitialState,
  isPokCountryFieldLabel,
  isPokRequiredUsCaFieldLabel,
  isPokUsCaBillingExtraLabel,
  openPokUsCaBillingIfNeeded,
  pokCountryRequiresBillingExtras,
  pokPrefillCountryCode,
  shouldHidePokOptionalField,
  syncPokGuestVisibleFields,
} from "./pok-guest-fields";

describe("buildPokPaymentInitialState", () => {
  it("sends every POK form field as a string (SDK does not merge partial initialState)", () => {
    const state = buildPokPaymentInitialState({
      email: "a@b.com",
      name: "Ada Lovelace",
      countryCode: "de",
    });
    expect(state).toEqual({
      cardNumber: "",
      email: "a@b.com",
      expiration: "",
      securityCode: "",
      holdersName: "Ada Lovelace",
      countryCode: "DE",
      address1: "",
      locality: "",
      administrativeArea: "",
      postalCode: "",
      phoneNumber: "",
    });
  });

  it("prefills US/CA as-is and does not invent AL when country is unset", () => {
    expect(buildPokPaymentInitialState({ countryCode: "US" }).countryCode).toBe("US");
    expect(buildPokPaymentInitialState({ countryCode: "ca" }).countryCode).toBe("CA");
    expect(buildPokPaymentInitialState({ countryCode: null }).countryCode).toBe("");
    expect(buildPokPaymentInitialState({}).countryCode).toBe("");
    expect(buildPokPaymentInitialState({ countryCode: "XK" }).countryCode).toBe("XK");
  });
});

describe("pokPrefillCountryCode", () => {
  it("sends the profile country including US/CA (does not remap to AL)", () => {
    expect(pokPrefillCountryCode("de")).toBe("DE");
    expect(pokPrefillCountryCode("US")).toBe("US");
    expect(pokPrefillCountryCode("ca")).toBe("CA");
    expect(pokPrefillCountryCode("XK")).toBe("XK");
  });

  it("omits country when the profile has none so POK can require a choice", () => {
    expect(pokPrefillCountryCode(null)).toBeUndefined();
    expect(pokPrefillCountryCode("")).toBeUndefined();
    expect(pokPrefillCountryCode("  ")).toBeUndefined();
    expect(pokPrefillCountryCode("ZZ")).toBeUndefined();
  });
});

describe("POK field labels", () => {
  it("does not treat Albanian State/Province as the Country field", () => {
    expect(isPokCountryFieldLabel("Country")).toBe(true);
    expect(isPokCountryFieldLabel("Paese")).toBe(true);
    expect(isPokCountryFieldLabel("Shteti")).toBe(true);
    expect(isPokCountryFieldLabel("Shteti/Provinca")).toBe(false);
    expect(isPokRequiredUsCaFieldLabel("Shteti/Provinca")).toBe(true);
    expect(isPokUsCaBillingExtraLabel("Qyteti")).toBe(true);
    expect(isPokUsCaBillingExtraLabel("Kodi Postar")).toBe(true);
  });

  it("does not hide POK's US/CA required extras", () => {
    expect(isPokRequiredUsCaFieldLabel("State/Province")).toBe(true);
    expect(isPokRequiredUsCaFieldLabel("ZIP Code")).toBe(true);
    expect(isPokRequiredUsCaFieldLabel("CAP")).toBe(true);
    expect(isPokRequiredUsCaFieldLabel("Kodi postar")).toBe(true);
    expect(shouldHidePokOptionalField("State/Province")).toBe(false);
    expect(shouldHidePokOptionalField("ZIP Code")).toBe(false);
  });

  it("hides Add billing copy; address extras are shown only while US/CA billing is open", () => {
    expect(shouldHidePokOptionalField("Add billing info")).toBe(true);
    expect(shouldHidePokOptionalField("Card number")).toBe(false);
    expect(isPokUsCaBillingExtraLabel("Address")).toBe(true);
    expect(isPokUsCaBillingExtraLabel("City")).toBe(true);
    expect(isPokUsCaBillingExtraLabel("Phone")).toBe(true);
    expect(isPokUsCaBillingExtraLabel("State/Province")).toBe(true);
  });
});

describe("pokCountryRequiresBillingExtras", () => {
  it("is only US and CA", () => {
    expect(pokCountryRequiresBillingExtras("US")).toBe(true);
    expect(pokCountryRequiresBillingExtras("CA")).toBe(true);
    expect(pokCountryRequiresBillingExtras("AL")).toBe(false);
    expect(pokCountryRequiresBillingExtras(undefined)).toBe(false);
  });
});

describe("openPokUsCaBillingIfNeeded", () => {
  it("clicks the disabled US/CA billing checkbox once so State/ZIP can render", () => {
    const root = document.createElement("div");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.id = "addBillingCheckbox";
    box.disabled = true;
    let clicks = 0;
    box.addEventListener("click", () => {
      clicks += 1;
      box.checked = true;
    });
    root.appendChild(box);

    expect(openPokUsCaBillingIfNeeded(root, "US", false)).toBe(true);
    expect(clicks).toBe(1);
    expect(box.checked).toBe(true);
    expect(openPokUsCaBillingIfNeeded(root, "US", true)).toBe(false);
    expect(clicks).toBe(1);
  });

  it("does not click for a non-US/CA prefill", () => {
    const root = document.createElement("div");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.id = "addBillingCheckbox";
    root.appendChild(box);
    expect(openPokUsCaBillingIfNeeded(root, "DE", false)).toBe(false);
    expect(box.checked).toBe(false);
  });
});

describe("syncPokGuestVisibleFields", () => {
  it("leaves Country visible and hides address when US/CA extras are closed", () => {
    const root = document.createElement("div");
    const country = document.createElement("div");
    country.className = "pok-payment-relative";
    country.innerHTML = '<span class="pok-payment-label">Country *</span>';
    const address = document.createElement("div");
    address.className = "pok-payment-relative";
    address.innerHTML = '<span class="pok-payment-label">Address</span>';
    root.append(country, address);

    const next = syncPokGuestVisibleFields(root, "AL", { billingClickAttempted: false });

    expect(next.billingClickAttempted).toBe(false);
    expect(country.getAttribute("data-verifykm-pok-hidden")).toBeNull();
    expect(address.getAttribute("data-verifykm-pok-hidden")).toBe("1");
    expect(address.style.display).toBe("none");
  });

  it("unhides a Country row that was previously forced hidden", () => {
    const root = document.createElement("div");
    const country = document.createElement("div");
    country.className = "pok-payment-relative";
    country.setAttribute("data-verifykm-pok-hidden", "1");
    country.style.display = "none";
    country.innerHTML = '<span class="pok-payment-label">Country</span>';
    root.append(country);

    syncPokGuestVisibleFields(root, undefined, { billingClickAttempted: false });

    expect(country.getAttribute("data-verifykm-pok-hidden")).toBeNull();
    expect(country.style.display).toBe("");
  });

  it("does not hide State/ZIP when POK has opened US billing extras", () => {
    const root = document.createElement("div");
    const state = document.createElement("div");
    state.className = "pok-payment-relative";
    state.innerHTML = '<span class="pok-payment-label">State/Province *</span>';
    const zip = document.createElement("div");
    zip.className = "pok-payment-relative";
    zip.innerHTML = '<span class="pok-payment-label">ZIP Code *</span>';
    root.append(state, zip);

    syncPokGuestVisibleFields(root, "US", { billingClickAttempted: true });

    expect(state.getAttribute("data-verifykm-pok-hidden")).toBeNull();
    expect(zip.getAttribute("data-verifykm-pok-hidden")).toBeNull();
  });

  it("shows address/city/phone while US/CA extras are open, and hides them when they are not", () => {
    const root = document.createElement("div");
    const address = document.createElement("div");
    address.className = "pok-payment-relative";
    address.innerHTML = '<span class="pok-payment-label">Address</span>';
    const city = document.createElement("div");
    city.className = "pok-payment-relative";
    city.innerHTML = '<span class="pok-payment-label">City</span>';
    const phone = document.createElement("div");
    phone.className = "pok-payment-relative";
    phone.innerHTML = '<span class="pok-payment-label">Phone</span>';
    root.append(address, city, phone);

    syncPokGuestVisibleFields(root, "DE", { billingClickAttempted: false });
    expect(address.getAttribute("data-verifykm-pok-hidden")).toBe("1");
    expect(city.getAttribute("data-verifykm-pok-hidden")).toBe("1");
    expect(phone.getAttribute("data-verifykm-pok-hidden")).toBe("1");

    const state = document.createElement("div");
    state.className = "pok-payment-relative";
    state.innerHTML = '<span class="pok-payment-label">State/Province *</span>';
    root.append(state);

    syncPokGuestVisibleFields(root, "US", { billingClickAttempted: true });
    expect(address.getAttribute("data-verifykm-pok-hidden")).toBeNull();
    expect(city.getAttribute("data-verifykm-pok-hidden")).toBeNull();
    expect(phone.getAttribute("data-verifykm-pok-hidden")).toBeNull();
    expect(address.style.display).toBe("");
  });

  it("shows Qyteti next to Kodi Postar for US instead of leaving ZIP alone on the right", () => {
    const root = document.createElement("div");
    const row = document.createElement("div");
    row.className = "pok-payment-input-row";
    const cityWrap = document.createElement("div");
    const city = document.createElement("div");
    city.className = "pok-payment-relative";
    city.innerHTML = '<span class="pok-payment-label">Qyteti</span>';
    cityWrap.append(city);
    const zipWrap = document.createElement("div");
    const zip = document.createElement("div");
    zip.className = "pok-payment-relative";
    zip.innerHTML = '<span class="pok-payment-label">Kodi Postar *</span>';
    zipWrap.append(zip);
    row.append(cityWrap, zipWrap);
    root.append(row);

    syncPokGuestVisibleFields(root, "US", { billingClickAttempted: true });
    expect(city.getAttribute("data-verifykm-pok-hidden")).toBeNull();
    expect(zip.getAttribute("data-verifykm-pok-hidden")).toBeNull();
    expect(cityWrap.getAttribute("data-verifykm-pok-hidden")).toBeNull();
    expect(zipWrap.getAttribute("data-verifykm-pok-hidden")).toBeNull();
  });

  it("hides the extra POK wrapper around a 2-col field, not only the inner input", () => {
    const root = document.createElement("div");
    const row = document.createElement("div");
    row.className = "pok-payment-input-row";
    const cityWrap = document.createElement("div");
    const city = document.createElement("div");
    city.className = "pok-payment-relative";
    city.innerHTML = '<span class="pok-payment-label">Qyteti</span>';
    cityWrap.append(city);
    const phoneWrap = document.createElement("div");
    const phone = document.createElement("div");
    phone.className = "pok-payment-relative";
    phone.innerHTML = '<span class="pok-payment-label">Telefoni</span>';
    phoneWrap.append(phone);
    row.append(cityWrap, phoneWrap);
    root.append(row);

    syncPokGuestVisibleFields(root, "AL", { billingClickAttempted: false });
    expect(cityWrap.getAttribute("data-verifykm-pok-hidden")).toBe("1");
    expect(phoneWrap.getAttribute("data-verifykm-pok-hidden")).toBe("1");
    expect(cityWrap.style.display).toBe("none");
  });
});
