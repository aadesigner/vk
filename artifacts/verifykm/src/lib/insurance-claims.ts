import type { Language } from "@/i18n/context";
import {
  localizeProviderDate,
  translateInsuranceClaimDescription,
} from "@/lib/korean-provider-text";
import {
  formatKoreanWonPlain,
  formatAmountPlain,
  resolveAmountDisplayCurrency,
} from "@/lib/korean-currency";

export type InsuranceClaimEntry = {
  date?: string | null;
  type?: string | null;
  lossAmount?: number | null;
  partCost?: number | null;
  laborCost?: number | null;
  paintingCost?: number | null;
  description?: string | null;
  /** Admin-set display currency (KRW | USD | EUR). Absent on provider rows. */
  currency?: string | null;
};

const CLAIM_TYPE_KEYS: Record<string, string> = {
  insurance_own_damage: "insurance_claim_type_own_damage",
  insurance_third_party: "insurance_claim_type_third_party",
  insurance_third_party_own_damage: "insurance_claim_type_third_party_own_damage",
};

export function translateInsuranceClaimType(
  t: (key: string) => string,
  type?: string | null,
): string | null {
  if (!type) return null;
  const key = CLAIM_TYPE_KEYS[type];
  if (key) {
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return type.replace(/_/g, " ");
}

export function localizeInsuranceClaimDate(
  date: string | null | undefined,
  language: Language,
  vehicleYear?: number | null,
  vehicleCountry?: string | null,
): string | null {
  return localizeProviderDate(date, language, vehicleYear, vehicleCountry);
}

export { translateInsuranceClaimDescription };

export function formatInsuranceAmount(
  amount: number,
  country?: string | null,
  krwPerUsd?: number | null,
  opts?: {
    currency?: string | null;
    accidentType?: string | null;
    accidentCountry?: string | null;
    hasKoreanInsuranceClaims?: boolean;
  },
): string {
  const code = resolveAmountDisplayCurrency({
    currency: opts?.currency,
    vehicleCountry: country,
    accidentType: opts?.accidentType,
    accidentCountry: opts?.accidentCountry,
    hasKoreanInsuranceClaims: opts?.hasKoreanInsuranceClaims,
  });

  if (code === "KRW") {
    return formatKoreanWonPlain(amount, krwPerUsd ?? 0);
  }
  return formatAmountPlain(amount, code);
}

export function formatInsuranceClaimsCount(t: (key: string) => string, count: number): string {
  return t("insurance_claims_count").replace("{count}", String(count));
}
