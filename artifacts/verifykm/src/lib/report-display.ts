/**
 * Shared rules for VIN report UI: hide fields/sections when the provider
 * has no real value (null, "No information", empty strings, etc.).
 */

import { isRecallRegistryEvent } from "@/lib/registry-history";
import { sanitizeReportIsoDate } from "@/lib/encar-date-repair";
import { extractHistoryPeriodDate } from "@/lib/history-sort";
import { isKoreanSourcedAccidentType, normalizeAmountCurrency } from "@/lib/korean-currency";
import { translateKoreanProviderText } from "@/lib/korean-provider-text";
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
  REGISTRY_TYPES_WITHOUT_MILEAGE,
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

/** Auction-house / marketplace brands — never use these as report "titles". */
const AUCTION_MARKETPLACE_PART =
  /^(copart|iaai|insurance\s*auto\s*auctions?|encar|manheim|autobell|european\s*marketplace|marketplace)$/i;

/** Trivial sale-state words that read as junk titles next to "Auction Record". */
const TRIVIAL_LOT_STATUS_PART =
  /^(sold|sale|listing|listed|closed|ended|price\s*history)$/i;

/**
 * Clean auction status for UI.
 * Not a VIN extraction bug — older rows concatenated marketplace + status
 * ("Copart · Sold"). Strip house names, lot ids, and trivial sale words so
 * we never show titles like "IAAI · Sold" / "Copart · Sold".
 */
export function sanitizeAuctionLotStatus(status: string | null | undefined): string | null {
  const raw = cleanDisplayText(status);
  if (!raw) return null;
  const cleaned = raw
    .replace(/\blot\s*#?\s*[A-Z0-9-]{4,}\b/gi, "")
    // Numeric or alphanumeric lot tokens (#72438206, #DEMO-022576-1)
    .replace(/#\s*[A-Z0-9][A-Z0-9-]{3,}\b/gi, "")
    // Demo / playground lot ids without a leading hash
    .replace(/\bDEMO-[A-Z0-9-]{3,}\b/gi, "")
    .replace(/\s*[·•|]\s*/g, " · ")
    .replace(/^(?:\s*[·•|]\s*)+|(?:\s*[·•|]\s*)+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!cleaned) return null;

  const parts = cleaned
    .split(/\s*·\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !AUCTION_MARKETPLACE_PART.test(part))
    .filter((part) => !TRIVIAL_LOT_STATUS_PART.test(part));
  const joined = parts.join(" · ").trim();
  return joined || null;
}

const US_STATE_ABBR =
  /\b(A[LKZR]|C[AOT]|D[EC]|FL|GA|HI|I[ADLN]|K[SY]|LA|M[ADEHINOST]|N[CDEHJMVY]|O[HKR]|P[AWR]|RI|S[CD]|T[NX]|UT|V[AIT]|W[AIVY])\b/i;

const NON_US_COUNTRY_RE =
  /\b(germany|deutschland|de|south\s*korea|korea|kr|japan|jp|france|fr|italy|it|spain|es|poland|pl|netherlands|nl|belgium|be|austria|at|switzerland|ch|sweden|se|norway|no|denmark|dk|finland|fi|united\s*kingdom|england|uk|gb|china|cn|taiwan|tw|australia|au)\b/i;

const US_CITY_RE =
  /\b(houston|dallas|austin|los\s*angeles|new\s*york|chicago|miami|atlanta|seattle|phoenix|denver|boston|detroit)\b/i;

/** Strip playground placeholder place names ("Demo region"). */
function scrubDemoPlaceText(value: string | null | undefined): string | null {
  const raw = cleanDisplayText(value);
  if (!raw) return null;
  const cleaned = raw
    .replace(/\bdemo\s*region\b/gi, "")
    .replace(/\bdemo\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[,;\s]+|[,;\s]+$/g, "")
    .trim();
  return cleaned || null;
}

/**
 * Fix mashed auction locations (e.g. "Houston, TX, Demo region, Germany"):
 * keep marketplace country for non-US auctions, US place for Copart/IAAI.
 */
export function sanitizeAuctionPlaceFields(entry: {
  city?: string | null;
  state?: string | null;
  country?: string | null;
  lotStatus?: string | null;
}): { city: string | null; state: string | null; country: string | null } {
  let city = scrubDemoPlaceText(entry.city);
  let state = scrubDemoPlaceText(entry.state);
  let country = cleanDisplayText(entry.country);

  const placeBlob = `${city ?? ""} ${state ?? ""}`;
  const usLooking = US_STATE_ABBR.test(placeBlob) || US_CITY_RE.test(placeBlob);
  const nonUsCountry = country ? NON_US_COUNTRY_RE.test(country) : false;
  const status = (entry.lotStatus ?? "").toLowerCase();
  const usAuction = /copart|iaai/.test(status);

  if (usLooking && nonUsCountry) {
    if (usAuction) {
      country = "USA";
    } else {
      // lotStatus is often just "Sold" now — still drop Houston+DE mashups.
      city = null;
      state = null;
    }
  }

  return { city, state, country };
}

/** Chart-only price_history rows should not appear as auction records. */
export function isPriceHistoryAuctionEntry(entry: { lotStatus?: string | null }): boolean {
  return /^price\s*history$/i.test((entry.lotStatus ?? "").trim());
}

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

/** Status-check noise that used to appear as fake timeline rows ("Government · Present"). */
export function isRegistryStatusCheckNoise(event: {
  title?: string | null;
  subtitle?: string | null;
  type?: string | null;
}): boolean {
  const subtitle = (event.subtitle ?? "").trim().toLowerCase();
  if (subtitle !== "present" && subtitle !== "recorded") return false;
  const type = (event.type ?? "").toLowerCase();
  if (/owner|inspection|insurance|registration|delivery|recall/.test(type)) return false;
  const title = (event.title ?? "").toLowerCase();
  return /government|special\s*usage|business|rental|taxi|official|flood|total\s*loss|theft|water/.test(title)
    || /_use|_history|usage|check/.test(type);
}

export function sanitizeRegistryHistoryEvent<T extends RegistryHistoryLike>(
  event: T,
  opts?: { listingOdometer?: number | null },
): T | null {
  if (isRegistryStatusCheckNoise(event)) return null;

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
  let date = cleanDisplayText(event.date);
  const title = cleanDisplayText(event.title);

  const displayMileage = resolveRegistryDisplayMileage(
    { ...event, details },
    { listingOdometer: opts?.listingOdometer },
  );

  let subtitle = stripRegistrySubtitleNoise(cleanDisplayText(event.subtitle), displayMileage);

  // Uninsured periods often arrive with date=null and the range only in subtitle
  // ("2025-12~2026-06"). Copy into date so newest-first sort uses the range end.
  if (!date) {
    const periodDate =
      extractHistoryPeriodDate(subtitle)
      ?? extractHistoryPeriodDate(cleanDisplayText(event.subtitle));
    if (periodDate) {
      date = periodDate;
      // Avoid repeating the same range under the title.
      if (extractHistoryPeriodDate(subtitle) === periodDate) subtitle = null;
    }
  }

  const titleIsGeneric = !title || /^(event|no information|n\/a|unknown|-|registry event)$/i.test(title);
  const typeIsGeneric = !event.type || /^(event|other|unknown)$/i.test(String(event.type));
  const isOwnerLike = /owner|ownership/i.test(String(event.type ?? ""));
  // Owner transfers without a date (or uninsured-style period) are not timeline events.
  if (isOwnerLike && !date) return null;
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
        lotStatus: sanitizeAuctionLotStatus(entry.lotStatus),
        condition: cleanDisplayText(entry.condition),
      })),
    vehicleYear,
  );
}

const FIRST_REG_SOURCE = "First registration";

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
      .map((entry) => {
        const rawSource = cleanDisplayText(entry.source);
        // Legacy local Carstat lots often omitted `source` while still carrying listing
        // sale chips (₩ price, run_and_drives). Treat missing/listing/marketplace as
        // km+date only — sale price/condition belong on the auction timeline.
        const isNaAuction = /^na_auction$/i.test(rawSource ?? "");
        const source = rawSource || (isNaAuction ? "na_auction" : "listing");
        const stripSaleMeta = !isNaAuction;
        return {
          ...entry,
          odometer: entry.odometer ?? (entry as { mileage?: number | null }).mileage,
          date: cleanDisplayText(entry.date),
          source,
          condition: stripSaleMeta ? null : cleanDisplayText(entry.condition),
          damage: stripSaleMeta ? null : cleanDisplayText(entry.damage),
          primaryDamage: stripSaleMeta ? null : cleanDisplayText(entry.primaryDamage),
          secondaryDamage: stripSaleMeta ? null : cleanDisplayText(entry.secondaryDamage),
          lotStatus: stripSaleMeta ? null : sanitizeAuctionLotStatus(entry.lotStatus),
          titleStatus: stripSaleMeta ? null : cleanDisplayText(entry.titleStatus),
          location: cleanDisplayText(entry.location),
          description: cleanDisplayText(entry.description),
          // Never show listing/auction sale amounts on the mileage timeline.
          auctionPrice: null,
          currency: null,
        };
      }),
    vehicleYear,
  );
}

function registryMileageSource(
  type?: string | null,
  title?: string | null,
): string {
  const t = (type ?? "").trim().toLowerCase();
  if (t === "inspection") return "Korean inspection";
  if (t === "owner_change") return "Korean ownership";
  if (t === "export") return "Export declaration";
  if (t === "first_registration" || t === "delivery") return FIRST_REG_SOURCE;
  if (/export/i.test(title ?? "")) return "Export declaration";
  if (/inspect/i.test(title ?? "")) return "Korean inspection";
  return "Korean registry";
}

/**
 * Local Carstat keeps KOTSA/Encar km on registryHistory only. Mirror dated registry
 * readings into the mileage timeline (same idea as VHR Korean insurance).
 */
export function ensureRegistryMileageHistory<T extends MileageHistoryLike>(
  mileage: T[],
  registry?: Array<{
    date?: string | null;
    type?: string | null;
    title?: string | null;
    mileage?: number | null;
  }> | null,
): T[] {
  if (!registry?.length) return mileage;

  const existingKeys = new Set(
    mileage.map((row) => {
      const odo = Number(row.odometer);
      const date = cleanDisplayText(row.date) ?? "";
      return Number.isFinite(odo) && odo > 0 ? `${date}|${Math.round(odo)}` : "";
    }).filter(Boolean),
  );
  const existingOdo = new Set(
    mileage
      .map((row) => Number(row.odometer))
      .filter((n) => Number.isFinite(n) && n > 0)
      .map((n) => Math.round(n)),
  );

  const extras: T[] = [];
  for (const event of registry) {
    const type = (event.type ?? "").trim().toLowerCase();
    if (REGISTRY_TYPES_WITHOUT_MILEAGE.has(type)) continue;
    const km = Number(event.mileage);
    if (!Number.isFinite(km) || km <= 0) continue;
    const date = cleanDisplayText(event.date);
    if (!date) continue;
    const rounded = Math.round(km);
    const key = `${date}|${rounded}`;
    if (existingKeys.has(key) || existingOdo.has(rounded)) continue;
    extras.push({
      date,
      odometer: rounded,
      unit: "km",
      source: registryMileageSource(event.type, event.title),
    } as T);
    existingKeys.add(key);
    existingOdo.add(rounded);
  }

  return extras.length > 0 ? [...mileage, ...extras] : mileage;
}

function looksLikeDateText(value: string): boolean {
  return /^\d{4}([-/]\d{1,2}([-/]\d{1,2})?)?/.test(value.trim())
    || /^\d{4}-\d{2}-\d{2}T/.test(value.trim());
}

/** Prefer registry / extras first-registration date for the mileage timeline start. */
export function resolveFirstRegistrationDate(
  registry?: Array<{ type?: string | null; date?: string | null; title?: string | null }> | null,
  extras?: Array<{ key?: string | null; label?: string | null; value?: string | null }> | null,
): string | null {
  for (const row of registry ?? []) {
    const type = (row.type ?? "").trim().toLowerCase();
    const title = (row.title ?? "").trim().toLowerCase();
    if (
      type === "first_registration"
      || type === "delivery"
      || /first\s*regist|initial\s*regist/.test(title)
    ) {
      const date = cleanDisplayText(row.date);
      if (date) return date;
    }
  }
  for (const extra of extras ?? []) {
    const blob = `${extra.key ?? ""} ${extra.label ?? ""}`.toLowerCase();
    if (!/first_registration|first\s*regist|initial\s*regist/.test(blob)) continue;
    const value = cleanDisplayText(extra.value);
    if (value && looksLikeDateText(value)) return value;
  }
  return null;
}

const EXPORT_MILEAGE_SOURCE_RE =
  /export\s*declaration|export\s*date|\bexport\b|수출|экспорт/i;

function isExportRegistryEvent(event: {
  type?: string | null;
  title?: string | null;
}): boolean {
  const type = (event.type ?? "").trim().toLowerCase();
  if (type === "export") return true;
  return EXPORT_MILEAGE_SOURCE_RE.test(event.title ?? "");
}

function isExportMileageSource(source?: string | null): boolean {
  return EXPORT_MILEAGE_SOURCE_RE.test(source ?? "");
}

/**
 * When export date/mileage only exist on the mileage timeline (or kr_export_* extras),
 * still surface them on the Korean registry timeline.
 */
export function ensureExportRegistryEvent<T extends RegistryHistoryLike>(
  registry: T[],
  mileage?: Array<{ date?: string | null; odometer?: number | null; source?: string | null }> | null,
  extras?: Array<{
    key?: string | null;
    label?: string | null;
    value?: string | null;
    observedAt?: string | null;
  }> | null,
): T[] {
  const exportMileage = (mileage ?? []).find(
    (row) => isExportMileageSource(row.source) && cleanDisplayText(row.date),
  );
  const exportKm =
    exportMileage?.odometer != null && Number.isFinite(Number(exportMileage.odometer))
      ? Number(exportMileage.odometer)
      : null;

  const existingIdx = registry.findIndex((row) => isExportRegistryEvent(row));
  if (existingIdx >= 0) {
    const existing = registry[existingIdx]!;
    const needsKm = (existing.mileage == null || existing.mileage <= 0) && exportKm != null && exportKm > 0;
    const needsDate = !cleanDisplayText(existing.date) && cleanDisplayText(exportMileage?.date);
    if (!needsKm && !needsDate) return registry;
    const next = { ...existing } as T;
    if (needsDate) next.date = cleanDisplayText(exportMileage?.date);
    if (needsKm) {
      next.mileage = exportKm;
      if (!cleanDisplayText(next.subtitle)) {
        next.subtitle = `${exportKm.toLocaleString()} km`;
      }
    }
    const copy = registry.slice();
    copy[existingIdx] = next;
    return copy;
  }

  let exportDate = cleanDisplayText(exportMileage?.date);
  if (!exportDate) {
    for (const extra of extras ?? []) {
      const blob = `${extra.key ?? ""} ${extra.label ?? ""}`.toLowerCase();
      if (!/kr_export_date|export\s*date|export_declaration/.test(blob)) continue;
      const value = cleanDisplayText(extra.value);
      if (value && looksLikeDateText(value)) {
        exportDate = value;
        break;
      }
      const observed = cleanDisplayText(extra.observedAt);
      if (observed) {
        exportDate = observed;
        break;
      }
    }
  }
  if (!exportDate) return registry;

  let km = exportKm;
  if (km == null) {
    for (const extra of extras ?? []) {
      const blob = `${extra.key ?? ""} ${extra.label ?? ""}`.toLowerCase();
      if (!/kr_export_mileage|export\s*mileage|export.*km/.test(blob)) continue;
      const digits = String(extra.value ?? "").replace(/[^\d]/g, "");
      if (!digits) continue;
      const n = Number(digits);
      if (Number.isFinite(n) && n > 0) {
        km = n;
        break;
      }
    }
  }

  return [
    ...registry,
    {
      date: exportDate,
      type: "export",
      title: "Export declaration",
      subtitle: km != null ? `${km.toLocaleString()} km` : null,
      mileage: km,
    } as T,
  ];
}

/**
 * Always keep a 1 km first/initial registration reading as the mileage timeline start
 * when other mileage history already exists.
 */
export function ensureInitialRegistrationMileage<T extends MileageHistoryLike>(
  entries: T[],
  opts?: {
    firstRegistrationDate?: string | null;
    vehicleYear?: number | null;
  },
): T[] {
  if (!entries.length) return entries;

  const year = opts?.vehicleYear;
  const date =
    cleanDisplayText(opts?.firstRegistrationDate)
    ?? (year != null && year >= 1980 && year <= 2100 ? `${year}-01-01` : null);

  const existingIdx = entries.findIndex((entry) => Number(entry.odometer) === 1);
  if (existingIdx >= 0) {
    const existing = entries[existingIdx]!;
    const next = { ...existing } as T;
    if (!cleanDisplayText(next.date) && date) next.date = date;
    if (!/(first|initial)\s*regist/i.test(next.source ?? "")) {
      next.source = FIRST_REG_SOURCE;
    }
    if (!next.unit) next.unit = "km";
    const copy = entries.slice();
    copy[existingIdx] = next;
    return copy;
  }

  return [
    ...entries,
    {
      date,
      odometer: 1,
      unit: "km",
      source: FIRST_REG_SOURCE,
    } as T,
  ];
}

/** Localized label for mileage timeline source chips. */
export function formatMileageHistorySource(
  source: string | null | undefined,
  t: (key: string) => string,
): string | null {
  const raw = cleanDisplayText(source);
  if (!raw) return null;
  if (/^(first|initial)\s+registration$/i.test(raw) || /^first_registration$/i.test(raw)) {
    return t("registry_field_first_registration");
  }
  if (/^inspection$/i.test(raw)) {
    const label = t("provider_inspection");
    if (label !== "provider_inspection") return label;
  }
  const translated = translateKoreanProviderText(t, raw);
  if (translated && translated !== raw) return translated;
  return raw;
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

/** Auction/classified labels wrongly stored as service "location". */
function isMarketplaceServiceLocation(value: string | null | undefined): boolean {
  if (!value) return false;
  return /copart|iaai|encar|manheim|european\s*marketplace|korean\s*marketplace|us\s*auction|marketplace|auction/i
    .test(value);
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
        const locationRaw = cleanDisplayText(entry.location);
        const location = locationRaw && !isMarketplaceServiceLocation(locationRaw) ? locationRaw : null;
        return {
          ...entry,
          mileage: mileage != null && Number.isFinite(mileage) && mileage > 0 ? mileage : null,
          date: cleanDisplayText(entry.date),
          title: cleanDisplayText(entry.title),
          location,
          description: cleanDisplayText(entry.description),
          details: details.length > 0 ? details : undefined,
        };
      })
      // Drop auction-stub "Service record" rows that only existed to show a marketplace name.
      .filter((entry) => {
        const loc = cleanDisplayText(entry.location);
        const title = cleanDisplayText(entry.title) ?? "";
        if (/^service\s*record$/i.test(title) && isMarketplaceServiceLocation(loc)) return false;
        // Legacy rows: marketplace was the location; after scrub location is null and desc is visit count.
        if (
          /^service\s*record$/i.test(title)
          && !loc
          && /recorded visits/i.test(entry.description ?? "")
          && (entry.details?.length ?? 0) === 0
        ) {
          return false;
        }
        return isMeaningfulServiceHistoryEntry(entry);
      }),
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
    (entries ?? [])
      .filter((entry) => !isPriceHistoryAuctionEntry(entry))
      .filter(isMeaningfulAuctionEntry)
      .map((entry) => {
        // Place heuristics need the raw marketplace token before status sanitization.
        const place = sanitizeAuctionPlaceFields(entry);
        return {
          ...entry,
          lotStatus: sanitizeAuctionLotStatus(entry.lotStatus),
          city: place.city,
          state: place.state,
          country: place.country,
        };
      }),
    vehicleYear,
  );
}

export function isMeaningfulAccidentEntry(entry: AccidentLike): boolean {
  return Boolean(cleanDisplayText(entry.date));
}

export function sanitizeAccidents<T extends AccidentLike>(
  accidents: T[] | null | undefined,
  vehicleYear?: number | null,
  vehicleCountry?: string | null,
): T[] {
  const dropKorean = isNorthAmericanVehicleCountry(vehicleCountry);
  return dedupeAccidents(
    (accidents ?? [])
      .filter((entry) => entry.type !== "flood" && entry.primaryDamage !== "water_flood")
      .filter(isMeaningfulAccidentEntry)
      .filter((entry) => {
        if (!dropKorean) return true;
        if (/^KR$/i.test(String(entry.country ?? ""))) return false;
        if (/korean insurance/i.test(String(entry.description ?? ""))) return false;
        if (
          isKoreanSourcedAccidentType(entry.type)
          && normalizeAmountCurrency(entry.currency) === "KRW"
        ) {
          return false;
        }
        return true;
      })
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

function isNorthAmericanVehicleCountry(country: string | null | undefined): boolean {
  return /united\s*states|\busa?\b|canada|mexico|\bus\b|\bca\b|\bmx\b/i.test(String(country ?? ""));
}

/** KRW / Encar insurance rows must not appear on USA/Canada-origin reports. */
export function isKoreanMarketInsuranceClaim(entry: InsuranceClaimLike): boolean {
  const currency = normalizeAmountCurrency(entry.currency);
  if (currency === "KRW") return true;
  const blob = `${entry.type ?? ""} ${entry.description ?? ""}`;
  if (/krw|₩|\bwon\b/i.test(blob)) return true;
  // Typical Encar stub: "Own damage 1,280,000 KRW · Third party 0 KRW"
  if (/own damage|third party/i.test(blob) && /[\d,]{5,}/.test(blob) && currency !== "USD") {
    return true;
  }
  if (/korean/i.test(blob)) return true;
  return false;
}

export function sanitizeInsuranceClaims<T extends InsuranceClaimLike>(
  claims: T[] | null | undefined,
  vehicleYear?: number | null,
  vehicleCountry?: string | null,
): T[] {
  const dropKorean = isNorthAmericanVehicleCountry(vehicleCountry);
  return dedupeInsuranceClaims(
    (claims ?? [])
      .filter(isMeaningfulInsuranceClaim)
      .filter((claim) => !(dropKorean && isKoreanMarketInsuranceClaim(claim)))
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
