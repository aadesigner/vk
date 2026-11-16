import type { Language } from "@/i18n/context";
import { formatCountryName } from "@/lib/format-country-name";
import { formatKoreanWonFromText, isKoreanCountry } from "@/lib/korean-currency";
import { sanitizeReportIsoDate } from "@/lib/encar-date-repair";
import { isRegistryRepairCostLabel, sanitizeKoreanRepairAmountText } from "@workspace/korean-registry";

const LOCALE_BY_LANG: Record<Language, string> = {
  en: "en-US",
  de: "de-DE",
  es: "es-ES",
  fr: "fr-FR",
  sq: "sq-AL",
  pl: "pl-PL",
  ro: "ro-RO",
  bg: "bg-BG",
  ka: "ka-GE",
  ar: "ar",
  uk: "uk-UA",
  ru: "ru-RU",
  zh: "zh-CN",
};

/** Albanian month names — Intl sq-AL is missing in some browsers; manual labels match sq.json tone. */
const SQ_MONTHS_LONG = [
  "janar", "shkurt", "mars", "prill", "maj", "qershor",
  "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor",
] as const;

/** Compact chart axis labels (Intl short months often stay English for sq). */
const SQ_MONTHS_SHORT = [
  "jan", "shk", "mar", "pri", "maj", "qer",
  "kor", "gus", "sht", "tet", "nën", "dhj",
] as const;

function isSqLocale(locale: string): boolean {
  return locale === LOCALE_BY_LANG.sq || locale.startsWith("sq");
}

function formatSqLocalizedDate(parts: { month: number; day: number; year?: number }): string {
  const monthName = SQ_MONTHS_LONG[parts.month];
  if (!monthName) return "";
  if (parts.year != null) {
    if (parts.day === 1) return `${monthName} ${parts.year}`;
    return `${parts.day} ${monthName} ${parts.year}`;
  }
  return `${parts.day} ${monthName}`;
}

function formatSqLocalizedMonthYear(year: number, month: number): string {
  const monthName = SQ_MONTHS_LONG[month];
  return monthName ? `${monthName} ${year}` : "";
}

/** True when a date string is only digits and separators (no localized month letters). */
function looksNumericOnlyDate(text: string): boolean {
  const t = text.trim();
  if (!t || /[A-Za-z\u0400-\u04FF\u0600-\u06FF]/.test(t)) return false;
  return /^[\d./:\-\s]+$/.test(t);
}

const MONTH_INDEX: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

function monthIndex(name: string): number {
  return MONTH_INDEX[name.toLowerCase()] ?? -1;
}

function formatLocalizedDate(
  locale: string,
  parts: { month: number; day: number; year?: number },
): string {
  if (isSqLocale(locale)) {
    const manual = formatSqLocalizedDate(parts);
    if (manual) return manual;
  }
  const date = new Date(parts.year ?? 2000, parts.month, parts.day);
  if (parts.year != null) {
    return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" }).format(date);
  }
  return new Intl.DateTimeFormat(locale, { month: "long", day: "numeric" }).format(date);
}

function formatLocalizedMonthYear(
  locale: string,
  year: number,
  month: number,
): string {
  if (isSqLocale(locale)) {
    const manual = formatSqLocalizedMonthYear(year, month);
    if (manual) return manual;
  }
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(new Date(year, month, 1));
}

/** Re-format from a repaired ISO string when Intl or fallbacks left English month names. */
function formatIsoForLocale(
  locale: string,
  iso: string,
): string | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  if (day === 1) return formatLocalizedMonthYear(locale, year, month);
  return formatIsoDateParts(locale, year, month, day);
}

function ensureNoEnglishMonths(
  text: string,
  language: Language,
  repairedIso?: string | null,
): string {
  if (language === "en" || !containsEnglishMonth(text)) return text;
  if (repairedIso) {
    const fromIso = formatIsoForLocale(LOCALE_BY_LANG[language], repairedIso);
    if (fromIso && !containsEnglishMonth(fromIso)) return fromIso;
  }
  const fromText = translateProviderDateInText(text, language);
  if (fromText && !containsEnglishMonth(fromText)) return fromText;
  const isoInText = text.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1];
  if (isoInText) {
    const fromIso = formatIsoForLocale(LOCALE_BY_LANG[language], isoInText);
    if (fromIso && !containsEnglishMonth(fromIso)) return fromIso;
  }
  return text;
}

function normalizeProviderDateText(text: string): string {
  return text.trim().replace(/\u00a0/g, " ").replace(/\s+/g, " ");
}

export function isUsVehicleCountry(country?: string | null): boolean {
  if (!country) return false;
  const norm = country.trim().toLowerCase();
  return norm === "us" || norm === "usa" || norm === "united states" || norm === "united states of america";
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export type NumericDateParts = { day: number; month: number; year: number };

/** Parse fully numeric day+month+year strings (month is 1–12). */
export function parseNumericDayMonthYear(
  text: string,
  opts?: { assumeUsSlashOrder?: boolean },
): NumericDateParts | null {
  const trimmed = normalizeProviderDateText(text);

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s][\d:.+-]+Z?)?$/i);
  if (iso) {
    return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
  }

  const compact = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    return { year: Number(compact[1]), month: Number(compact[2]), day: Number(compact[3]) };
  }

  const dottedIso = trimmed.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (dottedIso) {
    return { year: Number(dottedIso[1]), month: Number(dottedIso[2]), day: Number(dottedIso[3]) };
  }

  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    if (opts?.assumeUsSlashOrder) {
      return { month: Number(slash[1]), day: Number(slash[2]), year: Number(slash[3]) };
    }
    return { day: Number(slash[1]), month: Number(slash[2]), year: Number(slash[3]) };
  }

  const sep = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (sep) {
    if (opts?.assumeUsSlashOrder) {
      return { month: Number(sep[1]), day: Number(sep[2]), year: Number(sep[3]) };
    }
    return { day: Number(sep[1]), month: Number(sep[2]), year: Number(sep[3]) };
  }

  return null;
}

export function formatDayMonthYearNumeric(day: number, month: number, year: number): string {
  return `${pad2(day)}/${pad2(month)}/${year}`;
}

export function formatNumericDateAsDayMonthYear(
  text: string,
  opts?: { assumeUsSlashOrder?: boolean },
): string | null {
  const parts = parseNumericDayMonthYear(text, opts);
  if (!parts) return null;
  return formatDayMonthYearNumeric(parts.day, parts.month, parts.year);
}

function localizeUsVehicleFullDate(
  date: string,
  vehicleYear?: number | null,
  language?: Language,
): string | null {
  const normalized = normalizeProviderDateText(date);
  const repaired = sanitizeReportIsoDate(normalized, vehicleYear) ?? normalized;
  const numericParts = parseNumericDayMonthYear(repaired, { assumeUsSlashOrder: true });

  if (language === "sq" && numericParts) {
    if (numericParts.day === 1) {
      const my = formatSqLocalizedMonthYear(numericParts.year, numericParts.month - 1);
      if (my) return my;
    }
    const manual = formatSqLocalizedDate({
      month: numericParts.month - 1,
      day: numericParts.day,
      year: numericParts.year,
    });
    if (manual) return manual;
  }

  const numeric = formatNumericDateAsDayMonthYear(repaired, { assumeUsSlashOrder: true });
  if (numeric) return numeric;

  const parsed = parseEnglishMonthDate(repaired);
  if (parsed?.year != null) {
    return formatDayMonthYearNumeric(parsed.day, parsed.month + 1, parsed.year);
  }

  const embedded = repaired.match(/([A-Za-z]{3,12})\s+(\d{1,2}),?\s*(\d{4})/);
  if (embedded) {
    const month = monthIndex(embedded[1]!);
    if (month >= 0) {
      return formatDayMonthYearNumeric(
        parseInt(embedded[2]!, 10),
        month + 1,
        parseInt(embedded[3]!, 10),
      );
    }
  }

  return null;
}

function containsEnglishMonth(text: string): boolean {
  return new RegExp(`\\b${ENGLISH_MONTH_IN_TEXT}\\b`, "i").test(text);
}

export function looksLikeProviderDate(text: string | null | undefined): boolean {
  if (!text) return false;
  const trimmed = normalizeProviderDateText(String(text));
  if (!trimmed) return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return true;
  if (/^\d{8}$/.test(trimmed)) return true;
  if (/^\d{4}-\d{2}$/.test(trimmed)) return true;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) return true;
  if (/^\d{1,2}[./-]\d{1,2}[./-]\d{4}$/.test(trimmed)) return true;
  if (/^\d{4}[./-]\d{1,2}[./-]\d{1,2}/.test(trimmed)) return true;
  return containsEnglishMonth(trimmed);
}

function applyProviderDateInTextReplacements(text: string, language: Language): string {
  const locale = LOCALE_BY_LANG[language];
  const replaceMatch = (match: string) => translateProviderDate(match, language) ?? match;
  const replaceEncarMonthYear = (match: string) => {
    const encar = parseEncarMonthYearLabel(match);
    if (encar) return formatLocalizedMonthYear(locale, encar.year, encar.month);
    return match;
  };

  let result = text;
  result = result.replace(
    new RegExp(`\\b${ENGLISH_MONTH_IN_TEXT}\\s+(19|2[0-9])(?!\\d)`, "gi"),
    replaceEncarMonthYear,
  );
  result = result.replace(
    new RegExp(`\\b${ENGLISH_MONTH_IN_TEXT}\\s+\\d{1,2},?\\s*\\d{4}\\b`, "gi"),
    replaceMatch,
  );
  result = result.replace(
    new RegExp(`\\b\\d{1,2}\\s+${ENGLISH_MONTH_IN_TEXT},?\\s*\\d{4}\\b`, "gi"),
    replaceMatch,
  );
  result = result.replace(
    new RegExp(`\\b${ENGLISH_MONTH_IN_TEXT}\\s+\\d{4}\\b`, "gi"),
    replaceMatch,
  );
  result = result.replace(
    new RegExp(`\\b${ENGLISH_MONTH_IN_TEXT}\\s+\\d{1,2}(?!\\d|,\\s*\\d{4})\\b`, "gi"),
    replaceMatch,
  );
  result = result.replace(/\b\d{4}-\d{2}-\d{2}\b/g, replaceMatch);
  return result;
}

function parseEncarMonthYearLabel(
  text: string,
): { year: number; month: number } | null {
  const m = text.match(/^([A-Za-z]+)\s+(\d{2})$/);
  if (!m) return null;
  const month = monthIndex(m[1]!);
  if (month < 0) return null;
  const nn = parseInt(m[2]!, 10);
  if (nn === 30 || nn === 31) return null;
  if (nn < 19 || nn > 99) return null;
  return { year: 2000 + nn, month };
}

function parseEnglishMonthDate(text: string): { month: number; day: number; year?: number } | null {
  const monthDayYear = text.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})$/);
  if (monthDayYear) {
    const month = monthIndex(monthDayYear[1]!);
    if (month >= 0) {
      return { month, day: parseInt(monthDayYear[2]!, 10), year: parseInt(monthDayYear[3]!, 10) };
    }
  }

  const dayMonthYear = text.match(/^(\d{1,2})\s+([A-Za-z]+),?\s*(\d{4})$/);
  if (dayMonthYear) {
    const month = monthIndex(dayMonthYear[2]!);
    if (month >= 0) {
      return { month, day: parseInt(dayMonthYear[1]!, 10), year: parseInt(dayMonthYear[3]!, 10) };
    }
  }

  const monthDay = text.match(/^([A-Za-z]+)\s+(\d{1,2})$/);
  if (monthDay) {
    const month = monthIndex(monthDay[1]!);
    if (month >= 0) return { month, day: parseInt(monthDay[2]!, 10) };
  }

  const usSlash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usSlash) {
    return {
      month: parseInt(usSlash[1]!, 10) - 1,
      day: parseInt(usSlash[2]!, 10),
      year: parseInt(usSlash[3]!, 10),
    };
  }

  return null;
}

const PHRASE_KEYS: Record<string, string> = {
  "relocation of the party transaction": "provider_txn_party_relocation",
  "transfer of transactions between parties": "provider_txn_between_parties",
  "trader transactions transfer": "provider_txn_trader_transfer",
  "trader transaction transfer": "provider_txn_trader_transfer",
  "transaction transfer between traders": "provider_txn_trader_transfer",
  "used car dealer transaction": "provider_txn_dealer_sale",
  "dealer transaction": "provider_txn_dealer_sale",
  "sale between individuals": "provider_txn_individual_sale",
  "individual transaction": "provider_txn_individual_sale",
  "trade in transaction": "provider_txn_trade_in",
  "regular inspection": "provider_inspection_regular",
  "comprehensive inspection": "provider_inspection_comprehensive",
  "periodic inspection": "provider_inspection_periodic",
  "direct": "provider_flag_direct",
  "dealer": "provider_flag_dealer",
  "corporate": "provider_flag_corporate",
  "corporate name": "provider_new_car_corporate",
  ownership: "provider_title_ownership",
  "change registration": "provider_change_registration",
  "insurance processing": "provider_processing_insurance",
  "insurance processing after damage": "provider_processing_insurance_damage",
  "insurance processing after damage to my car": "provider_processing_insurance_damage",
  "insurance processing after damage to my vehicle": "provider_processing_insurance_damage",
  "repair processing": "provider_processing_repair",
  "comprehensive examination": "provider_inspection_comprehensive_exam",
  "recall completion": "provider_recall_completion",
  "recall completed": "provider_recall_completion",
  "recall required": "provider_recall_required",
  "unregistered period": "provider_unregistered_period",
  "corporation": "provider_flag_corporate",
  "address change": "provider_change_address",
  "owner change": "provider_change_owner",
  "change of owner": "provider_change_owner",
  "change of ownership": "provider_change_owner",
  "vehicle number change": "provider_vehicle_number_change",
  "change of vehicle number": "provider_vehicle_number_change",
  "termination of information provision": "provider_termination_of_information",
  "termination of information": "provider_termination_of_information",
  "insurance accident": "provider_insurance_accident",
  "korean insurance accident": "provider_insurance_accident",
  "accident history": "accident_history",
  "simple repair history": "provider_simple_repair_history",
  "simple repair": "provider_simple_repair_history",
  "first registration": "registry_field_first_registration",
  "initial registration": "registry_field_first_registration",
  // VHR usage / history coverage titles
  rent: "provider_usage_rent",
  rental: "provider_usage_rental",
  business: "provider_usage_business",
  government: "provider_usage_government",
  "special usage": "provider_usage_special",
  "special use": "provider_usage_special",
  taxi: "provider_usage_taxi",
  // VHR export declaration properties
  "export date": "provider_export_date",
  "export fuel": "provider_export_fuel",
  "export color": "provider_export_color",
  "export total loss": "provider_export_total_loss",
  "export declaration": "registry_type_export",
  "engine displacement": "provider_engine_displacement",
  "dimensions (l×w×h)": "provider_dimensions_lwh",
  "dimensions (lxwxh)": "provider_dimensions_lwh",
  "dimensions (l x w x h)": "provider_dimensions_lwh",
  // VHR status / summary titles
  "total loss": "provider_total_loss",
  theft: "provider_theft",
  flood: "provider_flood",
  "flood damage": "provider_flood_damage",
  "water/flood damage": "provider_flood_damage",
  "water / flood damage": "provider_flood_damage",
  "history coverage": "report_history_notes",
  "history limitation": "provider_history_limitation",
  "uninsured period": "provider_uninsured_period",
  "insurance plate": "provider_insurance_plate",
  "own damage claims": "provider_own_damage_claims",
  "other-party claims": "provider_other_party_claims",
  "other party claims": "provider_other_party_claims",
  "total own damage": "provider_total_own_damage",
  "total other-party damage": "provider_total_other_party_damage",
  "total other party damage": "provider_total_other_party_damage",
  "total loss events": "provider_total_loss_events",
  "theft events": "provider_theft_events",
  "flood events": "provider_flood_events",
  "recall campaigns": "provider_recall_campaigns",
  owners: "provider_owners",
  "registration number": "provider_registration_number",
  "insurance report date": "provider_insurance_report_date",
  "trim options": "provider_trim_options",
  "none recorded": "provider_none_recorded",
  "korean inspection": "provider_korean_inspection",
  "inspection summary": "provider_inspection_summary",
  "inspection accident status": "provider_inspection_accident_status",
  "korean market price": "provider_korean_market_price",
  "market low": "provider_market_low",
  "market high": "provider_market_high",
  "ownership change": "provider_change_owner",
  "plate / registration change": "provider_plate_change",
  "plate/registration change": "provider_plate_change",
  "personal car": "provider_personal_car",
  "transfer of ownership": "provider_transfer_ownership",
  seats: "provider_seats",
  yes: "provider_yes",
  no: "provider_no",
};

const PHRASE_PATTERNS: Array<{ pattern: RegExp; key: string }> = [
  { pattern: /relocation of the party transaction/gi, key: "provider_txn_party_relocation" },
  { pattern: /transfer of transactions between parties/gi, key: "provider_txn_between_parties" },
  { pattern: /trader transactions? transfer/gi, key: "provider_txn_trader_transfer" },
  { pattern: /transaction transfer between traders/gi, key: "provider_txn_trader_transfer" },
  { pattern: /used car dealer transaction/gi, key: "provider_txn_dealer_sale" },
  { pattern: /\bregular inspection\b/gi, key: "provider_inspection_regular" },
  { pattern: /\bcomprehensive inspection\b/gi, key: "provider_inspection_comprehensive" },
  { pattern: /\bperiodic inspection\b/gi, key: "provider_inspection_periodic" },
  { pattern: /\bchange registration\b/gi, key: "provider_change_registration" },
  { pattern: /\bvehicle number change\b/gi, key: "provider_vehicle_number_change" },
  { pattern: /\bchange of vehicle number\b/gi, key: "provider_vehicle_number_change" },
  { pattern: /\bchange of ownership\b/gi, key: "provider_change_owner" },
  { pattern: /\bchange of owner\b/gi, key: "provider_change_owner" },
  { pattern: /\btermination of information(?:\s+provision)?\b/gi, key: "provider_termination_of_information" },
  { pattern: /\bkorean insurance accident\b/gi, key: "provider_insurance_accident" },
  { pattern: /\binsurance accident\b/gi, key: "provider_insurance_accident" },
  { pattern: /\bsimple repair history\b/gi, key: "provider_simple_repair_history" },
  { pattern: /\baccident history\b/gi, key: "accident_history" },
  { pattern: /\binitial registration\b/gi, key: "registry_field_first_registration" },
  { pattern: /\bfirst registration\b/gi, key: "registry_field_first_registration" },
  { pattern: /\bnew car delivery\b/gi, key: "registry_type_new_car_delivery" },
  { pattern: /\bnew car shipment\b/gi, key: "registry_type_new_car_delivery" },
  { pattern: /\bcar inspection completed\b/gi, key: "registry_type_inspection" },
  { pattern: /\bautomobile inspection completed\b/gi, key: "registry_type_inspection" },
  { pattern: /\binsurance processing after damage(?:\s+to\s+my\s+(?:car|vehicle))?/gi, key: "provider_processing_insurance_damage" },
  { pattern: /\binsurance processing\b/gi, key: "provider_processing_insurance" },
  { pattern: /\bcomprehensive examination\b/gi, key: "provider_inspection_comprehensive_exam" },
  { pattern: /\brecall completion\b/gi, key: "provider_recall_completion" },
  { pattern: /\brecall completed\b/gi, key: "provider_recall_completion" },
  { pattern: /\brecall required\b/gi, key: "provider_recall_required" },
  { pattern: /\bunregistered period\b/gi, key: "provider_unregistered_period" },
  { pattern: /\bproduced vehicles between\b/gi, key: "provider_recall_produced_between" },
  { pattern: /\(total\s+(\d+)\s+months?\)/gi, key: "provider_total_months_paren_tpl" },
  { pattern: /\bownership\b/gi, key: "provider_title_ownership" },
  { pattern: /\bcorporate name\b/gi, key: "provider_new_car_corporate" },
  { pattern: /([\d.,]+)\s*million\s+won\b/gi, key: "provider_million_won_tpl" },
  { pattern: /\bmillion\s+won\b/gi, key: "provider_million_won_unit" },
  { pattern: /\bcompletion date\b/gi, key: "registry_field_completion_date" },
  { pattern: /\bmileage\b/gi, key: "mileage" },
  { pattern: /\binspection date\b/gi, key: "registry_field_inspection_date" },
  { pattern: /\bspecial usage\b/gi, key: "provider_usage_special" },
  { pattern: /\bexport date\b/gi, key: "provider_export_date" },
  { pattern: /\bexport fuel\b/gi, key: "provider_export_fuel" },
  { pattern: /\bexport color\b/gi, key: "provider_export_color" },
  { pattern: /\bexport total loss\b/gi, key: "provider_export_total_loss" },
  { pattern: /\bexport declaration\b/gi, key: "registry_type_export" },
  { pattern: /\bengine displacement\b/gi, key: "provider_engine_displacement" },
  { pattern: /\bdimensions\s*\(\s*l\s*[×x]\s*w\s*[×x]\s*h\s*\)/gi, key: "provider_dimensions_lwh" },
  { pattern: /\btotal loss events\b/gi, key: "provider_total_loss_events" },
  { pattern: /\btheft events\b/gi, key: "provider_theft_events" },
  { pattern: /\bflood events\b/gi, key: "provider_flood_events" },
  { pattern: /\bwater\s*\/\s*flood damage\b/gi, key: "provider_flood_damage" },
  { pattern: /\bflood damage\b/gi, key: "provider_flood_damage" },
  { pattern: /\btotal loss\b/gi, key: "provider_total_loss" },
  { pattern: /\bhistory coverage\b/gi, key: "report_history_notes" },
  { pattern: /\bhistory limitation\b/gi, key: "provider_history_limitation" },
  { pattern: /\buninsured period\b/gi, key: "provider_uninsured_period" },
  { pattern: /\binsurance plate\b/gi, key: "provider_insurance_plate" },
  { pattern: /\bown damage claims\b/gi, key: "provider_own_damage_claims" },
  { pattern: /\bother[-\s]party claims\b/gi, key: "provider_other_party_claims" },
  { pattern: /\btotal own damage\b/gi, key: "provider_total_own_damage" },
  { pattern: /\btotal other[-\s]party damage\b/gi, key: "provider_total_other_party_damage" },
  { pattern: /\brecall campaigns\b/gi, key: "provider_recall_campaigns" },
  { pattern: /\bregistration number\b/gi, key: "provider_registration_number" },
  { pattern: /\binsurance report date\b/gi, key: "provider_insurance_report_date" },
  { pattern: /\btrim options\b/gi, key: "provider_trim_options" },
  { pattern: /\bnone recorded\b/gi, key: "provider_none_recorded" },
  { pattern: /\bkorean inspection\b/gi, key: "provider_korean_inspection" },
  { pattern: /\binspection summary\b/gi, key: "provider_inspection_summary" },
  { pattern: /\binspection accident status\b/gi, key: "provider_inspection_accident_status" },
  { pattern: /\bkorean market price\b/gi, key: "provider_korean_market_price" },
  { pattern: /\bmarket low\b/gi, key: "provider_market_low" },
  { pattern: /\bmarket high\b/gi, key: "provider_market_high" },
  { pattern: /\bownership change\b/gi, key: "provider_change_owner" },
  { pattern: /\bplate\s*\/\s*registration change\b/gi, key: "provider_plate_change" },
  { pattern: /\bpersonal car\b/gi, key: "provider_personal_car" },
  { pattern: /\btransfer of ownership\b/gi, key: "provider_transfer_ownership" },
];

const DATE_FIELD_LABELS = new Set([
  "date of occurrence",
  "inspection date",
  "date of change",
  "change date",
  "date of production",
  "production date",
  "first registration date",
  "initial registration date",
  "recall date",
  "recall post date",
  "completion date",
  "car inspection completion date",
  "inspection completion date",
  "period",
  "export date",
  "insurance report date",
]);

const PHRASE_VALUE_LABELS = new Set([
  "transaction",
  "transaction type",
  "classification of change",
  "inspection category",
  "inspection",
  "processing type",
  "flag",
]);

const ENGLISH_MONTH_IN_TEXT =
  "(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)";

function normalizePhrase(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function tr(t: (key: string) => string, key: string): string | null {
  const translated = t(key);
  return translated !== key ? translated : null;
}

/** Localize English month names embedded in longer provider strings (subtitles, periods, etc.). */
export function translateProviderDateInText(
  text: string | null | undefined,
  language: Language,
): string | null {
  if (text == null || text === "") return null;
  if (language === "en") return String(text);

  let result = String(text);
  let prev = "";
  for (let i = 0; i < 6 && result !== prev; i++) {
    prev = result;
    result = applyProviderDateInTextReplacements(result, language);
  }
  return result;
}

function formatIsoDateParts(
  locale: string,
  year: number,
  month: number,
  day: number,
): string {
  return formatLocalizedDate(locale, { month, day, year });
}

export function translateProviderDate(
  text: string | null | undefined,
  language: Language,
): string | null {
  if (text == null || text === "") return null;
  const trimmed = normalizeProviderDateText(String(text));
  if (!trimmed) return null;
  const locale = LOCALE_BY_LANG[language];

  const isoDayMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s][\d:.+-]+Z?)?$/i)
    ?? trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDayMatch) {
    const year = Number(isoDayMatch[1]);
    const month = Number(isoDayMatch[2]) - 1;
    const day = Number(isoDayMatch[3]);
    if (day === 1) return formatLocalizedMonthYear(locale, year, month);
    return formatIsoDateParts(locale, year, month, day);
  }

  const yearMonth = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (yearMonth) {
    return formatLocalizedMonthYear(locale, Number(yearMonth[1]), Number(yearMonth[2]) - 1);
  }

  const englishMonthYear = trimmed.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (englishMonthYear) {
    const month = monthIndex(englishMonthYear[1]!);
    if (month >= 0) {
      return formatLocalizedMonthYear(locale, parseInt(englishMonthYear[2]!, 10), month);
    }
  }

  const compactIso = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactIso) {
    return formatIsoDateParts(
      locale,
      Number(compactIso[1]),
      Number(compactIso[2]) - 1,
      Number(compactIso[3]),
    );
  }

  const encarMonthYy = parseEncarMonthYearLabel(trimmed);
  if (encarMonthYy) {
    return formatLocalizedMonthYear(locale, encarMonthYy.year, encarMonthYy.month);
  }

  const dottedIso = trimmed.match(/^(\d{4})[./](\d{1,2})[./](\d{1,2})$/);
  if (dottedIso) {
    return formatIsoDateParts(
      locale,
      Number(dottedIso[1]),
      Number(dottedIso[2]) - 1,
      Number(dottedIso[3]),
    );
  }

  const parsed = parseEnglishMonthDate(trimmed);
  if (parsed?.year != null) {
    return formatLocalizedDate(locale, parsed);
  }

  const embedded = trimmed.match(/([A-Za-z]{3,12})\s+(\d{1,2}),?\s*(\d{4})/);
  if (embedded) {
    const month = monthIndex(embedded[1]!);
    if (month >= 0) {
      return formatLocalizedDate(locale, {
        month,
        day: parseInt(embedded[2]!, 10),
        year: parseInt(embedded[3]!, 10),
      });
    }
  }

  const embeddedShort = trimmed.match(/([A-Za-z]{3,12})\s+(\d{1,2})(?!\d)/);
  if (embeddedShort) {
    const encar = parseEncarMonthYearLabel(trimmed);
    if (encar) {
      return formatLocalizedMonthYear(locale, encar.year, encar.month);
    }
  }

  const fallback = new Date(trimmed);
  if (!Number.isNaN(fallback.getTime()) && /\d{4}/.test(trimmed)) {
    const formatted = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" }).format(fallback);
    if (language === "en" || !containsEnglishMonth(formatted)) return formatted;
  }

  if (language !== "en" && containsEnglishMonth(trimmed)) {
    const fromText = translateProviderDateInText(trimmed, language);
    if (fromText && !containsEnglishMonth(fromText)) return fromText;
    return null;
  }

  return trimmed;
}

/** Neutral DD/MM/YYYY when month-name localization fails — never hide a parseable date. */
export function formatProviderDateFallback(
  date: string | null | undefined,
  vehicleYear?: number | null,
  vehicleCountry?: string | null,
  language?: Language,
): string | null {
  if (date == null || date === "") return null;
  const trimmed = normalizeProviderDateText(String(date));
  if (!trimmed) return null;

  const usOrder = isUsVehicleCountry(vehicleCountry);
  const sqLocale = language === "sq" ? LOCALE_BY_LANG.sq : null;

  const trySqFromParts = (parts: NumericDateParts): string | null => {
    if (!sqLocale) return null;
    if (parts.day === 1) return formatSqLocalizedMonthYear(parts.year, parts.month - 1);
    return formatSqLocalizedDate({ month: parts.month - 1, day: parts.day, year: parts.year });
  };

  const numericParts = parseNumericDayMonthYear(trimmed, { assumeUsSlashOrder: usOrder });
  if (numericParts) {
    const sqManual = trySqFromParts(numericParts);
    if (sqManual) return sqManual;
    return formatDayMonthYearNumeric(numericParts.day, numericParts.month, numericParts.year);
  }

  const repaired = sanitizeReportIsoDate(trimmed, vehicleYear)
    ?? trimmed.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
    ?? null;
  if (repaired) {
    const repairedParts = parseNumericDayMonthYear(repaired, { assumeUsSlashOrder: usOrder });
    if (repairedParts) {
      const sqManual = trySqFromParts(repairedParts);
      if (sqManual) return sqManual;
      return formatDayMonthYearNumeric(repairedParts.day, repairedParts.month, repairedParts.year);
    }
  }

  const parsed = parseEnglishMonthDate(trimmed);
  if (parsed?.year != null) {
    if (sqLocale) {
      const sqManual = formatSqLocalizedDate({
        month: parsed.month,
        day: parsed.day,
        year: parsed.year,
      });
      if (sqManual) return sqManual;
    }
    return formatDayMonthYearNumeric(parsed.day, parsed.month + 1, parsed.year);
  }

  return repaired;
}

/** Localize a provider date string, including embedded English months in ranges. */
export function localizeProviderDate(
  date: string | null | undefined,
  language: Language,
  vehicleYear?: number | null,
  vehicleCountry?: string | null,
): string | null {
  if (date == null || date === "") return null;

  if (isUsVehicleCountry(vehicleCountry)) {
    let usDate = localizeUsVehicleFullDate(String(date), vehicleYear, language);
    if (!usDate && vehicleYear != null) {
      usDate = localizeUsVehicleFullDate(String(date), undefined, language);
    }
    if (usDate) return usDate;
  }

  const localizeOnce = (vy: number | null | undefined): string | null => {
    const normalized = normalizeProviderDateText(String(date));
    const repaired = sanitizeReportIsoDate(normalized, vy);
    const source = repaired ?? (looksLikeProviderDate(normalized) ? normalized : null);

    if (!source) {
      const direct = translateProviderDate(normalized, language);
      if (direct && (language === "en" || !containsEnglishMonth(direct))) return direct;
      return null;
    }

    let result = translateProviderDate(source, language);
    if (language === "en") return result ?? source;

    if (!result || containsEnglishMonth(result)) {
      result = translateProviderDate(normalized, language) ?? result;
    }
    if (result && containsEnglishMonth(result)) {
      result = translateProviderDateInText(result, language) ?? result;
    }
    if ((!result || containsEnglishMonth(result)) && looksLikeProviderDate(source)) {
      const fromText = translateProviderDateInText(source, language);
      if (fromText && !containsEnglishMonth(fromText)) result = fromText;
    }

    const repairedIso = repaired ?? normalized.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
    if (result) result = ensureNoEnglishMonths(result, language, repairedIso);

    if (result && !containsEnglishMonth(result)) return result;

    if (repairedIso) {
      const fromIso = formatIsoForLocale(LOCALE_BY_LANG[language], repairedIso);
      if (fromIso && !containsEnglishMonth(fromIso)) return fromIso;
    }

    const isoPrefix = normalized.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    if (isoPrefix) {
      const fromIso = formatIsoForLocale(LOCALE_BY_LANG[language], isoPrefix);
      if (fromIso && !containsEnglishMonth(fromIso)) return fromIso;
    }

    return null;
  };

  let result = localizeOnce(vehicleYear);
  if (!result && vehicleYear != null) {
    result = localizeOnce(undefined);
  }
  if (result) return result;

  const fallback = formatProviderDateFallback(String(date), vehicleYear, vehicleCountry, language);
  if (fallback && language === "sq" && looksNumericOnlyDate(fallback)) {
    const parts = parseNumericDayMonthYear(String(date), {
      assumeUsSlashOrder: isUsVehicleCountry(vehicleCountry),
    })
      ?? parseNumericDayMonthYear(fallback, { assumeUsSlashOrder: isUsVehicleCountry(vehicleCountry) });
    if (parts) {
      if (parts.day === 1) {
        const my = formatSqLocalizedMonthYear(parts.year, parts.month - 1);
        if (my) return my;
      }
      const manual = formatSqLocalizedDate({
        month: parts.month - 1,
        day: parts.day,
        year: parts.year,
      });
      if (manual) return manual;
    }
  }

  return fallback;
}

/** Compact month/day label for charts (localized). */
export function translateProviderChartLabel(
  text: string | null | undefined,
  language: Language,
  vehicleCountry?: string | null,
): string | null {
  if (!text) return null;
  const trimmed = text.trim();

  if (isUsVehicleCountry(vehicleCountry)) {
    const parts = parseNumericDayMonthYear(trimmed, { assumeUsSlashOrder: true });
    if (parts) {
      const yy = String(parts.year).slice(-2);
      return `${pad2(parts.day)}/${pad2(parts.month)}/${yy}`;
    }
    const usDate = localizeUsVehicleFullDate(trimmed);
    if (usDate) {
      const m = usDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) return `${m[1]}/${m[2]}/${m[3]!.slice(-2)}`;
    }
  }

  const isoDay = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDay) {
    return formatChartMonthDay(
      language,
      Number(isoDay[1]),
      Number(isoDay[2]) - 1,
      Number(isoDay[3]),
    );
  }

  const isoDayTime = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T\s]/);
  if (isoDayTime) {
    return formatChartMonthDay(
      language,
      Number(isoDayTime[1]),
      Number(isoDayTime[2]) - 1,
      Number(isoDayTime[3]),
    );
  }

  const compactIso = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactIso) {
    return formatChartMonthDay(
      language,
      Number(compactIso[1]),
      Number(compactIso[2]) - 1,
      Number(compactIso[3]),
    );
  }

  const encar = parseEncarMonthYearLabel(trimmed);
  if (encar) {
    return formatChartMonthYear(language, encar.year, encar.month);
  }

  const parsed = parseEnglishMonthDate(trimmed);
  if (parsed) {
    return formatChartMonthDay(language, parsed.year, parsed.month, parsed.day);
  }

  const localized = localizeProviderDate(trimmed, language);
  if (localized && (language === "en" || !containsEnglishMonth(localized))) {
    // Prefer compact chart form when we can re-parse ISO from the source.
    const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      return formatChartMonthDay(
        language,
        Number(iso[1]),
        Number(iso[2]) - 1,
        Number(iso[3]),
      );
    }
    return localized;
  }
  return language === "en" ? trimmed : null;
}

/** Chart axis: localized short month + day (+ optional 2-digit year). */
function formatChartMonthDay(
  language: Language,
  year: number | undefined,
  month: number,
  day: number,
): string {
  const locale = LOCALE_BY_LANG[language];

  if (isSqLocale(locale)) {
    const mon = SQ_MONTHS_SHORT[month] ?? SQ_MONTHS_LONG[month]?.slice(0, 3) ?? "";
    if (year != null) return `${day} ${mon} ${String(year).slice(-2)}`;
    return `${day} ${mon}`;
  }

  try {
    const opts: Intl.DateTimeFormatOptions =
      year != null
        ? { month: "short", day: "numeric", year: "2-digit" }
        : { month: "short", day: "numeric" };
    const formatted = new Intl.DateTimeFormat(locale, opts).format(
      new Date(year ?? 2000, month, day),
    );
    if (language === "en" || !containsEnglishMonth(formatted)) return formatted;
  } catch {
    // fall through
  }

  // Never leave English month stubs (e.g. "Oct 4") on non-English UIs.
  if (year != null) return `${pad2(day)}/${pad2(month + 1)}/${String(year).slice(-2)}`;
  return `${pad2(day)}/${pad2(month + 1)}`;
}

function formatChartMonthYear(language: Language, year: number, month: number): string {
  const locale = LOCALE_BY_LANG[language];
  if (isSqLocale(locale)) {
    const mon = SQ_MONTHS_SHORT[month] ?? SQ_MONTHS_LONG[month]?.slice(0, 3) ?? "";
    return `${mon} ${String(year).slice(-2)}`;
  }
  try {
    const formatted = new Intl.DateTimeFormat(locale, {
      year: "2-digit",
      month: "short",
    }).format(new Date(year, month, 1));
    if (language === "en" || !containsEnglishMonth(formatted)) return formatted;
  } catch {
    // fall through
  }
  return `${pad2(month + 1)}/${String(year).slice(-2)}`;
}

export function translateKoreanProviderPhrase(
  t: (key: string) => string,
  text: string | null | undefined,
): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  const exact = PHRASE_KEYS[normalizePhrase(trimmed)];
  if (exact) {
    const translated = tr(t, exact);
    if (translated) return translated;
  }
  return trimmed;
}

export function translateKoreanProviderText(
  t: (key: string) => string,
  text: string | null | undefined,
): string | null {
  if (!text) return null;
  const exact = translateKoreanProviderPhrase(t, text);
  if (exact && normalizePhrase(exact) !== normalizePhrase(text)) return exact;

  let result = text;
  for (const { pattern, key } of PHRASE_PATTERNS) {
    if (key === "provider_million_won_tpl") {
      result = result.replace(pattern, (_, num: string) => {
        const unit = tr(t, "provider_million_won_unit") ?? "million won";
        return `${num} ${unit}`;
      });
      continue;
    }
    if (key === "provider_total_months_paren_tpl") {
      result = result.replace(pattern, (_, num: string) => {
        const tpl = tr(t, "provider_total_months_paren_tpl");
        return tpl ? tpl.replace("{count}", num) : `(Total ${num} months)`;
      });
      continue;
    }
    const translated = tr(t, key);
    if (translated) result = result.replace(pattern, translated);
  }
  return result;
}

export function translateProviderMileageLine(
  t: (key: string) => string,
  text: string,
): string {
  const kmMatch = text.match(/^([\d,.\s]+)\s*km(?:\s+of\s+mileage)?$/i);
  if (kmMatch) {
    const km = kmMatch[1]!.trim();
    if (/of\s+mileage/i.test(text)) {
      const suffix = tr(t, "provider_of_mileage") ?? "of mileage";
      return `${km} km ${suffix}`;
    }
    return `${km} km`;
  }
  const mileagePrefix = text.match(/^mileage\s+([\d,.\s]+)\s*km$/i);
  if (mileagePrefix) {
    const label = tr(t, "provider_mileage_word") ?? "Mileage";
    return `${label} ${mileagePrefix[1]!.trim()} km`;
  }
  const examKm = text.match(/^comprehensive examination\s+([\d,.\s]+)\s*km(?:\s+of\s+mileage)?$/i);
  if (examKm) {
    const exam = tr(t, "provider_inspection_comprehensive_exam") ?? "Comprehensive examination";
    const suffix = tr(t, "provider_of_mileage");
    const km = examKm[1]!.trim();
    return suffix ? `${exam} ${km} km ${suffix}` : `${exam} ${km} km`;
  }
  const kmOfMileage = text.match(/^([\d,.\s]+)\s*km\s+of\s+mileage$/i);
  if (kmOfMileage) {
    const suffix = tr(t, "provider_of_mileage") ?? "of mileage";
    return `${kmOfMileage[1]!.trim()} km ${suffix}`;
  }
  const encarTypoKm = text.match(/^(?:drone|drown)\s+([\d,.\s]+)\s*km$/i);
  if (encarTypoKm) {
    const label = tr(t, "provider_mileage_word") ?? "Mileage";
    return `${label} ${encarTypoKm[1]!.trim()} km`;
  }
  return translateKoreanProviderText(t, text) ?? text;
}

export function translateProviderAmount(
  t: (key: string) => string,
  text: string,
  opts?: { country?: string | null; krwPerUsd?: number | null },
): string {
  if (isKoreanCountry(opts?.country) && /won|₩/i.test(text)) {
    const converted = formatKoreanWonFromText(text, opts?.krwPerUsd);
    if (converted) return converted;
  }

  const million = text.match(/^([\d.,]+)\s+million\s+won$/i);
  if (million) {
    const unit = tr(t, "provider_million_won_unit") ?? "million won";
    return `${million[1]} ${unit}`;
  }
  const won = text.match(/^([\d,]+)\s+won$/i);
  if (won) {
    const unit = tr(t, "provider_won_unit") ?? "won";
    return `${won[1]} ${unit}`;
  }
  return translateKoreanProviderText(t, text) ?? text;
}

export function translateProviderMultiline(
  t: (key: string) => string,
  language: Language,
  text: string | null | undefined,
  opts?: { country?: string | null; krwPerUsd?: number | null },
): string | null {
  if (!text) return null;
  const parts = text.split(/\n| · /).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const translated = parts.map((part) => {
    const asDate = localizeProviderDate(part, language);
    if (asDate && (language === "en" || !containsEnglishMonth(asDate)) && asDate !== part) {
      return asDate;
    }
    if (/km/i.test(part)) return translateProviderMileageLine(t, part);
    if (/won|₩/i.test(part)) return translateProviderAmount(t, part, opts);
    let phrase = translateKoreanProviderText(t, part) ?? part;
    if (language !== "en") {
      if (containsEnglishMonth(phrase) || looksLikeProviderDate(phrase)) {
        const fromText = translateProviderDateInText(phrase, language);
        if (fromText && !containsEnglishMonth(fromText)) phrase = fromText;
      }
    }
    return phrase;
  });

  const joined = translated.join(" · ");
  if (language !== "en") {
    return translateProviderDateInText(joined, language) ?? joined;
  }
  return joined;
}

export function translateRegistryFieldValue(
  t: (key: string) => string,
  language: Language,
  label: string,
  value: string,
  countryLabels?: { usa?: string; korea?: string },
  country?: string | null,
  krwPerUsd?: number | null,
  vehicleYear?: number | null,
): string {
  const labelNorm = label.toLowerCase().trim();

  if (DATE_FIELD_LABELS.has(labelNorm)) {
    const localized = localizeProviderDate(value, language, vehicleYear, country)
      ?? localizeProviderDate(value, language, undefined, country);
    if (localized) return localized;
    if (language !== "en") {
      const fromText = translateProviderDateInText(value, language);
      if (fromText && !containsEnglishMonth(fromText)) return fromText;
      return value;
    }
    return value;
  }

  if (labelNorm === "production country") {
    return formatCountryName(value, language, countryLabels) ?? value;
  }

  if (PHRASE_VALUE_LABELS.has(labelNorm) || labelNorm === "transaction") {
    const phrase = translateKoreanProviderPhrase(t, value);
    if (phrase && normalizePhrase(phrase) !== normalizePhrase(value)) return phrase;
    return translateKoreanProviderText(t, value) ?? value;
  }

  if (/km/i.test(value)) return translateProviderMileageLine(t, value);
  if (/won|₩/i.test(value)) return translateProviderAmount(t, value, { country, krwPerUsd });

  if (isRegistryRepairCostLabel(label)) {
    const sanitized = sanitizeKoreanRepairAmountText(value);
    if (sanitized) return translateProviderAmount(t, sanitized, { country, krwPerUsd });
    return "";
  }

  const maybeDate = localizeProviderDate(value, language, vehicleYear, country);
  if (maybeDate && maybeDate !== value) return maybeDate;

  const phrase = translateKoreanProviderText(t, value) ?? value;
  if (language !== "en" && (containsEnglishMonth(phrase) || looksLikeProviderDate(phrase))) {
    return translateProviderDateInText(phrase, language) ?? phrase;
  }
  return phrase;
}

export function translateInsuranceClaimDescription(
  t: (key: string) => string,
  description: string | null | undefined,
): string | null {
  if (!description) return null;
  const partsLabel = tr(t, "insurance_desc_parts");
  const laborLabel = tr(t, "insurance_desc_labor");
  const paintLabel = tr(t, "insurance_desc_paint");

  let out = description;
  if (partsLabel) out = out.replace(/\bparts\b/gi, partsLabel);
  if (laborLabel) out = out.replace(/\blabor\b/gi, laborLabel);
  if (paintLabel) out = out.replace(/\bpaint\b/gi, paintLabel);
  return out;
}
