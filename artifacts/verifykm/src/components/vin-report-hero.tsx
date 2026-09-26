import { useRef, useState, useCallback, useMemo, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Car, ChevronLeft, ChevronRight, Lock, MapPin, ImageOff,
  CheckCircle2, XCircle, Gauge, ShieldCheck, ShieldAlert,
  Copy, Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/context";
import { formatCountryName, countryLabelsFromT } from "@/lib/format-country-name";
import {
  isVinImageSessionLoaded,
  markVinImageSessionLoaded,
  warmVinImageNeighbors,
} from "@/lib/vin-image-cache";
import { firstAvailablePhotoIndex, nextAvailablePhotoIndex } from "@/lib/report-photos";
import { mileageColor } from "@/lib/mileage-color";

export type VinHeroScore = {
  score: string;
  label: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  accentBar?: string;
  accentGlow?: string;
  /** Soft bottom-right wash matching trust tier (green / amber / red). */
  cornerWash?: string;
  /** Numeric score for accent intensity (risk tier animation). */
  riskTier?: "clean" | "caution" | "risk";
};

export type VinHeroSummaryItem = {
  kind: "accidents" | "mileage" | "salvage" | "theft" | "taxi";
  label: string;
  tone: "positive" | "negative" | "neutral" | "muted";
  /** When set, mileage uses the same color scale as the odometer gauge. */
  mileageKm?: number;
};

type VinReportHeroProps = {
  vehicleTitle: string;
  vin: string;
  country?: string | null;
  trim?: string | null;
  photos?: string[];
  /** Per-index CDN→source fallback when Cloudflare URLs fail. */
  photoAlternates?: Array<string | null>;
  /** @deprecated use photos */
  primaryPhoto?: string | null;
  locked?: boolean;
  lockedLabel?: string;
  unlockedLabel?: string;
  scoreData?: VinHeroScore | null;
  summaryItems?: VinHeroSummaryItem[];
  /** Locked preview: structured findings panel in the hero right column (replaces bottom chips). */
  lockedPanel?: React.ReactNode;
  /** Shown as a rating-style badge to the left of the score on mobile. */
  accidentCount?: number;
  onPhotoClick?: (index: number) => void;
  photoPlaceholderLabel?: string;
  /** Animated radar placeholder while a manual report is being compiled. */
  pendingPhotoScan?: boolean;
  /** Show “can take a couple of hours + email” note under the VIN (pending reports). */
  pendingEta?: boolean;
  children?: React.ReactNode;
  showStatsRow?: boolean;
};

const SUMMARY_ICON: Record<VinHeroSummaryItem["kind"], typeof CheckCircle2> = {
  accidents: CheckCircle2,
  mileage: Gauge,
  salvage: ShieldCheck,
  theft: ShieldAlert,
  taxi: Car,
};

function summaryToneClasses(tone: VinHeroSummaryItem["tone"], kind: VinHeroSummaryItem["kind"]) {
  if (tone === "positive") {
    return {
      row: "text-[#0369a1] dark:text-[#33bbfd]",
      icon: "text-[#0088d4] dark:text-[#00a5fd]",
      Icon: CheckCircle2,
    };
  }
  if (tone === "negative") {
    if (kind === "accidents") {
      return {
        row: "text-orange-700 dark:text-orange-400",
        icon: "text-orange-600 dark:text-orange-500",
        Icon: XCircle,
      };
    }
    return {
      row: "text-red-700 dark:text-red-400",
      icon: "text-red-600 dark:text-red-500",
      Icon: XCircle,
    };
  }
  if (tone === "muted") {
    return {
      row: "text-muted-foreground",
      icon: "text-muted-foreground/70",
      Icon: SUMMARY_ICON[kind],
    };
  }
  return {
    row: "text-foreground",
    icon: "text-primary",
    Icon: SUMMARY_ICON[kind],
  };
}

function mileageTileClasses(km: number) {
  const col = mileageColor(km);
  if (km < 100_000) return { tile: "border-[#00a5fd]/25 bg-[#eef8fd]", text: col.text, dot: "bg-[#00a5fd]" };
  if (km < 140_000) return { tile: "border-lime-200 bg-lime-50", text: col.text, dot: "bg-lime-500" };
  if (km < 180_000) return { tile: "border-amber-200 bg-amber-50", text: col.text, dot: "bg-amber-500" };
  if (km < 200_000) return { tile: "border-orange-200 bg-orange-50", text: col.text, dot: "bg-orange-500" };
  if (km < 230_000) return { tile: "border-orange-300 bg-orange-50", text: col.text, dot: "bg-orange-600" };
  if (km < 250_000) return { tile: "border-orange-300 bg-orange-50", text: col.text, dot: "bg-orange-700" };
  return { tile: "border-red-200 bg-red-50", text: col.text, dot: "bg-red-600" };
}

function HeroSummaryList({ items }: { items: VinHeroSummaryItem[] }) {
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 print:grid">
      {items.map((item) => {
        const tone = summaryToneClasses(item.tone, item.kind);
        const Icon = item.tone === "positive" || item.tone === "negative" ? tone.Icon : SUMMARY_ICON[item.kind];
        const mileage = item.kind === "mileage" && item.mileageKm != null
          ? mileageTileClasses(item.mileageKm)
          : null;
        return (
          <li
            key={item.kind}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-medium",
              mileage
                ? mileage.tile
                : item.tone === "negative"
                  ? "border-red-200 bg-red-50/70"
                  : item.tone === "positive"
                    ? "border-[#00a5fd]/20 bg-[#eef8fd]"
                    : "border-slate-200 bg-[#f7fbfe]",
              mileage ? mileage.text : tone.row,
            )}
          >
            {mileage ? (
              <span className={cn("h-2 w-2 shrink-0 rounded-full", mileage.dot)} aria-hidden />
            ) : (
              <Icon className={cn("h-4 w-4 shrink-0", tone.icon)} aria-hidden />
            )}
            <span className="leading-snug tabular-nums">{item.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

function HeroPhotoPlaceholder({
  vehicleTitle,
  className,
  label,
  pendingScan = false,
  compact = false,
}: {
  vehicleTitle: string;
  className?: string;
  label?: string;
  pendingScan?: boolean;
  /** Shorter empty state on small screens when there are no photos. */
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();

  if (pendingScan) {
    return (
      <div
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-[#071018]",
          className,
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(0,165,253,0.22),transparent_58%)]" />
        {!reduceMotion ? (
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#00a5fd]/25">
            <div className="pending-radar-sweep absolute inset-0 rounded-full" />
          </div>
        ) : null}
        <div className="relative z-[1] flex flex-col items-center justify-center gap-2.5 px-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00a5fd] text-white shadow-[0_0_24px_rgba(0,165,253,0.45)]">
            <Car className="h-6 w-6" aria-hidden />
          </span>
          {label ? (
            <p className="text-center text-[11px] font-semibold leading-snug text-[#7dd3fc] sm:text-xs">
              {label}
            </p>
          ) : null}
        </div>
        <span className="sr-only">{vehicleTitle}</span>
      </div>
    );
  }

  const title = label ?? t("report_no_photo_archive");

  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center gap-2 sm:gap-3 px-4 sm:px-5",
        "bg-gradient-to-br from-muted/80 via-muted/40 to-muted/20",
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute border border-dashed border-border/70 rounded-lg sm:rounded-xl",
          compact ? "inset-2" : "inset-2.5 sm:inset-4",
        )}
      />
      <div
        className={cn(
          "relative flex items-center justify-center rounded-xl sm:rounded-2xl bg-background/70 border border-border/60 shadow-sm",
          compact ? "h-8 w-8 sm:h-14 sm:w-14" : "h-9 w-9 sm:h-14 sm:w-14",
        )}
      >
        <ImageOff
          className={cn(
            "text-muted-foreground/55",
            compact ? "h-4 w-4 sm:h-7 sm:w-7" : "h-[1.125rem] w-[1.125rem] sm:h-7 sm:w-7",
          )}
          aria-hidden
        />
      </div>
      <p
        className={cn(
          "relative max-w-[16rem] text-center font-semibold text-muted-foreground tracking-tight leading-snug",
          compact ? "text-[11px] sm:text-sm" : "text-[11px] sm:text-sm",
        )}
      >
        {title}
      </p>
      <span className="sr-only">{vehicleTitle}</span>
    </div>
  );
}

function HeroPhotoFrame({
  src,
  alt,
  className,
  priority = false,
  isActive = true,
  onLoaded,
  onFailed,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  isActive?: boolean;
  onLoaded?: () => void;
  onFailed?: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const onLoadedRef = useRef(onLoaded);
  const onFailedRef = useRef(onFailed);
  onLoadedRef.current = onLoaded;
  onFailedRef.current = onFailed;
  const [ready, setReady] = useState(() => isVinImageSessionLoaded(src));

  const notifyLoaded = useCallback(() => {
    setReady(true);
    markVinImageSessionLoaded(src);
    onLoadedRef.current?.();
  }, [src]);

  useEffect(() => {
    setReady(isVinImageSessionLoaded(src));
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      notifyLoaded();
    }
  }, [src, notifyLoaded]);

  /** Stop infinite opacity-0/spinner if the image proxy hangs without onError. */
  useEffect(() => {
    if (!isActive || ready) return;
    const timer = window.setTimeout(() => {
      setReady(false);
      onFailedRef.current?.();
    }, 18_000);
    return () => window.clearTimeout(timer);
  }, [src, isActive, ready]);

  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      className={cn(
        "absolute inset-0 w-full h-full object-cover object-[center_62%] transition-opacity duration-150",
        isActive && ready ? "opacity-100" : "opacity-0",
        !isActive && "pointer-events-none",
        className,
      )}
      onLoad={notifyLoaded}
      onError={() => {
        setReady(false);
        onFailedRef.current?.();
      }}
    />
  );
}

type HeroPhotoGalleryProps = {
  photos: string[];
  /** Per-index CDN→source fallback URLs (same length as photos when present). */
  photoAlternates?: Array<string | null>;
  photoIdx: number;
  onIndexChange: (next: number) => void;
  vehicleTitle: string;
  locked: boolean;
  lockedLabel?: string;
  photoClickable: boolean;
  onPhotoClick?: (index: number) => void;
  className?: string;
  photoPlaceholderLabel?: string;
  pendingPhotoScan?: boolean;
};

function HeroPhotoGallery({
  photos,
  photoAlternates,
  photoIdx,
  onIndexChange,
  vehicleTitle,
  locked,
  lockedLabel,
  photoClickable,
  onPhotoClick,
  className,
  photoPlaceholderLabel,
  pendingPhotoScan = false,
}: HeroPhotoGalleryProps) {
  const { t } = useTranslation();
  const touchX = useRef(0);
  const [urlOverrides, setUrlOverrides] = useState<Record<number, string>>({});
  const effectivePhotos = useMemo(
    () => photos.map((url, i) => urlOverrides[i] ?? url),
    [photos, urlOverrides],
  );
  const currentPhoto = effectivePhotos[photoIdx] ?? effectivePhotos[0] ?? null;
  const showNav = photos.length > 1 && !locked;
  const emptyCompact = photos.length === 0 && !pendingPhotoScan;
  const photoFrameClass = emptyCompact
    ? "aspect-[5/3] max-h-[8.5rem] lg:max-h-none lg:h-full"
    : "aspect-[16/10] max-h-[14.5rem] sm:max-h-[16.5rem] lg:aspect-auto lg:h-full lg:min-h-[20rem] lg:max-h-[22.5rem]";
  const bufferIndices = useMemo(() => {
    const n = photos.length;
    if (n === 0) return [];
    if (n === 1) return [0];
    const prev = (photoIdx - 1 + n) % n;
    const next = (photoIdx + 1) % n;
    return [...new Set([prev, photoIdx, next])];
  }, [photoIdx, photos.length]);
  const photosKey = photos.join("\0") + "\0" + (photoAlternates ?? []).join("\0");
  const [loadedByUrl, setLoadedByUrl] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    photos.forEach((url) => {
      if (isVinImageSessionLoaded(url)) init[url] = true;
    });
    return init;
  });
  const [failedByUrl, setFailedByUrl] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setUrlOverrides({});
    setLoadedByUrl((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const url of photos) {
        if (isVinImageSessionLoaded(url) && !next[url]) {
          next[url] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // Only clear failures when the photo list identity (URLs) actually changes.
    setFailedByUrl({});
  }, [photosKey]); // eslint-disable-line react-hooks/exhaustive-deps -- photosKey tracks URL identity

  useEffect(() => {
    if (locked || effectivePhotos.length === 0) return;
    void warmVinImageNeighbors(effectivePhotos, photoIdx, 1);
  }, [locked, photosKey, photoIdx, effectivePhotos]);

  const markLoadedUrl = useCallback((url: string) => {
    setLoadedByUrl((prev) => (prev[url] ? prev : { ...prev, [url]: true }));
    setFailedByUrl((prev) => {
      if (!prev[url]) return prev;
      const next = { ...prev };
      delete next[url];
      return next;
    });
  }, []);

  const markFailedUrl = useCallback((url: string) => {
    setFailedByUrl((prev) => (prev[url] ? prev : { ...prev, [url]: true }));
  }, []);

  const handlePhotoFailed = useCallback(
    (index: number, url: string) => {
      const alt = photoAlternates?.[index];
      if (
        alt
        && alt !== url
        && urlOverrides[index] !== alt
        && !failedByUrl[alt]
      ) {
        setUrlOverrides((prev) => ({ ...prev, [index]: alt }));
        return;
      }
      markFailedUrl(url);
    },
    [photoAlternates, urlOverrides, failedByUrl, markFailedUrl],
  );

  // Primary (or current) image dead / not mirrored yet → try skip to next working slot.
  useEffect(() => {
    if (effectivePhotos.length === 0) return;
    if (locked) return;
    const current = effectivePhotos[photoIdx];
    if (!current || !failedByUrl[current]) return;
    const next = nextAvailablePhotoIndex(effectivePhotos, photoIdx, failedByUrl, 1);
    if (next != null && next !== photoIdx) onIndexChange(next);
  }, [failedByUrl, photoIdx, effectivePhotos, locked, onIndexChange]);

  const go = useCallback(
    (nextRaw: number) => {
      if (effectivePhotos.length === 0) return;
      // Call sites pass photoIdx±1 (may be -1 or length when wrapping).
      const dir: 1 | -1 = nextRaw >= photoIdx ? 1 : -1;
      const available = nextAvailablePhotoIndex(effectivePhotos, photoIdx, failedByUrl, dir);
      if (available == null || available === photoIdx) return;
      onIndexChange(available);
    },
    [photoIdx, effectivePhotos, onIndexChange, failedByUrl],
  );

  const navBtnClass =
    "absolute top-1/2 -translate-y-1/2 flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-black/55 sm:bg-background/90 backdrop-blur-sm border border-white/25 sm:border shadow-sm text-white sm:text-foreground hover:bg-black/70 sm:hover:bg-background active:scale-95 z-10 print:hidden";

  if (locked) {
    const previewIdx = firstAvailablePhotoIndex(effectivePhotos, failedByUrl, 0);
    const previewSrc = previewIdx != null ? (effectivePhotos[previewIdx] ?? null) : null;
    const previewReady = previewSrc
      ? loadedByUrl[previewSrc] && !failedByUrl[previewSrc]
      : false;

    return (
      <div
        className={cn(
          "relative w-full overflow-hidden bg-[#0a1218] print-vin-hero-photo",
          photoFrameClass,
          className,
        )}
      >
        {previewSrc && !failedByUrl[previewSrc] ? (
          <>
            {!previewReady && (
              <div className="absolute inset-0 z-[1] flex items-center justify-center bg-muted/55 pointer-events-none">
                <div className="h-7 w-7 rounded-full border-2 border-muted-foreground/25 border-t-muted-foreground/70 animate-spin" />
              </div>
            )}
            <HeroPhotoFrame
              src={previewSrc}
              alt={vehicleTitle}
              priority
              isActive
              onLoaded={() => markLoadedUrl(previewSrc)}
              onFailed={() => handlePhotoFailed(previewIdx ?? 0, previewSrc)}
              className="z-[2] blur-[2.5px] scale-[1.02] select-none"
            />
          </>
        ) : (
          <HeroPhotoPlaceholder
            vehicleTitle={vehicleTitle}
            label={photoPlaceholderLabel}
            pendingScan={pendingPhotoScan}
            compact={emptyCompact}
          />
        )}

        {lockedLabel && (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 rounded-full bg-background/95 border border-border/80 shadow-md px-2.5 py-1 print:hidden z-10">
            <Lock className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-semibold text-foreground/80">{lockedLabel}</span>
          </div>
        )}
        <div
          className="absolute inset-x-0 bottom-0 z-[3] pointer-events-none h-14 bg-gradient-to-t from-black/25 via-black/5 to-transparent print:hidden"
          aria-hidden
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-[#0a1218] print-vin-hero-photo group/gallery",
        photoFrameClass,
        photoClickable && "cursor-zoom-in",
        className,
      )}
      onClick={photoClickable ? () => onPhotoClick?.(photoIdx) : undefined}
      onTouchStart={showNav ? (e) => { touchX.current = e.touches[0].clientX; } : undefined}
      onTouchEnd={showNav ? (e) => {
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(photoIdx + (dx < 0 ? 1 : -1));
      } : undefined}
    >
      {currentPhoto && !failedByUrl[currentPhoto] ? (
        <>
          {!loadedByUrl[currentPhoto] && (
            <div className="absolute inset-0 z-[3] flex items-center justify-center bg-muted/55 dark:bg-muted/45 pointer-events-none">
              <div className="h-8 w-8 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground/80 animate-spin" />
            </div>
          )}
          {bufferIndices.map((i) => {
            const url = effectivePhotos[i];
            if (!url || failedByUrl[url]) return null;
            const isActive = i === photoIdx;
            return (
              <HeroPhotoFrame
                key={`${i}-${url}`}
                src={url}
                alt={isActive ? vehicleTitle : ""}
                priority={isActive}
                isActive={isActive}
                onLoaded={() => markLoadedUrl(url)}
                onFailed={() => handlePhotoFailed(i, url)}
                className={cn(
                  isActive ? "z-[2] group-hover/gallery:scale-[1.02] transition-transform duration-300" : "z-[1]",
                )}
              />
            );
          })}
        </>
      ) : (
        <HeroPhotoPlaceholder
          vehicleTitle={vehicleTitle}
          label={photoPlaceholderLabel}
          pendingScan={pendingPhotoScan}
          compact={emptyCompact}
        />
      )}

      {locked && lockedLabel && (
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 rounded-full bg-background/95 border shadow-sm px-2.5 py-1 print:hidden z-10">
          <Lock className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-medium text-muted-foreground">{lockedLabel}</span>
        </div>
      )}

      {photos.length > 0 && (
        <div className="absolute top-2.5 left-2.5 pointer-events-none z-10 print:hidden">
          <div className="rounded-full bg-black/50 backdrop-blur-sm px-2.5 py-1 text-[10px] font-medium text-white/95 tabular-nums">
            {`${photoIdx + 1}/${photos.length}`}
          </div>
        </div>
      )}

      {showNav && (
        <>
          <button
            type="button"
            aria-label={t("vin_hero_prev_photo")}
            className={cn(navBtnClass, "left-2")}
            onClick={(e) => { e.stopPropagation(); go(photoIdx - 1); }}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={t("vin_hero_next_photo")}
            className={cn(navBtnClass, "right-2")}
            onClick={(e) => { e.stopPropagation(); go(photoIdx + 1); }}
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="absolute bottom-2.5 inset-x-0 flex justify-center gap-1.5 pointer-events-none z-10 print:hidden">
            {photos.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`${t("vin_hero_go_to_photo")} ${i + 1}`}
                aria-current={i === photoIdx ? "true" : undefined}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-200 pointer-events-auto",
                  i === photoIdx ? "w-5 bg-white shadow-sm" : "w-1.5 bg-white/50 hover:bg-white/70",
                )}
                onClick={(e) => { e.stopPropagation(); onIndexChange(i); }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function HeroVinChip({ vin }: { vin: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const clean = String(vin || "").toUpperCase();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(clean);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mt-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7dd3fc] print:text-[#0088d4]">
        {t("vin")}
      </p>
      <button
        type="button"
        onClick={() => void copy()}
        className="mt-1.5 inline-flex max-w-full items-center gap-2 rounded-lg border border-white/15 bg-white/[0.07] px-3 py-2 text-left transition-colors hover:bg-white/12 print:border-slate-300 print:bg-slate-50"
        aria-label={`${t("vin")} ${clean}`}
      >
        <span className="truncate font-mono text-[13px] font-semibold tracking-[0.14em] text-white print:text-slate-900 sm:text-sm">
          {clean}
        </span>
        <span className="shrink-0 text-white/50 print:hidden">
          {copied ? <Check className="h-3.5 w-3.5 text-[#7dd3fc]" /> : <Copy className="h-3.5 w-3.5" />}
        </span>
      </button>
    </div>
  );
}

export function VinReportHero({
  vehicleTitle,
  vin,
  country,
  trim,
  photos: photosProp,
  photoAlternates,
  primaryPhoto,
  locked = false,
  lockedLabel,
  unlockedLabel,
  scoreData,
  summaryItems,
  accidentCount = 0,
  onPhotoClick,
  photoPlaceholderLabel,
  pendingPhotoScan = false,
  pendingEta = false,
  showStatsRow = true,
  lockedPanel,
  children,
}: VinReportHeroProps) {
  const { t, language } = useTranslation();
  const photos = (photosProp?.length ? photosProp : primaryPhoto ? [primaryPhoto] : []).filter(Boolean);
  const [photoIdx, setPhotoIdx] = useState(0);
  const photoClickable = !!onPhotoClick && photos.length > 0 && !locked;
  const displayCountry = country
    ? formatCountryName(country, language, countryLabelsFromT(t))
    : null;
  const showDesktopSummary = !!summaryItems?.length;
  const showScoreAccent = !locked && scoreData?.accentBar;
  const isRiskAccent = scoreData?.riskTier === "risk" || (scoreData && parseFloat(scoreData.score) < 6);
  const useLockedPanel = locked && !!lockedPanel;

  return (
    <div
      className={cn(
        "vin-report-hero relative overflow-hidden rounded-2xl border border-[#071018] bg-white",
        "shadow-[0_24px_50px_-32px_rgba(7,16,24,0.55)] print:border-slate-300 print:rounded-none print:shadow-none",
      )}
    >
      {showScoreAccent ? (
        <div
          className={cn(
            "absolute inset-y-0 left-0 z-20 w-[3px]",
            scoreData.accentBar,
            isRiskAccent && "vin-hero-accent-risk",
          )}
          aria-hidden
        />
      ) : null}

      <div className="relative z-[2] bg-[#071018] text-white print:bg-white print:text-foreground">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5 sm:px-6 print:border-slate-200">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-[#7dd3fc] print:text-[#0088d4]">
            VerifyKM
          </p>
          {unlockedLabel && !locked ? (
            <Badge
              variant="outline"
              className="border-[#00a5fd]/35 bg-[#00a5fd]/10 text-[10px] font-semibold text-[#7dd3fc] print:hidden"
            >
              {unlockedLabel}
            </Badge>
          ) : null}
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-stretch">
          <div className="order-2 flex min-w-0 flex-col justify-between px-4 py-5 sm:px-6 sm:py-6 lg:order-1 print:px-3 print:py-3">
            <div>
              <h1 className="text-[1.7rem] font-extrabold leading-[1.12] tracking-tight text-balance sm:text-3xl lg:text-[2.35rem]">
                {vehicleTitle}
              </h1>
              {displayCountry || trim ? (
                <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/60 print:text-muted-foreground">
                  {displayCountry ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      {displayCountry}
                    </span>
                  ) : null}
                  {displayCountry && trim ? <span className="text-white/25 print:text-slate-300">·</span> : null}
                  {trim ? <span className="text-white/75 print:text-slate-700">{trim}</span> : null}
                </p>
              ) : null}
              {!pendingEta ? <HeroVinChip vin={vin} /> : null}
            </div>
            {(scoreData || accidentCount > 0) && (
              <div className={cn("mt-6 grid gap-2.5", scoreData && accidentCount > 0 ? "grid-cols-2" : "grid-cols-1")}>
                {scoreData ? (
                  <div className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-3 print:border-slate-200 print:bg-slate-50">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-white/40 print:text-slate-500">
                      {scoreData.label}
                    </p>
                    <p className="mt-1 text-[1.75rem] font-black tabular-nums leading-none text-white print:text-slate-950">
                      {scoreData.score}
                      <span className="ml-0.5 text-sm font-semibold text-white/35 print:text-slate-400">/10</span>
                    </p>
                  </div>
                ) : null}
                {accidentCount > 0 ? (
                  <div className="rounded-xl border border-orange-300/20 bg-orange-400/10 px-3 py-3 print:border-orange-200 print:bg-orange-50">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-orange-200/70 print:text-orange-700">
                      {t(accidentCount === 1 ? "accident_count_one" : "accidents_count")
                        .replace("{count}", "")
                        .trim()}
                    </p>
                    <p className="mt-1 text-[1.75rem] font-black tabular-nums leading-none text-orange-100 print:text-orange-700">
                      {accidentCount}
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="order-1 border-b border-white/10 lg:order-2 lg:border-b-0 lg:border-l lg:border-white/10 print:border-slate-200">
            <HeroPhotoGallery
              photos={photos}
              photoAlternates={photoAlternates}
              photoIdx={photoIdx}
              onIndexChange={setPhotoIdx}
              vehicleTitle={vehicleTitle}
              locked={locked}
              lockedLabel={lockedLabel}
              photoClickable={photoClickable}
              onPhotoClick={onPhotoClick}
              photoPlaceholderLabel={photoPlaceholderLabel}
              pendingPhotoScan={pendingPhotoScan}
              className="overflow-hidden"
            />
          </div>
        </div>
      </div>

      <div className="relative z-[2] bg-[#f7fbfe] px-4 py-4 sm:px-6 sm:py-5 print:bg-white print:px-3 print:py-2">
        {pendingEta ? (
          <div className="mb-4 max-w-xl">
            <div className="border border-[#00a5fd]/25 bg-[#071018] px-3.5 py-3 text-white">
              <p className="text-sm font-semibold leading-snug sm:text-[15px]">
                {t("pending_report_eta_title")}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-white/60 sm:text-sm">
                {t("pending_report_eta_body")}
              </p>
            </div>
          </div>
        ) : null}
        {showDesktopSummary && !useLockedPanel ? (
          <HeroSummaryList items={summaryItems!} />
        ) : null}
        {useLockedPanel ? lockedPanel : null}
      </div>

      {!useLockedPanel && showStatsRow ? (
        <div
          className={cn(
            "vin-hero-stats flex flex-wrap content-start justify-start gap-2 border-t border-[#00a5fd]/10 bg-white px-4 py-3.5 sm:gap-2.5 sm:px-6",
            "print:flex print:flex-wrap print:justify-start print:gap-1.5 print:bg-white print:px-2 print:py-1.5",
            showDesktopSummary && !locked && "hidden print:flex",
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
