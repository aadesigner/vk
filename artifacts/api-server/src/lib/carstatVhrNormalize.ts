/**
 * Map Carstat VHR schema_version 2 JSON into kmcheck NormalizedVinData.
 * UI uses our report sections (mileage / auctions / accidents / extras) — not provider HTML.
 */
import { decodeVin } from "@workspace/vin-decode";
import type { NormalizedVinData } from "./vinService.js";
import {
  isCarstatIllustrativeDemoPayload,
  resolveCarstatReportPhotos,
} from "./carstatDemoPhotos.js";
import {
  payloadContainsCyrillic,
  translateKoToEn,
  translateNormalizedReportRuToEn,
  translateRuToEn,
  translateVhrJsonRuToEn,
} from "./carstatVhrRuTranslate.js";

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t || null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Parse "20,950.00 EUR", "93 000", "744~ 1 031" fragments into a finite number. */
function parseMoneyish(v: unknown): number | null {
  const direct = num(v);
  if (direct != null) return direct;
  const s = str(v);
  if (!s) return null;
  const cleaned = s
    .replace(/[^\d.,~\-\s]/g, " ")
    .replace(/\s+/g, "")
    .replace(/,/g, "");
  const first = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!first) return null;
  const n = Number(first[0]);
  return Number.isFinite(n) ? n : null;
}

function averageNums(vals: number[]): number | null {
  const good = vals.filter((n) => Number.isFinite(n) && n > 0);
  if (!good.length) return null;
  return Math.round(good.reduce((a, b) => a + b, 0) / good.length);
}

function currencyFromText(raw: unknown): string | null {
  const s = str(raw);
  if (!s) return null;
  if (/\bKRW\b|₩|\bWON\b/i.test(s)) return "KRW";
  if (/\bEUR\b|€/i.test(s)) return "EUR";
  if (/\bGBP\b|£/i.test(s)) return "GBP";
  if (/\bUSD\b|\bUS\$/i.test(s)) return "USD";
  return null;
}

/**
 * Used-car USD/EUR/GBP amounts at Korean-won scale (≥ 1M) are almost always
 * mislabeled KRW (e.g. 41,500,000 EUR for a normal car). Relabel, don't trust.
 */
function sanitizeMoney(
  value: number,
  currency: string,
): { value: number; currency: string } {
  const c = (currency || "USD").toUpperCase();
  if ((c === "USD" || c === "EUR" || c === "GBP") && value >= 1_000_000) {
    return { value, currency: "KRW" };
  }
  return { value, currency: c };
}

function resolveListingCurrency(
  item: Record<string, unknown>,
  srcData: Record<string, unknown> | null,
  marketplaceRaw: string | null,
): string {
  const explicit =
    currencyFromText(srcData?.currency)
    ?? currencyFromText(item.currency);
  if (explicit) return explicit;
  if (marketplaceRaw && /encar/i.test(marketplaceRaw)) return "KRW";
  if (marketplaceRaw && /copart|iaai/i.test(marketplaceRaw)) return "USD";
  return "USD";
}

/** Sale/list prices from history only — not buy-now aspirational asks. */
function salePricesFromHistory(
  hist: unknown,
  fallbackCurrency: string,
): Array<{ value: number; currency: string; date: string | null }> {
  if (!Array.isArray(hist)) return [];
  const out: Array<{ value: number; currency: string; date: string | null }> = [];
  for (const row of hist) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const o = row as Record<string, unknown>;
    const rawPrice =
      o.price
      ?? o.final_bid
      ?? o.auction_final_bid
      ?? o.extern_final_bid
      ?? o.price_with_tax;
    const value = parseMoneyish(rawPrice);
    if (value == null || value <= 0) continue;
    const rowCurrency =
      currencyFromText(rawPrice)
      ?? currencyFromText(o.currency)
      ?? fallbackCurrency;
    const money = sanitizeMoney(value, rowCurrency);
    out.push({
      value: money.value,
      currency: money.currency,
      date: dateOnly(o.date ?? o.sale_date ?? o.created_at),
    });
  }
  return out;
}

/**
 * Korean insurance market range is often in 만원 (×10,000 KRW), e.g. "744~ 1 031".
 * Large absolute KRW ranges are kept as-is.
 */
function parseKoreanPriceRange(raw: unknown): {
  low: number;
  high: number;
  avg: number;
  display: string;
} | null {
  const s = str(raw);
  if (!s) return null;
  const parts = s.split(/~|–|—|-/).map((p) => p.trim()).filter(Boolean);
  const nums = parts.map((p) => parseMoneyish(p)).filter((n): n is number => n != null && n > 0);
  if (!nums.length) return null;
  const low = Math.min(...nums);
  const high = Math.max(...nums);
  const looksLikeManwon = high < 100_000;
  const scale = looksLikeManwon ? 10_000 : 1;
  const scaledLow = Math.round(low * scale);
  const scaledHigh = Math.round(high * scale);
  return {
    low: scaledLow,
    high: scaledHigh,
    avg: Math.round((scaledLow + scaledHigh) / 2),
    display: s,
  };
}

function dateOnly(raw: unknown): string | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    // Unix seconds or milliseconds
    const ms = raw < 1e12 ? raw * 1000 : raw;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime()) && d.getUTCFullYear() >= 1980 && d.getUTCFullYear() <= 2100) {
      return d.toISOString().slice(0, 10);
    }
  }
  const s = str(raw);
  if (!s) return null;
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso?.[1]) return iso[1];
  // "2026-10-24T12:00:00Z" already handled; also "24 Oct 2026" / "Oct 24, 2026"
  if (/[A-Za-z]/.test(s) || /^\d{1,2}[./]\d{1,2}[./]\d{2,4}$/.test(s)) {
    const parsed = Date.parse(s);
    if (Number.isFinite(parsed)) {
      const d = new Date(parsed);
      if (d.getUTCFullYear() >= 1980 && d.getUTCFullYear() <= 2100) {
        return d.toISOString().slice(0, 10);
      }
    }
  }
  return null;
}

function parseKmish(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = str(v);
  if (!s) return null;
  const cleaned = s.replace(/[^\d]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function localizedText(v: unknown, lang = "en"): string | null {
  if (typeof v === "string") return str(v);
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  return str(o[lang]) ?? str(o.en) ?? str(Object.values(o).find((x) => typeof x === "string") as string | undefined);
}

/** Parse "2018 Honda CR-V EX AWD" → year/make/model/trim. */
export function parseVehicleTitle(title: string | null | undefined): {
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
} {
  if (!title?.trim()) return { year: null, make: null, model: null, trim: null };
  const parts = title.trim().split(/\s+/);
  let year: number | null = null;
  if (/^\d{4}$/.test(parts[0] ?? "")) {
    year = Number(parts.shift());
  }
  const make = parts[0] ?? null;
  const model = parts[1] ?? null;
  const trim = parts.length > 2 ? parts.slice(2).join(" ") : null;
  return { year, make, model, trim };
}

const BODY_TYPE: Record<number, string> = {
  1: "Sedan",
  2: "Hatchback",
  3: "Wagon",
  4: "Coupe",
  5: "SUV",
  6: "Pickup",
  7: "Van",
  8: "Convertible",
  9: "Minivan",
  10: "Crossover",
};

const FUEL: Record<number, string> = {
  1: "Gasoline",
  2: "Diesel",
  3: "Hybrid",
  4: "Gasoline",
  5: "Electric",
  6: "LPG",
  7: "CNG",
  8: "Plug-in Hybrid",
};

const TRANSMISSION: Record<number, string> = {
  1: "Automatic",
  2: "Manual",
  3: "CVT",
  4: "DCT",
  5: "Automated Manual",
};

/**
 * Copart/IAAI-style damage type ids used by Carstat VHR listings.
 * Prefer explicit *_label / name fields when present; never show "Damage 1".
 */
const AUCTION_DAMAGE: Record<number, string> = {
  1: "Front End",
  2: "Rear End",
  3: "Side",
  4: "All Over",
  5: "Vandalism",
  6: "Minor Dent/Scratches",
  7: "Rollover",
  8: "Burn",
  9: "Hail",
  10: "Mechanical",
  11: "Water/Flood",
  12: "Undercarriage",
  13: "Frame Damage",
  14: "Suspension",
  15: "Electrical",
  16: "Normal Wear",
  17: "Cosmetic",
};

function mapEnum(table: Record<number, string>, code: unknown): string | null {
  const n = num(code);
  if (n == null) return str(code);
  return table[n] ?? `Code ${n}`;
}

function titleCaseLabel(raw: string | null): string | null {
  if (!raw) return null;
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Carstat inspection rows often ship map meta as the description:
 * "Marked in abnormal body parts section · Body map position 31: Replaced"
 * Keep "Front fender: Replaced" — drop the body-map crumbs.
 */
export function simplifyInspectionAccidentDescription(
  part: string | null | undefined,
  rawDesc: string | null | undefined,
): string {
  const partLabel = (part ?? "").trim();
  let desc = (rawDesc ?? "").trim();
  desc = desc
    .replace(/Marked in abnormal body parts? section\s*[·•|,:\-]?\s*/gi, "")
    .replace(/Body map positions?\s*\d+\s*:?\s*/gi, "")
    .replace(/^\s*[·•|,:\-]\s*/g, "")
    .replace(/\s*[·•]\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const actionMatch = desc.match(
    /\b(Repaired or welded|Replaced|Repaired|Repainted|Welded|Removed|Damaged)\b/i,
  );
  let action = (actionMatch?.[1] ?? desc).trim();
  if (actionMatch?.[1]) {
    action = action.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s+Or\s+/g, " or ");
  }
  if (partLabel && action) return `${partLabel}: ${action}`;
  return partLabel || action || "Inspection finding";
}

function prettyMarketplace(raw: string | null): string | null {
  if (!raw) return null;
  const host = raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0] ?? raw;
  const key = host.toLowerCase();
  if (key.includes("copart")) return "Copart";
  if (key.includes("iaai") || key.includes("insuranceauction")) return "IAAI";
  if (key.includes("encar")) return "Encar";
  if (key.includes("manheim")) return "Manheim";
  return titleCaseLabel(host.replace(/\.com$/i, "")) ?? host;
}

/** Copart / IAAI are salvage-auction marketplaces — treat presence as salvage by default. */
function isNaSalvageAuctionMarketplace(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return /copart|iaai|insuranceauction/i.test(raw);
}

/** Auction / classifieds sites — never treat their stub service_history as workshop visits. */
function isAuctionOrClassifiedMarketplace(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return /copart|iaai|insuranceauction|encar|manheim|autobell|european|marketplace|auction|mobile\.de|autoscout|leboncoin/i
    .test(raw);
}

/**
 * Carstat Archive Alpha playground labels that are not real sale houses.
 * "US auction" is kept — it carries usable NA price/odo/damage; Euro 6 / fake
 * service stubs on that row are stripped separately.
 * EU/KR generic marketplace rows are skipped (mashup fiction on demos).
 */
function isPlaygroundGenericMarketplace(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const key = raw.trim().toLowerCase().replace(/\s+/g, " ");
  return /^(european(\s+vehicle)?\s*marketplace|korean\s*marketplace|listing)$/i.test(key);
}

/** Sale markets outside NA — drop on US/Canada-origin VINs (no EU/KR/CN mashups). */
function isNonNorthAmericanSaleMarket(
  marketplace: string | null | undefined,
  listingCountry: string | null | undefined,
  currency: string | null | undefined,
): boolean {
  const market = `${marketplace ?? ""}`;
  const country = `${listingCountry ?? ""}`;
  const cur = `${currency ?? ""}`.toUpperCase();
  if (cur === "KRW" || cur === "JPY" || cur === "CNY" || cur === "AED") return true;
  if (/encar|korean\s*marketplace|autobell/i.test(market)) return true;
  if (/korea|\bKR\b/i.test(country)) return true;
  if (isEuropeanListingMarket(market, country)) return true;
  if (/china|\bCN\b|japan|\bJP\b|uae|united\s*arab/i.test(country)) return true;
  return false;
}

function isEuropeanListingMarket(
  marketplace: string | null | undefined,
  listingCountry: string | null | undefined,
): boolean {
  const blob = `${marketplace ?? ""} ${listingCountry ?? ""}`;
  return /european|germany|deutschland|\bde\b|france|\bfr\b|italy|\bit\b|spain|\bes\b|poland|netherlands|belgium|austria|switzerland|sweden|norway|denmark|finland|united\s*kingdom|\buk\b|england|mobile\.de|autoscout/i
    .test(blob);
}

function isNorthAmericanCountry(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return /united\s*states|\busa?\b|canada|mexico|\bus\b|\bca\b|\bmx\b/i.test(raw);
}

function isEuroEmissionValue(raw: unknown): boolean {
  return /euro\s*\d/i.test(String(raw ?? ""));
}

/** Carstat VHR listing country_id → ISO (observed on playground + live checks). */
const CARSTAT_COUNTRY_ID: Record<number, string> = {
  1: "US",
  122: "KR",
};

function mapCarstatCountryId(raw: unknown): string | null {
  const n = num(raw);
  if (n == null) return null;
  return CARSTAT_COUNTRY_ID[n] ?? null;
}

function inferListingCountry(item: Record<string, unknown>, marketplaceRaw: string | null, currency: string): string | null {
  return (
    str(item.country_iso)
    ?? mapCarstatCountryId(item.country_id)
    ?? (currency.toUpperCase() === "KRW" ? "KR" : null)
    ?? (currency.toUpperCase() === "USD" && marketplaceRaw && /copart|iaai/i.test(marketplaceRaw) ? "US" : null)
    ?? (marketplaceRaw && /encar/i.test(marketplaceRaw) ? "KR" : null)
  );
}

const US_STATE_ABBR_RE =
  /\b(A[LKZR]|C[AOT]|D[EC]|FL|GA|HI|I[ADLN]|K[SY]|LA|M[ADEHINOST]|N[CDEHJMVY]|O[HKR]|P[AWR]|RI|S[CD]|T[NX]|UT|V[AIT]|W[AIVY])\b/i;
const NON_US_COUNTRY_RE =
  /\b(germany|deutschland|de|south\s*korea|korea|kr|japan|jp|france|fr|italy|it|spain|es|poland|pl|netherlands|nl|belgium|be|austria|at|switzerland|ch|sweden|se|norway|no|denmark|dk|finland|fi|united\s*kingdom|england|uk|gb|china|cn|taiwan|tw|australia|au)\b/i;
const US_CITY_RE =
  /\b(houston|dallas|austin|los\s*angeles|new\s*york|chicago|miami|atlanta|seattle|phoenix|denver|boston|detroit)\b/i;

function scrubDemoPlace(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value
    .replace(/\bdemo\s*region\b/gi, "")
    .replace(/\bdemo\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[,;\s]+|[,;\s]+$/g, "")
    .trim();
  return cleaned || null;
}

/** Prefer marketplace country over US city mashups on European/KR listings (and vice versa). */
function sanitizeListingPlace(
  city: string | null,
  state: string | null,
  country: string | null,
  marketplace: string | null,
): { city: string | null; state: string | null; country: string | null } {
  let nextCity = scrubDemoPlace(city);
  let nextState = scrubDemoPlace(state);
  let nextCountry = country?.trim() || null;
  const placeBlob = `${nextCity ?? ""} ${nextState ?? ""}`;
  const usLooking = US_STATE_ABBR_RE.test(placeBlob) || US_CITY_RE.test(placeBlob);
  const nonUsCountry = nextCountry ? NON_US_COUNTRY_RE.test(nextCountry) : false;
  const market = (marketplace ?? "").toLowerCase();
  const usAuction = /copart|iaai/.test(market);
  const nonUsMarketplace = /encar|european|korea|autobell|mobile\.de|autoscout/.test(market);

  if (usLooking && nonUsCountry) {
    if (usAuction) {
      nextCountry = "USA";
    } else if (nonUsMarketplace || nonUsCountry) {
      nextCity = null;
      nextState = null;
    }
  }
  return { city: nextCity, state: nextState, country: nextCountry };
}

function resolveAuctionDamage(
  item: Record<string, unknown>,
  which: "primary" | "secondary",
): string | null {
  if (which === "primary") {
    const labeled =
      localizedText(item.main_damage_label)
      ?? localizedText(item.primary_damage_label)
      ?? localizedText(item.damage_label)
      ?? str(item.main_damage_name)
      ?? str(item.primary_damage_name)
      ?? (typeof item.main_damage === "string" ? str(item.main_damage) : null);
    if (labeled) return labeled;
    const nested = item.damage;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const o = nested as Record<string, unknown>;
      const main = o.main ?? o.primary;
      if (typeof main === "string") return str(main);
      if (main && typeof main === "object" && !Array.isArray(main)) {
        return str((main as Record<string, unknown>).name)
          ?? localizedText((main as Record<string, unknown>).label);
      }
    }
    const id = num(item.main_damage_id ?? item.primary_damage_id ?? item.damage);
    if (id != null) return AUCTION_DAMAGE[id] ?? null;
    return null;
  }

  const labeled =
    localizedText(item.second_damage_label)
    ?? localizedText(item.secondary_damage_label)
    ?? str(item.second_damage_name)
    ?? str(item.secondary_damage_name)
    ?? (typeof item.second_damage === "string" ? str(item.second_damage) : null)
    ?? (typeof item.secondary_damage === "string" ? str(item.secondary_damage) : null);
  if (labeled) return labeled;
  const nested = item.damage;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const o = nested as Record<string, unknown>;
    const second = o.second ?? o.secondary;
    if (typeof second === "string") return str(second);
    if (second && typeof second === "object" && !Array.isArray(second)) {
      return str((second as Record<string, unknown>).name)
        ?? localizedText((second as Record<string, unknown>).label);
    }
  }
  const id = num(item.second_damage_id ?? item.secondary_damage_id ?? item.second_damage);
  if (id != null) return AUCTION_DAMAGE[id] ?? null;
  return null;
}

function pushExtra(
  extras: NonNullable<NormalizedVinData["vehicleExtras"]>,
  key: string,
  label: string,
  value: unknown,
  observedAt: string | null = null,
): void {
  if (value == null || value === "") return;
  const raw = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value).trim();
  if (!raw) return;
  const text = translateRuToEn(raw);
  const labelEn = translateRuToEn(label);
  if (extras.some((e) => e.key === key && e.value === text)) return;
  extras.push({ key, label: labelEn, value: text, observedAt });
}

/** Korean/EN “none / absent” markers — must never become accident rows. */
function isAbsentFinding(raw: unknown): boolean {
  const s = str(raw)?.toLowerCase();
  if (!s) return false;
  return /^(없음|무|none|n\/a|na|absent|not\s*present|no|false|0)$/i.test(s)
    || /없음|not\s*present|no\s*(accident|history|record)/i.test(s);
}

function isPresentFinding(raw: unknown): boolean {
  const s = str(raw)?.toLowerCase();
  if (!s) return false;
  return /^(있음|유|yes|present|true|1)$/i.test(s) || /있음|recorded|found/i.test(s);
}

/** Only real positive findings become accidents — never “ok / 없음”. */
function isActionableClaim(claim: Record<string, unknown>): boolean {
  const result = str(claim.result_key)?.toLowerCase();
  if (result === "ok" || result === "pass" || result === "not_present" || result === "clear") return false;
  if (isAbsentFinding(claim.description) || isAbsentFinding(claim.source_label)) return false;
  if (result === "issue" || result === "fail" || result === "present") return true;
  if (isPresentFinding(claim.description)) return true;
  // Legacy playground rows without result_key but with a concrete repair note.
  if (!result && str(claim.description) && !isAbsentFinding(claim.description)) return true;
  return false;
}

function detailsFromPairs(
  rows: Array<{ label: string; value: string }>,
): Array<{ label: string; value: string }> {
  return rows.filter((r) => r.label && r.value);
}

/** Carstat KR claim column type codes → report claim type slugs. */
function mapKoreanClaimType(raw: unknown): string {
  const code = str(raw) ?? String(raw ?? "");
  if (code === "1") return "insurance_own_damage";
  if (code === "2") return "insurance_third_party_own_damage";
  if (code === "3") return "insurance_third_party";
  return "Insurance claim";
}

function sectionsOf(body: Record<string, unknown>): Array<Record<string, unknown>> {
  const source =
    body.source && typeof body.source === "object" && !Array.isArray(body.source)
      ? (body.source as Record<string, unknown>)
      : body;
  const sections = source.sections;
  if (!Array.isArray(sections)) return [];
  return sections.filter((s): s is Record<string, unknown> => !!s && typeof s === "object" && !Array.isArray(s));
}

function itemsOf(section: Record<string, unknown>): Array<Record<string, unknown>> {
  const items = section.items;
  if (!Array.isArray(items)) return [];
  return items.filter((i): i is Record<string, unknown> => !!i && typeof i === "object" && !Array.isArray(i));
}

function mergeUniqueByKey<T extends Record<string, unknown>>(
  rows: T[],
  keyFn: (row: T) => string,
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const k = keyFn(row);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(row);
  }
  return out;
}

function mileageSourceRank(source: unknown): number {
  const s = String(source ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!s) return 0;
  if (/copart/.test(s)) return 100;
  if (/iaai|insurance\s*auto\s*auction/.test(s)) return 95;
  if (/encar/.test(s)) return 85;
  if (/manheim/.test(s)) return 80;
  if (/korean\s*inspection|inspection|registry|insurance|export/.test(s)) return 70;
  if (/european\s*marketplace|korean\s*marketplace|us\s*auction|^listing$|^marketplace$/.test(s)) {
    return 5;
  }
  return 40;
}

function sameDayOdometersClose(a: number, b: number): boolean {
  const diff = Math.abs(a - b);
  if (diff <= 500) return true;
  const max = Math.max(a, b);
  return max > 0 && diff / max <= 0.015;
}

function mileageDamageRichness(row: Record<string, unknown>): number {
  const primary = String(row.primaryDamage ?? row.damage ?? "").trim();
  const secondary = String(row.secondaryDamage ?? "").trim();
  let score = primary.length + (secondary ? secondary.length + 12 : 0);
  if (/^cosmetic$/i.test(primary) && !secondary) score -= 8;
  return score;
}

/** One reading per day when provider stubs disagree by tens of km. */
function consolidateSameDayMileage<T extends Record<string, unknown>>(rows: T[]): T[] {
  if (rows.length <= 1) return rows;
  const byDate = new Map<string, T[]>();
  const undated: T[] = [];
  for (const row of rows) {
    const date = dateOnly(row.date) ?? String(row.date ?? "").slice(0, 10);
    if (!date) {
      undated.push(row);
      continue;
    }
    const bucket = byDate.get(date) ?? [];
    bucket.push(row);
    byDate.set(date, bucket);
  }

  const out: T[] = [...undated];
  for (const group of byDate.values()) {
    const clusters: T[][] = [];
    for (const row of group) {
      const odo = num(row.odometer);
      let placed = false;
      for (const cluster of clusters) {
        const seed = num(cluster[0]?.odometer);
        if (odo != null && seed != null && sameDayOdometersClose(odo, seed)) {
          cluster.push(row);
          placed = true;
          break;
        }
      }
      if (!placed) clusters.push([row]);
    }
    for (const cluster of clusters) {
      const strong = cluster.filter((r) => mileageSourceRank(r.source) > 5);
      const usable = strong.length > 0 ? strong : cluster;
      const merged = usable.reduce((a, b) => {
        const aRank = mileageSourceRank(a.source);
        const bRank = mileageSourceRank(b.source);
        const preferA =
          aRank > bRank
          || (aRank === bRank && mileageDamageRichness(a) >= mileageDamageRichness(b));
        const primary = preferA ? a : b;
        const secondary = preferA ? b : a;
        return {
          ...secondary,
          ...primary,
          date: primary.date || secondary.date,
          odometer: primary.odometer ?? secondary.odometer,
          unit: primary.unit || secondary.unit,
          source: primary.source || secondary.source,
          primaryDamage: primary.primaryDamage || primary.damage || secondary.primaryDamage || secondary.damage,
          secondaryDamage: primary.secondaryDamage || secondary.secondaryDamage,
          auctionPrice: primary.auctionPrice ?? secondary.auctionPrice,
          currency: primary.currency || secondary.currency,
        };
      });
      out.push(merged);
    }
  }
  return out;
}

/**
 * Normalize one or more VHR JSON payloads into a single structured report.
 */
export function normalizeCarstatVhrJsonPayloads(
  payloads: unknown[],
  meta?: { vin?: string },
): NormalizedVinData {
  // Always strip Cyrillic labels before mapping (Carstat often ships RU on "en" reports).
  const translatedPayloads = payloads.map((p) =>
    payloadContainsCyrillic(p) ? translateVhrJsonRuToEn(p) : p,
  );
  const mileageHistory: NonNullable<NormalizedVinData["mileageHistory"]> = [];
  const auctionHistory: NonNullable<NormalizedVinData["auctionHistory"]> = [];
  const accidents: NonNullable<NormalizedVinData["accidents"]> = [];
  const insuranceClaims: NonNullable<NormalizedVinData["insuranceClaims"]> = [];
  const serviceHistory: NonNullable<NormalizedVinData["serviceHistory"]> = [];
  const recallHistory: NonNullable<NormalizedVinData["recallHistory"]> = [];
  const registryHistory: NonNullable<NormalizedVinData["registryHistory"]> = [];
  const vehicleExtras: NonNullable<NormalizedVinData["vehicleExtras"]> = [];
  const ownerHistory: NonNullable<NormalizedVinData["ownerHistory"]> = [];
  const photos: string[] = [];
  const photosHd: string[] = [];
  const estimateCandidates: Array<{ value: number; currency: string; rank: number }> = [];
  /** Sale prices grouped by currency — never mix KRW millions into EUR/USD averages. */
  const salePricesByCurrency = new Map<string, number[]>();

  let make: string | null = null;
  let model: string | null = null;
  let year: number | null = null;
  let trim: string | null = null;
  let engine: string | null = null;
  let transmission: string | null = null;
  let fuelType: string | null = null;
  let bodyType: string | null = null;
  let color: string | null = null;
  let country: string | null = null;
  let hp: number | null = null;
  let cylinders: number | null = null;
  let odometer: number | null = null;
  let isFlooded: boolean | null = null;
  let isSalvage: boolean | null = null;
  let isTaxi: boolean | null = null;
  let isStolen: boolean | null = null;
  let lastAuctionPrice: number | null = null;
  let lastAuctionDate: string | null = null;
  let marketCurrency: string | null = "USD";
  let ownerCount: number | null = null;
  let accidentCountHint: number | null = null;
  let sawKoreanInsurance = false;
  let krIdentity: {
    make?: string | null;
    model?: string | null;
    year?: number | null;
    trim?: string | null;
    engine?: string | null;
    fuelType?: string | null;
    bodyType?: string | null;
  } | null = null;

  // Report capture time — last-resort date for Copart/IAAI rows that omit sale_date.
  let envelopeDate: string | null = null;
  let illustrativeDemo = false;
  for (const rawPayload of translatedPayloads) {
    if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) continue;
    const body = rawPayload as Record<string, unknown>;
    envelopeDate =
      envelopeDate
      ?? dateOnly(body.generated_at)
      ?? dateOnly(body.created_at)
      ?? dateOnly(body.checked_at);
    if (isCarstatIllustrativeDemoPayload(body)) illustrativeDemo = true;
  }

  // Decode origin up front so listing hygiene can drop EU/KR mashups on NA VINs.
  const vinEarly = meta?.vin?.trim().toUpperCase() || null;
  let decodedCountry: string | null = null;
  if (vinEarly && vinEarly.length === 17) {
    try {
      const decoded = decodeVin(vinEarly);
      if (decoded.make) make = decoded.make;
      if (year == null && typeof decoded.year === "number") year = decoded.year;
      if (decoded.country) {
        decodedCountry = decoded.country;
        country = decoded.country;
      }
    } catch {
      // ignore — VHR fields still deliver
    }
  }
  const koreanVinEarly = !!vinEarly && /^K/i.test(vinEarly);
  const naOriginEarly = isNorthAmericanCountry(decodedCountry);

  for (const rawPayload of translatedPayloads) {
    if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) continue;
    const body = rawPayload as Record<string, unknown>;

    for (const section of sectionsOf(body)) {
      const type = str(section.type)?.toLowerCase() ?? "";

      if (type === "vehicles" || type === "vehicle") {
        for (const item of itemsOf(section)) {
          const title = localizedText(item.title) ?? str(item.title);
          const parsed = parseVehicleTitle(title);
          year = year ?? num(item.year) ?? parsed.year;
          make = make ?? parsed.make;
          model = model ?? parsed.model;
          trim = trim ?? parsed.trim;
          bodyType = bodyType
            ?? titleCaseLabel(str(item.body_type_label))
            ?? mapEnum(BODY_TYPE, item.body_type ?? item.bodyType);
          fuelType = fuelType
            ?? titleCaseLabel(str(item.fuel_label))
            ?? mapEnum(FUEL, item.fuel ?? item.fuel_type ?? item.fuelType);
          transmission = transmission
            ?? titleCaseLabel(str(item.transmission_label))
            ?? mapEnum(TRANSMISSION, item.transmission);
          color = color ?? (
            str(item.color_label)
            ?? (typeof item.color === "string" ? str(item.color) : null)
          );
          hp = hp ?? num(item.hp ?? item.horsepower);
          cylinders = cylinders ?? num(item.cylinders);
          const engineSize = num(item.engine_size ?? item.engineSize);
          if (engineSize != null && !engine) engine = `${engineSize} cc`;
          country = country
            ?? str(item.country_iso)
            ?? str(item.country)
            ?? mapCarstatCountryId(item.country_id)
            ?? mapCarstatCountryId(item.manufacturer_country_id);
          pushExtra(
            vehicleExtras,
            "drive_wheel",
            "Drive",
            titleCaseLabel(str(item.drive_wheel_label)) ?? mapEnum({ 1: "FWD", 2: "RWD", 3: "AWD", 4: "4WD" }, item.drive_wheel),
          );
          pushExtra(vehicleExtras, "vehicle_type", "Vehicle type", titleCaseLabel(str(item.vehicle_type_label)));
          pushExtra(vehicleExtras, "fuel", "Fuel", fuelType);
          pushExtra(vehicleExtras, "body", "Body", bodyType);
          pushExtra(vehicleExtras, "transmission", "Transmission", transmission);
          pushExtra(vehicleExtras, "color", "Color", color ? titleCaseLabel(color) ?? color : null);
          pushExtra(vehicleExtras, "cylinders", "Cylinders", cylinders);
          pushExtra(vehicleExtras, "hp", "Horsepower", hp != null ? `${hp} hp` : null);
        }
        continue;
      }

      if (type === "listings" || type === "listing" || type === "auctions" || type === "auction") {
        for (const item of itemsOf(section)) {
          const date =
            dateOnly(item.sale_date)
            ?? dateOnly(item.auction_date)
            ?? dateOnly(item.auction_at)
            ?? dateOnly(item.sale_datetime)
            ?? dateOnly(item.first_seen)
            ?? dateOnly(item.last_seen_at)
            ?? dateOnly(item.updated_at)
            ?? dateOnly(item.created_at)
            // Copart often ships sale_date:null; use report capture day rather than "Not reported".
            ?? envelopeDate;
          const odoKm = num(item.odometer_km ?? item.odometer ?? item.mileage);
          const odoMi = num(item.odometer_mi ?? item.odometer_miles);
          // Prefer km; convert miles-only readings so history stays in km.
          const odo = odoKm ?? (odoMi != null ? Math.round(odoMi * 1.60934) : null);
          const srcData =
            item.source_data && typeof item.source_data === "object" && !Array.isArray(item.source_data)
              ? (item.source_data as Record<string, unknown>)
              : null;
          const marketplaceRaw = str(item.marketplace) ?? str(item.auction_name) ?? str(item.seller);
          // Archive Alpha EU/KR generic marketplace labels — mashup fiction, skip.
          // Keep "US auction" (price/odo/damage); strip Euro 6 / stub service separately.
          if (isPlaygroundGenericMarketplace(marketplaceRaw) || isPlaygroundGenericMarketplace(prettyMarketplace(marketplaceRaw))) {
            continue;
          }
          const listingCurrency = resolveListingCurrency(item, srcData, marketplaceRaw);
          const rawPrice = num(
            item.final_price
            ?? item.finalPrice
            ?? item.final_bid
            ?? item.price_with_tax
            ?? item.price,
          );
          const priced = rawPrice != null && rawPrice > 0
            ? sanitizeMoney(rawPrice, listingCurrency)
            : null;
          const price = priced?.value ?? null;
          const currency = priced?.currency ?? listingCurrency;
          const openingBidRaw = num(item.bid ?? item.opening_bid ?? item.openingBid);
          const openingBid = openingBidRaw != null && openingBidRaw > 0 ? openingBidRaw : null;
          const rawBuyNow = num(item.buy_now_price ?? item.buyNowPrice);
          const buyNow = rawBuyNow != null && rawBuyNow > 0
            ? sanitizeMoney(rawBuyNow, listingCurrency)
            : null;
          const buyNowPrice = buyNow?.value ?? null;
          const rawAcv = num(item.actual_cash_value ?? item.acv);
          const acvMoney = rawAcv != null && rawAcv > 0
            ? sanitizeMoney(rawAcv, listingCurrency)
            : null;
          const rawPre = num(item.pre_accident_price);
          const preMoney = rawPre != null && rawPre > 0
            ? sanitizeMoney(rawPre, listingCurrency)
            : null;
          const rawRepair = num(item.estimate_repair_price ?? item.repair_estimate);
          const repairMoney = rawRepair != null && rawRepair > 0
            ? sanitizeMoney(rawRepair, listingCurrency)
            : null;
          const priceWithoutTax = num(item.price_without_tax);
          const loc =
            item.location_details && typeof item.location_details === "object" && !Array.isArray(item.location_details)
              ? (item.location_details as Record<string, unknown>)
              : {};
          const marketplace = prettyMarketplace(marketplaceRaw) ?? "Listing";
          const listingCountry =
            str(loc.country)
            ?? str(item.seller_country)
            ?? inferListingCountry(item, marketplaceRaw, currency);
          // NA-origin VINs: keep USA/Canada sale markets only (drop Encar/EU/Asia mashups).
          if (
            naOriginEarly
            && !koreanVinEarly
            && isNonNorthAmericanSaleMarket(marketplaceRaw, listingCountry, currency)
          ) {
            continue;
          }
          // Drop playground / conflicting place mashups (Houston + Germany, "Demo region").
          const rawCity = str(loc.city) ?? str(item.city) ?? str(item.seller_location);
          const rawState = str(loc.region ?? loc.state) ?? str(item.state) ?? str(item.region);
          const place = sanitizeListingPlace(rawCity, rawState, listingCountry, marketplace);
          const city = place.city;
          const state = place.state;
          const primaryDamage = resolveAuctionDamage(item, "primary");
          const secondaryDamage = resolveAuctionDamage(item, "secondary");
          const statusLabel = titleCaseLabel(str(item.status_label));
          const conditionLabel =
            titleCaseLabel(str(item.condition_label))
            ?? (typeof item.condition === "string" ? titleCaseLabel(str(item.condition)) : null);
          const lot = str(item.lot);
          // Sale-state only — never "Copart · Sold" / "IAAI · Sold" titles (marketplace stays in source).
          const lotStatus = statusLabel;
          if (isNaSalvageAuctionMarketplace(marketplaceRaw) || isNaSalvageAuctionMarketplace(marketplace)) {
            isSalvage = true;
          }

          // Archive-beta / rich listing identity (source 3) — use every vehicle field.
          make = make ?? str(item.make);
          model = model ?? str(item.model);
          year = year ?? num(item.first_reg_year) ?? num(item.year);
          trim = trim ?? str(item.trim_line) ?? str(item.trim);
          bodyType = bodyType
            ?? titleCaseLabel(str(item.body_clean_type))
            ?? titleCaseLabel(str(item.body_type));
          fuelType = fuelType ?? titleCaseLabel(str(item.fuel_type)) ?? titleCaseLabel(str(item.fuel));
          transmission = transmission ?? titleCaseLabel(str(item.gear_box)) ?? titleCaseLabel(str(item.transmission));
          color = color ?? str(item.body_color) ?? str(item.interior_color);
          hp = hp ?? num(item.hp);
          engine = engine ?? str(item.engine_descr);
          if (!engine) {
            const engineSize = num(item.engine_size ?? item.engineSize);
            if (engineSize != null) engine = `${engineSize} cc`;
          }
          // Manufacturing origin from archive-beta — keep before sale-market country.
          country = country ?? str(item.origin_country);

          // Prefer vehicle title from listing when vehicles section was thin.
          const listingTitle = localizedText(item.vehicle_title) ?? localizedText(item.title) ?? str(item.vehicle_title) ?? str(item.title);
          if (listingTitle && !make) {
            const parsed = parseVehicleTitle(listingTitle);
            year = year ?? parsed.year;
            make = make ?? parsed.make;
            model = model ?? parsed.model;
            trim = trim ?? parsed.trim;
          }

          // Always keep the reading — Copart/demo rows often omit sale_date.
          if (odo != null) {
            mileageHistory.push({
              date,
              odometer: odo,
              unit:
                str(item.mileage_name)
                ?? str(srcData?.odometer_unit)
                ?? "km",
              source: marketplace,
              primaryDamage,
              secondaryDamage,
              auctionPrice: price,
              currency: price != null ? currency : null,
              lotStatus,
            });
          }
          if (odoMi != null && odoMi > 0) {
            pushExtra(
              vehicleExtras,
              `odo_mi_${lot ?? date ?? marketplace}`,
              "Odometer (miles)",
              `${odoMi.toLocaleString()} mi`,
              date,
            );
          }
          if (item.archived === true) {
            pushExtra(vehicleExtras, `archived_${lot ?? marketplace}`, "Listing archived", "Yes", date);
          }
          // Never surface Listing ID / auction lot numbers in extras.
          pushExtra(
            vehicleExtras,
            `first_seen_${lot ?? marketplace}`,
            "First seen",
            dateOnly(item.first_seen) ?? dateOnly(item.created_at),
            dateOnly(item.first_seen) ?? dateOnly(item.created_at),
          );
          pushExtra(
            vehicleExtras,
            `last_seen_${lot ?? marketplace}`,
            "Last seen",
            dateOnly(item.last_seen_at) ?? dateOnly(item.updated_at),
            dateOnly(item.last_seen_at) ?? dateOnly(item.updated_at),
          );
          if (item.used === true) pushExtra(vehicleExtras, `used_${marketplace}`, "Condition class", "Used", date);
          if (item.used === false) pushExtra(vehicleExtras, `used_${marketplace}`, "Condition class", "New", date);
          pushExtra(vehicleExtras, `battery_${marketplace}`, "Battery size", item.battery_size != null ? String(item.battery_size) : null);
          pushExtra(vehicleExtras, `gears_${marketplace}`, "Gears", item.numbers_gears);

          auctionHistory.push({
            date,
            city,
            state,
            country: place.country,
            condition: conditionLabel,
            damage: primaryDamage,
            primaryDamage,
            secondaryDamage,
            titleStatus: null,
            openingBid,
            buyNowPrice,
            finalPrice: price,
            lotStatus,
            currency,
          });

          // Price history → chart / averages only (never mix KRW into EUR).
          // Do not emit separate auction-timeline rows — those clutter the report.
          const histSales = salePricesFromHistory(item.price_history, currency);
          for (const sale of histSales) {
            const bucket = salePricesByCurrency.get(sale.currency) ?? [];
            bucket.push(sale.value);
            salePricesByCurrency.set(sale.currency, bucket);
          }
          if (acvMoney) {
            estimateCandidates.push({ value: acvMoney.value, currency: acvMoney.currency, rank: 10 });
            pushExtra(
              vehicleExtras,
              `acv_${lot ?? date ?? marketplace}`,
              "Actual cash value (ACV)",
              `${acvMoney.value.toLocaleString("en-US")} ${acvMoney.currency}`,
              date,
            );
          }
          if (preMoney) {
            estimateCandidates.push({ value: preMoney.value, currency: preMoney.currency, rank: 20 });
            pushExtra(
              vehicleExtras,
              `pre_accident_${lot ?? date ?? marketplace}`,
              "Pre-accident value",
              `${preMoney.value.toLocaleString("en-US")} ${preMoney.currency}`,
              date,
            );
          }
          if (repairMoney) {
            // Skip junk repair estimates that are clearly not in listing currency scale
            // (playground sometimes reuses a USD repair figure on KRW rows).
            const repairOk =
              repairMoney.currency === "KRW"
                ? repairMoney.value >= 100_000
                : repairMoney.value < 1_000_000;
            if (repairOk) {
              pushExtra(
                vehicleExtras,
                `repair_est_${lot ?? date ?? marketplace}`,
                "Estimated repair cost",
                `${repairMoney.value.toLocaleString("en-US")} ${repairMoney.currency}`,
                date,
              );
            }
          }
          if (priceWithoutTax != null && priceWithoutTax > 0 && priceWithoutTax !== price) {
            const ex = sanitizeMoney(priceWithoutTax, currency);
            pushExtra(
              vehicleExtras,
              `price_ex_tax_${lot ?? date ?? marketplace}`,
              "Price without tax",
              `${ex.value.toLocaleString("en-US")} ${ex.currency}`,
              date,
            );
          }
          if (buyNow && buyNowPrice != null) {
            estimateCandidates.push({ value: buyNow.value, currency: buyNow.currency, rank: 40 });
          }

          // Do NOT invent accident rows from every auction damage id — that makes
          // Copart/IAAI/Encar look like three separate major crashes. Real claims
          // come from korean_history / insurance sections below.

          const imgs = Array.isArray(item.images) ? item.images : [];
          for (const img of imgs) {
            let u: string | null = null;
            if (typeof img === "string") u = str(img);
            else if (img && typeof img === "object" && !Array.isArray(img)) {
              const row = img as Record<string, unknown>;
              u = str(row.url) ?? str(row.src) ?? str(row.image) ?? str(row.hd_url) ?? str(row.original_url);
            }
            if (!u) continue;
            if (!photos.includes(u)) photos.push(u);
            if (!photosHd.includes(u)) photosHd.push(u);
          }
          const mainImg = str(item.main_img) ?? str(item.thumbnail_url) ?? str(item.main_image);
          if (mainImg) {
            if (!photos.includes(mainImg)) photos.unshift(mainImg);
            if (!photosHd.includes(mainImg)) photosHd.unshift(mainImg);
          }

          if (odo != null && (odometer == null || odo > odometer)) odometer = odo;
          if (price != null && date && (!lastAuctionDate || date >= lastAuctionDate)) {
            lastAuctionPrice = price;
            lastAuctionDate = date;
            marketCurrency = currency;
          }
          // Sale-market country must not overwrite manufacturing origin.
          if (!country) country = listingCountry;

          pushExtra(vehicleExtras, `keys_${lot ?? date ?? marketplace}`, "Keys", item.keys_available != null ? item.keys_available : item.keys, date);
          pushExtra(vehicleExtras, `airbags_${lot ?? date ?? marketplace}`, "Airbags", titleCaseLabel(str(item.airbags_label)) ?? str(item.airbag_state), date);
          pushExtra(
            vehicleExtras,
            `odo_status_${lot ?? date ?? marketplace}`,
            "Odometer status",
            titleCaseLabel(str(item.odometer_status_label))
              ?? titleCaseLabel(str(item.odometer_status))
              ?? (typeof item.odometer_status === "string" ? str(item.odometer_status) : null),
            date,
          );
          pushExtra(vehicleExtras, `seller_type_${lot ?? date ?? marketplace}`, "Seller type", str(item.seller_type) ?? str(srcData?.seller && typeof srcData.seller === "object" ? (srcData.seller as Record<string, unknown>).type : null), date);
          pushExtra(vehicleExtras, `days_to_sell_${lot ?? date ?? marketplace}`, "Days to sell", item.days_to_sell, date);
          {
            const emissionStandard =
              str(item.emission_standard)
              ?? (srcData?.emissions && typeof srcData.emissions === "object"
                ? str((srcData.emissions as Record<string, unknown>).standard)
                : null);
            const co2Raw =
              item.co2
              ?? (srcData?.emissions && typeof srcData.emissions === "object"
                ? (srcData.emissions as Record<string, unknown>).co2_g_km
                : null);
            // Euro N / g/km CO₂ only belong on European-market listings — never on Copart/IAAI/US stubs.
            const europeanMarket = isEuropeanListingMarket(marketplace, place.country);
            if (emissionStandard && (!isEuroEmissionValue(emissionStandard) || europeanMarket)) {
              pushExtra(
                vehicleExtras,
                `emission_${lot ?? date ?? marketplace}`,
                "Emission standard",
                emissionStandard,
                date,
              );
            }
            if (co2Raw != null && europeanMarket) {
              pushExtra(vehicleExtras, `co2_${marketplace}`, "CO₂", `${co2Raw} g/km`);
            }
          }
          pushExtra(vehicleExtras, `seats_${marketplace}`, "Seats", item.seats);
          pushExtra(vehicleExtras, `doors_${marketplace}`, "Doors", item.numbers_doors);
          pushExtra(vehicleExtras, `drive_${marketplace}`, "Drive", item.four_wheel === true ? "AWD/4WD" : str(item.driving));
          pushExtra(vehicleExtras, `interior_${marketplace}`, "Interior color", str(item.interior_color));
          pushExtra(vehicleExtras, `extra_wheels_${marketplace}`, "Extra wheels", item.extra_wheels_set);
          pushExtra(vehicleExtras, `weight_${marketplace}`, "Curb weight", item.weight != null ? `${item.weight} kg` : null);
          if (item.length != null || item.width != null || item.height != null) {
            pushExtra(
              vehicleExtras,
              `dims_${marketplace}`,
              "Dimensions (L×W×H)",
              [item.length, item.width, item.height].filter((x) => x != null).join(" × ") + " mm",
            );
          }
          if (item.damaged === true && (primaryDamage || secondaryDamage)) {
            pushExtra(
              vehicleExtras,
              `listing_damage_${lot ?? date ?? marketplace}`,
              "Listing damage note",
              [primaryDamage, secondaryDamage].filter(Boolean).join(" · "),
              date,
            );
          }

          if (srcData) {
            const equip =
              srcData.equipment && typeof srcData.equipment === "object" && !Array.isArray(srcData.equipment)
                ? (srcData.equipment as Record<string, unknown>)
                : null;
            if (equip) {
              for (const [group, vals] of Object.entries(equip)) {
                if (!Array.isArray(vals)) continue;
                const joined = vals.map((v) => str(v)).filter(Boolean).join(", ");
                if (!joined) continue;
                pushExtra(vehicleExtras, `equip_${group}`, titleCaseLabel(group) ?? group, joined, date);
              }
            }
            const warranty =
              srcData.warranty && typeof srcData.warranty === "object" && !Array.isArray(srcData.warranty)
                ? (srcData.warranty as Record<string, unknown>)
                : null;
            if (warranty?.available) {
              pushExtra(vehicleExtras, "warranty", "Warranty", warranty.months != null ? `${warranty.months} months` : "Yes", date);
            }
            pushExtra(vehicleExtras, `listing_desc_${lot ?? date ?? marketplace}`, "Listing notes", str(srcData.description), date);

            const svc =
              srcData.service_history && typeof srcData.service_history === "object"
                ? (srcData.service_history as Record<string, unknown>)
                : null;
            // Auction/classifieds recycle a stub service_history — that is NOT workshop history,
            // and marketplace must never become the service "location" (European Marketplace bug).
            if (
              svc
              && !isAuctionOrClassifiedMarketplace(marketplace)
              && !isAuctionOrClassifiedMarketplace(marketplaceRaw)
            ) {
              const svcDate = dateOnly(svc.last_service_at);
              const svcOdo = num(svc.last_service_odometer_km);
              const svcLocation =
                str(svc.location)
                ?? str(svc.shop)
                ?? str(svc.dealer)
                ?? city;
              if (svcDate) {
                serviceHistory.push({
                  date: svcDate,
                  mileage: svcOdo,
                  title: "Service record",
                  description: svc.records_count != null ? `${svc.records_count} recorded visits` : "Service record",
                  location: svcLocation && !isAuctionOrClassifiedMarketplace(svcLocation) ? svcLocation : null,
                });
              }
            }
          }

          // Nested Korean history on Encar-style listings (playground + live).
          const kh =
            item.korean_history && typeof item.korean_history === "object" && !Array.isArray(item.korean_history)
              ? (item.korean_history as Record<string, unknown>)
              : null;
          const listingIsKoreanMarket =
            /encar/i.test(`${marketplace} ${marketplaceRaw ?? ""}`)
            || /korea|\bKR\b/i.test(String(place.country ?? ""))
            || currency === "KRW";
          const reportVin = meta?.vin?.trim().toUpperCase() || null;
          const reportIsKoreanVin = !!reportVin && /^K/i.test(reportVin);
          // Full KR domestic dossier / inspection mileage / insurance — Korean VINs only.
          // NA-origin cars must not inherit Encar nested KR inspection stubs.
          const allowFullKoreanListingDossier = reportIsKoreanVin;
          if (kh && listingIsKoreanMarket) {
            const inspect =
              kh.inspect && typeof kh.inspect === "object" && !Array.isArray(kh.inspect)
                ? (kh.inspect as Record<string, unknown>)
                : null;
            const inspectOuter =
              kh.inspect_outer && typeof kh.inspect_outer === "object" && !Array.isArray(kh.inspect_outer)
                ? (kh.inspect_outer as Record<string, unknown>)
                : null;
            const insurance =
              kh.insurance && typeof kh.insurance === "object" && !Array.isArray(kh.insurance)
                ? (kh.insurance as Record<string, unknown>)
                : null;

            const inspDate =
              dateOnly(inspectOuter?.inspection_date)
              ?? dateOnly(inspect?.inspection_date)
              ?? date;
            const inspOdo = num(inspectOuter?.odometer_km)
              ?? num((inspect?.vehicle as Record<string, unknown> | undefined)?.mileage_km);
            if (allowFullKoreanListingDossier && inspDate && inspOdo != null) {
              mileageHistory.push({
                date: inspDate,
                odometer: inspOdo,
                unit: "km",
                source: "Korean inspection",
              });
              if (odometer == null || inspOdo > odometer) odometer = inspOdo;
            }

            // KR insurance claims + domestic dossier only for Korean VINs.
            // US Copart/IAAI cars must not grow a "Korea insurance summary" from Encar stubs.
            if (allowFullKoreanListingDossier) {
              const claims = Array.isArray(insurance?.accidents) ? insurance.accidents : [];
              for (const claim of claims) {
                if (!claim || typeof claim !== "object" || Array.isArray(claim)) continue;
                const c = claim as Record<string, unknown>;
                const claimDate = dateOnly(c.date);
                const claimCurrency = str(c.currency) ?? "KRW";
                const own = num(c.own_damage);
                const third = num(c.third_party_damage);
                const amount = own ?? third;
                insuranceClaims.push({
                  date: claimDate,
                  type: "Insurance claim",
                  lossAmount: amount,
                  description: [
                    own != null ? `Own damage ${own.toLocaleString("en-US")} ${claimCurrency}` : null,
                    third != null ? `Third party ${third.toLocaleString("en-US")} ${claimCurrency}` : null,
                  ].filter(Boolean).join(" · ") || null,
                });
                accidents.push({
                  date: claimDate,
                  description: "Korean insurance accident",
                  type: "insurance",
                  lossAmount: amount,
                  currency: claimCurrency,
                  country: "KR",
                });
              }
            }

            if (allowFullKoreanListingDossier) {
              const overall = titleCaseLabel(str(inspect?.overall_result));
              pushExtra(vehicleExtras, "korean_inspection_result", "Korean inspection", overall, inspDate);

              const panels = Array.isArray(inspect?.body_panels) ? inspect.body_panels : [];
              for (const panel of panels) {
                if (!panel || typeof panel !== "object" || Array.isArray(panel)) continue;
                const p = panel as Record<string, unknown>;
                const part = titleCaseLabel(str(p.part));
                const action = titleCaseLabel(str(p.action));
                if (!part) continue;
                pushExtra(vehicleExtras, `kr_panel_${str(p.part) ?? part}`, part, action ?? "Noted", inspDate);
                if (action && /replac|repair|repaint|accident/i.test(action)) {
                  accidents.push({
                    date: inspDate,
                    description: simplifyInspectionAccidentDescription(part, action),
                    type: "inspection",
                    primaryDamage: part,
                    country: "KR",
                  });
                }
              }

              const options =
                kh.options && typeof kh.options === "object" && !Array.isArray(kh.options)
                  ? (kh.options as Record<string, unknown>)
                  : null;
              if (options) {
                for (const [group, vals] of Object.entries(options)) {
                  if (!Array.isArray(vals)) continue;
                  const joined = vals.map((v) => str(v)).filter(Boolean).join(", ");
                  if (!joined) continue;
                  pushExtra(vehicleExtras, `kr_options_${group}`, titleCaseLabel(group) ?? group, joined);
                }
              }
            }
          }
        }
        continue;
      }

      if (type === "equipment" || type === "options") {
        for (const item of itemsOf(section)) {
          const options = Array.isArray(item.options) ? item.options : [];
          for (const opt of options) {
            if (!opt || typeof opt !== "object" || Array.isArray(opt)) continue;
            const o = opt as Record<string, unknown>;
            const label = localizedText(o.name_translations) ?? str(o.name) ?? `Option ${o.id ?? ""}`;
            const value = localizedText(o.description_translations) ?? "Equipped";
            if (!label) continue;
            vehicleExtras.push({
              key: str(o.id) ?? label,
              label,
              value,
              observedAt: null,
            });
          }
        }
        continue;
      }

      if (type === "accidents" || type === "damages" || type === "insurance" || type === "claims") {
        for (const item of itemsOf(section)) {
          const date = dateOnly(item.date ?? item.event_date ?? item.occurred_at ?? item.created_at);
          const amount = num(
            item.amount
            ?? item.loss_amount
            ?? item.cost
            ?? item.vehicle_damage_claim_cost
            ?? item.claim_cost,
          );
          if (type === "insurance" || type === "claims") {
            insuranceClaims.push({
              date,
              type: str(item.type) ?? str(item.type_key) ?? localizedText(item.title) ?? "Claim",
              lossAmount: amount,
              description: localizedText(item.description) ?? localizedText(item.title) ?? str(item.source_label),
            });
          } else {
            accidents.push({
              date,
              description: localizedText(item.description) ?? localizedText(item.title),
              type: str(item.type) ?? str(item.type_key) ?? type,
              primaryDamage: localizedText(item.damage) ?? str(item.damage),
              odometerAtLoss: num(item.odometer ?? item.mileage),
              lossAmount: amount,
              currency: str(item.currency) ?? "USD",
            });
          }
        }
        continue;
      }

      if (type === "inspections" || type === "inspection") {
        for (const item of itemsOf(section)) {
          const inspDate = dateOnly(item.inspected_at ?? item.created_at);
          const snap =
            item.vehicle_snapshot && typeof item.vehicle_snapshot === "object" && !Array.isArray(item.vehicle_snapshot)
              ? (item.vehicle_snapshot as Record<string, unknown>)
              : null;
          if (snap) {
            make = make ?? str(snap.make) ?? str(snap.brand);
            model = model ?? str(snap.model);
            year = year ?? num(snap.year);
            bodyType = bodyType ?? str(snap.body_type);
            fuelType = fuelType ?? titleCaseLabel(str(snap.fuel)) ?? str(snap.fuel_type);
            transmission = transmission ?? titleCaseLabel(str(snap.transmission));
            color = color ?? str(snap.color);
            hp = hp ?? num(snap.hp);
            const engineSize = num(snap.engine_size);
            if (engineSize != null && !engine) engine = `${engineSize} cc`;
            const odoObj =
              snap.odometer && typeof snap.odometer === "object" && !Array.isArray(snap.odometer)
                ? (snap.odometer as Record<string, unknown>)
                : null;
            const snapOdo = num(odoObj?.value ?? snap.odometer ?? snap.mileage_km ?? snap.mileage);
            if (snapOdo != null) {
              if (odometer == null || snapOdo > odometer) odometer = snapOdo;
              if (inspDate) {
                mileageHistory.push({
                  date: inspDate,
                  odometer: snapOdo,
                  unit: str(odoObj?.unit) ?? "km",
                  source: "inspection",
                });
              }
            }
            const firstReg = dateOnly(snap.first_registered_at);
            if (firstReg) {
              pushExtra(vehicleExtras, "first_registration", "First registration", firstReg, firstReg);
              registryHistory.push({
                date: firstReg,
                type: "first_registration",
                title: "First registration",
                subtitle: null,
              });
            }
            // Title-only snapshots (e.g. "G70") are model codes — don't invent a make.
            // WMI may already have set make; still accept the title as model.
            const title = str(snap.title);
            if (title) {
              const parsed = parseVehicleTitle(title);
              if (parsed.year != null) year = year ?? parsed.year;
              if (parsed.make && parsed.model) {
                make = make ?? parsed.make;
                model = model ?? parsed.model;
                trim = trim ?? parsed.trim;
              } else if (!model) {
                model = title;
              }
            }
          }

          const media = Array.isArray(item.media) ? item.media : [];
          for (const m of media) {
            if (typeof m === "string") {
              const u = str(m);
              if (u && !photos.includes(u)) photos.push(u);
              if (u && !photosHd.includes(u)) photosHd.push(u);
              continue;
            }
            if (!m || typeof m !== "object" || Array.isArray(m)) continue;
            const row = m as Record<string, unknown>;
            const u =
              str(row.image)
              ?? str(row.url)
              ?? str(row.src)
              ?? str(row.thumbnail_url)
              ?? str(row.original_url)
              ?? str(row.hd_url);
            if (!u) continue;
            if (!photos.includes(u)) photos.push(u);
            if (!photosHd.includes(u)) photosHd.push(u);
            const hd = str(row.hd_url) ?? str(row.original_url);
            if (hd && !photosHd.includes(hd)) photosHd.push(hd);
          }

          // Source claims: only actionable findings (never “없음” / ok).
          const claims = Array.isArray(item.source_claims) ? item.source_claims : [];
          for (const c of claims) {
            if (!c || typeof c !== "object" || Array.isArray(c)) continue;
            const claim = c as Record<string, unknown>;
            const label = str(claim.source_label) ?? titleCaseLabel(str(claim.type_key)) ?? "Inspection claim";
            const desc = str(claim.description);
            if (!isActionableClaim(claim)) {
              pushExtra(
                vehicleExtras,
                str(claim.id) ?? `claim_clear_${label}`,
                label,
                isAbsentFinding(desc) ? "None recorded" : (str(claim.result_key) ?? "Clear"),
                inspDate,
              );
              continue;
            }
            accidents.push({
              date: inspDate,
              description: simplifyInspectionAccidentDescription(
                label,
                desc && !isPresentFinding(desc) ? desc : null,
              ),
              type: str(claim.type_key) ?? "inspection",
              primaryDamage: label,
              country: country ?? "KR",
            });
            registryHistory.push({
              date: inspDate,
              type: str(claim.type_key) ?? "inspection",
              title: label,
              subtitle: desc && !isPresentFinding(desc) ? desc : "Recorded finding",
            });
          }

          const checked = Array.isArray(item.checked_items) ? item.checked_items : [];
          let issueCount = 0;
          let okCount = 0;
          for (const c of checked) {
            if (!c || typeof c !== "object" || Array.isArray(c)) continue;
            const row = c as Record<string, unknown>;
            const result = str(row.result_key)?.toLowerCase();
            const label = str(row.part_label) ?? str(row.source_label) ?? str(row.part_key) ?? "Inspection item";
            const measurements = Array.isArray(row.measurements) ? row.measurements : [];
            for (const m of measurements) {
              if (!m || typeof m !== "object" || Array.isArray(m)) continue;
              const mm = m as Record<string, unknown>;
              const val = num(mm.value_number ?? mm.value);
              if (val == null) continue;
              const unit = str(mm.unit_key) ?? str(mm.unit) ?? "";
              const mLabel =
                str(mm.type_key)
                ?? str(mm.id)
                ?? label;
              pushExtra(
                vehicleExtras,
                str(mm.id) ?? `meas_${mLabel}`,
                titleCaseLabel(mLabel) ?? mLabel,
                unit ? `${val} ${unit}` : String(val),
                inspDate,
              );
              if (/odometer/i.test(str(mm.type_key) ?? "") || /odometer/i.test(str(mm.id) ?? "")) {
                if (odometer == null || val > odometer) odometer = val;
                if (inspDate) {
                  mileageHistory.push({
                    date: inspDate,
                    odometer: val,
                    unit: unit === "km" || unit === "mi" ? unit : "km",
                    source: "Korean inspection",
                  });
                }
              }
            }
            const marker = str(row.visual_marker_label);
            if (marker) {
              pushExtra(vehicleExtras, `marker_${str(row.id) ?? label}`, `${label} marker`, marker, inspDate);
            }
            if (result === "ok" || result === "pass") {
              okCount += 1;
              continue;
            }
            if (result !== "issue" && result !== "fail") continue;
            issueCount += 1;
            const desc = str(row.description) ?? result ?? "issue";
            const issueTypes = Array.isArray(row.issue_type_keys)
              ? row.issue_type_keys.map((x) => str(x)).filter(Boolean)
              : [];
            pushExtra(vehicleExtras, str(row.id) ?? str(row.part_key) ?? label, label, desc, inspDate);

            if (issueTypes.some((t) => /recall/i.test(t ?? "")) || /recall/i.test(label)) {
              recallHistory.push({
                date: inspDate,
                type: "recall",
                title: label,
                subtitle: desc,
              });
              continue;
            }

            const looksAccident =
              issueTypes.some((t) => /accident|repair|weld|replace|paint/i.test(t ?? ""))
              || /accident|repair|weld|replac/i.test(desc)
              || str(row.accident_relevance_key) != null;
            if (looksAccident) {
              accidents.push({
                date: inspDate,
                description: simplifyInspectionAccidentDescription(label, desc),
                type: "inspection",
                primaryDamage: label,
                severity: str(row.accident_relevance_key),
                country: country ?? "KR",
              });
            }
          }

          const blocks = Array.isArray(item.inspection_blocks) ? item.inspection_blocks : [];
          for (const b of blocks) {
            if (!b || typeof b !== "object" || Array.isArray(b)) continue;
            const block = b as Record<string, unknown>;
            const blockKey = str(block.key) ?? str(block.id) ?? "block";
            pushExtra(
              vehicleExtras,
              `insp_block_${blockKey}`,
              titleCaseLabel(blockKey) ?? blockKey,
              titleCaseLabel(str(block.result_key)) ?? str(block.result_key),
              inspDate,
            );
          }

          const conclusions =
            item.conclusions && typeof item.conclusions === "object" && !Array.isArray(item.conclusions)
              ? (item.conclusions as Record<string, unknown>)
              : null;
          if (conclusions) {
            const score = str(conclusions.evaluation_score);
            const notesRaw = str(conclusions.notes);
            const notes = notesRaw ? translateKoToEn(translateRuToEn(notesRaw)) : null;
            const overall = titleCaseLabel(str(conclusions.overall_result_key));
            const accidentStatus = titleCaseLabel(str(conclusions.accident_status_key));
            pushExtra(vehicleExtras, "inspection_summary", "Inspection summary", [score, notes, overall].filter(Boolean).join(" — ") || null, inspDate);
            pushExtra(vehicleExtras, "inspection_accident_status", "Inspection accident status", accidentStatus, inspDate);
          }

          if (inspDate && (issueCount > 0 || okCount > 0)) {
            serviceHistory.push({
              date: inspDate,
              mileage: odometer,
              title: "Vehicle inspection",
              description: `${okCount} passed · ${issueCount} issue${issueCount === 1 ? "" : "s"}`,
              details: detailsFromPairs([
                { label: "Passed checks", value: String(okCount) },
                { label: "Issues", value: String(issueCount) },
              ]),
            });
          }
        }
        continue;
      }

      if (type === "korean_insurance") {
        sawKoreanInsurance = true;
        for (const item of itemsOf(section)) {
          const koreaSection = str(item.korea_section)?.toLowerCase() ?? "";
          const data =
            item.data && typeof item.data === "object" && !Array.isArray(item.data)
              ? (item.data as Record<string, unknown>)
              : item;

          if (koreaSection === "car_info") {
            const krMake = str(data.brand) ?? str(data.make);
            const krModel = str(data.model);
            const krTrim = str(data.trim);
            const krEngine = str(data.engine);
            const krFuel = str(data.fuel);
            const krBody = str(data.body) ?? str(data.type);
            const krYear = num(data.year);
            krIdentity = {
              make: krMake,
              model: krModel,
              year: krYear,
              trim: krTrim,
              engine: krEngine,
              fuelType: krFuel,
              bodyType: krBody,
            };
            const reportVinEarly = meta?.vin?.trim().toUpperCase() || null;
            const applyKrIdentity =
              !reportVinEarly
              || /^K/i.test(reportVinEarly);
            // Never stamp KR identity/country onto US/EU WMI cars if source 68 attaches by mistake.
            if (applyKrIdentity) {
              make = krMake ?? make;
              model = krModel ?? model;
              trim = krTrim ?? trim;
              engine = krEngine ?? engine;
              fuelType = krFuel ?? fuelType;
              bodyType = krBody ?? bodyType;
              if (krYear != null) year = krYear;
              country = "KR";
            }
            pushExtra(vehicleExtras, "kr_trim_options", "Trim options", str(data.trim_options));
            const firstDate = dateOnly(data.first_date);
            if (firstDate) {
              vehicleExtras.push({
                key: "first_registration",
                label: "First registration",
                value: firstDate,
                observedAt: firstDate,
              });
            }
            continue;
          }

          if (koreaSection === "specifications") {
            for (const [k, v] of Object.entries(data)) {
              if (v === "0" || v === 0 || v === false || v == null || v === "") continue;
              const label = titleCaseLabel(k.replace(/_/g, " "));
              if (!label) continue;
              vehicleExtras.push({
                key: `kr_spec_${k}`,
                label,
                value: v === "1" || v === 1 || v === true ? "Yes" : String(v),
                observedAt: null,
              });
            }
            continue;
          }

          if (koreaSection === "usage_history") {
            for (const [k, v] of Object.entries(data)) {
              const yes = v === true || v === "1" || v === 1 || v === "Y" || v === "yes";
              const no = v === false || v === "0" || v === 0 || v === "N" || v === "no";
              pushExtra(
                vehicleExtras,
                `kr_usage_${k}`,
                titleCaseLabel(k) ?? k,
                yes ? "Yes" : no ? "No" : String(v),
              );
              if (/^rent$|taxi|rental/i.test(k) && yes) isTaxi = true;
              if (/^rent$|taxi|rental/i.test(k) && no && isTaxi == null) isTaxi = false;
            }
            continue;
          }

          if (koreaSection === "ownership") {
            const oc = num(data.owner_count);
            if (oc != null) ownerCount = ownerCount ?? oc;
            const meaningfulKrField = (v: unknown): string | null => {
              const s = str(v);
              if (!s) return null;
              // Provider often sends "-" placeholders for empty plate/usage.
              if (/^[-–—·.\s]+$/.test(s)) return null;
              return s;
            };
            const registrySeen = new Set(
              registryHistory
                .map((e) => `${e.date ?? ""}|${(e.title ?? "").trim().toLowerCase()}`)
                .filter((k) => !k.endsWith("|")),
            );
            const pushRegistryOnce = (entry: {
              date: string | null;
              type: string;
              title: string;
              subtitle: string | null;
            }) => {
              const key = `${entry.date ?? ""}|${entry.title.trim().toLowerCase()}`;
              if (registrySeen.has(key)) return;
              registrySeen.add(key);
              registryHistory.push(entry);
            };
            const changes = Array.isArray(data.owner_changes) ? data.owner_changes : [];
            for (const ch of changes) {
              if (!ch || typeof ch !== "object" || Array.isArray(ch)) continue;
              const row = ch as Record<string, unknown>;
              const d = dateOnly(row.date);
              const typ = str(row.type) ?? str(row.usage);
              ownerHistory.push({
                date: d,
                condition: typ,
                lotStatus: meaningfulKrField(row.number),
              });
              // Undated ownership rows are not timeline events — keep ownerHistory only.
              if (!d) continue;
              pushRegistryOnce({
                date: d,
                type: "ownership",
                title: typ ?? "Ownership change",
                subtitle: meaningfulKrField(row.number) ?? meaningfulKrField(row.usage),
              });
            }
            const numberChanges = Array.isArray(data.number_changes) ? data.number_changes : [];
            for (const ch of numberChanges) {
              if (!ch || typeof ch !== "object" || Array.isArray(ch)) continue;
              const row = ch as Record<string, unknown>;
              const d = dateOnly(row.date);
              const typ = str(row.type) ?? "Plate / registration change";
              const number = meaningfulKrField(row.number);
              const usage = meaningfulKrField(row.usage);
              if (number || usage) {
                pushExtra(vehicleExtras, `kr_number_${d ?? typ}`, typ, number ?? usage, d);
              }
              // Same day+title often appears in both owner_changes and number_changes.
              if (!d) continue;
              pushRegistryOnce({
                date: d,
                type: "registration",
                title: typ,
                subtitle: [number, usage].filter(Boolean).join(" · ") || null,
              });
            }
            if (!country) country = "KR";
            continue;
          }

          if (koreaSection === "special_conditions") {
            const flood =
              data.flood && typeof data.flood === "object" && !Array.isArray(data.flood)
                ? (data.flood as Record<string, unknown>)
                : null;
            const theft =
              data.theft && typeof data.theft === "object" && !Array.isArray(data.theft)
                ? (data.theft as Record<string, unknown>)
                : null;
            const totalLoss =
              data.total_loss && typeof data.total_loss === "object" && !Array.isArray(data.total_loss)
                ? (data.total_loss as Record<string, unknown>)
                : null;
            const floodCount = num(flood?.count) ?? 0;
            const theftCount = num(theft?.count) ?? 0;
            const lossCount = num(totalLoss?.count) ?? 0;
            if (flood) isFlooded = floodCount > 0;
            if (theft) isStolen = theftCount > 0;
            // Don't clear Copart/IAAI salvage when Korea reports zero total-loss events.
            if (totalLoss) {
              if (lossCount > 0) isSalvage = true;
              else if (isSalvage == null) isSalvage = false;
            }
            const floodDate = dateOnly(flood?.date);
            const theftDate = dateOnly(theft?.date);
            const lossDate = dateOnly(totalLoss?.date);
            // Only surface positive safety hits — clear checks stay silent (flags already set).
            if (lossCount > 0) {
              pushExtra(vehicleExtras, "kr_total_loss", "Total loss", "Yes", lossDate);
              registryHistory.push({
                date: lossDate,
                type: "total_loss",
                title: "Total loss",
                subtitle: lossCount > 1 ? `${lossCount} records` : "Recorded",
              });
              accidents.push({
                date: lossDate,
                description: "Total loss recorded in Korean insurance history",
                type: "total_loss",
                country: "KR",
              });
            }
            if (theftCount > 0) {
              pushExtra(vehicleExtras, "kr_theft", "Theft", "Yes", theftDate);
              registryHistory.push({
                date: theftDate,
                type: "theft",
                title: "Theft",
                subtitle: theftCount > 1 ? `${theftCount} records` : "Recorded",
              });
            }
            if (floodCount > 0) {
              pushExtra(vehicleExtras, "kr_flood", "Flood", "Yes", floodDate);
              registryHistory.push({
                date: floodDate,
                type: "flood",
                title: "Flood damage",
                subtitle: floodCount > 1 ? `${floodCount} records` : "Recorded",
              });
              accidents.push({
                date: floodDate,
                description: "Flood / water damage recorded in Korean insurance history",
                type: "flood",
                country: "KR",
              });
            }
            continue;
          }

          if (koreaSection === "accidents_detail") {
            const items = Array.isArray(data.items) ? data.items : [];
            for (const claim of items) {
              if (!claim || typeof claim !== "object" || Array.isArray(claim)) continue;
              const c = claim as Record<string, unknown>;
              const claimDate = dateOnly(c.date);
              const cols = ["left", "center", "right"] as const;
              let paidSum = 0;
              let paidCount = 0;
              let parts = 0;
              let labor = 0;
              let paint = 0;
              const typedEntries: Array<{ type: string; paid: number; parts: number; labor: number; paint: number }> = [];
              for (const col of cols) {
                const list = Array.isArray(c[col]) ? c[col] : [];
                for (const entry of list) {
                  if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
                  const e = entry as Record<string, unknown>;
                  const paid = num(e.paid) ?? num(e.estimate);
                  const p = num(e.parts) ?? 0;
                  const l = num(e.labor) ?? 0;
                  const pt = num(e.paint) ?? 0;
                  parts += p;
                  labor += l;
                  paint += pt;
                  if (paid != null && paid > 0) {
                    paidSum += paid;
                    paidCount += 1;
                    typedEntries.push({
                      type: mapKoreanClaimType(e.type),
                      paid,
                      parts: p,
                      labor: l,
                      paint: pt,
                    });
                  }
                }
              }
              const paid = paidCount > 0 ? paidSum : null;
              const partItems = Array.isArray(c.parts_description)
                ? c.parts_description.map((x) => str(x)).filter(Boolean)
                : [];
              // Money summary for timelines — full part lists live in Korea repair parts / damage map.
              const moneyDesc =
                [
                  paid != null ? `Paid ${paid.toLocaleString()} KRW` : null,
                  parts ? `Parts ${parts.toLocaleString()} KRW` : null,
                  labor ? `Labor ${labor.toLocaleString()} KRW` : null,
                  paint ? `Paint ${paint.toLocaleString()} KRW` : null,
                ].filter(Boolean).join(" · ") || null;
              const partsCountDesc = partItems.length
                ? `${partItems.length} repaired part${partItems.length === 1 ? "" : "s"}`
                : null;
              const claimDesc = moneyDesc ?? partsCountDesc;

              if (typedEntries.length > 1) {
                for (const te of typedEntries) {
                  insuranceClaims.push({
                    date: claimDate,
                    type: te.type,
                    lossAmount: te.paid,
                    partCost: te.parts || null,
                    laborCost: te.labor || null,
                    paintingCost: te.paint || null,
                    description: claimDesc,
                  });
                }
              } else {
                insuranceClaims.push({
                  date: claimDate,
                  type: typedEntries[0]?.type ?? "Insurance claim",
                  lossAmount: paid,
                  partCost: parts || null,
                  laborCost: labor || null,
                  paintingCost: paint || null,
                  description: claimDesc,
                });
              }
              accidents.push({
                date: claimDate,
                // Money summary only — part name lists belong in Korea repair parts.
                description: moneyDesc ?? partsCountDesc ?? "Korean insurance accident",
                type: "insurance",
                lossAmount: paid,
                partCost: parts || null,
                laborCost: labor || null,
                paintingCost: paint || null,
                currency: "KRW",
                country: "KR",
              });
              registryHistory.push({
                date: claimDate,
                type: "insurance",
                title: "Insurance accident",
                subtitle: claimDesc,
                amount: paid != null ? `${paid.toLocaleString()} KRW` : null,
              });
            }

            const totals =
              data.totals && typeof data.totals === "object" && !Array.isArray(data.totals)
                ? (data.totals as Record<string, unknown>)
                : null;
            if (totals) {
              pushExtra(vehicleExtras, "kr_total_own_damage", "Total own damage", num(totals.my_damage) != null ? `${num(totals.my_damage)!.toLocaleString()} KRW` : null);
              pushExtra(vehicleExtras, "kr_total_other_damage", "Total other-party damage", num(totals.other_damage) != null ? `${num(totals.other_damage)!.toLocaleString()} KRW` : null);
            }

            const aggregate =
              data.aggregate && typeof data.aggregate === "object" && !Array.isArray(data.aggregate)
                ? (data.aggregate as Record<string, unknown>)
                : null;
            if (aggregate) {
              const cats =
                aggregate.parts_categories && typeof aggregate.parts_categories === "object" && !Array.isArray(aggregate.parts_categories)
                  ? (aggregate.parts_categories as Record<string, unknown>)
                  : null;
              if (cats) {
                for (const [cat, vals] of Object.entries(cats)) {
                  if (!Array.isArray(vals) || !vals.length) continue;
                  const joined = vals.map((v) => str(v)).filter(Boolean).slice(0, 12).join("; ");
                  if (!joined) continue;
                  pushExtra(vehicleExtras, `kr_parts_${cat}`, `Repair parts · ${titleCaseLabel(cat) ?? cat}`, joined);
                }
              }
              const allParts = Array.isArray(aggregate.parts_description)
                ? aggregate.parts_description.map((x) => str(x)).filter(Boolean)
                : [];
              if (allParts.length) {
                pushExtra(
                  vehicleExtras,
                  "kr_parts_all",
                  "All repaired parts",
                  allParts.slice(0, 20).join("; ") + (allParts.length > 20 ? ` (+${allParts.length - 20} more)` : ""),
                );
              }
            }

            if (data.has_uninsured_period === true || data.has_uninsured_period === "true") {
              const period = str(data.uninsured_period_text) ?? "Yes";
              pushExtra(vehicleExtras, "kr_uninsured_period", "Uninsured period", period);
              // Prefer the period string as date so newest-first sort uses the range end
              // (e.g. 2025-12~2026-06 sorts above 2021 first registration).
              const periodDate = /^\d{4}-\d{2}/.test(period.trim()) ? period.trim() : null;
              registryHistory.push({
                date: periodDate,
                type: "no_insurance",
                title: "Uninsured period",
                subtitle: periodDate ? null : period,
              });
            }
            pushExtra(vehicleExtras, "kr_car_number", "Insurance plate", str(data.car_number));

            if (!country) country = "KR";
            marketCurrency = "KRW";
            continue;
          }

          if (koreaSection === "mileage") {
            const list = Array.isArray(data.list) ? data.list : [];
            for (const row of list) {
              if (!row || typeof row !== "object" || Array.isArray(row)) continue;
              const r = row as Record<string, unknown>;
              const mDate = dateOnly(r.date) ?? dateOnly(String(r.date_view ?? "").replace(/\//g, "-"));
              const mOdo = parseKmish(r.km ?? r.odometer ?? r.mileage);
              if (mDate && mOdo != null) {
                mileageHistory.push({
                  date: mDate,
                  odometer: mOdo,
                  unit: "km",
                  source: str(r.source) ?? "Korean insurance",
                });
                if (odometer == null || mOdo > odometer) odometer = mOdo;
              }
            }
            const last =
              data.last && typeof data.last === "object" && !Array.isArray(data.last)
                ? (data.last as Record<string, unknown>)
                : null;
            if (last) {
              const mDate = dateOnly(last.date);
              const mOdo = parseKmish(last.km);
              if (mDate && mOdo != null) {
                mileageHistory.push({
                  date: mDate,
                  odometer: mOdo,
                  unit: "km",
                  source: str(last.source) ?? "Korean insurance",
                });
                if (odometer == null || mOdo > odometer) odometer = mOdo;
              }
            }
            continue;
          }

          if (koreaSection === "price") {
            const rawPrice =
              typeof item.data === "string" || typeof item.data === "number"
                ? item.data
                : (data.range ?? data.price ?? data.value ?? data.display ?? null);
            const effective = parseKoreanPriceRange(rawPrice);
            if (effective) {
              estimateCandidates.push({ value: effective.avg, currency: "KRW", rank: 25 });
              marketCurrency = "KRW";
              pushExtra(
                vehicleExtras,
                "kr_market_price",
                "Korean market price",
                `${effective.display} (avg ${effective.avg.toLocaleString()} KRW)`,
              );
              pushExtra(vehicleExtras, "kr_market_price_low", "Market low", `${effective.low.toLocaleString()} KRW`);
              pushExtra(vehicleExtras, "kr_market_price_high", "Market high", `${effective.high.toLocaleString()} KRW`);
            } else if (typeof rawPrice === "string" && rawPrice.trim()) {
              pushExtra(vehicleExtras, "kr_market_price", "Korean market price", rawPrice);
            }
            continue;
          }

          if (koreaSection === "recall_campaigns") {
            const status = str(data.status) ?? str(item.status);
            const recallData = data.data ?? data.campaigns ?? data.items;
            if (Array.isArray(recallData)) {
              for (const row of recallData) {
                if (!row || typeof row !== "object" || Array.isArray(row)) continue;
                const r = row as Record<string, unknown>;
                recallHistory.push({
                  date: dateOnly(r.date ?? r.recall_date ?? r.announced_at),
                  type: "recall",
                  title: str(r.title) ?? str(r.name) ?? "Recall campaign",
                  subtitle: str(r.description) ?? str(r.detail) ?? status,
                  mileage: parseKmish(r.mileage ?? r.km),
                });
              }
            } else {
              pushExtra(
                vehicleExtras,
                "kr_recalls",
                "Recall campaigns",
                status === "done" && (recallData == null) ? "None recorded" : (status ?? "Unknown"),
              );
            }
            continue;
          }

          if (koreaSection === "export_declaration") {
            const exportData =
              data.data && typeof data.data === "object" && !Array.isArray(data.data)
                ? (data.data as Record<string, unknown>)
                : data;
            model = model ?? str(exportData.model_name);
            fuelType = fuelType ?? str(exportData.fuel_name);
            color = color ?? str(exportData.color_name);
            const expOdo = num(exportData.mileage);
            const exportDate = dateOnly(exportData.export_date);
            if (expOdo != null) {
              if (odometer == null || expOdo > odometer) odometer = expOdo;
              if (exportDate) {
                mileageHistory.push({
                  date: exportDate,
                  odometer: expOdo,
                  unit: "km",
                  source: "Export declaration",
                });
              }
            }
            const firstReg = dateOnly(exportData.first_registration_date);
            if (firstReg) {
              year = year ?? Number(firstReg.slice(0, 4));
              pushExtra(vehicleExtras, "first_registration", "First registration", firstReg, firstReg);
              registryHistory.push({
                date: firstReg,
                type: "first_registration",
                title: "First registration",
                subtitle: str(exportData.model_name),
              });
            }
            pushExtra(vehicleExtras, "kr_export_date", "Export date", exportDate, exportDate);
            if (exportDate) {
              registryHistory.push({
                date: exportDate,
                type: "export",
                title: "Export declaration",
                subtitle: expOdo != null ? `${expOdo.toLocaleString()} km` : null,
                mileage: expOdo,
              });
            }
            pushExtra(vehicleExtras, "kr_export_fuel", "Export fuel", str(exportData.fuel_name));
            pushExtra(vehicleExtras, "kr_export_color", "Export color", str(exportData.color_name));
            pushExtra(vehicleExtras, "kr_export_seats", "Seats", exportData.seats_count);
            pushExtra(vehicleExtras, "kr_export_engine", "Engine displacement", exportData.engine_displacement != null ? `${exportData.engine_displacement} cc` : null);
            const exportTotalLossDesc =
              exportData.is_total_loss === true
                ? (str(exportData.total_loss_description) ?? "Yes")
                : exportData.is_total_loss === false
                  ? "No"
                  : null;
            pushExtra(
              vehicleExtras,
              "kr_export_total_loss",
              "Export total loss",
              exportTotalLossDesc,
            );
            // Export declaration total-loss flag drives salvage / total-loss title (same as KR special_conditions).
            if (exportData.is_total_loss === true) {
              isSalvage = true;
              registryHistory.push({
                date: exportDate,
                type: "total_loss",
                title: "Total loss",
                subtitle: str(exportData.total_loss_description) ?? "Recorded on export declaration",
              });
              accidents.push({
                date: exportDate,
                description: "Total loss recorded on Korean export declaration",
                type: "total_loss",
                country: "KR",
              });
            } else if (exportData.is_total_loss === false && isSalvage == null) {
              isSalvage = false;
            }
            if (exportData.length != null || exportData.width != null || exportData.height != null) {
              pushExtra(
                vehicleExtras,
                "kr_export_dims",
                "Dimensions (L×W×H)",
                [exportData.length, exportData.width, exportData.height].filter((x) => x != null).join(" × ") + " mm",
              );
            }
            if (!country) country = "KR";
            continue;
          }

          if (koreaSection === "summary") {
            const oc = num(data.owner_count);
            if (oc != null) ownerCount = ownerCount ?? oc;
            const myDmg = num(data.my_damage_count) ?? 0;
            const otherDmg = num(data.other_damage_count) ?? 0;
            accidentCountHint = myDmg + otherDmg;
            isFlooded = isFlooded ?? ((num(data.flood) ?? 0) > 0);
            if ((num(data.total_loss) ?? 0) > 0) isSalvage = true;
            else if (isSalvage == null && data.total_loss != null) isSalvage = false;
            if ((num(data.theft) ?? 0) > 0) isStolen = true;
            else if (isStolen == null && data.theft != null) isStolen = false;
            if ((num(data.total_loss) ?? 0) > 0) {
              pushExtra(vehicleExtras, "kr_summary_total_loss", "Total loss events", data.total_loss);
            }
            if ((num(data.theft) ?? 0) > 0) {
              pushExtra(vehicleExtras, "kr_summary_theft", "Theft events", data.theft);
            }
            if ((num(data.flood) ?? 0) > 0) {
              pushExtra(vehicleExtras, "kr_summary_flood", "Flood events", data.flood);
            }
            pushExtra(vehicleExtras, "kr_summary_own_damage", "Own damage claims", myDmg > 0 ? `${myDmg} (${(num(data.my_damage_sum) ?? 0).toLocaleString()} KRW)` : "0");
            pushExtra(vehicleExtras, "kr_summary_other_damage", "Other-party claims", otherDmg > 0 ? `${otherDmg} (${(num(data.other_damage_sum) ?? 0).toLocaleString()} KRW)` : "0");
            pushExtra(vehicleExtras, "kr_summary_owners", "Owners", data.owner_count);
            pushExtra(vehicleExtras, "kr_summary_plate", "Registration number", str(data.registration_number));
            pushExtra(vehicleExtras, "kr_summary_report_date", "Insurance report date", dateOnly(data.report_date), dateOnly(data.report_date));
            if (!country) country = "KR";
            marketCurrency = marketCurrency ?? "KRW";
          }
        }
        continue;
      }

      if (type === "history") {
        for (const item of itemsOf(section)) {
          const snap =
            item.vehicle_snapshot && typeof item.vehicle_snapshot === "object" && !Array.isArray(item.vehicle_snapshot)
              ? (item.vehicle_snapshot as Record<string, unknown>)
              : null;
            if (snap) {
            make = make ?? str(snap.brand) ?? str(snap.make);
            model = model ?? str(snap.model);
            year = year ?? num(snap.year);
            trim = trim ?? str(snap.badge);
            bodyType = bodyType ?? str(snap.body_style);
            fuelType = fuelType ?? str(snap.fuel_type);
            transmission = transmission ?? str(snap.transmission);
            color = color ?? str(snap.color);
            const engCc = num(snap.engine_volume_cc);
            if (engCc != null && !engine) engine = `${engCc} cc`;
            const snapOdo = num(snap.mileage_km);
            const historySource =
              str((item.source as Record<string, unknown> | undefined)?.source_key)
              ?? str(snap.source_domain)
              ?? "history";
            if (snapOdo != null) {
              if (odometer == null || snapOdo > odometer) odometer = snapOdo;
              const checked = dateOnly(item.checked_at);
              if (checked) {
                mileageHistory.push({
                  date: checked,
                  odometer: snapOdo,
                  unit: "km",
                  source: historySource,
                });
              }
            }
            if (!make && str(snap.title)) {
              const parsed = parseVehicleTitle(str(snap.title));
              year = year ?? parsed.year;
              make = make ?? parsed.make;
              model = model ?? parsed.model;
              trim = trim ?? parsed.trim;
            }
            pushExtra(vehicleExtras, "history_body", "Body", str(snap.body_style));
            pushExtra(vehicleExtras, "history_color", "Color", str(snap.color));
            pushExtra(vehicleExtras, "history_fuel", "Fuel", str(snap.fuel_type));
            pushExtra(vehicleExtras, "history_transmission", "Transmission", str(snap.transmission));
            pushExtra(vehicleExtras, "history_engine", "Engine", engCc != null ? `${engCc} cc` : null);
            // Never surface History listing ID or History source domains.
          }

          const summary =
            item.summary && typeof item.summary === "object" && !Array.isArray(item.summary)
              ? (item.summary as Record<string, unknown>)
              : null;
          if (summary) {
            const oc = num(summary.owner_change_count);
            if (oc != null) ownerCount = ownerCount ?? oc;
          }

          const coverage =
            item.coverage && typeof item.coverage === "object" && !Array.isArray(item.coverage)
              ? (item.coverage as Record<string, unknown>)
              : null;
          if (coverage) {
            const completeness = titleCaseLabel(str(coverage.completeness_key));
            const start = dateOnly(coverage.period_start);
            const end = dateOnly(coverage.period_end);
            const sections = Array.isArray(coverage.section_keys)
              ? coverage.section_keys.map((x) => str(x)).filter(Boolean).join(", ")
              : null;
            pushExtra(
              vehicleExtras,
              "history_coverage",
              "History coverage",
              [completeness, start && end ? `${start} → ${end}` : null, sections].filter(Boolean).join(" · "),
              end,
            );
          }

          const limitations = Array.isArray(item.limitations) ? item.limitations : [];
          for (const lim of limitations) {
            if (!lim || typeof lim !== "object" || Array.isArray(lim)) continue;
            const row = lim as Record<string, unknown>;
            pushExtra(
              vehicleExtras,
              str(row.id) ?? "history_limitation",
              "History limitation",
              str(row.description) ?? titleCaseLabel(str(row.type_key)),
              dateOnly(item.checked_at),
            );
          }

          const checks = Array.isArray(item.checks) ? item.checks : [];
          for (const chk of checks) {
            if (!chk || typeof chk !== "object" || Array.isArray(chk)) continue;
            const c = chk as Record<string, unknown>;
            const label = str(c.source_label) ?? titleCaseLabel(str(c.type_key)) ?? str(c.id);
            if (!label) continue;
            const result = (str(c.result_key) ?? "").toLowerCase();
            const present = result === "present" || result === "yes" || result === "true";
            const absent = result === "not_present" || result === "absent" || result === "no" || result === "false";
            const id = str(c.id) ?? str(c.type_key) ?? "";
            const isFlood = id === "flood_history" || /flood/i.test(id) || /flood/i.test(label);
            const isTotalLoss = id === "total_loss_history" || /total_loss/i.test(id) || /total\s*loss/i.test(label);
            const isTheft = /theft|stolen/i.test(id) || /theft|stolen/i.test(label);
            const isTaxiUse = /rental_use|taxi/i.test(id) || /^(rental|taxi)\b/i.test(label);

            // Drive report status cards from explicit present/absent — never invent timeline noise.
            if (isFlood) {
              if (present) isFlooded = true;
              else if (absent && isFlooded == null) isFlooded = false;
            }
            if (isTotalLoss) {
              if (present) isSalvage = true;
              else if (absent && isSalvage == null) isSalvage = false;
            }
            if (isTheft) {
              if (present) isStolen = true;
              else if (absent && isStolen == null) isStolen = false;
            }
            if (isTaxiUse) {
              if (present) isTaxi = true;
              else if (absent && isTaxi == null) isTaxi = false;
            }

            // Absent checks → silent (flags only). Present usage/flag checks stay in
            // vehicleExtras — never invent "Government / Special Usage · Present" timeline noise.
            if (!present) continue;

            const checkedAt = dateOnly(item.checked_at);
            pushExtra(vehicleExtras, str(c.id) ?? label, label, "Yes", checkedAt);
            if (isTotalLoss) {
              accidents.push({
                date: checkedAt,
                description: "Total loss recorded in Korean vehicle history",
                type: "total_loss",
                country: country ?? "KR",
              });
            }
            if (isFlood) {
              accidents.push({
                date: checkedAt,
                description: "Flood / water damage recorded in Korean vehicle history",
                type: "flood",
                country: country ?? "KR",
              });
            }
          }

          const events = Array.isArray(item.events) ? item.events : [];
          for (const ev of events) {
            if (!ev || typeof ev !== "object" || Array.isArray(ev)) continue;
            const e = ev as Record<string, unknown>;
            const evDate = dateOnly(e.occurred_at ?? e.date);
            const typeKey = str(e.type_key) ?? "";
            const label = str(e.source_label) ?? titleCaseLabel(typeKey);
            const detailBits = Array.isArray(e.details)
              ? e.details
                .map((d) => {
                  if (!d || typeof d !== "object" || Array.isArray(d)) return null;
                  const row = d as Record<string, unknown>;
                  return str(row.value_text) ?? str(row.value) ?? str(row.source_label);
                })
                .filter(Boolean)
              : [];
            const subtitle = detailBits.join(" · ") || null;
            if (typeKey.includes("owner") || /ownership|transfer/i.test(label ?? "")) {
              ownerHistory.push({
                date: evDate,
                condition: [label, subtitle].filter(Boolean).join(" · "),
              });
            }
            if (label) {
              registryHistory.push({
                date: evDate,
                type: typeKey || "event",
                title: label,
                subtitle,
                details: detailBits.length
                  ? detailBits.map((v) => ({ label: "Detail", value: String(v) }))
                  : undefined,
              });
            }
            if (typeKey.includes("accident") || /accident|collision|damage/i.test(label ?? "")) {
              accidents.push({
                date: evDate,
                description: [label, subtitle].filter(Boolean).join(" — "),
                type: typeKey || "history",
                country: country ?? "KR",
              });
            }
            if (typeKey.includes("insurance") || /insurance|claim/i.test(label ?? "")) {
              insuranceClaims.push({
                date: evDate,
                type: label ?? "Insurance",
                description: subtitle,
              });
            }
          }
        }
        continue;
      }

      if (type === "mileage" || type === "odometer" || type === "mileage_history") {
        for (const item of itemsOf(section)) {
          const date = dateOnly(item.date ?? item.recorded_at ?? item.created_at);
          const odo = num(item.odometer ?? item.odometer_km ?? item.mileage ?? item.value);
          if (date && odo != null) {
            mileageHistory.push({
              date,
              odometer: odo,
              unit: str(item.unit) ?? "km",
              source: str(item.source) ?? "vhr",
            });
            if (odometer == null || odo > odometer) odometer = odo;
          }
        }
      }
    }
  }

  const vin = vinEarly;
  // WMI decode is manufacturing origin (WDD → Germany). Catalog `country` is the
  // report market. Real Korean insurance history on an EU import must stay KR —
  // do not overwrite with the plant country. NA-origin VINs keep WMI (KR stubs cleaned below).
  const hasKoreanMarketEvidence =
    sawKoreanInsurance
    && (
      koreanVinEarly
      || insuranceClaims.some((c) => {
        const ccy = String(c.currency ?? "").toUpperCase();
        return ccy === "KRW" || (typeof c.lossAmount === "number" && c.lossAmount > 0);
      })
      || accidents.some((a) => /^KR$/i.test(String(a.country ?? "")))
    );
  if (hasKoreanMarketEvidence && !isNorthAmericanCountry(decodedCountry)) {
    country = "KR";
  } else if (decodedCountry) {
    country = decodedCountry;
  } else if (hasKoreanMarketEvidence) {
    country = "KR";
  }

  // Korean insurance identity wins for Korean VINs / KR reports (amazing integrated merge).
  const koreanVin = koreanVinEarly;
  if (sawKoreanInsurance && krIdentity && (koreanVin || /korea|\bKR\b/i.test(String(country ?? decodedCountry ?? "")))) {
    make = krIdentity.make ?? make;
    model = krIdentity.model ?? model;
    if (krIdentity.year != null) year = krIdentity.year;
    trim = krIdentity.trim ?? trim;
    engine = krIdentity.engine ?? engine;
    fuelType = krIdentity.fuelType ?? fuelType;
    bodyType = krIdentity.bodyType ?? bodyType;
  }

  // One average per currency — never blend KRW millions into EUR/USD.
  for (const [cur, vals] of salePricesByCurrency) {
    const avg = averageNums(vals);
    if (avg == null) continue;
    const money = sanitizeMoney(avg, cur);
    estimateCandidates.push({ value: money.value, currency: money.currency, rank: 30 });
    pushExtra(
      vehicleExtras,
      `price_avg_${money.currency}`,
      "Average price",
      `${money.value.toLocaleString()} ${money.currency}`,
    );
  }

  // Prefer ACV → pre-accident → KR market avg → buy-now → price-history average.
  // For US/EU-origin cars, prefer USD/EUR valuations over later Encar KRW sales.
  const originLooksWestern = /united states|\busa?\b|canada|germany|france|italy|spain|united kingdom|\buk\b|japan|europe/i
    .test(String(decodedCountry ?? country ?? ""));
  const hardCurrency = estimateCandidates.filter((c) => {
    const ccy = c.currency.toUpperCase();
    return ccy === "USD" || ccy === "EUR" || ccy === "GBP";
  });
  const lastCur = (marketCurrency ?? "").toUpperCase();
  const sameCurrency = lastCur
    ? estimateCandidates.filter((c) => c.currency.toUpperCase() === lastCur)
    : [];
  const krwCurrency = estimateCandidates.filter((c) => c.currency.toUpperCase() === "KRW");
  const estimatePool =
    sawKoreanInsurance && koreanVin && krwCurrency.length > 0
      ? krwCurrency
      : originLooksWestern && hardCurrency.length > 0
        ? hardCurrency
        : sameCurrency.length > 0
          ? sameCurrency
          : hardCurrency.length > 0
            ? hardCurrency
            : estimateCandidates;
  estimatePool.sort((a, b) => a.rank - b.rank || b.value - a.value);
  const bestEstimate = estimatePool[0] ?? null;
  if (bestEstimate) {
    marketCurrency = bestEstimate.currency || marketCurrency;
  }

  // Align last auction price to the estimate currency when possible (cleaner market card).
  if (marketCurrency && auctionHistory.length) {
    const want = marketCurrency.toUpperCase();
    const match = [...auctionHistory]
      .filter((a) => (a.currency ?? "").toUpperCase() === want && (a.finalPrice ?? 0) > 0)
      .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
    if (match[0]) {
      lastAuctionPrice = match[0].finalPrice ?? lastAuctionPrice;
      lastAuctionDate = match[0].date ?? lastAuctionDate;
    }
  }
  if (lastAuctionPrice != null && marketCurrency) {
    const aligned = sanitizeMoney(lastAuctionPrice, marketCurrency);
    lastAuctionPrice = aligned.value;
    marketCurrency = aligned.currency;
  }

  // Carstat free demos reuse unrelated auction photos (Jeep/Genesis on Honda VINs).
  const resolvedPhotos = resolveCarstatReportPhotos({
    photos: photos.slice(0, 24),
    photosHd: photosHd.slice(0, 24),
    make,
    model,
    illustrativeDemo,
  });

  // Final market hygiene: NA-origin cars must not keep Euro/KR pollution or mashup auctions.
  const naOrigin = isNorthAmericanCountry(decodedCountry ?? country);
  const koreanVinFinal = !!vin && /^K/i.test(vin);
  const cleanedExtras = naOrigin
    ? vehicleExtras.filter((extra) => {
      const label = (extra.label ?? "").toLowerCase();
      const value = (extra.value ?? "").toLowerCase();
      const key = (extra.key ?? "").toLowerCase();
      if (label.includes("emission") && isEuroEmissionValue(value)) return false;
      if (label.includes("co₂") || label === "co2" || label.includes("co2")) return false;
      if (/korean|korea|\bkr\b|own damage claims|other-party claims|trim options/i.test(`${label} ${key}`)) {
        return false;
      }
      if (/^kr_/.test(key)) return false;
      // KRW listing valuations mashed into USD pre-accident/ACV rows on US-origin cars.
      if (
        /\bkrw\b/.test(value)
        && /pre-accident|actual cash|estimated repair|price without tax/i.test(label)
      ) {
        return false;
      }
      return true;
    })
    : vehicleExtras;

  const cleanedService = serviceHistory.filter((row) => {
    const loc = String(row.location ?? "");
    if (isAuctionOrClassifiedMarketplace(loc) || isPlaygroundGenericMarketplace(loc)) return false;
    return true;
  });

  const cleanedAuctions = naOrigin && !koreanVin
    ? auctionHistory.filter((row) => {
      const city = String(row.city ?? "");
      const state = String(row.state ?? "");
      const rowCountry = String(row.country ?? "");
      const usPlace = US_CITY_RE.test(city) || US_STATE_ABBR_RE.test(`${city} ${state}`);
      const euCountry = isEuropeanListingMarket(null, rowCountry);
      // Houston + Germany (or any US city + EU country) mashups.
      if (usPlace && euCountry) return false;
      // Any non-NA sale market on a US/Canada-origin VIN.
      if (isNonNorthAmericanSaleMarket(null, rowCountry, row.currency)) return false;
      return true;
    })
    : auctionHistory;

  const cleanedMileage = naOrigin && !koreanVin
    ? mileageHistory.filter((row) => {
      const src = String(row.source ?? "");
      if (/encar|korean|european\s*(marketplace|vehicle|auction)|mobile\.de|autoscout/i.test(src)) {
        return false;
      }
      return true;
    })
    : mileageHistory;

  const cleanedClaims = !koreanVinFinal && naOrigin
    ? insuranceClaims.filter((c) => {
      const currency = String(c.currency ?? "").toUpperCase();
      if (currency === "KRW") return false;
      const blob = `${c.type ?? ""} ${c.description ?? ""} ${c.lossAmount ?? ""}`;
      if (/korean|krw|₩|won\b|own damage|third party/i.test(blob)) return false;
      // Encar-scale KRW amounts left without currency on US cars.
      if (
        typeof c.lossAmount === "number"
        && c.lossAmount >= 100_000
        && (currency === "" || currency === "KRW")
      ) {
        return false;
      }
      return true;
    })
    : insuranceClaims;

  const cleanedAccidents = !koreanVinFinal && naOrigin
    ? accidents.filter((a) => {
      if (/^KR$/i.test(String(a.country ?? ""))) return false;
      if (/korean insurance/i.test(String(a.description ?? ""))) return false;
      return true;
    })
    : accidents;

  const report = {
    dataSource: "carstat_vhr" as const,
    make,
    model,
    year,
    trim,
    engine,
    transmission,
    fuelType: fuelType ? translateRuToEn(fuelType) : fuelType,
    bodyType: bodyType ? translateRuToEn(bodyType) : bodyType,
    color: color ? translateRuToEn(color) : color,
    country,
    hp,
    cylinders,
    odometer,
    isFlooded,
    isSalvage,
    isTaxi,
    isStolen,
    ownerCount,
    photos: resolvedPhotos.photos,
    photosHd: resolvedPhotos.photosHd,
    mileageHistory: consolidateSameDayMileage(
      mergeUniqueByKey(cleanedMileage as Array<Record<string, unknown>>, (r) =>
        `${r.date}|${r.odometer}|${r.source ?? ""}`,
      ),
    ) as NormalizedVinData["mileageHistory"],
    auctionHistory: mergeUniqueByKey(cleanedAuctions as Array<Record<string, unknown>>, (r) =>
      `${r.date}|${r.finalPrice}|${r.city}|${r.lotStatus}`,
    ) as NormalizedVinData["auctionHistory"],
    accidents: mergeUniqueByKey(cleanedAccidents as Array<Record<string, unknown>>, (r) =>
      `${r.date}|${r.primaryDamage}|${r.odometerAtLoss}|${r.description ?? ""}`,
    ) as NormalizedVinData["accidents"],
    insuranceClaims: mergeUniqueByKey(cleanedClaims as Array<Record<string, unknown>>, (r) =>
      `${r.date}|${r.type}|${r.lossAmount}`,
    ) as NormalizedVinData["insuranceClaims"],
    ownerHistory: mergeUniqueByKey(ownerHistory as Array<Record<string, unknown>>, (r) =>
      `${r.date}|${r.condition}|${r.lotStatus ?? ""}`,
    ) as NormalizedVinData["ownerHistory"],
    serviceHistory: mergeUniqueByKey(cleanedService as Array<Record<string, unknown>>, (r) =>
      `${r.date}|${r.mileage}|${r.title ?? ""}`,
    ) as NormalizedVinData["serviceHistory"],
    recallHistory: mergeUniqueByKey(recallHistory as Array<Record<string, unknown>>, (r) =>
      `${r.date}|${r.title}|${r.subtitle ?? ""}`,
    ) as NormalizedVinData["recallHistory"],
    registryHistory: mergeUniqueByKey((() => {
      // If export only landed in mileageHistory, still emit a registry timeline row.
      const hasExportRegistry = registryHistory.some((r) => {
        const type = String(r.type ?? "").toLowerCase();
        const title = String(r.title ?? "");
        return type === "export" || /export\s*declaration|수출|экспорт/i.test(title);
      });
      if (!hasExportRegistry) {
        const exportMileage = mileageHistory.find((m) =>
          /export\s*declaration|export\s*date|\bexport\b|수출|экспорт/i.test(String(m.source ?? "")),
        );
        const exportDate = exportMileage?.date ? dateOnly(exportMileage.date) : null;
        if (exportDate) {
          const km = typeof exportMileage?.odometer === "number" ? exportMileage.odometer : null;
          registryHistory.push({
            date: exportDate,
            type: "export",
            title: "Export declaration",
            subtitle: km != null ? `${km.toLocaleString()} km` : null,
            mileage: km,
          });
        }
      }
      return registryHistory as Array<Record<string, unknown>>;
    })(), (r) =>
      `${r.date}|${r.type}|${r.title}|${r.subtitle ?? ""}`,
    ) as NormalizedVinData["registryHistory"],
    vehicleExtras: cleanedExtras.slice(0, 160),
    accidentCount: accidents.length || accidentCountHint || null,
    marketData: {
      estimatedValue: bestEstimate?.value ?? null,
      currency: marketCurrency,
      lastAuctionPrice,
      lastAuctionDate,
    },
  };
  return translateNormalizedReportRuToEn(report) as NormalizedVinData;
}

/** True when VHR payload has enough structured fields for the normal report UI. */
export function hasStructuredVhrReport(data: unknown): boolean {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const d = data as Record<string, unknown>;
  if (d.dataSource !== "carstat_vhr") return false;
  if (typeof d.make === "string" && d.make.trim()) return true;
  if (typeof d.year === "number" && Number.isFinite(d.year)) return true;
  const arrays = [
    d.mileageHistory,
    d.auctionHistory,
    d.accidents,
    d.insuranceClaims,
    d.ownerHistory,
    d.registryHistory,
    d.serviceHistory,
    d.recallHistory,
    d.photos,
    d.vehicleExtras,
  ];
  return arrays.some((a) => Array.isArray(a) && a.length > 0);
}
