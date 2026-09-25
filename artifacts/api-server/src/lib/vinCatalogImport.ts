/** Helpers for admin VIN catalog CSV/JSON import-export round-trips. */

import { applyFrozenKrwPerUsd, readFrozenKrwPerUsd } from "./krwRate.js";

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/i;

/** True when catalog row has a published report — not an empty row or manual-pending stub. */
export function catalogHasDeliverableReport(data: unknown): boolean {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const d = data as Record<string, unknown>;
  return catalogDeliverableFromHint({
    fulfillmentPending: d.fulfillmentPending === true,
    accidentsLen: Array.isArray(d.accidents) ? d.accidents.length : 0,
    mileageLen: Array.isArray(d.mileageHistory) ? d.mileageHistory.length : 0,
    ownerLen: Array.isArray(d.ownerHistory) ? d.ownerHistory.length : 0,
    claimsLen: Array.isArray(d.insuranceClaims) ? d.insuranceClaims.length : 0,
    registryLen: Array.isArray(d.registryHistory) ? d.registryHistory.length : 0,
    auctionLen: Array.isArray(d.auctionHistory) ? d.auctionHistory.length : 0,
    serviceLen: Array.isArray(d.serviceHistory) ? d.serviceHistory.length : 0,
    photosLen: Array.isArray(d.photos) ? d.photos.length : 0,
    make: typeof d.make === "string" ? d.make : null,
    model: typeof d.model === "string" ? d.model : null,
    year: d.year,
  });
}

export type CatalogDeliverableHint = {
  fulfillmentPending: boolean;
  accidentsLen: number;
  mileageLen: number;
  ownerLen: number;
  claimsLen: number;
  registryLen: number;
  auctionLen: number;
  serviceLen: number;
  photosLen: number;
  make: string | null;
  model: string | null;
  year: unknown;
};

export function catalogDeliverableFromHint(hint: CatalogDeliverableHint): boolean {
  if (hint.fulfillmentPending) return false;
  if (
    hint.accidentsLen > 0
    || hint.mileageLen > 0
    || hint.ownerLen > 0
    || hint.claimsLen > 0
    || hint.registryLen > 0
    || hint.auctionLen > 0
    || hint.serviceLen > 0
  ) {
    return true;
  }
  if (hint.photosLen > 0) return true;
  if (hint.make && (hint.model || hint.year != null)) return true;
  return false;
}

function catalogPhotoArrayHasUrl(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.some((p) => typeof p === "string" && p.trim().length > 0);
}

/** True when catalog `data` stores at least one still or 360 preview URL. */
export function catalogHasPreviewPhoto(data: unknown): boolean {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const d = data as Record<string, unknown>;
  return (
    catalogPhotoArrayHasUrl(d.photos)
    || catalogPhotoArrayHasUrl(d.photosHd)
    || catalogPhotoArrayHasUrl(d.photos360Exterior)
  );
}

/** Google/sitemap eligibility — deliverable catalog row with a teaser image only. */
export function catalogIsSeoIndexable(data: unknown): boolean {
  return catalogHasDeliverableReport(data) && catalogHasPreviewPhoto(data);
}

/** SQL fragment for VIN sitemap queries — keep in sync with catalogHasPreviewPhoto. */
export const CATALOG_HAS_PREVIEW_PHOTO_SQL = `
  (
    jsonb_array_length(COALESCE(data->'photos', '[]'::jsonb)) > 0
    OR jsonb_array_length(COALESCE(data->'photosHd', '[]'::jsonb)) > 0
    OR jsonb_array_length(COALESCE(data->'photos360Exterior', '[]'::jsonb)) > 0
  )
`.trim();

const JSON_META_KEYS = new Set([
  "id",
  "vin",
  "provider",
  "providerName",
  "imported_at",
  "importedAt",
  "updated_at",
  "updatedAt",
  "data",
]);

/** Scalar fields stored on normalized catalog `data` (matches vinService NormalizedVinData). */
export const CATALOG_SCALAR_KEYS = [
  "dataSource",
  "make",
  "model",
  "year",
  "trim",
  "engine",
  "transmission",
  "fuelType",
  "bodyType",
  "color",
  "country",
  "odometer",
  "ownerCount",
  "accidentCount",
  "hp",
  "cylinders",
  "titleStatus",
  "isSalvage",
  "isStolen",
  "isTaxi",
  "isFlooded",
  "floodCount",
  "floodLossAmount",
  "krwPerUsd",
] as const;

const CATALOG_BOOL_KEYS = ["isSalvage", "isStolen", "isTaxi", "isFlooded"] as const;

function isCatalogBoolKey(key: string): boolean {
  return (CATALOG_BOOL_KEYS as readonly string[]).includes(key);
}

/** Nested JSON blobs on catalog `data`. */
export const CATALOG_JSON_KEYS = [
  "photos",
  "photosHd",
  "photos360Exterior",
  "photos360Interior",
  "photos360EmbedUrl",
  "photos360EmbedExteriorUrl",
  "photos360EmbedInteriorUrl",
  "accidents",
  "insuranceClaims",
  "mileageHistory",
  "ownerHistory",
  "auctionHistory",
  "registryHistory",
  "recallHistory",
  "serviceHistory",
  "vehicleExtras",
  "marketData",
] as const;

/** Still / spin frame galleries only — not single embed URL strings. */
const CATALOG_PHOTO_LIST_KEYS = [
  "photos",
  "photosHd",
  "photos360Exterior",
  "photos360Interior",
] as const;

/** IAAI/Copart interactive viewer URLs (single string each). */
const CATALOG_EMBED_URL_KEYS = [
  "photos360EmbedUrl",
  "photos360EmbedExteriorUrl",
  "photos360EmbedInteriorUrl",
] as const;

function isCatalogPhotoListKey(key: string): boolean {
  return (CATALOG_PHOTO_LIST_KEYS as readonly string[]).includes(key);
}

function isCatalogEmbedUrlKey(key: string): boolean {
  return (CATALOG_EMBED_URL_KEYS as readonly string[]).includes(key);
}

function normalizeEmbedUrl(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  // Legacy bug: sanitize once stored embed URLs as a 1-element photo array.
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
    const trimmed = value[0].trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

export const CATALOG_CSV_COLUMNS = [
  "id",
  "vin",
  "make",
  "model",
  "year",
  "trim",
  "engine",
  "transmission",
  "fuel_type",
  "body_type",
  "color",
  "country",
  "odometer_km",
  "owner_count",
  "accident_count",
  "hp",
  "cylinders",
  "title_status",
  "is_salvage",
  "is_stolen",
  "is_taxi",
  "photos",
  "accidents_json",
  "insurance_claims_json",
  "mileage_history_json",
  "owner_history_json",
  "auction_history_json",
  "registry_history_json",
  "service_history_json",
  "market_data_json",
  "provider",
  "imported_at",
  "updated_at",
] as const;

export type JsonImportRecord = {
  vin?: string;
  provider?: string | null;
  providerName?: string | null;
  data?: Record<string, unknown>;
  make?: unknown;
  model?: unknown;
  year?: unknown;
  [key: string]: unknown;
};

export type CatalogCsvRowInput = {
  vin: string;
  make: string | null;
  model: string | null;
  year: number | null;
  trim: string | null;
  engine: string | null;
  transmission: string | null;
  fuelType: string | null;
  bodyType: string | null;
  color: string | null;
  country: string | null;
  odometer: number | null;
  ownerCount: number | null;
  accidentCount: number | null;
  hp: number | null;
  cylinders: number | null;
  titleStatus: string | null;
  isSalvage: boolean;
  isStolen: boolean;
  isTaxi: boolean;
  photos: string[];
  accidents?: unknown;
  insuranceClaims?: unknown;
  mileageHistory?: unknown;
  ownerHistory?: unknown;
  auctionHistory?: unknown;
  registryHistory?: unknown;
  serviceHistory?: unknown;
  marketData?: unknown;
  provider: string | null;
};

export function isValidCatalogVin(vin: string): boolean {
  return VIN_RE.test(vin);
}

function isMeaningfulScalar(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  return true;
}

function parseOptionalNumber(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function parseCsvBool(raw: unknown): boolean {
  const s = String(raw ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

/** Keep admin-set taxi flag when a provider fetch does not include it. */
export function preserveAdminTaxiFlag(
  incoming: Record<string, unknown>,
  existing: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!existing) return incoming;
  if (typeof incoming.isTaxi !== "boolean" && typeof existing.isTaxi === "boolean") {
    return { ...incoming, isTaxi: existing.isTaxi };
  }
  return incoming;
}

export function parseCsvJsonField(raw: unknown): unknown | undefined {
  const text = String(raw ?? "").trim();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function extractPhotoUrl(item: unknown): string | null {
  if (typeof item === "string") {
    const trimmed = item.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (item && typeof item === "object") {
    const obj = item as Record<string, unknown>;
    for (const key of ["url", "src", "href", "link"]) {
      if (typeof obj[key] === "string") {
        const trimmed = (obj[key] as string).trim();
        if (trimmed.length > 0) return trimmed;
      }
    }
  }
  return null;
}

function normalizePhotos(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const urls = value
      .map(extractPhotoUrl)
      .filter((p): p is string => p != null);
    return urls.length > 0 ? urls : [];
  }
  if (typeof value === "string" && value.trim()) {
    const urls = value.split("|").map((p) => p.trim()).filter(Boolean);
    return urls.length > 0 ? urls : [];
  }
  return undefined;
}

/** Keep the last row per VIN so batched upserts never hit duplicate-key errors. */
export function dedupeCatalogImportRows<T extends { vin: string }>(rows: T[]): T[] {
  const byVin = new Map<string, T>();
  for (const row of rows) byVin.set(row.vin, row);
  return [...byVin.values()];
}

/** Stamp Korean exchange rate after merge/sanitize (preserves frozen rate when set). */
export function stampCatalogImportData(
  data: Record<string, unknown>,
  opts: { existingRate?: number | null; currentRate: number },
): Record<string, unknown> {
  return applyFrozenKrwPerUsd(data, {
    existingRate: opts.existingRate ?? readFrozenKrwPerUsd(data),
    currentRate: opts.currentRate,
  });
}

/** Strip null/empty fields; keep explicit false booleans. */
export function sanitizeCatalogPayload(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const key of CATALOG_SCALAR_KEYS) {
    const value = input[key];
    if (isCatalogBoolKey(key)) {
      if (typeof value === "boolean") out[key] = value;
      continue;
    }
    if (key === "krwPerUsd") {
      const n = value == null || value === "" ? null : Number(value);
      if (n != null && Number.isFinite(n) && n > 0) out[key] = n;
      continue;
    }
    if (key === "year" || key === "odometer" || key === "ownerCount" || key === "accidentCount" || key === "hp" || key === "cylinders") {
      const n = value == null || value === "" ? null : Number(value);
      if (n != null && Number.isFinite(n)) out[key] = n;
      continue;
    }
    if (isMeaningfulScalar(value)) out[key] = typeof value === "string" ? value.trim() : value;
  }

  for (const key of CATALOG_JSON_KEYS) {
    const value = input[key];
    if (isCatalogEmbedUrlKey(key)) {
      const url = normalizeEmbedUrl(value);
      if (url) out[key] = url;
      continue;
    }
    if (isCatalogPhotoListKey(key)) {
      if (Array.isArray(value)) {
        out[key] = normalizePhotos(value) ?? [];
      } else {
        const photos = normalizePhotos(value);
        if (photos && photos.length > 0) out[key] = photos;
      }
      continue;
    }
    if (key === "marketData") {
      if (value && typeof value === "object" && !Array.isArray(value)) out.marketData = value;
      continue;
    }
    if (Array.isArray(value)) out[key] = value;
  }

  if (input.odometerLocked === true) {
    out.odometerLocked = true;
  }

  return out;
}

/** Merge incoming catalog data into existing row (import / partial CSV update). */
export function mergeCatalogData(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...existing };

  for (const key of CATALOG_SCALAR_KEYS) {
    if (!(key in incoming)) continue;
    const value = incoming[key];
    if (isCatalogBoolKey(key)) {
      if (typeof value === "boolean") merged[key] = value;
      continue;
    }
    if (value == null || value === "") {
      continue;
    }
    merged[key] = value;
  }

  for (const key of CATALOG_JSON_KEYS) {
    if (!(key in incoming)) continue;
    const value = incoming[key];
    if (isCatalogEmbedUrlKey(key)) {
      const url = normalizeEmbedUrl(value);
      if (url) merged[key] = url;
      else if (value === null || value === "") delete merged[key];
      continue;
    }
    if (isCatalogPhotoListKey(key)) {
      merged[key] = normalizePhotos(value) ?? [];
      continue;
    }
    if (key === "marketData") {
      if (value && typeof value === "object" && !Array.isArray(value)) merged.marketData = value;
      continue;
    }
    if (Array.isArray(value)) merged[key] = value;
  }

  return merged;
}

/**
 * Full admin form save: apply every field the editor sent, including cleared scalars and empty history arrays.
 * Unlike mergeCatalogData (import-friendly), this replaces lists when the form includes them.
 */
export function applyCatalogAdminPatch(
  existing: Record<string, unknown>,
  rawBody: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized = sanitizeCatalogPayload(rawBody);
  const merged: Record<string, unknown> = { ...existing, ...sanitized };

  for (const key of CATALOG_SCALAR_KEYS) {
    if (!(key in rawBody)) continue;
    const raw = rawBody[key];
    if (isCatalogBoolKey(key)) {
      if (typeof raw === "boolean") merged[key] = raw;
      continue;
    }
    if (raw === null || raw === "") {
      delete merged[key];
    }
  }

  for (const key of CATALOG_JSON_KEYS) {
    if (!(key in rawBody)) continue;
    const raw = rawBody[key];
    if (isCatalogEmbedUrlKey(key)) {
      const url = normalizeEmbedUrl(raw);
      if (url) merged[key] = url;
      else delete merged[key];
      continue;
    }
    if (isCatalogPhotoListKey(key)) {
      merged[key] = normalizePhotos(raw) ?? [];
      continue;
    }
    if (key === "marketData") {
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        merged.marketData = raw;
      } else if (raw === null) {
        delete merged.marketData;
      }
      continue;
    }
    if (Array.isArray(raw)) {
      merged[key] = raw;
    } else if (raw === null) {
      merged[key] = [];
    }
  }

  if ("odometer" in rawBody) {
    const raw = rawBody.odometer;
    const n = raw == null || raw === "" ? null : Number(raw);
    if (n != null && Number.isFinite(n) && n > 0) {
      merged.odometerLocked = true;
    } else {
      delete merged.odometerLocked;
    }
  }

  return merged;
}

/** Normalize one JSON export/import row into catalog `data` + provider. */
export function normalizeJsonImportRecord(
  record: JsonImportRecord,
): { vin: string; data: Record<string, unknown>; provider: string | null } | null {
  const vin = String(record.vin ?? "").trim().toUpperCase();
  if (!isValidCatalogVin(vin)) return null;

  const provider = record.provider ?? record.providerName ?? null;
  let raw: Record<string, unknown>;

  if (record.data && typeof record.data === "object" && !Array.isArray(record.data)) {
    raw = { ...(record.data as Record<string, unknown>) };
  } else {
    raw = {};
    for (const [key, value] of Object.entries(record)) {
      if (!JSON_META_KEYS.has(key)) raw[key] = value;
    }
  }

  if (record.make != null && raw.make == null) raw.make = record.make;
  if (record.model != null && raw.model == null) raw.model = record.model;
  if (record.year != null && raw.year == null) raw.year = record.year;

  return { vin, data: sanitizeCatalogPayload(raw), provider: provider != null ? String(provider) : null };
}

export function catalogIdentityConflict(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): boolean {
  const cm = String(existing.make ?? "").toLowerCase();
  const im = String(incoming.make ?? "").toLowerCase();
  const cmo = String(existing.model ?? "").toLowerCase();
  const imo = String(incoming.model ?? "").toLowerCase();
  const cy = Number(existing.year) || null;
  const iy = Number(incoming.year) || null;
  return (cm && im && cm !== im) || (cmo && imo && cmo !== imo) || (cy && iy && cy !== iy);
}

export function formatCatalogIdentity(data: Record<string, unknown>): string {
  return [data.year, data.make, data.model].filter(Boolean).join(" ") || "Unknown";
}

export function catalogDataFromCsvRow(row: CatalogCsvRowInput): Record<string, unknown> {
  return sanitizeCatalogPayload({
    make: row.make,
    model: row.model,
    year: row.year,
    trim: row.trim,
    engine: row.engine,
    transmission: row.transmission,
    fuelType: row.fuelType,
    bodyType: row.bodyType,
    color: row.color,
    country: row.country,
    odometer: row.odometer,
    ownerCount: row.ownerCount,
    accidentCount: row.accidentCount,
    hp: row.hp,
    cylinders: row.cylinders,
    titleStatus: row.titleStatus,
    isSalvage: row.isSalvage,
    isStolen: row.isStolen,
    isTaxi: row.isTaxi,
    photos: row.photos,
    accidents: row.accidents,
    insuranceClaims: row.insuranceClaims,
    mileageHistory: row.mileageHistory,
    ownerHistory: row.ownerHistory,
    auctionHistory: row.auctionHistory,
    registryHistory: row.registryHistory,
    serviceHistory: row.serviceHistory,
    marketData: row.marketData,
  });
}

export function catalogDataFromCsvRecord(record: Record<string, unknown>): CatalogCsvRowInput | null {
  const vin = String(record.vin ?? "").trim().toUpperCase();
  if (!isValidCatalogVin(vin)) return null;

  const photosRaw = String(record.photos ?? "").trim();
  const accidents = parseCsvJsonField(record.accidents_json);
  const insuranceClaims = parseCsvJsonField(record.insurance_claims_json);
  const mileageHistory = parseCsvJsonField(record.mileage_history_json);
  const ownerHistory = parseCsvJsonField(record.owner_history_json);
  const auctionHistory = parseCsvJsonField(record.auction_history_json);
  const registryHistory = parseCsvJsonField(record.registry_history_json);
  const serviceHistory = parseCsvJsonField(record.service_history_json);
  const marketData = parseCsvJsonField(record.market_data_json);

  return {
    vin,
    make: String(record.make ?? "").trim() || null,
    model: String(record.model ?? "").trim() || null,
    year: parseOptionalNumber(record.year),
    trim: String(record.trim ?? "").trim() || null,
    engine: String(record.engine ?? "").trim() || null,
    transmission: String(record.transmission ?? "").trim() || null,
    fuelType: String(record.fuel_type ?? "").trim() || null,
    bodyType: String(record.body_type ?? "").trim() || null,
    color: String(record.color ?? "").trim() || null,
    country: String(record.country ?? "").trim() || null,
    odometer: parseOptionalNumber(record.odometer_km),
    ownerCount: parseOptionalNumber(record.owner_count),
    accidentCount: parseOptionalNumber(record.accident_count),
    hp: parseOptionalNumber(record.hp),
    cylinders: parseOptionalNumber(record.cylinders),
    titleStatus: String(record.title_status ?? "").trim() || null,
    isSalvage: parseCsvBool(record.is_salvage),
    isStolen: parseCsvBool(record.is_stolen),
    isTaxi: parseCsvBool(record.is_taxi),
    photos: photosRaw ? photosRaw.split("|").map((u) => u.trim()).filter(Boolean) : [],
    accidents,
    insuranceClaims,
    mileageHistory,
    ownerHistory,
    auctionHistory,
    registryHistory,
    serviceHistory,
    marketData,
    provider: String(record.provider ?? "").trim() || null,
  };
}

function csvEscape(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function jsonCell(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value) && value.length === 0) return "";
  if (typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0) return "";
  return JSON.stringify(value);
}

export function catalogDataToCsvCells(
  row: { id: number; vin: string; providerName: string | null; importedAt: Date; updatedAt: Date },
  data: Record<string, unknown>,
): string[] {
  const photos = Array.isArray(data.photos) ? (data.photos as string[]) : [];
  return [
    String(row.id),
    csvEscape(row.vin),
    csvEscape(data.make),
    csvEscape(data.model),
    data.year != null ? String(data.year) : "",
    csvEscape(data.trim),
    csvEscape(data.engine),
    csvEscape(data.transmission),
    csvEscape(data.fuelType),
    csvEscape(data.bodyType),
    csvEscape(data.color),
    csvEscape(data.country),
    data.odometer != null ? String(data.odometer) : "",
    data.ownerCount != null ? String(data.ownerCount) : "",
    data.accidentCount != null ? String(data.accidentCount) : "",
    data.hp != null ? String(data.hp) : "",
    data.cylinders != null ? String(data.cylinders) : "",
    csvEscape(data.titleStatus),
    data.isSalvage ? "1" : "0",
    data.isStolen ? "1" : "0",
    data.isTaxi ? "1" : "0",
    csvEscape(photos.join("|")),
    csvEscape(jsonCell(data.accidents)),
    csvEscape(jsonCell(data.insuranceClaims)),
    csvEscape(jsonCell(data.mileageHistory)),
    csvEscape(jsonCell(data.ownerHistory)),
    csvEscape(jsonCell(data.auctionHistory)),
    csvEscape(jsonCell(data.registryHistory)),
    csvEscape(jsonCell(data.serviceHistory)),
    csvEscape(jsonCell(data.marketData)),
    csvEscape(row.providerName),
    row.importedAt.toISOString(),
    row.updatedAt.toISOString(),
  ];
}

export function buildCatalogJsonExportRecord(row: {
  id: number;
  vin: string;
  providerName: string | null;
  importedAt: Date;
  updatedAt: Date;
  data: Record<string, unknown> | null;
}): Record<string, unknown> {
  const data = (row.data ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    vin: row.vin,
    provider: row.providerName,
    imported_at: row.importedAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    make: data.make ?? null,
    model: data.model ?? null,
    year: data.year ?? null,
    data,
  };
}
