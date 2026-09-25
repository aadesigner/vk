import { decodeVin, isVehicleTooOldForLookup } from "@workspace/vin-decode";
import { db, vinLookupsTable, vinCatalogTable, paymentsTable, providersTable } from "@workspace/db";
import type { VinCatalog } from "@workspace/db";
import { eq, desc, and, or, ne, inArray, sql } from "drizzle-orm";
import { logger } from "./logger";
import {
  inferAccidentSeverityFromLossAmount,
} from "@workspace/accident-severity";
import {
  applyFrozenKrwPerUsd,
  getCurrentKrwPerUsd,
  readFrozenKrwPerUsd,
} from "./krwRate.js";
import {
  sanitizeCatalogPayload,
  catalogHasDeliverableReport,
  catalogDeliverableFromHint,
  preserveAdminTaxiFlag,
  type CatalogDeliverableHint,
} from "./vinCatalogImport.js";
import { mediaVersionFromUpdatedAt, extractVinPhotoUrls, invalidateVinImageCache } from "./vinImageCache.js";
import { removeVinFromSitemaps } from "./sitemapMaintenance.js";
import { assertValidProviderBaseUrl } from "./providerUrl.js";
import { withGlobalVinProviderLock } from "./vinProviderMutex.js";
import { mapInBatches } from "./batchAsync.js";
import {
  providerCalendarLabelToIso,
  repairEncarMisParsedIsoDate,
  sanitizeReportIsoDate,
} from "./encar-date-repair.js";
import {
  accidentDedupeKey,
  dedupeAccidents,
  dedupeAuctionHistory,
  dedupeInsuranceClaims,
  dedupeMileageHistory,
  dedupeOwnerHistory,
  dedupeRegistryHistory,
  ownerHistoryDedupeKey,
  registryHistoryDedupeKey,
} from "./history-dedupe.js";
import { parseKmFromText, resolveLatestOdometerKm } from "@workspace/odometer-resolve";
import {
  normalizeKrwAmountText,
  parseKrwAmountFromText,
  REGISTRY_TYPES_WITHOUT_MILEAGE,
  sanitizeKoreanRepairAmountText,
  sanitizeKoreanRepairKrwAmount,
  isRegistryRepairCostLabel,
  formatKoreanListPriceAmountText,
  resolveRegistryDisplayAmount,
  stripRegistrySubtitleNoise,
  isEncarMileageTypoLine,
  sanitizeRegistryLocation,
} from "@workspace/korean-registry";

export { parseKmFromText, resolveLatestOdometerKm } from "@workspace/odometer-resolve";

export { repairEncarMisParsedIsoDate, sanitizeReportIsoDate } from "./encar-date-repair.js";
export {
  accidentDedupeKey,
  dedupeAccidents,
  dedupeOwnerHistory,
  ownerHistoryDedupeKey,
  registryHistoryDedupeKey as registryEventDedupeKey,
} from "./history-dedupe.js";

export function dedupeRegistryHistoryEvents(
  events: RegistryHistoryEvent[],
): RegistryHistoryEvent[] {
  return dedupeRegistryHistory(events);
}

export interface NormalizedVinData {
  /**
   * Opaque report origin stamp. `"getcarapi"` switches Events UI (not Korean registry).
   * Carstat / local catalog leave this unset.
   */
  dataSource?: "getcarapi" | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  trim?: string | null;
  engine?: string | null;
  transmission?: string | null;
  fuelType?: string | null;
  bodyType?: string | null;
  color?: string | null;
  country?: string | null;
  odometer?: number | null;
  accidentCount?: number | null;
  ownerCount?: number | null;
  hp?: number | null;
  cylinders?: number | null;
  isSalvage?: boolean | null;
  isStolen?: boolean | null;
  isTaxi?: boolean | null;
  /**
   * Flood damage flag (null = unknown / not assessed).
   * KR: insurance_v2.floodTotalLossCnt/Cost. NA: title/certificate, auction damage, or accident flood tokens.
   */
  isFlooded?: boolean | null;
  floodCount?: number | null;
  floodLossAmount?: number | null;
  /** Mid-size gallery for hero / thumbs (prefer normal over big when available). */
  photos?: string[];
  /** Full-resolution gallery for lightbox; falls back to photos when absent. */
  photosHd?: string[];
  /**
   * Optional per-index alternate URL (e.g. dealer/source when Cloudflare CDN is primary).
   * Same length as `photos` when present; null entries mean no fallback for that slot.
   */
  photoAlternates?: Array<string | null>;
  /** Copart/IAAI 360° exterior frames (ordered spin). */
  photos360Exterior?: string[];
  /** Copart/IAAI 360° interior frames (ordered spin). */
  photos360Interior?: string[];
  /**
   * Auction-hosted interactive 360° viewer (e.g. IAAI `external_panorama_url`).
   * Used when frame arrays are null/empty — common on newer IAAI lots.
   */
  photos360EmbedUrl?: string | null;
  /** IAAI exterior-only ThreeSixtyView (derived from STP token). */
  photos360EmbedExteriorUrl?: string | null;
  /** IAAI interior-only ThreeSixtyView (derived from INT token). */
  photos360EmbedInteriorUrl?: string | null;
  accidents?: Array<{
    date?: string | null;
    severity?: string | null;
    description?: string | null;
    country?: string | null;
    type?: string | null;
    primaryDamage?: string | null;
    secondaryDamage?: string | null;
    airbagDeployed?: boolean | null;
    odometerAtLoss?: number | null;
    lossAmount?: number | null;
    currency?: string | null;
  }>;
  /** Korean / regional insurance payout history — not the same as collision accidents. */
  insuranceClaims?: Array<{
    date?: string | null;
    type?: string | null;
    lossAmount?: number | null;
    partCost?: number | null;
    laborCost?: number | null;
    paintingCost?: number | null;
    description?: string | null;
  }>;
    mileageHistory?: Array<{
    date?: string | null;
    odometer?: number | null;
    unit?: string | null;
    source?: "na_auction" | "listing" | "admin" | string | null;
    condition?: string | null;
    damage?: string | null;
    primaryDamage?: string | null;
    secondaryDamage?: string | null;
    auctionPrice?: number | null;
    lotStatus?: string | null;
    titleStatus?: string | null;
    /** Manual admin annotation only — never set by provider normalize. */
    location?: string | null;
    /** Manual admin annotation only — never set by provider normalize. */
    description?: string | null;
  }>;
  /**
   * Workshop / service / inspection visits.
   * Carstat normalize never fills this (admin-only for Carstat).
   * GetCarAPI may populate from inspection-typed events.
   */
  serviceHistory?: Array<{
    date?: string | null;
    mileage?: number | null;
    title?: string | null;
    location?: string | null;
    description?: string | null;
    details?: Array<{ label: string; value: string }>;
  }>;
  ownerHistory?: Array<{
    date?: string | null;
    location?: string | null;
    mileage?: number | null;
    auctionPrice?: number | null;
    lotStatus?: string | null;
    condition?: string | null;
  }>;
  marketData?: {
    estimatedValue?: number | null;
    currency?: string | null;
    lastAuctionPrice?: number | null;
    lastAuctionDate?: string | null;
  };
  auctionHistory?: Array<{
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
  }>;
  titleStatus?: string | null;
  /** Korean KOTSA / Encar registry timeline from details.history. */
  registryHistory?: Array<{
    date?: string | null;
    type?: string | null;
    title?: string | null;
    subtitle?: string | null;
    mileage?: number | null;
    amount?: string | null;
    location?: string | null;
    details?: Array<{ label: string; value: string }>;
  }>;
  /** Korean manufacturer recalls — extracted separately from registry timeline. */
  recallHistory?: Array<{
    date?: string | null;
    type?: string | null;
    title?: string | null;
    subtitle?: string | null;
    mileage?: number | null;
    amount?: string | null;
    location?: string | null;
    details?: Array<{ label: string; value: string }>;
  }>;
  /**
   * GetCarAPI Extra tab — listing attribute cards (doors, stock number, …).
   * Never merged into Events / registryHistory.
   */
  vehicleExtras?: Array<{
    key?: string | null;
    label: string;
    value: string;
    observedAt?: string | null;
  }>;
}

export async function getCatalogVin(vin: string): Promise<VinCatalog | null> {
  const rows = await db
    .select()
    .from(vinCatalogTable)
    .where(eq(vinCatalogTable.vin, vin.toUpperCase()))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertVinCatalog(
  vin: string,
  providerName: string | null,
  data: Record<string, unknown>,
): Promise<void> {
  const existing = await getCatalogVin(vin);
  const existingData = (existing?.data as Record<string, unknown> | null) ?? null;
  const existingRate = readFrozenKrwPerUsd(existingData);
  const currentRate = await getCurrentKrwPerUsd();
  const cleaned = sanitizeCatalogPayload(data);

  // Manual-only fields (admin pending / catalog edit). Provider payloads never set these —
  // keep them when an automatic fetch replaces the catalog row.
  if (existingData) {
    const prevServices = existingData.serviceHistory;
    if (
      Array.isArray(prevServices)
      && prevServices.length > 0
      && (!Array.isArray(cleaned.serviceHistory) || cleaned.serviceHistory.length === 0)
    ) {
      cleaned.serviceHistory = prevServices;
    }
    cleaned.mileageHistory = preserveManualMileageAnnotations(
      cleaned.mileageHistory,
      existingData.mileageHistory,
    );
  }

  const stamped = applyFrozenKrwPerUsd(
    preserveAdminTaxiFlag(cleaned, existingData),
    { existingRate, currentRate },
  );

  await db
    .insert(vinCatalogTable)
    .values({ vin: vin.toUpperCase(), providerName, data: stamped, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: vinCatalogTable.vin,
      set: { data: stamped, providerName, updatedAt: new Date() },
    });
}

/** Keep admin-entered mileage description/location when provider history is rewritten. */
export function preserveManualMileageAnnotations(
  incoming: unknown,
  previous: unknown,
): unknown {
  if (!Array.isArray(incoming)) return incoming;
  if (!Array.isArray(previous) || previous.length === 0) return incoming;

  const prevByKey = new Map<string, Record<string, unknown>>();
  for (const raw of previous) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const e = raw as Record<string, unknown>;
    const desc = typeof e.description === "string" ? e.description.trim() : "";
    const loc = typeof e.location === "string" ? e.location.trim() : "";
    if (!desc && !loc) continue;
    const date = String(e.date ?? "").substring(0, 10);
    const odo = Number(e.odometer ?? NaN);
    if (!date || !Number.isFinite(odo)) continue;
    prevByKey.set(`${date}|${odo}`, e);
  }
  if (prevByKey.size === 0) return incoming;

  return incoming.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
    const e = { ...(raw as Record<string, unknown>) };
    const date = String(e.date ?? "").substring(0, 10);
    const odo = Number(e.odometer ?? NaN);
    if (!date || !Number.isFinite(odo)) return e;
    const prev = prevByKey.get(`${date}|${odo}`);
    if (!prev) return e;
    const incomingDesc = typeof e.description === "string" ? e.description.trim() : "";
    const incomingLoc = typeof e.location === "string" ? e.location.trim() : "";
    if (!incomingDesc && typeof prev.description === "string" && prev.description.trim()) {
      e.description = prev.description;
    }
    if (!incomingLoc && typeof prev.location === "string" && prev.location.trim()) {
      e.location = prev.location;
    }
    return e;
  });
}

/** Prefer the report payload with richer timeline data (registry, claims, mileage). */
export function vinReportDataRichnessScore(data: Record<string, unknown> | null | undefined): number {
  if (!data) return 0;
  let score = 0;
  const registry = data.registryHistory;
  if (Array.isArray(registry)) score += registry.length * 1000;
  const claims = data.insuranceClaims;
  if (Array.isArray(claims)) score += claims.length * 100;
  const mileage = data.mileageHistory;
  if (Array.isArray(mileage)) score += mileage.length * 10;
  const accidents = data.accidents;
  if (Array.isArray(accidents)) score += accidents.length;
  return score;
}

export const MAX_VIN_PHOTOS = 24;
/** Copart/IAAI 360° spin frames (exterior / interior) — higher than still gallery. */
export const MAX_VIN_SPIN_PHOTOS = 72;

/** Merge unique photo URLs from multiple report payloads (catalog vs lookup). */
export function mergeVinPhotoLists(
  ...sources: Array<unknown[] | null | undefined>
): string[] {
  return mergeVinPhotoListsWithCap(MAX_VIN_PHOTOS, ...sources);
}

export function mergeVinPhotoListsWithCap(
  max: number,
  ...sources: Array<unknown[] | null | undefined>
): string[] {
  const sorted = [...sources].sort((a, b) => {
    const al = Array.isArray(a) ? a.length : 0;
    const bl = Array.isArray(b) ? b.length : 0;
    return bl - al;
  });

  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of sorted) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (typeof item !== "string") continue;
      const url = item.trim();
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push(url);
      if (out.length >= max) return out;
    }
  }
  return out;
}

/** Drop 360° spin frame URLs from still galleries (legacy polluted catalog rows). */
export function excludeSpinUrlsFromGallery(
  photos: string[] | null | undefined,
  ...spinSets: Array<string[] | null | undefined>
): string[] {
  if (!Array.isArray(photos) || photos.length === 0) return [];
  const blocked = new Set<string>();
  for (const set of spinSets) {
    if (!Array.isArray(set)) continue;
    for (const url of set) {
      if (typeof url === "string" && url.trim()) blocked.add(url.trim());
    }
  }
  if (blocked.size === 0) return photos.map((p) => p.trim()).filter(Boolean);
  return photos.map((p) => p.trim()).filter((p) => p && !blocked.has(p));
}

/**
 * First teaser photo for locked public VIN pages.
 * Uses catalog data when present; otherwise the newest complete lookup for this VIN
 * (catalog row already exists, so this does not expose delisted VINs).
 */
export async function resolveLockedPreviewPhotoSources(
  vin: string,
  dataSource: Record<string, unknown>,
): Promise<string[]> {
  const normalized = vin.trim().toUpperCase();
  const fromCatalog = Array.isArray(dataSource.photos)
    ? (dataSource.photos as string[]).map((p) => p.trim()).filter(Boolean)
    : [];
  if (fromCatalog.length > 0) return fromCatalog.slice(0, 4);

  const [lookup] = await db
    .select({ data: vinLookupsTable.data })
    .from(vinLookupsTable)
    .where(and(
      eq(vinLookupsTable.vin, normalized),
      or(
        eq(vinLookupsTable.status, "complete"),
        eq(vinLookupsTable.status, "pending_manual"),
      ),
    ))
    .orderBy(desc(vinLookupsTable.updatedAt), desc(vinLookupsTable.createdAt))
    .limit(1);

  const lookupData = (lookup?.data as Record<string, unknown> | null) ?? null;
  const fromLookup = lookupData && Array.isArray(lookupData.photos)
    ? (lookupData.photos as string[]).map((p) => p.trim()).filter(Boolean)
    : [];
  return fromLookup.slice(0, 4);
}

function readOdometerScalar(data: Record<string, unknown> | null | undefined): number | null {
  if (!data) return null;
  const raw = data.odometer ?? data.mileage;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeMileageHistoryEntry(entry: unknown): Record<string, unknown> | null {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const e = entry as Record<string, unknown>;
  const raw = e.odometer ?? e.mileage;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return { ...e, odometer: n };
}

function mergeMileageHistoryArrays(...sources: unknown[]): unknown[] {
  const merged: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const src of sources) {
    if (!Array.isArray(src)) continue;
    for (const raw of src) {
      const entry = normalizeMileageHistoryEntry(raw);
      if (!entry) continue;
      const key = `${String(entry.date ?? "")}|${entry.odometer}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(entry);
    }
  }
  return merged;
}

function concatUniqueArrays(...sources: unknown[]): unknown[] {
  const merged: unknown[] = [];
  const seen = new Set<string>();
  for (const src of sources) {
    if (!Array.isArray(src)) continue;
    for (const item of src) {
      const key = JSON.stringify(item);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }
  return merged;
}

/**
 * Blend catalog + lookup so admin edits on either side always surface on the VIN page.
 */
export function mergeVinReportBodies(
  ...bodies: Array<Record<string, unknown> | null | undefined>
): Record<string, unknown> | null {
  const valid = bodies.filter((b): b is Record<string, unknown> => !!b && typeof b === "object");
  if (valid.length === 0) return null;

  let result: Record<string, unknown> = { ...valid[0] };
  for (let i = 1; i < valid.length; i++) {
    result = { ...result, ...valid[i] };
  }

  const lockedBody = [...valid].reverse().find((b) => b.odometerLocked === true);
  const odometers = valid.map(readOdometerScalar);
  const mileageHistory = lockedBody && Array.isArray(lockedBody.mileageHistory)
    ? lockedBody.mileageHistory
    : mergeMileageHistoryArrays(...valid.map((b) => b.mileageHistory));
  const odometer = lockedBody
    ? readOdometerScalar(lockedBody)
    : [...odometers].reverse().find((n) => n != null) ?? null;

  const photosRaw = mergeVinPhotoLists(
    ...valid.map((b) => b.photos as string[] | undefined),
  );
  const photosHdRaw = mergeVinPhotoLists(
    ...valid.map((b) => b.photosHd as string[] | undefined),
  );
  const photos360Exterior = mergeVinPhotoListsWithCap(
    MAX_VIN_SPIN_PHOTOS,
    ...valid.map((b) => b.photos360Exterior as string[] | undefined),
  );
  const photos360Interior = mergeVinPhotoListsWithCap(
    MAX_VIN_SPIN_PHOTOS,
    ...valid.map((b) => b.photos360Interior as string[] | undefined),
  );
  const photos360EmbedUrl = [...valid]
    .map((b) => sanitizeAuctionPanoramaUrl(b.photos360EmbedUrl))
    .find((u): u is string => !!u) ?? null;
  const photos360EmbedExteriorUrl = [...valid]
    .map((b) => sanitizeAuctionPanoramaUrl(b.photos360EmbedExteriorUrl))
    .find((u): u is string => !!u)
    ?? splitAuctionPanoramaUrls(photos360EmbedUrl).exterior;
  const photos360EmbedInteriorUrl = [...valid]
    .map((b) => sanitizeAuctionPanoramaUrl(b.photos360EmbedInteriorUrl))
    .find((u): u is string => !!u)
    ?? splitAuctionPanoramaUrls(photos360EmbedUrl).interior;
  const photos = excludeSpinUrlsFromGallery(photosRaw, photos360Exterior, photos360Interior);
  const photosHd = excludeSpinUrlsFromGallery(photosHdRaw, photos360Exterior, photos360Interior);

  const frozenRate =
    valid.map((b) => readFrozenKrwPerUsd(b)).find((r) => r != null)
    ?? readFrozenKrwPerUsd(result);

  return {
    ...result,
    ...(odometer != null ? { odometer, mileage: odometer } : {}),
    ...(lockedBody ? { odometerLocked: true } : {}),
    mileageHistory,
    ownerHistory: concatUniqueArrays(...valid.map((b) => b.ownerHistory)),
    accidents: concatUniqueArrays(...valid.map((b) => b.accidents)),
    insuranceClaims: concatUniqueArrays(...valid.map((b) => b.insuranceClaims)),
    registryHistory: concatUniqueArrays(...valid.map((b) => b.registryHistory)),
    recallHistory: concatUniqueArrays(...valid.map((b) => b.recallHistory)),
    auctionHistory: concatUniqueArrays(...valid.map((b) => b.auctionHistory)),
    ...(photos.length > 0 ? { photos } : {}),
    ...(photosHd.length > 0 && photosHd.join("\0") !== photos.join("\0")
      ? { photosHd }
      : {}),
    ...(photos360Exterior.length > 0 ? { photos360Exterior } : {}),
    ...(photos360Interior.length > 0 ? { photos360Interior } : {}),
    ...(photos360EmbedUrl ? { photos360EmbedUrl } : {}),
    ...(photos360EmbedExteriorUrl ? { photos360EmbedExteriorUrl } : {}),
    ...(photos360EmbedInteriorUrl ? { photos360EmbedInteriorUrl } : {}),
    ...(frozenRate != null ? { krwPerUsd: frozenRate } : {}),
  };
}

export function pickRicherVinReportData(
  catalogData: Record<string, unknown> | null | undefined,
  lookupData: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!catalogData && !lookupData) return null;
  if (!catalogData) return lookupData!;
  if (!lookupData) return catalogData;
  const catalogScore = vinReportDataRichnessScore(catalogData);
  const lookupScore = vinReportDataRichnessScore(lookupData);
  const picked = lookupScore !== catalogScore
    ? (lookupScore > catalogScore ? lookupData : catalogData)
    : catalogData;

  const mergedPhotosRaw = mergeVinPhotoLists(
    lookupData.photos as string[] | undefined,
    catalogData.photos as string[] | undefined,
  );
  const mergedPhotosHdRaw = mergeVinPhotoLists(
    lookupData.photosHd as string[] | undefined,
    catalogData.photosHd as string[] | undefined,
  );
  const merged360Exterior = mergeVinPhotoListsWithCap(
    MAX_VIN_SPIN_PHOTOS,
    lookupData.photos360Exterior as string[] | undefined,
    catalogData.photos360Exterior as string[] | undefined,
  );
  const merged360Interior = mergeVinPhotoListsWithCap(
    MAX_VIN_SPIN_PHOTOS,
    lookupData.photos360Interior as string[] | undefined,
    catalogData.photos360Interior as string[] | undefined,
  );
  const merged360EmbedUrl =
    sanitizeAuctionPanoramaUrl(lookupData.photos360EmbedUrl)
    ?? sanitizeAuctionPanoramaUrl(catalogData.photos360EmbedUrl);
  const splitEmbed = splitAuctionPanoramaUrls(merged360EmbedUrl);
  const merged360EmbedExteriorUrl =
    sanitizeAuctionPanoramaUrl(lookupData.photos360EmbedExteriorUrl)
    ?? sanitizeAuctionPanoramaUrl(catalogData.photos360EmbedExteriorUrl)
    ?? splitEmbed.exterior;
  const merged360EmbedInteriorUrl =
    sanitizeAuctionPanoramaUrl(lookupData.photos360EmbedInteriorUrl)
    ?? sanitizeAuctionPanoramaUrl(catalogData.photos360EmbedInteriorUrl)
    ?? splitEmbed.interior;
  const mergedPhotos = excludeSpinUrlsFromGallery(
    mergedPhotosRaw,
    merged360Exterior,
    merged360Interior,
  );
  const mergedPhotosHd = excludeSpinUrlsFromGallery(
    mergedPhotosHdRaw,
    merged360Exterior,
    merged360Interior,
  );

  const frozenRate =
    readFrozenKrwPerUsd(picked)
    ?? readFrozenKrwPerUsd(catalogData)
    ?? readFrozenKrwPerUsd(lookupData);

  const result: Record<string, unknown> = {
    ...picked,
    ...(mergedPhotos.length > 0 ? { photos: mergedPhotos } : {}),
    ...(mergedPhotosHd.length > 0 && mergedPhotosHd.join("\0") !== mergedPhotos.join("\0")
      ? { photosHd: mergedPhotosHd }
      : {}),
    ...(merged360Exterior.length > 0 ? { photos360Exterior: merged360Exterior } : {}),
    ...(merged360Interior.length > 0 ? { photos360Interior: merged360Interior } : {}),
    ...(merged360EmbedUrl ? { photos360EmbedUrl: merged360EmbedUrl } : {}),
    ...(merged360EmbedExteriorUrl ? { photos360EmbedExteriorUrl: merged360EmbedExteriorUrl } : {}),
    ...(merged360EmbedInteriorUrl ? { photos360EmbedInteriorUrl: merged360EmbedInteriorUrl } : {}),
    ...(frozenRate != null && readFrozenKrwPerUsd(picked) == null ? { krwPerUsd: frozenRate } : {}),
  };

  return result;
}

/**
 * Pick report body for API serve — merges catalog + lookup so admin mileage
 * edits on either record always appear on the VIN page.
 */
export function pickVinReportDataForServe(
  catalogData: Record<string, unknown> | null | undefined,
  catalogUpdatedAt: Date | null | undefined,
  lookupData: Record<string, unknown> | null | undefined,
  lookupUpdatedAt: Date | null | undefined,
): Record<string, unknown> | null {
  if (!catalogData && !lookupData) return null;
  if (!catalogData) return lookupData!;
  if (!lookupData) return catalogData;

  const catalogMs = catalogUpdatedAt?.getTime() ?? 0;
  const lookupMs = lookupUpdatedAt?.getTime() ?? 0;

  // Newer body overlays older; merge always takes max odometer + union histories.
  if (lookupMs >= catalogMs) {
    return mergeVinReportBodies(catalogData, lookupData);
  }
  return mergeVinReportBodies(lookupData, catalogData);
}

/** Merge catalog with the viewer's lookup — do not blend other users' snapshots. */
export async function enrichVinReportDataForServe(
  vin: string,
  primaryData: Record<string, unknown> | null | undefined,
  opts?: { primaryUpdatedAt?: Date | null },
): Promise<Record<string, unknown> | null> {
  if (!primaryData) return null;

  const normalizedVin = vin.toUpperCase();
  const catalogEntry = await getCatalogVin(normalizedVin);
  const catalogData = (catalogEntry?.data as Record<string, unknown> | null) ?? null;
  const catalogUpdatedAt = catalogEntry?.updatedAt ?? null;
  const primaryUpdatedAt = opts?.primaryUpdatedAt ?? null;

  const merged = pickVinReportDataForServe(
    catalogData,
    catalogUpdatedAt,
    primaryData,
    primaryUpdatedAt,
  ) ?? primaryData;
  return applyMissingFloodFlagsForServe(merged) ?? merged;
}

/** Push stamped catalog report data to every lookup row for a VIN (admin save / publish). */
export async function syncStampedCatalogToAllLookups(
  vin: string,
  stamped: Record<string, unknown>,
  updatedAt: Date,
  opts?: { promoteLookupIds?: number[]; promoteAllPendingManual?: boolean },
): Promise<void> {
  const normalizedVin = vin.trim().toUpperCase();
  const currentRate = readFrozenKrwPerUsd(stamped) ?? await getCurrentKrwPerUsd();
  const promoteSet = new Set(opts?.promoteLookupIds ?? []);
  const lookups = await db
    .select()
    .from(vinLookupsTable)
    .where(eq(vinLookupsTable.vin, normalizedVin));

  // Same per-row updates as before — batched so a popular VIN cannot open dozens of writes at once.
  await mapInBatches(lookups, 25, async (lookup) => {
    const lookupData = (lookup.data ?? {}) as Record<string, unknown>;
    const lookupPayload = applyFrozenKrwPerUsd(stamped, {
      existingRate: readFrozenKrwPerUsd(lookupData),
      currentRate,
    });
    const patch: {
      data: Record<string, unknown>;
      updatedAt: Date;
      status?: string;
      providerName?: string;
      fromCache?: boolean;
    } = { data: lookupPayload, updatedAt };
    if (
      promoteSet.has(lookup.id)
      || (opts?.promoteAllPendingManual && lookup.status === "pending_manual")
    ) {
      patch.status = "complete";
      patch.providerName = "admin";
      patch.fromCache = true;
    }
    await db.update(vinLookupsTable).set(patch).where(eq(vinLookupsTable.id, lookup.id));
  });
}

/** Revoke every client lookup + completed payment for a VIN (catalog removal). */
export async function revokeAllClientAccessForVin(vin: string): Promise<{
  lookupsRevoked: number;
  paymentsRevoked: number;
}> {
  const normalizedVin = vin.trim().toUpperCase();
  const now = new Date();

  const lookupRows = await db
    .update(vinLookupsTable)
    .set({ status: "revoked", data: null, updatedAt: now })
    .where(and(eq(vinLookupsTable.vin, normalizedVin), ne(vinLookupsTable.status, "revoked")))
    .returning({ id: vinLookupsTable.id });

  const paymentRows = await db
    .update(paymentsTable)
    .set({ status: "revoked", updatedAt: now })
    .where(and(eq(paymentsTable.vin, normalizedVin), eq(paymentsTable.status, "completed")))
    .returning({ id: paymentsTable.id });

  return { lookupsRevoked: lookupRows.length, paymentsRevoked: paymentRows.length };
}

/** Batch revoke for many VINs (catalog bulk delete). */
export async function revokeAllClientAccessForVins(vins: string[]): Promise<{
  lookupsRevoked: number;
  paymentsRevoked: number;
}> {
  const normalized = [...new Set(vins.map((v) => v.trim().toUpperCase()).filter(Boolean))];
  if (normalized.length === 0) return { lookupsRevoked: 0, paymentsRevoked: 0 };

  const now = new Date();
  const lookupRows = await db
    .update(vinLookupsTable)
    .set({ status: "revoked", data: null, updatedAt: now })
    .where(and(inArray(vinLookupsTable.vin, normalized), ne(vinLookupsTable.status, "revoked")))
    .returning({ id: vinLookupsTable.id });

  const paymentRows = await db
    .update(paymentsTable)
    .set({ status: "revoked", updatedAt: now })
    .where(and(inArray(paymentsTable.vin, normalized), eq(paymentsTable.status, "completed")))
    .returning({ id: paymentsTable.id });

  return { lookupsRevoked: lookupRows.length, paymentsRevoked: paymentRows.length };
}

/** Full site wipe when a VIN leaves the catalog — revoke clients, drop stored data, sitemap + image cache. */
export async function wipeRemovedCatalogVin(
  vin: string,
  catalogData?: unknown,
): Promise<{
  lookupsRevoked: number;
  paymentsRevoked: number;
  sitemapUpdated: boolean;
}> {
  const normalized = vin.trim().toUpperCase();
  const lookupRows = await db
    .select({ data: vinLookupsTable.data })
    .from(vinLookupsTable)
    .where(eq(vinLookupsTable.vin, normalized));

  const photoUrls = [
    ...extractVinPhotoUrls(catalogData),
    ...lookupRows.flatMap((row) => extractVinPhotoUrls(row.data)),
  ];

  const revoked = await revokeAllClientAccessForVin(normalized);
  await invalidateVinImageCache(photoUrls);
  const sitemapUpdated = removeVinFromSitemaps(normalized);

  return { ...revoked, sitemapUpdated };
}

/** Batch wipe for catalog bulk delete. */
export async function wipeRemovedCatalogVins(
  entries: Array<{ vin: string; data?: unknown }>,
): Promise<{
  lookupsRevoked: number;
  paymentsRevoked: number;
  sitemapsUpdated: number;
}> {
  let lookupsRevoked = 0;
  let paymentsRevoked = 0;
  let sitemapsUpdated = 0;
  for (const entry of entries) {
    const result = await wipeRemovedCatalogVin(entry.vin, entry.data);
    lookupsRevoked += result.lookupsRevoked;
    paymentsRevoked += result.paymentsRevoked;
    if (result.sitemapUpdated) sitemapsUpdated += 1;
  }
  return { lookupsRevoked, paymentsRevoked, sitemapsUpdated };
}

export type VinReportServeBundle = {
  dataSource: Record<string, unknown>;
  providerName: string | null;
  inCatalog: boolean;
  mediaVersion?: number;
};

/** Catalog entry only — public previews and SEO must not leak removed VINs via orphaned lookups. */
export async function vinHasReportData(vin: string): Promise<VinReportServeBundle | null> {
  const normalized = vin.trim().toUpperCase();
  const catalogEntry = await getCatalogVin(normalized);
  const catalogData = (catalogEntry?.data as Record<string, unknown> | null) ?? null;
  if (!catalogData) return null;

  const dataSource = await enrichVinReportDataForServe(normalized, catalogData, {
    primaryUpdatedAt: catalogEntry?.updatedAt,
  });
  if (!dataSource) return null;

  return {
    dataSource,
    providerName: catalogEntry.providerName ?? null,
    inCatalog: true,
    mediaVersion: mediaVersionFromUpdatedAt(catalogEntry.updatedAt),
  };
}

/**
 * Resolve report payload for a viewer — signed-in user's own lookup when catalog
 * preview is missing (admin assign, pending_manual); otherwise catalog preview only.
 */
export async function resolveVinReportForViewer(
  vin: string,
  userId?: string | null,
): Promise<VinReportServeBundle | null> {
  const normalized = vin.trim().toUpperCase();

  if (userId) {
    const [owned] = await db
      .select()
      .from(vinLookupsTable)
      .where(and(
        eq(vinLookupsTable.userId, userId),
        eq(vinLookupsTable.vin, normalized),
        or(
          eq(vinLookupsTable.status, "complete"),
          eq(vinLookupsTable.status, "pending_manual"),
        ),
      ))
      .orderBy(desc(vinLookupsTable.updatedAt), desc(vinLookupsTable.createdAt))
      .limit(1);

    const ownedData = (owned?.data as Record<string, unknown> | null) ?? null;
    if (owned?.data && ownedData) {
      const dataSource = await enrichVinReportDataForServe(normalized, ownedData, {
        primaryUpdatedAt: owned.updatedAt,
      });
      if (dataSource) {
        const catalogEntry = await getCatalogVin(normalized);
        return {
          dataSource,
          providerName: owned.providerName ?? catalogEntry?.providerName ?? null,
          inCatalog: !!catalogEntry?.data,
          mediaVersion: mediaVersionFromUpdatedAt(owned.updatedAt),
        };
      }
    }
  }

  return vinHasReportData(vin);
}

/** Carstat-hosted mirror previews (not full Copart/IAAI/Encar gallery URLs). */
export function isCarstatMirroredPreviewUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (/i2\.carstat\.dev/i.test(trimmed)) return true;
  return /carstat\.dev/i.test(trimmed) && /\.webp(?:$|[?#])/i.test(trimmed);
}

/**
 * Carstat often stores only a few webp previews in catalog while
 * Copart/IAAI/Encar still expose a full gallery upstream (big/normal tiers).
 */
export function isPartialCarstatPhotoCache(
  data: Record<string, unknown> | null | undefined,
): boolean {
  if (!data) return false;
  const photos = data.photos;
  if (!Array.isArray(photos) || photos.length === 0 || photos.length >= 8) return false;
  const urls = photos.filter((p): p is string => typeof p === "string" && p.trim().length > 0);
  if (urls.length === 0) return false;
  return urls.every(isCarstatMirroredPreviewUrl);
}

/**
 * Heuristic for incomplete/partial catalog rows (sparse Carstat previews, missing
 * auction 360, stale KR). Paid lookup never re-fetches on this — only admin
 * `force` refresh bypasses local catalog/cache.
 */
export function isStaleCachedReport(
  data: Record<string, unknown> | null | undefined,
): boolean {
  if (!data) return false;
  if (isPartialCarstatPhotoCache(data)) return true;
  if (isMissingAuction360Media(data)) return true;
  return isStaleKoreanReport(data);
}

function reportHasUsable360Media(data: Record<string, unknown>): boolean {
  const ext = Array.isArray(data.photos360Exterior) ? data.photos360Exterior.length : 0;
  const int = Array.isArray(data.photos360Interior) ? data.photos360Interior.length : 0;
  if (ext >= 8 || int >= 8) return true;
  return !!(
    sanitizeAuctionPanoramaUrl(data.photos360EmbedUrl)
    || sanitizeAuctionPanoramaUrl(data.photos360EmbedExteriorUrl)
    || sanitizeAuctionPanoramaUrl(data.photos360EmbedInteriorUrl)
  );
}

function reportLooksLikeNaAuction(data: Record<string, unknown>): boolean {
  const mileage = data.mileageHistory;
  if (Array.isArray(mileage)) {
    for (const row of mileage) {
      if (!row || typeof row !== "object") continue;
      if ((row as Record<string, unknown>).source === "na_auction") return true;
    }
  }
  const auctions = data.auctionHistory;
  if (Array.isArray(auctions) && auctions.length > 0) {
    const country = String(data.country ?? "").toLowerCase();
    if (country === "us" || country === "usa" || country === "ca" || country === "canada") {
      return true;
    }
  }
  // Photo hosts from IAAI/Copart catalogs even when history arrays were trimmed.
  const photos = Array.isArray(data.photos) ? data.photos : [];
  for (const p of photos) {
    if (typeof p !== "string") continue;
    if (/iaai\.com|copart\.com|\/iaai\/|\/copart\//i.test(p)) return true;
  }
  return false;
}

/**
 * Older catalog rows from IAAI/Copart often have still photos but no 360 frames/embed
 * (IAAI now ships `external_panorama_url` with null exterior/interior arrays).
 */
export function isMissingAuction360Media(
  data: Record<string, unknown> | null | undefined,
): boolean {
  if (!data) return false;
  if (reportHasUsable360Media(data)) return false;
  if (!reportLooksLikeNaAuction(data)) return false;
  const photos = Array.isArray(data.photos) ? data.photos.length : 0;
  return photos >= 8;
}

/**
 * Korean Encar reports cached before registry extraction often have insurance/owners
 * but an empty registryHistory. Used by `isStaleCachedReport` for admin diagnostics;
 * paid lookup still serves these rows as-is.
 */
export function isStaleKoreanReport(data: Record<string, unknown> | null | undefined): boolean {
  if (!data) return false;
  const country = String(data.country ?? "").toLowerCase();
  if (country !== "kr") return false;

  const photoUrls = Array.isArray(data.photos)
    ? data.photos.filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    : [];
  const photoLen = photoUrls.length;
  const registry = data.registryHistory;
  const registryLen = Array.isArray(registry) ? registry.length : 0;
  const claims = data.insuranceClaims;
  const claimsLen = Array.isArray(claims) ? claims.length : 0;
  const ownerCount = Number(data.ownerCount ?? data.owners ?? 0);

  if (photoLen > 0 && photoLen < 8) {
    // Carstat often caches 2 webp previews while the full Encar gallery exists upstream.
    if (photoUrls.some(isCarstatMirroredPreviewUrl)) return true;
    if (registryLen > 0) return true;
  }

  if (registryLen > 0) {
    const expectedMin = claimsLen + (ownerCount > 1 ? 2 : 0) + 2;
    if (claimsLen >= 2 && registryLen < Math.min(expectedMin, 10)) return true;
    return false;
  }

  if (claimsLen > 0) return true;
  if (ownerCount > 1) return true;
  const ownerHistory = data.ownerHistory;
  if (Array.isArray(ownerHistory) && ownerHistory.length > 1) return true;
  return false;
}

/** Detect legacy rows where nested values were wrongly stringified as "[object Object]". */
export function vinDataHasCorruptObjectMarker(value: unknown, depth = 0): boolean {
  if (depth > 32) return false;
  if (value == null) return false;
  if (typeof value === "string") return value.includes("[object Object]");
  if (typeof value !== "object") return false;
  if (Array.isArray(value)) {
    return value.some((item) => vinDataHasCorruptObjectMarker(item, depth + 1));
  }
  for (const child of Object.values(value as Record<string, unknown>)) {
    if (vinDataHasCorruptObjectMarker(child, depth + 1)) return true;
  }
  return false;
}

async function markVinLookupCorrupt(lookupId: number, vin: string): Promise<void> {
  await db.update(vinLookupsTable)
    .set({ dataCorrupt: true, updatedAt: new Date() })
    .where(eq(vinLookupsTable.id, lookupId))
    .catch((err) => logger.warn({ err, vin }, "Failed to mark data_corrupt on vin lookup"));
}

function isCorruptCachedVinRow(
  row: { id: number; data: unknown; dataCorrupt: boolean },
  vin: string,
): boolean {
  if (row.dataCorrupt === true) {
    logger.warn({ vin }, "Cached VIN marked data_corrupt; treating as cache miss");
    return true;
  }
  if (vinDataHasCorruptObjectMarker(row.data)) {
    logger.warn({ vin }, "Stale cached VIN result contains [object Object]; marking data_corrupt");
    void markVinLookupCorrupt(row.id, vin);
    return true;
  }
  return false;
}

const catalogPeekHintSelect = {
  make: sql<string | null>`${vinCatalogTable.data}->>'make'`,
  model: sql<string | null>`${vinCatalogTable.data}->>'model'`,
  year: sql<unknown>`${vinCatalogTable.data}->'year'`,
  fulfillmentPending: sql<boolean | null>`(${vinCatalogTable.data}->>'fulfillmentPending')::boolean`,
  accidentsLen: sql<number>`jsonb_array_length(COALESCE(${vinCatalogTable.data}->'accidents', '[]'::jsonb))`,
  mileageLen: sql<number>`jsonb_array_length(COALESCE(${vinCatalogTable.data}->'mileageHistory', '[]'::jsonb))`,
  ownerLen: sql<number>`jsonb_array_length(COALESCE(${vinCatalogTable.data}->'ownerHistory', '[]'::jsonb))`,
  claimsLen: sql<number>`jsonb_array_length(COALESCE(${vinCatalogTable.data}->'insuranceClaims', '[]'::jsonb))`,
  registryLen: sql<number>`jsonb_array_length(COALESCE(${vinCatalogTable.data}->'registryHistory', '[]'::jsonb))`,
  auctionLen: sql<number>`jsonb_array_length(COALESCE(${vinCatalogTable.data}->'auctionHistory', '[]'::jsonb))`,
  serviceLen: sql<number>`jsonb_array_length(COALESCE(${vinCatalogTable.data}->'serviceHistory', '[]'::jsonb))`,
  photosLen: sql<number>`jsonb_array_length(COALESCE(${vinCatalogTable.data}->'photos', '[]'::jsonb))`,
};

export type VinPeekCacheSource = {
  status: string;
  make: string | null;
  model: string | null;
  year: unknown;
};

export type VinCatalogPeekHint = CatalogDeliverableHint & {
  deliverable: boolean;
};

/** Peek/preview path — identity fields only, no full report blob over the wire. */
export async function getCachedVinForPeek(vin: string): Promise<VinPeekCacheSource | null> {
  const normalized = vin.toUpperCase();
  const results = await db
    .select({
      id: vinLookupsTable.id,
      status: vinLookupsTable.status,
      dataCorrupt: vinLookupsTable.dataCorrupt,
      make: sql<string | null>`${vinLookupsTable.data}->>'make'`,
      model: sql<string | null>`${vinLookupsTable.data}->>'model'`,
      year: sql<unknown>`${vinLookupsTable.data}->'year'`,
    })
    .from(vinLookupsTable)
    .where(eq(vinLookupsTable.vin, normalized))
    .orderBy(desc(vinLookupsTable.updatedAt), desc(vinLookupsTable.createdAt))
    .limit(1);
  const row = results[0];
  if (!row) return null;
  if (row.dataCorrupt) {
    logger.warn({ vin: normalized }, "Cached VIN marked data_corrupt; treating as cache miss");
    return null;
  }
  return { status: row.status, make: row.make, model: row.model, year: row.year };
}

export async function getCatalogVinPeekHint(vin: string): Promise<VinCatalogPeekHint | null> {
  const results = await db
    .select(catalogPeekHintSelect)
    .from(vinCatalogTable)
    .where(eq(vinCatalogTable.vin, vin.toUpperCase()))
    .limit(1);
  const row = results[0];
  if (!row) return null;
  const hint: CatalogDeliverableHint = {
    fulfillmentPending: row.fulfillmentPending === true,
    accidentsLen: Number(row.accidentsLen) || 0,
    mileageLen: Number(row.mileageLen) || 0,
    ownerLen: Number(row.ownerLen) || 0,
    claimsLen: Number(row.claimsLen) || 0,
    registryLen: Number(row.registryLen) || 0,
    auctionLen: Number(row.auctionLen) || 0,
    serviceLen: Number(row.serviceLen) || 0,
    photosLen: Number(row.photosLen) || 0,
    make: row.make,
    model: row.model,
    year: row.year,
  };
  return { ...hint, deliverable: catalogDeliverableFromHint(hint) };
}

export type VinPreviewCacheSource = {
  status: string;
  updatedAt: Date;
  make: string | null;
  model: string | null;
  year: unknown;
  country: string | null;
  firstPhoto: string | null;
};

/** Preview card — scalar identity + first photo URL, not the full gallery/history blob. */
export async function getCachedVinForPreview(vin: string): Promise<VinPreviewCacheSource | null> {
  const normalized = vin.toUpperCase();
  const results = await db
    .select({
      id: vinLookupsTable.id,
      status: vinLookupsTable.status,
      updatedAt: vinLookupsTable.updatedAt,
      dataCorrupt: vinLookupsTable.dataCorrupt,
      make: sql<string | null>`${vinLookupsTable.data}->>'make'`,
      model: sql<string | null>`${vinLookupsTable.data}->>'model'`,
      year: sql<unknown>`${vinLookupsTable.data}->'year'`,
      country: sql<string | null>`${vinLookupsTable.data}->>'country'`,
      firstPhoto: sql<string | null>`${vinLookupsTable.data}->'photos'->>0`,
    })
    .from(vinLookupsTable)
    .where(eq(vinLookupsTable.vin, normalized))
    .orderBy(desc(vinLookupsTable.updatedAt), desc(vinLookupsTable.createdAt))
    .limit(1);
  const row = results[0];
  if (!row) return null;
  if (row.dataCorrupt) {
    logger.warn({ vin: normalized }, "Cached VIN marked data_corrupt; treating as cache miss");
    return null;
  }
  return {
    status: row.status,
    updatedAt: row.updatedAt,
    make: row.make,
    model: row.model,
    year: row.year,
    country: row.country,
    firstPhoto: row.firstPhoto,
  };
}

/**
 * Newest reusable local report for this VIN (any user).
 * Only `complete` rows — ignores newer fulfilling/error/pending_manual so a second
 * payer still unlocks from the first successful report without calling the provider.
 */
export async function getCachedVin(vin: string) {
  const normalized = vin.toUpperCase();
  const results = await db
    .select()
    .from(vinLookupsTable)
    .where(and(
      eq(vinLookupsTable.vin, normalized),
      eq(vinLookupsTable.status, "complete"),
    ))
    .orderBy(desc(vinLookupsTable.updatedAt), desc(vinLookupsTable.createdAt))
    .limit(8);

  for (const row of results) {
    if (isCorruptCachedVinRow({ id: row.id, dataCorrupt: row.dataCorrupt, data: row.data }, normalized)) {
      continue;
    }
    const data = row.data as Record<string, unknown> | null;
    if (!catalogHasDeliverableReport(data)) continue;
    return row;
  }

  return null;
}

export type GrantVinReportResult =
  | { status: "created"; lookupId: number; fromCache: boolean; vin: string }
  | { status: "already_exists"; lookupId: number; vin: string };

/** Grant a user a complete VIN report — catalog/cache first, provider fetch only when needed. */
export async function grantVinReportToUser(
  userId: string,
  vin: string,
  options?: { adminId?: string },
): Promise<GrantVinReportResult> {
  const normalizedVin = vin.trim().toUpperCase();
  if (normalizedVin.length !== 17) {
    throw Object.assign(new Error("Valid 17-character VIN is required"), { code: "INVALID_VIN" });
  }

  const [existing] = await db.select({ id: vinLookupsTable.id })
    .from(vinLookupsTable)
    .where(and(
      eq(vinLookupsTable.userId, userId),
      eq(vinLookupsTable.vin, normalizedVin),
      eq(vinLookupsTable.status, "complete"),
    ))
    .limit(1);

  if (existing) {
    return { status: "already_exists", lookupId: existing.id, vin: normalizedVin };
  }

  const catalogEntry = await getCatalogVin(normalizedVin);
  const catalogData = (catalogEntry?.data as Record<string, unknown> | null) ?? null;
  if (catalogEntry && catalogData && catalogHasDeliverableReport(catalogData)) {
    const currentRate = await getCurrentKrwPerUsd();
    const stamped = applyFrozenKrwPerUsd(catalogData, {
      existingRate: readFrozenKrwPerUsd(catalogData),
      currentRate,
    });
    const [lookup] = await db.insert(vinLookupsTable).values({
      vin: normalizedVin,
      userId,
      status: "complete",
      data: stamped,
      providerName: catalogEntry.providerName,
      fromCache: true,
      paymentId: null,
    }).returning();
    logger.info({ msg: "admin_grant_vin", source: "catalog", vin: normalizedVin, userId, lookupId: lookup.id });
    return { status: "created", lookupId: lookup.id, fromCache: true, vin: normalizedVin };
  }

  const cached = await getCachedVin(normalizedVin);
  const cachedPayload = (cached?.data as Record<string, unknown> | null) ?? null;
  if (cachedPayload) {
    const currentRate = await getCurrentKrwPerUsd();
    const stamped = applyFrozenKrwPerUsd(cachedPayload, {
      existingRate: readFrozenKrwPerUsd(cachedPayload),
      currentRate,
    });
    const [lookup] = await db.transaction(async (tx) => {
      await upsertVinCatalog(normalizedVin, cached.providerName, stamped);
      return tx.insert(vinLookupsTable).values({
        vin: normalizedVin,
        userId,
        status: "complete",
        data: stamped,
        providerName: cached.providerName,
        fromCache: true,
        paymentId: null,
      }).returning();
    });
    logger.info({ msg: "admin_grant_vin", source: "lookup_cache", vin: normalizedVin, userId, lookupId: lookup.id });
    return { status: "created", lookupId: lookup.id, fromCache: true, vin: normalizedVin };
  }

  const providers = await db.select().from(providersTable).where(eq(providersTable.isActive, true)).limit(1);
  const provider = providers[0];
  if (!provider?.apiKey?.trim()) {
    throw Object.assign(new Error("No active VIN provider configured"), { code: "NO_PROVIDER" });
  }

  if (options?.adminId) {
    const { consumeAdminProviderAction, adminProviderRateLimitMessage } = await import("./adminProviderRateLimit.js");
    if (!consumeAdminProviderAction(options.adminId)) {
      throw Object.assign(new Error(adminProviderRateLimitMessage()), { code: "PROVIDER_RATE_LIMIT" });
    }
  }

  const data = await fetchFromProvider(normalizedVin, provider.baseUrl, provider.apiKey);
  const currentRate = await getCurrentKrwPerUsd();
  const stamped = applyFrozenKrwPerUsd(data as unknown as Record<string, unknown>, { currentRate });
  const [lookup] = await db.transaction(async (tx) => {
    await upsertVinCatalog(normalizedVin, provider.name, stamped);
    return tx.insert(vinLookupsTable).values({
      vin: normalizedVin,
      userId,
      status: "complete",
      data: stamped,
      providerName: provider.name,
      fromCache: false,
      paymentId: null,
    }).returning();
  });
  logger.info({ msg: "admin_grant_vin", source: "provider", vin: normalizedVin, userId, lookupId: lookup.id });
  return { status: "created", lookupId: lookup.id, fromCache: false, vin: normalizedVin };
}

function providerHeaders(apiKey: string) {
  return { Accept: "application/json", "x-api-key": apiKey };
}

/** Carstat VIN history API lives on carstat.dev (not api.carstat.dev). */
function normalizeProviderBaseUrl(baseUrl: string): string {
  const validated = assertValidProviderBaseUrl(baseUrl);
  return validated.replace(/\/$/, "").replace("://api.carstat.dev", "://carstat.dev");
}

/** Laravel 404 when /api/local-* route is missing on the provider host. */
function isDeprecatedRoute404(status: number, text: string): boolean {
  return status === 404 && /could not be found/i.test(text);
}

function localExistsUrl(base: string, vin: string): string {
  return `${base}/api/local-exists/${encodeURIComponent(vin)}`;
}

function localReportUrl(base: string, vin: string): string {
  return `${base}/api/local-report/${encodeURIComponent(vin)}`;
}

export type LocalExistsResult =
  | { status: "exists" }
  | { status: "not_found" }
  | { status: "no_access"; hint?: string }
  | { status: "unavailable"; reason: string };

/** Safe for any client/payment JSON — never include vendor name, host, or API paths. */
export const PUBLIC_VIN_CHECK_UNAVAILABLE =
  "VIN check is temporarily unavailable. Please try again later.";

/** Which external archive has the VIN (after local catalog miss). */
export type VinExternalSource = "getcarapi" | "carstat";

export type VinExternalProbeResult =
  | { status: "exists"; source: VinExternalSource }
  | { status: "not_found" }
  | { status: "unavailable"; reason: string };

/**
 * Cascade (free checks only): GetCarAPI → Carstat.
 * If GetCarAPI has the VIN, Carstat is never called.
 */
export async function probeExternalVinAvailability(vin: string): Promise<VinExternalProbeResult> {
  const { checkGetCarApiExists, resolveGetCarApiConfig } = await import("./getcarApi.js");
  const normalized = vin.trim().toUpperCase();

  let getCarMissed = true;
  let getCarDown = false;

  // Admin disable / missing key → skip entirely (catalog → Carstat → pending).
  if (await resolveGetCarApiConfig()) {
    const gca = await checkGetCarApiExists(normalized);
    if (gca.status === "exists") {
      return { status: "exists", source: "getcarapi" };
    }
    if (gca.status === "not_found") {
      getCarMissed = true;
    } else {
      getCarDown = true;
      getCarMissed = false;
      logger.warn({ msg: "getcarapi_probe_unavailable", vin: normalized, reason: gca.reason });
    }
  }

  const [provider] = await db.select().from(providersTable)
    .where(and(eq(providersTable.isActive, true)))
    .orderBy(providersTable.id)
    .limit(1);

  if (provider?.apiKey?.trim()) {
    const exists = await checkLocalExists(normalized, provider.baseUrl, provider.apiKey);
    if (exists.status === "exists") {
      return { status: "exists", source: "carstat" };
    }
    if (exists.status === "not_found") {
      return { status: "not_found" };
    }
    // Carstat down: if GetCarAPI already said not_found, treat as not_found → pending path.
    if (getCarMissed) return { status: "not_found" };
    return { status: "unavailable", reason: exists.reason || PUBLIC_VIN_CHECK_UNAVAILABLE };
  }

  if (getCarMissed) return { status: "not_found" };
  if (getCarDown) return { status: "unavailable", reason: PUBLIC_VIN_CHECK_UNAVAILABLE };
  return { status: "not_found" };
}

function parseProviderReportError(status: number, text: string): LocalExistsResult | null {
  if (status === 403) {
    try {
      const body = JSON.parse(text) as { error?: string; balance?: number };
      if (/balance/i.test(body.error ?? text)) {
        return { status: "unavailable", reason: PUBLIC_VIN_CHECK_UNAVAILABLE };
      }
    } catch { /* fall through */ }
    return { status: "unavailable", reason: PUBLIC_VIN_CHECK_UNAVAILABLE };
  }

  if (status === 404) {
    try {
      const body = JSON.parse(text) as { error?: string; hint?: string };
      if (/empty lots/i.test(body.hint ?? "")) {
        return { status: "no_access", hint: body.hint ?? undefined };
      }
      if (body.error === "vin not found") {
        return { status: "not_found" };
      }
    } catch { /* fall through */ }
    return { status: "not_found" };
  }

  return null;
}

/** Post-payment only — fetches the paid report and costs provider tokens. Never call before payment. */
async function checkLocalReportAvailable(
  vin: string,
  base: string,
  apiKey: string,
): Promise<LocalExistsResult> {
  const url = localReportUrl(base, vin);
  const headers = providerHeaders(apiKey);

  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
    const text = await res.text();

    if (res.ok) {
      logger.info({ msg: "local_report_ok", vin, base });
      return { status: "exists" };
    }

    if (isDeprecatedRoute404(res.status, text)) {
      logger.warn({ msg: "local_report_route_missing", vin, base });
      return { status: "unavailable", reason: PUBLIC_VIN_CHECK_UNAVAILABLE };
    }

    const parsed = parseProviderReportError(res.status, text);
    if (parsed) {
      if (parsed.status === "no_access") {
        logger.info({ msg: "local_report_no_lots_for_key", vin, hint: parsed.hint });
      }
      return parsed;
    }

    logger.warn({ msg: "local_report_error", vin, status: res.status, body: text.slice(0, 120) });
    return { status: "unavailable", reason: PUBLIC_VIN_CHECK_UNAVAILABLE };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ msg: "local_report_fetch_failed", vin, err: msg });
    return { status: "unavailable", reason: PUBLIC_VIN_CHECK_UNAVAILABLE };
  }
}

/** Admin/diagnostic only — probes local-exists then local-report (costs tokens). Not used at checkout. */
export async function checkVinDeliverable(
  vin: string,
  providerBaseUrl: string,
  apiKey: string,
): Promise<LocalExistsResult> {
  const exists = await checkLocalExists(vin, providerBaseUrl, apiKey);
  if (exists.status !== "exists") return exists;

  const base = normalizeProviderBaseUrl(providerBaseUrl);
  return checkLocalReportAvailable(vin, base, apiKey);
}

function parseLocalExistsBody(body: unknown): boolean | null {
  if (body == null || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const raw = record.exists ?? record.available ?? record.found;
  if (raw === true || raw === 1 || raw === "true" || raw === "1") return true;
  if (raw === false || raw === 0 || raw === "false" || raw === "0") return false;
  return null;
}

/** Short TTL cache so checkout peek + create-pok/PayPal create share one local-exists call. */
const LOCAL_EXISTS_CACHE_TTL_MS = 10 * 60_000;
const localExistsCache = new Map<string, { expiresAt: number; result: LocalExistsResult }>();

function localExistsCacheKey(vin: string, providerBaseUrl: string): string {
  return `${normalizeProviderBaseUrl(providerBaseUrl)}|${vin.toUpperCase()}`;
}

function readLocalExistsCache(vin: string, providerBaseUrl: string): LocalExistsResult | null {
  const key = localExistsCacheKey(vin, providerBaseUrl);
  const hit = localExistsCache.get(key);
  if (!hit) return null;
  if (Date.now() >= hit.expiresAt) {
    localExistsCache.delete(key);
    return null;
  }
  return hit.result;
}

function writeLocalExistsCache(vin: string, providerBaseUrl: string, result: LocalExistsResult): void {
  // Only cache definitive answers — never "unavailable" (would stick a transient outage).
  if (result.status !== "exists" && result.status !== "not_found") return;
  localExistsCache.set(localExistsCacheKey(vin, providerBaseUrl), {
    expiresAt: Date.now() + LOCAL_EXISTS_CACHE_TTL_MS,
    result,
  });
}

/** Strict pre-payment gate — local-exists only, no fail-open. */
export async function checkLocalExists(
  vin: string,
  providerBaseUrl: string,
  apiKey: string,
): Promise<LocalExistsResult> {
  const base = normalizeProviderBaseUrl(providerBaseUrl);
  const cached = readLocalExistsCache(vin, base);
  if (cached) {
    logger.info({ msg: "local_exists_cache_hit", vin, status: cached.status });
    return cached;
  }

  const url = localExistsUrl(base, vin);
  const headers = providerHeaders(apiKey);

  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    const text = await res.text();

    if (res.ok) {
      try {
        const body = JSON.parse(text) as unknown;
        const exists = parseLocalExistsBody(body);
        if (exists === true) {
          logger.info({ msg: "local_exists_ok", vin, base });
          const result = { status: "exists" as const };
          writeLocalExistsCache(vin, base, result);
          return result;
        }
        if (exists === false) {
          logger.info({ msg: "local_exists_false", vin });
          const result = { status: "not_found" as const };
          writeLocalExistsCache(vin, base, result);
          return result;
        }
        logger.warn({ msg: "local_exists_unexpected_body", vin, body: text.slice(0, 120) });
        return { status: "unavailable", reason: PUBLIC_VIN_CHECK_UNAVAILABLE };
      } catch {
        logger.warn({ msg: "local_exists_bad_json", vin, status: res.status, body: text.slice(0, 120) });
        return { status: "unavailable", reason: PUBLIC_VIN_CHECK_UNAVAILABLE };
      }
    }

    if (isDeprecatedRoute404(res.status, text)) {
      logger.warn({
        msg: "local_exists_route_missing",
        vin,
        base,
        hint: "Provider base URL may be wrong — check admin provider settings",
      });
      return { status: "unavailable", reason: PUBLIC_VIN_CHECK_UNAVAILABLE };
    }

    if (res.status === 404) {
      const result = { status: "not_found" as const };
      writeLocalExistsCache(vin, base, result);
      return result;
    }

    logger.warn({ msg: "local_exists_error", vin, status: res.status, body: text.slice(0, 120) });
    return { status: "unavailable", reason: PUBLIC_VIN_CHECK_UNAVAILABLE };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ msg: "local_exists_fetch_failed", vin, err: msg });
    return { status: "unavailable", reason: PUBLIC_VIN_CHECK_UNAVAILABLE };
  }
}

async function fetchLocalReport(
  vin: string,
  base: string,
  apiKey: string,
): Promise<Record<string, unknown>> {
  const url = localReportUrl(base, vin);
  const headers = providerHeaders(apiKey);
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  const text = await res.text();

  if (res.ok) {
    const body = JSON.parse(text) as Record<string, unknown>;
    if (body.error) {
      throw new Error("No vehicle history data found for this VIN in our database.");
    }
    return body;
  }

  if (isDeprecatedRoute404(res.status, text)) {
    logger.warn({ msg: "local_report_route_missing", vin, base });
    throw new Error(PUBLIC_VIN_CHECK_UNAVAILABLE);
  }

  const parsed = parseProviderReportError(res.status, text);
  if (parsed?.status === "no_access") {
    throw new Error(PUBLIC_VIN_CHECK_UNAVAILABLE);
  }
  if (parsed?.status === "not_found") {
    throw new Error("No vehicle history data found for this VIN in our database.");
  }
  if (parsed?.status === "unavailable") {
    throw new Error(PUBLIC_VIN_CHECK_UNAVAILABLE);
  }

  logger.warn({ msg: "local_report_unexpected_status", vin, status: res.status, body: text.slice(0, 200) });
  throw new Error(PUBLIC_VIN_CHECK_UNAVAILABLE);
}

export async function fetchFromProvider(
  vin: string,
  providerBaseUrl: string,
  apiKey: string,
  opts?: {
    force?: boolean;
    preferredSource?: VinExternalSource | null;
    /** When true with preferredSource, never fall back to the other provider (admin refresh). */
    strictSource?: boolean;
  },
): Promise<NormalizedVinData> {
  const normalized = vin.trim().toUpperCase();
  return withGlobalVinProviderLock(normalized, async () => {
    // `force` (admin "Refresh from provider") always calls the provider and bypasses
    // the catalog cache, so a partial catalog row can be fully repaired.
    if (!opts?.force) {
      const catalogEntry = await getCatalogVin(normalized);
      const catalogData = (catalogEntry?.data as Record<string, unknown> | null) ?? null;
      if (catalogEntry && catalogData && catalogHasDeliverableReport(catalogData)) {
        // Catalog stores NormalizedVinData (or legacy Carstat raw with lots).
        if (Array.isArray(catalogData.lots)) {
          return normalizeCarstatResponse(catalogData);
        }
        if (catalogData.vehicle && typeof catalogData.vehicle === "object" && catalogData.make == null) {
          const { normalizeGetCarApiResponse } = await import("./getcarApi.js");
          return normalizeGetCarApiResponse(catalogData);
        }
        return catalogData as unknown as NormalizedVinData;
      }
    }

    const { fetchGetCarApiReport, normalizeGetCarApiResponse, resolveGetCarApiConfig } =
      await import("./getcarApi.js");

    let source: VinExternalSource | null = opts?.preferredSource ?? null;
    if (!source) {
      const probe = await probeExternalVinAvailability(normalized);
      if (probe.status === "exists") source = probe.source;
    }

    const getCarCfg = await resolveGetCarApiConfig();

    // GetCarAPI hit → try retrieve; on rate-limit/credits/transient, fall through to Carstat if configured.
    if (source === "getcarapi" && getCarCfg) {
      try {
        const body = await fetchGetCarApiReport(normalized);
        return normalizeGetCarApiResponse(body);
      } catch (err) {
        const code = err && typeof err === "object" && "code" in err
          ? String((err as { code?: unknown }).code ?? "")
          : "";
        const canFallbackToCarstat =
          !opts?.strictSource
          && !!apiKey?.trim()
          && code !== "VIN_NO_DATA"
          && (
            code === "PROVIDER_RATE_LIMIT"
            || code === "PROVIDER_CREDITS"
            || (err instanceof Error && /rate limited|credits exhausted|timeout|fetch failed|network/i.test(err.message))
          );
        if (canFallbackToCarstat) {
          logger.warn(
            { err, vin: normalized },
            "GetCarAPI retrieve failed — falling back to Carstat",
          );
        } else {
          logger.error({ err, vin: normalized }, "Error fetching from GetCarAPI");
          throw err;
        }
      }
    } else if (source === "getcarapi" && opts?.strictSource) {
      throw new Error("GetCarAPI is not configured");
    }

    // Carstat path (or GetCarAPI miss / retrieve fallback / not configured).
    // Strict GetCarAPI admin refresh must never overwrite with Carstat.
    if (opts?.strictSource && opts.preferredSource === "getcarapi") {
      throw new Error("GetCarAPI refresh did not return data");
    }
    if (source === "carstat" || source === "getcarapi" || !source) {
      if (!apiKey?.trim()) {
        throw Object.assign(new Error("No vehicle history data found for this VIN in our database."), {
          code: "VIN_NO_DATA",
        });
      }
      const base = normalizeProviderBaseUrl(providerBaseUrl);
      try {
        const body = await fetchLocalReport(normalized, base, apiKey);
        return normalizeCarstatResponse(body);
      } catch (err) {
        logger.error({ err, vin: normalized, providerBaseUrl }, "Error fetching from provider");
        throw err;
      }
    }

    throw new Error("No vehicle history data found for this VIN in our database.");
  });
}

export type VinPayableResult =
  | { ok: true; mode: "standard" | "manual_pending" }
  | { ok: false; code: "ALREADY_UNLOCKED"; lookupId?: number | null }
  | { ok: false; code: "VIN_NO_DATA" }
  | { ok: false; code: "VIN_CHECK_UNAVAILABLE"; reason: string };

/** Server-side gate before creating a payment — local-exists only (free). Report fetch is post-payment. */
export async function ensureVinPayableForPayment(userId: string, vin: string): Promise<VinPayableResult> {
  const normalizedVin = vin.toUpperCase();

  const [[completedLookup], [pendingLookup], [completedPmt]] = await Promise.all([
    db.select({ id: vinLookupsTable.id })
      .from(vinLookupsTable)
      .where(and(
        eq(vinLookupsTable.userId, userId),
        eq(vinLookupsTable.vin, normalizedVin),
        eq(vinLookupsTable.status, "complete"),
      ))
      .orderBy(desc(vinLookupsTable.id))
      .limit(1),
    db.select({ id: vinLookupsTable.id })
      .from(vinLookupsTable)
      .where(and(
        eq(vinLookupsTable.userId, userId),
        eq(vinLookupsTable.vin, normalizedVin),
        eq(vinLookupsTable.status, "pending_manual"),
      ))
      .orderBy(desc(vinLookupsTable.id))
      .limit(1),
    db.select({ id: paymentsTable.id })
      .from(paymentsTable)
      .where(and(
        eq(paymentsTable.userId, userId),
        eq(paymentsTable.vin, normalizedVin),
        eq(paymentsTable.status, "completed"),
      ))
      .limit(1),
  ]);

  if (completedLookup || pendingLookup || completedPmt) {
    return { ok: false, code: "ALREADY_UNLOCKED", lookupId: completedLookup?.id ?? pendingLookup?.id ?? null };
  }

  const decodedYear = decodeVin(normalizedVin).year;
  if (isVehicleTooOldForLookup(decodedYear)) {
    return { ok: false, code: "VIN_NO_DATA" };
  }

  const catalogEntry = await getCatalogVin(normalizedVin);
  if (catalogEntry?.data && catalogHasDeliverableReport(catalogEntry.data)) {
    return { ok: true, mode: "standard" };
  }

  const probe = await probeExternalVinAvailability(normalizedVin);
  if (probe.status === "exists") return { ok: true, mode: "standard" };

  const { isVinEligibleForManualPending } = await import("./pendingVinService.js");
  const eligiblePending = await isVinEligibleForManualPending(normalizedVin);

  // not_found OR providers down/timeout → pending when decode is trustworthy (do not hard-fail checkout).
  if ((probe.status === "not_found" || probe.status === "unavailable") && eligiblePending) {
    return { ok: true, mode: "manual_pending" };
  }

  if (probe.status === "not_found") return { ok: false, code: "VIN_NO_DATA" };
  return { ok: false, code: "VIN_CHECK_UNAVAILABLE", reason: probe.reason || PUBLIC_VIN_CHECK_UNAVAILABLE };
}

// Parse a date value that may arrive as:
//   - ISO string: "2021-03-15" / "2021-03-15T00:00:00Z"
//   - Unix seconds: 1615766400
//   - Unix milliseconds: 1615766400000
// Returns an ISO date string ("YYYY-MM-DD") or null.
function parseDate(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    return parseDate(o.date ?? o.value ?? o.datetime ?? o.iso ?? o.name);
  }
  if (typeof raw === "number") {
    // YYYYMMDD integer from Korean providers (e.g. 20211030)
    if (raw >= 19_000_101 && raw <= 21_000_101) {
      const s = String(raw);
      if (s.length === 8) {
        return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
      }
    }
    // Unix seconds if <= 9999999999 (year ~2286), otherwise ms
    const ms = raw <= 9_999_999_999 ? raw * 1000 : raw;
    const d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    // YYYYMMDD compact date (common in Korean insurance payloads)
    if (/^\d{8}$/.test(trimmed)) {
      const y = trimmed.slice(0, 4);
      const m = trimmed.slice(4, 6);
      const d = trimmed.slice(6, 8);
      const month = Number(m);
      const day = Number(d);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${y}-${m}-${d}`;
      }
    }
    // Plain integer string — Unix seconds/ms only (9+ digits), not YYYYMMDD
    if (/^\d{9,13}$/.test(trimmed)) {
      const n = Number(trimmed);
      const ms = n <= 9_999_999_999 ? n * 1000 : n;
      const d = new Date(ms);
      if (isNaN(d.getTime())) return null;
      return d.toISOString().slice(0, 10);
    }
    const encarHeader = parseEncarMonthYearHeader(trimmed);
    if (encarHeader) return encarHeader;
    const monthDay2001 = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+2001$/i);
    if (monthDay2001) return null;
    // "January 20" without a 4-digit year defaults to year 2001 in JS — never guess
    if (/^[A-Za-z]+\s+\d{1,2}$/i.test(trimmed)) return null;
    const calendarIso = providerCalendarLabelToIso(trimmed);
    if (calendarIso) return calendarIso;
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return null;
    const iso = d.toISOString().slice(0, 10);
    const repaired = repairEncarMisParsedIsoDate(iso, null);
    return repaired ?? iso;
  }
  return null;
}

const LOT_EVENT_DATE_FIELDS = [
  "sale_date",
  "auction_date",
  "sold_date",
  "sold_at",
  "saleDate",
  "auctionDate",
] as const;

function parseLotPrimaryEventDate(lot: Record<string, unknown>): string | null {
  for (const key of LOT_EVENT_DATE_FIELDS) {
    const parsed = parseDate(lot[key]);
    if (parsed) return parsed;
  }
  return null;
}

/** Best available lot event date — US auctions use sale_date; Encar often leaves it null and uses bid/updated timestamps. */
export function resolveLotEventDate(lot: Record<string, unknown>): string | null {
  const saleD = parseLotPrimaryEventDate(lot);
  if (saleD) return saleD;

  const statusObj = (lot.status ?? {}) as Record<string, unknown>;
  const statusName = str(statusObj.name ?? lot.status)?.toLowerCase() ?? "";
  const hasFinalBid = Number(lot.final_bid) > 0;
  const naAuction = isNorthAmericanAuctionLot(lot);

  const bidTimestamp =
    parseDate(lot.final_bid_updated_at)
    ?? parseDate(lot.sale_date_updated_at)
    ?? parseDate(lot.updated_at);

  if (hasFinalBid && (statusName === "sold" || statusName === "sale" || naAuction)) {
    return bidTimestamp ?? parseDate(lot.created_at);
  }

  return parseDate(lot.updated_at) ?? parseDate(lot.created_at);
}

function pickBestMarketLot(lots: Array<Record<string, unknown>>): Record<string, unknown> | null {
  let best: Record<string, unknown> | null = null;
  let bestScore = -1;

  for (const lot of lots) {
    const finalBid = Number(lot.final_bid) || 0;
    const bid = Number(lot.bid) || 0;
    const buyNow = Number(lot.buy_now) || 0;
    const eventDate = resolveLotEventDate(lot);
    if (finalBid <= 0 && bid <= 0 && buyNow <= 0 && !eventDate) continue;

    let score = 0;
    if (isNorthAmericanAuctionLot(lot)) score += 1_000_000;
    if (finalBid > 0) score += 100_000 + Math.min(finalBid, 99_999);
    if (eventDate) score += 10_000 + (Date.parse(eventDate) || 0) / 1_000_000;
    if (buyNow > 0) score += 1_000;
    if (bid > 0) score += 100;

    if (score > bestScore) {
      bestScore = score;
      best = lot;
    }
  }

  return best;
}

function buildMarketDataFromLots(
  lots: Array<Record<string, unknown>>,
  repairedAuction: NormalizedVinData["auctionHistory"] | undefined,
  vehicleYear: number | null,
): NonNullable<NormalizedVinData["marketData"]> {
  const pricedAuction = (repairedAuction ?? []).find((e) => (e.finalPrice ?? 0) > 0);
  const bestLot = pickBestMarketLot(lots) ?? lots[0] ?? {};

  const lotFinalBid = Number(bestLot.final_bid) || null;
  const buyNow = Number(bestLot.buy_now) || null;
  const bid = Number(bestLot.bid) || null;
  const lotEventDate = resolveLotEventDate(bestLot);

  const lastAuctionPrice = pricedAuction?.finalPrice ?? lotFinalBid;
  const rawLastAuctionDate = pricedAuction?.date ?? lotEventDate;
  const lastAuctionDate = rawLastAuctionDate
    ? sanitizeReportIsoDate(rawLastAuctionDate, vehicleYear)
    : null;

  const estimatedValue =
    buyNow
    ?? bid
    ?? pricedAuction?.buyNowPrice
    ?? pricedAuction?.openingBid
    ?? null;

  return {
    estimatedValue,
    currency: "USD",
    lastAuctionPrice,
    lastAuctionDate,
  };
}

// Coerce a raw value to a non-empty string or null.
// Handles Carstat nested objects like { name: "Good", ko: "좋음" } by extracting .name/.en/.ko first;
// falls back to the first non-empty string-valued property for any other plain-object shape.
function str(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "object" && !Array.isArray(v)) {
    const obj = v as Record<string, unknown>;
    // Prefer labelled string fields in priority order
    for (const key of ["name", "en", "ko", "value", "label", "text", "title"]) {
      if (typeof obj[key] === "string") {
        const s = (obj[key] as string).trim();
        if (s.length > 0) return s;
      }
    }
    // Last resort: first non-empty string property
    for (const val of Object.values(obj)) {
      if (typeof val === "string") {
        const s = val.trim();
        if (s.length > 0) return s;
      }
    }
    return null;
  }
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

const LOT_GALLERY_IMAGE_TIERS = [
  "big", "large", "full", "original", "high", "normal", "downloaded", "gallery", "thumbnail", "small",
] as const;

/** Prefer largest available tier when counts tie (lightbox / zoom). */
const HD_TIER_QUALITY_RANK: Record<string, number> = {
  big: 60,
  large: 58,
  full: 56,
  original: 54,
  high: 50,
  normal: 40,
  downloaded: 20,
  gallery: 35,
  thumbnail: 10,
  small: 5,
};

/** Prefer mid-size tiers for hero/thumbs when counts tie (faster under concurrent load). */
const DISPLAY_TIER_QUALITY_RANK: Record<string, number> = {
  normal: 70,
  gallery: 65,
  high: 55,
  downloaded: 45,
  big: 30,
  large: 28,
  full: 26,
  original: 24,
  thumbnail: 15,
  small: 10,
};

/** Extract URL strings from Carstat image tier arrays (plain strings or { url } objects). */
export function extractLotImageUrls(raw: unknown): string[] {
  if (raw == null) return [];
  // Some tiers arrive as { "0": "https://...", "1": "..." } instead of arrays.
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return extractLotImageUrls(Object.values(raw as Record<string, unknown>));
  }
  if (!Array.isArray(raw)) return [];
  const urls: string[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (trimmed.length > 0) urls.push(trimmed);
      continue;
    }
    if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      for (const key of ["url", "src", "href", "link", "path", "image", "original", "imageUrl", "fullUrl"]) {
        if (typeof obj[key] === "string") {
          const trimmed = (obj[key] as string).trim();
          if (trimmed.length > 0) {
            urls.push(trimmed);
            break;
          }
        }
      }
    }
  }
  return urls;
}

function lotImagesRecord(lot: Record<string, unknown>): Record<string, unknown> {
  const raw = lot.images;
  if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (Array.isArray(raw)) {
    return { gallery: raw };
  }
  return {};
}

const INTERIOR_SPIN_KEY = /interior|i360|cabin|inside|in360|int360/;
const EXTERIOR_SPIN_KEY = /exterior|c360|outside|spin|ext360|e360/;
const INTERIOR_URL_HINT = /(?:^|[\/_\-.])(?:int(?:erior)?|i360|cabin|inside)(?:[\/_\-.]|$)/i;
const EXTERIOR_URL_HINT = /(?:^|[\/_\-.])(?:ext(?:erior)?|c360|outside)(?:[\/_\-.]|$)/i;

/** Hosts allowed for auction interactive 360° embeds (IAAI ThreeSixtyView, etc.). */
const AUCTION_PANORAMA_HOST_RE = /(?:^|\.)(?:iaai\.com|copart\.com)$/i;

/**
 * Keep only https auction panorama viewers — never pass through arbitrary URLs.
 */
export function sanitizeAuctionPanoramaUrl(raw: unknown): string | null {
  // Admin refresh once wrongly stored embed URLs as a 1-element photo array.
  const candidate = Array.isArray(raw) && raw.length > 0 ? raw[0] : raw;
  if (typeof candidate !== "string") return null;
  const trimmed = candidate.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return null;
    if (!AUCTION_PANORAMA_HOST_RE.test(parsed.hostname)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Split IAAI ThreeSixtyView `keys=SID-…~STP-1~INT-1` into exterior / interior embeds.
 * Copart-style URLs without STP/INT tokens return only `combined`.
 */
export function splitAuctionPanoramaUrls(raw: unknown): {
  combined: string | null;
  exterior: string | null;
  interior: string | null;
} {
  const combined = sanitizeAuctionPanoramaUrl(raw);
  if (!combined) return { combined: null, exterior: null, interior: null };

  try {
    const parsed = new URL(combined);
    const keys = parsed.searchParams.get("keys") ?? "";
    const parts = keys.split("~").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return { combined, exterior: null, interior: null };

    const sid = parts.find((p) => /^SID-/i.test(p)) ?? parts[0]!;
    const stp = parts.find((p) => /^STP-/i.test(p));
    const int = parts.find((p) => /^INT-/i.test(p));

    const build = (tokens: string[]): string | null => {
      if (tokens.length === 0) return null;
      const next = new URL(combined);
      next.searchParams.set("keys", tokens.join("~"));
      if (!next.searchParams.has("iframeview")) next.searchParams.set("iframeview", "true");
      return sanitizeAuctionPanoramaUrl(next.toString());
    };

    return {
      combined,
      exterior: stp ? build([sid, stp]) : null,
      interior: int ? build([sid, int]) : null,
    };
  } catch {
    return { combined, exterior: null, interior: null };
  }
}

/** IAAI often ships exterior/interior as null and puts both spins in external_panorama_url. */
export function extractLotPanoramaUrl(
  lot: Record<string, unknown>,
  imgs?: Record<string, unknown>,
): string | null {
  const images = imgs ?? lotImagesRecord(lot);
  const candidates = [
    images.external_panorama_url,
    images.externalPanoramaUrl,
    images.panorama_url,
    images.panoramaUrl,
    images.panorama,
    lot.external_panorama_url,
    lot.externalPanoramaUrl,
    lot.panorama_url,
    lot.panoramaUrl,
  ];
  for (const c of candidates) {
    const ok = sanitizeAuctionPanoramaUrl(c);
    if (ok) return ok;
  }
  return null;
}

/** When a provider dumps both spins into one tier, split by URL path hints. */
export function splitMixedSpinUrls(urls: string[]): { exterior: string[]; interior: string[] } {
  const interior: string[] = [];
  const exterior: string[] = [];
  const unknown: string[] = [];
  for (const url of urls) {
    const isInt = INTERIOR_URL_HINT.test(url);
    const isExt = EXTERIOR_URL_HINT.test(url);
    if (isInt && !isExt) interior.push(url);
    else if (isExt && !isInt) exterior.push(url);
    else unknown.push(url);
  }
  // Only trust the split when both sides look like real spins; otherwise keep original as exterior.
  if (interior.length >= 8 && (exterior.length + unknown.length) >= 8) {
    return { exterior: [...exterior, ...unknown], interior };
  }
  return { exterior: urls, interior: [] };
}

/**
 * Copart/IAAI 360° frame sets (exterior / interior). Kept separate from the main gallery —
 * these tiers can have 40–70+ near-duplicate angles and must not replace normal/big photos.
 */
export function extractLotSpinPhotoSets(imgs: Record<string, unknown>): {
  exterior: string[];
  interior: string[];
} {
  let exterior: string[] = [];
  let interior: string[] = [];

  for (const [key, value] of Object.entries(imgs)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    const urls = extractLotImageUrls(value);
    if (urls.length === 0) continue;

    if (INTERIOR_SPIN_KEY.test(normalized)) {
      if (urls.length > interior.length) interior = urls;
      continue;
    }
    if (EXTERIOR_SPIN_KEY.test(normalized)) {
      if (urls.length > exterior.length) exterior = urls;
    }
  }

  // Prefer explicit keys when present; fall back to legacy exact names.
  if (exterior.length === 0 || interior.length === 0) {
    const byLower = new Map<string, unknown>();
    for (const [key, value] of Object.entries(imgs)) {
      byLower.set(key.toLowerCase(), value);
    }
    if (exterior.length === 0) {
      exterior = extractLotImageUrls(
        byLower.get("exterior")
        ?? byLower.get("exterior_360")
        ?? byLower.get("exterior360")
        ?? byLower.get("c360")
        ?? byLower.get("spin"),
      ).slice(0, MAX_VIN_SPIN_PHOTOS);
    }
    if (interior.length === 0) {
      interior = extractLotImageUrls(
        byLower.get("interior")
        ?? byLower.get("interior_360")
        ?? byLower.get("interior360")
        ?? byLower.get("i360"),
      ).slice(0, MAX_VIN_SPIN_PHOTOS);
    }
  }

  // Some lots only expose one giant "exterior"/"spin" list that mixes cabin frames.
  if (interior.length === 0 && exterior.length >= 16) {
    const split = splitMixedSpinUrls(exterior);
    if (split.interior.length >= 8) {
      exterior = split.exterior;
      interior = split.interior;
    }
  }

  return {
    exterior: exterior.slice(0, MAX_VIN_SPIN_PHOTOS),
    interior: interior.slice(0, MAX_VIN_SPIN_PHOTOS),
  };
}

function pickLotPhotoUrlsByRank(
  imgs: Record<string, unknown>,
  qualityRank: Record<string, number>,
): string[] {
  let best: string[] = [];
  let bestRank = -1;

  for (const key of LOT_GALLERY_IMAGE_TIERS) {
    const urls = extractLotImageUrls(imgs[key]);
    if (urls.length === 0) continue;

    const rank = qualityRank[key] ?? 0;
    const shouldReplace =
      urls.length > best.length
      || (urls.length === best.length && rank > bestRank);

    if (shouldReplace) {
      best = urls;
      bestRank = rank;
    }
  }

  return best;
}

/**
 * Highest-resolution photo URL list for a single lot (one tier only).
 * Prefer the tier with the most URLs; on ties prefer big/normal over partial downloaded cache.
 * Never selects exterior/interior 360° tiers.
 */
export function pickBestLotPhotoUrls(imgs: Record<string, unknown>): string[] {
  return pickLotPhotoUrlsByRank(imgs, HD_TIER_QUALITY_RANK);
}

/** Mid-size gallery for hero/thumbs — prefers normal/gallery over big/original when counts tie. */
export function pickDisplayLotPhotoUrls(imgs: Record<string, unknown>): string[] {
  return pickLotPhotoUrlsByRank(imgs, DISPLAY_TIER_QUALITY_RANK);
}

// Collect unique photo URLs across lots — display (mid) + HD for lightbox.
function collectPhotosFromLot(
  lot: Record<string, unknown>,
  existingDisplay: string[],
  existingHd: string[],
): { display: string[]; hd: string[] } {
  const imgs = lotImagesRecord(lot);
  const spin = extractLotSpinPhotoSets(imgs);
  const spinUrls = new Set([...spin.exterior, ...spin.interior]);

  let display = collectPhotoList(imgs, existingDisplay, pickDisplayLotPhotoUrls)
    .filter((url) => !spinUrls.has(url));
  let hd = collectPhotoList(imgs, existingHd, pickBestLotPhotoUrls)
    .filter((url) => !spinUrls.has(url));
  if (Array.isArray(lot.photos)) {
    for (const p of extractLotImageUrls(lot.photos)) {
      if (spinUrls.has(p)) continue;
      if (!display.includes(p)) display.push(p);
      if (!hd.includes(p)) hd.push(p);
    }
  }
  return { display, hd };
}

function collectSpinPhotosFromLot(
  lot: Record<string, unknown>,
  existingExterior: string[],
  existingInterior: string[],
): { exterior: string[]; interior: string[] } {
  const spin = extractLotSpinPhotoSets(lotImagesRecord(lot));
  return {
    exterior: mergeVinPhotoListsWithCap(MAX_VIN_SPIN_PHOTOS, existingExterior, spin.exterior),
    interior: mergeVinPhotoListsWithCap(MAX_VIN_SPIN_PHOTOS, existingInterior, spin.interior),
  };
}

function collectPhotoList(
  imgs: Record<string, unknown>,
  existing: string[],
  picker: (imgs: Record<string, unknown>) => string[],
): string[] {
  const result = [...existing];
  for (const p of picker(imgs)) {
    if (!result.includes(p)) result.push(p);
  }
  return result;
}

/** Carstat Copart/IAAI lots use damage.main / damage.second; older shapes use flat strings. */
export function extractLotDamages(raw: unknown): {
  primary: string | null;
  secondary: string | null;
  combined: string | null;
} {
  if (raw == null) return { primary: null, secondary: null, combined: null };
  if (typeof raw === "string") {
    const s = raw.trim();
    return { primary: s || null, secondary: null, combined: s || null };
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const primary = str(o.main ?? o.primary ?? o.primaryDamage ?? o.primary_damage ?? o.first);
    const secondary = str(o.second ?? o.secondary ?? o.secondaryDamage ?? o.secondary_damage);
    if (primary || secondary) {
      const combined = [primary, secondary].filter(Boolean).join("; ");
      return { primary, secondary, combined: combined || null };
    }
    const flat = str(raw);
    return { primary: flat, secondary: null, combined: flat };
  }
  return { primary: null, secondary: null, combined: null };
}

export function extractLotTitle(lot: Record<string, unknown>): string | null {
  return str(lot.detailed_title) ?? str(lot.title) ?? str(lot.sale_title_type) ?? str(lot.document);
}

export function isSalvageTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  // NA auction title codes only — do not match bare "Bos" (Alberta bill of sale).
  return /salvage|rebuilt|junk|total\s*loss|non[- ]?repair|certificate\s+of\s+destruction|scrap|write[- ]?off/i.test(title);
}

/** Auction damage strings: Water/Flood, water damage, flood, etc. */
export function textIndicatesFlood(value: string | null | undefined): boolean {
  if (!value) return false;
  const t = value.trim();
  if (!t) return false;
  return /water\s*\/\s*flood|water\s*[- ]?\s*flood|water\s+damage|\bflood(?:ed|ing)?\b/i.test(t);
}

/** Title / certificate brands that explicitly mention flood (not bare salvage). */
export function titleIndicatesFlood(title: string | null | undefined): boolean {
  if (!title) return false;
  return /\bflood(?:ed|ing)?\b/i.test(title);
}

export function damageIndicatesFlood(
  primary?: string | null,
  secondary?: string | null,
  combined?: string | null,
): boolean {
  return textIndicatesFlood(primary)
    || textIndicatesFlood(secondary)
    || textIndicatesFlood(combined);
}

/** Accident type / primaryDamage flood tokens, or flood wording in damage/description. */
export function accidentIndicatesFlood(accident: {
  type?: string | null;
  primaryDamage?: string | null;
  secondaryDamage?: string | null;
  description?: string | null;
}): boolean {
  const type = (accident.type ?? "").trim().toLowerCase();
  if (type === "flood" || type === "water_flood" || /\bflood\b/.test(type)) return true;
  const primary = (accident.primaryDamage ?? "").trim().toLowerCase();
  if (primary === "flood" || primary === "water_flood") return true;
  return damageIndicatesFlood(accident.primaryDamage, accident.secondaryDamage)
    || textIndicatesFlood(accident.description);
}

export function mergeKoreanAndNaFloodFlags(
  korean: { isFlooded: boolean | null; floodCount: number | null; floodLossAmount: number | null },
  naFloodCount: number,
): { isFlooded: boolean | null; floodCount: number | null; floodLossAmount: number | null } {
  if (korean.isFlooded === true) return korean;
  if (naFloodCount > 0) {
    return {
      isFlooded: true,
      floodCount: naFloodCount,
      floodLossAmount: null,
    };
  }
  return korean;
}

function isNorthAmericanAuctionLot(lot: Record<string, unknown>): boolean {
  const loc = (lot.location ?? {}) as Record<string, unknown>;
  const countryObj = (loc.country ?? {}) as Record<string, unknown>;
  const iso = str(countryObj.iso)?.toLowerCase();
  const name = str(countryObj.name)?.toLowerCase() ?? "";
  if (iso === "us" || iso === "ca" || iso === "usa") return true;
  if (name.includes("united states") || name.includes("canada")) return true;
  const domain = (lot.domain ?? {}) as Record<string, unknown>;
  const domainName = str(domain.name)?.toLowerCase() ?? "";
  return domainName.includes("copart") || domainName.includes("iaai");
}

function lotDomainName(lot: Record<string, unknown>): string {
  const domain = (lot.domain ?? {}) as Record<string, unknown>;
  return str(domain.name)?.toLowerCase() ?? "";
}

const KM_PER_MILE = 1.60934;

/** Odometer from provider lot — supports km, miles, or nested odometer objects. */
export function parseLotOdometerKm(lot: Record<string, unknown>): number | null {
  const lotOdo = lot.odometer;
  if (lotOdo != null && typeof lotOdo === "object" && !Array.isArray(lotOdo)) {
    const o = lotOdo as Record<string, unknown>;
    const km = Number(o.km);
    if (Number.isFinite(km) && km > 0) return Math.round(km);
    const mi = Number(o.mi ?? o.miles);
    if (Number.isFinite(mi) && mi > 0) return Math.round(mi * KM_PER_MILE);
  }
  const flat = Number(lotOdo);
  if (Number.isFinite(flat) && flat > 0) return Math.round(flat);
  return null;
}

function extractLotCountryCode(lot: Record<string, unknown>): string | null {
  const loc = (lot.location ?? {}) as Record<string, unknown>;
  const countryObj = (loc.country ?? {}) as Record<string, unknown>;
  return str(countryObj.iso ?? countryObj.name);
}

/** Prefer the country seen on the most lots (any provider / marketplace). */
export function resolveVehicleCountry(lots: Array<Record<string, unknown>>): string | null {
  const counts = new Map<string, number>();
  for (const lot of lots) {
    const code = extractLotCountryCode(lot);
    if (!code) continue;
    const key = code.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = -1;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      best = key;
    }
  }
  return best;
}

function lotsHaveRegistryTimeline(lots: Array<Record<string, unknown>>): boolean {
  return pickLotHistoryBlocks(lots).length > 0;
}

function resolveOwnerHistoryFromLots(
  lots: Array<Record<string, unknown>>,
  insurance: Record<string, unknown>,
  auctionOwnerHistory: NonNullable<NormalizedVinData["ownerHistory"]>,
): NonNullable<NormalizedVinData["ownerHistory"]> {
  const fromRegistryTimeline = extractKoreanOwnerHistory(lots, insurance);
  if (fromRegistryTimeline.length === 0) return auctionOwnerHistory;
  if (auctionOwnerHistory.length === 0) return fromRegistryTimeline;
  return dedupeOwnerHistory([...fromRegistryTimeline, ...auctionOwnerHistory]);
}

/** Marketplace relists (Encar, etc.) — not separate auction events. */
function isMarketplaceListingLot(lot: Record<string, unknown>): boolean {
  if (isNorthAmericanAuctionLot(lot)) return false;
  const domain = lotDomainName(lot);
  return domain.length > 0 && !domain.includes("copart") && !domain.includes("iaai");
}

function inspectSummaryFlag(value: unknown): "yes" | "no" | "unknown" {
  const s = str(value)?.toLowerCase().replace(/'/g, "") ?? "";
  if (!s) return "unknown";
  if (s === "yes" || s === "y" || s === "true" || s === "1") return "yes";
  if (s === "doesnt exist" || s === "does not exist" || s === "no" || s === "n" || s === "false" || s === "0") {
    return "no";
  }
  return "unknown";
}

/** Encar / Korean performance inspection — structural accident vs cosmetic repair. */
export function parseKoreanInspectAccident(details: Record<string, unknown> | null | undefined): {
  hasStructuralAccident: boolean;
  hasMinorRepair: boolean;
  description: string | null;
} {
  const inspect = (details?.inspect ?? {}) as Record<string, unknown>;
  const summary = (inspect.accident_summary ?? {}) as Record<string, unknown>;
  if (!Object.keys(summary).length) {
    return { hasStructuralAccident: false, hasMinorRepair: false, description: null };
  }

  const accident = inspectSummaryFlag(summary.accident);
  const framework = inspectSummaryFlag(summary.main_framework);
  const exterior2 = inspectSummaryFlag(summary.exterior2rank);
  const simpleRepair = inspectSummaryFlag(summary.simple_repair);

  const hasStructuralAccident = accident === "yes" || framework === "yes";
  const hasMinorRepair = exterior2 === "yes" || simpleRepair === "yes";

  const parts: string[] = [];
  if (hasStructuralAccident) parts.push("structural accident flagged on inspection");
  if (framework === "yes") parts.push("main framework damage");
  if (exterior2 === "yes") parts.push("exterior panel repair");
  if (simpleRepair === "yes") parts.push("simple repair noted");

  return {
    hasStructuralAccident,
    hasMinorRepair,
    description: parts.length ? parts.join("; ") : null,
  };
}

const KR_INSURANCE_CLAIM_TYPES: Record<string, string> = {
  "1": "insurance_own_damage",
  "2": "insurance_third_party",
  "3": "insurance_third_party_own_damage",
};

export function isKoreanInsuranceClaimRecord(record: Record<string, unknown>): boolean {
  const typeCode = str(record.type);
  const hasPayout = record.insuranceBenefit != null
    || record.partCost != null
    || record.laborCost != null
    || record.paintingCost != null;
  return hasPayout && /^[123]$/.test(typeCode ?? "");
}

function mapKoreanInsuranceClaim(
  record: Record<string, unknown>,
): NonNullable<NormalizedVinData["insuranceClaims"]>[number] {
  const typeCode = str(record.type);
  const partCost = Number(record.partCost) || null;
  const laborCost = Number(record.laborCost) || null;
  const paintingCost = Number(record.paintingCost) || null;
  const lossAmount = sanitizeKoreanRepairKrwAmount(Number(record.insuranceBenefit) || null, {
    partCost,
    laborCost,
    paintingCost,
  });
  const costParts: string[] = [];
  if (partCost) costParts.push(`parts ₩${partCost.toLocaleString()}`);
  if (laborCost) costParts.push(`labor ₩${laborCost.toLocaleString()}`);
  if (paintingCost) costParts.push(`paint ₩${paintingCost.toLocaleString()}`);

  const rawDate = str(record.date);
  return {
    date: rawDate ? normalizeEventDate(rawDate) : parseDate(record.date),
    type: (typeCode && KR_INSURANCE_CLAIM_TYPES[typeCode]) ?? typeCode,
    lossAmount,
    partCost,
    laborCost,
    paintingCost,
    description: costParts.length ? costParts.join(", ") : null,
  };
}

type VinAccident = NonNullable<NormalizedVinData["accidents"]>[number];
type VinInsuranceClaim = NonNullable<NormalizedVinData["insuranceClaims"]>[number];

function inferKoreanLossSeverity(amount: number | null | undefined): string | null {
  return inferAccidentSeverityFromLossAmount(amount, { amountCurrency: "KRW" });
}

function inferUsdLossSeverity(amount: number | null | undefined): string | null {
  return inferAccidentSeverityFromLossAmount(amount, { amountCurrency: "USD" });
}

function parseWonAmount(value: string | null | undefined): number | null {
  return sanitizeKoreanRepairKrwAmount(parseKrwAmountFromText(value));
}

export function mapKoreanInsuranceClaimToAccident(
  claim: VinInsuranceClaim,
  country: string | null,
  opts?: { totalLossDate?: string | null },
): VinAccident {
  let severity = inferKoreanLossSeverity(claim.lossAmount);
  const lossDate = opts?.totalLossDate?.slice(0, 10);
  const claimDate = claim.date?.slice(0, 10);
  if (lossDate && claimDate === lossDate) {
    severity = "total_loss";
  }
  return {
    date: claim.date ?? null,
    severity,
    description: claim.type ?? claim.description ?? null,
    country,
    type: "insurance",
    primaryDamage: null,
    secondaryDamage: null,
    airbagDeployed: null,
    odometerAtLoss: null,
    lossAmount: claim.lossAmount ?? null,
  };
}

export function registryEventIndicatesAccident(event: RegistryHistoryEvent): boolean {
  if (event.type === "insurance_event") return true;
  const blob = [
    event.title,
    event.subtitle,
    event.amount,
    ...(event.details ?? []).map((row) => `${row.label} ${row.value}`),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /\b(accident|collision|damage|repair cost|insurance processing|own damage|third.party|insurance event)\b/.test(blob);
}

export function resolveRegistryAccidentLossAmount(event: RegistryHistoryEvent): number | null {
  const repairDetail = event.details?.find((row) => isRegistryRepairCostLabel(row.label));
  if (repairDetail?.value) {
    return parseWonAmount(repairDetail.value);
  }
  if (event.amount && isRegistryRepairCostLabel(event.amount)) {
    return parseWonAmount(event.amount);
  }
  return null;
}

export function mapRegistryEventToAccident(
  event: RegistryHistoryEvent,
  country: string | null,
): VinAccident | null {
  if (!registryEventIndicatesAccident(event)) return null;

  const lossAmount = resolveRegistryAccidentLossAmount(event);

  return {
    date: normalizeEventDate(event.date ?? null),
    severity: inferKoreanLossSeverity(lossAmount),
    description: event.title ?? event.subtitle ?? null,
    country,
    type: "registry",
    primaryDamage: null,
    secondaryDamage: null,
    airbagDeployed: null,
    odometerAtLoss: event.mileage ?? null,
    lossAmount,
  };
}

function buildKoreanSupplementalAccidents(
  insuranceClaims: VinInsuranceClaim[],
  registryHistory: RegistryHistoryEvent[],
  country: string | null,
  totalLossDate?: string | null,
): VinAccident[] {
  const fromClaims = insuranceClaims.map((claim) =>
    mapKoreanInsuranceClaimToAccident(claim, country, { totalLossDate }),
  );
  const claimDateKeys = new Set(
    fromClaims
      .map((accident) => (accident.date ?? "").slice(0, 10))
      .filter(Boolean),
  );
  const fromRegistry = registryHistory
    .map((event) => mapRegistryEventToAccident(event, country))
    .filter((event): event is VinAccident => {
      if (!event) return false;
      const dateKey = (event.date ?? "").slice(0, 10);
      if (dateKey && claimDateKeys.has(dateKey)) return false;
      return true;
    });
  return dedupeAccidents([...fromClaims, ...fromRegistry]);
}

function mapStandardInsuranceAccident(
  record: Record<string, unknown>,
  country: string | null,
  totalLoss: number,
): NonNullable<NormalizedVinData["accidents"]>[number] {
  const rawSeverity = str(record.severity ?? record.damage_type ?? record.damageType);
  const odometerAtLoss = Number(record.odometerAtLoss ?? record.odometer_at_loss ?? record.odometer ?? record.mileage) || null;
  const lossAmount = Number(record.lossAmount ?? record.loss_amount ?? record.amount ?? record.damage_amount ?? record.insuranceBenefit) || null;

  let severity: string | null;
  if (totalLoss > 0) {
    severity = "total_loss";
  } else if (lossAmount != null && lossAmount > 0) {
    severity = inferUsdLossSeverity(lossAmount);
  } else if (rawSeverity) {
    severity = rawSeverity;
  } else {
    // No loss amount and no provider severity — do not invent "minor".
    severity = null;
  }

  let airbagDeployed: boolean | null = null;
  const rawAirbag = record.airbag_deployed ?? record.airbagDeployed ?? record.airbags_deployed;
  if (rawAirbag != null) {
    if (typeof rawAirbag === "boolean") airbagDeployed = rawAirbag;
    else if (typeof rawAirbag === "number") airbagDeployed = rawAirbag > 0;
    else if (typeof rawAirbag === "string") airbagDeployed = /^(yes|true|1|deployed)$/i.test(rawAirbag.trim());
  }

  return {
    date: parseDate(record.date ?? record.occurrenceDate ?? record.accident_date ?? record.date_of_loss),
    severity,
    description: str(record.description ?? record.damageInfo ?? record.damage_description),
    country,
    type: str(record.type ?? record.accidentType ?? record.accident_type),
    primaryDamage: str(record.primaryDamage ?? record.primary_damage ?? record.primary_damage_location),
    secondaryDamage: str(record.secondaryDamage ?? record.secondary_damage ?? record.secondary_damage_location),
    airbagDeployed,
    odometerAtLoss,
    lossAmount,
  };
}

export type RegistryHistoryEvent = NonNullable<NormalizedVinData["registryHistory"]>[number];

const REGISTRY_AMOUNT_KEYS = [
  "total repair cost",
  "New car list price",
  "New car delivery price",
  "New car shipping",
  "New car list price",
] as const;

const REGISTRY_MILEAGE_KEYS = [
  "Driving distance during inspection",
  "Driving distance when changing",
  "Drown distance when changing",
  "Drone during inspection",
  "Mileage during inspection",
] as const;

const REGISTRY_LOCATION_KEYS = [
  "Address at time of purchase",
  "Address after change",
  "Address when purchasing",
] as const;

function stripHtmlText(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function isMeaningfulProviderText(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  const s = String(value).trim();
  if (!s || s === "[object Object]") return false;
  const lower = s.toLowerCase();
  if (lower === "no information" || lower === "n/a" || lower === "none" || lower === "unknown" || lower === "not available") {
    return false;
  }
  if (/^no\s+.+\s+information$/i.test(s)) return false;
  return true;
}

function cleanProviderMultiline(value: string | null): string | null {
  if (!value) return null;
  const lines = value.split(/\n/).map((line) => line.trim()).filter((line) => isMeaningfulProviderText(line));
  if (lines.length === 0) return null;
  return lines.join("\n");
}

function strField(record: Record<string, unknown>, key: string): string | null {
  const v = record[key];
  if (!isMeaningfulProviderText(v)) return null;
  if (typeof v === "string") return v.trim();
  return String(v).trim();
}

export function classifyKoreanRegistryTitle(title: string): string {
  const t = title.toLowerCase().replace(/\s+/g, " ").trim();
  if (/new car (delivery|shipment)/.test(t)) return "new_car_delivery";
  if (/car inspection completed|automobile inspection completed/.test(t)) return "inspection";
  if (/change registration/.test(t)) return "registration_change";
  if (t === "ownership" || /owner change/.test(t)) return "owner_change";
  if (/no car insurance|non[\s-]*insurance/.test(t)) return "no_insurance";
  if (/insurance processing|repair processing/.test(t)) return "insurance_event";
  return "other";
}

/** Encar/KOTSA recall rows — excluded from stored and displayed registry timelines. */
export function isKoreanRecallRegistryItem(item: Record<string, unknown>): boolean {
  const title = (strField(item, "title") ?? "").toLowerCase();
  const sub = (strField(item, "sub") ?? "").toLowerCase();
  const flag = (strField(item, "flag") ?? "").toLowerCase();
  if (/recall/.test(title) || /recall/.test(sub) || /recall/.test(flag)) return true;
  if (strField(item, "Recall date") || strField(item, "recall post date")) return true;
  return false;
}

function applyEncarDateRepairs<T extends { date?: string | null }>(
  items: T[] | undefined,
  vehicleYear: number | null,
): T[] | undefined {
  if (!items?.length) return items;
  return items.map((item) => ({
    ...item,
    date: sanitizeReportIsoDate(item.date ?? null, vehicleYear),
  }));
}

export function isKoreanRecallRegistryEvent(event: RegistryHistoryEvent): boolean {
  if (event.type === "recall") return true;
  const title = (event.title ?? "").toLowerCase();
  const subtitle = (event.subtitle ?? "").toLowerCase();
  if (/recall/.test(title) || /recall/.test(subtitle)) return true;
  return (event.details ?? []).some((row) => /recall/i.test(row.label));
}


function isKoreanOwnershipTitle(title: string): boolean {
  const t = title.toLowerCase().replace(/\s+/g, " ").trim();
  if (!t) return false;
  return t === "ownership"
    || /owner change/.test(t)
    || /change of ownership/.test(t)
    || /ownership transfer/.test(t)
    || /change of owner/.test(t)
    || /owner\s*transfer/.test(t)
    // ImportMotor / Encar first registration — counts as ownership timeline entry
    || /first vehicle number/.test(t)
    || /first registration/.test(t)
    // Korean Encar titles
    || /소유/.test(title)
    || /명의/.test(title);
}

function collectInsuranceBlocksFromLots(
  lots: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const blocks: Array<Record<string, unknown>> = [];
  for (const lot of lots) {
    const details = (lot.details ?? {}) as Record<string, unknown>;
    const candidates = [details.insurance_v2, details.insurance, lot.insurance_v2, lot.insurance];
    for (const candidate of candidates) {
      if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
        blocks.push(candidate as Record<string, unknown>);
      }
    }
  }
  return blocks;
}

/** Parse insurance_v2.ownerChanges whether strings, CSV, or `{ date }` objects. */
function parseInsuranceOwnerChangeDates(
  insurance: Record<string, unknown>,
): string[] {
  const raw = insurance.ownerChanges ?? insurance.owner_changes;
  const dates: string[] = [];

  const pushDate = (value: unknown) => {
    if (typeof value === "string" || typeof value === "number") {
      const text = String(value).trim();
      if (!text) return;
      // CSV / multi-date strings
      if (/[,;|]/.test(text) && !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        for (const part of text.split(/[,;|]/)) {
          const d = normalizeEventDate(part.trim());
          if (d) dates.push(d);
        }
        return;
      }
      const d = normalizeEventDate(text);
      if (d) dates.push(d);
      return;
    }
    if (value && typeof value === "object") {
      const o = value as Record<string, unknown>;
      const d = normalizeEventDate(
        str(o.date)
        ?? str(o.changeDate)
        ?? str(o.ownerChangeDate)
        ?? str(o.ChangeDate)
        ?? str(o.change_date),
      );
      if (d) dates.push(d);
    }
  };

  if (Array.isArray(raw)) {
    for (const item of raw) pushDate(item);
  } else if (raw != null) {
    pushDate(raw);
  }

  // Plate / car-number change dates often align with ownership transfers on Encar.
  const carInfo = insurance.carInfoChanges ?? insurance.car_info_changes;
  if (Array.isArray(carInfo)) {
    for (const row of carInfo) {
      if (row && typeof row === "object") {
        pushDate((row as Record<string, unknown>).date);
      }
    }
  }

  return dates;
}

function pickLotHistoryBlocks(lots: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const seenContent = new Set<string>();
  const groups: Array<Record<string, unknown>> = [];

  for (const lot of lots) {
    const details = (lot.details ?? {}) as Record<string, unknown>;
    const history = Array.isArray(details.history) ? details.history as Array<Record<string, unknown>> : [];
    for (const group of history) {
      const groupDate = normalizeHistoryGroupDate(strField(group, "date"));
      const content = Array.isArray(group.content) ? group.content as Array<Record<string, unknown>> : [];
      const uniqueContent: Array<Record<string, unknown>> = [];
      for (const item of content) {
        const fp = historyContentFingerprint(item);
        if (seenContent.has(fp)) continue;
        seenContent.add(fp);
        uniqueContent.push(item);
      }
      if (uniqueContent.length > 0) {
        groups.push({
          ...group,
          ...(groupDate ? { date: groupDate } : {}),
          content: uniqueContent,
        });
      }
    }
  }

  return groups;
}

function fingerprintDateField(value: string | null): string {
  if (!value) return "";
  return normalizeEventDate(value) ?? value.trim().toLowerCase();
}

function historyContentFingerprint(item: Record<string, unknown>): string {
  const title = (strField(item, "title") ?? "").toLowerCase().replace(/\s+/g, " ");
  const changeDate = fingerprintDateField(strField(item, "Change date") ?? strField(item, "Date of change"));
  const inspectionDate = fingerprintDateField(strField(item, "Inspection date"));
  const occurrenceDate = fingerprintDateField(strField(item, "Date of occurrence"));
  const recallDate = fingerprintDateField(strField(item, "Recall date") ?? strField(item, "recall post date"));
  const mileage = REGISTRY_MILEAGE_KEYS
    .map((key) => strField(item, key))
    .filter(Boolean)
    .join("|");
  const sub = strField(item, "sub") ?? "";
  const subMileage = parseKmFromText(sub) ?? parseKmFromText(title);
  const repairCost = strField(item, "Total repair cost") ?? "";
  return `${title}|${changeDate}|${inspectionDate}|${occurrenceDate}|${recallDate}|${mileage}|${subMileage ?? ""}|${sub.slice(0, 80)}|${repairCost}`;
}

const HISTORY_MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function historyDateSortKey(date: string | null | undefined): number {
  if (!date) return Number.NEGATIVE_INFINITY;
  const trimmed = date.trim();
  if (!trimmed) return Number.NEGATIVE_INFINITY;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const ts = Date.parse(`${trimmed}T12:00:00`);
    return Number.isNaN(ts) ? Number.NEGATIVE_INFINITY : ts;
  }

  if (/^\d{8}$/.test(trimmed)) {
    const y = trimmed.slice(0, 4);
    const m = trimmed.slice(4, 6);
    const d = trimmed.slice(6, 8);
    const ts = Date.parse(`${y}-${m}-${d}T12:00:00`);
    return Number.isNaN(ts) ? Number.NEGATIVE_INFINITY : ts;
  }

  const english = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2})(?:,\s*(\d{4}))?$/);
  if (english) {
    const month = HISTORY_MONTHS.indexOf(english[1]!.toLowerCase());
    if (month >= 0) {
      const day = parseInt(english[2]!, 10);
      const year = english[3] ? parseInt(english[3], 10) : Number.NEGATIVE_INFINITY;
      if (year !== Number.NEGATIVE_INFINITY) {
        return Date.UTC(year, month, day);
      }
    }
  }

  const encarMonthYear = trimmed.match(/^([A-Za-z]+)\s+(\d{2})$/i);
  if (encarMonthYear) {
    const month = HISTORY_MONTHS.indexOf(encarMonthYear[1]!.toLowerCase());
    const yy = parseInt(encarMonthYear[2]!, 10);
    if (month >= 0 && yy >= 19 && yy <= 99 && yy !== 30 && yy !== 31) {
      return Date.UTC(2000 + yy, month, 1);
    }
  }

  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function historyMileageSortKey(mileage: number | null | undefined): number {
  return mileage != null && mileage > 0 ? mileage : Number.NEGATIVE_INFINITY;
}

function sortHistoryNewestFirst<T extends { date?: string | null; mileage?: number | null; odometer?: number | null }>(items: T[]): T[] {
  return items
    .map((item, index) => ({
      item,
      index,
      dateKey: historyDateSortKey(item.date),
      mileageKey: historyMileageSortKey(item.mileage ?? item.odometer),
    }))
    .sort((a, b) => {
      if (a.dateKey !== b.dateKey) return b.dateKey - a.dateKey;
      if (a.mileageKey !== b.mileageKey) return b.mileageKey - a.mileageKey;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

function sortOwnerHistoryChronologically(
  events: NonNullable<NormalizedVinData["ownerHistory"]>,
): NonNullable<NormalizedVinData["ownerHistory"]> {
  return sortHistoryNewestFirst(events);
}

function normalizeEventDate(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  if (/^\d{8}$/.test(trimmed)) {
    const y = trimmed.slice(0, 4);
    const m = trimmed.slice(4, 6);
    const d = trimmed.slice(6, 8);
    const month = Number(m);
    const day = Number(d);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${m}-${d}`;
    }
  }

  const english = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (english) {
    const month = ENGLISH_MONTH_INDEX[english[1]!.toLowerCase()];
    if (month != null) {
      const day = String(parseInt(english[2]!, 10)).padStart(2, "0");
      const monthStr = String(month).padStart(2, "0");
      return `${english[3]}-${monthStr}-${day}`;
    }
  }

  const englishMonthYear = trimmed.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (englishMonthYear) {
    const month = ENGLISH_MONTH_INDEX[englishMonthYear[1]!.toLowerCase()];
    if (month != null) {
      return `${englishMonthYear[2]}-${String(month).padStart(2, "0")}-01`;
    }
  }

  const encarHeader = parseEncarMonthYearHeader(trimmed);
  if (encarHeader) return encarHeader;

  // Month + day without year (e.g. "October 30") — avoid JS defaulting to 2001
  if (/^[A-Za-z]+\s+\d{1,2}$/i.test(trimmed)) return null;

  return sanitizeReportIsoDate(trimmed, null);
}

const REGISTRY_ITEM_DATE_FIELDS = [
  "Date of occurrence",
  "Inspection date",
  "Car inspection completion date",
  "Completion date",
  "Change date",
  "Date of change",
  "Recall date",
  "recall post date",
  "First registration date",
  "Initial registration date",
  "Date of production",
  "Production date",
] as const;

/** End of an insurance lapse period, e.g. "April 2015 -April 2019 (Total 48 months)". */
function parseRegistryPeriodDate(raw: string | null): string | null {
  if (!raw) return null;
  const endRange = raw.match(/-\s*([A-Za-z]+)\s+(\d{4})/i);
  if (endRange) {
    const month = ENGLISH_MONTH_INDEX[endRange[1]!.toLowerCase()];
    if (month != null) {
      return `${endRange[2]}-${String(month).padStart(2, "0")}-01`;
    }
  }
  const matches = raw.match(/\b([A-Za-z]+)\s+(\d{4})\b/g);
  if (matches?.length) {
    const last = matches[matches.length - 1]!;
    const m = last.match(/^([A-Za-z]+)\s+(\d{4})$/i);
    if (m) {
      const month = ENGLISH_MONTH_INDEX[m[1]!.toLowerCase()];
      if (month != null) return `${m[2]}-${String(month).padStart(2, "0")}-01`;
    }
  }
  return null;
}

/** Sanitize malformed Encar group headers (e.g. duplicated "April 15, April 15"). */
export function normalizeHistoryGroupDate(raw: string | null): string | null {
  if (!raw) return null;
  let trimmed = raw.trim();
  if (!trimmed) return null;

  const duplicated = trimmed.match(/^([A-Za-z]+\s+\d{1,2}),\s*\1$/i);
  if (duplicated) trimmed = duplicated[1]!;

  if (trimmed.includes(",")) {
    const segments = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
    for (const segment of segments) {
      if (/^\d{4}-\d{2}-\d{2}/.test(segment)) return segment.slice(0, 10);
      if (/^[A-Za-z]+\s+\d{1,2},?\s+\d{4}$/i.test(segment)) return segment;
      if (parseEncarMonthYearHeader(segment)) return segment;
      if (/^[A-Za-z]+\s+\d{4}$/i.test(segment)) return segment;
    }
    return segments[0] ?? null;
  }

  return trimmed;
}

/** Prefer a full YYYY-MM-DD from item fields; never use month-only group headers when a year exists in details. */
export function resolveRegistryItemDate(
  item: Record<string, unknown>,
  groupDate: string | null,
): string | null {
  for (const key of REGISTRY_ITEM_DATE_FIELDS) {
    const value = strField(item, key);
    if (!value) continue;
    const normalized = normalizeEventDate(value);
    if (normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  }

  const period = strField(item, "period") ?? strField(item, "sub");
  const fromPeriod = parseRegistryPeriodDate(period);
  if (fromPeriod) return fromPeriod;

  const normalizedGroup = normalizeHistoryGroupDate(groupDate);
  if (normalizedGroup) {
    const normalized = normalizeEventDate(normalizedGroup);
    if (normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  }

  return null;
}

const ENGLISH_MONTH_INDEX: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

/**
 * Encar details.history group headers use "Month YY" (2-digit year), e.g. "January 20" → Jan 2020.
 * JavaScript parses the same string as Jan 20, **2001** when no 4-digit year is present.
 */
export function parseEncarMonthYearHeader(raw: string): string | null {
  const m = raw.trim().match(/^([A-Za-z]+)\s+(\d{2})$/i);
  if (!m) return null;
  const monthNum = ENGLISH_MONTH_INDEX[m[1]!.toLowerCase()];
  if (monthNum == null) return null;
  const nn = parseInt(m[2]!, 10);
  // Likely day-of-month without year (e.g. "October 30") — do not invent a year
  if (nn === 30 || nn === 31) return null;
  if (nn < 19 || nn > 99) return null;
  const year = 2000 + nn;
  return `${year}-${String(monthNum).padStart(2, "0")}-01`;
}

/** Korean ownership transfers from details.history and insurance_v2.ownerChanges. */
export function extractKoreanOwnerHistory(
  lots: Array<Record<string, unknown>>,
  insurance: Record<string, unknown>,
): NonNullable<NormalizedVinData["ownerHistory"]> {
  const events: NonNullable<NormalizedVinData["ownerHistory"]> = [];

  for (const group of pickLotHistoryBlocks(lots)) {
    const content = Array.isArray(group.content) ? group.content as Array<Record<string, unknown>> : [];
    for (const item of content) {
      const title = strField(item, "title") ?? "";
      if (!isKoreanOwnershipTitle(title)) continue;

      const changeDate = normalizeEventDate(strField(item, "Change date"))
        ?? normalizeEventDate(strField(item, "Date of change"))
        ?? normalizeEventDate(strField(item, "Initial registration date"))
        ?? normalizeEventDate(strField(item, "First registration date"))
        ?? normalizeHistoryGroupDate(strField(group, "date"));
      const mileage = parseKmFromText(strField(item, "Drown distance when changing"))
        ?? parseKmFromText(strField(item, "Driving distance when changing"))
        ?? parseKmFromText(strField(item, "sub"));
      const transaction = strField(item, "Transaction")
        ?? strField(item, "Transaction type");
      const flag = strField(item, "flag");
      const titleLower = title.toLowerCase();
      const lotStatus = /first vehicle|first registration/.test(titleLower)
        ? (transaction ?? flag ?? "First registration")
        : (transaction ?? flag);

      events.push({
        date: changeDate,
        location: null,
        mileage,
        auctionPrice: null,
        lotStatus,
        condition: null,
      });
    }
  }

  // Merge owner-change dates from the chosen insurance block AND every lot's insurance.
  const dateSet = new Set<string>(parseInsuranceOwnerChangeDates(insurance));
  for (const block of collectInsuranceBlocksFromLots(lots)) {
    for (const date of parseInsuranceOwnerChangeDates(block)) dateSet.add(date);
  }

  const existingDates = new Set(
    events.map((e) => e.date?.slice(0, 10)).filter((d): d is string => !!d),
  );

  for (const date of dateSet) {
    const key = date.slice(0, 10);
    if (existingDates.has(key)) continue;
    existingDates.add(key);
    events.push({
      date,
      location: null,
      mileage: null,
      auctionPrice: null,
      lotStatus: "Owner change",
      condition: null,
    });
  }

  const meaningful = events.filter((entry) =>
    isMeaningfulProviderText(entry.date)
    || entry.mileage != null
    || isMeaningfulProviderText(entry.lotStatus)
    || isMeaningfulProviderText(entry.location),
  );

  return sortOwnerHistoryChronologically(dedupeOwnerHistory(meaningful));
}

function mapKoreanRegistryContentItem(
  item: Record<string, unknown>,
  groupDate: string | null,
): RegistryHistoryEvent {
  const rawTitle = strField(item, "title") ?? "";
  const title = rawTitle.replace(/\n/g, " ").trim() || null;
  const subtitleRaw = cleanProviderMultiline(strField(item, "sub"));
  let subtitle = subtitleRaw?.replace(/\n/g, " · ") ?? null;
  const type = classifyKoreanRegistryTitle(rawTitle);

  let mileage: number | null = null;
  let mileageFromField = false;
  let amount: string | null = null;
  let location: string | null = null;
  const details: Array<{ label: string; value: string }> = [];
  const reserved = new Set(["title", "sub", "flag"]);

  for (const [key, raw] of Object.entries(item)) {
    if (reserved.has(key) || raw == null) continue;
    const value = typeof raw === "string" ? stripHtmlText(raw) : String(raw);
    if (!isMeaningfulProviderText(value)) continue;

    const keyLower = key.toLowerCase();
    if (REGISTRY_MILEAGE_KEYS.some((k) => k.toLowerCase() === keyLower)) {
      const parsed = parseKmFromText(value);
      if (parsed != null) {
        mileage = parsed;
        mileageFromField = true;
      }
      details.push({ label: key, value });
      continue;
    }
    if (REGISTRY_AMOUNT_KEYS.some((k) => k.toLowerCase() === keyLower)) {
      const isRepair = isRegistryRepairCostLabel(key);
      const normalized = isRepair
        ? (sanitizeKoreanRepairAmountText(value) ?? null)
        : (formatKoreanListPriceAmountText(value) ?? normalizeKrwAmountText(value) ?? value);
      if (!normalized) continue;
      details.push({ label: key, value: normalized });
      continue;
    }
    if (REGISTRY_LOCATION_KEYS.some((k) => k.toLowerCase() === keyLower)) {
      location = value;
      continue;
    }
    if (
      keyLower === "date of occurrence"
      || keyLower === "inspection date"
      || keyLower === "date of change"
      || keyLower === "change date"
      || keyLower === "completion date"
      || keyLower === "car inspection completion date"
      || keyLower === "inspection completion date"
      || keyLower === "recall date"
      || keyLower === "recall post date"
      || keyLower === "initial registration date"
      || keyLower === "first registration date"
      || keyLower === "date of production"
      || keyLower === "production date"
    ) {
      details.unshift({ label: key, value });
      continue;
    }
    details.push({ label: key, value });
  }

  if (!mileageFromField && (type === "inspection" || type === "owner_change")) {
    mileage = parseKmFromText(subtitle) ?? parseKmFromText(title) ?? mileage;
  }
  if (REGISTRY_TYPES_WITHOUT_MILEAGE.has(type) && !mileageFromField) {
    mileage = null;
  }

  if (!amount && subtitle) {
    const m = subtitle.match(/total\s+([\d.,]+\s+million won|[\d,]+\s+won)/i);
    if (m) amount = sanitizeKoreanRepairAmountText(m[1]!) ?? normalizeKrwAmountText(m[1]!);
  }

  subtitle = stripRegistrySubtitleNoise(subtitle, mileage);
  if (!location && subtitle) {
    const parts = subtitle.split(/\n| · /).map((p) => p.trim()).filter(Boolean);
    const locCandidate = parts.find((p) =>
      !/mileage|total|no information|recall|inspection/i.test(p)
      && !isEncarMileageTypoLine(p),
    );
    if (locCandidate && locCandidate.length > 3) location = locCandidate;
  }

  location = sanitizeRegistryLocation(location);

  let eventDate = resolveRegistryItemDate(item, groupDate);

  amount = resolveRegistryDisplayAmount({ type, amount, details });

  return {
    date: eventDate,
    type,
    title,
    subtitle,
    mileage,
    amount,
    location,
    details: details.length > 0 ? details : undefined,
  };
}

function sanitizeRegistryHistoryEvent(event: RegistryHistoryEvent): RegistryHistoryEvent | null {
  const details = (event.details ?? []).filter((row) => isMeaningfulProviderText(row.value));
  const cleaned: RegistryHistoryEvent = {
    ...event,
    title: event.title && isMeaningfulProviderText(event.title) ? event.title : null,
    subtitle: event.subtitle && isMeaningfulProviderText(event.subtitle) ? event.subtitle : null,
    amount: event.amount && isMeaningfulProviderText(event.amount) ? event.amount : null,
    location: event.location && isMeaningfulProviderText(event.location) ? event.location : null,
    date: event.date && isMeaningfulProviderText(event.date) ? event.date : null,
    details: details.length > 0 ? details : undefined,
  };
  const titleIsGeneric = !cleaned.title
    || /^(event|no information|n\/a|unknown|-|registry event)$/i.test(cleaned.title);
  const typeIsGeneric = !cleaned.type || /^(event|other|unknown)$/i.test(String(cleaned.type));
  const hasMeaningfulContent = Boolean(
    (cleaned.title && !titleIsGeneric)
    || cleaned.subtitle
    || cleaned.mileage != null
    || cleaned.amount
    || cleaned.location
    || (cleaned.details?.length ?? 0) > 0
    || (!typeIsGeneric && cleaned.date),
  );
  if (!hasMeaningfulContent) return null;
  return {
    ...cleaned,
    title: titleIsGeneric ? null : cleaned.title,
  };
}

/** Pick the richest details.history block across Korean marketplace lots. */
export function extractRegistryHistoryFromLots(
  lots: Array<Record<string, unknown>>,
): RegistryHistoryEvent[] {
  const events: RegistryHistoryEvent[] = [];
  for (const group of pickLotHistoryBlocks(lots)) {
    const groupDate = strField(group, "date");
    const content = Array.isArray(group.content) ? group.content as Array<Record<string, unknown>> : [];
    for (const item of content) {
      if (isKoreanRecallRegistryItem(item)) continue;
      const mapped = mapKoreanRegistryContentItem(item, groupDate);
      if (isKoreanRecallRegistryEvent(mapped)) continue;
      const sanitized = sanitizeRegistryHistoryEvent(mapped);
      if (sanitized) events.push(sanitized);
    }
  }

  return sortHistoryNewestFirst(dedupeRegistryHistoryEvents(events));
}

/** Korean manufacturer recalls from details.history — kept out of registry timeline. */
export function extractRecallHistoryFromLots(
  lots: Array<Record<string, unknown>>,
): RegistryHistoryEvent[] {
  const events: RegistryHistoryEvent[] = [];
  for (const group of pickLotHistoryBlocks(lots)) {
    const groupDate = strField(group, "date");
    const content = Array.isArray(group.content) ? group.content as Array<Record<string, unknown>> : [];
    for (const item of content) {
      if (!isKoreanRecallRegistryItem(item)) continue;
      const mapped = mapKoreanRegistryContentItem(item, groupDate);
      const recallEvent = { ...mapped, type: "recall" };
      const sanitized = sanitizeRegistryHistoryEvent(recallEvent);
      if (sanitized) events.push({ ...sanitized, type: "recall" });
    }
  }

  return sortHistoryNewestFirst(dedupeRegistryHistoryEvents(events));
}

/** Read flood flags from one insurance_v2 object (not otherAccident — that is third-party damage). */
export function readKoreanFloodFlags(insurance: Record<string, unknown> | null | undefined): {
  isFlooded: boolean | null;
  floodCount: number | null;
  floodLossAmount: number | null;
} {
  const block = insurance ?? {};
  const hasInsuranceBlock = Object.keys(block).length > 0;
  if (!hasInsuranceBlock) {
    return { isFlooded: null, floodCount: null, floodLossAmount: null };
  }

  const floodCntRaw = Number(
    block.floodTotalLossCnt
    ?? block.floodCnt
    ?? block.floodDamageCnt
    ?? NaN,
  );
  const floodCnt = Number.isFinite(floodCntRaw) ? floodCntRaw : null;
  const floodCost = sanitizeKoreanRepairKrwAmount(
    Number(
      block.floodTotalLossCost
      ?? block.floodCost
      ?? block.floodDamageCost
      ?? block.floodLossAmount,
    ) || null,
  );
  // Official flood total/partial-loss count. Do NOT use otherAccidentCnt — ImportMotor
  // / checkcar often mistranslate that summary row as "Flood damage".
  const isFlooded = floodCnt != null && floodCnt > 0
    ? true
    : floodCnt == null && floodCost != null && floodCost > 0;
  const floodCount = isFlooded
    ? (floodCnt != null && floodCnt > 0 ? floodCnt : 1)
    : 0;
  const floodLossAmount = isFlooded ? floodCost : null;
  return { isFlooded, floodCount, floodLossAmount };
}

/**
 * When a stored KR report has insurance/salvage signals but no flood flag yet
 * (pre-flood-mapping cache), treat flood as assessed-clear so the report pill shows.
 */
export function applyMissingFloodFlagsForServe(
  data: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!data) return null;
  if (data.isFlooded === true || data.isFlooded === false) return data;

  const country = String(data.country ?? "").toLowerCase();
  const isKr = country === "kr" || country.includes("korea");
  const hasKrInsuranceSignal =
    (Array.isArray(data.insuranceClaims) && data.insuranceClaims.length > 0)
    || (Array.isArray(data.registryHistory) && data.registryHistory.length > 0)
    || data.isStolen === true
    || data.isStolen === false
    || data.isSalvage === true
    || data.isSalvage === false;

  if (!isKr || !hasKrInsuranceSignal) return data;

  return {
    ...data,
    isFlooded: false,
    floodCount: typeof data.floodCount === "number" && Number.isFinite(data.floodCount)
      ? data.floodCount
      : 0,
  };
}

/** Pick/merge the richest insurance_v2 block across all lots (any source domain). */
export function extractInsuranceV2FromLots(lots: Array<Record<string, unknown>>): Record<string, unknown> {
  const blocks = collectInsuranceBlocksFromLots(lots);
  if (blocks.length === 0) return {};

  let best: Record<string, unknown> = {};
  let bestScore = -1;
  let bestFlood = readKoreanFloodFlags({});
  const mergedOwnerDates = new Set<string>();
  let maxOwnerChangeCnt = 0;
  let richestAccidents: unknown[] = [];

  for (const insurance of blocks) {
    const accidents = Array.isArray(insurance.accidents) ? insurance.accidents : [];
    const flood = readKoreanFloodFlags(insurance);
    const ownerDates = parseInsuranceOwnerChangeDates(insurance);
    for (const d of ownerDates) mergedOwnerDates.add(d);
    maxOwnerChangeCnt = Math.max(
      maxOwnerChangeCnt,
      Number(insurance.ownerChangeCnt ?? insurance.owner_change_cnt ?? 0) || 0,
      ownerDates.length,
    );
    if (accidents.length > richestAccidents.length) richestAccidents = accidents;

    const score = accidents.length * 10
      + (Number(insurance.accidentCnt) || 0)
      + (Number(insurance.ownerChangeCnt ?? insurance.owner_change_cnt) || 0)
      + ownerDates.length * 5
      + (flood.floodCount ?? 0) * 5
      + (Object.keys(insurance).length > 0 ? 1 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = insurance;
    }
    if ((flood.floodCount ?? 0) > (bestFlood.floodCount ?? 0)) {
      bestFlood = flood;
    } else if (
      flood.isFlooded === false
      && bestFlood.isFlooded == null
      && Object.keys(insurance).length > 0
    ) {
      // Prefer an assessed "not flooded" over unknown when any KR insurance block exists.
      bestFlood = flood;
    } else if (
      flood.isFlooded
      && (flood.floodLossAmount ?? 0) > (bestFlood.floodLossAmount ?? 0)
    ) {
      bestFlood = flood;
    }
  }

  const mergedOwnerChanges = [...mergedOwnerDates].sort((a, b) => b.localeCompare(a));
  const out: Record<string, unknown> = {
    ...best,
    ...(richestAccidents.length > 0 ? { accidents: richestAccidents } : {}),
    ...(mergedOwnerChanges.length > 0 ? { ownerChanges: mergedOwnerChanges } : {}),
    ownerChangeCnt: Math.max(
      maxOwnerChangeCnt,
      Number(best.ownerChangeCnt ?? best.owner_change_cnt ?? 0) || 0,
      mergedOwnerChanges.length,
    ),
  };

  if (bestFlood.isFlooded === true) {
    out.floodTotalLossCnt = bestFlood.floodCount;
    if (bestFlood.floodLossAmount != null) out.floodTotalLossCost = bestFlood.floodLossAmount;
  } else if (bestFlood.isFlooded === false) {
    out.floodTotalLossCnt = 0;
  }

  return out;
}

function pickLotDetailsWithInspect(lots: Array<Record<string, unknown>>): Record<string, unknown> {
  for (const lot of lots) {
    const details = (lot.details ?? {}) as Record<string, unknown>;
    const inspect = details.inspect as Record<string, unknown> | undefined;
    if (inspect?.accident_summary) return details;
  }
  const firstDetails = (lots[0]?.details ?? {}) as Record<string, unknown>;
  return firstDetails ?? {};
}

export function resolveVinAccidents(input: {
  country: string | null;
  insurance: Record<string, unknown>;
  lotDetails: Record<string, unknown>;
  auctionAccidents: NonNullable<NormalizedVinData["accidents"]>;
  registryHistory?: RegistryHistoryEvent[];
  /** Lots whose title/certificate or auction damage text indicates flood. */
  naLotFloodCount?: number;
}): {
  accidents: NonNullable<NormalizedVinData["accidents"]>;
  insuranceClaims: NonNullable<NormalizedVinData["insuranceClaims"]>;
  accidentCount: number;
  isFlooded: boolean | null;
  floodCount: number | null;
  floodLossAmount: number | null;
} {
  const {
    country,
    insurance,
    lotDetails,
    auctionAccidents,
    registryHistory = [],
    naLotFloodCount = 0,
  } = input;
  const totalLoss = Number(insurance.totalLossCnt ?? 0);
  const totalLossDate = str(insurance.totalLossDate);
  const koreanFlood = readKoreanFloodFlags(insurance);
  const rawRecords = Array.isArray(insurance.accidents)
    ? insurance.accidents as Array<Record<string, unknown>>
    : [];

  const koreanClaims = rawRecords.filter(isKoreanInsuranceClaimRecord);
  const standardRecords = rawRecords.filter((r) => !isKoreanInsuranceClaimRecord(r));
  const usesKoreanClaimModel = koreanClaims.length > 0
    && (country?.toLowerCase() === "kr" || standardRecords.length === 0);

  const insuranceClaims = sortHistoryNewestFirst(
    usesKoreanClaimModel
      ? koreanClaims.map(mapKoreanInsuranceClaim)
      : [],
  );

  // Keep rows with any real signal. Do not require severity — missing loss amount
  // correctly yields severity null (not invented "minor"), and that must not drop the accident.
  const standardAccidents = standardRecords
    .map((r) => mapStandardInsuranceAccident(r, country, totalLoss))
    .filter((a) =>
      a.date
      || a.description
      || a.primaryDamage
      || a.secondaryDamage
      || a.type
      || a.lossAmount != null
      || a.odometerAtLoss != null
      || a.airbagDeployed != null
      || a.severity
    );

  const inspect = parseKoreanInspectAccident(lotDetails);
  const inspectionAccidents: NonNullable<NormalizedVinData["accidents"]> = [];
  if (inspect.hasStructuralAccident) {
    const summary = (lotDetails.inspect as Record<string, unknown> | undefined)?.accident_summary as Record<string, unknown> | undefined;
    const frameworkYes = inspectSummaryFlag(summary?.main_framework) === "yes";
    inspectionAccidents.push({
      date: null,
      severity: frameworkYes ? "major" : "moderate",
      description: inspect.description,
      country,
      type: "inspection",
      primaryDamage: null,
      secondaryDamage: null,
      airbagDeployed: null,
      odometerAtLoss: null,
      lossAmount: null,
    });
  }

  const koreanSupplemental = usesKoreanClaimModel
    ? buildKoreanSupplementalAccidents(insuranceClaims, registryHistory, country, totalLossDate)
    : registryHistory
      .map((event) => mapRegistryEventToAccident(event, country))
      .filter((event): event is VinAccident => event != null);

  let accidents: NonNullable<NormalizedVinData["accidents"]> = [];
  if (standardAccidents.length > 0) {
    accidents = dedupeAccidents([...standardAccidents, ...koreanSupplemental, ...inspectionAccidents]);
  } else if (inspectionAccidents.length > 0) {
    accidents = dedupeAccidents([...inspectionAccidents, ...koreanSupplemental]);
  } else if (koreanSupplemental.length > 0) {
    accidents = koreanSupplemental;
  } else if (!usesKoreanClaimModel) {
    accidents = auctionAccidents;
  }

  if (auctionAccidents.length > 0) {
    accidents = dedupeAccidents([...accidents, ...auctionAccidents]);
  }

  // Insurance accident flood tokens (auction flood is counted via naLotFloodCount to avoid double-count).
  const insuranceFloodHits = standardAccidents.filter(accidentIndicatesFlood).length;
  const { isFlooded, floodCount, floodLossAmount } = mergeKoreanAndNaFloodFlags(
    koreanFlood,
    naLotFloodCount + insuranceFloodHits,
  );

  // Keep flood out of accident history — shown in its own report section / header pill.
  accidents = accidents.filter((a) => !accidentIndicatesFlood(a));

  const accidentCount = accidents.length;
  return {
    accidents: sortHistoryNewestFirst(accidents),
    insuranceClaims,
    accidentCount,
    isFlooded,
    floodCount,
    floodLossAmount,
  };
}

// Normalize carstat.dev /api/local-report/{vin} response.
// Handles both:
//   - direct vehicle object at root level (new local-report format)
//   - { data: [{...}] } wrapper (legacy search format)
// Field mapping for carstat.dev report shape:
//   { id, year, vin, manufacturer: {name}, model: {name}, generation: {name},
//     body_type: {name}, color: {name}, engine: {name}, transmission: {name}, fuel: {name},
//     cylinders, hp, lots: [{ odometer: {km, mi}, damage, condition, images, location,
//       bid, buy_now, final_bid, sale_date, status, title, detailed_title,
//       damage: { main: {name}, second: {name} }, details: { insurance_v2 } }] }
export function normalizeCarstatResponse(body: Record<string, unknown>): NormalizedVinData {
  // Unwrap { data: [...] } or { data: {...} } if present
  let raw: Record<string, unknown> = body;
  if (body.data !== undefined) {
    const dataArr = Array.isArray(body.data) ? body.data as Record<string, unknown>[] : null;
    if (dataArr && dataArr.length > 0) {
      raw = dataArr[0];
    } else if (body.data && typeof body.data === "object" && !Array.isArray(body.data)) {
      raw = body.data as Record<string, unknown>;
    }
  }

  if (!raw || Object.keys(raw).length === 0) {
    throw new Error("No vehicle data in provider response");
  }

  const mfr = (raw.manufacturer ?? {}) as Record<string, unknown>;
  const mdl = (raw.model ?? {}) as Record<string, unknown>;
  const gen = (raw.generation ?? {}) as Record<string, unknown>;
  const bodyType = (raw.body_type ?? {}) as Record<string, unknown>;
  const colorObj = (raw.color ?? {}) as Record<string, unknown>;
  const engineObj = (raw.engine ?? {}) as Record<string, unknown>;
  const transmissionObj = (raw.transmission ?? {}) as Record<string, unknown>;
  const fuelObj = (raw.fuel ?? {}) as Record<string, unknown>;

  const lots = Array.isArray(raw.lots) ? raw.lots as Array<Record<string, unknown>> : [];
  const lotsForInsurance = [...lots];
  // Some payloads nest insurance on the vehicle root (missing on individual lots).
  if (raw.insurance_v2 && typeof raw.insurance_v2 === "object" && !Array.isArray(raw.insurance_v2)) {
    lotsForInsurance.push({ details: { insurance_v2: raw.insurance_v2 } });
  } else if (raw.insurance && typeof raw.insurance === "object" && !Array.isArray(raw.insurance)) {
    lotsForInsurance.push({ details: { insurance_v2: raw.insurance } });
  }

  let odometerKm: number | null = null;
  for (const l of lots) {
    const km = parseLotOdometerKm(l);
    if (km != null && (odometerKm == null || km > odometerKm)) odometerKm = km;
  }

  // --- Process ALL lots for richer history data ---
  let allPhotos: string[] = [];
  let allPhotosHd: string[] = [];
  let allSpinExterior: string[] = [];
  let allSpinInterior: string[] = [];
  let photos360EmbedUrl: string | null = null;
  const mileageHistory: NormalizedVinData["mileageHistory"] = [];
  const ownerHistory: NormalizedVinData["ownerHistory"] = [];
  const auctionHistory: NormalizedVinData["auctionHistory"] = [];
  const auctionAccidents: NonNullable<NormalizedVinData["accidents"]> = [];
  let titleStatus: string | null = null;
  let isSalvageFromLots = false;
  let naLotFloodCount = 0;
  const seenMarketplaceDomains = new Set<string>();

  for (const l of lots) {
    // Always merge photos from every lot — marketplace dedup is for history rows only.
    const merged = collectPhotosFromLot(l, allPhotos, allPhotosHd);
    allPhotos = merged.display;
    allPhotosHd = merged.hd;
    const spin = collectSpinPhotosFromLot(l, allSpinExterior, allSpinInterior);
    allSpinExterior = spin.exterior;
    allSpinInterior = spin.interior;
    if (!photos360EmbedUrl) {
      photos360EmbedUrl = extractLotPanoramaUrl(l);
    }

    if (isMarketplaceListingLot(l)) {
      const domain = lotDomainName(l);
      if (domain && seenMarketplaceDomains.has(domain)) continue;
      if (domain) seenMarketplaceDomains.add(domain);
    }

    // Mileage reading per lot (Copart, IAAI, Encar, and other provider domains)
    const km = parseLotOdometerKm(l);
    const saleD = resolveLotEventDate(l);
    const condition = str(l.condition);
    const lotTitle = extractLotTitle(l);
    const { primary: primaryDamage, secondary: secondaryDamage, combined: damage } = extractLotDamages(l.damage);
    const auctionPrice = Number(l.final_bid) || null;
    const lotStatus = str(l.status);
    const openingBid = Number(l.bid) || null;
    const buyNowPrice = Number(l.buy_now) || null;

    if (lotTitle) {
      if (!titleStatus) titleStatus = lotTitle;
      if (isSalvageTitle(lotTitle)) isSalvageFromLots = true;
    }

    if (
      titleIndicatesFlood(lotTitle)
      || damageIndicatesFlood(primaryDamage, secondaryDamage, damage)
    ) {
      naLotFloodCount += 1;
    }

    const loc = (l.location ?? {}) as Record<string, unknown>;
    const locCountry = (loc.country ?? {}) as Record<string, unknown>;
    const locName = str(locCountry.name ?? locCountry.iso);
    const locCity = str(loc.city ?? loc.city_name);
    const locState = str(loc.state ?? loc.state_name ?? loc.region);

    const salvage = isSalvageTitle(lotTitle);
    if (isNorthAmericanAuctionLot(l) && (primaryDamage || secondaryDamage || salvage)) {
      auctionAccidents.push({
        date: saleD,
        severity: salvage ? "total_loss" : null,
        description: salvage ? lotTitle : (damage ?? lotTitle),
        country: locName,
        type: "auction",
        primaryDamage,
        secondaryDamage,
        airbagDeployed: null,
        odometerAtLoss: km,
        lossAmount: null,
      });
    }

    if (km) {
      mileageHistory.push({
        date: saleD,
        odometer: km,
        unit: "km",
        source: isNorthAmericanAuctionLot(l) ? "na_auction" : "listing",
        condition,
        damage,
        primaryDamage,
        secondaryDamage,
        auctionPrice,
        lotStatus,
        titleStatus: lotTitle,
      });
    }

    // Ownership event per auction lot only — Encar/marketplace listings are not owner changes.
    if (!isMarketplaceListingLot(l)) {
      ownerHistory.push({
        date: saleD,
        location: locName,
        mileage: km,
        auctionPrice,
        lotStatus,
        condition,
      });
    }

    auctionHistory.push({
      date: saleD,
      city: locCity,
      state: locState,
      country: locName,
      condition,
      damage,
      primaryDamage,
      secondaryDamage,
      titleStatus: lotTitle,
      openingBid,
      buyNowPrice,
      finalPrice: auctionPrice,
      lotStatus,
    });
  }

  if (allPhotos.length < MAX_VIN_PHOTOS && Array.isArray(raw.photos)) {
    allPhotos = collectPhotoList({ gallery: raw.photos }, allPhotos, pickDisplayLotPhotoUrls)
      .slice(0, MAX_VIN_PHOTOS);
    allPhotosHd = collectPhotoList({ gallery: raw.photos }, allPhotosHd, pickBestLotPhotoUrls)
      .slice(0, MAX_VIN_PHOTOS);
  }

  const photos = allPhotos.slice(0, MAX_VIN_PHOTOS);
  const photosHdCandidate = allPhotosHd.slice(0, MAX_VIN_PHOTOS);
  const photos360Exterior = allSpinExterior.slice(0, MAX_VIN_SPIN_PHOTOS);
  const photos360Interior = allSpinInterior.slice(0, MAX_VIN_SPIN_PHOTOS);
  const photosClean = excludeSpinUrlsFromGallery(photos, photos360Exterior, photos360Interior);
  const photosHdClean = excludeSpinUrlsFromGallery(
    photosHdCandidate,
    photos360Exterior,
    photos360Interior,
  );
  /** Only emit photosHd when it differs from display (saves payload when tiers match). */
  const photosHd =
    photosHdClean.length > 0
    && photosHdClean.join("\0") !== photosClean.join("\0")
      ? photosHdClean
      : undefined;

  const country = resolveVehicleCountry(lots);

  const lotDetails = pickLotDetailsWithInspect(lots);
  const insurance = extractInsuranceV2FromLots(lotsForInsurance);
  const ownerChanges = Number(insurance.ownerChangeCnt ?? insurance.owner_change_cnt ?? 0);
  const resolvedOwnerHistory = dedupeOwnerHistory(
    resolveOwnerHistoryFromLots(lotsForInsurance, insurance, ownerHistory),
  );
  // Prefer the richer of insurance ownerChangeCnt and actual timeline rows we extracted.
  // Do not invent ownerCount: 1 when we have no ownership signal — but never prefer a
  // silent 0 when insurance reports ownerChangeCnt and we only failed to parse dates.
  const ownerCount = Math.max(
    ownerChanges > 0 ? ownerChanges + 1 : 0,
    resolvedOwnerHistory.length,
  );
  const totalLoss = Number(insurance.totalLossCnt ?? 0);

  // totalLossCnt / explicit salvage flags + NA auction title strings → isSalvage.
  const isSalvageFromInsurance = totalLoss > 0
    || !!(
      insurance.is_salvage
      ?? insurance.isSalvage
      ?? insurance.salvage
      ?? (typeof insurance.totalLoss === "boolean" ? insurance.totalLoss : null)
    );
  const isSalvage = isSalvageFromInsurance || isSalvageFromLots;
  const robberCnt = Number(insurance.robberCnt ?? insurance.theftCnt ?? 0);
  const isStolen = robberCnt > 0
    || !!(insurance.stolen ?? insurance.is_stolen ?? insurance.theft ?? insurance.isStolen);

  const registryHistory = lotsHaveRegistryTimeline(lots)
    ? extractRegistryHistoryFromLots(lots)
    : [];
  const recallHistory = lotsHaveRegistryTimeline(lots)
    ? extractRecallHistoryFromLots(lots)
    : [];

  const { accidents, insuranceClaims, accidentCount: resolvedAccidentCount, isFlooded, floodCount, floodLossAmount } = resolveVinAccidents({
    country,
    insurance,
    lotDetails,
    auctionAccidents,
    registryHistory,
    naLotFloodCount,
  });

  const hp = Number(raw.hp) || null;
  const cylinders = Number(raw.cylinders) || null;
  const engineName = str(engineObj.name);

  const vehicleYear = Number(raw.year) || null;

  const sortedMileageHistory = mileageHistory.length > 0
    ? sortHistoryNewestFirst(dedupeMileageHistory(mileageHistory, vehicleYear))
    : undefined;
  const sortedOwnerHistory = resolvedOwnerHistory.length > 0
    ? sortHistoryNewestFirst(resolvedOwnerHistory)
    : undefined;
  const sortedRegistryHistory = registryHistory.length > 0
    ? sortHistoryNewestFirst(registryHistory)
    : undefined;
  const sortedRecallHistory = recallHistory.length > 0
    ? sortHistoryNewestFirst(recallHistory)
    : undefined;
  const sortedAuctionHistory = auctionHistory.length > 0
    ? sortHistoryNewestFirst(dedupeAuctionHistory(auctionHistory, vehicleYear))
    : undefined;
  const resolvedOdometer = resolveLatestOdometerKm({
    odometer: odometerKm,
    country,
    mileageHistory: sortedMileageHistory,
    ownerHistory: sortedOwnerHistory,
    registryHistory: sortedRegistryHistory,
  });

  const repairedAccidents = dedupeAccidents(
    applyEncarDateRepairs(accidents, vehicleYear) ?? accidents,
    vehicleYear,
  );
  const repairedClaims = dedupeInsuranceClaims(
    applyEncarDateRepairs(insuranceClaims, vehicleYear) ?? insuranceClaims,
    vehicleYear,
  );
  const repairedRegistry = dedupeRegistryHistory(
    applyEncarDateRepairs(sortedRegistryHistory, vehicleYear) ?? sortedRegistryHistory ?? [],
    vehicleYear,
  );
  const repairedRecalls = dedupeRegistryHistory(
    applyEncarDateRepairs(sortedRecallHistory, vehicleYear) ?? sortedRecallHistory ?? [],
    vehicleYear,
  );
  const repairedMileage = applyEncarDateRepairs(sortedMileageHistory, vehicleYear) ?? sortedMileageHistory;
  const repairedOwners = dedupeOwnerHistory(
    applyEncarDateRepairs(sortedOwnerHistory, vehicleYear) ?? sortedOwnerHistory ?? [],
    vehicleYear,
  );
  const repairedAuction = applyEncarDateRepairs(sortedAuctionHistory, vehicleYear) ?? sortedAuctionHistory;

  return {
    make: str(mfr.name),
    model: str(mdl.name),
    year: vehicleYear,
    trim: str(gen.name),
    engine: engineName,
    transmission: str(transmissionObj.name),
    fuelType: str(fuelObj.name),
    bodyType: str(bodyType.name),
    color: str(colorObj.name),
    country,
    odometer: resolvedOdometer,
    accidentCount: resolvedAccidentCount,
    ...(ownerCount > 0 ? { ownerCount } : {}),
    hp,
    cylinders,
    isSalvage,
    isStolen,
    ...(isFlooded != null ? { isFlooded, floodCount, floodLossAmount } : {}),
    titleStatus,
    photos: photosClean,
    ...(photosHd ? { photosHd } : {}),
    ...(photos360Exterior.length > 0 ? { photos360Exterior } : {}),
    ...(photos360Interior.length > 0 ? { photos360Interior } : {}),
    ...(photos360EmbedUrl ? { photos360EmbedUrl } : {}),
    ...(() => {
      const split = splitAuctionPanoramaUrls(photos360EmbedUrl);
      return {
        ...(split.exterior ? { photos360EmbedExteriorUrl: split.exterior } : {}),
        ...(split.interior ? { photos360EmbedInteriorUrl: split.interior } : {}),
      };
    })(),
    accidents: sortHistoryNewestFirst(repairedAccidents),
    insuranceClaims: repairedClaims.length > 0 ? repairedClaims : undefined,
    registryHistory: repairedRegistry,
    ...(repairedRecalls.length > 0 ? { recallHistory: repairedRecalls } : {}),
    mileageHistory: repairedMileage,
    ...(repairedOwners.length > 0 ? { ownerHistory: repairedOwners } : {}),
    auctionHistory: repairedAuction,
    marketData: buildMarketDataFromLots(lots, repairedAuction, vehicleYear),
  };
}
