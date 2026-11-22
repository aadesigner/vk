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

/** True when description is a repaired-parts dump (belongs in Korea repair parts, not accidents). */
export function isPartsListAccidentDescription(description?: string | null): boolean {
  const raw = description?.trim();
  if (!raw) return false;
  // Structured money summary is OK to keep as narrative fallback.
  if (/paid\s*[\d,.\s]+/i.test(raw) && /(parts|labor|paint)\s*[\d,.\s]+/i.test(raw)) {
    return false;
  }
  if ((raw.match(/;/g) ?? []).length >= 2) return true;
  if (
    /removable|replacement|sheet metal|surface repair|detachable|repainted|\(painted\)|\(replace\)|\(repair\)/i.test(
      raw,
    )
  ) {
    return true;
  }
  return false;
}

/** Narrative line for accident cards — never the part-replaced dump. */
export function formatAccidentNarrativeDescription(
  t: (key: string) => string,
  language: Language,
  description?: string | null,
): string | null {
  if (isPartsListAccidentDescription(description)) return null;
  return formatAccidentDescription(t, language, description);
}

export type AccidentCostBreakdown = {
  lossAmount: number | null;
  partCost: number | null;
  laborCost: number | null;
  paintingCost: number | null;
};

function positiveOrNull(n: number | null | undefined): number | null {
  return n != null && Number.isFinite(n) && n > 0 ? n : null;
}

function parseMoneyTokenFromDesc(raw: string, label: RegExp): number | null {
  const m = raw.match(label);
  if (!m?.[1]) return null;
  const n = Number(m[1].replace(/[,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/**
 * Resolve paid / parts / labor / paint for accident expand UI.
 * Prefers accident fields, then same-day insurance claims, then moneyDesc parse.
 */
export function resolveAccidentCostBreakdown(
  accident: {
    date?: string | null;
    description?: string | null;
    lossAmount?: number | null;
    partCost?: number | null;
    laborCost?: number | null;
    paintingCost?: number | null;
  },
  claims?: Array<{
    date?: string | null;
    lossAmount?: number | null;
    partCost?: number | null;
    laborCost?: number | null;
    paintingCost?: number | null;
  }> | null,
): AccidentCostBreakdown {
  let lossAmount = positiveOrNull(accident.lossAmount);
  let partCost = positiveOrNull(accident.partCost);
  let laborCost = positiveOrNull(accident.laborCost);
  let paintingCost = positiveOrNull(accident.paintingCost);

  if ((partCost == null || laborCost == null || paintingCost == null) && claims?.length) {
    const day = (accident.date ?? "").slice(0, 10);
    if (day) {
      const sameDay = claims.filter((c) => (c.date ?? "").slice(0, 10) === day);
      if (sameDay.length) {
        const sum = (pick: (c: (typeof sameDay)[number]) => number | null | undefined) => {
          let total = 0;
          let any = false;
          for (const c of sameDay) {
            const v = positiveOrNull(pick(c));
            if (v != null) {
              total += v;
              any = true;
            }
          }
          return any ? total : null;
        };
        partCost = partCost ?? sum((c) => c.partCost);
        laborCost = laborCost ?? sum((c) => c.laborCost);
        paintingCost = paintingCost ?? sum((c) => c.paintingCost);
        lossAmount = lossAmount ?? sum((c) => c.lossAmount);
      }
    }
  }

  const desc = accident.description ?? "";
  if (desc && !isPartsListAccidentDescription(desc)) {
    lossAmount = lossAmount ?? parseMoneyTokenFromDesc(desc, /paid\s*([\d,.\s]+)/i);
    partCost = partCost ?? parseMoneyTokenFromDesc(desc, /parts\s*([\d,.\s]+)/i);
    laborCost = laborCost ?? parseMoneyTokenFromDesc(desc, /labor\s*([\d,.\s]+)/i);
    paintingCost = paintingCost ?? parseMoneyTokenFromDesc(desc, /paint(?:ing)?\s*([\d,.\s]+)/i);
  }

  return { lossAmount, partCost, laborCost, paintingCost };
}

export type AccidentSeverityContext = {
  vehicleCountry?: string | null;
  krwPerUsd?: number | null;
  hasKoreanInsuranceClaims?: boolean;
  /** Same-day claims fill loss when accident.lossAmount is empty (KR insurance + inspection reports). */
  insuranceClaims?: Array<{
    date?: string | null;
    lossAmount?: number | null;
    partCost?: number | null;
    laborCost?: number | null;
    paintingCost?: number | null;
  }> | null;
};

/** USD tiers: under $1,300 small · $1,300–$2,999 moderate · $3,000+ major */
export function resolveAccidentSeverityForDisplay(
  accident: {
    severity?: string | null;
    lossAmount?: number | null;
    partCost?: number | null;
    laborCost?: number | null;
    paintingCost?: number | null;
    date?: string | null;
    description?: string | null;
    type?: string | null;
    country?: string | null;
    currency?: string | null;
  },
  ctx: AccidentSeverityContext,
): string {
  const raw = accident.severity?.toLowerCase().trim();
  if (raw === "total_loss" || raw === "total loss") return "total_loss";

  const costs = resolveAccidentCostBreakdown(accident, ctx.insuranceClaims);
  const amountFromParts =
    (costs.partCost ?? 0) + (costs.laborCost ?? 0) + (costs.paintingCost ?? 0);
  const amount =
    costs.lossAmount
    ?? (amountFromParts > 0 ? amountFromParts : null);

  if (amount != null && amount > 0) {
    const asKrw = shouldFormatAccidentLossAsKrw({
      currency: accident.currency,
      vehicleCountry: ctx.vehicleCountry,
      accidentType: accident.type,
      accidentCountry: accident.country,
      hasKoreanInsuranceClaims: ctx.hasKoreanInsuranceClaims,
    });
    const fromAmount = inferAccidentSeverityFromLossAmount(amount, {
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
