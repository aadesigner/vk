import { useState, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { useTranslation } from "@/i18n/context";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { ReportReveal } from "@/components/report-reveal";
import {
  Lock, Car, ArrowLeft,
  CheckCircle2, XCircle, Users, Gauge,
  MapPin,
  ShieldCheck, ShieldAlert, ChevronRight, AlertTriangle,
  TrendingUp,
  X, ChevronLeft, ChevronDown, FileText, ClipboardList, Droplets, Gavel,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isKoreanCountry } from "@/lib/korean-currency";
import { translateDamageLabel } from "@/lib/translate-damage-label";
import { translateTitleStatus } from "@/lib/translate-title-status";
import { translateLotStatus } from "@/lib/translate-lot-status";
import { SEOHead } from "@/components/seo";
import { SITE_ORIGIN } from "@/lib/seo-config";
import { buildLockedHistorySummary, buildVinPageSeo, lockedPreviewSignalsHaveFindings, type LockedPreviewSignals, type VinSeoLang } from "@workspace/vin-page-seo";
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
import { PhotoLightbox } from "@/components/photo-lightbox";
import { mileageColor } from "@/lib/mileage-color";
import {
  AnimatedMileageBadge,
  AnimatedMileageKm,
  VinMileageGauge,
} from "@/components/vin-mileage-animated";
import { createVinReportFetchError } from "@/lib/api-error";
import { VinReportErrorView, resolveVinReportErrorKind } from "@/components/vin-report-error";
import { useQueryRecovery } from "@/hooks/use-query-recovery";
import { resolveLatestOdometerRecordedDate, resolveLatestRecordedOdometer } from "@/lib/resolve-latest-odometer";
import { translateFuelType } from "@/lib/translate-fuel-type";
import {
  BODY_I18N_KEYS as BODY_KEYS,
  TRANSMISSION_I18N_KEYS as TRANSMISSION_KEYS,
  translateColor,
  translateMappedValue,
} from "@/lib/vehicle-attr-options";
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
import { buildUnlockCheckoutTarget } from "@/lib/checkout-vin-flow";
import { VinLookupDisabledBanner } from "@/components/vin-lookup-disabled-banner";
import { repairDatedRecords } from "@/lib/encar-date-repair";
import { formatCountryName, formatLocationLabel, countryLabelsFromT } from "@/lib/format-country-name";
import { computeVinConditionScore, hasMileageRollback, scoreInputFromPublic } from "@/lib/vin-condition-score";
import { buildVinHeroSummaryItems } from "@/lib/vin-hero-summary";
import { countAccidentSignals } from "@/lib/accident-signals";
import { formatAccidentCount } from "@/lib/format-accident-count";
import { VIN_REPORT_QUERY_OPTIONS } from "@/lib/vin-report-cache";
import { prefetchVinImages } from "@/lib/vin-image-cache";
import { resolveReportPhotoSets } from "@/lib/report-photos";
import { KoreanWonAmount } from "@/components/korean-won-amount";
import { formatAmountPlain, resolveAmountDisplayCurrency } from "@/lib/korean-currency";
import { VinMarketDataSection } from "@/components/vin-market-data-section";
import { InsuranceClaimsSection } from "@/components/insurance-claims-section";
import { FloodDamageSection } from "@/components/flood-damage-section";
import { useReportKrwPerUsd } from "@/hooks/use-report-krw-per-usd";
import { useDisplayPrice } from "@/hooks/use-display-price";
import { RegistryHistorySection } from "@/components/registry-history-section";
import { ServiceHistorySection } from "@/components/service-history-section";
import { VehicleExtrasSection } from "@/components/vehicle-extras-section";
import { VehicleIdentitySheet } from "@/components/vehicle-identity-sheet";
import { OwnerHistoryTimeline } from "@/components/owner-history-timeline";
import { AuctionHistoryTimeline } from "@/components/auction-history-timeline";
import { ReportHistoryTimeline } from "@/components/report-history-timeline";
import { collectReportTimelineEvents, shouldShowReportTimeline } from "@/lib/report-history-timeline";
import type { InsuranceClaimEntry } from "@/lib/insurance-claims";
import type { RegistryHistoryEntry } from "@/lib/registry-history";
import { pathFor } from "@/lib/localized-routes";
import type { ServiceHistoryEntry } from "@/components/service-history-section";
import type { VehicleExtraEntry } from "@/components/vehicle-extras-section";
import {
  VinLockedFindingsSummary,
  VinLockedSectionCard,
  VinLockedTimelinePreview,
} from "@/components/vin-locked-preview";
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

type Accident = {
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

type VinPublicReport = {
  vin: string;
  make: string | null;
  model: string | null;
  year: number | null;
  trim?: string | null;
  engine: string | null;
  transmission: string | null;
  color: string | null;
  country: string | null;
  thumbnailUrl: string | null;
  providerName: string | null;
  inCatalog: boolean;
  isUnlocked: boolean;
  price?: number | null;
  currency?: string | null;
  odometer?: number | null;
  odometerLocked?: boolean;
  accidents?: Accident[];
  accidentCount?: number | null;
  ownerCount?: number | null;
  salvage?: boolean | null;
  stolen?: boolean | null;
  taxi?: boolean | null;
  flooded?: boolean | null;
  floodCount?: number | null;
  floodLossAmount?: number | null;
  titleStatus?: string | null;
  photos?: string[] | null;
  photosHd?: string[] | null;
  photoAlternates?: Array<string | null> | null;
  photos360Exterior?: string[] | null;
  photos360Interior?: string[] | null;
  photos360EmbedUrl?: string | null;
  photos360EmbedExteriorUrl?: string | null;
  photos360EmbedInteriorUrl?: string | null;
  hp?: number | null;
  cylinders?: number | null;
  bodyType?: string | null;
  fuelType?: string | null;
  mileageHistory?: MileageEntry[] | null;
  ownerHistory?: OwnerEntry[] | null;
  marketData?: {
    estimatedValue?: number | null;
    currency?: string | null;
    lastAuctionPrice?: number | null;
    lastAuctionDate?: string | null;
  } | null;
  insuranceClaims?: InsuranceClaimEntry[] | null;
  registryHistory?: RegistryHistoryEntry[] | null;
  recallHistory?: RegistryHistoryEntry[] | null;
  /** Opaque: `"getcarapi"` → Events section (not Korean registry). */
  dataSource?: "getcarapi" | null;
  serviceHistory?: ServiceHistoryEntry[] | null;
  vehicleExtras?: VehicleExtraEntry[] | null;
  auctionHistory?: AuctionEntry[] | null;
  krwPerUsd?: number | null;
  /** Locked preview only — safe counts, never accidents. */
  previewSignals?: LockedPreviewSignals | null;
};

interface Props {
  params: { id: string; lang: string };
}

const SEVERITY_KEYS = ACCIDENT_SEVERITY_I18N_KEYS;

function translateValue(raw: string | null | undefined, map: Record<string, string>, t: (k: string) => string): string | null {
  return translateMappedValue(raw, map, t) ?? (raw?.trim() || null);
}


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

// ── Mileage Timeline ───────────────────────────────────────────────────────────
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
            <div
              className={cn(
                "absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white ring-2",
                col.dot,
              )}
            />
            {!isLast && <div className="absolute left-[6px] top-5 bottom-0 w-0.5 bg-[#00a5fd]/20" />}
            <div className={cn("pb-5", isLast && "pb-0")}>
            <div className="flex items-start justify-between gap-3">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                {entry.date ? localizeProviderDate(entry.date, language, vehicleYear, vehicleCountry) : null}
              </p>
              {isFirst && <Badge variant="secondary" className="text-[10px]">{t("latest")}</Badge>}
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className={cn("font-black tabular-nums", col.text, isFirst ? "text-2xl" : "text-lg")}>
                {isFirst ? (
                  <AnimatedMileageKm value={km} />
                ) : (
                  km.toLocaleString()
                )}
              </span>
              <span className="text-sm text-muted-foreground">{entry.unit ?? "km"}</span>
            </div>
            <dl className="mt-2 space-y-1">
              {entry.auctionPrice != null && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{t("auction_price")}</dt>
                  <dd className="text-xs font-semibold tabular-nums">${entry.auctionPrice.toLocaleString()}</dd>
                </div>
              )}
              {locationLabel && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{t("registry_field_location")}</dt>
                  <dd className="text-right text-xs font-semibold">{locationLabel}</dd>
                </div>
              )}
              {cond && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{t("condition")}</dt>
                  <dd className="text-right text-xs font-semibold">{cond}</dd>
                </div>
              )}
              {primaryDmg && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{t("primary_damage")}</dt>
                  <dd className="text-right text-xs font-semibold">{primaryDmg}</dd>
                </div>
              )}
              {secondaryDmg && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{t("secondary_damage")}</dt>
                  <dd className="text-right text-xs font-semibold">{secondaryDmg}</dd>
                </div>
              )}
              {titleLabel && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{t("mileage_title")}</dt>
                  <dd className="text-right text-xs font-semibold">{titleLabel}</dd>
                </div>
              )}
              {status && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{t("status")}</dt>
                  <dd className="text-right text-xs font-semibold">{status}</dd>
                </div>
              )}
              {servicesNote && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{t("mileage_description")}</dt>
                  <dd className="text-right text-xs font-semibold">{servicesNote}</dd>
                </div>
              )}
            </dl>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Owner Timeline ─────────────────────────────────────────────────────────────
// (see components/owner-history-timeline.tsx)

export default function VinPublic({ params }: Props) {
  const { t, language } = useTranslation();
  const { isSignedIn, isLoaded, user } = useAuth();
  const [, setLocation] = useLocation();
  const [expandedAccidents, setExpandedAccidents] = useState<Set<number>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const openLightbox = useCallback((i: number) => setLightboxIndex(i), []);
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const navLightbox = useCallback((i: number) => setLightboxIndex(i), []);

  const vin = params.id.toUpperCase();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const buildShareUrl = useCallback(() => {
    const origin = window.location.origin;
    return `${origin}${basePath}/${language}/vin/${vin}`;
  }, [basePath, language, vin]);

  const handleUnlock = useCallback(() => {
    const target = buildUnlockCheckoutTarget(vin, language, !!isSignedIn);
    if (target) window.location.assign(target.href);
  }, [vin, language, isSignedIn]);

  const { displayPrice, fmtPrice } = useDisplayPrice();
  const priceStr = displayPrice != null ? fmtPrice(displayPrice) : null;

  const { data, isLoading, isError, error, isFetching, refetch } = useQuery<VinPublicReport>({
    queryKey: ["/api/vin/public", vin, user?.id ?? null],
    enabled: isLoaded,
    queryFn: async () => {
      const r = await fetch(`${basePath}/api/vin/public/${vin}`, {
        credentials: "include",
      });
      if (r.status === 404) {
        throw createVinReportFetchError(404);
      }
      if (r.status === 403) {
        throw createVinReportFetchError(403);
      }
      if (!r.ok) {
        throw createVinReportFetchError(r.status);
      }
      return r.json() as Promise<VinPublicReport>;
    },
    ...VIN_REPORT_QUERY_OPTIONS,
    retry: 2,
  });

  const krwPerUsd = useReportKrwPerUsd(data?.krwPerUsd);

  const notFound = isError && !data && !!(error as { notFound?: boolean })?.notFound;
  const forbidden = isError && !data && !!(error as { forbidden?: boolean })?.forbidden;
  useQueryRecovery(isError && !!data, isFetching, refetch);

  const seoLang = language as VinSeoLang;
  const seoOrigin = typeof window !== "undefined" ? window.location.origin : SITE_ORIGIN;

  const vinOnlySeo = useMemo(
    () => buildVinPageSeo(seoLang, { vin }, seoOrigin),
    [seoLang, vin, seoOrigin],
  );

  const pageSeo = useMemo(() => {
    if (!data) return vinOnlySeo;
    const photos = (data.photos ?? (data.thumbnailUrl ? [data.thumbnailUrl] : [])).filter(Boolean);
    const resolvedOdometer = data.isUnlocked
      ? resolveLatestRecordedOdometer({
          odometer: data.odometer,
          odometerLocked: data.odometerLocked === true,
          country: data.country,
          mileageHistory: data.mileageHistory,
          ownerHistory: data.ownerHistory,
          registryHistory: data.registryHistory,
        })
      : null;
    return buildVinPageSeo(
      seoLang,
      {
        vin,
        make: data.make,
        model: data.model,
        year: data.year,
        trim: data.trim,
        engine: data.engine,
        transmission: data.transmission,
        color: data.color,
        country: data.country,
        bodyType: data.bodyType,
        fuelType: data.fuelType,
        thumbnailUrl: photos[0] ?? data.thumbnailUrl,
      },
      seoOrigin,
      {
        isUnlocked: data.isUnlocked,
        odometer: resolvedOdometer,
        findingsSummary: !data.isUnlocked && data.previewSignals
          ? buildLockedHistorySummary(seoLang, {
              vin,
              make: data.make,
              model: data.model,
              year: data.year,
            }, data.previewSignals, {
              eventsMode: data.dataSource === "getcarapi",
            })
          : undefined,
      },
    );
  }, [data, seoLang, vin, seoOrigin, vinOnlySeo]);

  const seoBlock = (
    <SEOHead
      title={pageSeo.title}
      description={pageSeo.description}
      lang={seoLang}
      canonicalPath={pageSeo.canonicalPath}
      jsonLd={notFound ? undefined : pageSeo.jsonLd}
      ogImage={pageSeo.ogImage}
      ogImageAlt={pageSeo.ogImageAlt}
      noIndex={notFound || pageSeo.noIndex || undefined}
    />
  );

  const vehicleTitle = data?.make
    ? [data.year ? String(data.year) : null, data.make, data.model ?? null].filter(Boolean).join(" ")
    : t("vin_report_untitled");

  useEffect(() => {
    if (forbidden) {
      setLocation(`/${language}`, { replace: true });
    }
  }, [forbidden, language, setLocation]);

  useLayoutEffect(() => {
    if (!data) return;
    const { photos: all } = resolveReportPhotoSets(data);
    const urls = data.isUnlocked ? all : all.slice(0, 1);
    if (urls.length) void prefetchVinImages(urls, { centerIndex: 0, radius: 1 });
  }, [data]);

  const toggleAccident = (i: number) => {
    setExpandedAccidents(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  if ((isLoading && !data) || !isLoaded) {
    return (
      <>
        {seoBlock}
        <div className={VIN_REPORT_PAGE_FIELD}>
        <div className={VIN_REPORT_PAGE_SHELL}>
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-52 w-full rounded-md" />
        <Skeleton className="h-40 w-full rounded-md" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-md" />
          ))}
        </div>
      </div>
      </div>
      </>
    );
  }

  if (notFound) {
    return (
      <>
        {seoBlock}
        <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-5">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
          <Car className="h-7 w-7 text-muted-foreground/50" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{t("vin_public_not_found")}</h1>
          <p className="text-sm text-muted-foreground">{t("vin_public_not_found_desc")}</p>
        </div>
        <Button asChild className="mt-2">
          <Link href={pathFor(language, "checkout", { query: `vin=${vin}` })}>{t("vin_public_check_cta")}</Link>
        </Button>
      </div>
      </>
    );
  }

  if (forbidden) {
    return null;
  }

  // ── Error (only when nothing was loaded yet) ───────────────────────────────
  if (isError && !data) {
    const kind = resolveVinReportErrorKind(error);
    return (
      <>
        {seoBlock}
        <VinReportErrorView
          kind={kind}
          language={language}
          showDashboardLink={kind !== "forbidden"}
          onRetry={kind === "server" || kind === "unknown" || kind === "rate_limit" ? () => void refetch() : undefined}
          isRetrying={isFetching}
        />
      </>
    );
  }

  if (!data) return null;

  const isGetCarApi = data.dataSource === "getcarapi";
  const insuranceClaims = sortHistoryNewestFirst(
    sanitizeInsuranceClaims(repairDatedRecords(data.insuranceClaims, data.year), data.year),
  );
  const accidentSeverityCtx = {
    vehicleCountry: data.country,
    krwPerUsd,
    hasKoreanInsuranceClaims: insuranceClaims.length > 0,
  };
  const accidents = sortHistoryNewestFirst(
    sanitizeAccidents(repairDatedRecords(data.accidents, data.year), data.year).map((acc) => ({
      ...acc,
      severity: resolveAccidentSeverityForDisplay(acc, accidentSeverityCtx),
    })),
  );
  const accidentCount = accidents.length;
  // Do not useMemo after early returns — conditional hooks crash loading → data transitions.
  const { photos, photosHd, photoAlternates } = resolveReportPhotoSets(data);
  // Locked: keep a few candidates so the hero can skip a broken primary (not yet cached/mirrored).
  const heroPhotos = data.isUnlocked ? photos : photos.slice(0, 4);
  const heroPhotoAlternates = data.isUnlocked
    ? photoAlternates
    : photoAlternates.slice(0, heroPhotos.length);
  const lightboxPhotos = data.isUnlocked ? photosHd : photosHd.slice(0, 1);
  const mileageHistory = sortHistoryNewestFirst(
    sanitizeMileageHistory(repairDatedRecords(data.mileageHistory, data.year), data.year),
  );
  const ownerHistory = sortHistoryNewestFirst(sanitizeOwnerHistory(data.ownerHistory, data.year));
  const auctionHistory = sortHistoryNewestFirst(sanitizeAuctionHistory(data.auctionHistory, data.year));
  const marketData = data.marketData ?? null;
  const registryHistory = sortHistoryNewestFirst(
    sanitizeRegistryHistory(
      enrichRegistryHistoryDates(
        repairDatedRecords(data.registryHistory, data.year),
        [...(data.mileageHistory ?? []), ...(data.ownerHistory ?? [])],
        data.year,
      ),
      data.year,
      { listingOdometer: data.odometer },
    ),
  );
  const recallHistory = sortHistoryNewestFirst(
    sanitizeRecallHistory(repairDatedRecords(data.recallHistory, data.year), data.year),
  );
  const serviceHistory = sortHistoryNewestFirst(
    sanitizeServiceHistory(repairDatedRecords(data.serviceHistory, data.year), data.year),
  );
  const vehicleExtras = data.vehicleExtras ?? [];
  const timelineEvents = collectReportTimelineEvents({
    year: data.year,
    accidents,
    insuranceClaims,
    mileageHistory,
    serviceHistory,
    auctionHistory,
    ownerHistory,
    registryHistory,
  });
  const mileageSourceInput = {
    odometer: data.odometer,
    odometerLocked: data.odometerLocked === true,
    country: data.country,
    mileageHistory,
    ownerHistory,
    registryHistory,
  };
  const odometer = resolveLatestRecordedOdometer(mileageSourceInput);
  const mileageRecordedDateRaw = resolveLatestOdometerRecordedDate(mileageSourceInput);
  const mileageRecordedDate = mileageRecordedDateRaw
    ? localizeProviderDate(mileageRecordedDateRaw, language, data?.year, data?.country)
    : null;
  const hasTheftData = data.stolen != null;
  const showAccidentsSection = data.isUnlocked && accidents.length > 0;
  const showAccidentsClear =
    data.isUnlocked
    && accidents.length === 0
    && (isGetCarApi || data.accidentCount === 0);
  const showMileageSection = data.isUnlocked && hasMileageData(odometer, mileageHistory);
  const showOwnershipSection = data.isUnlocked && hasOwnershipData(ownerHistory, data.ownerCount);
  const showAuctionSection = data.isUnlocked && auctionHistory.length > 0;
  const showSafetySection = data.isUnlocked && hasSafetyData(data.salvage, data.stolen);
  const showRecallSection = data.isUnlocked && recallHistory.length > 0;
  const showMarketDataSection = data.isUnlocked && hasMeaningfulMarketData(marketData);

  const odoMax = 300000;
  const odoPct = odometer ? Math.min(100, (odometer / odoMax) * 100) : 0;
  const odoCol = odometer ? mileageColor(odometer) : null;
  const mileageRollback = hasMileageRollback(mileageHistory);
  const titleHintKind = titleBrandHintKind(data.titleStatus);
  const showHighOwnerHint = isHighOwnerCount(data.ownerCount);

  const accidentSignals = countAccidentSignals({
    accidents,
    accidentCount: data.accidentCount,
    insuranceClaims,
    registryHistory,
  });

  const scoreData = data.isUnlocked
    ? computeVinConditionScore(
        scoreInputFromPublic({ ...data, odometer, mileageHistory, insuranceClaims, registryHistory, accidents }),
        t,
      )
    : null;

  const countryLabels = countryLabelsFromT(t);
  const fmtCountry = (value?: string | null) =>
    value ? formatCountryName(value, language, countryLabels) : null;

  const heroSummary = buildVinHeroSummaryItems({
    t,
    locked: !data.isUnlocked,
    odometer,
    hasMileage: odometer != null && !!odoCol,
    hasSalvageData: data.salvage != null,
    isSalvage: data.salvage,
    hasTheftData: data.stolen != null,
    isStolen: data.stolen,
    isTaxi: data.taxi === true,
  });

  const lockedHint = t("vin_public_locked_hint");
  const previewSignals = !data.isUnlocked ? data.previewSignals ?? null : null;
  const foundLabel = (count: number) =>
    t("vin_public_found_count").replace("{count}", String(count));

  const vehicleSpecFields = [
    { key: "make", label: t("free_decoder_field_make"), value: data.make },
    { key: "model", label: t("free_decoder_field_model"), value: data.model },
    { key: "year", label: t("free_decoder_field_year"), value: data.year ? String(data.year) : null },
    ...(data.isUnlocked && data.trim
      ? [{ key: "trim", label: t("free_decoder_field_trim"), value: data.trim }]
      : []),
    ...(data.isUnlocked
      ? [{ key: "fuel", label: t("free_decoder_field_fuel_type"), value: translateFuelType(t, data.fuelType) ?? cleanLabel(data.fuelType) }]
      : []),
    { key: "transmission", label: t("free_decoder_field_transmission"), value: translateValue(data.transmission, TRANSMISSION_KEYS, t) },
    { key: "country", label: t("country"), value: fmtCountry(data.country) },
    { key: "engine", label: t("free_decoder_field_engine"), value: data.engine },
    { key: "color", label: t("color"), value: translateColor(t, data.color) ?? data.color },
    ...(data.isUnlocked
      ? [
          { key: "body", label: t("free_decoder_field_body_type"), value: translateValue(data.bodyType, BODY_KEYS, t) ?? cleanLabel(data.bodyType) },
          { key: "hp", label: t("hp"), value: data.hp ? `${data.hp} hp` : null },
          { key: "cylinders", label: t("cylinders"), value: data.cylinders ? String(data.cylinders) : null },
        ]
      : []),
  ].filter((field) => field.value);

  const printReportUrl = typeof window !== "undefined" ? buildShareUrl() : undefined;

  const accidentPrintHighlights = buildAccidentPrintHighlights(
    accidents, t, language, data.country, krwPerUsd, data.year, insuranceClaims.length > 0, countryLabels,
  );
  const insurancePrintHighlights = buildInsurancePrintHighlights(insuranceClaims, t, language, data.country, krwPerUsd, data.year);
  const mileagePrintRows = buildMileagePrintRows(mileageHistory, t, language, data.year, data.country, countryLabels);
  const ownerPrintRows = buildOwnerPrintRows(ownerHistory, language, data.year, countryLabels, data.country);
  const registryPrintRows = buildRegistryPrintRows(registryHistory, t, language, data.country, krwPerUsd, data.year);
  const auctionPrintRows = buildAuctionPrintRows(auctionHistory, t, language, data.year, countryLabels, data.country);
  const printMarketValue = marketData?.estimatedValue != null
    ? formatAmountPlain(
      marketData.estimatedValue,
      resolveAmountDisplayCurrency({
        currency: marketData.currency,
        vehicleCountry: data.country,
      }),
    )
    : null;
  const printLastAuction = marketData?.lastAuctionPrice != null
    ? [
        `$${Math.round(marketData.lastAuctionPrice).toLocaleString()}`,
        marketData.lastAuctionDate
          ? formatMarketAuctionDate(marketData.lastAuctionDate, language, data.year, data.country)
          : null,
      ].filter(Boolean).join(" · ")
    : null;

  return (
    <>
      {seoBlock}

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && lightboxPhotos.length > 0 && (
          <PhotoLightbox
            photos={lightboxPhotos}
            index={Math.min(lightboxIndex, lightboxPhotos.length - 1)}
            onClose={closeLightbox}
            onNav={navLightbox}
          />
        )}
      </AnimatePresence>

      <div className={VIN_REPORT_PAGE_FIELD}>
      <div className={cn(VIN_REPORT_PAGE_SHELL, !data.isUnlocked && "pb-28")}>

        {/* Back — signed-in users only */}
        {isSignedIn && (
          <Button variant="ghost" size="sm" asChild className="-ml-2 h-9 rounded-xl text-slate-600 hover:bg-white/70 hover:text-[#071018] print:hidden">
            <Link href={pathFor(language, "dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("back_to_dashboard")}
            </Link>
          </Button>
        )}

        {!data.isUnlocked && <VinLookupDisabledBanner className="print:hidden" />}

        {data.isUnlocked && (
          <VinPrintSummary
            vehicleTitle={vehicleTitle}
            vin={vin}
            country={data.country}
            scoreValue={scoreData?.score}
            scoreLabel={scoreData?.label}
            make={data.make}
            model={data.model}
            year={data.year}
            engine={data.engine}
            transmission={translateValue(data.transmission, TRANSMISSION_KEYS, t) ?? data.transmission}
            fuelType={translateFuelType(t, data.fuelType) ?? undefined}
            color={data.color}
            bodyType={translateValue(data.bodyType, BODY_KEYS, t) ?? data.bodyType ?? undefined}
            hp={data.hp}
            odometer={odometer}
            titleStatus={data.titleStatus}
            photos={photos}
            accidentCount={accidentSignals}
            accidentHighlights={accidentPrintHighlights}
            insuranceCount={insuranceClaims.length}
            insuranceHighlights={insurancePrintHighlights}
            mileageRows={mileagePrintRows}
            ownerRows={ownerPrintRows}
            registryRows={registryPrintRows}
            auctionRows={auctionPrintRows}
            ownerCount={data.ownerCount}
            isSalvage={data.salvage}
            isStolen={data.stolen}
            isTaxi={data.taxi === true}
            isFlooded={data.flooded}
            hasFloodData={data.flooded != null || isKoreanCountry(data.country) || isGetCarApi}
            hasSalvageData={data.salvage != null}
            hasTheftData={data.stolen != null}
            marketValue={printMarketValue}
            lastAuction={printLastAuction}
            reportUrl={printReportUrl}
          />
        )}

        <div className="vin-report-screen space-y-5 sm:space-y-7">
        <VinReportHero
          vehicleTitle={vehicleTitle}
          vin={vin}
          country={data.country}
          trim={data.trim}
          photos={heroPhotos}
          photoAlternates={heroPhotoAlternates}
          locked={!data.isUnlocked}
          lockedLabel={data.isUnlocked ? undefined : t("vin_public_gallery_locked")}
          unlockedLabel={data.isUnlocked ? t("vin_public_unlocked_badge") : undefined}
          scoreData={scoreData}
          summaryItems={heroSummary}
          accidentCount={data.isUnlocked ? accidentSignals : 0}
          onPhotoClick={data.isUnlocked && heroPhotos.length > 0 ? (i) => openLightbox(i) : undefined}
          lockedPanel={
            !data.isUnlocked
            && previewSignals
            && lockedPreviewSignalsHaveFindings(previewSignals)
              ? (
                <VinLockedFindingsSummary
                  signals={previewSignals}
                  t={t}
                  eventsMode={isGetCarApi}
                />
              )
              : undefined
          }
        >
          {data.isUnlocked ? (
            <>
          {showAccidentsSection && (
            <div className="!hidden print:!inline-flex">
              <PassPill ok={false} labelOk="" labelFail={formatAccidentCount(t, accidentCount)} />
            </div>
          )}
          {showAccidentsClear ? (
            <PassPill ok labelOk={t("vin_public_no_accidents")} labelFail="" />
          ) : null}
          {data.isUnlocked && odometer != null && odoCol ? (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-2.5 py-1 sm:px-3 max-w-full shadow-sm">
              <Gauge className="h-3 w-3 shrink-0 opacity-90" />
              <span className="text-[10px] sm:text-[11px] font-semibold tabular-nums">
                {odometer.toLocaleString()} km
              </span>
            </div>
          ) : null}
          {data.isUnlocked ? (
            <div className="inline-flex items-center gap-1 max-w-full">
              <PassPill
                ok={data.salvage !== true}
                labelOk={t("report_no_salvage")}
                labelFail={t("salvage_flagged")}
              />
              {data.salvage === true ? <SalvageMeaningHint className="shrink-0" /> : null}
            </div>
          ) : null}
          {data.isUnlocked ? (
            <PassPill
              ok={data.stolen !== true}
              labelOk={t("report_not_stolen")}
              labelFail={t("theft_flagged")}
            />
          ) : null}
          {data.isUnlocked && (data.flooded != null || isKoreanCountry(data.country) || isGetCarApi) ? (
            <PassPill ok={data.flooded !== true} labelOk={t("report_not_flooded")} labelFail={t("flood_flagged")} />
          ) : null}
          {data.isUnlocked ? (
            <PassPill ok={data.taxi !== true} labelOk={t("report_not_taxi")} labelFail={t("taxi_flagged")} />
          ) : null}
            </>
          ) : null}
        </VinReportHero>

        {data.isUnlocked && shouldShowReportTimeline(timelineEvents) ? (
          <ReportHistoryTimeline
            events={timelineEvents}
            t={t}
            language={language}
            vehicleYear={data.year}
            vehicleCountry={data.country}
            krwPerUsd={krwPerUsd}
          />
        ) : !data.isUnlocked ? (
          <VinLockedTimelinePreview
            t={t}
            priceLabel={priceStr}
            onUnlock={handleUnlock}
          />
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-start print-two-col min-w-0">

          {/* RIGHT COLUMN — accidents, safety, mileage, owners */}
          <div className="space-y-4 sm:space-y-6 min-w-0 order-2 lg:order-2 print:order-2">
            {!data.isUnlocked ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                <VinLockedSectionCard
                  title={t("vin_public_accidents_section")}
                  icon={AlertTriangle}
                  delay={0.12}
                  hint={lockedHint}
                  variant="rows"
                  accent="bg-orange-500/10 text-orange-600 dark:text-orange-400"
                />
                <VinLockedSectionCard
                  title={t("vin_public_safety_section")}
                  icon={ShieldCheck}
                  delay={0.15}
                  hint={lockedHint}
                  variant="stats"
                  accent="bg-[#00a5fd]/10 text-[#0088d4] dark:text-[#00a5fd]"
                />
                <VinLockedSectionCard
                  title={t("vin_public_mileage_section")}
                  icon={Gauge}
                  delay={0.18}
                  hint={lockedHint}
                  variant="timeline"
                  accent="bg-sky-500/10 text-sky-600 dark:text-sky-400"
                  foundCount={previewSignals?.mileageRecordCount}
                  foundLabel={previewSignals && previewSignals.mileageRecordCount > 0
                    ? foundLabel(previewSignals.mileageRecordCount)
                    : undefined}
                />
                <VinLockedSectionCard
                  title={t("vin_result_owners_title")}
                  icon={Users}
                  delay={0.21}
                  hint={lockedHint}
                  variant="rows"
                  accent="bg-violet-500/10 text-violet-600 dark:text-violet-400"
                  foundCount={previewSignals?.ownerCount}
                  foundLabel={previewSignals && previewSignals.ownerCount > 0
                    ? foundLabel(previewSignals.ownerCount)
                    : undefined}
                />
              </div>
            ) : (
              <>

            {/* Accident History */}
            {showAccidentsSection && (
            <ReportReveal delay={0.15} y={12}>
              <VinReportSection accent="rose">
                <VinReportSectionHeader
                  variant="public"
                  icon={AlertTriangle}
                  accent="rose"
                  title={t("vin_public_accidents_section")}
                />
              <div className="px-6 py-5">
                <div className="space-y-3">
                  {accidents.map((acc, i) => {
                        const style = accidentSeverityStyle(acc.severity);
                        const isExpanded = expandedAccidents.has(i);
                        const sevKey = (acc.severity ?? "").toLowerCase().trim();
                        const isTierSev = ["minor", "light", "moderate", "major", "severe", "total_loss", "unknown"].includes(sevKey);
                        const tierLabel = isTierSev
                          ? (translateValue(acc.severity, SEVERITY_KEYS, t) ?? acc.severity)
                          : null;
                        const headerLabel = tierLabel
                          || formatAccidentDescription(t, language, acc.description)
                          || (acc.type ? formatAccidentType(t, acc.type) : null)
                          || (!isTierSev && acc.severity
                            ? acc.severity.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
                            : null)
                          || t("sev_unknown");
                        const hasExtra = acc.type || acc.primaryDamage || acc.secondaryDamage || acc.airbagDeployed != null || acc.odometerAtLoss != null || acc.lossAmount != null || acc.description;
                        return (
                          <div key={i} className={`rounded-xl border ${style.card}`}>
                            <div className="p-4">
                              <div className="flex items-start gap-3">
                                <div className={`h-2.5 w-2.5 rounded-full mt-1.5 shrink-0 ${style.dot}`} />
                                <div className="flex-1 space-y-0.5 min-w-0">
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <p className={style.text}>
                                      {headerLabel}
                                    </p>
                                    {hasExtra && (
                                      <button
                                        onClick={() => toggleAccident(i)}
                                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                      >
                                        {t("report_details")}
                                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-180")} />
                                      </button>
                                    )}
                                  </div>
                                  {acc.date && (
                                    <p className="text-xs text-muted-foreground">
                                      {localizeAccidentDate(acc.date, language, data.year, data.country)}
                                    </p>
                                  )}
                                  {(acc.location || acc.country) && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                      <MapPin className="h-3 w-3 shrink-0" />
                                      {acc.location
                                        ? (formatLocationLabel(acc.location, language, countryLabels) || acc.location)
                                        : fmtCountry(acc.country)}
                                    </p>
                                  )}
                                  {cleanStr(acc.description) && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {formatAccidentDescription(t, language, acc.description)}
                                  </p>
                                  )}
                                </div>
                              </div>
                              <AnimatePresence>
                                {isExpanded && hasExtra && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="mt-3 pt-3 border-t border-current/10 grid grid-cols-2 gap-x-6 gap-y-2">
                                      {acc.type && (
                                        <div>
                                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("accident_type")}</p>
                                          <p className="text-xs font-medium">
                                            {formatAccidentType(t, acc.type)}
                                          </p>
                                        </div>
                                      )}
                                      {acc.primaryDamage && (
                                        <div>
                                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("primary_damage")}</p>
                                          <p className="text-xs font-medium">{translateDamageLabel(t, acc.primaryDamage)}</p>
                                        </div>
                                      )}
                                      {acc.secondaryDamage && (
                                        <div>
                                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("secondary_damage")}</p>
                                          <p className="text-xs font-medium">{translateDamageLabel(t, acc.secondaryDamage)}</p>
                                        </div>
                                      )}
                                      {acc.odometerAtLoss != null && (
                                        <div>
                                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("odometer_at_loss")}</p>
                                          <p className="text-xs font-medium">{acc.odometerAtLoss.toLocaleString()} km</p>
                                        </div>
                                      )}
                                      {acc.lossAmount != null && (
                                        <div>
                                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("loss_amount")}</p>
                                          <p className="text-xs font-medium">
                                            {(() => {
                                              const code = resolveAmountDisplayCurrency({
                                                currency: acc.currency,
                                                vehicleCountry: data.country,
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
                                          </p>
                                        </div>
                                      )}
                                      {acc.airbagDeployed != null && (
                                        <div>
                                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("airbag_deployed")}</p>
                                          <Badge
                                            variant="outline"
                                            className={cn("text-[10px] mt-0.5", acc.airbagDeployed
                                              ? "border-red-300 text-red-700 dark:text-red-400"
                                              : "border-[#7dd3fc] text-[#0369a1] dark:text-[#33bbfd]"
                                            )}
                                          >
                                            {acc.airbagDeployed ? t("airbag_yes") : t("airbag_no")}
                                          </Badge>
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        );
                      })}
                    </div>
              </div>
              </VinReportSection>
            </ReportReveal>
            )}

            {showAccidentsClear && (
            <ReportReveal delay={0.15} y={12}>
              <VinReportSection accent="sky">
                <VinReportSectionHeader
                  variant="public"
                  icon={ShieldCheck}
                  accent="sky"
                  title={t("vin_public_accidents_section")}
                  trailing={<PassPill ok labelOk={t("vin_public_no_accidents")} labelFail="" />}
                />
                <div className="px-6 py-5">
                  <div className="rounded-xl p-4 flex items-start gap-3 bg-[#e6f6ff] dark:bg-[#003a5c]/40/30 border border-[#b3e3fe] dark:border-[#006aa8]/40">
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-[#ccebfe] dark:bg-[#004d7a]/40/40">
                      <ShieldCheck className="h-4 w-4 text-[#0088d4]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#0369a1] dark:text-[#33bbfd]">{t("vin_public_no_accidents")}</p>
                      <p className="text-xs text-muted-foreground/80 mt-0.5 leading-snug">
                        {t("print_summary_no_accidents")}
                      </p>
                    </div>
                  </div>
                </div>
              </VinReportSection>
            </ReportReveal>
            )}

            {/* Safety Status — Salvage & Theft */}
            {showSafetySection && (
            <ReportReveal delay={0.18} y={12}>
              <VinReportSection accent={safetySectionAccent(data.salvage, data.stolen)}>
                <VinReportSectionHeader
                  variant="public"
                  icon={ShieldCheck}
                  accent={safetySectionAccent(data.salvage, data.stolen)}
                  title={t("safety_status")}
                  trailing={
                    data.isUnlocked && (data.salvage != null || data.stolen != null) ? (
                      <div className="flex items-center gap-1.5">
                        {data.salvage === true ? <SalvageMeaningHint /> : null}
                        <PassPill
                          ok={data.salvage !== true && data.stolen !== true}
                          labelOk={t("all_clear")}
                          labelFail={t("issue_found")}
                        />
                      </div>
                    ) : null
                  }
                />
              <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
                {data.salvage != null && (
                <div className="flex items-center gap-3">
                  {data.salvage === true
                    ? <ShieldAlert className="h-5 w-5 text-red-500 shrink-0" />
                    : <ShieldCheck className="h-5 w-5 text-[#00a5fd] shrink-0" />}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t("report_salvage")}</p>
                      {data.salvage === true ? <SalvageMeaningHint /> : null}
                    </div>
                    <p className={cn("text-sm font-semibold", data.salvage === true ? "text-red-600 dark:text-red-400" : "text-[#0369a1] dark:text-[#33bbfd]")}>
                      {data.salvage === true ? t("report_salvage_flag") : t("report_clean_flag")}
                    </p>
                  </div>
                </div>
                )}
                {data.stolen != null && (
                <div className="flex items-center gap-3">
                  {data.stolen === true
                    ? <ShieldAlert className="h-5 w-5 text-red-500 shrink-0" />
                    : <ShieldCheck className="h-5 w-5 text-[#00a5fd] shrink-0" />}
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t("report_theft")}</p>
                    <p className={cn("text-sm font-semibold", data.stolen === true ? "text-red-600 dark:text-red-400" : "text-[#0369a1] dark:text-[#33bbfd]")}>
                      {data.stolen === true ? t("report_stolen_flag") : t("report_not_stolen")}
                    </p>
                  </div>
                </div>
                )}
                {cleanStr(data.titleStatus) && (
                  <div className="sm:col-span-2 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t("title_status")}</p>
                        {titleHintKind ? <TitleBrandHint kind={titleHintKind} /> : null}
                      </div>
                      <p className="text-sm font-semibold">{translateTitleStatus(t, data.titleStatus)}</p>
                    </div>
                  </div>
                )}
              </div>
              </VinReportSection>
            </ReportReveal>
            )}

            {/* Recalls — Korean manufacturer recalls */}
            {showRecallSection && (
              <RegistryHistorySection
                events={recallHistory}
                country={data.country}
                vehicleYear={data.year}
                krwPerUsd={krwPerUsd}
                t={t}
                language={language}
                variant="public"
                kind="recall"
                delay={0.185}
              />
            )}

            {/* Auction History */}
            {showAuctionSection && (
            <ReportReveal delay={0.19} y={12}>
              <VinReportSection accent="slate">
                <VinReportSectionHeader
                  variant="public"
                  icon={Gavel}
                  accent="slate"
                  title={t("auction_history")}
                  trailing={
                    <Badge variant="secondary" className="text-xs tabular-nums">
                      {auctionHistory.length}
                    </Badge>
                  }
                />
              <div className="px-4 py-4 sm:px-6 sm:py-5">
                <AuctionHistoryTimeline history={auctionHistory} t={t} language={language} vehicleYear={data.year} vehicleCountry={data.country} />
              </div>
              </VinReportSection>
            </ReportReveal>
            )}

            {/* Mileage Timeline */}
            {showMileageSection && (
            <ReportReveal delay={0.2} y={12}>
              <VinReportSection accent="orange">
                <VinReportSectionHeader
                  variant="public"
                  icon={Gauge}
                  accent="orange"
                  title={t("vin_public_mileage_section")}
                  trailing={
                    odometer != null && odoCol ? (
                      <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 bg-primary text-primary-foreground shadow-sm shrink-0">
                        <Gauge className="h-3 w-3 shrink-0 opacity-90" />
                        <AnimatedMileageBadge
                          odometer={odometer}
                          className="text-[11px] font-semibold tabular-nums"
                        />
                      </div>
                    ) : null
                  }
                />
              <div className="px-4 py-3">
                {odometer != null && odoCol ? (
                  <VinMileageGauge
                    odometer={odometer}
                    odoMax={odoMax}
                    t={t}
                    size="sm"
                    showScale={mileageHistory.length <= 1}
                    recordedDate={mileageRecordedDate}
                    className={mileageHistory.length > 1 ? "mb-4 pb-3 border-b border-border/60" : "mb-4"}
                  />
                ) : null}
                {mileageRollback ? (
                  <div className="flex items-start gap-2 p-3 rounded-xl mb-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-200/60 dark:border-amber-800/40">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1 flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                        {t("mileage_rollback_warning")}
                      </p>
                      <MileageRollbackHint className="shrink-0" />
                    </div>
                  </div>
                ) : null}
                <MileageTimeline history={mileageHistory} t={t} language={language} vehicleYear={data.year} vehicleCountry={data.country} />
              </div>
              </VinReportSection>
            </ReportReveal>
            )}

            {/* Owner History */}
            {showOwnershipSection && (
            <ReportReveal delay={0.22} y={12}>
              <VinReportSection accent={ownershipSectionAccent(data.ownerCount)}>
                <VinReportSectionHeader
                  variant="public"
                  icon={Users}
                  accent={ownershipSectionAccent(data.ownerCount)}
                  title={t("vin_result_owners_title")}
                  trailing={showHighOwnerHint ? <HighOwnerCountHint /> : null}
                />
              {ownerHistory.length > 0 ? (
                <div className="px-6 py-5">
                  <OwnerHistoryTimeline history={ownerHistory} t={t} language={language} vehicleYear={data.year} vehicleCountry={data.country} />
                </div>
              ) : data.ownerCount != null ? (
                <div className="px-6 py-5">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold">
                      {data.ownerCount === 1 ? t("owner_single") : `${data.ownerCount} ${t("owner_many_suffix")}`}
                    </p>
                    {showHighOwnerHint ? <HighOwnerCountHint /> : null}
                  </div>
                </div>
              ) : null}
              </VinReportSection>
            </ReportReveal>
            )}

              </>
            )}

          </div>{/* END RIGHT COLUMN */}

          {/* LEFT COLUMN — photos, specs, market */}
          <div className="space-y-4 sm:space-y-6 min-w-0 order-1 lg:order-1 print:order-1 overflow-hidden">

            {/* Vehicle Specs */}
            <ReportReveal delay={0.1} y={12}>
              <VinReportSection accent="sky" className="overflow-hidden">
                <VehicleIdentitySheet fields={vehicleSpecFields} />
              </VinReportSection>
            </ReportReveal>

            {data.isUnlocked && data.flooded != null ? (
              <ReportReveal y={16} inView>
                <FloodDamageSection
                  isFlooded={data.flooded}
                  floodCount={data.floodCount}
                  floodLossAmount={data.floodLossAmount}
                  country={data.country}
                  krwPerUsd={krwPerUsd}
                  t={t}
                  language={language}
                  variant="public"
                />
              </ReportReveal>
            ) : null}

            {data.isUnlocked ? (
              <VinPhoto360Viewer
                exterior={data.photos360Exterior}
                interior={data.photos360Interior}
                embedUrl={data.photos360EmbedUrl}
                embedExteriorUrl={data.photos360EmbedExteriorUrl}
                embedInteriorUrl={data.photos360EmbedInteriorUrl}
                className="print:hidden"
              />
            ) : null}

            {!data.isUnlocked ? (
              <div className="space-y-4">
                <VinLockedSectionCard
                  title={t("report_insurance_claims")}
                  icon={FileText}
                  delay={0.12}
                  hint={lockedHint}
                  variant="rows"
                  accent="bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  foundCount={previewSignals?.insuranceClaimCount}
                  foundLabel={previewSignals && previewSignals.insuranceClaimCount > 0
                    ? foundLabel(previewSignals.insuranceClaimCount)
                    : undefined}
                />
                {previewSignals && previewSignals.floodRecordCount > 0 ? (
                  <VinLockedSectionCard
                    title={t("report_flood_section")}
                    icon={Droplets}
                    delay={0.135}
                    hint={lockedHint}
                    variant="rows"
                    accent="bg-sky-500/10 text-sky-600 dark:text-sky-400"
                    foundCount={previewSignals.floodRecordCount}
                    foundLabel={foundLabel(previewSignals.floodRecordCount)}
                  />
                ) : null}
                {isGetCarApi ? (
                  <VinLockedSectionCard
                    title={t("report_events_history")}
                    icon={ClipboardList}
                    delay={0.15}
                    hint={lockedHint}
                    variant="rows"
                    accent="bg-sky-500/10 text-sky-600 dark:text-sky-400"
                    foundCount={previewSignals?.registryRecordCount}
                    foundLabel={previewSignals && previewSignals.registryRecordCount > 0
                      ? foundLabel(previewSignals.registryRecordCount)
                      : undefined}
                  />
                ) : isKoreanCountry(data.country) ? (
                  <VinLockedSectionCard
                    title={t("report_registry_history")}
                    icon={ClipboardList}
                    delay={0.15}
                    hint={lockedHint}
                    variant="rows"
                    accent="bg-teal-500/10 text-teal-600 dark:text-teal-400"
                    foundCount={previewSignals?.registryRecordCount}
                    foundLabel={previewSignals && previewSignals.registryRecordCount > 0
                      ? foundLabel(previewSignals.registryRecordCount)
                      : undefined}
                  />
                ) : null}
                <VinLockedSectionCard
                  title={t("report_market_data")}
                  icon={TrendingUp}
                  delay={0.18}
                  hint={lockedHint}
                  variant="stats"
                  accent="bg-[#00a5fd]/10 text-[#0088d4] dark:text-[#00a5fd]"
                />
              </div>
            ) : null}

            {data.isUnlocked && (
              <>
            <InsuranceClaimsSection
              claims={insuranceClaims}
              country={data.country}
              vehicleYear={data.year}
              krwPerUsd={krwPerUsd}
              t={t}
              language={language}
              variant="public"
              delay={0.11}
            />

            <RegistryHistorySection
              events={registryHistory}
              country={data.country}
              vehicleYear={data.year}
              krwPerUsd={krwPerUsd}
              t={t}
              language={language}
              variant="public"
              kind={isGetCarApi ? "events" : "registry"}
              delay={0.115}
            />

            <ServiceHistorySection
              events={serviceHistory}
              vehicleYear={data.year}
              vehicleCountry={data.country}
              t={t}
              language={language}
              variant="public"
              delay={0.118}
            />

            <VehicleExtrasSection
              extras={vehicleExtras}
              vehicleYear={data.year}
              vehicleCountry={data.country}
              t={t}
              language={language}
              variant="public"
              delay={0.119}
            />

            {showMarketDataSection && marketData && (
              <VinMarketDataSection
                marketData={marketData}
                auctionHistory={auctionHistory}
                t={t}
                language={language}
                vehicleCountry={data.country}
                vehicleYear={data.year}
                krwPerUsd={krwPerUsd}
                variant="public"
                reveal={{ delay: 0.12 }}
              />
            )}

              </>
            )}

          </div>{/* END LEFT COLUMN */}

        </div>{/* END 2-COLUMN GRID */}
        </div>{/* END vin-report-screen */}

        {data.isUnlocked && (
          <VinReportShareCard
            vin={vin}
            language={language}
            vehicleTitle={vehicleTitle}
            preview={{
              thumbnailUrl: photos[0] ?? data.thumbnailUrl ?? null,
              odometer,
              accidentCount: accidentSignals,
              ownerCount: data.ownerCount ?? null,
            }}
            basePath={basePath}
          />
        )}

        <PrintReportBranding vin={vin} variant="bottom" />
      </div>
      </div>

      {/* ── Sticky Unlock Bar ── */}
        {!data.isUnlocked && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#00a5fd]/25 bg-[#071018] print:hidden">
          <div className="mx-auto flex max-w-7xl items-center gap-5 px-4 py-4 sm:px-6 lg:px-8">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-white sm:text-base">{t("vin_public_unlock_title")}</p>
              <p className="hidden truncate text-sm text-white/55 sm:block">
                {t("vin_public_unlock_desc")}
              </p>
            </div>
            <Button
              className="h-11 shrink-0 gap-1.5 rounded-md bg-[#00a5fd] px-6 font-bold text-[#041018] shadow-none hover:bg-[#33bbfd]"
              onClick={handleUnlock}
            >
              <Lock className="h-3.5 w-3.5" />
              {priceStr
                ? `${t("vin_public_check_cta")} · ${priceStr}`
                : t("vin_public_check_cta")}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
