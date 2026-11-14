/**
 * Carstat Korean Insurance (source 68) availability-check quota.
 *
 * Other VHR sources remain free to check. Only evaluating source 68 via
 * POST /api/vhr/checks burns this pool (~10 start; +10 per paid 68 report).
 */
import { logger } from "./logger.js";

export type CarstatVhrQuotaConfig = { apiKey: string; baseUrl: string };

const QUOTA_REFRESH_MS = Math.max(
  15_000,
  Number(process.env.CARSTAT_VHR_QUOTA_REFRESH_MS ?? 60_000) || 60_000,
);
/**
 * Keep 2 spare KR availability checks. When remaining ≤ 2 we never include
 * source 68 in /checks and post-pay uses force:true instead.
 */
export const KR_CHECK_SPARE = 2;
/** Soft ceiling of KR-including checks between paid refills. */
export const KR_CHECK_SOFT_CEILING = 9;

export type KoreanInsuranceCheckQuota = {
  remaining: number | null;
  fetchedAt: string | null;
  exhausted: boolean;
  /** Process-local KR-including checks since last paid 68 / refresh. */
  spentSinceRefill: number;
  canSpend: boolean;
  source: "live" | "cache" | "unavailable";
};

type QuotaSnapshot = {
  remaining: number | null;
  fetchedAt: number;
  exhausted: boolean;
  spentSinceRefill: number;
};

let snapshot: QuotaSnapshot = {
  remaining: null,
  fetchedAt: 0,
  exhausted: false,
  spentSinceRefill: 0,
};

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

/** Best-effort parse of GET /api/vhr/check-quotas (shape may vary). */
export function parseKoreanInsuranceRemaining(body: unknown): number | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const root = body as Record<string, unknown>;

  const direct =
    num(root.korean_insurance_remaining)
    ?? num(root.koreanInsuranceRemaining)
    ?? num(root.korean_insurance_checks_remaining)
    ?? num(root.remaining_checks)
    ?? num(root.remainingChecks)
    ?? num(root.remaining);
  if (direct != null) return Math.max(0, Math.floor(direct));

  const quotas = root.quotas ?? root.check_quotas ?? root.sources ?? root.data;
  if (Array.isArray(quotas)) {
    for (const row of quotas) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const r = row as Record<string, unknown>;
      const id = num(r.source_id ?? r.sourceId ?? r.id);
      const name = (str(r.name) ?? "").toLowerCase();
      const isKr =
        id === 68
        || id === 11
        || /korean\s+insurance/i.test(name);
      if (!isKr) continue;
      // Live Carstat shape: { source_id: 68, remaining_checks: N, ... }
      const rem =
        num(r.remaining_checks)
        ?? num(r.remainingChecks)
        ?? num(r.remaining)
        ?? num(r.checks_remaining)
        ?? num(r.checksRemaining)
        ?? num(r.available)
        ?? num(r.quota);
      if (rem != null) return Math.max(0, Math.floor(rem));
    }
  }

  if (quotas && typeof quotas === "object" && !Array.isArray(quotas)) {
    const map = quotas as Record<string, unknown>;
    for (const key of ["68", "11", "korean_insurance", "koreanInsurance"]) {
      const entry = map[key];
      if (typeof entry === "number") return Math.max(0, Math.floor(entry));
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        const e = entry as Record<string, unknown>;
        const rem =
          num(e.remaining_checks)
          ?? num(e.remainingChecks)
          ?? num(e.remaining)
          ?? num(e.checks_remaining);
        if (rem != null) return Math.max(0, Math.floor(rem));
      }
    }
  }

  return null;
}

function computeCanSpend(s: QuotaSnapshot): boolean {
  if (s.exhausted) return false;
  if (s.spentSinceRefill >= KR_CHECK_SOFT_CEILING) return false;
  if (s.remaining == null) {
    return s.spentSinceRefill < KR_CHECK_SOFT_CEILING;
  }
  return s.remaining > KR_CHECK_SPARE;
}

function toPublic(source: KoreanInsuranceCheckQuota["source"]): KoreanInsuranceCheckQuota {
  return {
    remaining: snapshot.remaining,
    fetchedAt: snapshot.fetchedAt ? new Date(snapshot.fetchedAt).toISOString() : null,
    exhausted: snapshot.exhausted,
    spentSinceRefill: snapshot.spentSinceRefill,
    canSpend: computeCanSpend(snapshot),
    source,
  };
}

export function getCachedKoreanInsuranceCheckQuota(): KoreanInsuranceCheckQuota {
  return toPublic(snapshot.fetchedAt ? "cache" : "unavailable");
}

export function markKoreanInsuranceCheckQuotaExhausted(reason?: string): void {
  snapshot = {
    ...snapshot,
    remaining: 0,
    exhausted: true,
    fetchedAt: Date.now(),
  };
  logger.warn({ msg: "carstat_vhr_kr_check_quota_exhausted", reason: reason ?? null });
}

/** Call after a POST /checks that included source 68. */
export function recordKoreanInsuranceCheckSpent(): void {
  const nextRemaining = snapshot.remaining == null ? null : Math.max(0, snapshot.remaining - 1);
  snapshot = {
    ...snapshot,
    spentSinceRefill: snapshot.spentSinceRefill + 1,
    remaining: nextRemaining,
    exhausted: nextRemaining != null ? nextRemaining <= 0 : snapshot.exhausted,
    fetchedAt: snapshot.fetchedAt || Date.now(),
  };
}

/** Call after a successful paid source-68 report (provider refills +10). */
export function recordKoreanInsuranceReportPaid(): void {
  snapshot = {
    remaining: snapshot.remaining == null ? null : snapshot.remaining + 10,
    fetchedAt: Date.now(),
    exhausted: false,
    spentSinceRefill: 0,
  };
  logger.info({
    msg: "carstat_vhr_kr_check_quota_refilled",
    remaining: snapshot.remaining,
  });
}

export async function refreshKoreanInsuranceCheckQuota(
  cfg: CarstatVhrQuotaConfig,
  opts?: { force?: boolean },
): Promise<KoreanInsuranceCheckQuota> {
  const now = Date.now();
  if (
    !opts?.force
    && snapshot.fetchedAt
    && now - snapshot.fetchedAt < QUOTA_REFRESH_MS
    && snapshot.remaining != null
  ) {
    return toPublic("cache");
  }

  const base = cfg.baseUrl.replace(/\/$/, "").replace("://api.carstat.dev", "://carstat.dev");
  const url = `${base}/api/vhr/check-quotas`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-api-key": cfg.apiKey,
      },
      signal: AbortSignal.timeout(8_000),
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    if (!res.ok) {
      logger.warn({
        msg: "carstat_vhr_check_quotas_http_error",
        status: res.status,
        body: text.slice(0, 160),
      });
      return toPublic(snapshot.fetchedAt ? "cache" : "unavailable");
    }
    const remaining = parseKoreanInsuranceRemaining(body);
    if (remaining == null) {
      logger.warn({
        msg: "carstat_vhr_check_quotas_unparsed",
        bodyPreview: typeof body === "object" ? JSON.stringify(body).slice(0, 400) : String(body).slice(0, 400),
      });
    }
    snapshot = {
      remaining,
      fetchedAt: now,
      exhausted: remaining != null ? remaining <= 0 : snapshot.exhausted,
      spentSinceRefill: remaining != null && remaining > KR_CHECK_SPARE ? 0 : snapshot.spentSinceRefill,
    };
    logger.info({
      msg: "carstat_vhr_check_quotas_ok",
      remaining,
      canSpend: computeCanSpend(snapshot),
    });
    return toPublic("live");
  } catch (err) {
    logger.warn({
      msg: "carstat_vhr_check_quotas_failed",
      err: err instanceof Error ? err.message : String(err),
    });
    return toPublic(snapshot.fetchedAt ? "cache" : "unavailable");
  }
}

export async function getKoreanInsuranceCheckQuota(
  cfg: CarstatVhrQuotaConfig | null,
  opts?: { force?: boolean },
): Promise<KoreanInsuranceCheckQuota> {
  if (!cfg) return toPublic("unavailable");
  return refreshKoreanInsuranceCheckQuota(cfg, opts);
}

export function canIncludeKoreanInsuranceInCheck(): boolean {
  return computeCanSpend(snapshot);
}

/**
 * Korean WMI only (K*). Prefer shouldForceKoreanInsuranceReport() for full
 * Korean-market gating (country / inspections signals for import VINs).
 */
export function isForceKoreanInsuranceVin(vin: string): boolean {
  return /^K/i.test(vin.trim());
}

/** Test helper — reset process-local quota state. */
export function __resetKoreanInsuranceCheckQuotaForTests( partial?: Partial<QuotaSnapshot>): void {
  snapshot = {
    remaining: partial?.remaining ?? null,
    fetchedAt: partial?.fetchedAt ?? 0,
    exhausted: partial?.exhausted ?? false,
    spentSinceRefill: partial?.spentSinceRefill ?? 0,
  };
}
