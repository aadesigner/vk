import type { Language } from "@/i18n/context";
import { inferAccidentSeverityFromLossAmount } from "@workspace/accident-severity";
import { shouldFormatAccidentLossAsKrw } from "@/lib/korean-currency";
import { translateInsuranceClaimType } from "@/lib/insurance-claims";
import {
  translateKoreanProviderText,
  localizeProviderDate,
  translateProviderDateInText,
} from "@/lib/korean-provider-text";

const ACCIDENT_TYPE_KEYS: Record<string, string> = {
  auction: "accident_type_auction",
  salvage: "accident_type_salvage",
  insurance: "accident_type_insurance",
  registry: "accident_type_registry",
  inspection: "accident_type_inspection",
};

export function localizeAccidentDate(
  date: string | null | undefined,
  language: Language,
  vehicleYear?: number | null,
  vehicleCountry?: string | null,
): string | null {
  return localizeProviderDate(date, language, vehicleYear, vehicleCountry);
}

export function formatAccidentType(
  t: (key: string) => string,
  type?: string | null,
): string | null {
  if (!type) return null;
  const normalized = type.toLowerCase();
  const key = ACCIDENT_TYPE_KEYS[normalized];
  if (key) {
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatAccidentDescription(
  t: (key: string) => string,
  language: Language,
  description?: string | null,
): string | null {
  const raw = description?.trim();
  if (!raw) return null;

  const claimLabel = translateInsuranceClaimType(t, raw);
  if (claimLabel && claimLabel !== raw.replace(/_/g, " ")) {
    return claimLabel;
  }

  const withPhrases = translateKoreanProviderText(t, raw) ?? raw;
  return translateProviderDateInText(withPhrases, language) ?? withPhrases;
}

export type AccidentSeverityContext = {
  vehicleCountry?: string | null;
  krwPerUsd?: number | null;
  hasKoreanInsuranceClaims?: boolean;
};

/** USD tiers: under $1,300 small · $1,300–$2,999 moderate · $3,000+ major */
export function resolveAccidentSeverityForDisplay(
  accident: {
    severity?: string | null;
    lossAmount?: number | null;
    type?: string | null;
    country?: string | null;
    currency?: string | null;
  },
  ctx: AccidentSeverityContext,
): string {
  const raw = accident.severity?.toLowerCase().trim();
  if (raw === "total_loss" || raw === "total loss") return "total_loss";

  if (accident.lossAmount != null && accident.lossAmount > 0) {
    const asKrw = shouldFormatAccidentLossAsKrw({
      currency: accident.currency,
      vehicleCountry: ctx.vehicleCountry,
      accidentType: accident.type,
      accidentCountry: accident.country,
      hasKoreanInsuranceClaims: ctx.hasKoreanInsuranceClaims,
    });
    const fromAmount = inferAccidentSeverityFromLossAmount(accident.lossAmount, {
      amountCurrency: asKrw ? "KRW" : "USD",
      krwPerUsd: ctx.krwPerUsd,
    });
    if (fromAmount) return fromAmount;
  }

  if (raw === "major" || raw === "severe") return "major";
  if (raw === "moderate") return "moderate";
  if (raw === "minor" || raw === "light") return "minor";
  if (raw === "unknown") return "unknown";
  // No price and no provider severity → do not invent "small accident".
  if (!raw) return "unknown";
  return raw;
}

export const ACCIDENT_SEVERITY_I18N_KEYS: Record<string, string> = {
  minor: "sev_minor",
  light: "sev_minor",
  moderate: "sev_moderate",
  major: "sev_major",
  severe: "sev_major",
  total_loss: "sev_total_loss",
  "total loss": "sev_total_loss",
  unknown: "sev_unknown",
};

export type AccidentSeverityStyle = {
  card: string;
  dot: string;
  text: string;
  amount: string;
};

/** Color coding: yellow = small · orange = moderate · red = major / total loss · muted = unknown */
export function accidentSeverityStyle(sev: string | null | undefined): AccidentSeverityStyle {
  const s = sev?.toLowerCase().trim() ?? "";

  if (s === "total_loss" || s.includes("total")) {
    return {
      card: "border-red-300 dark:border-red-800 bg-red-100 dark:bg-red-950/50",
      dot: "bg-red-600",
      text: "text-red-800 dark:text-red-300 font-semibold text-sm",
      amount: "text-red-800 dark:text-red-300 bg-red-100 dark:bg-red-950/50",
    };
  }

  if (s.includes("major") || s.includes("severe")) {
    return {
      card: "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40",
      dot: "bg-red-500",
      text: "text-red-700 dark:text-red-400 font-semibold text-sm",
      amount: "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40",
    };
  }

  if (s.includes("moderate")) {
    return {
      card: "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/40",
      dot: "bg-orange-500",
      text: "text-orange-700 dark:text-orange-400 font-semibold text-sm",
      amount: "text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40",
    };
  }

  if (s.includes("minor") || s.includes("light")) {
    return {
      card: "border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30",
      dot: "bg-yellow-500",
      text: "text-yellow-800 dark:text-yellow-400 font-semibold text-sm",
      amount: "text-yellow-800 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/40",
    };
  }

  // No amount / unknown severity — neutral, not yellow "small".
  return {
    card: "border-border bg-muted/40",
    dot: "bg-muted-foreground/60",
    text: "text-foreground font-semibold text-sm",
    amount: "text-muted-foreground bg-muted",
  };
}
