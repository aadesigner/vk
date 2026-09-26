import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { useTranslation } from "@/i18n/context";
import { isVin17, parseVinRouteParam } from "@/lib/vin-route";
import { VIN_REPORT_QUERY_OPTIONS, vinReportRefetchInterval } from "@/lib/vin-report-cache";
import { refreshClientAreaAfterUnlock } from "@/lib/client-area-queries";
import { prefetchVinImages } from "@/lib/vin-image-cache";
import { resolveReportPhotoSets } from "@/lib/report-photos";
import { useGetVinLookup } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { PrefetchLink } from "@/components/prefetch-link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, ShieldCheck, AlertTriangle, Car, Wrench, MapPin, Calendar, Gauge,
  Palette, CheckCircle2, XCircle, Users, Lock,
  ChevronDown, ChevronLeft, ChevronRight, DollarSign, Fuel, Box,
  X, Zap, Settings2, Loader2, Gavel,
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { ReportReveal } from "@/components/report-reveal";

import { translateDamageLabel } from "@/lib/translate-damage-label";
import { translateTitleStatus } from "@/lib/translate-title-status";
import { translateLotStatus } from "@/lib/translate-lot-status";
import { cn } from "@/lib/utils";
import { createVinReportFetchError } from "@/lib/api-error";
import { VinReportErrorView, resolveVinReportErrorKind } from "@/components/vin-report-error";
import { useQueryRecovery } from "@/hooks/use-query-recovery";
import { useVinPendingPublishWait } from "@/hooks/use-vin-pending-publish-wait";
import { SEOHead, usePageSeo } from "@/components/seo";
import { PrintReportBranding } from "@/components/print-report-branding";
import { VinPrintSummary } from "@/components/vin-print-summary";
import { VinReportShareCard } from "@/components/vin-report-share-card";
import { buildAccidentPrintHighlights, buildInsurancePrintHighlights, buildMileagePrintRows, buildOwnerPrintRows, buildRegistryPrintRows, buildAuctionPrintRows } from "@/lib/build-print-summary";
import { VinReportHero } from "@/components/vin-report-hero";
import { VinReportSection, VinReportSectionHeader, VIN_REPORT_PAGE_FIELD, VIN_REPORT_PAGE_SHELL } from "@/components/vin-report-section";
import {
  SalvageMeaningHint,
  MileageRollbackHint,
  TitleBrandHint,
  HighOwnerCountHint,
  titleBrandHintKind,
  isHighOwnerCount,
  ownershipSectionAccent,
  safetySectionAccent,
} from "@/components/salvage-meaning-hint";
import { VinPhoto360Viewer } from "@/components/vin-photo-360-viewer";
import { PendingVinSearchPanel, PendingVinTopNotice } from "@/components/pending-vin-search-panel";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { mileageColor } from "@/lib/mileage-color";
import {
  resolveLatestOdometerRecordedDate,
  resolveLatestRecordedOdometer,
} from "@/lib/resolve-latest-odometer";
import { sortHistoryNewestFirst } from "@/lib/history-sort";
import { translateKoreanProviderPhrase, localizeProviderDate } from "@/lib/korean-provider-text";
import { formatMarketAuctionDate } from "@/lib/market-chart-data";
import {
  formatAccidentDescription,
  formatAccidentType,
  localizeAccidentDate,
  resolveAccidentSeverityForDisplay,
  accidentSeverityStyle,
  ACCIDENT_SEVERITY_I18N_KEYS,
} from "@/lib/accident-display";
import { formatCountryName, formatLocationLabel, countryLabelsFromT } from "@/lib/format-country-name";
import { repairDatedRecords } from "@/lib/encar-date-repair";
import { computeVinConditionScore, hasMileageRollback, scoreInputFromLookup } from "@/lib/vin-condition-score";
import { formatAccidentCount } from "@/lib/format-accident-count";
import { buildVinHeroSummaryItems } from "@/lib/vin-hero-summary";
import { countAccidentSignals } from "@/lib/accident-signals";
import { formatMilesInParens, kmToMiles } from "@/lib/format-km-with-miles";
import {
  AnimatedMileageBadge,
  AnimatedMileageKm,
  VinMileageGauge,
} from "@/components/vin-mileage-animated";
import { translateFuelType } from "@/lib/translate-fuel-type";
import {
  BODY_I18N_KEYS as BODY_KEYS,
  TRANSMISSION_I18N_KEYS as TRANSMISSION_KEYS,
  translateColor,
  translateMappedValue,
} from "@/lib/vehicle-attr-options";
import { KoreanWonAmount } from "@/components/korean-won-amount";
import { formatAmountPlain, resolveAmountDisplayCurrency, isKoreanCountry } from "@/lib/korean-currency";
import { VinMarketDataSection } from "@/components/vin-market-data-section";
import { InsuranceClaimsSection } from "@/components/insurance-claims-section";
import { FloodDamageSection } from "@/components/flood-damage-section";
import { useReportKrwPerUsd } from "@/hooks/use-report-krw-per-usd";
import { RegistryHistorySection } from "@/components/registry-history-section";
import { ServiceHistorySection } from "@/components/service-history-section";
import { VehicleExtrasSection } from "@/components/vehicle-extras-section";
import { VehicleSpecsGrid } from "@/components/vehicle-specs-grid";
import { OwnerHistoryTimeline } from "@/components/owner-history-timeline";
import { AuctionHistoryTimeline } from "@/components/auction-history-timeline";
import { ReportHistoryTimeline } from "@/components/report-history-timeline";
import { collectReportTimelineEvents, shouldShowReportTimeline } from "@/lib/report-history-timeline";
import { pathFor } from "@/lib/localized-routes";
import type { InsuranceClaimEntry } from "@/lib/insurance-claims";
import type { RegistryHistoryEntry } from "@/lib/registry-history";
import type { ServiceHistoryEntry } from "@/components/service-history-section";
import type { VehicleExtraEntry } from "@/components/vehicle-extras-section";
import {
  cleanDisplayStr,
  hasMeaningfulMarketData,
  hasMileageData,
  hasOwnershipData,
  hasSafetyData,
  sanitizeAccidents,
  sanitizeAuctionHistory,
  sanitizeInsuranceClaims,
  sanitizeMileageHistory,
  sanitizeOwnerHistory,
  sanitizeServiceHistory,
  enrichRegistryHistoryDates,
  sanitizeRegistryHistory,
  sanitizeRecallHistory,
} from "@/lib/report-display";

function useAntiScrape(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    const onDragStart = (e: DragEvent) => {
      if ((e.target as HTMLElement).tagName === "IMG") {
        e.preventDefault();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (
        e.key === "F12" ||
        (ctrl && e.shiftKey && ["I", "J", "C"].includes(e.key.toUpperCase())) ||
        (ctrl && e.key.toUpperCase() === "U")
      ) {
        e.preventDefault();
      }
    };
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [enabled]);
}

interface Props {
  params: { id: string; lang: string };
}

type MileageEntry = {
  date?: string | null;
  odometer?: number | null;
  unit?: string | null;
  condition?: string | null;
  damage?: string | null;
  primaryDamage?: string | null;
  secondaryDamage?: string | null;
  titleStatus?: string | null;
  auctionPrice?: number | null;
  lotStatus?: string | null;
  location?: string | null;
  /** Admin-entered notes / services at this reading. */
  description?: string | null;
};

type OwnerEntry = {
  date?: string | null;
  location?: string | null;
  mileage?: number | null;
  auctionPrice?: number | null;
  lotStatus?: string | null;
  condition?: string | null;
};

type AuctionEntry = {
  date?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  condition?: string | null;
  damage?: string | null;
  primaryDamage?: string | null;
  secondaryDamage?: string | null;
  titleStatus?: string | null;
  openingBid?: number | null;
  buyNowPrice?: number | null;
  finalPrice?: number | null;
  lotStatus?: string | null;
};

type AccidentEntry = {
  date?: string | null;
  severity?: string | null;
  description?: string | null;
  country?: string | null;
  location?: string | null;
  type?: string | null;
  primaryDamage?: string | null;
  secondaryDamage?: string | null;
  airbagDeployed?: boolean | null;
  odometerAtLoss?: number | null;
  lossAmount?: number | null;
  currency?: string | null;
};

type LookupData = {
  accidents?: AccidentEntry[];
  odometer?: number;
  odometerLocked?: boolean;
  ownerCount?: number;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  engine?: string;
  transmission?: string;
  fuelType?: string;
  bodyType?: string;
  color?: string;
  country?: string;
  hp?: number | null;
  cylinders?: number | null;
  isSalvage?: boolean | null;
  isStolen?: boolean | null;
  isTaxi?: boolean | null;
  isFlooded?: boolean | null;
  floodCount?: number | null;
  floodLossAmount?: number | null;
  /** Opaque: `"getcarapi"` → Events section (not Korean registry). */
  dataSource?: "getcarapi" | null;
  accidentCount?: number | null;
  titleStatus?: string;
  photos?: string[];
  photosHd?: string[];
  photoAlternates?: Array<string | null>;
  photos360Exterior?: string[];
  photos360Interior?: string[];
  photos360EmbedUrl?: string | null;
  photos360EmbedExteriorUrl?: string | null;
  photos360EmbedInteriorUrl?: string | null;
  mileageHistory?: MileageEntry[];
  ownerHistory?: OwnerEntry[];
  marketData?: {
    estimatedValue?: number | null;
    currency?: string | null;
    lastAuctionPrice?: number | null;
    lastAuctionDate?: string | null;
  };
  auctionHistory?: AuctionEntry[];
  insuranceClaims?: InsuranceClaimEntry[];
  registryHistory?: RegistryHistoryEntry[];
  recallHistory?: RegistryHistoryEntry[];
  serviceHistory?: ServiceHistoryEntry[];
  vehicleExtras?: VehicleExtraEntry[];
  krwPerUsd?: number | null;
  fulfillmentPending?: boolean;
};

// ── Value translation maps ────────────────────────────────────────────────────
const SEVERITY_KEYS = ACCIDENT_SEVERITY_I18N_KEYS;

function translateValue(raw: string | null | undefined, map: Record<string, string>, t: (k: string) => string): string | null {
  return translateMappedValue(raw, map, t) ?? (raw?.trim() || null);
}

// ── Score: see lib/vin-condition-score.ts ─────────────────────────────────────

function PassPill({ ok, labelOk, labelFail }: { ok: boolean; labelOk: string; labelFail: string }) {
  const label = ok ? labelOk : labelFail;
  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center justify-center gap-1 sm:gap-1.5 rounded-full border px-2.5 py-1 sm:px-3",
        ok
          ? "bg-[#e6f6ff] dark:bg-[#003a5c]/40/60 border-[#b3e3fe] dark:border-[#006aa8]"
          : "bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800",
      )}
    >
      {ok
        ? <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#0088d4] shrink-0" />
        : <XCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-red-600 shrink-0" />}
      <span
        className={cn(
          "text-[10px] sm:text-xs font-semibold leading-snug text-left",
          ok ? "text-[#0369a1] dark:text-[#33bbfd]" : "text-red-700 dark:text-red-400",
        )}
      >
        {label}
      </span>
    </div>
  );
}


// ── Sanitize display strings — reject empty / placeholder provider values ──
function cleanStr(v: string | null | undefined): string | null {
  return cleanDisplayStr(v);
}

// ── Clean raw API labels: snake_case → Title Case with special-case lookup ──
const CLEAN_LABEL_MAP: Record<string, string> = {
  suv: "SUV",
  sport_car: "Sports Car",
  sports_car: "Sports Car",
  pickup_truck: "Pickup Truck",
  pickup: "Pickup Truck",
  ev: "EV",
  phev: "PHEV",
  lpg: "LPG",
  atv: "ATV",
  utv: "UTV",
};
function cleanLabel(v: string | null | undefined, tMap?: Record<string, string>): string | null {
  if (!v || v === "[object Object]") return null;
  const key = v.toLowerCase().replace(/\s+/g, "_");
  if (tMap?.[key]) return tMap[key];
  if (CLEAN_LABEL_MAP[key]) return CLEAN_LABEL_MAP[key];
  return v.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ── Mileage Timeline ──────────────────────────────────────────────────────────
function mileageStatusMessage(
  odometer: number,
  history: MileageEntry[],
  t: (k: string) => string,
): { text: string; warn: boolean } {
  if (history.length >= 2) {
    if (hasMileageRollback(history)) {
      return { text: t("mileage_rollback_warning"), warn: true };
    }
    return {
      text: t("mileage_history_consistent").replace("{count}", String(history.length)),
      warn: false,
    };
  }
  return {
    text: t("mileage_km_miles")
      .replace("{km}", odometer.toLocaleString())
      .replace("{miles}", kmToMiles(odometer).toLocaleString()),
    warn: false,
  };
}

function MileageTimeline({
  history,
  t,
  language,
  vehicleYear,
  vehicleCountry,
}: {
  history: MileageEntry[];
  t: (k: string) => string;
  language: import("@/i18n/context").Language;
  vehicleYear?: number | null;
  vehicleCountry?: string | null;
}) {
  const sorted = sortHistoryNewestFirst(
    history.filter((e) => e.odometer),
  );
  if (sorted.length === 0) return null;
  return (
    <div>
      {sorted.map((entry, i) => {
        const isFirst = i === 0;
        const isLast = i === sorted.length - 1;
        const km = entry.odometer!;
        const col = mileageColor(km);
        const cond = translateLotStatus(t, cleanStr(entry.condition));
        const primaryDmg = translateDamageLabel(t, cleanStr(entry.primaryDamage) ?? cleanStr(entry.damage));
        const secondaryDmg = translateDamageLabel(t, cleanStr(entry.secondaryDamage));
        const status = translateLotStatus(t, cleanStr(entry.lotStatus));
        const titleLabel = translateTitleStatus(t, cleanStr(entry.titleStatus));
        const servicesNote = cleanStr(entry.description);
        const locationLabel = entry.location
          ? (formatLocationLabel(entry.location, language, countryLabelsFromT(t)) || cleanStr(entry.location))
          : null;
        return (
          <div key={i} className="relative pl-7">
            <div className={cn(
              "absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-background ring-2",
              col.dot
            )} />
            {!isLast && <div className="absolute left-[6px] top-5 bottom-0 w-0.5 bg-border" />}
            <div className={cn("pb-5", isLast && "pb-0")}>
                <p className="text-xs text-muted-foreground mb-0.5">
                  {entry.date ? localizeProviderDate(entry.date, language, vehicleYear, vehicleCountry) : null}
                </p>
              <div className="flex items-baseline gap-1.5">
                <span className={cn("font-black tabular-nums", col.text, isFirst ? "text-2xl" : "text-lg")}>
                  {isFirst ? (
                    <AnimatedMileageKm value={km} />
                  ) : (
                    km.toLocaleString()
                  )}
                </span>
                <span className="text-sm text-muted-foreground">{entry.unit ?? "km"}</span>
                {isFirst && <Badge variant="secondary" className="text-[10px] ml-1">{t("latest")}</Badge>}
              </div>
              {entry.auctionPrice != null && (
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1 mt-1">
                  <DollarSign className="h-3 w-3 shrink-0" />
                  {entry.auctionPrice.toLocaleString()}
                </p>
              )}
              {locationLabel && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {locationLabel}
                </p>
              )}
              {(cond || primaryDmg || secondaryDmg || status || titleLabel) && (
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {cond && (
                    <span className="text-xs bg-muted rounded-md px-2 py-0.5 text-muted-foreground">
                      {t("condition")}: {cond}
                    </span>
                  )}
                  {primaryDmg && (
                    <span className="text-xs bg-muted rounded-md px-2 py-0.5 text-muted-foreground">
                      {t("primary_damage")}: {primaryDmg}
                    </span>
                  )}
                  {secondaryDmg && (
                    <span className="text-xs bg-muted rounded-md px-2 py-0.5 text-muted-foreground">
                      {t("secondary_damage")}: {secondaryDmg}
                    </span>
                  )}
                  {titleLabel && (
                    <span className="text-xs bg-amber-500/10 text-amber-800 dark:text-amber-300 rounded-md px-2 py-0.5">
                      {t("mileage_title")}: {titleLabel}
                    </span>
                  )}
                  {status && (
                    <span className="text-xs bg-muted rounded-md px-2 py-0.5 text-muted-foreground">
                      {status}
                    </span>
                  )}
                </div>
              )}
              {servicesNote && (
                <p className="text-sm text-muted-foreground mt-1.5 leading-snug">
                  <span className="font-medium text-foreground/80">{t("mileage_description")}: </span>
                  {servicesNote}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Owner Timeline ────────────────────────────────────────────────────────────
// (see components/owner-history-timeline.tsx)

// ── Main page ─────────────────────────────────────────────────────────────────

export default function VinResult({ params }: Props) {
  const { t, language } = useTranslation();
  const queryClient = useQueryClient();
  const clientAreaSyncedRef = useRef(false);
  const seo = usePageSeo("vin_result");
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const route = parseVinRouteParam(params.id);
  const isVinString = route?.kind === "vin";
  const vinUpper = isVinString ? route.vin : "";
  const lookupId = route?.kind === "lookupId" ? route.lookupId : 0;
  const { data: lookupById, isLoading: loadingById, isError: errorById, error: lookupByIdError, refetch: refetchById, isFetching: fetchingById } = useGetVinLookup(lookupId, {
    query: {
      enabled: route?.kind === "lookupId",
      queryKey: ["/api/vin", "id", lookupId],
      ...VIN_REPORT_QUERY_OPTIONS,
      refetchInterval: vinReportRefetchInterval,
    },
  });
  const {
    data: lookupByVin,
    isLoading: loadingByVin,
    isError: errorByVin,
    error: vinFetchError,
    refetch: refetchVin,
    isFetching: fetchingVin,
  } = useQuery({
    queryKey: ["/api/vin", "vin", vinUpper],
    enabled: isVinString,
    ...VIN_REPORT_QUERY_OPTIONS,
    refetchInterval: vinReportRefetchInterval,
    queryFn: async ({ signal }) => {
      const r = await fetch(`${basePath}/api/vin/${encodeURIComponent(vinUpper)}`, { credentials: "include", signal });
      if (!r.ok) throw createVinReportFetchError(r.status);
      return r.json();
    },
    retry: (failureCount, error) => {
      if (resolveVinReportErrorKind(error) === "not_found") return failureCount < 45;
      return failureCount < 1;
    },
    retryDelay: (_count, error) =>
      (resolveVinReportErrorKind(error) === "not_found" ? 2_000 : 1_000),
  });

  const lookupRaw = isVinString ? lookupByVin : lookupById;
  const lookup =
    lookupRaw && isVinString && lookupRaw.vin?.toUpperCase() !== vinUpper
      ? undefined
      : lookupRaw;
  const storedKrwPerUsd = (lookupRaw?.data as LookupData | null | undefined)?.krwPerUsd;
  const krwPerUsd = useReportKrwPerUsd(storedKrwPerUsd);
  const isLoading = isVinString ? loadingByVin : loadingById;
  const isFetchError =
    !route ||
    (isVinString && errorByVin) ||
    (route?.kind === "lookupId" && errorById);
  const loadError = isVinString ? vinFetchError : lookupByIdError;
  const isFetching = isVinString ? fetchingVin : fetchingById;
  const refetchLookup = isVinString ? refetchVin : refetchById;
  const isLoadingInitial = !lookup && (isLoading || isFetching);
  useQueryRecovery(!!isFetchError && !!lookup, isFetching, refetchLookup);
  const [, setLocation] = useLocation();

  // Legacy numeric URLs (/vin/138) redirect to the canonical VIN page once the row is loaded.
  useEffect(() => {
    if (route?.kind !== "lookupId") return;
    const resolvedVin = lookup?.vin?.trim().toUpperCase() ?? "";
    if (!isVin17(resolvedVin)) return;
    setLocation(`/${language}/vin/${resolvedVin}`, { replace: true });
  }, [route?.kind, lookup?.vin, language, setLocation]);

  const [expandedAccidents, setExpandedAccidents] = useState<Set<number>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const openLightbox = useCallback((i: number) => setLightboxIndex(i), []);
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const navLightbox = useCallback((i: number) => setLightboxIndex(i), []);

  useAntiScrape(!isLoading && !!lookup);

  useLayoutEffect(() => {
    if (!lookupRaw?.data) return;
    const d = lookupRaw.data as { photos?: string[]; photosHd?: string[] };
    const { photos } = resolveReportPhotoSets(d);
    if (photos.length) void prefetchVinImages(photos, { centerIndex: 0, radius: 1 });
  }, [lookupRaw]);

  // Sync dashboard / purchases lists once delivery finishes (checkout may redirect while still fulfilling).
  useEffect(() => {
    if (!lookup) return;
    if (lookup.status !== "complete" && lookup.status !== "pending_manual") return;
    if (clientAreaSyncedRef.current) return;
    clientAreaSyncedRef.current = true;
    refreshClientAreaAfterUnlock(queryClient);
  }, [lookup?.status, lookup?.id, queryClient]);

  const isFulfilling = lookup?.status === "fulfilling";

  useVinPendingPublishWait(lookup, !!lookup && lookup.status === "pending_manual");

  if (isLoadingInitial) {
    return (
      <>
        <SEOHead title={seo.title} description={seo.description} lang={seo.lang} noIndex />
        <div className={VIN_REPORT_PAGE_FIELD}>
        <div className={cn(VIN_REPORT_PAGE_SHELL, "space-y-4 sm:space-y-6")}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-36 w-full rounded-md" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-md" />)}
        </div>
        </div>
        </div>
      </>
    );
  }

  if (!lookup) {
    const kind = resolveVinReportErrorKind(loadError);
    const isNotFound = kind === "not_found" || !loadError;
    const resolvedKind = isNotFound ? "not_found" : kind;

    return (
      <>
        <SEOHead title={seo.title} description={seo.description} lang={seo.lang} noIndex />
        <VinReportErrorView
          kind={resolvedKind}
          language={language}
          onRetry={resolvedKind === "server" || resolvedKind === "unknown" ? refetchLookup : undefined}
          isRetrying={isFetching}
        />
      </>
    );
  }

  if (isFulfilling) {
    return (
      <>
        <SEOHead title={seo.title} description={seo.description} lang={seo.lang} noIndex />
        <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 text-center space-y-4">
          <Loader2 className="h-10 w-10 text-primary animate-spin" aria-hidden />
          <div className="space-y-2">
            <h2 className="text-xl font-bold">{t("processing_retrieving_data")}</h2>
            <p className="text-sm font-mono text-muted-foreground">{lookup.vin}</p>
          </div>
        </div>
      </>
    );
  }

  if (lookup.status === "error") {
    const retry = isVinString ? () => refetchVin() : () => refetchById();
    const retrying = isVinString ? fetchingVin : fetchingById;
    return (
      <>
        <SEOHead title={seo.title} description={seo.description} lang={seo.lang} noIndex />
        <VinReportErrorView
          kind="server"
          language={language}
          onRetry={retry}
          isRetrying={retrying}
        />
      </>
    );
  }

  const isPendingManual =
    lookup.status === "pending_manual" ||
    (lookup as { isPendingManual?: boolean }).isPendingManual === true;

  if (!isPendingManual && lookup.data == null) {
    const retry = isVinString ? () => refetchVin() : () => refetchById();
    const retrying = isVinString ? fetchingVin : fetchingById;
    if (lookup.status === "processing" || lookup.status === "pending") {
      return (
        <>
          <SEOHead title={seo.title} description={seo.description} lang={seo.lang} noIndex />
          <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 text-center space-y-4">
            <Loader2 className="h-10 w-10 text-primary animate-spin" aria-hidden />
            <div className="space-y-2">
              <h2 className="text-xl font-bold">{t("processing_retrieving_data")}</h2>
              <p className="text-sm font-mono text-muted-foreground">{lookup.vin}</p>
            </div>
          </div>
        </>
      );
    }
    return (
      <>
        <SEOHead title={seo.title} description={seo.description} lang={seo.lang} noIndex />
        <VinReportErrorView
          kind="server"
          language={language}
          onRetry={retry}
          isRetrying={retrying}
        />
      </>
    );
  }

  const data = lookup.data as LookupData | null | undefined;
  const isGetCarApi = data?.dataSource === "getcarapi";
  const insuranceClaims = sortHistoryNewestFirst(
    sanitizeInsuranceClaims(repairDatedRecords(data?.insuranceClaims, data?.year), data?.year),
  );
  const accidentSeverityCtx = {
    vehicleCountry: data?.country,
    krwPerUsd,
    hasKoreanInsuranceClaims: insuranceClaims.length > 0,
  };
  const accidents = sortHistoryNewestFirst(
    sanitizeAccidents(repairDatedRecords(data?.accidents, data?.year), data?.year).map((acc) => ({
      ...acc,
      severity: resolveAccidentSeverityForDisplay(acc, accidentSeverityCtx),
    })),
  );
  // Do not useMemo here — this runs after early returns; conditional hooks crash the page
  // when loading → pending_manual/complete (e.g. right after PayPal redirect).
  const { photos, photosHd, photoAlternates } = resolveReportPhotoSets(data);
  const mileageHistory = sortHistoryNewestFirst(
    sanitizeMileageHistory(repairDatedRecords(data?.mileageHistory, data?.year), data?.year),
  );
  const ownerHistory = sortHistoryNewestFirst(sanitizeOwnerHistory(data?.ownerHistory, data?.year));
  const auctionHistory = sortHistoryNewestFirst(sanitizeAuctionHistory(data?.auctionHistory, data?.year));
  const registryHistory = sortHistoryNewestFirst(
    sanitizeRegistryHistory(
      enrichRegistryHistoryDates(
        repairDatedRecords(data?.registryHistory, data?.year),
        [...(data?.mileageHistory ?? []), ...(data?.ownerHistory ?? [])],
        data?.year,
      ),
      data?.year,
      { listingOdometer: data?.odometer },
    ),
  );
  const recallHistory = sortHistoryNewestFirst(
    sanitizeRecallHistory(repairDatedRecords(data?.recallHistory, data?.year), data?.year),
  );
  const serviceHistory = sortHistoryNewestFirst(
    sanitizeServiceHistory(repairDatedRecords(data?.serviceHistory, data?.year), data?.year),
  );
  const vehicleExtras = data?.vehicleExtras ?? [];
  const timelineEvents = collectReportTimelineEvents({
    year: data?.year,
    accidents,
    insuranceClaims,
    mileageHistory,
    serviceHistory,
    auctionHistory,
    ownerHistory,
    registryHistory,
  });
  const mileageSourceInput = {
    odometer: data?.odometer,
    odometerLocked: data?.odometerLocked === true,
    country: data?.country,
    mileageHistory,
    ownerHistory,
    registryHistory,
  };
  const odometer = resolveLatestRecordedOdometer(mileageSourceInput);
  const mileageRecordedDateRaw = resolveLatestOdometerRecordedDate(mileageSourceInput);
  const mileageRecordedDate = mileageRecordedDateRaw
    ? localizeProviderDate(mileageRecordedDateRaw, language, data?.year, data?.country)
    : null;
  const scoreData = data
    ? computeVinConditionScore(
        scoreInputFromLookup({
          ...data,
          odometer,
          mileageHistory,
          insuranceClaims,
          registryHistory,
          accidents,
        }),
        t,
      )
    : null;
  const marketData = data?.marketData;

  const odoMax = 300000;
  const odoPct = odometer ? Math.min(100, (odometer / odoMax) * 100) : 0;
  const odoCol = odometer ? mileageColor(odometer) : null;
  const mileageStatus = odometer ? mileageStatusMessage(odometer, mileageHistory, t) : null;
  const mileageRollback = hasMileageRollback(mileageHistory);
  const titleHintKind = titleBrandHintKind(data?.titleStatus);
  const showHighOwnerHint = isHighOwnerCount(data?.ownerCount);

  const vehicleTitle = data?.make
    ? [data.year ? String(data.year) : null, data.make, data.model ?? null].filter(Boolean).join(" ")
    : t("vin_report_untitled");

  const pendingHeroTitle = (() => {
    if (data?.year && data?.make) return `${data.make} ${data.year}`;
    if (data?.make) return data.make;
    if (data?.year) return String(data.year);
    return null;
  })();

  const displayVehicleTitle = isPendingManual
    ? (pendingHeroTitle ?? t("vin_report_untitled"))
    : vehicleTitle;

  const hasSalvageData = data?.isSalvage !== undefined && data?.isSalvage !== null;
  const hasTheftData   = data?.isStolen  !== undefined && data?.isStolen  !== null;
  const showAccidentsSection = accidents.length > 0;
  const showAccidentsClear =
    !isPendingManual
    && accidents.length === 0
    && (isGetCarApi || data?.accidentCount === 0);
  const showMileageSection = hasMileageData(odometer, mileageHistory);
  const showOwnershipSection = hasOwnershipData(ownerHistory, data?.ownerCount);
  const showAuctionSection = auctionHistory.length > 0;
  const showSafetySection = hasSafetyData(data?.isSalvage, data?.isStolen);
  const showRecallSection = recallHistory.length > 0;
  const showMarketDataSection = hasMeaningfulMarketData(marketData);

  const countryLabels = countryLabelsFromT(t);
  const fmtCountry = (value?: string | null) =>
    value ? formatCountryName(value, language, countryLabels) : null;

  const accidentSignals = countAccidentSignals({
    accidents,
    accidentCount: data?.accidentCount,
    insuranceClaims,
    registryHistory,
  });

  const heroSummary = buildVinHeroSummaryItems({
    t,
    odometer,
    hasMileage: odometer != null && !!odoCol,
    hasSalvageData,
    isSalvage: data?.isSalvage,
    hasTheftData,
    isStolen: data?.isStolen,
    isTaxi: data?.isTaxi === true,
  });

  const displayScoreData = isPendingManual ? null : scoreData;
  const displayHeroSummary = isPendingManual ? [] : heroSummary;

  const toggleAccident = (i: number) =>
    setExpandedAccidents(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; });

  const accidentPrintHighlights = buildAccidentPrintHighlights(
    accidents, t, language, data?.country, krwPerUsd, data?.year, insuranceClaims.length > 0, countryLabels,
  );
  const insurancePrintHighlights = buildInsurancePrintHighlights(insuranceClaims, t, language, data?.country, krwPerUsd, data?.year);
  const mileagePrintRows = buildMileagePrintRows(mileageHistory, t, language, data?.year, data?.country, countryLabels);
  const ownerPrintRows = buildOwnerPrintRows(ownerHistory, language, data?.year, countryLabels, data?.country);
  const registryPrintRows = buildRegistryPrintRows(registryHistory, t, language, data?.country, krwPerUsd, data?.year);
  const auctionPrintRows = buildAuctionPrintRows(auctionHistory, t, language, data?.year, countryLabels, data?.country);
  const printMarketValue = marketData?.estimatedValue != null
    ? formatAmountPlain(
      marketData.estimatedValue,
      resolveAmountDisplayCurrency({
        currency: marketData.currency,
        vehicleCountry: data?.country,
      }),
    )
    : null;
  const printLastAuction = marketData?.lastAuctionPrice != null
    ? [
        `$${Math.round(marketData.lastAuctionPrice).toLocaleString()}`,
        marketData.lastAuctionDate
          ? formatMarketAuctionDate(marketData.lastAuctionDate, language, data?.year, data?.country)
          : null,
      ].filter(Boolean).join(" · ")
    : null;
  const printReportUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${basePath}/${language}/vin/${encodeURIComponent(vinUpper)}`
      : undefined;

  return (
    <div className={VIN_REPORT_PAGE_FIELD}>
    <div className={VIN_REPORT_PAGE_SHELL}>
      <SEOHead title={seo.title} description={seo.description} lang={seo.lang} noIndex />

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && photosHd.length > 0 && (
          <PhotoLightbox
            photos={photosHd}
            index={Math.min(lightboxIndex, photosHd.length - 1)}
            onClose={closeLightbox}
            onNav={navLightbox}
          />
        )}
      </AnimatePresence>

      {/* Back */}
        <Button variant="ghost" size="sm" asChild className="-ml-2 h-9 rounded-xl text-slate-600 hover:bg-white/70 hover:text-[#071018] print:hidden">
        <PrefetchLink href={pathFor(language, "dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("back_to_dashboard")}
        </PrefetchLink>
      </Button>

      {!isPendingManual && (
      <VinPrintSummary
        vehicleTitle={vehicleTitle}
        vin={lookup.vin}
        country={data?.country}
        scoreValue={displayScoreData?.score}
        scoreLabel={displayScoreData?.label}
        make={data?.make}
        model={data?.model}
        year={data?.year}
        trim={data?.trim}
        engine={data?.engine}
        transmission={data?.transmission}
        fuelType={data?.fuelType ?? undefined}
        color={data?.color}
        bodyType={data?.bodyType ?? undefined}
        hp={data?.hp}
        odometer={odometer}
        titleStatus={data?.titleStatus}
        photos={photos}
        accidentCount={accidentSignals}
        accidentHighlights={accidentPrintHighlights}
        insuranceCount={insuranceClaims.length}
        insuranceHighlights={insurancePrintHighlights}
        mileageRows={mileagePrintRows}
        ownerRows={ownerPrintRows}
        registryRows={registryPrintRows}
        auctionRows={auctionPrintRows}
        ownerCount={data?.ownerCount}
        isSalvage={data?.isSalvage}
        isStolen={data?.isStolen}
        isTaxi={data?.isTaxi === true}
        isFlooded={data?.isFlooded}
        hasFloodData={data?.isFlooded != null || isKoreanCountry(data?.country)}
        hasSalvageData={hasSalvageData}
        hasTheftData={hasTheftData}
        marketValue={printMarketValue}
        lastAuction={printLastAuction}
        reportUrl={printReportUrl}
      />
      )}

      <div className="vin-report-screen space-y-5 sm:space-y-7">
      {isPendingManual ? (
        <PendingVinTopNotice vin={lookup.vin} />
      ) : null}
      <VinReportHero
        vehicleTitle={displayVehicleTitle}
        vin={lookup.vin}
        country={isPendingManual ? null : data?.country}
        trim={isPendingManual ? undefined : data?.trim}
        photos={isPendingManual ? [] : photos}
        photoAlternates={isPendingManual ? undefined : photoAlternates}
        scoreData={displayScoreData}
        summaryItems={displayHeroSummary}
        accidentCount={isPendingManual ? 0 : accidentSignals}
        photoPlaceholderLabel={isPendingManual ? t("pending_photos_searching") : undefined}
        pendingPhotoScan={isPendingManual}
        unlockedLabel={isPendingManual ? t("pending_report_badge") : undefined}
        showStatsRow={!isPendingManual}
        pendingEta={isPendingManual}
        onPhotoClick={!isPendingManual && photos.length > 0 ? (i) => openLightbox(i) : undefined}
      >
        {odometer && odoCol && !isPendingManual ? (
          <div className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 sm:px-3 max-w-full">
            <div className={cn("h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full shrink-0", odoCol.dot.split(" ")[0])} />
            <span className={cn("text-[10px] sm:text-[11px] font-semibold tabular-nums", odoCol.text)}>
              {odometer.toLocaleString()} km
              <span className="font-normal opacity-80 hidden sm:inline"> {formatMilesInParens(odometer, t)}</span>
            </span>
          </div>
        ) : null}
        {!isPendingManual && (
          <>
        {showAccidentsSection ? (
          <div className="!hidden print:!inline-flex">
            <PassPill ok={false} labelOk="" labelFail={formatAccidentCount(t, accidents.length)} />
          </div>
        ) : showAccidentsClear ? (
          <PassPill ok labelOk={t("no_accidents")} labelFail="" />
        ) : null}
        <div className="inline-flex items-center gap-1 max-w-full">
          <PassPill
            ok={data?.isSalvage !== true}
            labelOk={t("report_no_salvage")}
            labelFail={t("salvage_flagged")}
          />
          {data?.isSalvage === true ? <SalvageMeaningHint className="shrink-0" /> : null}
        </div>
        <PassPill
          ok={data?.isStolen !== true}
          labelOk={t("report_not_stolen")}
          labelFail={t("theft_flagged")}
        />
        {data?.isFlooded != null || isKoreanCountry(data?.country) || isGetCarApi
          ? <PassPill ok={data?.isFlooded !== true} labelOk={t("report_not_flooded")} labelFail={t("flood_flagged")} />
          : null}
        <PassPill ok={data?.isTaxi !== true} labelOk={t("report_not_taxi")} labelFail={t("taxi_flagged")} />
          </>
        )}
      </VinReportHero>

      {isPendingManual ? (
        <PendingVinSearchPanel />
      ) : null}

      {!isPendingManual && shouldShowReportTimeline(timelineEvents) ? (
        <ReportHistoryTimeline
          events={timelineEvents}
          t={t}
          language={language}
          vehicleYear={data?.year}
          vehicleCountry={data?.country}
          krwPerUsd={krwPerUsd}
        />
      ) : null}

      {/* ── 2-Column Content Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-start print-two-col min-w-0">

        {/* LEFT COLUMN — accidents, safety, mileage, ownership */}
        <div className="space-y-4 sm:space-y-6 order-2 lg:order-2 min-w-0">

        {/* Mileage + pending search */}
        {showMileageSection && !isPendingManual ? (
        <ReportReveal delay={0.1} y={16}>
          <VinReportSection accent="orange">
            <VinReportSectionHeader
              icon={Gauge}
              accent="orange"
              title={mileageHistory.length > 1 ? t("mileage_history") : t("report_mileage")}
              trailing={
                odometer && odoCol ? (
                  <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 bg-primary text-primary-foreground shadow-sm">
                    <div className="h-2 w-2 rounded-full shrink-0 bg-primary-foreground/90" />
                    <AnimatedMileageBadge
                      odometer={odometer}
                      className="text-xs font-semibold tabular-nums"
                    />
                  </div>
                ) : null
              }
            />
          <div className="px-6 py-5">
            {mileageHistory.length > 1 ? (
              <>
                {odometer && odoCol ? (
                  <VinMileageGauge
                    odometer={odometer}
                    odoMax={odoMax}
                    t={t}
                    size="sm"
                    showScale={false}
                    recordedDate={mileageRecordedDate}
                    className="mb-5 pb-4 border-b border-border/60"
                  />
                ) : null}
                {mileageRollback ? (
                  <div className="flex items-start gap-2 p-3 rounded-xl mb-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-200/60 dark:border-amber-800/40">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                          {t("mileage_rollback_warning")}
                        </p>
                        <MileageRollbackHint className="shrink-0" />
                      </div>
                    </div>
                  </div>
                ) : null}
                <MileageTimeline history={mileageHistory} t={t} language={language} vehicleYear={data?.year} vehicleCountry={data?.country} />
              </>
            ) : odometer && odoCol ? (
              <>
                <VinMileageGauge odometer={odometer} odoMax={odoMax} t={t} recordedDate={mileageRecordedDate} />
                <div className={cn(
                  "flex items-center gap-2 p-3 rounded-xl mt-4",
                  mileageStatus?.warn
                    ? "bg-amber-50 dark:bg-amber-950/50"
                    : "bg-[#e6f6ff] dark:bg-[#003a5c]/40/50",
                )}>
                  {mileageStatus?.warn ? (
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-[#0088d4] shrink-0" />
                  )}
                  <p className={cn(
                    "text-xs font-medium flex-1",
                    mileageStatus?.warn
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-[#0369a1] dark:text-[#33bbfd]",
                  )}>{mileageStatus?.text}</p>
                  {mileageStatus?.warn ? <MileageRollbackHint className="shrink-0" /> : null}
                </div>
              </>
            ) : null}
          </div>
          </VinReportSection>
        </ReportReveal>
        ) : null}

        {/* Accident History */}
        {!isPendingManual && showAccidentsSection && (
        <ReportReveal delay={0.14} y={16}>
          <VinReportSection accent="rose">
            <VinReportSectionHeader
              icon={AlertTriangle}
              accent="rose"
              title={t("accident_history")}
              trailing={<PassPill ok={false} labelOk="" labelFail={formatAccidentCount(t, accidents.length)} />}
            />
          <div className="px-6 py-5">
              <div className="space-y-4">
                {accidents.map((acc, i) => (
                  <div
                    key={i}
                    className="relative pl-5"
                  >
                    {(() => {
                      const sty = accidentSeverityStyle(acc.severity);
                      const isOpen = expandedAccidents.has(i);
                      const sevKey = (acc.severity ?? "").toLowerCase().trim();
                      const isTierSev = ["minor", "light", "moderate", "major", "severe", "total_loss", "unknown"].includes(sevKey);
                      const tierLabel = isTierSev
                        ? (translateValue(acc.severity, SEVERITY_KEYS, t) ?? acc.severity)
                        : null;
                      const headerLabel = tierLabel
                        || formatAccidentDescription(t, language, acc.description)
                        || (acc.type && !/^\d+$/.test(acc.type) ? formatAccidentType(t, acc.type) : null)
                        || (!isTierSev && acc.severity
                          ? acc.severity.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
                          : null)
                        || null;
                      return (
                        <>
                          <div className={`absolute left-0 top-3 h-2.5 w-2.5 rounded-full shrink-0 ${sty.dot}`} />
                          {i < accidents.length - 1 && (
                            <div className="absolute left-[4.5px] top-6 bottom-0 w-px bg-border" />
                          )}
                          <div className={`border rounded-xl overflow-hidden ${sty.card}`}>
                            <button
                              className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
                              onClick={() => toggleAccident(i)}
                            >
                              <div className="min-w-0">
                                {acc.date && (
                                  <p className="text-xs text-muted-foreground mb-0.5">
                                    {localizeAccidentDate(acc.date, language, data?.year, data?.country)}
                                  </p>
                                )}
                                {headerLabel && <p className={sty.text}>{headerLabel}</p>}
                                {(acc.location || acc.country) && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <MapPin className="h-3 w-3" />
                                    {acc.location
                                      ? (formatLocationLabel(acc.location, language, countryLabels) || acc.location)
                                      : fmtCountry(acc.country)}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {acc.lossAmount != null && (
                                  <span className={cn("text-xs font-bold tabular-nums rounded-full px-2 py-0.5", sty.amount)}>
                                    {(() => {
                                      const code = resolveAmountDisplayCurrency({
                                        currency: acc.currency,
                                        vehicleCountry: data?.country,
                                        accidentType: acc.type,
                                        accidentCountry: acc.country,
                                        hasKoreanInsuranceClaims: insuranceClaims.length > 0,
                                      });
                                      return code === "KRW" ? (
                                        <KoreanWonAmount krw={acc.lossAmount} krwPerUsd={krwPerUsd} />
                                      ) : (
                                        formatAmountPlain(acc.lossAmount, code)
                                      );
                                    })()}
                                  </span>
                                )}
                                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", isOpen ? "rotate-180" : "")} />
                              </div>
                            </button>
                            {isOpen && (
                              <div className="px-4 pb-4 border-t pt-3 space-y-2">
                                {acc.type && !/^\d+$/.test(acc.type) && (
                                  <div className="flex gap-2 text-sm">
                                    <span className="text-muted-foreground shrink-0">{t("accident_type")}:</span>
                                    <span className="font-medium">
                                      {formatAccidentType(t, acc.type)}
                                    </span>
                                  </div>
                                )}
                                {acc.primaryDamage && (
                                  <div className="flex gap-2 text-sm">
                                    <span className="text-muted-foreground shrink-0">{t("primary_damage")}:</span>
                                    <span className="font-medium">{translateDamageLabel(t, acc.primaryDamage)}</span>
                                  </div>
                                )}
                                {acc.secondaryDamage && (
                                  <div className="flex gap-2 text-sm">
                                    <span className="text-muted-foreground shrink-0">{t("secondary_damage")}:</span>
                                    <span className="font-medium">{translateDamageLabel(t, acc.secondaryDamage)}</span>
                                  </div>
                                )}
                                {acc.airbagDeployed != null && (
                                  <div className="flex gap-2 text-sm items-center">
                                    <span className="text-muted-foreground shrink-0">{t("airbag_deployed")}:</span>
                                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                                      acc.airbagDeployed
                                        ? "bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400"
                                        : "bg-[#ccebfe] dark:bg-[#003a5c]/40/50 text-[#0369a1] dark:text-[#33bbfd]"
                                    )}>
                                      {acc.airbagDeployed ? t("airbag_yes") : t("airbag_no")}
                                    </span>
                                  </div>
                                )}
                                {acc.odometerAtLoss != null && (
                                  <div className="flex gap-2 text-sm">
                                    <span className="text-muted-foreground shrink-0">{t("odometer_at_loss")}:</span>
                                    <span className="font-medium">{acc.odometerAtLoss.toLocaleString()} km</span>
                                  </div>
                                )}
                                {acc.lossAmount != null && (
                                  <div className="flex gap-2 text-sm">
                                    <span className="text-muted-foreground shrink-0">{t("loss_amount")}:</span>
                                    <span className="font-medium">
                                      {(() => {
                                        const code = resolveAmountDisplayCurrency({
                                          currency: acc.currency,
                                          vehicleCountry: data?.country,
                                          accidentType: acc.type,
                                          accidentCountry: acc.country,
                                          hasKoreanInsuranceClaims: insuranceClaims.length > 0,
                                        });
                                        return code === "KRW" ? (
                                          <KoreanWonAmount krw={acc.lossAmount} krwPerUsd={krwPerUsd} />
                                        ) : (
                                          formatAmountPlain(acc.lossAmount, code)
                                        );
                                      })()}
                                    </span>
                                  </div>
                                )}
                                {acc.description && (
                                  <p className="text-sm text-muted-foreground pt-1 border-t">
                                    {formatAccidentDescription(t, language, acc.description)}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ))}
              </div>
          </div>
          </VinReportSection>
        </ReportReveal>
        )}

        {!isPendingManual && showAccidentsClear && (
        <ReportReveal delay={0.14} y={16}>
          <VinReportSection accent="sky">
            <VinReportSectionHeader
              icon={ShieldCheck}
              accent="sky"
              title={t("accident_history")}
              trailing={<PassPill ok labelOk={t("no_accidents")} labelFail="" />}
            />
            <div className="px-6 py-5">
              <div className="rounded-xl p-4 flex items-start gap-3 bg-[#e6f6ff] dark:bg-[#003a5c]/40/30 border border-[#b3e3fe] dark:border-[#006aa8]/40">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-[#ccebfe] dark:bg-[#004d7a]/40/40">
                  <ShieldCheck className="h-4 w-4 text-[#0088d4]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#0369a1] dark:text-[#33bbfd]">{t("no_accidents")}</p>
                  <p className="text-xs text-muted-foreground/80 mt-0.5 leading-snug">
                    {t("print_summary_no_accidents")}
                  </p>
                </div>
              </div>
            </div>
          </VinReportSection>
        </ReportReveal>
        )}

        {/* Safety Status — Salvage & Theft combined */}
        {!isPendingManual && showSafetySection && (
        <ReportReveal y={16} inView>
          <VinReportSection accent={safetySectionAccent(data?.isSalvage, data?.isStolen)}>
            <VinReportSectionHeader
              icon={ShieldCheck}
              accent={safetySectionAccent(data?.isSalvage, data?.isStolen)}
              title={t("safety_status")}
              trailing={
                (hasSalvageData || hasTheftData) ? (
                  <div className="flex items-center gap-1.5">
                    {data?.isSalvage === true ? <SalvageMeaningHint /> : null}
                    <PassPill
                      ok={(!hasSalvageData || data!.isSalvage === false) && (!hasTheftData || data!.isStolen === false)}
                      labelOk={t("all_clear")}
                      labelFail={t("issue_found")}
                    />
                  </div>
                ) : null
              }
            />
          <div className="px-6 py-5 grid sm:grid-cols-2 gap-3">
            {/* Salvage box */}
            {hasSalvageData ? (
              <div className={cn(
                "rounded-xl p-4 flex items-start gap-3",
                data!.isSalvage ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40"
                               : "bg-[#e6f6ff] dark:bg-[#003a5c]/40/30 border border-[#b3e3fe] dark:border-[#006aa8]/40"
              )}>
                <div className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                  data!.isSalvage ? "bg-red-100 dark:bg-red-900/40" : "bg-[#ccebfe] dark:bg-[#004d7a]/40/40"
                )}>
                  {data!.isSalvage
                    ? <AlertTriangle className="h-4 w-4 text-red-600" />
                    : <ShieldCheck className="h-4 w-4 text-[#0088d4]" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("report_salvage")}</p>
                    {data!.isSalvage ? <SalvageMeaningHint /> : null}
                  </div>
                  <p className={cn("text-sm font-bold mt-0.5", data!.isSalvage ? "text-red-700 dark:text-red-400" : "text-[#0369a1] dark:text-[#33bbfd]")}>
                    {data!.isSalvage ? t("salvage_flagged") : t("mock_value_salvage")}
                  </p>
                  <p className="text-xs text-muted-foreground/80 mt-0.5 leading-snug">
                    {data!.isSalvage ? (translateTitleStatus(t, data!.titleStatus) ?? t("salvage_flagged_desc")) : t("salvage_clear_desc")}
                  </p>
                </div>
              </div>
            ) : null}

            {/* Theft box */}
            {hasTheftData ? (
              <div className={cn(
                "rounded-xl p-4 flex items-start gap-3",
                data!.isStolen ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40"
                              : "bg-[#e6f6ff] dark:bg-[#003a5c]/40/30 border border-[#b3e3fe] dark:border-[#006aa8]/40"
              )}>
                <div className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                  data!.isStolen ? "bg-red-100 dark:bg-red-900/40" : "bg-[#ccebfe] dark:bg-[#004d7a]/40/40"
                )}>
                  {data!.isStolen
                    ? <AlertTriangle className="h-4 w-4 text-red-600" />
                    : <Lock className="h-4 w-4 text-[#0088d4]" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("report_theft")}</p>
                  <p className={cn("text-sm font-bold mt-0.5", data!.isStolen ? "text-red-700 dark:text-red-400" : "text-[#0369a1] dark:text-[#33bbfd]")}>
                    {data!.isStolen ? t("theft_flagged") : t("mock_value_stolen")}
                  </p>
                  <p className="text-xs text-muted-foreground/80 mt-0.5 leading-snug">
                    {data!.isStolen ? t("theft_flagged_desc") : t("theft_clear_desc")}
                  </p>
                </div>
              </div>
            ) : null}

            {/* Title status — full-width row if present */}
            {cleanStr(data?.titleStatus) && (
              <div className="sm:col-span-2 flex items-center gap-3 pt-3 border-t">
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("title_status")}</p>
                    {titleHintKind ? <TitleBrandHint kind={titleHintKind} /> : null}
                  </div>
                  <p className="text-sm font-semibold">{translateTitleStatus(t, data?.titleStatus)}</p>
                </div>
              </div>
            )}
          </div>
          </VinReportSection>
        </ReportReveal>
        )}

        {/* Recalls — Korean manufacturer recalls (separate from registry timeline) */}
        {!isPendingManual && showRecallSection && (
          <RegistryHistorySection
            events={recallHistory}
            country={data?.country}
            vehicleYear={data?.year}
            krwPerUsd={krwPerUsd}
            t={t}
            language={language}
            kind="recall"
            delay={0.17}
          />
        )}

        {/* Auction History */}
        {showAuctionSection && (
        <ReportReveal y={16} inView>
          <VinReportSection accent="slate">
            <VinReportSectionHeader
              icon={Gavel}
              accent="slate"
              title={t("auction_history")}
              trailing={
                auctionHistory && auctionHistory.length > 0 ? (
                  <Badge variant="secondary" className="text-xs tabular-nums">
                    {auctionHistory.length}
                  </Badge>
                ) : null
              }
            />
          <div className="px-4 py-4 sm:px-6 sm:py-5">
            <AuctionHistoryTimeline history={auctionHistory} t={t} language={language} vehicleYear={data?.year} vehicleCountry={data?.country} />
          </div>
          </VinReportSection>
        </ReportReveal>
        )}

        {/* Ownership */}
        {showOwnershipSection && !isPendingManual && (
        <ReportReveal y={16} inView>
          <VinReportSection accent={ownershipSectionAccent(data?.ownerCount)}>
            <VinReportSectionHeader
              icon={Users}
              accent={ownershipSectionAccent(data?.ownerCount)}
              title={t("ownership_history")}
              subtitle={t("owner_privacy_note")}
              trailing={
                data?.ownerCount != null ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {showHighOwnerHint ? <HighOwnerCountHint /> : null}
                    <Badge variant="secondary" className="text-xs">
                      {data.ownerCount} {data.ownerCount === 1 ? t("owner_single") : t("owner_many_suffix")}
                    </Badge>
                  </div>
                ) : null
              }
            />
          <div className="px-6 py-5">
            {ownerHistory && ownerHistory.length > 0 ? (
              <OwnerHistoryTimeline history={ownerHistory} t={t} language={language} vehicleYear={data?.year} vehicleCountry={data?.country} />
            ) : data?.ownerCount != null ? (
              <div className="flex items-center gap-4">
                <div className={cn(
                  "h-14 w-14 rounded-2xl border-2 flex items-center justify-center shrink-0",
                  data.ownerCount > 8
                    ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/40"
                    : data.ownerCount > 5
                      ? "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/40"
                      : data.ownerCount <= 2
                        ? "bg-[#e6f6ff] dark:bg-[#003a5c]/40/30 border-[#b3e3fe] dark:border-[#006aa8]/40"
                        : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40"
                )}>
                  <span className={cn(
                    "text-2xl font-black",
                    data.ownerCount > 8
                      ? "text-red-700 dark:text-red-400"
                      : data.ownerCount > 5
                        ? "text-orange-600 dark:text-orange-400"
                        : data.ownerCount <= 2
                          ? "text-[#0088d4] dark:text-[#00a5fd]"
                          : "text-amber-600 dark:text-amber-400"
                  )}>
                    {data.ownerCount}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-sm">
                      {data.ownerCount === 1 ? t("owner_single") : `${data.ownerCount} ${t("owner_many_suffix")}`}
                    </p>
                    {showHighOwnerHint ? <HighOwnerCountHint /> : null}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {data.ownerCount <= 2 ? t("owner_low") : t("owner_many_suffix")}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
          </VinReportSection>
        </ReportReveal>
        )}

        </div>{/* END LEFT COLUMN */}

        {/* RIGHT COLUMN — photos, vehicle info, market data (shown left on desktop) */}
        <div className="space-y-4 sm:space-y-6 order-1 lg:order-1 min-w-0 overflow-hidden print-two-col-left">

          {/* Vehicle Info — hidden while manual report is pending */}
          {!isPendingManual ? (
          <ReportReveal delay={0.05} y={16}>
            <VinReportSection accent="sky">
              <VinReportSectionHeader icon={Car} accent="sky" title={t("vehicle_info")} />
            <div className="px-5 py-4">
              <VehicleSpecsGrid>
                {[
                  { icon: Car,       label: t("make"),           value: data?.make,        accent: "text-blue-500",   bg: "bg-blue-500/8" },
                  { icon: Car,       label: t("model"),          value: data?.model,       accent: "text-blue-500",   bg: "bg-blue-500/8" },
                  { icon: Calendar,  label: t("year"),           value: data?.year ? String(data.year) : null, accent: "text-purple-500", bg: "bg-purple-500/8" },
                  { icon: Fuel,      label: t("fuel_type"),      value: translateFuelType(t, data?.fuelType) ?? cleanLabel(data?.fuelType), accent: "text-[#00a5fd]", bg: "bg-[#00a5fd]/8" },
                  { icon: Settings2, label: t("transmission"),   value: translateValue(data?.transmission, TRANSMISSION_KEYS, t), accent: "text-cyan-500", bg: "bg-cyan-500/8" },
                  { icon: MapPin,    label: t("country"),        value: fmtCountry(data?.country), accent: "text-orange-500", bg: "bg-orange-500/8" },
                  { icon: Wrench,    label: t("engine"),         value: data?.engine,      accent: "text-slate-500",  bg: "bg-slate-500/8" },
                  { icon: Zap,       label: t("hp"),             value: data?.hp ? `${data.hp} hp` : null, accent: "text-yellow-500", bg: "bg-yellow-500/8" },
                  { icon: Box,       label: t("body_type"),      value: cleanLabel(data?.bodyType) ?? translateValue(data?.bodyType, BODY_KEYS, t), accent: "text-pink-500", bg: "bg-pink-500/8" },
                  { icon: Palette,   label: t("color"),          value: translateColor(t, data?.color) ?? data?.color, accent: "text-rose-500",   bg: "bg-rose-500/8" },
                  { icon: Settings2, label: t("cylinders"),      value: data?.cylinders ? `${data.cylinders} cyl` : null, accent: "text-indigo-500", bg: "bg-indigo-500/8" },
                ].filter(f => f.value).map(({ icon: Icon, label, value, accent, bg }) => (
                  <div key={label} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/40 min-w-0 h-full">
                    <div className={`h-7 w-7 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`h-3.5 w-3.5 ${accent}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground font-medium truncate">{label}</p>
                      <p className="font-bold text-xs truncate">{value}</p>
                    </div>
                  </div>
                ))}
              </VehicleSpecsGrid>
            </div>
            </VinReportSection>
          </ReportReveal>
          ) : null}

          {!isPendingManual && data?.isFlooded != null ? (
            <ReportReveal y={16} inView>
              <FloodDamageSection
                isFlooded={data.isFlooded}
                floodCount={data.floodCount}
                floodLossAmount={data.floodLossAmount}
                country={data.country}
                krwPerUsd={krwPerUsd}
                t={t}
                language={language}
                variant="report"
              />
            </ReportReveal>
          ) : null}

          {!isPendingManual ? (
            <VinPhoto360Viewer
              exterior={data?.photos360Exterior}
              interior={data?.photos360Interior}
              embedUrl={data?.photos360EmbedUrl}
              embedExteriorUrl={data?.photos360EmbedExteriorUrl}
              embedInteriorUrl={data?.photos360EmbedInteriorUrl}
              className="print:hidden"
            />
          ) : null}

          {!isPendingManual ? (
          <>
          <InsuranceClaimsSection
            claims={insuranceClaims}
            country={data?.country}
            vehicleYear={data?.year}
            krwPerUsd={krwPerUsd}
            t={t}
            language={language}
            variant="report"
            delay={0.08}
          />

          <RegistryHistorySection
            events={registryHistory}
            country={data?.country}
            vehicleYear={data?.year}
            krwPerUsd={krwPerUsd}
            t={t}
            language={language}
            variant="report"
            kind={isGetCarApi ? "events" : "registry"}
            delay={0.09}
          />
          </>
          ) : null}

          <ServiceHistorySection
            events={serviceHistory}
            vehicleYear={data?.year}
            vehicleCountry={data?.country}
            t={t}
            language={language}
            variant="report"
            delay={0.095}
          />

          <VehicleExtrasSection
            extras={vehicleExtras}
            vehicleYear={data?.year}
            vehicleCountry={data?.country}
            t={t}
            language={language}
            variant="report"
            delay={0.098}
          />

          {showMarketDataSection && marketData && !isPendingManual && (
            <VinMarketDataSection
              marketData={marketData}
              auctionHistory={auctionHistory}
              t={t}
              language={language}
              vehicleCountry={data?.country}
              vehicleYear={data?.year}
              krwPerUsd={krwPerUsd}
              variant="report"
              reveal={{ inView: true }}
            />
          )}

        </div>{/* END RIGHT COLUMN */}

      </div>{/* END 2-COLUMN GRID */}
      </div>{/* END vin-report-screen */}

      {!isPendingManual && (
      <VinReportShareCard
        vin={lookup.vin}
        language={language}
        vehicleTitle={vehicleTitle}
        preview={{
          thumbnailUrl: photos[0] ?? null,
          odometer,
          accidentCount: accidentSignals,
          ownerCount: data?.ownerCount ?? null,
        }}
        basePath={basePath}
      />
      )}

      {!isPendingManual && (
      <PrintReportBranding vin={lookup.vin} variant="bottom" />
      )}
    </div>
    </div>
  );
}
