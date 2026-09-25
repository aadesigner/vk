/**
 * GetCarAPI client — separate from Carstat.
 * Check is free (Bearer); retrieve costs 1 credit on HTTP 200 only.
 * Docs: https://getcarapi.com/api/
 */
import { logger } from "./logger.js";
import type { NormalizedVinData } from "./vinService.js";
import { dedupeServiceHistory } from "./history-dedupe.js";
import {
  ensureGetCarApiEnabledLoaded,
  isGetCarApiEnabledCached,
} from "./getcarApiSettingsCache.js";

export const GETCARAPI_PROVIDER_NAME = "getcarapi";

/** Opaque stamp inside NormalizedVinData — UI branches without exposing providerName. */
export const GETCARAPI_DATA_SOURCE = "getcarapi" as const;

const DEFAULT_BASE = "https://getcarapi.com";

export type GetCarApiCheckResult =
  | { status: "exists"; country?: string | null }
  | { status: "not_found" }
  | { status: "unavailable"; reason: string };

/**
 * Env + admin toggle. Returns null when disabled or unconfigured —
 * callers skip GetCarAPI and continue catalog → Carstat → pending.
 */
export function getGetCarApiConfig(): { apiKey: string; baseUrl: string } | null {
  if (!isGetCarApiEnabledCached()) return null;
  const apiKey = process.env["GETCARAPI_API_KEY"]?.trim();
  if (!apiKey) return null;
  const baseUrl = (process.env["GETCARAPI_BASE_URL"]?.trim() || DEFAULT_BASE).replace(/\/$/, "");
  return { apiKey, baseUrl };
}

/** Prefer this before hot-path config peeks so admin disable applies immediately. */
export async function resolveGetCarApiConfig(): Promise<{ apiKey: string; baseUrl: string } | null> {
  await ensureGetCarApiEnabledLoaded();
  return getGetCarApiConfig();
}

function bearerHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  };
}

const COUNTRY_SLUG_TO_CODE: Record<string, string> = {
  south_korea: "kr",
  korea: "kr",
  kr: "kr",
  united_states: "us",
  usa: "us",
  us: "us",
  canada: "ca",
  ca: "ca",
  dubai: "ae",
  uae: "ae",
  ae: "ae",
  europe: "eu",
  eu: "eu",
  china: "cn",
  cn: "cn",
  japan: "jp",
  jp: "jp",
  mexico: "mx",
  mx: "mx",
};

export function mapGetCarApiCountry(slug: string | null | undefined): string | null {
  if (!slug) return null;
  const key = slug.trim().toLowerCase().replace(/\s+/g, "_");
  return COUNTRY_SLUG_TO_CODE[key] ?? (key.length <= 3 ? key : null);
}

function inferCountryFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/\bkorea\b|south[_\s-]?korea|\b서울\b|\b한국\b/.test(t)) return "kr";
  if (/\bcanada\b|\bontario\b|\bquebec\b|\bbritish columbia\b/.test(t)) return "ca";
  if (/\bunited states\b|\busa\b|\b u\.s\./.test(t)) return "us";
  if (/\bchina\b/.test(t)) return "cn";
  if (/\bjapan\b/.test(t)) return "jp";
  if (/\bmexico\b/.test(t)) return "mx";
  if (/\buae\b|\bdubai\b/.test(t)) return "ae";
  return null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t || null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "object" && !Array.isArray(v) && "name" in (v as object)) {
    return str((v as { name?: unknown }).name);
  }
  return null;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function isoDate(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return null;
  }
  return d.toISOString().slice(0, 10);
}

function metaOf(e: Record<string, unknown>): Record<string, unknown> {
  return e.metadata && typeof e.metadata === "object" && !Array.isArray(e.metadata)
    ? (e.metadata as Record<string, unknown>)
    : {};
}

function looksLikeFlood(...parts: Array<string | null | undefined>): boolean {
  return parts.some((p) => !!p && /flood|water.?damage|수침|침수/i.test(p));
}

function looksLikeRecall(...parts: Array<string | null | undefined>): boolean {
  return parts.some((p) => !!p && /recall|리콜/i.test(p));
}

function looksLikeInspection(...parts: Array<string | null | undefined>): boolean {
  return parts.some((p) => !!p && /inspect|inspection|검수|점검|정비/i.test(p));
}

/** Workshop / maintenance card tables — service history, not Events. */
function looksLikeServiceHistory(...parts: Array<string | null | undefined>): boolean {
  return parts.some((p) =>
    !!p && /maintenance\s*\/?\s*repair|repair\s*history|service\s*history|workshop|정비이력|수리이력/i.test(p),
  );
}

function looksLikeOwnerChange(...parts: Array<string | null | undefined>): boolean {
  return parts.some((p) =>
    !!p && /owner|ownership|owner[_\s-]?change|registration[_\s-]?change|title[_\s-]?transfer|registered\s+to|소유|명의/i.test(p),
  );
}

function looksLikeInsuranceClaim(...parts: Array<string | null | undefined>): boolean {
  return parts.some((p) =>
    !!p && /insurance|claim|payout|보상|보험/i.test(p) && !/accident|collision|crash|damage/i.test(p),
  ) || parts.some((p) => !!p && /^(insurance|claim|insurance_claim|insurance_event)$/i.test(p.trim()));
}

function firstPositiveAmount(...values: unknown[]): number | null {
  for (const value of values) {
    const n = num(value);
    if (n != null && n > 0) return n;
  }
  return null;
}

/**
 * Prefer payout amounts that match declared currency.
 * GCA often sends both insuranceBenefit (KRW) and insuranceBenefitUsd — picking USD
 * while currency stays "KRW" made the UI show "$0 (₩376)" for a ₩521,630 payout.
 */
function pickGetCarApiAccidentLoss(a: Record<string, unknown>): {
  lossAmount: number | null;
  currency: string | null;
} {
  const currencyRaw = (str(a.currency) ?? "").toUpperCase();
  const isKrw = currencyRaw === "KRW" || currencyRaw === "WON" || currencyRaw === "₩";
  const isUsd = currencyRaw === "USD" || currencyRaw === "$";
  const isEur = currencyRaw === "EUR" || currencyRaw === "€";

  const krwAmt = firstPositiveAmount(
    a.insuranceBenefit,
    a.repairTotal,
    a.lossAmount,
    a.amount,
    a.cost,
  );
  const usdAmt = firstPositiveAmount(
    a.insuranceBenefitUsd,
    a.repairTotalUsd,
    a.lossAmountUsd,
  );
  const eurAmt = firstPositiveAmount(
    a.insuranceBenefitEur,
    a.repairTotalEur,
    a.lossAmountEur,
  );

  if (isKrw) {
    if (krwAmt != null) return { lossAmount: krwAmt, currency: "KRW" };
    if (usdAmt != null) return { lossAmount: usdAmt, currency: "USD" };
    if (eurAmt != null) return { lossAmount: eurAmt, currency: "EUR" };
    return { lossAmount: null, currency: "KRW" };
  }
  if (isUsd) {
    if (usdAmt != null) return { lossAmount: usdAmt, currency: "USD" };
    if (krwAmt != null) return { lossAmount: krwAmt, currency: "KRW" };
    if (eurAmt != null) return { lossAmount: eurAmt, currency: "EUR" };
    return { lossAmount: null, currency: "USD" };
  }
  if (isEur) {
    if (eurAmt != null) return { lossAmount: eurAmt, currency: "EUR" };
    if (krwAmt != null) return { lossAmount: krwAmt, currency: "KRW" };
    if (usdAmt != null) return { lossAmount: usdAmt, currency: "USD" };
    return { lossAmount: null, currency: "EUR" };
  }

  // No/unknown currency: large integers are almost always KRW payouts.
  if (krwAmt != null && krwAmt >= 10_000) return { lossAmount: krwAmt, currency: "KRW" };
  if (usdAmt != null) return { lossAmount: usdAmt, currency: "USD" };
  if (eurAmt != null) return { lossAmount: eurAmt, currency: "EUR" };
  if (krwAmt != null) return { lossAmount: krwAmt, currency: currencyRaw || null };
  return { lossAmount: null, currency: currencyRaw || null };
}

function classifyGetCarApiEvent(
  eventType: string,
  metaType: string | null,
  title: string | null,
  subtitle: string | null,
  mappedType: string,
): "mileage" | "recall" | "inspection" | "owner" | "claim" | "event" {
  const parts = [eventType, metaType, title, subtitle, mappedType];
  if (
    eventType === "mileage"
    || metaType === "mileage"
    || /mileage/i.test(mappedType)
  ) {
    return "mileage";
  }
  if (looksLikeRecall(...parts)) return "recall";
  // Maintenance/repair card tables before generic inspection heuristics.
  if (looksLikeServiceHistory(...parts)) return "inspection";
  if (
    eventType === "inspection"
    || metaType === "inspection"
    || mappedType === "inspection"
    || looksLikeInspection(...parts)
  ) {
    return "inspection";
  }
  if (
    eventType === "owner_change"
    || eventType === "ownership"
    || metaType === "owner_change"
    || metaType === "ownership"
    || mappedType === "owner_change"
    || mappedType === "ownership"
    || looksLikeOwnerChange(...parts)
  ) {
    return "owner";
  }
  if (
    eventType === "insurance"
    || eventType === "claim"
    || eventType === "insurance_claim"
    || metaType === "insurance"
    || metaType === "claim"
    || mappedType === "insurance"
    || mappedType === "claim"
    || looksLikeInsuranceClaim(...parts)
  ) {
    return "claim";
  }
  return "event";
}

function humanizeToken(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  if (!/^[a-z0-9_]+$/i.test(t) || !t.includes("_")) return t;
  return t
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

type EventDetailRow = { label: string; value: string };

/**
 * GCA often sends Events as "Label: value" (First registration, license plate,
 * diagnosis, …) with no metadata/details — same pattern as First registration.
 * Split into a clear title + expandable detail row so cards are clickable.
 */
function refineColonTitleEvent(input: {
  title: string;
  date: string | null;
  mappedType: string;
  details?: EventDetailRow[];
}): {
  title: string;
  date: string | null;
  mappedType: string;
  details?: EventDetailRow[];
} {
  const firstReg = input.title.match(/^first\s+registration\s*:?\s*(.+)$/i);
  if (firstReg) {
    const datePart = firstReg[1]!.trim();
    const parsed = isoDate(datePart) ?? input.date;
    const details = input.details?.length
      ? input.details
      : [{ label: "First registration date", value: datePart }];

    return {
      title: "First registration",
      date: parsed,
      mappedType:
        input.mappedType === "delivery" || input.mappedType === "other" || input.mappedType === "event"
          ? "first_registration"
          : input.mappedType,
      details,
    };
  }

  if (
    input.mappedType === "delivery"
    && !input.details?.length
    && /first\s+registration/i.test(input.title)
  ) {
    return {
      ...input,
      title: "First registration",
      mappedType: "first_registration",
      details: input.date
        ? [{ label: "First registration date", value: input.date }]
        : undefined,
    };
  }

  if (input.details?.length) return input;
  if (/https?:\/\//i.test(input.title)) return input;

  const colon = input.title.match(/^(.{2,48}?)\s*:\s*(.+)$/);
  if (!colon || colon[1]!.includes(":")) return input;

  const label = colon[1]!.trim();
  const value = colon[2]!.trim();
  if (!label || !value) return input;

  const isFirstRegLabel = /first\s+registration/i.test(label);
  const parsedDate = isoDate(value) ?? input.date;

  return {
    title: isFirstRegLabel ? "First registration" : label,
    date: isFirstRegLabel ? (parsedDate ?? input.date) : input.date,
    mappedType: isFirstRegLabel
      ? "first_registration"
      : input.mappedType,
    details: [{
      label: isFirstRegLabel ? "First registration date" : label,
      value,
    }],
  };
}

/** @deprecated Use refineColonTitleEvent — kept name for call-site clarity in tests. */
const refineFirstRegistrationEvent = refineColonTitleEvent;

/** Free existence probe — never charges credits. */
export async function checkGetCarApiExists(vin: string): Promise<GetCarApiCheckResult> {
  const cfg = await resolveGetCarApiConfig();
  if (!cfg) return { status: "unavailable", reason: "GetCarAPI not configured" };

  const normalized = vin.trim().toUpperCase();
  const url = `${cfg.baseUrl}/api/v1/vin/check/${encodeURIComponent(normalized)}`;

  try {
    const res = await fetch(url, {
      headers: bearerHeaders(cfg.apiKey),
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    let body: Record<string, unknown> | null = null;
    try {
      body = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      body = null;
    }

    if (res.status === 404) {
      logger.info({ msg: "getcarapi_check_not_found", vin: normalized });
      return { status: "not_found" };
    }

    if (res.status === 401 || res.status === 403) {
      logger.warn({ msg: "getcarapi_check_auth", vin: normalized, status: res.status });
      return { status: "unavailable", reason: "GetCarAPI auth failed" };
    }

    if (!res.ok) {
      logger.warn({ msg: "getcarapi_check_error", vin: normalized, status: res.status, body: text.slice(0, 160) });
      return { status: "unavailable", reason: "GetCarAPI check unavailable" };
    }

    const payload =
      body?.data && typeof body.data === "object" && !Array.isArray(body.data)
        ? (body.data as Record<string, unknown>)
        : body;
    if (payload?.exists === true) {
      const country = mapGetCarApiCountry(str(payload.country));
      logger.info({ msg: "getcarapi_check_exists", vin: normalized, country });
      return { status: "exists", country };
    }
    if (payload?.exists === false) {
      logger.info({ msg: "getcarapi_check_not_found", vin: normalized });
      return { status: "not_found" };
    }

    logger.warn({ msg: "getcarapi_check_unexpected", vin: normalized, body: text.slice(0, 160) });
    return { status: "unavailable", reason: "GetCarAPI unexpected check response" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ msg: "getcarapi_check_failed", vin: normalized, err: msg });
    return { status: "unavailable", reason: "GetCarAPI check failed" };
  }
}

/** Paid retrieve — 1 credit on HTTP 200 for real VINs. Call only after payment. */
export async function fetchGetCarApiReport(vin: string): Promise<Record<string, unknown>> {
  const cfg = await resolveGetCarApiConfig();
  if (!cfg) throw new Error("GetCarAPI not configured");

  const normalized = vin.trim().toUpperCase();
  const url = `${cfg.baseUrl}/api/v1/vin/${encodeURIComponent(normalized)}`;
  const res = await fetch(url, {
    headers: bearerHeaders(cfg.apiKey),
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let body: Record<string, unknown>;
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error("GetCarAPI returned invalid JSON");
  }

  if (res.status === 404) {
    throw Object.assign(new Error("No vehicle history data found for this VIN in our database."), {
      code: "VIN_NO_DATA",
    });
  }
  if (res.status === 402) {
    throw Object.assign(new Error("GetCarAPI credits exhausted"), { code: "PROVIDER_CREDITS" });
  }
  if (res.status === 429) {
    throw Object.assign(new Error("GetCarAPI rate limited"), { code: "PROVIDER_RATE_LIMIT" });
  }
  if (!res.ok) {
    const errObj = body.error as { message?: string } | undefined;
    logger.error({ msg: "getcarapi_retrieve_error", vin: normalized, status: res.status, body: text.slice(0, 200) });
    throw new Error(errObj?.message || `GetCarAPI retrieve failed (${res.status})`);
  }

  const data = (body.data ?? body) as Record<string, unknown>;
  if (!data || typeof data !== "object") {
    throw new Error("GetCarAPI empty payload");
  }

  // Retrieve payload often omits country — free check fills it when missing.
  if (!str(data.country)) {
    try {
      const check = await checkGetCarApiExists(normalized);
      if (check.status === "exists" && check.country) {
        data.country = check.country;
      }
    } catch {
      /* ignore — country optional */
    }
  }

  return data;
}

function photoUrl(p: unknown): string | null {
  if (typeof p === "string") return p.trim() || null;
  if (p && typeof p === "object") {
    const o = p as Record<string, unknown>;
    // Coalesce per field — empty CDN strings must not block sourceUrl.
    return str(o.url) ?? str(o.storedPath) ?? str(o.sourceUrl) ?? str(o.originalUrl) ?? str(o.src);
  }
  return null;
}

function isGetCarApiCdnUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /imgsv\.getcarapi\.com|imagedelivery\.net|cloudflare/i.test(url);
}

type PhotoSlot = { primary: string; alternate?: string };

/** GetCarAPI top-level `extra` attribute cards (doors, stock number, …). */
export function collectGetCarApiExtras(raw: Record<string, unknown>): Array<{
  key?: string | null;
  label: string;
  value: string;
  observedAt?: string | null;
}> {
  const list = Array.isArray(raw.extra) ? raw.extra as unknown[] : [];
  const out: Array<{ key?: string | null; label: string; value: string; observedAt?: string | null }> = [];
  const seen = new Set<string>();

  for (const item of list.slice(0, 80)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const label = str(o.label) ?? humanizeToken(str(o.key)) ?? str(o.key);
    const value = str(o.value) ?? str(o.text) ?? str(o.info);
    if (!label || !value) continue;
    const dedupe = `${label.toLowerCase()}|${value.toLowerCase()}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({
      key: str(o.key),
      label,
      value,
      observedAt: isoDate(o.observedAt ?? o.date ?? o.seenAt),
    });
  }
  return out;
}

/**
 * Merge photosNew (CDN) + photos + photosOld (often dealer/source URLs).
 * Prefer Cloudflare/CDN as primary; keep sourceUrl / photosOld as per-slot alternate
 * so the gallery can fall back when CDN is incomplete or 404s.
 */
export function collectGetCarApiPhotos(raw: Record<string, unknown>): {
  photos: string[];
  photoAlternates: (string | null)[];
} {
  const byKey = new Map<string, { cdn?: string; source?: string; order: number }>();
  let order = 0;

  const ingest = (list: unknown, prefer: "cdn" | "source" | "auto") => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (typeof item === "string") {
        const url = item.trim();
        if (!url) continue;
        const key = url;
        const slot = byKey.get(key) ?? { order: order++ };
        if (prefer === "source" || (!isGetCarApiCdnUrl(url) && prefer === "auto")) {
          slot.source = slot.source ?? url;
        } else {
          slot.cdn = slot.cdn ?? url;
        }
        byKey.set(key, slot);
        continue;
      }
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const provider = (str(o.provider) ?? "").toLowerCase();
      const url = str(o.url) ?? str(o.storedPath);
      const explicitSource = str(o.sourceUrl) ?? str(o.originalUrl) ?? str(o.originUrl) ?? str(o.src);
      const id = str(o.id);
      const key = id ? `id:${id}` : (url ?? explicitSource ?? `anon:${order}`);
      if (!url && !explicitSource) continue;

      const slot = byKey.get(key) ?? { order: order++ };
      const urlIsCdn = provider === "cloudflare" || isGetCarApiCdnUrl(url)
        || (prefer === "cdn" && !!url);
      const urlIsSource = prefer === "source"
        || (prefer === "auto" && !!url && !urlIsCdn);

      if (url) {
        if (urlIsCdn) slot.cdn = slot.cdn ?? url;
        else if (urlIsSource) slot.source = slot.source ?? url;
        else slot.cdn = slot.cdn ?? url;
      }
      if (explicitSource) slot.source = slot.source ?? explicitSource;
      byKey.set(key, slot);
    }
  };

  // CDN-first, then legacy combined list, then older source mirrors.
  ingest(raw.photosNew, "cdn");
  ingest(raw.photos, "auto");
  ingest(raw.photosOld, "source");

  const slots: PhotoSlot[] = [...byKey.values()]
    .sort((a, b) => a.order - b.order)
    .map((s) => {
      const primary = s.cdn ?? s.source;
      if (!primary) return null;
      const alternate = s.cdn && s.source && s.source !== s.cdn ? s.source : undefined;
      return { primary, alternate };
    })
    .filter((s): s is PhotoSlot => s != null);

  // Deduplicate identical primaries while keeping first alternate.
  const seen = new Set<string>();
  const photos: string[] = [];
  const photoAlternates: (string | null)[] = [];
  for (const slot of slots) {
    if (seen.has(slot.primary)) continue;
    seen.add(slot.primary);
    photos.push(slot.primary);
    photoAlternates.push(slot.alternate && !seen.has(slot.alternate) ? slot.alternate : null);
  }

  return {
    photos: photos.slice(0, 48),
    photoAlternates: photoAlternates.slice(0, 48),
  };
}

/**
 * Map GetCarAPI public retrieve payload → NormalizedVinData.
 * Never pass this JSON through normalizeCarstatResponse.
 */
export function normalizeGetCarApiResponse(raw: Record<string, unknown>): NormalizedVinData {
  const vehicle = (raw.vehicle && typeof raw.vehicle === "object"
    ? raw.vehicle
    : {}) as Record<string, unknown>;

  const make = str(vehicle.make);
  const model = str(vehicle.model);
  const year = num(vehicle.year);
  const trim = str(vehicle.trim);
  const engine = str(vehicle.engineDisplacement ?? vehicle.engine);
  const transmission = str(vehicle.transmission);
  const fuelType = str(vehicle.fuelType);
  const bodyType = str(vehicle.bodyType);
  const color = str(vehicle.color);
  const odometer = num(
    vehicle.currentKnownMileageKm
    ?? vehicle.currentKnownMileage
    ?? vehicle.mileage
    ?? vehicle.odometer,
  );

  const listings = Array.isArray(raw.listings) ? raw.listings as Record<string, unknown>[] : [];
  const listingLocations = listings.map((l) => str(l.location)).filter(Boolean) as string[];

  const country =
    mapGetCarApiCountry(str(raw.country))
    ?? mapGetCarApiCountry(str(vehicle.country))
    ?? inferCountryFromText(str(vehicle.trim))
    ?? inferCountryFromText(listingLocations[0])
    ?? null;

  const { photos, photoAlternates } = collectGetCarApiPhotos(raw);
  const hasPhotoAlternates = photoAlternates.some((u) => !!u);

  const photos360Exterior = Array.isArray(raw.photosExterior3d)
    ? (raw.photosExterior3d as unknown[]).map(photoUrl).filter((u): u is string => !!u).slice(0, 72)
    : undefined;

  const accidentsRaw = Array.isArray(raw.accidents) ? raw.accidents as Record<string, unknown>[] : [];
  const ACCIDENT_SEVERITY_TIERS = new Set([
    "minor", "light", "moderate", "major", "severe", "total_loss", "unknown",
  ]);
  const accidents = accidentsRaw.map((a) => {
    const primaryDamage = str(a.primaryDamage ?? a.damage);
    const secondaryDamage = str(a.secondaryDamage);
    const type = str(a.type) ?? "accident";
    const category = humanizeToken(str(a.category));
    const severityRaw = humanizeToken(str(a.severity));
    const severityTier = (v: string | null) =>
      !!v && ACCIDENT_SEVERITY_TIERS.has(v.toLowerCase().replace(/\s+/g, "_"));
    // "primary"/"secondary" from GCA category are damage roles — not severity tiers.
    const severity = severityTier(severityRaw)
      ? severityRaw
      : severityTier(category)
        ? category
        : null;
    let description = humanizeToken(str(a.description ?? a.title));
    // Don't invent description from type/category (causes "Accident" / "Primary" spam on the graph).
    if (
      description
      && (
        /^accident$/i.test(description)
        || /^primary|secondary$/i.test(description)
        || (primaryDamage && description.toLowerCase() === primaryDamage.toLowerCase())
        || (severity && description.toLowerCase() === severity.toLowerCase())
      )
    ) {
      description = null;
    }
    const loss = pickGetCarApiAccidentLoss(a);
    return {
      date: isoDate(a.date ?? a.occurredAt),
      severity,
      description,
      country,
      type,
      primaryDamage,
      secondaryDamage,
      airbagDeployed: typeof a.airbagDeployed === "boolean" ? a.airbagDeployed : null,
      odometerAtLoss: num(a.odometer ?? a.mileageKm ?? a.mileage ?? a.odometerAtLoss),
      lossAmount: loss.lossAmount,
      ...(loss.currency ? { currency: loss.currency } : {}),
    };
  });

  const mileageSeen = new Set<string>();
  const mileageHistory: NonNullable<NormalizedVinData["mileageHistory"]> = [];
  const pushMileage = (date: string | null, odo: number | null, source: string) => {
    if (odo == null) return;
    const key = `${date ?? ""}|${odo}`;
    if (mileageSeen.has(key)) return;
    mileageSeen.add(key);
    mileageHistory.push({
      date,
      odometer: odo,
      unit: "km",
      source,
    });
  };

  const mileageRaw = Array.isArray(raw.mileageHistory) ? raw.mileageHistory as Record<string, unknown>[] : [];
  for (const m of mileageRaw) {
    pushMileage(
      isoDate(m.date ?? m.observedAt),
      num(m.mileageKm ?? m.odometer ?? m.mileage ?? m.value),
      str(m.kind ?? m.source) ?? "listing",
    );
  }

  const observations = Array.isArray(raw.observations) ? raw.observations as Record<string, unknown>[] : [];
  for (const o of observations) {
    pushMileage(
      isoDate(o.observedAt ?? o.date),
      num(o.mileageKm ?? o.mileage ?? o.odometer),
      "listing",
    );
  }

  const ownersRaw = Array.isArray(raw.ownerChanges) ? raw.ownerChanges as Record<string, unknown>[] : [];
  const ownerHistory: NonNullable<NormalizedVinData["ownerHistory"]> = ownersRaw.map((o) => ({
    date: isoDate(o.date ?? o.occurredAt),
    location: str(o.info ?? o.location ?? o.region ?? o.country),
    mileage: num(o.mileageKm ?? o.mileage ?? o.odometer),
  }));
  const ownerSeen = new Set(
    ownerHistory.map((o) => `${o.date ?? ""}|${o.mileage ?? ""}|${o.location ?? ""}`),
  );

  const auctionsRaw = Array.isArray(raw.auctionSales) ? raw.auctionSales as Record<string, unknown>[] : [];
  const auctionHistory = auctionsRaw.map((a) => ({
    date: isoDate(a.soldDate ?? a.date ?? a.soldAt ?? a.saleDate),
    city: str(a.city),
    state: str(a.state ?? a.region),
    country: mapGetCarApiCountry(str(a.country)) ?? str(a.country) ?? country,
    condition: str(a.condition),
    damage: str(a.damage),
    primaryDamage: str(a.primaryDamage),
    secondaryDamage: str(a.secondaryDamage),
    titleStatus: str(a.title ?? a.titleStatus),
    finalPrice: num(a.amount ?? a.priceUsd ?? a.price ?? a.finalPrice ?? a.salePrice),
    lotStatus: str(a.status ?? a.lotStatus ?? a.info),
  }));

  const salvage = raw.salvage && typeof raw.salvage === "object"
    ? raw.salvage as Record<string, unknown>
    : null;
  const titleStatus = str(salvage?.title ?? salvage?.brand ?? salvage?.status)
    ?? auctionHistory.find((a) => a.titleStatus)?.titleStatus
    ?? null;

  const eventsRaw = Array.isArray(raw.events) ? raw.events as Record<string, unknown>[] : [];
  const registryHistory: NonNullable<NormalizedVinData["registryHistory"]> = [];
  const recallHistory: NonNullable<NormalizedVinData["recallHistory"]> = [];
  const serviceHistory: NonNullable<NormalizedVinData["serviceHistory"]> = [];
  const insuranceClaims: NonNullable<NormalizedVinData["insuranceClaims"]> = [];

  for (const e of eventsRaw.slice(0, 120)) {
    const meta = metaOf(e);
    const eventType = str(e.eventType ?? e.type) ?? "event";
    const metaType = str(meta.type);
    const title = str(e.description ?? e.title ?? meta.title) ?? "Event";
    const subtitle = str(e.subtitle ?? meta.subtitle ?? meta.info);
    const date = isoDate(e.occurredAt ?? e.date ?? meta.date);
    const mileage = num(e.mileage ?? e.odometer ?? meta.mileageKm ?? meta.mileage);
    const amountNum = num(e.cost ?? meta.cost ?? e.amount ?? meta.amount ?? e.lossAmount);
    const amount = str(e.amount ?? meta.amount)
      ?? (amountNum != null ? String(amountNum) : null);
    const location = str(e.location ?? meta.location);
    const details = Array.isArray(meta.details)
      ? (meta.details as unknown[])
          .map((d) => {
            if (!d || typeof d !== "object") return null;
            const row = d as Record<string, unknown>;
            const label = str(row.label);
            const value = str(row.value);
            if (!label || !value) return null;
            return { label, value };
          })
          .filter((d): d is { label: string; value: string } => !!d)
      : undefined;

    const metaKind = str(meta.kind);
    const mappedType = metaType ?? eventType;
    const kind = (
      eventType === "mileage"
      || metaKind === "mileage_listing"
      || metaKind === "mileage"
    )
      ? "mileage" as const
      : classifyGetCarApiEvent(eventType, metaType, title, subtitle, mappedType);

    if (kind === "mileage") {
      pushMileage(date, mileage, "listing");
      continue;
    }

    if (kind === "recall") {
      recallHistory.push({
        date,
        type: "recall",
        title,
        subtitle,
        mileage,
        amount,
        location,
        ...(details && details.length > 0 ? { details } : {}),
      });
      continue;
    }

    if (kind === "inspection") {
      const detailMileage = (() => {
        for (const row of details ?? []) {
          if (!/mileage|odometer|driving distance|distance/i.test(row.label)) continue;
          const parsed = Number(String(row.value).replace(/[^\d.]/g, ""));
          if (Number.isFinite(parsed) && parsed > 0) return parsed;
        }
        return null;
      })();
      const detailLocation = (details ?? []).find((row) =>
        /station|center|location|address/i.test(row.label),
      )?.value ?? null;

      // Listing-probe rows look like "odometer 118686 km(listing)" — prefer a real title.
      const weakTitle = /^(odometer|mileage)\b/i.test(title) || /\(listing\)\s*$/i.test(title);
      const metaTitle = str(meta.title);
      const inspectionTitle = weakTitle
        ? (metaTitle && !/^(odometer|mileage)\b/i.test(metaTitle)
          ? metaTitle
          : "Car inspection completed")
        : title;

      const listingKm = weakTitle
        ? (mileage ?? (() => {
            const n = Number(title.replace(/[^\d]/g, ""));
            return Number.isFinite(n) && n > 0 ? n : null;
          })())
        : null;

      serviceHistory.push({
        date,
        mileage: mileage ?? detailMileage ?? listingKm,
        title: inspectionTitle,
        location: location ?? detailLocation,
        description: subtitle,
        ...(details && details.length > 0 ? { details } : {}),
      });
      continue;
    }

    if (kind === "owner") {
      const key = `${date ?? ""}|${mileage ?? ""}|${location ?? subtitle ?? ""}`;
      if (!ownerSeen.has(key)) {
        ownerSeen.add(key);
        ownerHistory.push({
          date,
          location: location ?? subtitle,
          mileage,
        });
      }
      continue;
    }

    if (kind === "claim") {
      insuranceClaims.push({
        date,
        type: mappedType === "other" ? "insurance" : mappedType,
        lossAmount: amountNum,
        description: [title, subtitle].filter(Boolean).join(" — ") || title,
      });
      continue;
    }

    // True Events only — not ownership / inspections / claims.
    const refined = refineFirstRegistrationEvent({
      title,
      date,
      mappedType,
      details,
    });
    const eventTitle = refined.title;
    const eventDate = refined.date;
    const registryType = refined.mappedType;
    const eventDetails = refined.details;

    const titleIsGeneric = !eventTitle
      || /^(event|no information|n\/a|unknown|-)$/i.test(eventTitle);
    const hasEventSubstance = Boolean(
      (!titleIsGeneric && eventTitle)
      || subtitle
      || mileage != null
      || amount
      || location
      || (eventDetails && eventDetails.length > 0),
    );
    if (!hasEventSubstance) continue;

    registryHistory.push({
      date: eventDate,
      type: registryType,
      title: titleIsGeneric
        ? (subtitle ?? humanizeToken(registryType) ?? registryType)
        : eventTitle,
      subtitle: titleIsGeneric ? null : subtitle,
      mileage,
      amount,
      location,
      ...(eventDetails && eventDetails.length > 0 ? { details: eventDetails } : {}),
    });
  }

  const floodFromText = looksLikeFlood(
    titleStatus,
    str(salvage?.title),
    str(salvage?.brand),
    str(salvage?.status),
    str(salvage?.damage),
    ...accidents.flatMap((a) => [a.description, a.severity, a.primaryDamage, a.type]),
    ...auctionHistory.flatMap((a) => [a.titleStatus, a.damage, a.primaryDamage]),
    ...registryHistory.flatMap((e) => [e.title, e.subtitle, e.type]),
    ...insuranceClaims.flatMap((c) => [c.type, c.description]),
  );
  const looksLikeTotalLoss = (...parts: Array<string | null | undefined>) =>
    parts.some((p) => !!p && /salvage|flood|junk|rebuilt|total.?loss|\btl\b|scrap/i.test(p));

  const isSalvage = salvage != null
    || (typeof raw.isSalvage === "boolean" ? raw.isSalvage : false)
    || looksLikeTotalLoss(titleStatus, str(salvage?.title), str(salvage?.brand), str(salvage?.status))
    || auctionHistory.some((a) => looksLikeTotalLoss(a.titleStatus, a.damage, a.primaryDamage, a.lotStatus));
  const explicitFlood = typeof raw.isFlooded === "boolean" ? raw.isFlooded : null;
  // Assessed clear when no flood signal — matches Carstat-style “No flood record found”.
  const isFlooded = explicitFlood === true || floodFromText;
  const explicitStolen = typeof raw.isStolen === "boolean" ? raw.isStolen : null;
  const stolenFromText = /stolen|theft|угон|도난/i.test(
    [titleStatus, str(salvage?.status), ...accidents.map((a) => a.description ?? "")].filter(Boolean).join(" "),
  );
  // Assessed clear when no theft signal (Carstat-style).
  const isStolen = explicitStolen === true || (explicitStolen !== false && stolenFromText);

  const pickListingMarket = (): { value: number; currency: string } | null => {
    for (const l of listings) {
      const usd = num(l.priceUsd);
      if (usd != null && usd > 0) return { value: usd, currency: "USD" };
    }
    for (const l of listings) {
      const amount = num(l.priceAmount ?? l.price);
      if (amount == null || amount <= 0) continue;
      const cur = (str(l.priceCurrency) ?? "").toUpperCase();
      if (cur === "KRW" || cur === "WON" || cur === "₩") return { value: amount, currency: "KRW" };
      if (cur === "USD" || cur === "$") return { value: amount, currency: "USD" };
      if (cur === "EUR" || cur === "€") return { value: amount, currency: "EUR" };
      // Korean listings often omit currency but quote large won amounts.
      if (!cur && country === "kr" && amount >= 100_000) return { value: amount, currency: "KRW" };
      return { value: amount, currency: cur || "USD" };
    }
    return null;
  };

  const listingMarket = pickListingMarket();
  const lastAuction = auctionHistory.find((a) => a.finalPrice != null);
  const lastAuctionCurrency =
    (country === "kr" && (lastAuction?.finalPrice ?? 0) >= 100_000)
      ? "KRW"
      : (listingMarket?.currency === "KRW" ? "KRW" : "USD");

  // GetCarAPI "Extra" tab — key/value attribute cards (doors, stock #, …). Own section, never Events.
  const vehicleExtras = collectGetCarApiExtras(raw);

  return {
    dataSource: GETCARAPI_DATA_SOURCE,
    make,
    model,
    year,
    trim,
    engine,
    transmission,
    fuelType,
    bodyType,
    color,
    country,
    odometer,
    accidentCount: accidents.length,
    ...(ownerHistory.length > 0 ? { ownerCount: ownerHistory.length } : {}),
    isSalvage,
    isStolen,
    isFlooded,
    floodCount: isFlooded ? 1 : 0,
    titleStatus,
    photos,
    ...(hasPhotoAlternates ? { photoAlternates } : {}),
    ...(photos360Exterior && photos360Exterior.length > 0 ? { photos360Exterior } : {}),
    accidents,
    ...(insuranceClaims.length > 0 ? { insuranceClaims } : {}),
    mileageHistory: mileageHistory.length > 0 ? mileageHistory : undefined,
    ...(serviceHistory.length > 0 ? { serviceHistory: dedupeServiceHistory(serviceHistory, year) } : {}),
    ...(ownerHistory.length > 0 ? { ownerHistory } : {}),
    auctionHistory: auctionHistory.length > 0 ? auctionHistory : undefined,
    // Events timeline — UI shows "Events" when dataSource === getcarapi (true events only).
    registryHistory: registryHistory.length > 0 ? registryHistory : undefined,
    recallHistory: recallHistory.length > 0 ? recallHistory : undefined,
    ...(vehicleExtras.length > 0 ? { vehicleExtras } : {}),
    marketData: (lastAuction?.finalPrice != null || listingMarket != null)
      ? {
          estimatedValue: listingMarket?.value ?? null,
          lastAuctionPrice: lastAuction?.finalPrice ?? null,
          lastAuctionDate: lastAuction?.date ?? null,
          currency: listingMarket?.currency
            ?? (lastAuction?.finalPrice != null ? lastAuctionCurrency : "USD"),
        }
      : undefined,
  };
}
