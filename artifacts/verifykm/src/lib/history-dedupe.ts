/**
 * Collapse duplicate timeline rows across VIN report cards.
 * Keys normalize dates so "April 16, 2019" and "2019-04-16" match.
 */

import { sanitizeReportIsoDate } from "@/lib/encar-date-repair";

function normalizeToken(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizedDateKey(
  date: string | null | undefined,
  vehicleYear?: number | null,
): string {
  return sanitizeReportIsoDate(date, vehicleYear)?.slice(0, 10)
    ?? normalizeToken(date);
}

function pickLongerText(
  a: string | null | undefined,
  b: string | null | undefined,
): string | null | undefined {
  if (!a) return b;
  if (!b) return a;
  return a.length >= b.length ? a : b;
}

function mergeDefinedFields<T extends Record<string, unknown>>(a: T, b: T): T {
  return {
    ...a,
    ...b,
    date: (a.date as string | null | undefined) || (b.date as string | null | undefined),
    location: pickLongerText(
      a.location as string | null | undefined,
      b.location as string | null | undefined,
    ),
    lotStatus: pickLongerText(
      a.lotStatus as string | null | undefined,
      b.lotStatus as string | null | undefined,
    ),
    condition: pickLongerText(
      a.condition as string | null | undefined,
      b.condition as string | null | undefined,
    ),
    mileage: (a.mileage as number | null | undefined) ?? (b.mileage as number | null | undefined),
    auctionPrice: (a.auctionPrice as number | null | undefined) ?? (b.auctionPrice as number | null | undefined),
    odometer: (a.odometer as number | null | undefined) ?? (b.odometer as number | null | undefined),
    subtitle: pickLongerText(
      a.subtitle as string | null | undefined,
      b.subtitle as string | null | undefined,
    ),
    amount: pickLongerText(
      a.amount as string | null | undefined,
      b.amount as string | null | undefined,
    ),
    description: pickLongerText(
      a.description as string | null | undefined,
      b.description as string | null | undefined,
    ),
    details: ((a.details as unknown[] | undefined)?.length ?? 0) >= ((b.details as unknown[] | undefined)?.length ?? 0)
      ? a.details
      : b.details,
  };
}

function richnessScore(entry: Record<string, unknown>): number {
  let score = 0;
  for (const value of Object.values(entry)) {
    if (value == null || value === "") continue;
    if (Array.isArray(value)) score += value.length * 2;
    else score += 1;
  }
  return score;
}

function dedupeByKey<T extends Record<string, unknown>>(
  entries: T[],
  keyFn: (entry: T) => string,
  merge?: (a: T, b: T) => T,
): T[] {
  const byKey = new Map<string, T>();
  for (const entry of entries) {
    const key = keyFn(entry);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, entry);
      continue;
    }
    if (merge) {
      byKey.set(key, merge(existing, entry));
    } else {
      byKey.set(key, richnessScore(entry) >= richnessScore(existing) ? entry : existing);
    }
  }
  return Array.from(byKey.values());
}

export type OwnerHistoryLike = {
  date?: string | null;
  location?: string | null;
  mileage?: number | null;
  auctionPrice?: number | null;
  lotStatus?: string | null;
  condition?: string | null;
};

export function ownerHistoryDedupeKey(
  entry: OwnerHistoryLike,
  vehicleYear?: number | null,
): string {
  const date = normalizedDateKey(entry.date, vehicleYear);
  if (date && entry.mileage != null && entry.mileage > 0) {
    return `dm:${date}|${entry.mileage}`;
  }
  if (date) {
    const status = normalizeToken(entry.lotStatus);
    const location = normalizeToken(entry.location);
    const price = entry.auctionPrice ?? "";
    return `d:${date}|${status}|${location}|${price}`;
  }
  const status = normalizeToken(entry.lotStatus);
  const location = normalizeToken(entry.location);
  if (status || location || entry.mileage != null) {
    return `ctx:${status}|${location}|${entry.mileage ?? ""}`;
  }
  return `raw:${JSON.stringify(entry)}`;
}

export function dedupeOwnerHistory<T extends OwnerHistoryLike>(
  entries: T[],
  vehicleYear?: number | null,
): T[] {
  return dedupeByKey(
    entries,
    (entry) => ownerHistoryDedupeKey(entry, vehicleYear),
    (a, b) => mergeDefinedFields(a, b),
  );
}

export type MileageHistoryLike = {
  date?: string | null;
  odometer?: number | null;
  condition?: string | null;
  damage?: string | null;
  primaryDamage?: string | null;
  secondaryDamage?: string | null;
  auctionPrice?: number | null;
  lotStatus?: string | null;
  titleStatus?: string | null;
  location?: string | null;
  description?: string | null;
};

export function mileageHistoryDedupeKey(
  entry: MileageHistoryLike,
  vehicleYear?: number | null,
): string {
  const date = normalizedDateKey(entry.date, vehicleYear);
  const odometer = entry.odometer ?? -1;
  const primary = normalizeToken(entry.primaryDamage);
  return `${date}|${odometer}|${primary}`;
}

export function dedupeMileageHistory<T extends MileageHistoryLike>(
  entries: T[],
  vehicleYear?: number | null,
): T[] {
  return dedupeByKey(entries, (entry) => mileageHistoryDedupeKey(entry, vehicleYear));
}

export type AuctionHistoryLike = {
  date?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  condition?: string | null;
  damage?: string | null;
  primaryDamage?: string | null;
  secondaryDamage?: string | null;
  titleStatus?: string | null;
  openingBid?: number | null;
  buyNowPrice?: number | null;
  finalPrice?: number | null;
  lotStatus?: string | null;
};

export function auctionHistoryDedupeKey(
  entry: AuctionHistoryLike,
  vehicleYear?: number | null,
): string {
  const date = normalizedDateKey(entry.date, vehicleYear);
  const city = normalizeToken(entry.city);
  const state = normalizeToken(entry.state);
  const country = normalizeToken(entry.country);
  const finalPrice = entry.finalPrice ?? -1;
  const primary = normalizeToken(entry.primaryDamage);
  return `${date}|${city}|${state}|${country}|${finalPrice}|${primary}`;
}

export function dedupeAuctionHistory<T extends AuctionHistoryLike>(
  entries: T[],
  vehicleYear?: number | null,
): T[] {
  return dedupeByKey(entries, (entry) => auctionHistoryDedupeKey(entry, vehicleYear));
}

export type AccidentLike = {
  date?: string | null;
  severity?: string | null;
  type?: string | null;
  country?: string | null;
  primaryDamage?: string | null;
  secondaryDamage?: string | null;
  lossAmount?: number | null;
  currency?: string | null;
  odometerAtLoss?: number | null;
  airbagDeployed?: boolean | null;
  description?: string | null;
};

export function accidentDedupeKey(
  entry: AccidentLike,
  vehicleYear?: number | null,
): string {
  const date = normalizedDateKey(entry.date, vehicleYear);
  const type = normalizeToken(entry.type);
  const loss = entry.lossAmount ?? 0;
  const desc = normalizeToken(entry.description).slice(0, 48);
  const primary = normalizeToken(entry.primaryDamage);
  const odometer = entry.odometerAtLoss ?? -1;
  return `${date}|${type}|${loss}|${desc}|${primary}|${odometer}`;
}

export function dedupeAccidents<T extends AccidentLike>(
  entries: T[],
  vehicleYear?: number | null,
): T[] {
  return dedupeByKey(entries, (entry) => accidentDedupeKey(entry, vehicleYear));
}

export type InsuranceClaimLike = {
  date?: string | null;
  type?: string | null;
  lossAmount?: number | null;
  currency?: string | null;
  partCost?: number | null;
  laborCost?: number | null;
  paintingCost?: number | null;
  description?: string | null;
};

export function insuranceClaimDedupeKey(
  entry: InsuranceClaimLike,
  vehicleYear?: number | null,
): string {
  const date = normalizedDateKey(entry.date, vehicleYear);
  const type = normalizeToken(entry.type);
  const loss = entry.lossAmount ?? 0;
  const part = entry.partCost ?? 0;
  const labor = entry.laborCost ?? 0;
  const paint = entry.paintingCost ?? 0;
  return `${date}|${type}|${loss}|${part}|${labor}|${paint}`;
}

export function dedupeInsuranceClaims<T extends InsuranceClaimLike>(
  entries: T[],
  vehicleYear?: number | null,
): T[] {
  return dedupeByKey(entries, (entry) => insuranceClaimDedupeKey(entry, vehicleYear));
}

export type ServiceHistoryLike = {
  date?: string | null;
  mileage?: number | null;
  title?: string | null;
  location?: string | null;
  description?: string | null;
  details?: Array<{ label: string; value: string }>;
};

/** Provider record ids like "record #8026005635" — strongest merge key. */
export function extractServiceRecordId(
  ...texts: Array<string | null | undefined>
): string | null {
  for (const text of texts) {
    if (!text) continue;
    const m = text.match(/record\s*#\s*(\d{5,})/i) ?? text.match(/#(\d{7,})/);
    if (m?.[1]) return m[1];
  }
  return null;
}

function serviceTitleCore(title: string | null | undefined): string {
  const t = normalizeToken(title);
  if (!t) return "";
  if (/korean\s+performance\s+inspection/.test(t)) return "korean_performance_inspection";
  // Drop em-dash tails so slight field differences don't fork the key.
  return t
    .replace(/\s*[—–]\s*record\s*#\d+.*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function serviceHistoryDedupeKey(
  entry: ServiceHistoryLike,
  vehicleYear?: number | null,
): string {
  const detailText = (entry.details ?? []).flatMap((d) => [d.label, d.value]);
  const recordId = extractServiceRecordId(entry.title, entry.description, ...detailText);
  if (recordId) return `rec:${recordId}`;

  const date = normalizedDateKey(entry.date, vehicleYear);
  const mileage = entry.mileage ?? -1;
  const core = serviceTitleCore(entry.title);
  if (core === "korean_performance_inspection" && date && mileage > 0) {
    return `kpi:${date}|${mileage}`;
  }
  const location = normalizeToken(entry.location);
  return `${date}|${core || normalizeToken(entry.title)}|${mileage}|${location}`;
}

function mergeServiceHistoryEntries<T extends ServiceHistoryLike>(a: T, b: T): T {
  const merged = mergeDefinedFields(
    a as T & Record<string, unknown>,
    b as T & Record<string, unknown>,
  ) as T;
  return {
    ...merged,
    title: pickLongerText(a.title, b.title) ?? merged.title,
    description: pickLongerText(a.description, b.description) ?? merged.description,
    mileage: a.mileage ?? b.mileage ?? null,
  };
}

export function dedupeServiceHistory<T extends ServiceHistoryLike>(
  entries: T[],
  vehicleYear?: number | null,
): T[] {
  return dedupeByKey(
    entries as Array<T & Record<string, unknown>>,
    (entry) => serviceHistoryDedupeKey(entry, vehicleYear),
    (a, b) => mergeServiceHistoryEntries(a as T, b as T) as T & Record<string, unknown>,
  ) as T[];
}

export type RegistryHistoryLike = {
  date?: string | null;
  type?: string | null;
  title?: string | null;
  subtitle?: string | null;
  mileage?: number | null;
  amount?: string | null;
  location?: string | null;
  details?: Array<{ label: string; value: string }>;
};

function registryEventRichness(event: RegistryHistoryLike): number {
  let score = 0;
  if (event.date) score += 4;
  if (event.subtitle) score += 2;
  if (event.amount) score += 2;
  if (event.location) score += 1;
  score += event.details?.length ?? 0;
  if (event.mileage != null) score += 1;
  return score;
}

export function registryHistoryDedupeKey(
  event: RegistryHistoryLike,
  vehicleYear?: number | null,
): string {
  const title = normalizeToken(event.title).slice(0, 80);
  const date = normalizedDateKey(event.date, vehicleYear);
  const type = event.type ?? "other";
  const mileage = event.mileage ?? -1;
  const amount = normalizeToken(event.amount).slice(0, 48);
  // Empty same-day shells (no title/mileage/amount) collapse regardless of type.
  if (!title && mileage < 0 && !amount) {
    return `empty|${date}`;
  }
  return `${type}|${date}|${title}|${mileage}|${amount}`;
}

export function dedupeRegistryHistory<T extends RegistryHistoryLike>(
  events: T[],
  vehicleYear?: number | null,
): T[] {
  const byKey = new Map<string, T>();
  for (const event of events) {
    const key = registryHistoryDedupeKey(event, vehicleYear);
    const existing = byKey.get(key);
    if (!existing || registryEventRichness(event) > registryEventRichness(existing)) {
      byKey.set(key, event);
    }
  }
  return Array.from(byKey.values());
}
