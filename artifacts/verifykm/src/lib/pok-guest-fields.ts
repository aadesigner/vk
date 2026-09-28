import { parseUserCountryCode } from "@/lib/user-countries";

/** Hidden unless US/CA billing extras are open. */
const POK_BILLING_EXTRA_RE =
  /^(indirizzo|adresa|address|stato\/provincia|shteti\/provinca|state\/province|stato|provinca|state|città|qyteti|city|cap|zip(?: code)?|kodi postar|telefono|phone|telefoni)$/i;

const POK_ADD_BILLING_RE = /^(add billing|aggiungi|shto informacion)/i;

const POK_HIDDEN_ATTR = "data-verifykm-pok-hidden";

const POK_EMPTY_FORM = {
  cardNumber: "",
  email: "",
  expiration: "",
  securityCode: "",
  holdersName: "",
  countryCode: "",
  address1: "",
  locality: "",
  administrativeArea: "",
  postalCode: "",
  phoneNumber: "",
} as const;

export type PokPaymentInitialState = {
  cardNumber: string;
  email: string;
  expiration: string;
  securityCode: string;
  holdersName: string;
  countryCode: string;
  address1: string;
  locality: string;
  administrativeArea: string;
  postalCode: string;
  phoneNumber: string;
};

export type PokGuestFieldSyncState = {
  billingClickAttempted: boolean;
};

export function pokPrefillCountryCode(profileCountry: string | null | undefined): string | undefined {
  return parseUserCountryCode(profileCountry) ?? undefined;
}

/**
 * Full POK PaymentFormData. The SDK does `initialState || defaults` (no merge),
 * so a partial object would leave card/country fields as undefined.
 */
export function buildPokPaymentInitialState(input: {
  email?: string | null;
  name?: string | null;
  countryCode?: string | null;
}): PokPaymentInitialState {
  const email = input.email?.trim() || "";
  const countryCode = pokPrefillCountryCode(input.countryCode) ?? "";
  const fromEmail = email.includes("@")
    ? email.split("@")[0]!.replace(/[._+]/g, " ").trim()
    : "";
  const holdersName = input.name?.trim() || fromEmail || "Cardholder";
  return {
    ...POK_EMPTY_FORM,
    email,
    holdersName,
    countryCode,
  };
}

/** POK requires State/Province + ZIP (and shows address extras) for US or CA. */
export function pokCountryRequiresBillingExtras(countryCode: string | null | undefined): boolean {
  const code = (countryCode ?? "").trim().toUpperCase();
  return code === "US" || code === "CA";
}

export function pokFieldLabel(text: string): string {
  return text.replace(/\*/g, " ").replace(/\s+/g, " ").trim();
}

export function isPokCountryFieldLabel(label: string): boolean {
  return /^(paese|shteti|country)$/i.test(label);
}

export function isPokRequiredUsCaFieldLabel(label: string): boolean {
  return /^(stato\/provincia|shteti\/provinca|state\/province|stato|provinca|state|cap|zip(?: code)?|kodi postar)$/i.test(label);
}

export function isPokUsCaBillingExtraLabel(label: string): boolean {
  return POK_BILLING_EXTRA_RE.test(label);
}

export function shouldHidePokOptionalField(label: string): boolean {
  if (!label) return false;
  if (isPokCountryFieldLabel(label)) return false;
  return POK_ADD_BILLING_RE.test(label);
}

export function pokBillingExtrasVisible(root: HTMLElement): boolean {
  for (const el of root.querySelectorAll(".pok-payment-label")) {
    if (isPokRequiredUsCaFieldLabel(pokFieldLabel(el.textContent ?? ""))) return true;
  }
  return false;
}

/**
 * POK wraps each `.pok-payment-relative` in an extra `<div>`. City + ZIP sit in a
 * 2-col grid of those wrappers — hiding only the inner field leaves an empty left cell
 * and parks ZIP on the right.
 */
function pokFieldHideTarget(row: HTMLElement): HTMLElement {
  const parent = row.parentElement;
  if (
    parent instanceof HTMLElement &&
    parent.parentElement?.classList.contains("pok-payment-input-row")
  ) {
    return parent;
  }
  return row;
}

function hideOne(el: HTMLElement): void {
  if (el.getAttribute(POK_HIDDEN_ATTR) === "1") return;
  el.style.display = "none";
  el.setAttribute(POK_HIDDEN_ATTR, "1");
}

function revealOne(el: HTMLElement): void {
  if (el.getAttribute(POK_HIDDEN_ATTR) !== "1") return;
  el.style.display = "";
  el.removeAttribute(POK_HIDDEN_ATTR);
}

function hidePokRow(row: HTMLElement): void {
  const target = pokFieldHideTarget(row);
  hideOne(target);
  if (target !== row) hideOne(row);
}

function revealPokRow(row: HTMLElement): void {
  const target = pokFieldHideTarget(row);
  revealOne(target);
  if (target !== row) revealOne(row);
}

function isPokChromeRow(row: HTMLElement): boolean {
  return !!row.closest(
    ".pok-payment-options, .pok-payment-modal, .pok-payment-modal-backdrop, .pok-payment-info-container",
  );
}

/**
 * POK starts "Add billing info" collapsed. Prefilling US/CA does not open it, and the
 * checkbox is then disabled — click it once (never twice: that would close it again).
 * User picks of US/CA are handled by the SDK itself.
 */
export function openPokUsCaBillingIfNeeded(
  root: HTMLElement,
  prefillCountry: string | undefined,
  clickAttempted: boolean,
): boolean {
  if (clickAttempted || !pokCountryRequiresBillingExtras(prefillCountry)) return false;
  const box = root.querySelector<HTMLInputElement>("#addBillingCheckbox");
  if (!box) return false;
  if (box.checked) return false;
  box.disabled = false;
  box.click();
  return true;
}

/**
 * Country always visible. US/CA extras (address, state, ZIP, city, phone) stay open
 * while POK has expanded billing; they hide again when billing collapses.
 */
export function syncPokGuestVisibleFields(
  root: HTMLElement,
  prefillCountry: string | undefined,
  state: PokGuestFieldSyncState,
): PokGuestFieldSyncState {
  const extrasVisible = pokBillingExtrasVisible(root);
  const box = root.querySelector<HTMLInputElement>("#addBillingCheckbox");
  const extrasOpen = extrasVisible || !!box?.checked;
  let billingClickAttempted = state.billingClickAttempted || extrasOpen;

  if (!extrasOpen) {
    if (openPokUsCaBillingIfNeeded(root, prefillCountry, billingClickAttempted)) {
      billingClickAttempted = true;
    }
  }

  root.querySelectorAll<HTMLElement>(".pok-payment-relative").forEach((row) => {
    if (isPokChromeRow(row)) return;
    const label = pokFieldLabel(row.querySelector(".pok-payment-label")?.textContent ?? "");
    if (!label) return;
    if (isPokCountryFieldLabel(label)) {
      revealPokRow(row);
      return;
    }
    if (isPokUsCaBillingExtraLabel(label)) {
      if (extrasOpen) revealPokRow(row);
      else hidePokRow(row);
      return;
    }
    if (shouldHidePokOptionalField(label)) hidePokRow(row);
  });

  const billing = box?.closest(".pok-payment-checkbox-container")
    ?? root.querySelector<HTMLElement>(".pok-payment-checkbox-container");
  if (billing) {
    const wrap = billing.parentElement instanceof HTMLElement ? billing.parentElement : billing;
    hidePokRow(wrap);
  }

  return { billingClickAttempted };
}
