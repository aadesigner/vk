import { decodeVin, isPlausibleMake } from "@workspace/vin-decode";

const PAYPAL_ITEM_NAME_MAX = 127;

/** Last 5 VIN characters (letters and numbers). */
function vinTail5(vin: string): string {
  const nvin = vin.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (nvin.length >= 5) return nvin.slice(-5);
  return nvin || "VIN";
}

/** ASCII-only brand. Keep the same character set as the old "VIN Report - {VIN}" labels. */
function safeMake(raw: string | null | undefined, vin: string): string | null {
  if (!raw || !isPlausibleMake(raw, vin)) return null;
  const cleaned = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 2 || cleaned.length > 32) return null;
  return cleaned;
}

function clipLabel(label: string): string {
  if (label.length <= PAYPAL_ITEM_NAME_MAX) return label;
  return label.slice(0, PAYPAL_ITEM_NAME_MAX).trimEnd();
}

/**
 * PayPal / POK checkout line only.
 * Format: `VIN - Make *TAIL` (no parentheses). Never throws.
 */
export function vinReportPaymentLabel(vin: string): string {
  const nvin = vin.trim().toUpperCase();
  const tail = vinTail5(nvin);
  const fallback = clipLabel(`VIN - *${tail}`);
  try {
    const make = safeMake(decodeVin(nvin).make, nvin);
    if (!make) return fallback;
    return clipLabel(`VIN - ${make} *${tail}`);
  } catch {
    return fallback;
  }
}
