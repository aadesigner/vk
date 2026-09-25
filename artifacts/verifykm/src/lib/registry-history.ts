import type { Language } from "@/i18n/context";
import {
  localizeProviderDate,
  looksLikeProviderDate,
  translateKoreanProviderPhrase,
  translateKoreanProviderText,
  translateProviderAmount,
  translateProviderDateInText,
  translateProviderMultiline,
  translateRegistryFieldValue,
} from "@/lib/korean-provider-text";

export type RegistryHistoryEntry = {
  date?: string | null;
  type?: string | null;
  title?: string | null;
  subtitle?: string | null;
  mileage?: number | null;
  amount?: string | null;
  location?: string | null;
  details?: Array<{ label: string; value: string }>;
};

const TYPE_KEYS: Record<string, string> = {
  new_car_delivery: "registry_type_new_car_delivery",
  first_registration: "registry_field_first_registration",
  delivery: "registry_field_first_registration",
  inspection: "registry_type_inspection",
  registration_change: "registry_type_registration_change",
  owner_change: "registry_type_owner_change",
  no_insurance: "registry_type_no_insurance",
  insurance_event: "registry_type_insurance_event",
  recall: "registry_type_recall",
  other: "registry_type_other",
};

const GENERIC_EVENT_TYPES = new Set(["other", "event", "unknown"]);

const FIELD_LABEL_KEYS: Record<string, string> = {
  "production country": "registry_field_production_country",
  "date of production": "registry_field_production_date",
  "first registration date": "registry_field_first_registration",
  "initial registration date": "registry_field_first_registration",
  "production date": "registry_field_production_date",
  "new car list price": "registry_field_list_price",
  "new car delivery price": "registry_field_delivery_price",
  "new car shipping": "registry_field_shipping_price",
  "first time buyer": "registry_field_first_buyer",
  "address at time of purchase": "registry_field_purchase_address",
  "address when purchasing": "registry_field_purchase_address",
  "date of occurrence": "registry_field_occurrence_date",
  "processing type": "registry_field_processing_type",
  "total repair cost": "registry_field_repair_cost",
  "inspection date": "registry_field_inspection_date",
  "driving distance during inspection": "registry_field_inspection_mileage",
  "drone during inspection": "registry_field_inspection_mileage",
  "inspection category": "registry_field_inspection_category",
  "inspection station": "registry_field_inspection_station",
  "inspection center": "registry_field_inspection_station",
  inspection: "registry_field_inspection_category",
  "recall date": "registry_field_recall_date",
  target: "registry_field_recall_target",
  correction: "registry_field_correction_method",
  "completion date": "registry_field_completion_date",
  "car inspection completion date": "registry_field_completion_date",
  "inspection completion date": "registry_field_completion_date",
  "mileage": "mileage",
  "mileage during inspection": "registry_field_inspection_mileage",
  "date of change": "registry_field_change_date",
  "change date": "registry_field_change_date",
  "address after change": "registry_field_address_after",
  "classification of change": "registry_field_change_type",
  "driving distance when changing": "registry_field_change_mileage",
  "drown distance when changing": "registry_field_change_mileage",
  "transaction type": "registry_field_transaction_type",
  transaction: "registry_field_transaction_type",
  flag: "registry_field_sale_channel",
  period: "registry_field_period",
  "recall post date": "registry_field_recall_date",
  "defect details": "registry_field_defect_details",
  "target device": "registry_field_target_device",
  "correction method": "registry_field_correction_method",
  "correction period": "registry_field_correction_period",
  "contact us": "registry_field_contact",
  "license plate": "registry_field_license_plate",
  "vehicle number": "registry_field_license_plate",
  "car number": "registry_field_license_plate",
  diagnosis: "registry_field_diagnosis",
  date: "registry_field_occurrence_date",
  details: "report_details",
  location: "registry_field_location",
  amount: "registry_field_amount",
};

/** True when the string is only a date (no event name like "First registration"). */
export function isDateOnlyRegistryTitle(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  const trimmed = text.replace(/\n/g, " ").trim();
  if (!looksLikeProviderDate(trimmed)) return false;
  const leftover = trimmed
    .replace(/\d+/g, " ")
    .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/gi, " ")
    .replace(/[.,/\-:()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return leftover.length === 0;
}

function formatRegistryEventTitle(
  t: (key: string) => string,
  rawTitle: string,
  language?: Language,
): string {
  const fromPhrase = translateKoreanProviderPhrase(t, rawTitle)
    ?? translateKoreanProviderText(t, rawTitle);
  const base = fromPhrase && fromPhrase !== rawTitle ? fromPhrase : rawTitle;

  if (!language) return base;

  if (isDateOnlyRegistryTitle(base)) {
    return localizeProviderDate(base, language) ?? base;
  }

  return translateProviderDateInText(base, language) ?? base;
}

export function translateRegistryEventType(
  t: (key: string) => string,
  type?: string | null,
  fallbackTitle?: string | null,
  language?: Language,
): string {
  const rawTitle = fallbackTitle?.replace(/\n/g, " ").trim() || null;
  const typeIsGeneric = !type || GENERIC_EVENT_TYPES.has(type);

  // Prefer real titles (e.g. "Maintenance/repair history", "First registration")
  // over generic "Registry event" / date-only labels.
  if (rawTitle && typeIsGeneric) {
    return formatRegistryEventTitle(t, rawTitle, language);
  }

  if (rawTitle && /^first\s+registration\b/i.test(rawTitle)) {
    return formatRegistryEventTitle(t, rawTitle, language);
  }

  if (type) {
    const key = TYPE_KEYS[type];
    if (key) {
      const translated = t(key);
      if (translated !== key) return translated;
    }
  }

  if (rawTitle) {
    return formatRegistryEventTitle(t, rawTitle, language);
  }
  return t("registry_type_other");
}

export function translateRegistryFieldLabel(t: (key: string) => string, label: string): string {
  const norm = label.toLowerCase().trim();
  const key = FIELD_LABEL_KEYS[norm];
  if (key) {
    const translated = t(key);
    if (translated !== key) return translated;
  }
  const fromPhrase = translateKoreanProviderPhrase(t, label)
    ?? translateKoreanProviderText(t, label);
  if (fromPhrase && fromPhrase.toLowerCase().trim() !== norm) return fromPhrase;
  return label;
}

export function translateRegistryDetailValue(
  t: (key: string) => string,
  language: Language,
  label: string,
  value: string,
  vehicleYear?: number | null,
): string {
  return translateRegistryFieldValue(t, language, label, value, undefined, undefined, undefined, vehicleYear);
}

export function localizeRegistryDate(
  language: Language,
  date?: string | null,
  vehicleYear?: number | null,
  vehicleCountry?: string | null,
): string | null {
  return localizeProviderDate(date, language, vehicleYear, vehicleCountry);
}

export function localizeRegistrySubtitle(
  t: (key: string) => string,
  language: Language,
  subtitle?: string | null,
  country?: string | null,
  krwPerUsd?: number | null,
): string | null {
  return translateProviderMultiline(t, language, subtitle, { country, krwPerUsd });
}

export function localizeRegistryAmount(
  t: (key: string) => string,
  amount?: string | null,
  country?: string | null,
  krwPerUsd?: number | null,
): string | null {
  if (!amount) return null;
  return translateProviderAmount(t, amount, { country, krwPerUsd });
}

export function formatRegistryEventsCount(t: (key: string) => string, count: number): string {
  return t("registry_events_count").replace("{count}", String(count));
}

export function formatRegistryMileage(mileage: number): string {
  return `${mileage.toLocaleString()} km`;
}

/** Recall rows are hidden from the Korean registry timeline. */
export function isRecallRegistryEvent(event: RegistryHistoryEntry): boolean {
  if (event.type === "recall") return true;
  const title = (event.title ?? "").toLowerCase();
  const subtitle = (event.subtitle ?? "").toLowerCase();
  if (/recall/.test(title) || /recall/.test(subtitle)) return true;
  return (event.details ?? []).some((row) => /recall/i.test(row.label));
}

export function excludeRecallRegistryEvents<T extends RegistryHistoryEntry>(events: T[]): T[] {
  return events.filter((event) => !isRecallRegistryEvent(event));
}

/** Korean Encar/KOTSA recall status from provider `sub` / subtitle. */
export type RecallCompletionStatus = "done" | "not_done" | null;

/**
 * Returns done / not_done when the provider clearly states recall status.
 * Returns null when there is no completion signal (no badge).
 */
export function getRecallCompletionStatus(event: RegistryHistoryEntry): RecallCompletionStatus {
  const text = (event.subtitle ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;

  if (
    /recall\s+complet(ed|ion)/.test(text)
    || /^(complet(ed|ion))$/.test(text)
    || /리콜\s*완료/.test(text)
    || text === "완료"
  ) {
    return "done";
  }

  if (
    /recall\s+required/.test(text)
    || /^(required)$/.test(text)
    || /not\s+complet(ed|ion)/.test(text)
    || /리콜\s*필요/.test(text)
    || /미조치|미완료|미실시/.test(text)
  ) {
    return "not_done";
  }

  return null;
}
