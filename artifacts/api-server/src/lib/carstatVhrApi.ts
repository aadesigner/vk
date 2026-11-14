/**
 * Carstat VHR V2 — multi-source vehicle history reports.
 * Docs: https://carstat.dev/vhr
 * Auth: same Carstat x-api-key. Free POST /checks (except KR source 68
 * availability checks are metered); paid POST /reports per source.
 *
 * Buy at most one archive: prefer Archive Alpha (2), else Archive Beta (3) —
 * never both. Plus Korean Insurance (68) when available. Vehicle Inspections (4)
 * with Korean Insurance (68) and/or Vehicle History (5) — never inspections alone.
 * Korean Insurance may stand alone or with archive.
 * Fallback: Vehicle History (5) (± inspections when both match).
 * Never buy: USA Insurance Auctions (1), US Dealer Listings (6),
 * Belarus Listing History (35), Belarus Official History (36).
 * Prefer English JSON; Korean Insurance (68) may be ru-only — we buy RU and
 * translate string leaves to English before normalize. HTML is secondary only.
 *
 * KR check quota: peeks never ask source 68. Fulfill includes 68 only when
 * quota allows; otherwise force:true 68 for Korean-market VINs (± companions).
 */
import { and, eq } from "drizzle-orm";
import { db, providersTable } from "@workspace/db";
import { logger } from "./logger.js";
import { assertValidProviderBaseUrl } from "./providerUrl.js";
import type { NormalizedVinData } from "./vinService.js";
import {
  ensureCarstatVhrApiEnabledLoaded,
  isCarstatVhrApiEnabledCached,
} from "./carstatVhrApiSettingsCache.js";
import { assertAllowedVhrReportUrl } from "./carstatVhrReportSanitize.js";
import {
  hasStructuredVhrReport,
  normalizeCarstatVhrJsonPayloads,
} from "./carstatVhrNormalize.js";
import {
  payloadContainsCyrillic,
  payloadContainsHangul,
  translateVhrJsonKoToEn,
  translateVhrJsonRuToEn,
} from "./carstatVhrRuTranslate.js";
import {
  canIncludeKoreanInsuranceInCheck,
  getKoreanInsuranceCheckQuota,
  isForceKoreanInsuranceVin,
  markKoreanInsuranceCheckQuotaExhausted,
  recordKoreanInsuranceCheckSpent,
  recordKoreanInsuranceReportPaid,
} from "./carstatVhrQuota.js";

const DEFAULT_BASE = "https://carstat.dev";
const VHR_API_PATH = "/api/vhr";

export const CARSTAT_VHR_PROVIDER_NAME = "carstat_vhr";
export const CARSTAT_VHR_DATA_SOURCE = "carstat_vhr" as const;

/** Never purchase — USA auctions + dealer noise + Belarus listing/official history. */
export const VHR_SKIP_SOURCE_IDS = new Set([
  1, // USA Insurance Auctions & Korea History
  6, // US Dealer Listings
  35, // Belarus Listing History
  36, // Belarus Official History
]);
/** Name fallback if Carstat renumbers skipped sources. */
export const VHR_SKIP_SOURCE_NAME_RE =
  /usa\s+insurance\s+auctions|belarus\s+listing|belarus\s+official|us\s+dealer\s+listings?/i;
/** Archive pool — prefer Alpha (2) over Beta (3); buy at most one. */
export const VHR_AUCTION_ARCHIVE_IDS = [2, 3] as const;
export const VHR_KOREAN_INSURANCE_ID = 68;
/** Only purchased together with Korean Insurance — never alone. */
export const VHR_VEHICLE_INSPECTIONS_ID = 4;
/** USA Insurance Auctions — permanently skipped. */
export const VHR_USA_INSURANCE_AUCTIONS_ID = 1;
/** US dealer listings — permanently skipped (kept for ID reference / tests). */
export const VHR_US_DEALER_LISTINGS_ID = 6;
/** Belarus Listing History — permanently skipped. */
export const VHR_BELARUS_LISTING_HISTORY_ID = 35;
/** Belarus Official History — permanently skipped. */
export const VHR_BELARUS_OFFICIAL_HISTORY_ID = 36;
/** Single-buy fallback when auction/archive and KR are missing. */
export const VHR_FALLBACK_SOURCE_IDS = [5] as const;
/**
 * Sources safe to ask on peek / when KR quota is low.
 * Never includes 68 — asking 68 burns Korean Insurance check quota.
 */
export const VHR_NON_KR_CHECK_SOURCE_IDS = [
  ...VHR_AUCTION_ARCHIVE_IDS,
  VHR_VEHICLE_INSPECTIONS_ID,
  ...VHR_FALLBACK_SOURCE_IDS,
] as const;

/** Exists-check reuse window (peek→pay). Kept hours—not days—to bound RAM. */
const CHECK_CACHE_TTL_MS = Math.max(
  60_000,
  Number(process.env.CARSTAT_VHR_CHECK_CACHE_MS ?? 6 * 60 * 60 * 1000) || 6 * 60 * 60 * 1000,
);
/** Companion/inspections signals only need to survive checkout→payment. */
const MARKET_SIGNAL_TTL_MS = Math.max(
  60_000,
  Number(process.env.CARSTAT_VHR_MARKET_SIGNAL_CACHE_MS ?? 2 * 60 * 60 * 1000) || 2 * 60 * 60 * 1000,
);
/** Hard cap for in-memory VHR maps (expired entries pruned first). */
const VHR_CACHE_MAX_ENTRIES = Math.max(
  64,
  Number(process.env.CARSTAT_VHR_CACHE_MAX_ENTRIES ?? 800) || 800,
);

const CHECK_ATTEMPT_TIMEOUT_MS = Math.max(
  8_000,
  Number(process.env.CARSTAT_VHR_CHECK_TIMEOUT_MS ?? 15_000) || 15_000,
);
/** Pre-pay peek/probe must stay snappy — never sit on VHR 202 polling.
 *  ~4s covers most Carstat "partial" first responses; payment-time fulfill
 *  recheck still catches slow KR hits that soft-miss here. */
const PROBE_CHECK_BUDGET_MS = Math.max(
  1_500,
  Number(process.env.CARSTAT_VHR_PROBE_BUDGET_MS ?? 4_000) || 4_000,
);
const REPORT_ATTEMPT_TIMEOUT_MS = Math.max(
  8_000,
  Number(process.env.CARSTAT_VHR_REPORT_TIMEOUT_MS ?? 15_000) || 15_000,
);
const MAX_POLL_MS = Math.max(
  30_000,
  Number(process.env.CARSTAT_VHR_MAX_POLL_MS ?? 180_000) || 180_000,
);
const POLL_INTERVAL_MS = Math.max(
  1_000,
  Number(process.env.CARSTAT_VHR_POLL_MS ?? 1_500) || 1_500,
);

export type CarstatVhrCheckPhase = "probe" | "fulfill";

const PUBLIC_UNAVAILABLE = "VIN check temporarily unavailable. Please try again shortly.";

export type CarstatVhrSelectedSource = {
  sourceId: number;
  sourceName: string;
  priceUsd: number;
  language: string;
};

export type CarstatVhrReport = {
  sourceId: number;
  sourceName: string;
  htmlUrl: string | null;
  jsonUrl: string | null;
  reportId: string | null;
  requestId: string | null;
  fetchedAt: string;
  chargedUsd: number | null;
};

export type CarstatVhrCheckResult =
  | {
      status: "exists";
      selectedSources: CarstatVhrSelectedSource[];
      totalPriceUsd: number;
    }
  | { status: "not_found" }
  | { status: "unavailable"; reason: string };

export type CarstatVhrConfig = { apiKey: string; baseUrl: string };

type CachedVhrCheck = {
  expiresAt: number;
  includedKorean: boolean;
  result: Extract<CarstatVhrCheckResult, { status: "exists" }>;
};
const vhrCheckCache = new Map<string, CachedVhrCheck>();

function pruneExpiredMapEntries<T extends { expiresAt: number }>(
  map: Map<string, T>,
  now: number,
): void {
  for (const [key, value] of map) {
    if (value.expiresAt <= now) map.delete(key);
  }
}

/** Drop oldest entries after TTL prune so peek traffic cannot grow Maps without bound. */
function enforceMapMaxSize<T>(map: Map<string, T>, maxEntries: number): void {
  if (map.size <= maxEntries) return;
  const overflow = map.size - maxEntries;
  let removed = 0;
  for (const key of map.keys()) {
    map.delete(key);
    removed += 1;
    if (removed >= overflow) break;
  }
}

function checkCacheKey(vin: string, includedKorean: boolean): string {
  return `${vin}|kr:${includedKorean ? 1 : 0}`;
}

function readCachedVhrCheck(
  vin: string,
  needKorean: boolean,
): Extract<CarstatVhrCheckResult, { status: "exists" }> | null {
  const now = Date.now();
  // Prefer a cache entry that already asked KR when we need KR.
  const keys = needKorean
    ? [checkCacheKey(vin, true)]
    : [checkCacheKey(vin, false), checkCacheKey(vin, true)];
  for (const key of keys) {
    const hit = vhrCheckCache.get(key);
    if (!hit) continue;
    if (hit.expiresAt <= now) {
      vhrCheckCache.delete(key);
      continue;
    }
    if (needKorean && !hit.includedKorean) continue;
    // Refresh insertion order for simple LRU-ish retention under cap.
    vhrCheckCache.delete(key);
    vhrCheckCache.set(key, hit);
    return hit.result;
  }
  return null;
}

function writeCachedVhrCheck(
  vin: string,
  includedKorean: boolean,
  result: Extract<CarstatVhrCheckResult, { status: "exists" }>,
): void {
  const now = Date.now();
  pruneExpiredMapEntries(vhrCheckCache, now);
  const key = checkCacheKey(vin, includedKorean);
  vhrCheckCache.delete(key);
  vhrCheckCache.set(key, {
    expiresAt: now + CHECK_CACHE_TTL_MS,
    includedKorean,
    result,
  });
  enforceMapMaxSize(vhrCheckCache, VHR_CACHE_MAX_ENTRIES);
}

/** Synthetic selection used when buying source 68 with force:true (no prior check). */
export function forceKoreanInsuranceSelectedSource(): CarstatVhrSelectedSource {
  return {
    sourceId: VHR_KOREAN_INSURANCE_ID,
    sourceName: "Korean Insurance History",
    priceUsd: 0,
    language: "en",
  };
}

type VhrMarketSignalCache = {
  expiresAt: number;
  hasInspections: boolean;
  /**
   * Buyable non-68 companions from a check that already ran (peek/fulfill).
   * Used when force-buying 68 so we still purchase inspections/archive together.
   */
  companionSources: CarstatVhrSelectedSource[];
};
const vhrMarketSignalCache = new Map<string, VhrMarketSignalCache>();

export function looksLikeKoreanMarketCountry(country: unknown): boolean {
  const s = String(country ?? "").trim();
  if (!s) return false;
  return /korea|\bKR\b|south\s*korea|대한민국|한국/i.test(s);
}

/** Free (non-68) VHR signals that imply a Korean-market dossier is worth force-buying. */
export function hasKoreanMarketVhrSignal(sources: VhrSourceCheck[]): boolean {
  return sources.some((s) => s.id === VHR_VEHICLE_INSPECTIONS_ID && s.hasData);
}

function companionSourcesFromCheck(sources: VhrSourceCheck[]): CarstatVhrSelectedSource[] {
  const eligible = sources.filter(isVhrSourceEligible);
  const companions: CarstatVhrSelectedSource[] = [];
  const toSelected = (s: VhrSourceCheck): CarstatVhrSelectedSource => ({
    sourceId: s.id,
    sourceName: s.name,
    priceUsd: s.priceUsd,
    language: pickLanguage(s.availableLanguages, s.id),
  });
  const archive = pickBestAuctionArchive(eligible);
  if (archive) companions.push(toSelected(archive));
  // History is remembered for selectVhrSourcesToBuy (5+4 without KR). Force-68
  // lists intentionally omit 5 so inspections pair with either 68 or 5, not both.
  const history = eligible.find((s) => s.id === VHR_FALLBACK_SOURCE_IDS[0]);
  if (!archive && history) companions.push(toSelected(history));
  const inspections = eligible.find((s) => s.id === VHR_VEHICLE_INSPECTIONS_ID);
  if (inspections) companions.push(toSelected(inspections));
  return companions;
}

function rememberVhrMarketSignals(vin: string, sources: VhrSourceCheck[]): void {
  const now = Date.now();
  pruneExpiredMapEntries(vhrMarketSignalCache, now);
  const companionSources = companionSourcesFromCheck(sources);
  vhrMarketSignalCache.delete(vin);
  vhrMarketSignalCache.set(vin, {
    expiresAt: now + MARKET_SIGNAL_TTL_MS,
    hasInspections: companionSources.some((s) => s.sourceId === VHR_VEHICLE_INSPECTIONS_ID),
    companionSources,
  });
  enforceMapMaxSize(vhrMarketSignalCache, VHR_CACHE_MAX_ENTRIES);
}

function readVhrMarketInspectionsSignal(vin: string): boolean | null {
  const hit = vhrMarketSignalCache.get(vin);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    vhrMarketSignalCache.delete(vin);
    return null;
  }
  return hit.hasInspections;
}

function readVhrMarketCompanions(vin: string): CarstatVhrSelectedSource[] {
  const hit = vhrMarketSignalCache.get(vin);
  if (!hit) return [];
  if (hit.expiresAt <= Date.now()) {
    vhrMarketSignalCache.delete(vin);
    return [];
  }
  return hit.companionSources.filter((s) => s.sourceId !== VHR_KOREAN_INSURANCE_ID);
}

/**
 * Force-68 buy list: archive (if known) + forced 68 + inspections (if known).
 * Inspections pair with either 68 or Vehicle History (5) — never both as partners.
 * When forcing 68, do not also buy source 5.
 */
export function buildForcedKoreanBuyList(vin: string): CarstatVhrSelectedSource[] {
  const companions = readVhrMarketCompanions(vin);
  const archive = companions.filter((s) =>
    (VHR_AUCTION_ARCHIVE_IDS as readonly number[]).includes(s.sourceId),
  );
  const inspections = companions.filter((s) => s.sourceId === VHR_VEHICLE_INSPECTIONS_ID);
  return [...archive, forceKoreanInsuranceSelectedSource(), ...inspections];
}

/** Test helper — seed companion cache as a peek/check would. */
export function __rememberVhrMarketSignalsForTests(
  vin: string,
  sources: VhrSourceCheck[],
): void {
  rememberVhrMarketSignals(vin.trim().toUpperCase(), sources);
}

/** Merge forced 68 + cached companions into an existing selection (no dupes). */
export function mergeForcedKoreanIntoSelection(
  vin: string,
  existing: CarstatVhrSelectedSource[],
): CarstatVhrSelectedSource[] {
  const byId = new Map<number, CarstatVhrSelectedSource>();
  for (const s of existing) byId.set(s.sourceId, s);
  for (const s of buildForcedKoreanBuyList(vin)) {
    if (!byId.has(s.sourceId)) byId.set(s.sourceId, s);
  }
  const merged = [...byId.values()];
  const order = (id: number) => {
    if ((VHR_AUCTION_ARCHIVE_IDS as readonly number[]).includes(id)) return 0;
    if (id === VHR_FALLBACK_SOURCE_IDS[0]) return 1;
    if (id === VHR_KOREAN_INSURANCE_ID) return 2;
    if (id === VHR_VEHICLE_INSPECTIONS_ID) return 3;
    return 4;
  };
  return merged.sort((a, b) => order(a.sourceId) - order(b.sourceId));
}

/**
 * When KR check quota is low, decide whether to force-buy source 68 without a check.
 *
 * Cheap by design — never used on checkout peek, and never starts a new VHR
 * /checks round-trip (that would slow pay/grant and risk double work). Relies on:
 * - Korean WMI (K*)
 * - sync WMI country decode
 * - one catalog row read (Korea country already stored)
 * - inspections signal remembered from a check that already ran (peek or fulfill)
 */
export async function shouldForceKoreanInsuranceReport(
  vin: string,
): Promise<{ force: boolean; reason: string }> {
  const normalized = vin.trim().toUpperCase();
  if (isForceKoreanInsuranceVin(normalized)) {
    return { force: true, reason: "korean_wmi" };
  }

  // Sync — no I/O. Import WMI country only (e.g. still "Germany" for WDD…).
  try {
    const { decodeCountry } = await import("@workspace/vin-decode");
    if (looksLikeKoreanMarketCountry(decodeCountry(normalized))) {
      return { force: true, reason: "decode_country_korea" };
    }
  } catch {
    // ignore
  }

  // Already collected during peek/fulfill check — Map lookup only.
  if (readVhrMarketInspectionsSignal(normalized) === true) {
    return { force: true, reason: "vhr_inspections_signal" };
  }

  // Single DB read — only path with I/O; skipped when WMI/cache already matched.
  try {
    const { getCatalogVin } = await import("./vinService.js");
    const catalog = await getCatalogVin(normalized);
    const data = (catalog?.data && typeof catalog.data === "object" && !Array.isArray(catalog.data))
      ? (catalog.data as Record<string, unknown>)
      : null;
    if (looksLikeKoreanMarketCountry(data?.country)) {
      return { force: true, reason: "catalog_country_korea" };
    }
  } catch {
    // ignore catalog failures
  }

  return { force: false, reason: "no_korean_market_signal" };
}

type VhrSourceCheck = {
  id: number;
  name: string;
  priceUsd: number;
  availableFormats: string[];
  availableLanguages: string[];
  recordsCount: number;
  hasData: boolean;
};

function normalizeCarstatBaseUrl(baseUrl: string): string {
  try {
    return assertValidProviderBaseUrl(baseUrl)
      .replace(/\/$/, "")
      .replace("://api.carstat.dev", "://carstat.dev");
  } catch {
    return DEFAULT_BASE;
  }
}

function vhrBase(baseUrl: string): string {
  return `${normalizeCarstatBaseUrl(baseUrl)}${VHR_API_PATH}`;
}

function providerHeaders(apiKey: string): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-api-key": apiKey,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t || null;
}

function isTerminalStatus(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase();
  // Carstat check finals: completed | partial (some sources failed) | failed | not_found.
  // "partial" must be terminal — otherwise we poll for minutes and probe soft-misses
  // buyable KR/auction sources that already arrived on the first response.
  return (
    s === "completed"
    || s === "complete"
    || s === "partial"
    || s === "failed"
    || s === "error"
    || s === "cancelled"
    || s === "canceled"
    || s === "not_found"
  );
}

function isSuccessStatus(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase();
  return s === "completed" || s === "complete";
}

export function parseVhrSourceCheck(raw: Record<string, unknown>): VhrSourceCheck | null {
  const id = num(raw.id ?? raw.source_id ?? raw.sourceId);
  if (!id) return null;
  const formatsRaw = raw.available_formats ?? raw.formats ?? raw.availableFormats;
  const formats = Array.isArray(formatsRaw)
    ? formatsRaw.map((f) => String(f).toLowerCase())
    : [];
  const langsRaw = raw.available_languages ?? raw.languages ?? raw.availableLanguages;
  const langs = Array.isArray(langsRaw)
    ? langsRaw.map((l) => String(l).toLowerCase())
    : [];
  const preview =
    raw.preview && typeof raw.preview === "object" && !Array.isArray(raw.preview)
      ? (raw.preview as Record<string, unknown>)
      : {};
  const statusRaw = str(raw.status) ?? str(preview.status);
  const statusLower = (statusRaw ?? "").toLowerCase();
  if (
    statusLower.includes("check_quota_exhausted")
    || statusLower === "client_check_quota_exhausted"
  ) {
    if (id === VHR_KOREAN_INSURANCE_ID) {
      markKoreanInsuranceCheckQuotaExhausted(statusLower);
    }
    return {
      id,
      name: str(raw.name) ?? `Source ${id}`,
      priceUsd: num(raw.price_usd ?? raw.priceUsd ?? raw.price),
      availableFormats: [],
      availableLanguages: langs,
      recordsCount: 0,
      hasData: false,
    };
  }
  // not_checked = we did not ask this source — never treat as hasData.
  if (statusLower === "not_checked" || statusLower === "not_found" || statusLower === "error") {
    return {
      id,
      name: str(raw.name) ?? `Source ${id}`,
      priceUsd: num(raw.price_usd ?? raw.priceUsd ?? raw.price),
      availableFormats: formats,
      availableLanguages: langs,
      recordsCount: 0,
      hasData: false,
    };
  }
  const recordsCount = num(preview.records_count ?? preview.recordsCount ?? raw.records_count);
  // Orderable when formats present and no failure status (docs), or preview says has data.
  const hasData =
    preview.has_data === true
    || preview.exists === true
    || preview.hasData === true
    || (typeof preview.status === "string" && preview.status.toLowerCase() !== "not_found")
    || recordsCount > 0
    || (formats.length > 0 && !statusLower && preview.has_data !== false && preview.exists !== false);
  return {
    id,
    name: str(raw.name) ?? `Source ${id}`,
    priceUsd: num(raw.price_usd ?? raw.priceUsd ?? raw.price),
    availableFormats: formats,
    availableLanguages: langs,
    recordsCount,
    hasData,
  };
}

export function isVhrSourceEligible(source: VhrSourceCheck): boolean {
  if (VHR_SKIP_SOURCE_IDS.has(source.id)) return false;
  if (VHR_SKIP_SOURCE_NAME_RE.test(source.name ?? "")) return false;
  if (!source.hasData) return false;
  // JSON required so we can map into the normal kmcheck report (avoid HTML-iframe-only).
  if (!source.availableFormats.includes("json")) return false;
  // English preferred. Korean Insurance (68) is allowed ru-only — we translate.
  if (source.availableLanguages.includes("en")) return true;
  if (source.id === VHR_KOREAN_INSURANCE_ID && source.availableLanguages.includes("ru")) {
    return true;
  }
  return false;
}

function pickLanguage(langs: string[], sourceId: number): string {
  if (langs.includes("en")) return "en";
  if (sourceId === VHR_KOREAN_INSURANCE_ID && langs.includes("ru")) return "ru";
  return "en";
}

function auctionPreferRank(id: number): number {
  const idx = (VHR_AUCTION_ARCHIVE_IDS as readonly number[]).indexOf(id);
  return idx >= 0 ? idx : 99;
}

/** Best of 2/3 by prefer order Alpha→Beta. */
export function pickBestAuctionArchive(
  sources: VhrSourceCheck[],
): VhrSourceCheck | null {
  const pool = pickAllAuctionArchives(sources);
  return pool[0] ?? null;
}

/** All eligible archive sources (2, 3), stable order Alpha→Beta. */
export function pickAllAuctionArchives(
  sources: VhrSourceCheck[],
): VhrSourceCheck[] {
  return sources
    .filter((s) => (VHR_AUCTION_ARCHIVE_IDS as readonly number[]).includes(s.id))
    .sort((a, b) => auctionPreferRank(a.id) - auctionPreferRank(b.id));
}

/**
 * Select sources to purchase:
 * - at most one archive: Alpha (2) preferred, else Beta (3) — never both
 * - Korean Insurance (68) when available (alone OK, or with archive)
 * - Vehicle Inspections (4) with either Korean Insurance (68) or Vehicle History (5)
 *   — never both 68+5 as the inspections partner; never inspections alone
 * - never USA Insurance Auctions (1) / US Dealer (6) / Belarus Listing (35) / Belarus Official (36)
 * - else fallback Vehicle History (5)
 */
export function selectVhrSourcesToBuy(sources: VhrSourceCheck[]): CarstatVhrSelectedSource[] {
  const eligible = sources.filter(isVhrSourceEligible);
  const selected: CarstatVhrSelectedSource[] = [];

  const toSelected = (s: VhrSourceCheck): CarstatVhrSelectedSource => ({
    sourceId: s.id,
    sourceName: s.name,
    priceUsd: s.priceUsd,
    language: pickLanguage(s.availableLanguages, s.id),
  });

  const archive = pickBestAuctionArchive(eligible);
  if (archive) selected.push(toSelected(archive));

  const korean = eligible.find((s) => s.id === VHR_KOREAN_INSURANCE_ID);
  const inspections = eligible.find((s) => s.id === VHR_VEHICLE_INSPECTIONS_ID);
  const history = eligible.find((s) => s.id === VHR_FALLBACK_SOURCE_IDS[0]);

  if (korean) {
    // Prefer KR insurance as the inspections partner (not Vehicle History).
    selected.push(toSelected(korean));
    if (inspections) selected.push(toSelected(inspections));
  } else if (!selected.length && history) {
    // No archive/KR — Vehicle History alone, or with inspections when both match.
    selected.push(toSelected(history));
    if (inspections) selected.push(toSelected(inspections));
  } else if (!selected.length) {
    for (const id of VHR_FALLBACK_SOURCE_IDS) {
      const fb = eligible.find((s) => s.id === id);
      if (fb) {
        selected.push(toSelected(fb));
        break;
      }
    }
  }
  // Inspections alone (no 68 and no 5) stay unselected.

  return selected;
}

async function loadCarstatCredentials(): Promise<CarstatVhrConfig | null> {
  const [row] = await db
    .select({
      apiKey: providersTable.apiKey,
      baseUrl: providersTable.baseUrl,
    })
    .from(providersTable)
    .where(and(eq(providersTable.name, "Carstat"), eq(providersTable.isActive, true)))
    .orderBy(providersTable.id)
    .limit(1);

  const apiKey = row?.apiKey?.trim();
  if (!apiKey) {
    const [anyRow] = await db
      .select({
        apiKey: providersTable.apiKey,
        baseUrl: providersTable.baseUrl,
      })
      .from(providersTable)
      .where(eq(providersTable.name, "Carstat"))
      .orderBy(providersTable.id)
      .limit(1);
    const key = anyRow?.apiKey?.trim();
    if (!key) return null;
    return { apiKey: key, baseUrl: normalizeCarstatBaseUrl(anyRow?.baseUrl || DEFAULT_BASE) };
  }
  return { apiKey, baseUrl: normalizeCarstatBaseUrl(row?.baseUrl || DEFAULT_BASE) };
}

export async function resolveCarstatVhrApiConfig(): Promise<CarstatVhrConfig | null> {
  await ensureCarstatVhrApiEnabledLoaded();
  if (!isCarstatVhrApiEnabledCached()) return null;
  return loadCarstatCredentials();
}

/**
 * Never send x-api-key to a raw http:// status_url (Carstat sometimes returns http).
 * Force HTTPS and only allow carstat.dev hosts (ignore misconfigured baseUrl host).
 */
function normalizeCarstatStatusUrl(raw: string, _baseUrl?: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw Object.assign(new Error("Invalid Carstat status URL"), { code: "VIN_CHECK_UNAVAILABLE" });
  }
  const host = parsed.hostname.toLowerCase();
  const hostOk = host === "carstat.dev" || host === "api.carstat.dev" || host.endsWith(".carstat.dev");
  if (!hostOk) {
    throw Object.assign(new Error(`Carstat status host not allowed: ${host}`), {
      code: "VIN_CHECK_UNAVAILABLE",
    });
  }
  parsed.protocol = "https:";
  return parsed.toString();
}

async function pollStatusUrl(
  statusUrl: string,
  apiKey: string,
  label: string,
  maxPollMs: number = MAX_POLL_MS,
  baseUrl: string = DEFAULT_BASE,
): Promise<Record<string, unknown>> {
  const safeUrl = normalizeCarstatStatusUrl(statusUrl, baseUrl);
  const started = Date.now();
  let lastBody: Record<string, unknown> = {};
  const budget = Math.max(0, maxPollMs);

  while (Date.now() - started < budget) {
    const res = await fetch(safeUrl, {
      headers: providerHeaders(apiKey),
      signal: AbortSignal.timeout(Math.min(REPORT_ATTEMPT_TIMEOUT_MS, Math.max(1_000, budget))),
    });
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      body = {};
    }
    lastBody = body;
    const status = str(body.status);
    if (res.ok && isTerminalStatus(status)) {
      return body;
    }
    // 202 or non-terminal → keep polling
    logger.info({
      msg: "carstat_vhr_poll",
      label,
      httpStatus: res.status,
      status,
      elapsedMs: Date.now() - started,
    });
    const remaining = budget - (Date.now() - started);
    if (remaining < POLL_INTERVAL_MS) break;
    await sleep(POLL_INTERVAL_MS);
  }

  logger.warn({ msg: "carstat_vhr_poll_exhausted", label, elapsedMs: Date.now() - started, budgetMs: budget });
  return lastBody;
}

function extractSourcesFromBody(body: Record<string, unknown>): VhrSourceCheck[] {
  const rawList = Array.isArray(body.sources)
    ? body.sources
    : Array.isArray(body.data)
      ? body.data
      : [];
  const out: VhrSourceCheck[] = [];
  for (const item of rawList) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const parsed = parseVhrSourceCheck(item as Record<string, unknown>);
    if (parsed) out.push(parsed);
  }
  return out;
}

export type CarstatVhrCheckOptions = {
  phase?: CarstatVhrCheckPhase;
  /**
   * Explicit source filter. When omitted:
   * - probe → non-KR sources only (never burns KR quota)
   * - fulfill → includes 68 only when KR check quota allows
   */
  sourceIds?: number[];
  /** Force include/exclude Korean Insurance (68). Overrides default phase policy. */
  includeKoreanInsurance?: boolean;
};

function resolveCheckSourceIds(
  phase: CarstatVhrCheckPhase,
  opts?: CarstatVhrCheckOptions,
): { sourceIds: number[]; includedKorean: boolean } {
  if (opts?.sourceIds?.length) {
    const sourceIds = [...new Set(opts.sourceIds.map((n) => Number(n)).filter((n) => n > 0))];
    return {
      sourceIds,
      includedKorean: sourceIds.includes(VHR_KOREAN_INSURANCE_ID),
    };
  }
  const wantKr = opts?.includeKoreanInsurance
    ?? (phase === "fulfill" && canIncludeKoreanInsuranceInCheck());
  if (wantKr) {
    return {
      sourceIds: [...VHR_NON_KR_CHECK_SOURCE_IDS, VHR_KOREAN_INSURANCE_ID],
      includedKorean: true,
    };
  }
  return {
    sourceIds: [...VHR_NON_KR_CHECK_SOURCE_IDS],
    includedKorean: false,
  };
}

/** Free availability check + source selection (KR 68 only when explicitly allowed). */
export async function checkCarstatVhrAvailability(
  vin: string,
  opts?: CarstatVhrCheckOptions,
): Promise<CarstatVhrCheckResult> {
  const cfg = await resolveCarstatVhrApiConfig();
  if (!cfg) {
    return { status: "unavailable", reason: "Carstat VHR API disabled or Carstat key missing" };
  }

  const phase: CarstatVhrCheckPhase = opts?.phase === "probe" ? "probe" : "fulfill";
  const attemptTimeoutMs = phase === "probe"
    ? Math.min(CHECK_ATTEMPT_TIMEOUT_MS, PROBE_CHECK_BUDGET_MS)
    : CHECK_ATTEMPT_TIMEOUT_MS;
  // Probe: at most a brief poll; checkout must not wait on VHR generation.
  const pollBudgetMs = phase === "probe" ? 0 : MAX_POLL_MS;

  const normalized = vin.trim().toUpperCase();

  // Refresh KR quota before decide-include on fulfill.
  if (phase === "fulfill" && opts?.includeKoreanInsurance !== false && !opts?.sourceIds?.length) {
    await getKoreanInsuranceCheckQuota(cfg);
  }

  const { sourceIds, includedKorean } = resolveCheckSourceIds(phase, opts);

  if (includedKorean && !canIncludeKoreanInsuranceInCheck()) {
    logger.info({
      msg: "carstat_vhr_check_kr_skipped_quota",
      vin: normalized,
      phase,
    });
    // Fall back to non-KR sources only.
    return checkCarstatVhrAvailability(normalized, {
      phase,
      includeKoreanInsurance: false,
      sourceIds: [...VHR_NON_KR_CHECK_SOURCE_IDS],
    });
  }

  const cached = readCachedVhrCheck(normalized, includedKorean);
  if (cached) {
    logger.info({
      msg: "carstat_vhr_check_cache_hit",
      vin: normalized,
      selected: cached.selectedSources.map((s) => s.sourceId),
      includedKorean,
      phase,
    });
    return cached;
  }

  const url = `${vhrBase(cfg.baseUrl)}/checks`;
  const started = Date.now();

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: providerHeaders(cfg.apiKey),
      body: JSON.stringify({ vin: normalized, source_ids: sourceIds }),
      signal: AbortSignal.timeout(attemptTimeoutMs),
    });
    const text = await res.text();
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      logger.warn({
        msg: "carstat_vhr_check_bad_json",
        vin: normalized,
        status: res.status,
        body: text.slice(0, 160),
        phase,
        includedKorean,
      });
      // Probe soft-miss so checkout can fall through to USA / pending.
      return phase === "probe"
        ? { status: "not_found" }
        : { status: "unavailable", reason: PUBLIC_UNAVAILABLE };
    }

    if (res.status === 404) return { status: "not_found" };
    if (res.status === 403 || res.status === 429) {
      return { status: "unavailable", reason: PUBLIC_UNAVAILABLE };
    }

    // 202 or pending → poll status_url (fulfill only; probe skips long wait)
    let finalBody = body;
    const statusUrl = str(body.status_url) ?? str(body.statusUrl);
    const status = str(body.status);
    if ((res.status === 202 || (status && !isTerminalStatus(status))) && statusUrl) {
      if (pollBudgetMs > 0) {
        finalBody = await pollStatusUrl(
          statusUrl,
          cfg.apiKey,
          `check:${normalized}`,
          pollBudgetMs,
          cfg.baseUrl,
        );
      } else {
        // Use whatever sources arrived on the first response; else soft-miss for probe.
        const early = extractSourcesFromBody(body);
        rememberVhrMarketSignals(normalized, early);
        if (!selectVhrSourcesToBuy(early).length) {
          logger.info({
            msg: "carstat_vhr_check_probe_pending_skip",
            vin: normalized,
            httpStatus: res.status,
            status,
            elapsedMs: Date.now() - started,
            includedKorean,
            hasKrMarketSignal: hasKoreanMarketVhrSignal(early),
          });
          return { status: "not_found" };
        }
        finalBody = body;
      }
    } else if (!res.ok) {
      logger.warn({
        msg: "carstat_vhr_check_error",
        vin: normalized,
        status: res.status,
        body: text.slice(0, 160),
        phase,
        includedKorean,
      });
      return phase === "probe"
        ? { status: "not_found" }
        : { status: "unavailable", reason: PUBLIC_UNAVAILABLE };
    }

    if (includedKorean) {
      recordKoreanInsuranceCheckSpent();
    }

    const sources = extractSourcesFromBody(finalBody);
    rememberVhrMarketSignals(normalized, sources);
    const selected = selectVhrSourcesToBuy(sources);
    if (!selected.length) {
      logger.info({
        msg: "carstat_vhr_check_no_eligible",
        vin: normalized,
        sourceCount: sources.length,
        phase,
        includedKorean,
        hasKrMarketSignal: hasKoreanMarketVhrSignal(sources),
        elapsedMs: Date.now() - started,
      });
      return { status: "not_found" };
    }

    const totalPriceUsd = selected.reduce((sum, s) => sum + s.priceUsd, 0);
    const result: Extract<CarstatVhrCheckResult, { status: "exists" }> = {
      status: "exists",
      selectedSources: selected,
      totalPriceUsd,
    };
    writeCachedVhrCheck(normalized, includedKorean, result);
    logger.info({
      msg: "carstat_vhr_check_ok",
      vin: normalized,
      selected: selected.map((s) => s.sourceId),
      totalPriceUsd,
      phase,
      includedKorean,
      sourceIds,
      elapsedMs: Date.now() - started,
    });
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({
      msg: "carstat_vhr_check_failed",
      vin: normalized,
      err: msg,
      phase,
      includedKorean,
    });
    // Timeouts during probe must not stall checkout or block USA/pending.
    return phase === "probe"
      ? { status: "not_found" }
      : { status: "unavailable", reason: PUBLIC_UNAVAILABLE };
  }
}

async function purchaseOneVhrSource(
  cfg: CarstatVhrConfig,
  vin: string,
  selected: CarstatVhrSelectedSource,
  opts?: { force?: boolean },
): Promise<CarstatVhrReport> {
  const url = `${vhrBase(cfg.baseUrl)}/reports`;
  // force:true is only valid / needed for Korean Insurance (68) without a prior check.
  const force =
    opts?.force === true
    && selected.sourceId === VHR_KOREAN_INSURANCE_ID;
  const res = await fetch(url, {
    method: "POST",
    headers: providerHeaders(cfg.apiKey),
    body: JSON.stringify({
      vin,
      source_id: selected.sourceId,
      // JSON first — we map it into kmcheck report UI. HTML kept as secondary artifact.
      formats: ["json", "html"],
      // Prefer EN; KR insurance may only offer RU (translated after fetch).
      language: selected.language === "ru" ? "ru" : "en",
      ...(force ? { force: true } : {}),
    }),
    signal: AbortSignal.timeout(REPORT_ATTEMPT_TIMEOUT_MS),
  });
  const text = await res.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw Object.assign(new Error(PUBLIC_UNAVAILABLE), { code: "VIN_CHECK_UNAVAILABLE" });
  }

  if (res.status === 404) {
    throw Object.assign(new Error("No vehicle history data found for this VIN in our database."), {
      code: "VIN_NO_DATA",
    });
  }
  if (res.status === 403) {
    throw Object.assign(new Error("Provider credits exhausted or access denied"), {
      code: "PROVIDER_CREDITS",
    });
  }
  if (res.status === 429) {
    throw Object.assign(new Error("Provider rate limited"), { code: "PROVIDER_RATE_LIMIT" });
  }

  const statusUrl = str(body.status_url) ?? str(body.statusUrl);
  const status = str(body.status);
  let finalBody = body;

  if (res.status === 202 || (status && !isSuccessStatus(status) && !isTerminalStatus(status))) {
    if (!statusUrl) {
      throw Object.assign(new Error(PUBLIC_UNAVAILABLE), { code: "VIN_CHECK_UNAVAILABLE" });
    }
    finalBody = await pollStatusUrl(
      statusUrl,
      cfg.apiKey,
      `report:${vin}:${selected.sourceId}`,
      MAX_POLL_MS,
      cfg.baseUrl,
    );
  } else if (!res.ok) {
    logger.warn({
      msg: "carstat_vhr_report_error",
      vin,
      sourceId: selected.sourceId,
      status: res.status,
      body: text.slice(0, 200),
    });
    throw Object.assign(new Error(PUBLIC_UNAVAILABLE), { code: "VIN_CHECK_UNAVAILABLE" });
  } else if (status && !isSuccessStatus(status) && statusUrl) {
    finalBody = await pollStatusUrl(
      statusUrl,
      cfg.apiKey,
      `report:${vin}:${selected.sourceId}`,
      MAX_POLL_MS,
      cfg.baseUrl,
    );
  }

  const finalStatus = str(finalBody.status);
  if (finalStatus && !isSuccessStatus(finalStatus)) {
    throw Object.assign(new Error(`VHR report failed (${finalStatus})`), {
      code: "VIN_NO_DATA",
    });
  }

  const files =
    finalBody.files && typeof finalBody.files === "object" && !Array.isArray(finalBody.files)
      ? (finalBody.files as Record<string, unknown>)
      : {};
  const htmlUrl = str(files.html);
  const jsonUrl = str(files.json);
  if (!jsonUrl && !htmlUrl) {
    throw Object.assign(new Error("No vehicle history data found for this VIN in our database."), {
      code: "VIN_NO_DATA",
    });
  }

  return {
    sourceId: selected.sourceId,
    sourceName: selected.sourceName,
    htmlUrl,
    jsonUrl,
    reportId: str(finalBody.report_id) ?? str(finalBody.reportId),
    requestId: str(finalBody.request_id) ?? str(finalBody.requestId),
    fetchedAt: new Date().toISOString(),
    chargedUsd: (() => {
      const n = num(finalBody.charged_amount_usd ?? finalBody.chargedUsd);
      return Number.isFinite(n) ? n : null;
    })(),
  };
}

async function fetchVhrJsonPayload(jsonUrl: string): Promise<unknown | null> {
  try {
    assertAllowedVhrReportUrl(jsonUrl);
    const res = await fetch(jsonUrl, {
      headers: { Accept: "application/json,*/*" },
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    logger.warn({
      msg: "carstat_vhr_json_fetch_failed",
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Purchase selected VHR sources (parallel).
 * Partial success (at least one report) is delivered.
 * When KR check quota is low, force-buy source 68 for Korean-market VINs
 * (K* WMI, Korea country from decode/catalog, or free inspections signal).
 */
export async function fetchCarstatVhrReport(
  vin: string,
  selectedSources?: CarstatVhrSelectedSource[],
): Promise<NormalizedVinData> {
  const cfg = await resolveCarstatVhrApiConfig();
  if (!cfg) {
    throw Object.assign(new Error("Carstat VHR API is not configured"), {
      code: "VIN_CHECK_UNAVAILABLE",
    });
  }

  const normalized = vin.trim().toUpperCase();
  let toBuy = selectedSources ? [...selectedSources] : [];
  let forceKorean = false;
  // Evaluate at most once — never on peek; uses cache from the check below when present.
  let forceGate: Awaited<ReturnType<typeof shouldForceKoreanInsuranceReport>> | null = null;
  const getForceGate = async () => {
    if (!forceGate) forceGate = await shouldForceKoreanInsuranceReport(normalized);
    return forceGate;
  };

  if (!toBuy.length) {
    await getKoreanInsuranceCheckQuota(cfg);
    const check = await checkCarstatVhrAvailability(normalized, { phase: "fulfill" });
    if (check.status === "exists") {
      toBuy = [...check.selectedSources];
    } else {
      const gate = await getForceGate();
      if (gate.force) {
        forceKorean = true;
        // Pair forced 68 with inspections/archive remembered from peek/check (never inspections alone).
        toBuy = buildForcedKoreanBuyList(normalized);
        logger.info({
          msg: "carstat_vhr_force_68_no_check",
          vin: normalized,
          reason: gate.reason,
          checkStatus: check.status,
          selected: toBuy.map((s) => s.sourceId),
          canSpendKrCheck: canIncludeKoreanInsuranceInCheck(),
        });
      } else {
        throw Object.assign(new Error("No vehicle history data found for this VIN in our database."), {
          code: "VIN_NO_DATA",
        });
      }
    }
  } else if (
    toBuy.some((s) => s.sourceId === VHR_KOREAN_INSURANCE_ID)
    && !canIncludeKoreanInsuranceInCheck()
  ) {
    // Selection includes 68 but we never confirmed via check under low quota → force.
    forceKorean = true;
    // Still attach known inspections/archive companions.
    toBuy = mergeForcedKoreanIntoSelection(normalized, toBuy);
  }

  // Archives/etc. selected without 68 under low quota — attach force-68 + inspections when Korean-market.
  if (
    !forceKorean
    && !toBuy.some((s) => s.sourceId === VHR_KOREAN_INSURANCE_ID)
    && !canIncludeKoreanInsuranceInCheck()
  ) {
    const gate = await getForceGate();
    if (gate.force) {
      forceKorean = true;
      toBuy = mergeForcedKoreanIntoSelection(normalized, toBuy);
      logger.info({
        msg: "carstat_vhr_force_68_attach",
        vin: normalized,
        reason: gate.reason,
        selected: toBuy.map((s) => s.sourceId),
      });
    }
  }

  // Buy selected sources in parallel (KR 68 + inspections 4 is common). Sequential
  // waits stacked two generation polls and often tripped admin grant HTTP 502s.
  const settled = await Promise.all(
    toBuy.map(async (selected) => {
      try {
        const useForce =
          forceKorean && selected.sourceId === VHR_KOREAN_INSURANCE_ID;
        const report = await purchaseOneVhrSource(cfg, normalized, selected, {
          force: useForce,
        });
        let jsonPayload: unknown = null;
        if (report.jsonUrl) {
          const payload = await fetchVhrJsonPayload(report.jsonUrl);
          if (payload) {
            // RU / Hangul string leaves → English before normalize.
            // Carstat often ships RU option labels and Korean inspection notes even when language=en.
            let next = payload;
            const needsRuTranslate =
              selected.language === "ru"
              || selected.sourceId === VHR_KOREAN_INSURANCE_ID
              || payloadContainsCyrillic(next);
            if (needsRuTranslate) next = translateVhrJsonRuToEn(next);
            if (payloadContainsHangul(next)) next = translateVhrJsonKoToEn(next);
            jsonPayload = next;
          }
        }
        if (selected.sourceId === VHR_KOREAN_INSURANCE_ID) {
          recordKoreanInsuranceReportPaid();
          void getKoreanInsuranceCheckQuota(cfg, { force: true });
        }
        logger.info({
          msg: "carstat_vhr_report_ok",
          vin: normalized,
          sourceId: selected.sourceId,
          language: selected.language,
          force: useForce,
          hasHtml: !!report.htmlUrl,
          hasJson: !!report.jsonUrl,
          jsonLoaded: jsonPayload != null,
        });
        return { ok: true as const, report, jsonPayload };
      } catch (err) {
        logger.warn({
          msg: "carstat_vhr_report_one_failed",
          vin: normalized,
          sourceId: selected.sourceId,
          err: err instanceof Error ? err.message : String(err),
        });
        return { ok: false as const, err };
      }
    }),
  );

  const reports: CarstatVhrReport[] = [];
  const jsonPayloads: unknown[] = [];
  const errors: unknown[] = [];
  for (const row of settled) {
    if (row.ok) {
      reports.push(row.report);
      if (row.jsonPayload != null) jsonPayloads.push(row.jsonPayload);
    } else {
      errors.push(row.err);
    }
  }

  if (!reports.length) {
    const first = errors[0];
    if (first && typeof first === "object" && "code" in first) throw first;
    throw Object.assign(new Error("No vehicle history data found for this VIN in our database."), {
      code: "VIN_NO_DATA",
    });
  }

  const structured = jsonPayloads.length
    ? normalizeCarstatVhrJsonPayloads(jsonPayloads, { vin: normalized })
    : {};

  return {
    ...structured,
    dataSource: CARSTAT_VHR_DATA_SOURCE,
    vhrReports: reports,
    vhrReport: reports[0],
  } as NormalizedVinData & {
    vhrReports: CarstatVhrReport[];
    vhrReport: CarstatVhrReport;
  };
}

export function isCarstatVhrPayload(data: unknown): data is NormalizedVinData & {
  dataSource: typeof CARSTAT_VHR_DATA_SOURCE;
} {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const d = data as Record<string, unknown>;
  if (d.dataSource !== CARSTAT_VHR_DATA_SOURCE) return false;
  if (hasStructuredVhrReport(d)) return true;
  const list = Array.isArray(d.vhrReports) ? d.vhrReports : null;
  if (list?.length) {
    return list.some((r) => {
      if (!r || typeof r !== "object" || Array.isArray(r)) return false;
      const html = (r as { htmlUrl?: unknown }).htmlUrl;
      const json = (r as { jsonUrl?: unknown }).jsonUrl;
      return (typeof html === "string" && html.trim().length > 0)
        || (typeof json === "string" && json.trim().length > 0);
    });
  }
  return false;
}

export { hasStructuredVhrReport };
