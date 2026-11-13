/**
 * Carstat VHR V2 — multi-source vehicle history reports.
 * Docs: https://carstat.dev/vhr
 * Auth: same Carstat x-api-key. Free POST /checks; paid POST /reports per source.
 *
 * Buy at most one archive: prefer Archive Alpha (2), else Archive Beta (3) —
 * never both. Plus Korean Insurance (68) when available. Vehicle Inspections (4)
 * only with KR — never inspections alone.
 * Korean Insurance may stand alone or with archive.
 * Fallback: Vehicle History (5).
 * Never buy: USA Insurance Auctions (1), US Dealer Listings (6),
 * Belarus Listing History (35), Belarus Official History (36).
 * Prefer English JSON; Korean Insurance (68) may be ru-only — we buy RU and
 * translate string leaves to English before normalize. HTML is secondary only.
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
  translateVhrJsonRuToEn,
} from "./carstatVhrRuTranslate.js";

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

const CHECK_ATTEMPT_TIMEOUT_MS = Math.max(
  8_000,
  Number(process.env.CARSTAT_VHR_CHECK_TIMEOUT_MS ?? 15_000) || 15_000,
);
/** Pre-pay peek/probe must stay snappy — never sit on VHR 202 polling.
 *  Default was 2.5s; Carstat often lands ~2–4s with status "partial", so a tight
 *  budget soft-misses real KR hits and routes paid VINs to manual pending. */
const PROBE_CHECK_BUDGET_MS = Math.max(
  1_500,
  Number(process.env.CARSTAT_VHR_PROBE_BUDGET_MS ?? 6_000) || 6_000,
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
  const recordsCount = num(preview.records_count ?? preview.recordsCount ?? raw.records_count);
  const hasData =
    preview.has_data === true
    || preview.exists === true
    || preview.hasData === true
    || (typeof preview.status === "string" && preview.status.toLowerCase() !== "not_found")
    || recordsCount > 0;
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
 * - Vehicle Inspections (4) only when Korean Insurance is also selected
 * - never inspections alone
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
  if (korean) {
    selected.push(toSelected(korean));
    const inspections = eligible.find((s) => s.id === VHR_VEHICLE_INSPECTIONS_ID);
    if (inspections) selected.push(toSelected(inspections));
  }
  // Inspections without Korean Insurance are intentionally ignored.

  if (!selected.length) {
    for (const id of VHR_FALLBACK_SOURCE_IDS) {
      const fb = eligible.find((s) => s.id === id);
      if (fb) {
        selected.push(toSelected(fb));
        break;
      }
    }
  }

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

/** Free availability check + source selection. */
export async function checkCarstatVhrAvailability(
  vin: string,
  opts?: { phase?: CarstatVhrCheckPhase },
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
  const url = `${vhrBase(cfg.baseUrl)}/checks`;
  const started = Date.now();

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: providerHeaders(cfg.apiKey),
      body: JSON.stringify({ vin: normalized }),
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
        if (!selectVhrSourcesToBuy(early).length) {
          logger.info({
            msg: "carstat_vhr_check_probe_pending_skip",
            vin: normalized,
            httpStatus: res.status,
            status,
            elapsedMs: Date.now() - started,
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
      });
      return phase === "probe"
        ? { status: "not_found" }
        : { status: "unavailable", reason: PUBLIC_UNAVAILABLE };
    }

    const sources = extractSourcesFromBody(finalBody);
    const selected = selectVhrSourcesToBuy(sources);
    if (!selected.length) {
      logger.info({
        msg: "carstat_vhr_check_no_eligible",
        vin: normalized,
        sourceCount: sources.length,
        phase,
        elapsedMs: Date.now() - started,
      });
      return { status: "not_found" };
    }

    const totalPriceUsd = selected.reduce((sum, s) => sum + s.priceUsd, 0);
    logger.info({
      msg: "carstat_vhr_check_ok",
      vin: normalized,
      selected: selected.map((s) => s.sourceId),
      totalPriceUsd,
      phase,
      elapsedMs: Date.now() - started,
    });
    return { status: "exists", selectedSources: selected, totalPriceUsd };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ msg: "carstat_vhr_check_failed", vin: normalized, err: msg, phase });
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
): Promise<CarstatVhrReport> {
  const url = `${vhrBase(cfg.baseUrl)}/reports`;
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
 * Sequential purchase of selected VHR sources.
 * Partial success (at least one HTML report) is delivered.
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
  let toBuy = selectedSources;
  if (!toBuy?.length) {
    const check = await checkCarstatVhrAvailability(normalized);
    if (check.status !== "exists") {
      throw Object.assign(new Error("No vehicle history data found for this VIN in our database."), {
        code: "VIN_NO_DATA",
      });
    }
    toBuy = check.selectedSources;
  }

  const reports: CarstatVhrReport[] = [];
  const jsonPayloads: unknown[] = [];
  const errors: unknown[] = [];

  for (const selected of toBuy) {
    try {
      const report = await purchaseOneVhrSource(cfg, normalized, selected);
      reports.push(report);
      if (report.jsonUrl) {
        const payload = await fetchVhrJsonPayload(report.jsonUrl);
        if (payload) {
          // RU (or mixed Cyrillic) string leaves → English before normalize.
          // Carstat often ships RU option/body labels even when language=en (Alpha/Beta/68).
          const needsRuTranslate =
            selected.language === "ru"
            || selected.sourceId === VHR_KOREAN_INSURANCE_ID
            || payloadContainsCyrillic(payload);
          jsonPayloads.push(needsRuTranslate ? translateVhrJsonRuToEn(payload) : payload);
        }
      }
      logger.info({
        msg: "carstat_vhr_report_ok",
        vin: normalized,
        sourceId: selected.sourceId,
        language: selected.language,
        hasHtml: !!report.htmlUrl,
        hasJson: !!report.jsonUrl,
        jsonLoaded: jsonPayloads.length > 0,
      });
    } catch (err) {
      errors.push(err);
      logger.warn({
        msg: "carstat_vhr_report_one_failed",
        vin: normalized,
        sourceId: selected.sourceId,
        err: err instanceof Error ? err.message : String(err),
      });
      // Continue to next selected source — do not re-POST the failed one.
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
