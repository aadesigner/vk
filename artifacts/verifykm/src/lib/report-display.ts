/**
 * Shared rules for VIN report UI: hide fields/sections when the provider
 * has no real value (null, "No information", empty strings, etc.).
 */

import { isRecallRegistryEvent } from "@/lib/registry-history";
import { sanitizeReportIsoDate } from "@/lib/encar-date-repair";
import { isKoreanSourcedAccidentType, normalizeAmountCurrency } from "@/lib/korean-currency";
import {
  normalizeKrwAmountText,
  resolveRegistryDisplayMileage,
  resolveRegistryDisplayAmount,
  sanitizeKoreanRepairAmountText,
  formatKoreanListPriceAmountText,
  isRegistryRepairCostLabel,
  sanitizeKoreanRepairKrwAmount,
  stripRegistrySubtitleNoise,
  sanitizeRegistryLocation,
} from "@workspace/korean-registry";
import {
  dedupeAccidents,
  dedupeAuctionHistory,
  dedupeInsuranceClaims,
  dedupeMileageHistory,
  dedupeOwnerHistory,
  dedupeRegistryHistory,
  dedupeServiceHistory,
  type AccidentLike,
  type AuctionHistoryLike,
  type InsuranceClaimLike,
  type MileageHistoryLike,
  type OwnerHistoryLike,
  type RegistryHistoryLike,
  type ServiceHistoryLike,
} from "@/lib/history-dedupe";

export type { AccidentLike, AuctionHistoryLike, InsuranceClaimLike, MileageHistoryLike, OwnerHistoryLike, RegistryHistoryLike, ServiceHistoryLike };

const EXACT_NON_VALUES = new Set([
  "no information",
  "n/a",
  "na",
  "none",
  "unknown",
  "not available",
  "not applicable",
  "—",
  "-",
  "[object object]",
]);

export function isDisplayableValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  const s = String(value).trim();
  if (!s) return false;
  if (EXACT_NON_VALUES.has(s.toLowerCase())) return false;
  if (/^no\s+.+\s+information$/i.test(s)) return false;
  return true;
}

/** Returns cleaned text or null when not displayable. */
export function cleanDisplayText(value: string | null | undefined): string | null {
  if (!isDisplayableValue(value)) return null;
  const raw = String(value).trim();
  if (!raw.includes("\n")) return raw;

  const lines = raw
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => isDisplayableValue(line));
  if (lines.length === 0) return null;
  return lines.join(" · ");
}

/** Alias used by report pages (replaces legacy cleanStr). */
export function cleanDisplayStr(value: string | null | undefined): string | null {
  return cleanDisplayText(value);
}

export type RegistryDetailRow = { label: string; value: string };

export function sanitizeRegistryDetailRows(
  rows: RegistryDetailRow[] | null | undefined,
): RegistryDetailRow[] {
  return (rows ?? []).filter((row) => isDisplayableValue(row.value));
}

export function sanitizeRegistryHistoryEvent<T extends RegistryHistoryLike>(
  event: T,
  opts?: { listingOdometer?: number | null },
): T | null {
  const details = sanitizeRegistryDetailRows(event.details)?.map((row) => ({
    ...row,
    value: isRegistryRepairCostLabel(row.label)
      ? (sanitizeKoreanRepairAmountText(row.value) ?? row.value)
      : isRegistryAmountDetailRow(row.label)
        ? (formatKoreanListPriceAmountText(row.value)
          ?? normalizeKrwAmountText(row.value)
          ?? row.value)
        : row.value,
  }));
  const amount = resolveRegistryDisplayAmount({ ...event, details });
  const location = sanitizeRegistryLocation(cleanDisplayText(event.location));
  const date = cleanDisplayText(event.date);
  const title = cleanDisplayText(event.title);

  const displayMileage = resolveRegistryDisplayMileage(
    { ...event, details },
    { listingOdometer: opts?.listingOdometer },
  );

  let subtitle = stripRegistrySubtitleNoise(cleanDisplayText(event.subtitle), displayMileage);

  const titleIsGeneric = !title || /^(event|no information|n\/a|unknown|-|registry event)$/i.test(title);
  const typeIsGeneric = !event.type || /^(event|other|unknown)$/i.test(String(event.type));
  const hasMeaningfulContent = Boolean(
    (title && !titleIsGeneric)
    || subtitle
    || displayMileage != null
    || amount
    || location
    || details.length > 0
    // Keep typed Korean-style rows that only have a specific type + date.
    || (!typeIsGeneric && date),
  );
  if (!hasMeaningfulContent) return null;

  return {
    ...event,
    title: titleIsGeneric ? null : title,
    subtitle,
    amount,
    location,
    date,
    mileage: displayMileage,
    details: details.length > 0 ? details : undefined,
  };
}

function isRegistryAmountDetailRow(label: string): boolean {
  return /repair cost|list price|delivery price|new car shipping/i.test(label);
}

export function sanitizeRegistryHistory<T extends RegistryHistoryLike>(
  events: T[] | null | undefined,
  vehicleYear?: number | null,
  opts?: { listingOdometer?: number | null },
): T[] {
  return dedupeRegistryHistory(
    (events ?? [])
      .filter((event) => !isRecallRegistryEvent(event))
      .map((event) => sanitizeRegistryHistoryEvent(event, opts))
      .filter((event): event is T => event != null),
    vehicleYear,
  );
}

/** Korean recalls stored separately from the registry timeline. */
export function sanitizeRecallHistory<T extends RegistryHistoryLike>(
  events: T[] | null | undefined,
  vehicleYear?: number | null,
): T[] {
  return dedupeRegistryHistory(
    (events ?? [])
      .filter((event) => isRecallRegistryEvent(event))
      .map((event) => sanitizeRegistryHistoryEvent({ ...event, type: "recall" }))
      .filter((event): event is T => event != null),
    vehicleYear,
  );
}

/** Fill missing registry dates when another timeline has the same mileage reading. */
export function enrichRegistryHistoryDates<T extends RegistryHistoryLike>(
  events: T[],
  sources: Array<{ date?: string | null; mileage?: number | null; odometer?: number | null }>,
  vehicleYear?: number | null,
): T[] {
  const dateByKm = new Map<number, string>();
  for (const src of sources) {
    const km = src.mileage ?? src.odometer;
    if (km == null || km <= 0) continue;
    const iso = sanitizeReportIsoDate(src.date ?? null, vehicleYear);
    if (iso) dateByKm.set(km, iso);
  }
  if (dateByKm.size === 0) return events;

  return events.map((event) => {
    if (event.date || event.mileage == null || event.mileage <= 0) return event;
    const inferred = dateByKm.get(event.mileage);
    return inferred ? { ...event, date: inferred } : event;
  });
}

export function isMeaningfulOwnerEntry(entry: OwnerHistoryLike): boolean {
  return Boolean(
    cleanDisplayText(entry.date)
    || cleanDisplayText(entry.location)
    || entry.mileage != null
    || entry.auctionPrice != null
    || cleanDisplayText(entry.lotStatus)
    || cleanDisplayText(entry.condition),
  );
}

export function sanitizeOwnerHistory<T extends OwnerHistoryLike>(
  entries: T[] | null | undefined,
  vehicleYear?: number | null,
): T[] {
  return dedupeOwnerHistory(
    (entries ?? [])
      .filter(isMeaningfulOwnerEntry)
      .map((entry) => ({
        ...entry,
        date: cleanDisplayText(entry.date),
        location: cleanDisplayText(entry.location),
        lotStatus: cleanDisplayText(entry.lotStatus),
        condition: cleanDisplayText(entry.condition),
      })),
    vehicleYear,
  );
}

export function sanitizeMileageHistory<T extends MileageHistoryLike>(
  entries: T[] | null | undefined,
  vehicleYear?: number | null,
): T[] {
  return dedupeMileageHistory(
    (entries ?? [])
      .map((entry) => {
        const raw = entry.odometer ?? (entry as { mileage?: number | null }).mileage;
        const odometer =
          raw == null || (typeof raw === "string" && raw === "") ? null : Number(raw);
        return {
          ...entry,
          odometer: odometer != null && Number.isFinite(odometer) && odometer > 0 ? odometer : entry.odometer,
        };
      })
      .filter((e) => {
        const odo = e.odometer ?? (e as { mileage?: number | null }).mileage;
        return odo != null && Number(odo) > 0;
      })
      .map((entry) => ({
        ...entry,
        odometer: entry.odometer ?? (entry as { mileage?: number | null }).mileage,
        date: cleanDisplayText(entry.date),
        condition: cleanDisplayText(entry.condition),
        damage: cleanDisplayText(entry.damage),
        primaryDamage: cleanDisplayText(entry.primaryDamage),
        secondaryDamage: cleanDisplayText(entry.secondaryDamage),
        lotStatus: cleanDisplayText(entry.lotStatus),
        titleStatus: cleanDisplayText(entry.titleStatus),
        location: cleanDisplayText(entry.location),
        description: cleanDisplayText(entry.description),
      })),
    vehicleYear,
  );
}

export function isMeaningfulServiceHistoryEntry(entry: ServiceHistoryLike): boolean {
  return Boolean(
    cleanDisplayText(entry.date)
    || cleanDisplayText(entry.title)
    || cleanDisplayText(entry.location)
    || cleanDisplayText(entry.description)
    || (entry.mileage != null && Number(entry.mileage) > 0)
    || (entry.details?.length ?? 0) > 0,
  );
}

export function sanitizeServiceHistory<T extends ServiceHistoryLike>(
  entries: T[] | null | undefined,
  vehicleYear?: number | null,
): T[] {
  return dedupeServiceHistory(
    (entries ?? [])
      .map((entry) => {
        const raw = entry.mileage;
        const mileage =
          raw == null || (typeof raw === "string" && raw === "") ? null : Number(raw);
        const details = sanitizeRegistryDetailRows(entry.details);
        return {
          ...entry,
          mileage: mileage != null && Number.isFinite(mileage) && mileage > 0 ? mileage : null,
          date: cleanDisplayText(entry.date),
          title: cleanDisplayText(entry.title),
          location: cleanDisplayText(entry.location),
          description: cleanDisplayText(entry.description),
          details: details.length > 0 ? details : undefined,
        };
      })
      .filter(isMeaningfulServiceHistoryEntry),
    vehicleYear,
  );
}

export function isMeaningfulAuctionEntry(entry: AuctionHistoryLike): boolean {
  return Boolean(
    cleanDisplayText(entry.date)
    || cleanDisplayText(entry.city)
    || cleanDisplayText(entry.state)
    || cleanDisplayText(entry.country)
    || cleanDisplayText(entry.condition)
    || cleanDisplayText(entry.primaryDamage)
    || cleanDisplayText(entry.secondaryDamage)
    || cleanDisplayText(entry.damage)
    || cleanDisplayText(entry.titleStatus)
    || cleanDisplayText(entry.lotStatus)
    || entry.openingBid != null
    || entry.buyNowPrice != null
    || entry.finalPrice != null,
  );
}

export function sanitizeAuctionHistory<T extends AuctionHistoryLike>(
  entries: T[] | null | undefined,
  vehicleYear?: number | null,
): T[] {
  return dedupeAuctionHistory(
    (entries ?? []).filter(isMeaningfulAuctionEntry),
    vehicleYear,
  );
}

export function isMeaningfulAccidentEntry(entry: AccidentLike): boolean {
  return Boolean(cleanDisplayText(entry.date));
}

export function sanitizeAccidents<T extends AccidentLike>(
  accidents: T[] | null | undefined,
  vehicleYear?: number | null,
): T[] {
  return dedupeAccidents(
    (accidents ?? [])
      .filter((entry) => entry.type !== "flood" && entry.primaryDamage !== "water_flood")
      .filter(isMeaningfulAccidentEntry)
      .map((entry) => ({
        ...entry,
        // Keep provider KRW cleanup for Korean-sourced rows without an explicit USD tag.
        lossAmount:
          isKoreanSourcedAccidentType(entry.type)
          && normalizeAmountCurrency(entry.currency) !== "USD"
            ? sanitizeKoreanRepairKrwAmount(entry.lossAmount ?? null)
            : entry.lossAmount,
      })),
    vehicleYear,
  );
}

export function isMeaningfulInsuranceClaim(entry: InsuranceClaimLike): boolean {
  return Boolean(
    cleanDisplayText(entry.date)
    || cleanDisplayText(entry.type)
    || entry.lossAmount != null
    || entry.partCost != null
    || entry.laborCost != null
    || entry.paintingCost != null
    || cleanDisplayText(entry.description),
  );
}

export function sanitizeInsuranceClaims<T extends InsuranceClaimLike>(
  claims: T[] | null | undefined,
  vehicleYear?: number | null,
): T[] {
  return dedupeInsuranceClaims(
    (claims ?? [])
      .filter(isMeaningfulInsuranceClaim)
      .map((claim) => ({
        ...claim,
        lossAmount:
          normalizeAmountCurrency(claim.currency) === "USD"
            ? claim.lossAmount
            : sanitizeKoreanRepairKrwAmount(claim.lossAmount ?? null, {
              partCost: claim.partCost,
              laborCost: claim.laborCost,
              paintingCost: claim.paintingCost,
            }),
      })),
    vehicleYear,
  );
}

export type MarketDataLike = {
  estimatedValue?: number | null;
  lastAuctionPrice?: number | null;
  lastAuctionDate?: string | null;
  currency?: string | null;
};

export function hasMeaningfulMarketData(
  data: MarketDataLike | null | undefined,
): boolean {
  if (!data) return false;
  if (data.estimatedValue != null && data.estimatedValue > 0) return true;
  if (data.lastAuctionPrice != null && data.lastAuctionPrice > 0) return true;
  return Boolean(cleanDisplayText(data.lastAuctionDate));
}

export function hasMileageData(
  odometer: number | null | undefined,
  mileageHistory: MileageHistoryLike[],
): boolean {
  return (odometer != null && odometer > 0) || mileageHistory.length > 0;
}

export function hasOwnershipData(
  ownerHistory: OwnerHistoryLike[],
  ownerCount: number | null | undefined,
): boolean {
  return ownerHistory.length > 0 || ownerCount != null;
}

export function hasSafetyData(
  isSalvage: boolean | null | undefined,
  isStolen: boolean | null | undefined,
): boolean {
  return isSalvage != null || isStolen != null;
}
