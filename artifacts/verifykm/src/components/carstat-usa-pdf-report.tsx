import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Printer, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/context";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Max manual report refreshes per unlocked VIN (persisted in localStorage). */
const MAX_MANUAL_RETRIES = 4;
/** First refresh unlocks after 5 minutes from first successful/failed load. */
const FIRST_RETRY_AFTER_MS = 5 * 60 * 1000;
/** Later refreshes: once per day. */
const LATER_RETRY_AFTER_MS = 24 * 60 * 60 * 1000;

export type CarstatUsaPdfReportMeta = {
  type: "carfax" | "autocheck";
  /** Always redacted on the client — use proxy flags instead. */
  pdfUrl?: string | null;
  htmlUrl?: string | null;
  hasPdf?: boolean;
  hasHtml?: boolean;
  reportId?: number | null;
  vehicle?: string | null;
  fetchedAt?: string;
};

type Props = {
  vin: string;
  lookupId?: number | null;
  vehicleTitle: string;
  pdfReport: CarstatUsaPdfReportMeta;
  className?: string;
};

type RetryState = {
  /** Successful refresh clicks used (0..MAX). */
  count: number;
  /** When the report view first finished a load attempt (starts the 5‑min clock). */
  openedAt: number;
  /** Timestamp of last refresh click. */
  lastRetryAt: number | null;
};

function retryStorageKey(lookupId: number, vin: string): string {
  return `usa-html-retry:v1:${lookupId}:${vin.trim().toUpperCase()}`;
}

function readRetryState(lookupId: number, vin: string): RetryState {
  const fallback: RetryState = { count: 0, openedAt: Date.now(), lastRetryAt: null };
  try {
    const raw = localStorage.getItem(retryStorageKey(lookupId, vin));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<RetryState>;
    return {
      count: Math.max(0, Math.min(MAX_MANUAL_RETRIES, Number(parsed.count) || 0)),
      openedAt: Number(parsed.openedAt) || fallback.openedAt,
      lastRetryAt: parsed.lastRetryAt == null ? null : Number(parsed.lastRetryAt) || null,
    };
  } catch {
    return fallback;
  }
}

function writeRetryState(lookupId: number, vin: string, state: RetryState): void {
  try {
    localStorage.setItem(retryStorageKey(lookupId, vin), JSON.stringify(state));
  } catch {
    /* private mode / quota */
  }
}

/** Next time a refresh is allowed, or null if exhausted. */
function nextRetryAt(state: RetryState): number | null {
  if (state.count >= MAX_MANUAL_RETRIES) return null;
  if (state.count === 0) return state.openedAt + FIRST_RETRY_AFTER_MS;
  const last = state.lastRetryAt ?? state.openedAt;
  return last + LATER_RETRY_AFTER_MS;
}

function formatWait(ms: number): string {
  if (ms <= 0) return "";
  const sec = Math.ceil(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.ceil(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.ceil(min / 60);
  if (hr < 48) return `${hr}h`;
  const days = Math.ceil(hr / 24);
  return `${days}d`;
}

/**
 * Carstat USA report view — HTML mirror only (authenticated /html-proxy).
 * Never embeds provider CDN URLs; never uses the PDF path in the customer UI.
 */
export function CarstatUsaPdfReport({
  vin,
  lookupId,
  vehicleTitle,
  pdfReport,
  className,
}: Props) {
  const { t } = useTranslation();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [embedSrc, setEmbedSrc] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [retryState, setRetryState] = useState<RetryState>(() =>
    lookupId != null && lookupId > 0
      ? readRetryState(lookupId, vin)
      : { count: 0, openedAt: Date.now(), lastRetryAt: null },
  );
  const [now, setNow] = useState(() => Date.now());

  const hasHtml = pdfReport.hasHtml === true || !!(pdfReport.htmlUrl && pdfReport.htmlUrl.trim());
  const canProxy = lookupId != null && lookupId > 0 && hasHtml;
  const proxyPath = canProxy ? `${basePath}/api/vin/${lookupId}/html-proxy` : null;

  const retriesLeft = Math.max(0, MAX_MANUAL_RETRIES - retryState.count);
  const allowedAt = nextRetryAt(retryState);
  const waitMs = allowedAt == null ? 0 : Math.max(0, allowedAt - now);
  const onCooldown = allowedAt != null && waitMs > 0;
  const canRetry = !loading && retriesLeft > 0 && !onCooldown && allowedAt != null;

  useEffect(() => {
    if (lookupId == null || lookupId <= 0) return;
    const existing = readRetryState(lookupId, vin);
    setRetryState(existing);
  }, [lookupId, vin]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setEmbedSrc(null);
      setLoading(true);
      setFailed(false);

      if (!proxyPath || lookupId == null) {
        setLoading(false);
        setFailed(true);
        return;
      }

      try {
        const res = await fetch(proxyPath, {
          credentials: "include",
          headers: { Accept: "text/html,*/*" },
        });
        if (!res.ok) {
          try { await res.body?.cancel(); } catch { /* ignore */ }
          if (!cancelled) {
            setLoading(false);
            setFailed(true);
            setRetryState((prev) => {
              const next = { ...prev, openedAt: prev.openedAt || Date.now() };
              writeRetryState(lookupId, vin, next);
              return next;
            });
          }
          return;
        }
        try { await res.body?.cancel(); } catch { /* ignore */ }
        if (cancelled) return;
        setEmbedSrc(proxyPath);
        setLoading(false);
        setFailed(false);
        setRetryState((prev) => {
          const next = { ...prev, openedAt: prev.openedAt || Date.now() };
          writeRetryState(lookupId, vin, next);
          return next;
        });
      } catch {
        if (!cancelled) {
          setLoading(false);
          setFailed(true);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [proxyPath, reloadKey, lookupId, vin]);

  const handlePrint = useCallback(() => {
    const frame = frameRef.current;
    try {
      if (frame?.contentWindow) {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        return;
      }
    } catch {
      /* ignore */
    }
    if (!proxyPath) return;
    const w = window.open(proxyPath, "_blank", "noopener,noreferrer");
    if (!w) return;
    w.addEventListener("load", () => {
      window.setTimeout(() => {
        try {
          w.focus();
          w.print();
        } catch {
          /* ignore */
        }
      }, 400);
    });
  }, [proxyPath]);

  const handleReload = useCallback(() => {
    if (loading || lookupId == null) return;
    const current = readRetryState(lookupId, vin);
    const gate = nextRetryAt(current);
    if (gate == null || Date.now() < gate) return;
    if (current.count >= MAX_MANUAL_RETRIES) return;

    const next: RetryState = {
      ...current,
      count: current.count + 1,
      lastRetryAt: Date.now(),
    };
    writeRetryState(lookupId, vin, next);
    setRetryState(next);
    setNow(Date.now());
    setReloadKey((k) => k + 1);
  }, [loading, lookupId, vin]);

  const title = `${t("what_we_check_report_title")} ${vin}`;
  const waitLabel = formatWait(waitMs);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between min-w-0">
        <div className="min-w-0 space-y-0.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {t("what_we_check_report_title")}
          </p>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{vehicleTitle}</h2>
          <p className="font-mono text-xs text-muted-foreground">{vin}</p>
        </div>
        {proxyPath && (
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {retriesLeft > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl h-9"
                onClick={handleReload}
                disabled={!canRetry}
                title={
                  onCooldown
                    ? `${t("retry")} (${waitLabel})`
                    : `${t("retry")} (${retriesLeft}/${MAX_MANUAL_RETRIES})`
                }
              >
                <RotateCcw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
                {onCooldown ? `${t("retry")} ${waitLabel}` : t("retry")}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl h-9"
              onClick={handlePrint}
              disabled={loading || failed || !embedSrc}
            >
              <Printer className="h-3.5 w-3.5 mr-1.5" />
              {t("vin_result_print")}
            </Button>
          </div>
        )}
      </div>

      {proxyPath ? (
        <div
          className={cn(
            "relative w-full overflow-hidden rounded-xl border border-border/60 bg-neutral-100 dark:bg-neutral-950",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
            "min-h-[calc(100dvh-11rem)] h-[calc(100dvh-11rem)]",
          )}
        >
          {loading && !failed && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-muted/40 backdrop-blur-[2px]">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
              <p className="text-sm text-muted-foreground">{t("loading_report")}</p>
            </div>
          )}

          {failed && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-4 bg-muted/50">
              <p className="text-sm text-muted-foreground text-center max-w-sm">
                Report file is not available yet. Try refreshing in a moment.
              </p>
              {canRetry ? (
                <Button type="button" variant="outline" className="rounded-xl" onClick={handleReload}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  {t("retry")}
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground text-center">
                  {retriesLeft <= 0
                    ? "Retry limit reached."
                    : onCooldown
                      ? `${t("retry")} available in ${waitLabel}`
                      : `${t("retry")} unavailable`}
                </p>
              )}
            </div>
          )}

          {embedSrc ? (
            <iframe
              key={`html-${reloadKey}`}
              ref={frameRef}
              title={title}
              src={embedSrc}
              className={cn(
                "absolute inset-0 h-full w-full border-0 bg-background",
                (loading || failed) && "opacity-0",
              )}
              referrerPolicy="no-referrer"
              sandbox="allow-same-origin allow-scripts allow-modals"
              onLoad={() => {
                setLoading(false);
                setFailed(false);
              }}
            />
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-16">
          Report file is not available yet. Try refreshing in a moment.
        </p>
      )}
    </div>
  );
}
