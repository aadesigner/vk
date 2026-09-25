/**
 * Parse vehicle-history PDF text into pending VIN form fields.
 * Miles → km. Does not touch photos (handled by apply helper).
 * Customer-facing strings never keep provider brand names.
 */

import {
  EMPTY_ACCIDENT,
  EMPTY_MILEAGE,
  EMPTY_OWNER,
  EMPTY_SERVICE,
  EMPTY_MARKET_DATA,
  type CatalogAccidentForm,
  type CatalogMileageForm,
  type CatalogOwnerForm,
  type CatalogServiceForm,
} from "@/components/admin/vin-catalog-history-editors";
import type { VinCatalogFormState } from "@/components/admin/vin-catalog-data-form";
import {
  resolveBodySelectValue,
  resolveCountrySelectValue,
  resolveFuelSelectValue,
  resolveTransmissionSelectValue,
} from "@/lib/vehicle-attr-options";
import { sortHistoryNewestFirst } from "@/lib/history-sort";
import {
  parseOdometerNumber,
  readingToKm,
  unitHintFromSnippet,
} from "@/lib/provider-pdf-miles";

export type ProviderPdfKind = "carfax" | "autocheck" | "unknown";

export type ProviderPdfParseOk = {
  ok: true;
  provider: ProviderPdfKind;
  vinFound: string | null;
  form: Omit<VinCatalogFormState, "photos">;
  summary: string[];
};

export type ProviderPdfParseErr = {
  ok: false;
  error: string;
};

export type ProviderPdfParseResult = ProviderPdfParseOk | ProviderPdfParseErr;

const VIN_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/gi;
const DATE_TOKEN =
  "(?:0?[1-9]|1[0-2])[\\/\\-.](?:0?[1-9]|[12]\\d|3[01])[\\/\\-.](?:19|20)\\d{2}";
const DATE_RE = new RegExp(`\\b(${DATE_TOKEN})\\b`, "i");

const CURRENT_YEAR = new Date().getFullYear();
const MIN_MODEL_YEAR = 1981;
const MAX_MODEL_YEAR = CURRENT_YEAR + 1;

const NEXT_SPEC_LABEL =
  "VIN|Year|Make|Model|Trim|Style|Series|Engine|Transmission|Trans|Fuel|Body|Drive|Drivetrain|Title|Odometer|Owners?|Cylinders?|Horsepower|HP\\b";

const KNOWN_MAKES = [
  "Acura", "Alfa Romeo", "Aston Martin", "Audi", "Bentley", "BMW", "Buick", "Cadillac",
  "Chevrolet", "Chrysler", "Dodge", "Ferrari", "Fiat", "Ford", "Genesis", "GMC", "Honda",
  "Hyundai", "Infiniti", "Jaguar", "Jeep", "Kia", "Lamborghini", "Land Rover", "Lexus",
  "Lincoln", "Lotus", "Maserati", "Mazda", "McLaren", "Mercedes-Benz", "Mercedes", "Mercury",
  "Mini", "Mitsubishi", "Nissan", "Porsche", "Ram", "Rolls-Royce", "Subaru", "Suzuki",
  "Tesla", "Toyota", "Volkswagen", "Volvo", "Polestar", "Rivian", "Lucid",
].sort((a, b) => b.length - a.length);

function normalizeWs(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Prefer vehicle header / summary — avoid matching years inside history rows. */
function vehicleHeader(text: string): string {
  const cut =
    text.search(
      /\b(?:accident|damage|odometer|owner|service|title)\s+history\b|\bdetailed\s+vehicle\s+history\b/i,
    );
  if (cut > 200) return text.slice(0, cut);
  return text.slice(0, Math.min(3500, text.length));
}

export function detectProviderPdfKind(text: string): ProviderPdfKind {
  const t = text.toUpperCase();
  if (/\bCARFAX\b/.test(t)) return "carfax";
  if (/\bAUTOCHECK\b/.test(t) || /\bEXPERIAN\s+AUTOCHECK\b/.test(t)) return "autocheck";
  return "unknown";
}

export function extractVinsFromText(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(VIN_RE)) {
    const v = (m[1] ?? "").toUpperCase();
    if (v.length === 17) found.add(v);
  }
  return [...found];
}

function toIsoDate(raw: string): string {
  const s = raw.trim().replace(/[.\-]/g, "/");
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    return `${m[3]}-${m[1]!.padStart(2, "0")}-${m[2]!.padStart(2, "0")}`;
  }
  m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m) {
    return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  }
  return raw.trim();
}

function isPlausibleModelYear(y: number): boolean {
  return Number.isFinite(y) && y >= MIN_MODEL_YEAR && y <= MAX_MODEL_YEAR;
}

function cleanSpecValue(raw: string): string {
  let v = raw.replace(/\s{2,}/g, " ").trim();
  const cutRe = new RegExp(`\\s+(?=${NEXT_SPEC_LABEL})`, "i");
  const parts = v.split(cutRe);
  v = (parts[0] ?? v).trim().replace(/[,;:|#]+$/g, "").trim();
  // Drop trailing junk like "- vehicle", "reported", etc.
  v = v.replace(/\s*[-–—]\s*(vehicle|car|noted|reported).*$/i, "").trim();
  return v;
}

function fieldAfterLabel(scope: string, labels: string[], maxLen = 80): string | null {
  for (const label of labels) {
    const re = new RegExp(`${label}\\s*[:#]?\\s*([^\\n]{1,${maxLen}})`, "i");
    const m = scope.match(re);
    if (!m?.[1]) continue;
    const cleaned = cleanSpecValue(m[1]);
    if (cleaned && cleaned.length <= maxLen) return cleaned;
  }
  return null;
}

function parseYear(scope: string): string {
  const labeled = fieldAfterLabel(scope, [
    "Model\\s*year",
    "Year\\s*(?:of\\s*)?(?:manufacture|vehicle)?",
    "Year",
  ]);
  if (labeled) {
    const y = Number(labeled.replace(/\D/g, "").slice(0, 4));
    if (isPlausibleModelYear(y)) return String(y);
  }

  // "2019 Audi A6 Prestige" near top / after VIN
  const ymm = scope.match(
    new RegExp(
      `\\b((?:19|20)\\d{2})\\s+(${KNOWN_MAKES.map(escapeRe).join("|")})\\s+([A-Za-z0-9][A-Za-z0-9 \\-/.]{0,40})`,
      "i",
    ),
  );
  if (ymm) {
    const y = Number(ymm[1]);
    if (isPlausibleModelYear(y)) return String(y);
  }
  return "";
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseMake(scope: string): string {
  const labeled = fieldAfterLabel(scope, ["Make", "Manufacturer"]);
  if (labeled) {
    const hit = KNOWN_MAKES.find((m) => labeled.toLowerCase().startsWith(m.toLowerCase()));
    if (hit) return hit;
    // First 1–3 words, stop before model-ish tokens
    const word = labeled.split(/\s+/)[0] ?? "";
    if (/^[A-Za-z][A-Za-z\-]+$/.test(word) && word.length >= 2) return word;
  }
  for (const make of KNOWN_MAKES) {
    const re = new RegExp(`\\b${escapeRe(make)}\\b`, "i");
    if (re.test(scope.slice(0, 2000))) return make;
  }
  return "";
}

function parseModel(scope: string, make: string): string {
  const labeled = fieldAfterLabel(scope, ["Model(?:\\s*name)?"], 60);
  if (labeled) return cleanModelName(labeled, make);

  if (make) {
    const re = new RegExp(
      `\\b${escapeRe(make)}\\s+([A-Za-z0-9][A-Za-z0-9 \\-/.]{1,50}?)(?=\\s{2,}|\\n|\\b(?:${NEXT_SPEC_LABEL})\\b|$)`,
      "i",
    );
    const m = scope.match(re);
    if (m?.[1]) {
      let model = cleanSpecValue(m[1]);
      model = model.replace(/^(?:19|20)\d{2}\s+/, "");
      return cleanModelName(model, make);
    }
  }

  const ymm = scope.match(
    new RegExp(
      `\\b(?:19|20)\\d{2}\\s+(${KNOWN_MAKES.map(escapeRe).join("|")})\\s+([A-Za-z0-9][A-Za-z0-9 \\-/.]{1,50})`,
      "i",
    ),
  );
  if (ymm?.[2]) return cleanModelName(cleanSpecValue(ymm[2]), ymm[1] ?? make);
  return "";
}

/** Drop duplicated make, trailing mileage digits, and junk. */
export function cleanModelName(raw: string, make?: string): string {
  let m = raw.replace(/\s+/g, " ").trim();
  if (make) {
    const makeRe = new RegExp(`^${escapeRe(make)}\\s+`, "i");
    m = m.replace(makeRe, "");
  }
  // Strip trailing bare numbers (mileage bleed like "Tiguan S 164")
  m = m.replace(/\s+\d{1,6}$/g, "");
  m = m.replace(/\b[\d,]{2,7}\s*(?:miles?|mi|km)\b/gi, "");
  m = m.replace(/\s*[-–—]\s*(vehicle|car|noted|reported).*$/i, "");
  return m.replace(/\s{2,}/g, " ").trim().slice(0, 60);
}

function parseFuel(scope: string): string {
  const labeled = fieldAfterLabel(scope, ["Fuel\\s*type", "Fuel"]);
  let raw = "";
  if (labeled) raw = labeled;
  else if (/\bdiesel\b/i.test(scope.slice(0, 2500))) raw = "diesel";
  else if (/\belectric\b/i.test(scope.slice(0, 2500))) raw = "electric";
  else if (/\bhybrid\b/i.test(scope.slice(0, 2500))) raw = "hybrid";
  else if (/\b(?:gasoline|petrol|gas)\b/i.test(scope.slice(0, 2500))) raw = "gasoline";
  if (!raw) return "";
  return resolveFuelSelectValue(raw);
}

function parseBody(scope: string): string {
  const labeled = fieldAfterLabel(scope, ["Body\\s*style", "Body\\s*type", "Body"]);
  let raw = labeled ?? "";
  if (!raw) {
    const head = scope.slice(0, 2500);
    if (/\bSUV\b|\bcrossover\b/i.test(head)) raw = "suv";
    else if (/\bsedan\b/i.test(head)) raw = "sedan";
    else if (/\bcoupe\b/i.test(head)) raw = "coupe";
    else if (/\bhatch/i.test(head)) raw = "hatchback";
  }
  if (!raw) return "";
  return resolveBodySelectValue(raw);
}

function classifyTransmission(blob: string): string {
  const l = blob.toLowerCase();
  if (/\bmanual\b|\bstick\b/.test(l)) return "manual";
  if (/\bcvt\b/.test(l)) return "cvt";
  if (/\bdct\b|\bdsg\b|\bdual[-\s]?clutch\b|\bpdk\b/.test(l)) return "dct";
  if (/\bamt\b/.test(l)) return "amt";
  if (/\bsemi[-\s]?automatic\b/.test(l)) return "semi-automatic";
  if (/\bauto(?:matic)?\b|\btiptronic\b|\bs[-\s]?tronic\b|\ba\/t\b/.test(l)) return "automatic";
  return "";
}

function parseTransmission(scope: string): string {
  const labeled = fieldAfterLabel(scope, ["Transmission", "Trans(?:mission)?\\s*type"]);
  let raw = labeled ? classifyTransmission(labeled) : "";
  if (!raw) {
    const head = scope.slice(0, 3000);
    // Prefer labeled-ish phrases over accidental "Transmission" in service history
    if (
      /\b\d[\d-]*\s*speed\s+automatic\b|\bautomatic\s+transmission\b|\btransmission\s*[:#]?\s*automatic\b|\btransmission\s+automatic\b|\ba\/t\b/i.test(head)
    ) {
      raw = "automatic";
    } else if (/\bmanual\s+transmission\b|\btransmission\s*[:#]?\s*manual\b/i.test(head)) {
      raw = "manual";
    } else if (/\bCVT\b/i.test(head)) {
      raw = "cvt";
    } else {
      raw = classifyTransmission(head);
    }
  }
  if (!raw) return "";
  return resolveTransmissionSelectValue(raw);
}

const FUEL_WORDS_RE =
  /\b(?:gasoline|petrol|diesel|electric|hybrid|flex(?:\s*fuel)?|unleaded|e85|cng|lpg|hydrogen)\b/gi;

/** Engine displacement/config only — fuel belongs in fuelType. */
export function parseEngine(scope: string): string {
  const labeled = fieldAfterLabel(scope, ["Engine(?:\\s*(?:size|type|displacement))?"], 90);
  let eng = "";
  if (labeled) {
    const rich = labeled.match(
      /(\d(?:\.\d)?\s*L(?:iter)?(?:\s*[IVWH]?\d)?(?:\s*(?:DOHC|SOHC|Turbo|Supercharged|TFSI|TDI|TSI|EcoBoost|FSI|MPI|GDI|16V|24V|32V|[A-Z]{1,4})){0,8})/i,
    );
    eng = rich?.[1] ? cleanSpecValue(rich[1]) : cleanSpecValue(labeled);
  } else {
    const m = scope.slice(0, 3500).match(
      /\b(\d(?:\.\d)?\s*L(?:iter)?(?:\s*(?:I|V|W|H)?\d)?(?:\s*(?:Turbo|Supercharged|TFSI|TDI|TSI|EcoBoost|DOHC|SOHC|16V|24V))?(?:\s*[A-Za-z0-9+\-]{0,8}){0,4})\b/i,
    );
    eng = m?.[1] ? cleanSpecValue(m[1]) : "";
  }
  eng = eng.replace(FUEL_WORDS_RE, " ").replace(/\s{2,}/g, " ").trim();
  // Drop lone junk letters left from "I4 F DOHC" fuel bleed markers mid-string carefully
  eng = eng.replace(/\s+F\s+/gi, " ").replace(/\s{2,}/g, " ").trim();
  return eng.slice(0, 80);
}

/** Detect Canada from Ontario / Canada mentions; default US. */
export function parseVehicleCountry(text: string): string {
  const t = text.slice(0, 20000);
  // Any clear Canadian province / Canada mention wins over default US
  if (
    /\bCanada\b/i.test(t)
    || /\bCanadian\b/i.test(t)
    || /\bOntario\b/i.test(t)
    || /\bQuebec\b/i.test(t)
    || /\bAlberta\b/i.test(t)
    || /\bManitoba\b/i.test(t)
    || /\bSaskatchewan\b/i.test(t)
    || /\bBritish Columbia\b/i.test(t)
    || /\bNova Scotia\b/i.test(t)
    || /\bNew Brunswick\b/i.test(t)
    || /\b,\s*(?:ON|QC|BC|AB|MB|SK|NS|NB|NL|PE|YT|NT|NU)\b/.test(t)
  ) {
    return resolveCountrySelectValue("ca");
  }
  if (/\bUnited States\b/i.test(t) || /\bU\.S\.A\.?\b/i.test(t) || /\bUSA\b/.test(t)) {
    return resolveCountrySelectValue("us");
  }
  return resolveCountrySelectValue("us");
}

function parseHp(scope: string): string {
  const m = scope.slice(0, 3500).match(/\b(\d{2,4})\s*(?:hp|horsepower)\b/i);
  return m?.[1] ?? "";
}

function parseCylinders(scope: string): string {
  const m = scope.slice(0, 3500).match(/\b(\d)\s*(?:cyl|cylinders?)\b/i)
    || scope.slice(0, 3500).match(/\bV(\d)\b/);
  return m?.[1] ?? "";
}

function parseIntField(scope: string, labels: string[]): string {
  const raw = fieldAfterLabel(scope, labels);
  if (!raw) return "";
  const n = parseOdometerNumber(raw.replace(/[^\d,]/g, ""));
  return n != null ? String(n) : "";
}

function parseOdometerKm(text: string): string {
  const head = vehicleHeader(text);
  const patterns = [
    /(?:last\s+reported\s+)?(?:odometer|mileage)(?:\s*reading)?[^0-9\n]{0,40}([\d,]{3,7})\s*(miles?|mi|km|kilometers?|kilometres?)?/i,
  ];
  let best = 0;
  for (const re of patterns) {
    const m = head.match(re) ?? text.match(re);
    if (!m?.[1]) continue;
    const n = parseOdometerNumber(m[1]);
    if (n == null || n <= 0) continue;
    const km = readingToKm(n, m[2] ?? unitHintFromSnippet(m[0] ?? ""));
    if (km > best) best = km;
  }
  // Also take highest unit-backed reading anywhere (latest mileage often only in history)
  for (const m of text.matchAll(/\b([\d,]{3,7})\s*(miles?|mi|km|kilometers?|kilometres?)\b/gi)) {
    const n = parseOdometerNumber(m[1] ?? "");
    if (n == null || n <= 0) continue;
    const rawNum = (m[1] ?? "").replace(/,/g, "");
    // Skip bare calendar years mistaken as odo
    if (/^(?:19|20)\d{2}$/.test(rawNum) && n <= 2100 && !String(m[1]).includes(",")) continue;
    const km = readingToKm(n, m[2] ?? unitHintFromSnippet(m[0] ?? ""));
    if (km > best) best = km;
  }
  return best > 0 ? String(best) : "";
}

function boolFlag(text: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(text));
}

function parseTitleStatus(scope: string): string {
  if (/\bsalvage\s+title\b/i.test(scope) || /\btitle\s+brand[:\s]+salvage\b/i.test(scope)) {
    return "salvage";
  }
  if (/\brebuilt\b/i.test(scope) && /\btitle\b/i.test(scope)) return "rebuilt";
  if (/\blemon\b/i.test(scope)) return "lemon";
  if (/\bclean\s+title\b/i.test(scope) || /\bclear\s+title\b/i.test(scope)) return "clean";
  const labeled = fieldAfterLabel(scope, ["Title\\s*brand", "Title\\s*status", "Title"]);
  if (labeled) {
    const lower = labeled.toLowerCase();
    if (lower.includes("salvage")) return "salvage";
    if (lower.includes("clean") || lower.includes("clear")) return "clean";
  }
  return "";
}

/** Strip phones, URLs, star ratings, fbclid — dealer-card junk from Source column. */
export function stripDealerCardJunk(raw: string): string {
  let s = raw.replace(/\s+/g, " ").trim();
  s = s.replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, " ");
  s = s.replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, " ");
  // Full and broken URLs (PDF often inserts spaces inside the path/query)
  s = s.replace(/\b[\w.-]+\.(?:com|ca|net|org|io)\S*/gi, " ");
  s = s.replace(/\b[\w.-]+\.(?:com|ca|net|org|io)(?:\s*\/[\w.?=&%/\-\s]*)?/gi, " ");
  s = s.replace(/\bfbclid=\S+/gi, " ");
  s = s.replace(/\bfbclid\b/gi, " ");
  // Opaque URL/query leftovers (lowercase hashes only — never "Volkswagen")
  s = s.replace(/\b[a-z0-9]*_[a-z0-9_]{6,}\b/g, " ");
  s = s.replace(/\b[a-z0-9]{16,}\b/g, " ");
  s = s.replace(/\b\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?\b/g, " ");
  s = s.replace(/\b\d+\s+Customer\s+Favorites?\b/gi, " ");
  s = s.replace(/\bCustomer\s+Favorites?\b/gi, " ");
  s = s.replace(/\bTitle\s*#\s*[A-Z0-9-]+\b/gi, " ");
  s = s.replace(/[/?&=]+/g, " ");
  s = s.replace(/\s{2,}/g, " ").trim();
  return s;
}

/**
 * Remove provider brand names from any text that can appear on our report.
 * "No total loss reported to CARFAX." → "No total loss reported."
 */
export function sanitizeCustomerFacingText(raw: string): string {
  let s = raw.replace(/\s+/g, " ").trim();
  if (!s) return "";
  s = s.replace(/\b(?:to|by|from|via|on)\s+CARFAX\b/gi, "");
  s = s.replace(/\bCARFAX(?:\s+(?:Vehicle History Report|Canada|Inc\.?))?\b/gi, "");
  s = s.replace(/\b(?:Experian\s+)?AutoCheck\b/gi, "");
  s = s.replace(/\breported\s+to\s*$/i, "reported");
  s = s.replace(/\breported\s+to\s*\./gi, "reported.");
  s = s.replace(/\s{2,}/g, " ");
  s = s.replace(/\s+([.,;:])/g, "$1");
  s = s.replace(/\.\s*\./g, ".");
  return s.trim();
}

const TABLE_HEADER_NOISE =
  /^(?:date|mileage|source|comments|service|owner|glossary)$/i;

/** Finalize a location: dealer/city or agency only — never URL junk or table headers. */
export function cleanHistoryLocation(raw: string): string {
  let s = stripDealerCardJunk(raw);
  s = sanitizeCustomerFacingText(s);
  s = s.replace(/\b(?:Date|Mileage|Source|Comments)\b/gi, " ").replace(/\s{2,}/g, " ").trim();

  const cm = s.match(HISTORY_COMMENT_START);
  if (cm?.index != null && cm.index > 0) s = s.slice(0, cm.index).trim();
  else if (cm?.index === 0) return "";

  if (TABLE_HEADER_NOISE.test(s)) return "";

  // Official registries: keep only the agency name
  const agency = s.match(
    /\b((?:Ontario|Quebec|Alberta|British Columbia|Manitoba|Saskatchewan)\s+(?:Ministry of Transportation|Motor Vehicle Dept\.?)|(?:Florida|California|Texas|New York|[A-Z][a-z]+)\s+Motor Vehicle Dept\.?|NICB|Vehicle Manufacturer|Vehicle Importer|Service Facility)\b/i,
  );
  if (agency?.[1]) {
    return agency[1].replace(/\s+/g, " ").trim().slice(0, 80);
  }

  // City, ST/province — hard stop; drop anything after (URL leftovers, next tokens)
  const cityProv = s.match(
    /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),\s*(ON|QC|BC|AB|MB|SK|NS|NB|NL|PE|YT|NT|NU|[A-Z]{2})\b/,
  );
  if (cityProv && cityProv.index != null) {
    const before = s.slice(0, cityProv.index).trim()
      .replace(/\b(?:Ontario|Quebec|Florida)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    // Drop duplicate city name sitting before "City, ST" (e.g. "… Brampton Brampton, ON")
    const city = cityProv[1]!;
    const dealer = before
      .replace(new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (dealer.length >= 3 && dealer.length <= 50 && !/\d{3}/.test(dealer) && !TABLE_HEADER_NOISE.test(dealer)) {
      return `${dealer} ${city}, ${cityProv[2]}`.replace(/\s+/g, " ").trim().slice(0, 80);
    }
    return `${city}, ${cityProv[2]}`;
  }

  s = s.replace(/\breported\b/gi, " ");
  s = s.replace(/\b\d{3}\b/g, " ");
  s = s.replace(/\b[a-z0-9]{10,}\b/g, " "); // lowercase junk only
  s = s.replace(/\s{2,}/g, " ").trim();
  if (s.length < 3 || TABLE_HEADER_NOISE.test(s)) return "";
  if (HISTORY_COMMENT_START.test(s)) return "";
  return s.slice(0, 80);
}

/** Strip dates, mileages, and location noise from notes — keep service / event info. */
export function cleanHistoryNote(raw: string): string {
  let s = stripDealerCardJunk(raw);
  s = sanitizeCustomerFacingText(s);
  s = s.replace(new RegExp(DATE_TOKEN, "gi"), " ");
  s = s.replace(/\b[\d,]{2,7}\s*(?:miles?|mi|km|kilometers?|kilometres?)\b/gi, " ");
  s = s.replace(/\bnot\s+reported\b/gi, " ");
  s = s.replace(/\bOdometer\s+reported\s+as\b/gi, " ");
  s = s.replace(/\bSource\s*[:#]?\s*[^|;\n]+/gi, " ");
  s = s.replace(/\b(?:Date|Mileage|Source|Comments)\b/gi, " ");
  // City, ST only — do NOT strip "Ontario" inside "Passed Ontario safety…"
  s = s.replace(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)?,\s*(?:[A-Z]{2}|ON|QC|BC|AB)\b/g, " ");
  s = s.replace(
    /\b(?:Ontario|Quebec|Alberta|Manitoba|Saskatchewan)\s+(?:Ministry of Transportation|Motor Vehicle Dept\.?)\b/gi,
    " ",
  );
  s = s.replace(/\b(?:Florida|California|Texas)\s+Motor Vehicle Dept\.?\b/gi, " ");
  s = s.replace(/\b(?:DMV|NICB|Vehicle Manufacturer|Vehicle Importer|Service Facility)\b/gi, " ");
  s = s.replace(/\s*[-–—|:]\s*/g, " · ");
  s = s.replace(/(?:\s*·\s*)+/g, " · ").replace(/^\s*·\s*|\s*·\s*$/g, "");
  s = s.replace(/\s{2,}/g, " ").trim();
  if (s.length < 3) return "";
  return sanitizeCustomerFacingText(s).slice(0, 400);
}

/**
 * Known Comments-column starters — longer phrases first so we don't split
 * "Registration issued or renewed" into title + "or renewed".
 */
const HISTORY_COMMENT_START =
  /\b(Registration\s+issued\s+or\s+renewed|Title\s+issued\s+or\s+updated|Title\s+or\s+registration\s+issued|Passed\s+Ontario\s+safety\s+standards\s+inspection|Passed\s+safety\s+inspection|Vehicle\s+purchase\s+reported|Vehicle\s+manufactured(?:\s+and\s+shipped\s+to\s+original\s+dealer)?|Vehicle\s+exported(?:\s+from\s+\w+(?:\s+\w+)?)?(?:\s+and\s+imported\s+to\s+\w+)?|Vehicle\s+declared(?:\s+to\s+meet[^.]{0,60})?|Odometer\s+reading\s+reported|Odometer\s+reported(?:\s+as\s+[\d,]+\s+kilometers?)?|New\s+owner\s+reported|First\s+owner\s+reported|Pre-delivery\s+inspection(?:\s+completed)?|Maintenance\s+inspection(?:\s+completed)?|Vehicle\s+serviced|Vehicle\s+sold|Undercoating(?:\/rustproofing)?(?:\s+applied)?|Registered\s+as(?:\s+personal(?:\s+lease)?\s+vehicle)?|Titled\s+or\s+registered(?:\s+as\s+personal(?:\s+lease)?\s+vehicle)?|Oil\s+and\s+filter\s+changed|Brake\s+pads?\s+replaced|Rear\s+brake\s+pads?\s+replaced|Rear\s+brake\s+rotor\(s\)\s+replaced|Brakes?\s+checked|Brakes?\s+serviced|Tire\(s\)\s+changed|Tire\(s\)\s+mounted|Four\s+tires\s+mounted|Spark\s+plug\(s\)\s+replaced|Ignition\s+coil\(s\)\s+replaced|Water\s+pump(?:\s+gasket)?\s+replaced|Thermostat\s+replaced|Engine\s+timing\/front\s+cover\s+gasket\s+replaced|Serpentine\s+belt\s+replaced|Cabin\s+air\s+filter\s+replaced\/cleaned|Registration\s+issued|Title\s+issued)\b/i;

/** PDF Source column → location (never description / never next-row dealer). */
export function extractHistoryLocation(rest: string): string {
  // Table header "Source Comments" must not become location "Comments"
  const labeled = rest.match(/\bSource\s*[:#]?\s*([^\n]{2,90})/i);
  if (labeled?.[1]) {
    const cand = labeled[1].trim();
    if (!TABLE_HEADER_NOISE.test(cand.split(/\s+/)[0] ?? "")) {
      const loc = cleanHistoryLocation(cand);
      if (loc) return loc;
    }
  }

  let afterOdo = rest.replace(
    /^\s*(?:[\d,]{1,7}\s*(?:miles?|mi|km|kilometers?|kilometres?)|not\s+reported)\b\s*/i,
    "",
  );
  const cm = afterOdo.match(HISTORY_COMMENT_START);
  const sourceBlob =
    cm && cm.index != null && cm.index > 0
      ? afterOdo.slice(0, cm.index)
      : "";

  if (sourceBlob) {
    return cleanHistoryLocation(sourceBlob);
  }

  return cleanHistoryLocation(afterOdo);
}

/**
 * Comments column → titleStatus + description.
 * Only "Vehicle serviced" uses titleStatus; registry/admin events stay description-only
 * and never absorb shop-work bullets (those belong on a prior Vehicle serviced row).
 */
export function splitEventComment(rest: string): {
  titleStatus: string;
  description: string;
  orphanWork: string[];
} {
  let afterOdo = rest.replace(
    /^\s*(?:[\d,]{1,7}\s*(?:miles?|mi|km|kilometers?|kilometres?)|not\s+reported)\b\s*/i,
    "",
  );
  const cm = afterOdo.match(HISTORY_COMMENT_START);
  let commentsRaw = cm && cm.index != null ? afterOdo.slice(cm.index) : afterOdo;
  commentsRaw = stripDealerCardJunk(commentsRaw);

  const hitRaw = commentsRaw.match(HISTORY_COMMENT_START);
  const rawBullets = commentsRaw
    .split(/\s*-\s+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 2);

  if (hitRaw && hitRaw.index != null && hitRaw.index < 80) {
    let eventPhrase = sanitizeCustomerFacingText(
      (hitRaw[1] ?? hitRaw[0] ?? "").replace(/\s+/g, " ").trim(),
    );
    if (/^registration\s+issued$/i.test(eventPhrase) && /\bregistration\s+issued\s+or\s+renewed\b/i.test(rest)) {
      eventPhrase = "Registration issued or renewed";
    }
    if (/^title\s+issued$/i.test(eventPhrase) && /\btitle\s+issued\s+or\s+updated\b/i.test(rest)) {
      eventPhrase = "Title issued or updated";
    }
    if (/^passed\s+ontario\b/i.test(eventPhrase) || /^passed\s+safety\b/i.test(eventPhrase)) {
      if (/\bpassed\s+ontario\s+safety\s+standards\s+inspection\b/i.test(rest)) {
        eventPhrase = "Passed Ontario safety standards inspection";
      } else if (/\bpassed\s+safety\s+inspection\b/i.test(rest)) {
        eventPhrase = "Passed safety inspection";
      }
    }

    const afterEvent = commentsRaw.slice((hitRaw.index ?? 0) + (hitRaw[0]?.length ?? 0));
    const detailBullets = uniqueBullets(
      [
        ...afterEvent.split(/\s*-\s+/),
        ...rawBullets.slice(1),
      ]
        .map((p) => sanitizeCustomerFacingText(stripDealerCardJunk(p.replace(/\s+/g, " ").trim())))
        .filter((p) => isUsefulDetailBullet(p) && !isNonServiceNoiseBullet(p)),
    );
    const workBullets = filterServiceWorkBullets(detailBullets);

    // Vehicle serviced → short title + work details in description
    if (/^vehicle\s+serviced$/i.test(eventPhrase)) {
      return {
        titleStatus: "Vehicle serviced",
        description: workBullets.join(" · ").slice(0, 400),
        orphanWork: [],
      };
    }

    // Registry / admin / ownership: description = event only.
    // Shop-work that PDF dumped here is orphaned for a prior Vehicle serviced row.
    if (isAdminOrRegistryEvent(eventPhrase)) {
      return {
        titleStatus: "",
        description: eventPhrase.slice(0, 400),
        orphanWork: workBullets,
      };
    }

    return {
      titleStatus: "",
      description: uniqueBullets([eventPhrase, ...detailBullets.filter((p) => !filterServiceWorkBullets([p]).length)]).join(" · ").slice(0, 400),
      orphanWork: workBullets,
    };
  }

  // No known event starter — if the blob is mostly shop work, orphan it
  const cleaned = cleanHistoryNote(commentsRaw);
  const workOnly = filterServiceWorkBullets(
    (cleaned || "")
      .split(/\s*·\s*/)
      .map((p) => p.trim())
      .filter(Boolean),
  );
  if (workOnly.length > 0 && workOnly.join(" ").length >= (cleaned?.length ?? 0) * 0.5) {
    return { titleStatus: "", description: "", orphanWork: workOnly };
  }
  if (!cleaned) return { titleStatus: "", description: "", orphanWork: [] };
  return { titleStatus: "", description: cleaned.slice(0, 400), orphanWork: [] };
}

function isAdminOrRegistryEvent(phrase: string): boolean {
  return /\b(?:registration\s+issued|title\s+issued|title\s+or\s+registration|odometer\s+reading\s+reported|odometer\s+reported|passed\s+ontario|passed\s+safety|new\s+owner\s+reported|first\s+owner\s+reported|vehicle\s+purchase\s+reported|vehicle\s+sold|vehicle\s+manufactured|vehicle\s+exported|vehicle\s+declared|registered\s+as|titled\s+or\s+registered)\b/i.test(
    phrase,
  );
}

/** Ownership / title / import lines — never "what was serviced". */
function isNonServiceNoiseBullet(p: string): boolean {
  return /\b(?:vehicle\s+importer|vehicle\s+manufacturer|vehicle\s+exported|vehicle\s+imported|imported\s+to|exported\s+from|from\s+michigan|new\s+owner\s+reported|first\s+owner\s+reported|title\s+issued|title\s+or\s+registration|registration\s+issued|titled\s+or\s+registered|registered\s+as\s+personal|vehicle\s+purchase\s+reported|vehicle\s+sold|vehicle\s+manufactured|vehicle\s+declared|pre-?delivery\s+inspection|personal\s+lease)\b/i.test(
    p,
  );
}

function filterServiceWorkBullets(bullets: string[]): string[] {
  return bullets.filter(
    (p) =>
      !isNonServiceNoiseBullet(p)
      && /\b(?:brake|tire|oil|filter|spark|ignition|water\s+pump|thermostat|serpentine|cabin|undercoat|washed|mounted|replaced|changed|checked|serviced|gasket|coil|rotor|pad|alignment|battery|fluid)\b/i.test(
        p,
      ),
  );
}

function isUsefulDetailBullet(p: string): boolean {
  if (!p || p.length < 3) return false;
  if (/^[\d.]+$/.test(p)) return false;
  if (TABLE_HEADER_NOISE.test(p)) return false;
  if (/^or\s+renewed$/i.test(p) || /^or\s+updated$/i.test(p)) return false;
  if (/^(?:have questions|consumers|dealers|this report|follow us)\b/i.test(p)) return false;
  // Drop Canadian km restatements / color notes — never service work
  if (/\bodometer\s+reported\s+as\b/i.test(p)) return false;
  if (/^vehicle\s+color\s+noted\b/i.test(p)) return false;
  return true;
}

function uniqueBullets(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const k = item.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

/** Recent Service Highlights → date → detail bullets (PDF dumps these separately). */
export function parseRecentServiceHighlights(text: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const start = text.search(/\bRecent\s+Service\s+Highlights\b/i);
  if (start < 0) return map;
  const endMatch = text.slice(start).search(/\bAdditional\s+History\b|\bDetailed\s+History\b/i);
  const scope = text.slice(start, endMatch > 0 ? start + endMatch : start + 1200);

  const KNOWN = [
    "Brakes checked",
    "Brake pads replaced",
    "Rear brake pads replaced",
    "Rear brake rotor(s) replaced",
    "Front brake pads replaced",
    "Front brakes replaced",
    "Tire(s) changed",
    "Tire(s) mounted",
    "Four tires mounted",
    "Oil and filter changed",
    "Spark plug(s) replaced",
    "Undercoating/rustproofing applied",
  ];

  for (const m of scope.matchAll(new RegExp(`(${DATE_TOKEN})`, "gi"))) {
    const date = toIsoDate(m[1]!);
    const before = scope.slice(Math.max(0, (m.index ?? 0) - 220), m.index ?? 0);
    const found = KNOWN.filter((d) => new RegExp(escapeRe(d), "i").test(before));
    if (found.length > 0) {
      map.set(date, uniqueBullets([...(map.get(date) ?? []), ...found]));
    }
  }
  return map;
}

/** Trailing " - " service bullets dumped after dates (PDF column reorder). */
export function extractDeferredServiceBullets(text: string): string[] {
  const detailedIdx = text.search(/\bDetailed\s+History\b/i);
  const scope = detailedIdx >= 0 ? text.slice(detailedIdx) : text;
  const gloss = scope.search(/\bFull\s+Glossary\b|\bI have reviewed and received\b/i);
  const body = gloss > 0 ? scope.slice(0, gloss) : scope;

  // Only the end dump (after Have Questions or last ~900 chars) — not every historic " - " line
  let tail = body;
  const hq = body.search(/\bHave Questions\?/i);
  if (hq >= 0) {
    tail = body.slice(hq);
  } else {
    tail = body.slice(Math.max(0, body.length - 900));
  }

  const chunks = tail.split(/\s*-\s+/);
  const SERVICE_LINE =
    /\b(?:brakes?\s+checked|brakes?\s+serviced|brake\s+pads?|rear\s+brake|front\s+brake|tire\(s\)|oil\s+and\s+filter|spark\s+plug|ignition\s+coil|water\s+pump|thermostat|serpentine|cabin\s+air|undercoating|engine\s+timing|four\s+tires|vehicle\s+washed)\b/i;

  return uniqueBullets(
    chunks
      .map((c) => sanitizeCustomerFacingText(stripDealerCardJunk(c.replace(/\s+/g, " ").trim())))
      .filter(
        (c) =>
          c.length >= 5
          && c.length <= 90
          && SERVICE_LINE.test(c)
          && isUsefulDetailBullet(c)
          && !isNonServiceNoiseBullet(c),
      ),
  );
}

type HistoryHit = {
  date: string;
  titleStatus: string;
  description: string;
  odometerKm: string;
  location: string;
  raw: string;
};

function yearFromIsoDate(iso: string): number | null {
  const m = iso.match(/^(\d{4})-/);
  if (!m) return null;
  const y = Number(m[1]);
  return Number.isFinite(y) ? y : null;
}

/**
 * Read odometer from the Carfax/AutoCheck **Mileage column** only.
 * - `not reported` → no reading (do not invent one from comments)
 * - Leading `123,859 mi` / `12 km` → column value
 * - Never use Canadian comment notes like `Odometer reported as 174,068 kilometers`
 *   (those are conversions of *other* rows, dumped onto the wrong date by PDF extract)
 */
export function extractHistoryOdometerKm(
  rest: string,
  isoDate?: string,
): string {
  const trimmed = rest.trim();
  if (!trimmed) return "";
  if (/^not\s+reported\b/i.test(trimmed)) return "";

  const accept = (rawNum: string, unit: string, snippet: string): string => {
    const n = parseOdometerNumber(rawNum);
    if (n == null || n < 0) return "";
    const dateYear = isoDate ? yearFromIsoDate(isoDate) : null;
    if (dateYear != null && n === dateYear) return "";
    const digits = rawNum.replace(/,/g, "");
    if (/^(?:19|20)\d{2}$/.test(digits) && n === Number(digits) && n <= 2100) {
      if (n >= 1900 && n <= 2100 && !rawNum.includes(",")) {
        if (dateYear != null && Math.abs(n - dateYear) < 2) return "";
      }
    }
    return String(readingToKm(n, unit || unitHintFromSnippet(snippet)));
  };

  // Mileage column is the first token(s) after the date
  const leading = trimmed.match(
    /^([\d,]{1,7})\s*(miles?|mi|km|kilometers?|kilometres?)\b/i,
  );
  if (leading) {
    const km = accept(leading[1]!, leading[2]!, leading[0]!);
    if (km) return km;
  }

  // Synthetic / non-column layouts (e.g. "… Registration 12 km Source:")
  for (const m of trimmed.matchAll(
    /\b([\d,]{1,7})\s*(miles?|mi|km|kilometers?|kilometres?)\b/gi,
  )) {
    const idx = m.index ?? 0;
    const before = trimmed.slice(Math.max(0, idx - 32), idx);
    if (/odometer\s+reported\s+as\s*$/i.test(before)) continue;
    const after = trimmed.slice(idx);
    if (/^[\d,]+\s*miles?\s+service\b/i.test(after)) continue;
    const km = accept(m[1]!, m[2]!, m[0]!);
    if (km) return km;
  }
  return "";
}

function parseHistoryBlocks(text: string): HistoryHit[] {
  let scope = text;
  const detailedIdx = text.search(/\bDetailed\s+History\b/i);
  if (detailedIdx >= 0) scope = text.slice(detailedIdx);

  const highlights = parseRecentServiceHighlights(text);
  const deferredBullets = extractDeferredServiceBullets(text);

  const cut = scope.search(
    /\b(?:Full\s+Glossary|I have reviewed and received|©\s*\d{4}\s+CARFAX)\b/i,
  );
  const parseScope = cut > 200 ? scope.slice(0, cut) : scope;

  const hits: HistoryHit[] = [];
  const pendingOrphans: { beforeIndex: number; bullets: string[] }[] = [];
  const dateRe = new RegExp(`(${DATE_TOKEN})`, "gi");
  const dates = [...parseScope.matchAll(dateRe)];
  for (let i = 0; i < dates.length; i++) {
    const dm = dates[i]!;
    const dateRaw = dm[1]!;
    const date = toIsoDate(dateRaw);
    const start = (dm.index ?? 0) + dateRaw.length;
    const end = i + 1 < dates.length ? (dates[i + 1]!.index ?? parseScope.length) : parseScope.length;
    let rest = parseScope.slice(start, end).replace(/\s+/g, " ").trim();
    if (rest.length < 4) continue;
    if (rest.length > 420) rest = rest.slice(0, 420);

    const odometerKm = extractHistoryOdometerKm(rest, date);
    const location = extractHistoryLocation(rest);
    const split = splitEventComment(rest);
    let { titleStatus, description } = split;
    if (split.orphanWork.length > 0) {
      pendingOrphans.push({ beforeIndex: hits.length, bullets: split.orphanWork });
    }

    const highlightBullets = highlights.get(date) ?? [];
    if (highlightBullets.length > 0) {
      if (!titleStatus || /^vehicle\s+serviced$/i.test(titleStatus)) {
        titleStatus = titleStatus || "Vehicle serviced";
      }
      description = uniqueBullets([
        ...description.split(/\s*·\s*/).filter(Boolean),
        ...highlightBullets,
      ]).join(" · ").slice(0, 400);
    }

    hits.push({ date, titleStatus, description, odometerKm, location, raw: rest });
    if (hits.length >= 80) break;
  }

  // Shop-work that landed on registration/odometer rows → prior empty Vehicle serviced
  for (const { beforeIndex, bullets } of pendingOrphans) {
    attachWorkToPriorVehicleServiced(hits, beforeIndex, bullets);
  }

  // End-of-report deferred bullets → latest empty Vehicle serviced (else last Vehicle serviced)
  if (deferredBullets.length > 0) {
    let attached = false;
    for (const date of highlights.keys()) {
      const idx = hits.findIndex(
        (x) => x.date === date && /vehicle\s+serviced/i.test(`${x.titleStatus} ${x.raw}`),
      );
      if (idx >= 0) {
        const h = hits[idx]!;
        h.description = uniqueBullets([
          ...h.description.split(/\s*·\s*/).filter(Boolean),
          ...deferredBullets,
        ]).join(" · ").slice(0, 400);
        if (!h.titleStatus) h.titleStatus = "Vehicle serviced";
        attached = true;
        break;
      }
    }
    if (!attached) {
      attachWorkToPriorVehicleServiced(hits, hits.length, deferredBullets);
    }
  }

  // Do NOT clone one visit's work onto every empty same-shop row — that fabricates
  // identical spark-plug/water-pump descriptions across unrelated dates.

  return hits;
}

/** Attach shop-work bullets to the nearest prior Vehicle serviced row (prefer empty description). */
function attachWorkToPriorVehicleServiced(
  hits: HistoryHit[],
  beforeIndex: number,
  bullets: string[],
): void {
  if (bullets.length === 0) return;
  let emptyIdx = -1;
  let anyIdx = -1;
  for (let j = Math.min(beforeIndex, hits.length) - 1; j >= 0; j--) {
    const h = hits[j]!;
    if (!/^vehicle\s+serviced$/i.test(h.titleStatus) && !/\bvehicle\s+serviced\b/i.test(h.raw)) {
      continue;
    }
    if (anyIdx < 0) anyIdx = j;
    if (!h.description.trim()) {
      emptyIdx = j;
      break;
    }
  }
  const idx = emptyIdx >= 0 ? emptyIdx : anyIdx;
  if (idx < 0) return;
  const h = hits[idx]!;
  h.titleStatus = "Vehicle serviced";
  h.description = uniqueBullets([
    ...h.description.split(/\s*·\s*/).filter(Boolean),
    ...bullets,
  ]).join(" · ").slice(0, 400);
}

function isAccidentish(raw: string): boolean {
  return /\b(accident|collision|damage|crash|hit|rear.?end|front.?end|side.?impact|airbag|structural)\b/i.test(raw);
}

function isServiceish(raw: string): boolean {
  if (isNonServiceNoiseBullet(raw)) return false;
  if (/\bvehicle\s+serviced\b/i.test(raw)) return true;
  return false;
}

function isMileageEvent(raw: string, odometerKm: string): boolean {
  if (!odometerKm) return false;
  return (
    isServiceish(raw)
    || /\b(odometer|mileage|inspection|registration|renewal|emission|smog|title\/registration|reported|reading|passed\s+ontario|passed\s+safety)\b/i.test(raw)
    || /\b[\d,]{1,7}\s*(miles?|mi|km|kilometers?)\b/i.test(raw)
  );
}

/** Strong ownership signals only — not every title/registration renewal. */
function isOwnerish(raw: string): boolean {
  return /\b(?:new\s+owner\s+reported|first\s+owner\s+reported|vehicle\s+purchase\s+reported)\b/i.test(
    raw,
  );
}

/**
 * Owner history: leave empty unless we have a real dated ownership event.
 * Never invent YYYY-01-01 from "Owner N Purchased: YEAR". ownerCount is enough.
 */
function buildOwners(
  _text: string,
  hits: HistoryHit[],
  ownerCount: string,
): CatalogOwnerForm[] {
  void ownerCount;
  const rows = hits
    .filter((h) => isOwnerish(h.raw) && Boolean(h.date))
    .map((h) => ({
      ...EMPTY_OWNER,
      date: h.date,
      location: cleanHistoryLocation(h.location),
      mileage: h.odometerKm,
      condition: "",
      lotStatus: "",
    }));

  // Prefer empty — "new owner reported" without clear purchase context is noisy
  if (rows.length === 0) return [];
  // Still skip inventing rows; only keep hits that also look like purchase (not every new owner line)
  const purchases = rows.filter((r) => {
    const hit = hits.find((h) => h.date === r.date && h.odometerKm === r.mileage);
    return hit && /\bvehicle\s+purchase\s+reported\b/i.test(hit.raw);
  });
  return sortHistoryNewestFirst(purchases).slice(0, 10);
}

function buildAccidents(hits: HistoryHit[], text: string): CatalogAccidentForm[] {
  const fromHits = hits
    .filter((h) => isAccidentish(h.raw))
    .map((h) => ({
      ...EMPTY_ACCIDENT,
      date: h.date,
      description: sanitizeCustomerFacingText(
        [h.titleStatus, h.description].filter(Boolean).join(" · ") || "Accident / damage reported",
      ),
      location: cleanHistoryLocation(h.location),
      type: /flood|water/i.test(h.raw) ? "flood" : "collision",
      severity: /severe|major|structural/i.test(h.raw)
        ? "major"
        : /minor|cosmetic/i.test(h.raw)
          ? "minor"
          : "",
      odometerAtLoss: h.odometerKm,
      currency: "USD",
    }));

  if (fromHits.length > 0) {
    return sortHistoryNewestFirst(fromHits);
  }

  if (/\bno\s+accidents?\s+(?:reported|found)\b/i.test(text)) return [];
  return [];
}

/** Highest mileage first (then newest date). */
function sortMileageHighestFirst(rows: CatalogMileageForm[]): CatalogMileageForm[] {
  return [...rows].sort((a, b) => {
    const oa = Number(a.odometer) || 0;
    const ob = Number(b.odometer) || 0;
    if (ob !== oa) return ob - oa;
    return sortHistoryNewestFirst([a, b])[0] === a ? -1 : 1;
  });
}

function buildMileage(hits: HistoryHit[], latestKm: string): CatalogMileageForm[] {
  const rows = hits
    .filter((h) => h.odometerKm && isMileageEvent(h.raw, h.odometerKm))
    .map((h) => ({
      ...EMPTY_MILEAGE,
      date: h.date,
      odometer: h.odometerKm,
      unit: "km",
      source: "",
      location: cleanHistoryLocation(h.location),
      titleStatus: sanitizeCustomerFacingText(h.titleStatus),
      description: sanitizeCustomerFacingText(h.description),
    }));

  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    const k = `${r.date}|${r.odometer}|${r.titleStatus}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (unique.length === 0 && latestKm) {
    return [{
      ...EMPTY_MILEAGE,
      odometer: latestKm,
      unit: "km",
      source: "",
      description: "",
    }];
  }
  return sortMileageHighestFirst(unique).slice(0, 50);
}

function buildServices(hits: HistoryHit[]): CatalogServiceForm[] {
  const rows = hits
    .filter((h) => {
      if (/\bvehicle\s+serviced\b/i.test(`${h.titleStatus} ${h.raw}`)) return true;
      if (isNonServiceNoiseBullet(h.raw)) return false;
      return /\b(?:oil\s+(?:change|and\s+filter)|brake\s+pads?\s+replaced|tire\(s\)\s+(?:changed|mounted)|spark\s+plug)/i.test(
        h.raw,
      );
    })
    .map((h) => {
      const isVehicleServiced = /\bvehicle\s+serviced\b/i.test(`${h.titleStatus} ${h.raw}`);
      const work = filterServiceWorkBullets(
        [
          ...h.description.split(/\s*·\s*/),
          ...(isVehicleServiced ? [] : [cleanHistoryNote(h.raw) || h.titleStatus]),
        ]
          .map((p) => sanitizeCustomerFacingText(String(p).replace(/\s+/g, " ").trim()))
          .filter(Boolean),
      );
      // Pull a short title from the work line when PDF didn't say "Vehicle serviced"
      let title = isVehicleServiced ? "Vehicle serviced" : "";
      let description = work.join(" · ");
      if (!title && work.length > 0) {
        title = work[0]!.slice(0, 80);
        description = work.slice(1).join(" · ");
      }
      if (!title) title = "Service";

      return {
        ...EMPTY_SERVICE,
        date: h.date,
        mileage: h.odometerKm,
        title,
        location: cleanHistoryLocation(h.location),
        description: description.slice(0, 400),
      };
    })
    .filter((r) => {
      if (/vehicle\s+importer|vehicle\s+exported|from\s+michigan/i.test(`${r.location} ${r.description} ${r.title}`)) {
        return false;
      }
      if (!r.date) return false;
      return Boolean(r.mileage || r.description || /^vehicle\s+serviced$/i.test(r.title));
    });

  return sortHistoryNewestFirst(rows).slice(0, 50);
}

/** Latest = highest odometer among header + history readings. */
export function resolveLatestOdometerKm(
  headerKm: string,
  mileageRows: CatalogMileageForm[],
): string {
  let max = 0;
  const header = Number(headerKm);
  if (Number.isFinite(header) && header > max) max = header;
  for (const row of mileageRows) {
    const n = Number(row.odometer);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max > 0 ? String(max) : (headerKm || "");
}

function parseOwnerCount(text: string): string {
  const head = vehicleHeader(text);
  const prev = head.match(/\b(\d{1,2})\s+Previous\s+Owners?\b/i);
  if (prev?.[1]) return prev[1];
  const m = head.match(
    /(?:number\s+of\s+owners|owner\s+count|owners?\s*(?:reported)?)\s*[:#]?\s*(\d{1,2})\b/i,
  );
  if (m?.[1]) return m[1];
  const alt = head.match(/\b(\d{1,2})\s+owners?\b/i);
  if (alt?.[1]) return alt[1];
  // Count Owner N Purchased headers
  const sections = [...text.matchAll(/\bOwner\s+(\d+)\s+Purchased:/gi)];
  if (sections.length > 0) return String(sections.length);
  return "";
}

function parseAccidentCount(text: string, accidents: CatalogAccidentForm[]): string {
  if (/\bno\s+accidents?\s+(?:reported|found)\b/i.test(text)) return "0";
  const m = vehicleHeader(text).match(
    /(?:accidents?\s*(?:reported|found|count)?|accident\s+count)\s*[:#]?\s*(\d{1,2})\b/i,
  );
  if (m?.[1]) return m[1];
  if (accidents.length > 0) return String(accidents.length);
  return "";
}

function emptyFormWithoutPhotos(): Omit<VinCatalogFormState, "photos"> {
  return {
    make: "",
    model: "",
    year: "",
    trim: "",
    engine: "",
    transmission: "",
    fuelType: "",
    bodyType: "",
    color: "",
    country: "",
    odometer: "",
    ownerCount: "",
    accidentCount: "",
    hp: "",
    cylinders: "",
    titleStatus: "",
    isSalvage: false,
    isStolen: false,
    isTaxi: false,
    isFlooded: false,
    floodCount: "",
    floodLossAmount: "",
    accidents: [],
    insuranceClaims: [],
    mileageHistory: [],
    serviceHistory: [],
    ownerHistory: [],
    auctionHistory: [],
    registryHistory: [],
    marketData: { ...EMPTY_MARKET_DATA },
  };
}

/**
 * Parse extracted PDF text into form fields.
 * @param expectedVin — pending VIN; mismatch fails the parse.
 */
export function parseProviderPdfText(
  rawText: string,
  expectedVin: string,
): ProviderPdfParseResult {
  const text = normalizeWs(rawText);
  if (text.replace(/\s+/g, "").length < 40) {
    return {
      ok: false,
      error: "Could not read text from this PDF (it may be a scanned image). Use a text-based vehicle history PDF.",
    };
  }

  const provider = detectProviderPdfKind(text);
  const vins = extractVinsFromText(text);
  const expected = expectedVin.trim().toUpperCase();
  const vinFound = vins.find((v) => v === expected) ?? vins[0] ?? null;

  if (vins.length > 0 && expected && !vins.includes(expected)) {
    return {
      ok: false,
      error: `PDF VIN (${vins[0]}) does not match this pending VIN (${expected}).`,
    };
  }

  const head = vehicleHeader(text);
  const year = parseYear(head);
  const make = parseMake(head);
  const model = parseModel(head, make);
  const transmission = parseTransmission(head);
  const fuelType = parseFuel(head);
  const bodyType = parseBody(head);
  const engine = parseEngine(head);
  const country = parseVehicleCountry(text);

  const odometerHeader = parseOdometerKm(text);
  const hits = parseHistoryBlocks(text);
  const accidents = buildAccidents(hits, text);
  const ownerCount = parseOwnerCount(text) || parseIntField(head, ["Owners?"]);
  const accidentCount = parseAccidentCount(text, accidents);
  const mileageHistory = buildMileage(hits, odometerHeader);
  const serviceHistory = buildServices(hits);
  const ownerHistory = buildOwners(text, hits, ownerCount);
  const odometer = resolveLatestOdometerKm(odometerHeader, mileageHistory);

  const isSalvage = boolFlag(text, [
    /\bsalvage\s+title\b/i,
    /\btitle\s+brand[:\s]+salvage\b/i,
    /\breported\s+as\s+salvage\b/i,
  ]);
  const isFlooded = boolFlag(text, [
    /\bflood\s+damage\b/i,
    /\bwater\s+damage\b/i,
    /\bflood\s+title\b/i,
  ]);
  const isStolen = boolFlag(text, [
    /\bstolen\s+(?:vehicle|report|status)\b/i,
    /\btheft\s+record\b/i,
  ]);
  const isTaxi = boolFlag(text, [
    /\btaxi\s+use\b/i,
    /\brideshare\b/i,
  ]);

  const form: Omit<VinCatalogFormState, "photos"> = {
    ...emptyFormWithoutPhotos(),
    year,
    make: make.slice(0, 40),
    model: model.slice(0, 60),
    trim: "",
    engine,
    transmission,
    fuelType,
    bodyType,
    color: "",
    country,
    odometer,
    ownerCount,
    accidentCount,
    hp: parseHp(head),
    cylinders: parseCylinders(head) || (engine.match(/\b(?:V|I|W)(\d)\b/i)?.[1] ?? ""),
    titleStatus: parseTitleStatus(head),
    isSalvage,
    isStolen,
    isTaxi,
    isFlooded,
    floodCount: isFlooded ? "1" : "",
    accidents,
    mileageHistory,
    serviceHistory,
    ownerHistory,
  };

  const summary: string[] = [];
  if (provider !== "unknown") summary.push("Detected vehicle history PDF");
  else summary.push("Provider not clearly detected — best-effort parse");
  if (form.year || form.make || form.model) {
    summary.push([form.year, form.make, form.model].filter(Boolean).join(" "));
  }
  if (form.engine) summary.push(form.engine);
  if (form.odometer) summary.push(`Odometer ${form.odometer} km`);
  if (form.accidents.length) summary.push(`${form.accidents.length} accident(s)`);
  if (form.mileageHistory.length) summary.push(`${form.mileageHistory.length} mileage row(s)`);
  if (form.serviceHistory.length) summary.push(`${form.serviceHistory.length} service(s)`);
  if (form.ownerHistory.length) summary.push(`${form.ownerHistory.length} owner row(s)`);

  return { ok: true, provider, vinFound, form, summary };
}
