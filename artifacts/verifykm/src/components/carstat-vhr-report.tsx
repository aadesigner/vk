import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/context";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export type CarstatVhrReportMeta = {
  sourceId: number;
  sourceName: string;
  htmlUrl?: string | null;
  jsonUrl?: string | null;
  hasHtml?: boolean;
  hasJson?: boolean;
  reportId?: string | null;
  requestId?: string | null;
  fetchedAt?: string | null;
  chargedUsd?: number | null;
};

type Props = {
  vin: string;
  lookupId?: number | null;
  vehicleTitle: string;
  reports: CarstatVhrReportMeta[];
  className?: string;
};

/**
 * Carstat VHR report viewer — HTML via authenticated /html-proxy?sourceId=.
 * Tabs when auction/archive + Korean Insurance both delivered.
 */
export function CarstatVhrReport({
  vin,
  lookupId,
  vehicleTitle,
  reports,
  className,
}: Props) {
  const { t } = useTranslation();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const usable = useMemo(
    () =>
      reports.filter(
        (r) =>
          Number.isFinite(r.sourceId)
          && (r.hasHtml === true || !!(r.htmlUrl && r.htmlUrl.trim())),
      ),
    [reports],
  );
  const [activeSourceId, setActiveSourceId] = useState<number | null>(
    () => usable[0]?.sourceId ?? null,
  );
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [embedSrc, setEmbedSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!usable.length) {
      setActiveSourceId(null);
      return;
    }
    if (activeSourceId == null || !usable.some((r) => r.sourceId === activeSourceId)) {
      setActiveSourceId(usable[0]!.sourceId);
    }
  }, [usable, activeSourceId]);

  const active = usable.find((r) => r.sourceId === activeSourceId) ?? usable[0] ?? null;
  const canProxy = lookupId != null && lookupId > 0 && !!active;
  const proxyPath = canProxy && active
    ? `${basePath}/api/vin/${lookupId}/html-proxy?sourceId=${encodeURIComponent(String(active.sourceId))}`
    : null;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setEmbedSrc(null);
      setLoading(true);
      setFailed(false);

      if (!proxyPath) {
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
          }
          return;
        }
        try { await res.body?.cancel(); } catch { /* ignore */ }
        if (cancelled) return;
        setEmbedSrc(proxyPath);
        setLoading(false);
        setFailed(false);
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
  }, [proxyPath]);

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
    window.open(proxyPath, "_blank", "noopener,noreferrer");
  }, [proxyPath]);

  const title = active?.sourceName
    ? `${active.sourceName} — ${vin}`
    : `${t("what_we_check_report_title")} ${vin}`;

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
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl h-9 shrink-0"
            onClick={handlePrint}
            disabled={loading || failed || !embedSrc}
          >
            <Printer className="h-3.5 w-3.5 mr-1.5" />
            {t("vin_result_print")}
          </Button>
        )}
      </div>

      {usable.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {usable.map((r) => {
            const isActive = r.sourceId === active?.sourceId;
            return (
              <button
                key={r.sourceId}
                type="button"
                onClick={() => setActiveSourceId(r.sourceId)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors",
                  isActive
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-muted-foreground border-border hover:text-foreground",
                )}
              >
                {r.sourceName}
              </button>
            );
          })}
        </div>
      )}

      {proxyPath ? (
        <div
          className={cn(
            "relative w-full overflow-hidden rounded-xl border border-border/60 bg-neutral-100 dark:bg-neutral-950",
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
            </div>
          )}

          {embedSrc ? (
            <iframe
              key={`vhr-${active?.sourceId ?? 0}`}
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
