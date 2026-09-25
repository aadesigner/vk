import { damageValueKey } from "./translate-damage-label";
import { translateKoreanProviderPhrase } from "./korean-provider-text";

/** Known auction lot / condition tokens from provider APIs (Carstat, Copart, IAAI, Encar, etc.). */
const LOT_STATUS_I18N: Record<string, string> = {
  upcoming: "label_upcoming",
  sold: "label_sold",
  sale: "label_sale",
  for_sale: "label_for_sale",
  run_and_drives: "label_run_and_drives",
  run_and_drive: "label_run_and_drives",
  runs_and_drives: "label_run_and_drives",
  run_drives: "label_run_and_drives",
  on_approval: "label_on_approval",
  not_sold: "label_not_sold",
  live: "label_live",
  active: "label_active",
  cancelled: "label_cancelled",
  canceled: "label_cancelled",
  wait: "label_wait",
  waiting: "label_wait",
  pending: "label_pending",
  closed: "label_closed",
  ended: "label_ended",
  available: "label_available",
  listed: "label_listed",
  pure_sale: "label_pure_sale",
  no_bid: "label_no_bid",
  on_hold: "label_on_hold",
  stationary: "label_stationary",
  engine_starts: "label_engine_starts",
  engine_start_program: "label_engine_starts",
  starts: "label_starts",
  enhanced: "label_enhanced",
  enhanced_vehicles: "label_enhanced",
  bid: "label_bid",
  reopened: "label_reopened",
  reopen: "label_reopened",
  future: "label_future",
  unknown: "label_unknown",
};

function normalizeLotToken(value: string): string {
  return damageValueKey(value.replace(/\s+/g, "_"));
}

/** Translate auction lot status / condition tokens when a locale string exists. */
export function translateLotStatus(
  t: (key: string) => string,
  value: string | null | undefined,
): string | null {
  if (!value || value === "[object Object]") return null;

  const token = normalizeLotToken(value);
  const i18nKey = LOT_STATUS_I18N[token] ?? `lot_status_${token}`;
  const translated = t(i18nKey);
  if (translated !== i18nKey) return translated;

  const providerPhrase = translateKoreanProviderPhrase(t, value);
  if (providerPhrase && normalizeLotToken(providerPhrase) !== token) {
    return providerPhrase;
  }

  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
