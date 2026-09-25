export type AccidentSignal = {
  severity?: string | null;
  date?: string | null;
  type?: string | null;
  description?: string | null;
  lossAmount?: number | null;
};

export type InsuranceClaimSignal = {
  date?: string | null;
  type?: string | null;
  lossAmount?: number | null;
};

export type RegistrySignal = {
  type?: string | null;
  title?: string | null;
  subtitle?: string | null;
  amount?: string | null;
  details?: Array<{ label?: string; value?: string | null }> | null;
};

export type AccidentSignalInput = {
  accidents?: AccidentSignal[] | null;
  accidentCount?: number | null;
  insuranceClaims?: InsuranceClaimSignal[] | null;
  registryHistory?: RegistrySignal[] | null;
};

export function registryEventHasDamageSignal(event: RegistrySignal): boolean {
  if (event.type === "insurance_event") return true;
  const blob = [
    event.title,
    event.subtitle,
    event.amount,
    ...(event.details ?? []).map((row) => `${row.label ?? ""} ${row.value ?? ""}`),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /\b(accident|collision|damage|repair cost|insurance processing|own damage|third.party|insurance event)\b/.test(blob);
}

import { inferAccidentSeverityFromLossAmount } from "@workspace/accident-severity";

function accidentScoringKey(accident: AccidentSignal): string {
  const date = (accident.date ?? "").trim().slice(0, 10);
  const amount = accident.lossAmount ?? 0;
  const desc = (accident.description ?? "").toLowerCase().replace(/\s+/g, " ").slice(0, 48);
  return `${date}|${amount}|${desc}`;
}

function dedupeAccidentsForScoring(accidents: AccidentSignal[]): AccidentSignal[] {
  const seen = new Set<string>();
  const result: AccidentSignal[] = [];
  for (const accident of accidents) {
    const key = accidentScoringKey(accident);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(accident);
  }
  return result;
}

function supplementalAccidentsFromClaims(
  claims: InsuranceClaimSignal[],
): AccidentSignal[] {
  return claims.map((claim) => ({
    date: claim.date,
    type: "insurance",
    description: claim.type,
    lossAmount: claim.lossAmount,
    severity: inferAccidentSeverityFromLossAmount(claim.lossAmount, { amountCurrency: "KRW" }),
  }));
}

function supplementalAccidentsFromRegistry(
  events: RegistrySignal[],
): AccidentSignal[] {
  return events
    .filter(registryEventHasDamageSignal)
    .map((event) => ({
      date: null,
      type: "registry",
      description: event.title ?? event.subtitle ?? null,
      lossAmount: null,
      severity: "moderate",
    }));
}

function accidentHasDate(accident: AccidentSignal): boolean {
  return Boolean(accident.date?.trim());
}

/** Unified accident list for scoring — uses accidents[] when present, else derives from claims/registry. */
export function accidentsForScoring(input: AccidentSignalInput): AccidentSignal[] {
  const provided = input.accidents ?? [];
  const dated = dedupeAccidentsForScoring(provided.filter(accidentHasDate));
  if (dated.length > 0) return dated;
  if (provided.length > 0) return [];

  const count = input.accidentCount ?? 0;
  if (count > 0) {
    return Array.from({ length: count }, () => ({ severity: "unknown" }));
  }

  const fromClaims = supplementalAccidentsFromClaims(input.insuranceClaims ?? []).filter(accidentHasDate);
  if (fromClaims.length > 0) return dedupeAccidentsForScoring(fromClaims);

  return dedupeAccidentsForScoring(
    supplementalAccidentsFromRegistry(input.registryHistory ?? []).filter(accidentHasDate),
  );
}

export function countAccidentSignals(input: AccidentSignalInput): number {
  return accidentsForScoring(input).length;
}

export function hasAccidentSignals(input: AccidentSignalInput): boolean {
  return countAccidentSignals(input) > 0;
}
