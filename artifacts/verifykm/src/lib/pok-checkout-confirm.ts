export const POK_CHECKOUT_SESSION_KEY = "verifykm_pok_checkout";

export type PokCheckoutSessionPhase = "created" | "confirm";

export type PokCheckoutSession = {
  orderId: string;
  vin?: string;
  /** credits checkout omits vin */
  kind?: "vin_report" | "credit_pack";
  /** `confirm` = POK SDK reported success; safe to retry server confirm. */
  phase?: PokCheckoutSessionPhase;
};

const POK_ORDER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readPokCheckoutSession(): PokCheckoutSession | null {
  if (typeof sessionStorage === "undefined") return null;
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(POK_CHECKOUT_SESSION_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { orderId?: string; vin?: string; kind?: string };
    const orderId = parsed.orderId?.trim() ?? "";
    if (!POK_ORDER_ID_RE.test(orderId)) return null;
    const kind =
      parsed.kind === "credit_pack" ? "credit_pack" as const
      : parsed.kind === "vin_report" ? "vin_report" as const
      : undefined;
    const phase =
      parsed.phase === "confirm" ? "confirm" as const
      : parsed.phase === "created" ? "created" as const
      : undefined;
    return { orderId, vin: parsed.vin?.trim() || undefined, kind, phase };
  } catch {
    return null;
  }
}

export function writePokCheckoutSession(session: PokCheckoutSession): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(
    POK_CHECKOUT_SESSION_KEY,
    JSON.stringify({
      orderId: session.orderId,
      vin: session.vin,
      kind: session.kind ?? (session.vin ? "vin_report" : "credit_pack"),
      phase: session.phase,
    }),
  );
}

export function markPokCheckoutAwaitingConfirm(session: Omit<PokCheckoutSession, "phase">): void {
  writePokCheckoutSession({ ...session, phase: "confirm" });
}

export function clearPokCheckoutSession(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(POK_CHECKOUT_SESSION_KEY);
}

export type PokConfirmApiResult = {
  success?: boolean;
  error?: string;
  code?: string;
  retryable?: boolean;
  vin?: string;
  paymentId?: number;
  creditsAdded?: number;
  creditBalance?: number;
};

export type ConfirmPokWithRetryOptions = {
  /** Total attempts including the first (default 4). */
  maxAttempts?: number;
  /** Delay before retry attempts in ms (default [2000, 4000, 8000]). */
  retryDelaysMs?: number[];
  shouldContinue?: () => boolean;
};

function isRetryableConfirmFailure(status: number, data: PokConfirmApiResult): boolean {
  if (data.retryable === true) return true;
  if (data.retryable === false) return false;
  if (status === 503 || status === 429 || status === 402) return true;
  if (data.code === "PAYMENT_NOT_COMPLETED" || data.code === "PAYMENT_CONFIRM_FAILED") return true;
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * POST confirm-pok with backoff when POK is still settling or the network blips.
 * Server also polls POK — this covers client-side gaps between POK UI success and API readiness.
 */
export async function confirmPokOrderWithRetry(
  fetchConfirm: () => Promise<Response>,
  opts?: ConfirmPokWithRetryOptions,
): Promise<{ ok: true; data: PokConfirmApiResult } | { ok: false; data: PokConfirmApiResult; status: number }> {
  const maxAttempts = opts?.maxAttempts ?? 4;
  const retryDelaysMs = opts?.retryDelaysMs ?? [2_000, 4_000, 8_000];
  const shouldContinue = opts?.shouldContinue ?? (() => true);

  let lastStatus = 0;
  let lastData: PokConfirmApiResult = {};

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (!shouldContinue()) {
      return { ok: false, data: lastData, status: lastStatus || 499 };
    }
    if (attempt > 0) {
      await sleep(retryDelaysMs[Math.min(attempt - 1, retryDelaysMs.length - 1)]!);
    }

    try {
      const resp = await fetchConfirm();
      lastStatus = resp.status;
      lastData = await resp.json() as PokConfirmApiResult;
      if (resp.ok && lastData.success) {
        return { ok: true, data: lastData };
      }
      if (attempt < maxAttempts - 1 && isRetryableConfirmFailure(resp.status, lastData)) {
        continue;
      }
      return { ok: false, data: lastData, status: resp.status };
    } catch {
      lastStatus = 0;
      lastData = { code: "PAYMENT_CONFIRM_FAILED" };
      if (attempt < maxAttempts - 1) continue;
      return { ok: false, data: lastData, status: 0 };
    }
  }

  return { ok: false, data: lastData, status: lastStatus };
}
