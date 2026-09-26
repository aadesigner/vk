import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { PrefetchLink } from "@/components/prefetch-link";
import {
  Car, ChevronRight, CheckCircle2, XCircle, Clock, AlertCircle, Trash2, ArrowUpDown,
} from "lucide-react";
import type { VinLookup, VinLookupStatus } from "@workspace/api-client-react";
import type { UseMutationResult } from "@tanstack/react-query";
import { useTranslation } from "@/i18n/context";
import { formatAccidentCount } from "@/lib/format-accident-count";
import { countAccidentSignals, hasAccidentSignals } from "@/lib/accident-signals";
import { resolveLatestRecordedOdometer } from "@/lib/resolve-latest-odometer";
import {
  DASHBOARD_FILTER_THRESHOLD,
  sortDashboardLookups,
  type DashboardLookupSort,
} from "@/lib/filter-dashboard-lookups";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VinCaseId } from "@/components/vin-case-id";
import { cn } from "@/lib/utils";
import {
  isVinImageSessionLoaded,
  markVinImageSessionLoaded,
} from "@/lib/vin-image-cache";
import { withVinImageCardSize } from "@/lib/report-photos";

const SORT_OPTIONS: DashboardLookupSort[] = [
  "newest",
  "oldest",
  "year_desc",
  "year_asc",
];

const SORT_LABEL_KEYS: Record<DashboardLookupSort, string> = {
  newest: "dashboard_filter_newest",
  oldest: "dashboard_filter_oldest",
  year_desc: "dashboard_filter_year_new",
  year_asc: "dashboard_filter_year_old",
};

export const DASHBOARD_REPORTS_PER_PAGE = 12;

function isViewableReportStatus(status: string) {
  return status === "complete" || status === "pending_manual";
}

function StatusBadge({ status }: { status: VinLookupStatus | string }) {
  const { t } = useTranslation();
  const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode; className?: string }> = {
    complete: { variant: "default", icon: <CheckCircle2 className="h-3 w-3 mr-1" />, className: "bg-[#00a5fd] hover:bg-[#008fd9] text-white border-0" },
    pending: { variant: "secondary", icon: <Clock className="h-3 w-3 mr-1" /> },
    pending_manual: { variant: "secondary", icon: <Clock className="h-3 w-3 mr-1" />, className: "bg-[#00a5fd]/15 text-[#0077c8] dark:text-[#7dd3fc] border-[#00a5fd]/35" },
    fulfilling: { variant: "secondary", icon: <Clock className="h-3 w-3 mr-1" /> },
    processing: { variant: "outline", icon: <AlertCircle className="h-3 w-3 mr-1" /> },
    error: { variant: "destructive", icon: <XCircle className="h-3 w-3 mr-1" /> },
  };
  const { variant, icon, className } = config[status] ?? config.pending;
  const labelMap: Record<string, string> = {
    complete: t("completed"),
    error: t("failed"),
    pending: t("pending"),
    pending_manual: t("pending_report_badge"),
    fulfilling: t("processing_retrieving_data"),
    processing: t("processing"),
  };
  return (
    <Badge variant={variant} className={cn("flex items-center w-fit text-[10px] sm:text-xs shrink-0 px-1.5 py-0 sm:px-2 sm:py-0.5", className)}>
      {icon}{labelMap[status] ?? status}
    </Badge>
  );
}

type DeleteMutation = UseMutationResult<unknown, unknown, { id: number }, unknown>;

function resolveReportPhotoCandidates(data: VinLookup["data"]): string[] {
  const vd = data as { photos?: string[]; thumbnailUrl?: string | null } | null | undefined;
  if (!vd) return [];
  const fromPhotos = Array.isArray(vd.photos)
    ? vd.photos.filter((p): p is string => typeof p === "string" && p.length > 0)
    : [];
  if (fromPhotos.length > 0) return fromPhotos.slice(0, 4).map((url) => withVinImageCardSize(url));
  if (typeof vd.thumbnailUrl === "string" && vd.thumbnailUrl) {
    return [withVinImageCardSize(vd.thumbnailUrl)];
  }
  return [];
}

function ReportListThumbnail({ sources, alt }: { sources: string[]; alt: string }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [srcIndex, setSrcIndex] = useState(0);
  const src = sources[srcIndex];
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(() => (src ? isVinImageSessionLoaded(src) : false));

  const markReady = useCallback(() => {
    if (!src) return;
    markVinImageSessionLoaded(src);
    setReady(true);
    setFailed(false);
  }, [src]);

  useEffect(() => {
    setSrcIndex(0);
    setFailed(false);
    setReady(sources[0] ? isVinImageSessionLoaded(sources[0]) : false);
  }, [sources.join("\0")]); // eslint-disable-line react-hooks/exhaustive-deps -- URL identity

  useEffect(() => {
    setFailed(false);
    setReady(src ? isVinImageSessionLoaded(src) : false);
  }, [src]);

  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) markReady();
  }, [src, markReady]);

  if (!src || failed) {
    return (
      <div className="report-list-thumb-fallback h-11 w-11 sm:h-14 sm:w-14 bg-primary/10 flex items-center justify-center">
        <Car className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
      </div>
    );
  }

  return (
    <>
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className={cn(
          "report-list-thumb h-11 w-[3.25rem] sm:h-14 sm:w-[4.5rem] object-cover transition-transform duration-200 group-hover/thumb:scale-[1.03]",
          !ready && "opacity-0",
        )}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={markReady}
        onError={() => {
          if (srcIndex + 1 < sources.length) {
            setSrcIndex((i) => i + 1);
            return;
          }
          setFailed(true);
        }}
      />
      {!ready && (
        <div className="report-list-thumb-fallback absolute inset-0 h-11 w-11 sm:h-14 sm:w-14 bg-primary/10 flex items-center justify-center">
          <Car className="h-4 w-4 sm:h-5 sm:w-5 text-primary animate-pulse" />
        </div>
      )}
    </>
  );
}

/** Monospace key/value pair for the case-file metadata strip. */
function FileMeta({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <span className="shrink-0 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/60">
        {label}
      </span>
      <span
        className={cn(
          "truncate font-mono text-[10px] font-semibold tabular-nums sm:text-[11px]",
          accent ? "text-amber-600 dark:text-amber-400" : "text-foreground/80",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function ReportCard({
  lookup,
  fileNo,
  language,
  deleteLookup,
}: {
  lookup: VinLookup;
  fileNo: number;
  language: string;
  deleteLookup: DeleteMutation;
}) {
  const { t } = useTranslation();
  const vd = lookup.data as (NonNullable<VinLookup["data"]> & {
    country?: string | null;
    registryHistory?: Array<{ mileage?: number | null; details?: Array<{ value?: string | null }> }>;
  }) | null | undefined;
  const odometer = resolveLatestRecordedOdometer({
    odometer: vd?.odometer,
    odometerLocked: vd?.odometerLocked === true,
    country: vd?.country,
    mileageHistory: vd?.mileageHistory as Array<{ odometer?: number | null }> | undefined,
    ownerHistory: vd?.ownerHistory as Array<{ mileage?: number | null }> | undefined,
    registryHistory: vd?.registryHistory as Array<{ mileage?: number | null; details?: Array<{ value?: string | null }> }> | undefined,
  });
  const make = vd?.make;
  const model = vd?.model;
  const year = vd?.year;
  const isPendingManual = lookup.status === "pending_manual";
  const pendingVehicleName = [make ?? null, year ? String(year) : null].filter(Boolean).join(" ") || null;
  // Always surface make/year even when model is unknown.
  const vehicleName = isPendingManual
    ? pendingVehicleName
    : make
      ? `${year ? `${year} ` : ""}${make}${model ? ` ${model}` : ""}`.trim()
      : null;
  const accidentSignalInput = {
    accidents: vd?.accidents as Array<{ severity?: string | null }> | undefined,
    accidentCount: vd?.accidentCount,
    insuranceClaims: vd?.insuranceClaims as Array<{ date?: string | null; type?: string | null; lossAmount?: number | null }> | undefined,
    registryHistory: vd?.registryHistory as Array<{ type?: string; title?: string | null; subtitle?: string | null; amount?: string | null; details?: Array<{ label?: string; value?: string | null }> }> | undefined,
  };
  const hasAccident = hasAccidentSignals(accidentSignalInput);
  const accidentCount = countAccidentSignals(accidentSignalInput);
  const hasMileage = odometer != null;
  const isSalvage = vd?.isSalvage === true;
  const hasDamageFlag = hasAccident || isSalvage;
  const photoCandidates = resolveReportPhotoCandidates(vd ?? undefined);
  const reportHref = `/${language}/vin/${lookup.vin}`;
  const viewable = isViewableReportStatus(lookup.status);

  const openedOn = new Date(lookup.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const findings = hasAccident
    ? formatAccidentCount(t, accidentCount)
    : isSalvage
      ? t("badge_salvage")
      : isPendingManual
        ? "—"
        : t("dashboard_findings_none");

  return (
    <div
      className={cn(
        "report-list-card group relative flex items-stretch overflow-hidden rounded-md border border-[#00a5fd]/15 bg-[#f8fafc] transition-all dark:border-[#00a5fd]/20 dark:bg-[#060a14]",
        isPendingManual && "border-[#00a5fd]/35 bg-[#00a5fd]/[0.04]",
        viewable
          ? "cursor-pointer hover:border-[#00a5fd]/50 hover:shadow-[0_8px_28px_-14px_rgba(0,165,253,0.45)]"
          : "hover:border-border/80",
      )}
    >
      <div
        aria-hidden
        className={cn(
          "w-1 shrink-0",
          lookup.status === "complete" || lookup.status === "pending_manual" ? "bg-[#00a5fd]" : lookup.status === "error" ? "bg-red-500" : "bg-amber-400",
        )}
      />
      {isPendingManual && (
        <div className="pending-vin-border-scan pointer-events-none absolute inset-0" />
      )}
      {viewable && (
        <PrefetchLink
          href={reportHref}
          className="absolute inset-0 z-10"
          aria-label={`${t("view_report")} ${lookup.vin}`}
        >
          <span className="sr-only">{t("view_report")}</span>
        </PrefetchLink>
      )}

      <div className="min-w-0 flex-1">
        {/* File header — case label + reference + status */}
        <div className="flex items-center gap-2 border-b border-[#00a5fd]/15 bg-[#00a5fd]/[0.04] px-3 py-1.5 dark:border-[#00a5fd]/20">
          <p className="shrink-0 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#0088d4] dark:text-[#33bbfd]">
            {t("dashboard_case_file")}
          </p>
          <p className="min-w-0 truncate font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/60">
            {t("dashboard_file_no")} {String(fileNo).padStart(3, "0")}
          </p>
          <div className="relative z-20 ml-auto shrink-0">
            <StatusBadge status={lookup.status} />
          </div>
        </div>

        {/* Subject — segmented case ID + vehicle */}
        <div className="flex items-center gap-3 px-3 py-2.5 sm:gap-4">
          {photoCandidates.length > 0 ? (
            <div className="group/thumb relative shrink-0 overflow-hidden rounded-sm ring-1 ring-[#00a5fd]/25">
              <ReportListThumbnail sources={photoCandidates} alt={vehicleName ?? lookup.vin} />
            </div>
          ) : null}

          <div className="min-w-0 flex-1 space-y-1.5">
            <VinCaseId vin={lookup.vin} size="sm" oneLine />
            <p className="truncate text-xs font-semibold text-muted-foreground sm:text-[13px]">
              {vehicleName ?? t("dashboard_subject_unknown")}
            </p>
            {isPendingManual ? (
              <p className="truncate text-[11px] font-semibold text-[#0088d4] dark:text-[#7dd3fc]">
                {t("pending_searching_databases")}
              </p>
            ) : null}
          </div>

          {viewable ? (
            <Button
              size="sm"
              className="relative z-20 hidden h-8 shrink-0 gap-1 rounded-md text-xs pointer-events-auto lg:inline-flex"
              asChild
            >
              <PrefetchLink href={reportHref}>
                {t("view_dossier")}
                <ChevronRight className="h-3.5 w-3.5" />
              </PrefetchLink>
            </Button>
          ) : lookup.status === "error" ? (
            <Button
              variant="ghost"
              size="icon"
              className="relative z-20 h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={deleteLookup.isPending}
              onClick={() => deleteLookup.mutate({ id: lookup.id })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>

        {/* Metadata strip */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-dashed border-border/55 bg-muted/25 px-3 py-1.5 dark:bg-white/[0.02] sm:gap-x-4">
          <FileMeta label={t("dashboard_opened")} value={openedOn} />
          <span aria-hidden className="hidden h-2.5 w-px bg-border/70 sm:block" />
          <FileMeta
            label={t("dashboard_odometer")}
            value={hasMileage ? `${odometer!.toLocaleString()} km` : "—"}
          />
          <span aria-hidden className="hidden h-2.5 w-px bg-border/70 sm:block" />
          <FileMeta label={t("dashboard_findings")} value={findings} accent={hasDamageFlag} />
        </div>
      </div>
    </div>
  );
}

function SortFilterBar({
  active,
  onSelect,
}: {
  active: DashboardLookupSort;
  onSelect: (sort: DashboardLookupSort) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none">
      <span className="inline-flex shrink-0 items-center gap-1.5 pr-1 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
        <ArrowUpDown className="h-3.5 w-3.5" />
        {t("dashboard_filter_label")}
      </span>
      {SORT_OPTIONS.map((sort) => (
        <button
          key={sort}
          type="button"
          onClick={() => onSelect(sort)}
          className={cn(
            "shrink-0 whitespace-nowrap rounded-sm border px-2.5 py-1 text-[11px] font-semibold transition-colors sm:text-xs",
            active === sort
              ? "border-[#00a5fd] bg-[#00a5fd]/10 text-[#0088d4] dark:text-[#33bbfd]"
              : "border-border/70 bg-background text-muted-foreground hover:border-[#00a5fd]/40 hover:text-foreground",
          )}
        >
          {t(SORT_LABEL_KEYS[sort])}
        </button>
      ))}
    </div>
  );
}

function ReportPageTabs({
  page,
  totalPages,
  onSelect,
  disabled,
}: {
  page: number;
  totalPages: number;
  onSelect: (page: number) => void;
  disabled?: boolean;
}) {
  const pages = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const set = new Set<number>([1, totalPages, page]);
    for (let p = page - 1; p <= page + 1; p++) {
      if (p >= 1 && p <= totalPages) set.add(p);
    }
    const sorted = [...set].sort((a, b) => a - b);
    const out: Array<number | "ellipsis"> = [];
    for (let i = 0; i < sorted.length; i++) {
      const cur = sorted[i]!;
      const prev = sorted[i - 1];
      if (prev != null && cur - prev > 1) out.push("ellipsis");
      out.push(cur);
    }
    return out;
  }, [page, totalPages]);

  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 pt-2"
      aria-label="Report pages"
    >
      <button
        type="button"
        disabled={disabled || page <= 1}
        onClick={() => onSelect(page - 1)}
        className={cn(
          "min-w-[2.25rem] h-9 sm:h-10 rounded-full border px-3 text-sm font-bold transition-all",
          disabled || page <= 1
            ? "opacity-40 cursor-not-allowed bg-muted border-border/50"
            : "bg-background hover:bg-muted/60 border-border/70 text-foreground",
        )}
        aria-label="Previous page"
      >
        ‹
      </button>
      {pages.map((p, idx) =>
        p === "ellipsis" ? (
          <span
            key={`e-${idx}`}
            className="min-w-[1.5rem] text-center text-muted-foreground text-sm select-none"
            aria-hidden
          >
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              "min-w-[2.25rem] h-9 sm:h-10 rounded-full border px-3 text-sm font-bold tabular-nums transition-all",
              p === page
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : disabled
                  ? "opacity-40 cursor-not-allowed bg-muted border-border/50"
                  : "bg-background hover:bg-muted/60 border-border/70 text-foreground",
            )}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        disabled={disabled || page >= totalPages}
        onClick={() => onSelect(page + 1)}
        className={cn(
          "min-w-[2.25rem] h-9 sm:h-10 rounded-full border px-3 text-sm font-bold transition-all",
          disabled || page >= totalPages
            ? "opacity-40 cursor-not-allowed bg-muted border-border/50"
            : "bg-background hover:bg-muted/60 border-border/70 text-foreground",
        )}
        aria-label="Next page"
      >
        ›
      </button>
    </nav>
  );
}

type Props = {
  lookups: VinLookup[];
  /** Full unlocked-report count from API (not just the current page). */
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  /** Disable pager while a page request is in flight. */
  isFetching?: boolean;
  language: string;
  deleteLookup: DeleteMutation;
};

export function DashboardReportList({
  lookups,
  total,
  page,
  onPageChange,
  isFetching = false,
  language,
  deleteLookup,
}: Props) {
  const showFilter = total >= DASHBOARD_FILTER_THRESHOLD;
  const [sort, setSort] = useState<DashboardLookupSort>("newest");

  const sorted = useMemo(
    () => (showFilter ? sortDashboardLookups(lookups, sort) : lookups),
    [lookups, showFilter, sort],
  );

  /** 001 is the first report unlocked. The list itself stays newest-first. */
  const fileNoByKey = useMemo(() => {
    const offset = (page - 1) * DASHBOARD_REPORTS_PER_PAGE;
    const oldestFirst = [...lookups].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const map = new Map<string, number>();
    oldestFirst.forEach((lookup, i) => {
      const newestRank = offset + (lookups.length - 1 - i);
      map.set(String(lookup.id ?? lookup.vin), Math.max(1, total - newestRank));
    });
    return map;
  }, [lookups, page, total]);

  const totalPages = Math.max(1, Math.ceil(total / DASHBOARD_REPORTS_PER_PAGE));
  const showPagination = total > DASHBOARD_REPORTS_PER_PAGE;

  useEffect(() => {
    if (page > totalPages) onPageChange(totalPages);
  }, [page, totalPages, onPageChange]);

  return (
    <div className="client-report-list space-y-2.5 sm:space-y-3">
      {showFilter && (
        <SortFilterBar
          active={sort}
          onSelect={(next) => {
            setSort(next);
            if (page !== 1) onPageChange(1);
          }}
        />
      )}
      {sorted.map((lookup) => (
        <ReportCard
          key={lookup.id ?? lookup.vin}
          lookup={lookup}
          fileNo={fileNoByKey.get(String(lookup.id ?? lookup.vin)) ?? 1}
          language={language}
          deleteLookup={deleteLookup}
        />
      ))}
      {showPagination && (
        <ReportPageTabs
          page={page}
          totalPages={totalPages}
          onSelect={onPageChange}
          disabled={isFetching}
        />
      )}
    </div>
  );
}
