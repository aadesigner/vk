/** KOTSA / Encar registry field labels that carry odometer readings. */
export const REGISTRY_MILEAGE_FIELD_PATTERN =
  /driving distance|drown distance|drone during|mileage during/i;

export const REGISTRY_AMOUNT_FIELD_PATTERN =
  /repair cost|list price|delivery price|new car shipping/i;

const TYPES_WITHOUT_MILEAGE = new Set([
  "insurance_event",
  "no_insurance",
  "new_car_delivery",
  "registration_change",
]);

export const REGISTRY_TYPES_WITHOUT_MILEAGE = TYPES_WITHOUT_MILEAGE;

export type RegistryLike = {
  type?: string | null;
  mileage?: number | null;
  details?: Array<{ label: string; value: string }> | null;
};

export function hasExplicitRegistryMileage(event: RegistryLike): boolean {
  return (event.details ?? []).some(
    (row) => REGISTRY_MILEAGE_FIELD_PATTERN.test(row.label) && /km/i.test(row.value),
  );
}

export function isRegistryAmountLabel(label: string): boolean {
  return REGISTRY_AMOUNT_FIELD_PATTERN.test(label);
}

export function isRegistryRepairCostLabel(label: string): boolean {
  return /total repair cost/i.test(label);
}

/** Repair payouts above this are almost always new-car list prices mis-tagged by the provider. */
export const MAX_PLAUSIBLE_KRW_REPAIR_PAYOUT = 80_000_000;

/**
 * Floor for accepting a list/delivery price as a real new-car MSRP.
 * Small Korean cars list under ₩15M; volume models are often ₩20–40M.
 */
export const MIN_PLAUSIBLE_NEW_CAR_LIST_KRW = 8_000_000;
export const MAX_PLAUSIBLE_NEW_CAR_LIST_KRW = 500_000_000;

export type KoreanRepairCostParts = {
  partCost?: number | null;
  laborCost?: number | null;
  paintingCost?: number | null;
};

export function koreanRepairComponentSum(parts: KoreanRepairCostParts): number {
  return (parts.partCost ?? 0) + (parts.laborCost ?? 0) + (parts.paintingCost ?? 0);
}

/** Mileage shown on registry cards — only KOTSA fields, never listing odometer leaks. */
export function resolveRegistryDisplayMileage(
  event: RegistryLike,
  opts?: { listingOdometer?: number | null },
): number | null {
  const mileage = event.mileage;
  if (mileage == null || mileage <= 0) return null;

  const type = event.type ?? "other";
  if (TYPES_WITHOUT_MILEAGE.has(type)) return null;

  const explicit = hasExplicitRegistryMileage(event);
  if (!explicit && type !== "inspection" && type !== "owner_change") return null;

  if (opts?.listingOdometer != null && mileage === opts.listingOdometer && !explicit) {
    return null;
  }

  return mileage;
}

/** Provider sometimes sends KRW repair costs as plain digits without "won". */
export function normalizeKrwAmountText(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/won|₩|million/i.test(trimmed)) return trimmed;

  const digits = trimmed.replace(/[^\d]/g, "");
  // 5–8 digits: typical repair band. 9+ digits are usually list prices (100M+ KRW).
  if (/^\d{5,8}$/.test(digits)) {
    const n = Number.parseInt(digits, 10);
    if (n >= 10_000 && n < MAX_PLAUSIBLE_KRW_REPAIR_PAYOUT) {
      return `${n.toLocaleString("en-US")} won`;
    }
  }
  return trimmed;
}

/** Parse KRW from provider text — ignores bare 9–10 digit list-price-scale numbers. */
export function parseKrwAmountFromText(text: string | null | undefined): number | null {
  if (!text) return null;
  const normalized = normalizeKrwAmountText(text) ?? text.trim();

  const million = normalized.match(/([\d.,]+)\s*million\s+won/i);
  if (million) {
    const n = parseFloat(million[1]!.replace(/,/g, ""));
    return Number.isFinite(n) ? Math.round(n * 1_000_000) : null;
  }

  const wonSuffix = normalized.match(/([\d,]+)\s*won/i);
  if (wonSuffix) {
    const n = parseInt(wonSuffix[1]!.replace(/,/g, ""), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  const wonPrefix = normalized.match(/₩\s*([\d,]+)/);
  if (wonPrefix) {
    const n = parseInt(wonPrefix[1]!.replace(/,/g, ""), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  const digits = normalized.replace(/[^\d]/g, "");
  if (/^\d{5,8}$/.test(digits)) {
    const n = Number.parseInt(digits, 10);
    if (n >= 10_000 && n < MAX_PLAUSIBLE_KRW_REPAIR_PAYOUT) return n;
  }

  return null;
}

/**
 * Parse Encar/Carstat new-car list or delivery prices.
 * “19.2 million won” is ₩19.2M. Do not multiply by 10 — that cutoff turned a
 * 2018 Sonata list price into ₩192M while the delivery price next to it stayed ₩20.56M.
 */
export function parseKoreanListPriceKrw(text: string | null | undefined): number | null {
  const base = parseKrwAmountFromText(text);
  if (base == null || base <= 0) return null;

  if (base >= MIN_PLAUSIBLE_NEW_CAR_LIST_KRW && base <= MAX_PLAUSIBLE_NEW_CAR_LIST_KRW) {
    return Math.round(base);
  }

  return base < MIN_PLAUSIBLE_NEW_CAR_LIST_KRW ? null : Math.round(base);
}

/**
 * Older imports multiplied “X million won” by 10 only when that literal was under ₩20M,
 * so a stored list price in [₩150M, ₩200M) is that mistake when list/10 sits next to
 * the sibling delivery price. A real luxury MSRP in that band is not 10× its delivery price.
 */
export function correctCliffScaledKoreanListKrw(
  listKrw: number,
  deliveryKrw: number | null | undefined,
): number {
  if (deliveryKrw == null || !Number.isFinite(deliveryKrw) || deliveryKrw <= 0) return listKrw;
  if (listKrw < 150_000_000 || listKrw >= 200_000_000) return listKrw;
  if (deliveryKrw < MIN_PLAUSIBLE_NEW_CAR_LIST_KRW || deliveryKrw > 80_000_000) return listKrw;
  const undone = Math.round(listKrw / 10);
  if (Math.abs(undone - deliveryKrw) / deliveryKrw <= 0.25) return undone;
  return listKrw;
}

export function correctStoredKoreanNewCarPrices<T extends { label: string; value: string }>(
  rows: T[],
  amount?: string | null,
): { rows: T[]; amount: string | null } {
  const list = rows.find((row) => /new car list price/i.test(row.label));
  const delivery = rows.find((row) => /new car delivery price/i.test(row.label));
  const listKrw = list ? parseKoreanListPriceKrw(list.value) : null;
  const deliveryKrw = delivery ? parseKoreanListPriceKrw(delivery.value) : null;
  const fixed = listKrw != null ? correctCliffScaledKoreanListKrw(listKrw, deliveryKrw) : null;
  if (list == null || fixed == null || fixed === listKrw) {
    return { rows, amount: amount ?? null };
  }
  const value = `${fixed.toLocaleString("en-US")} won`;
  const nextRows = rows.map((row) => (row === list ? { ...row, value } : row));
  const amountKrw = amount ? parseKoreanListPriceKrw(amount) : null;
  const nextAmount = amountKrw != null && amountKrw === listKrw ? value : (amount ?? null);
  return { rows: nextRows, amount: nextAmount };
}

export function formatKoreanListPriceAmountText(text: string | null | undefined): string | null {
  const krw = parseKoreanListPriceKrw(text);
  if (krw == null || krw <= 0) return null;
  return `${krw.toLocaleString("en-US")} won`;
}

/** Display KRW for registry chips — repair vs list price use different sanity rules. */
export function resolveKoreanDisplayKrw(
  text: string | null | undefined,
  label?: string | null,
): number | null {
  if (!text) return null;
  if (label && isRegistryRepairCostLabel(label)) {
    return sanitizeKoreanRepairKrwAmount(parseKrwAmountFromText(text));
  }
  if (label && isRegistryAmountLabel(label) && !isRegistryRepairCostLabel(label)) {
    return parseKoreanListPriceKrw(text);
  }
  if (/million\s+won/i.test(text)) {
    const list = parseKoreanListPriceKrw(text);
    if (list != null) return list;
  }
  const parsed = parseKrwAmountFromText(text);
  if (parsed != null && parsed >= MIN_PLAUSIBLE_NEW_CAR_LIST_KRW) {
    return Math.round(parsed);
  }
  return sanitizeKoreanRepairKrwAmount(parsed);
}

/**
 * Drop or correct implausible Korean repair payouts (e.g. new-car list price in a damage field).
 * When part/labor/paint breakdown exists and is much smaller, prefer that sum.
 */
export function sanitizeKoreanRepairKrwAmount(
  krw: number | null | undefined,
  parts?: KoreanRepairCostParts,
): number | null {
  if (krw == null || !Number.isFinite(krw) || krw <= 0) return null;

  const components = koreanRepairComponentSum(parts ?? {});
  const hasComponents = components > 0;

  if (krw >= MAX_PLAUSIBLE_KRW_REPAIR_PAYOUT) {
    if (hasComponents && components < MAX_PLAUSIBLE_KRW_REPAIR_PAYOUT) return components;
    return null;
  }

  if (hasComponents && krw > components * 8) return components;

  return Math.round(krw);
}

export function sanitizeKoreanRepairAmountText(
  text: string | null | undefined,
  parts?: KoreanRepairCostParts,
): string | null {
  const parsed = parseKrwAmountFromText(text);
  if (parsed == null) return null;
  const sane = sanitizeKoreanRepairKrwAmount(parsed, parts);
  if (sane == null) return null;
  return `${sane.toLocaleString("en-US")} won`;
}

/** Chip/summary amount on registry cards — repair cost only for insurance events. */
export function resolveRegistryDisplayAmount(
  event: RegistryLike & { type?: string | null; amount?: string | null },
): string | null {
  const type = event.type ?? "other";
  const repairRow = (event.details ?? []).find((row) => isRegistryRepairCostLabel(row.label));
  if (repairRow?.value) {
    const sanitized = sanitizeKoreanRepairAmountText(repairRow.value);
    if (sanitized) return sanitized;
  }

  if (type === "insurance_event") return null;

  for (const row of event.details ?? []) {
    if (isRegistryAmountLabel(row.label) && !isRegistryRepairCostLabel(row.label)) {
      return formatKoreanListPriceAmountText(row.value) ?? normalizeKrwAmountText(row.value);
    }
  }

  const raw = event.amount;
  if (!raw) return null;
  if (isRegistryRepairCostLabel(raw)) return sanitizeKoreanRepairAmountText(raw);
  if (type === "new_car_delivery") {
    return formatKoreanListPriceAmountText(raw) ?? normalizeKrwAmountText(raw);
  }
  return normalizeKrwAmountText(raw);
}

/** Encar/Carstat mistranslate 주행거리 (driving distance) as “drone” / “drown”. */
const ENCAR_MILEAGE_TYPO_LINE = /^(?:drone|drown)\s+[\d,.\s]+\s*km$/i;
const ENCAR_MILEAGE_TYPO_FRAGMENT = /\b(?:drone|drown)\s+[\d,.\s]+\s*km\b/gi;

export function isEncarMileageTypoLine(text: string | null | undefined): boolean {
  if (!text) return false;
  return ENCAR_MILEAGE_TYPO_LINE.test(text.trim());
}

/** Drop mileage typo lines mis-assigned as registry event locations. */
export function sanitizeRegistryLocation(location: string | null | undefined): string | null {
  if (!location) return null;
  const trimmed = location.trim();
  if (!trimmed || isEncarMileageTypoLine(trimmed)) return null;
  return trimmed;
}

export function stripRegistrySubtitleNoise(
  subtitle: string | null | undefined,
  mileage: number | null,
): string | null {
  if (!subtitle) return null;
  let text = subtitle;

  if (mileage != null) {
    text = text
      .replace(/^mileage\s+[\d,]+\s*km\s*$/i, "")
      .replace(/^comprehensive examination\s+[\d,]+\s*km(?:\s+of\s+mileage)?\s*$/i, "")
      .replace(/^[\d,]+\s*km\s+of\s+mileage\s*$/i, "");
  }

  text = text
    .replace(ENCAR_MILEAGE_TYPO_FRAGMENT, "")
    .replace(/total\s+[\d.,]+\s+(?:million\s+)?won/gi, "")
    .replace(/\s*·\s*·+\s*/g, " · ")
    .replace(/^\s*·\s*|\s*·\s*$/g, "")
    .trim();

  return text || null;
}
