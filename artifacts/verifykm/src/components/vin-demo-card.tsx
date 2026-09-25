import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { AlertTriangle, ShieldAlert, Gauge, Fingerprint, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/context";
import { useLightMotion } from "@/hooks/use-light-motion";
import { DemoCarPhoto, preloadDemoCarPhotos } from "@/components/demo-car-photo";
import { FlagImg } from "@/components/flag-img";
import { demoCarIndexForLiveEvent } from "@/lib/demo-live-feed-link";
import { mileageColor } from "@/lib/mileage-color";
import { LANG_META } from "@/lib/languages";
import { localizeProviderDate } from "@/lib/korean-provider-text";
import type { Language } from "@/lib/languages";
import type { ActiveMapLivePing } from "@/lib/coverage-live-events";

import { carsForCountry, type DemoCar } from "@/lib/demo-fleet";

const CONDITION_LABEL_KEYS: Record<DemoCar["condition"], string> = {
  CLEAN: "report_clean",
  CAUTION: "report_caution",
  RISK: "report_risk",
};

const COND = {
  CLEAN: {
    scoreColor:  "text-[#00a5fd] dark:text-[#00a5fd]",
    barColor:    "bg-primary",
    badge:       "bg-primary/10 text-primary border border-primary/20 dark:bg-primary/15 dark:border-primary/25",
    accentBar:   "from-primary via-primary/50 to-transparent",
    lightGlow:   "shadow-[0_8px_40px_rgba(34,197,94,0.12)]",
    darkGlow:    "dark:shadow-[0_8px_40px_rgba(34,197,94,0.22)]",
    okColor:     "text-[#0088d4] dark:text-primary",
  },
  CAUTION: {
    scoreColor:  "text-amber-500 dark:text-amber-400",
    barColor:    "bg-amber-500",
    badge:       "bg-amber-500/10 text-amber-600 border border-amber-400/20 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/25",
    accentBar:   "from-amber-500 via-amber-400/50 to-transparent",
    lightGlow:   "shadow-[0_8px_40px_rgba(245,158,11,0.10)]",
    darkGlow:    "dark:shadow-[0_8px_40px_rgba(251,191,36,0.16)]",
    okColor:     "text-[#0088d4] dark:text-primary",
  },
  RISK: {
    scoreColor:  "text-red-500 dark:text-red-400",
    barColor:    "bg-red-500",
    badge:       "bg-red-500/10 text-red-600 border border-red-400/20 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/25",
    accentBar:   "from-red-500 via-red-400/40 to-transparent",
    lightGlow:   "shadow-[0_8px_40px_rgba(239,68,68,0.10)]",
    darkGlow:    "dark:shadow-[0_8px_40px_rgba(248,113,113,0.18)]",
    okColor:     "text-[#0088d4] dark:text-primary",
  },
};

function milColor(pct: number) {
  return pct > 70 ? "bg-red-500" : pct > 40 ? "bg-amber-500" : "bg-primary";
}
function milTextColor(pct: number) {
  return pct > 70
    ? "text-red-600 dark:text-red-400"
    : pct > 40
    ? "text-amber-600 dark:text-amber-400"
    : "text-[#0088d4] dark:text-primary";
}
function truncVin(vin: string) {
  return `${vin.slice(0, 8)}···${vin.slice(-4)}`;
}

function DemoVinBlurredTail({ vin, className }: { vin: string; className?: string }) {
  const visible = vin.slice(0, -5);
  const masked = vin.slice(-5);
  return (
    <span
      className={cn(
        "inline-flex min-w-0 max-w-full items-center font-mono font-semibold tabular-nums text-foreground/85",
        className,
      )}
    >
      <span className="truncate">{visible}</span>
      <span className="shrink-0 blur-[3px] select-none" aria-hidden>
        {masked}
      </span>
    </span>
  );
}


function demoCardSubtitle(car: DemoCar, t: (key: string) => string): string {
  const originKey =
    car.origin === "Korea"
      ? "demo_card_origin_korea"
      : car.origin === "Germany"
        ? "demo_card_origin_germany"
        : car.origin === "China"
          ? "demo_card_origin_china"
          : car.origin === "Japan"
            ? "demo_card_origin_japan"
            : car.origin === "UAE"
              ? "demo_card_origin_uae"
              : "demo_card_origin_usa";
  return t(originKey);
}

const DEMO_ODO_MAX_KM = 300_000;
const KM_PER_MI = 1.609_34;

function demoMileageToKm(mileage: number, unit: DemoCar["unit"]): number {
  return unit === "mi" ? Math.round(mileage * KM_PER_MI) : mileage;
}

function demoCarVinSeed(vin: string): number {
  let hash = 0;
  for (let i = 0; i < vin.length; i++) {
    hash = (hash * 31 + vin.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Last registration date — 3–12 months before today, stable per VIN. */
function demoLastRecordedDate(car: DemoCar): Date {
  const seed = demoCarVinSeed(car.vin);
  const daysAgo = 90 + (seed % 276);
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date;
}

function formatDemoRecordedDate(date: Date, language: Language): string {
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const localized = localizeProviderDate(iso, language);
  if (localized) return localized;
  return date.toLocaleDateString(LANG_META[language].intl, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function DemoMileageTimeline({ car }: { car: DemoCar }) {
  const { t, language } = useTranslation();
  const recordedDate = useMemo(() => demoLastRecordedDate(car), [car]);
  const latestKm = demoMileageToKm(car.mileage, car.unit);
  const odoCol = mileageColor(latestKm);
  const odoPct = Math.min(100, (latestKm / DEMO_ODO_MAX_KM) * 100);

  return (
    <div className="border-b border-border/60 bg-muted/[0.15] px-3 py-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Gauge className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("demo_odometer")}
          </span>
        </div>
        <span className={cn("text-[11px] font-bold tabular-nums shrink-0", odoCol.text)}>
          {car.mileage.toLocaleString()} {car.unit}
        </span>
      </div>

      <div className="h-1 rounded-full bg-black/[0.06] dark:bg-white/8 overflow-hidden">
        <div
          className={cn("h-full rounded-full", odoCol.bar)}
          style={{ width: `${odoPct}%` }}
        />
      </div>

      <p className="mt-1.5 text-[9px] text-muted-foreground">
        {t("demo_mileage_last_recorded")}{" "}
        <span className="font-medium text-foreground/75 tabular-nums">
          {formatDemoRecordedDate(recordedDate, language)}
        </span>
      </p>
    </div>
  );
}

function demoCarMakeModel(car: DemoCar): { make: string; model: string } {
  const splitAt = car.name.indexOf(" ");
  if (splitAt === -1) return { make: car.name, model: "" };
  return {
    make: car.name.slice(0, splitAt),
    model: car.name.slice(splitAt + 1),
  };
}

const LBL = "text-[12px] font-medium text-muted-foreground dark:text-white/40";
const ICO = "h-3.5 w-3.5 shrink-0 text-muted-foreground/50 dark:text-white/25";

function DemoCardShowcase({
  children,
  accentClass,
  condition,
  wide = false,
  flat = false,
}: {
  children: React.ReactNode;
  accentClass: string;
  condition: DemoCar["condition"];
  wide?: boolean;
  /** Flat mode — minimal tilt, no hover depth (legacy) */
  flat?: boolean;
}) {
  const { dir } = useTranslation();
  const reduceMotion = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const isRtl = dir === "rtl";
  /** Country hero — subtle text-facing tilt without thick edge / heavy shadows */
  const countryFace = wide && flat;
  /** Pivot from inner edge; card faces the hero / text column. */
  const transformOrigin = isRtl ? "100% 50%" : "0% 50%";
  const baseRotateY = countryFace
    ? isRtl ? 9 : -9
    : isRtl ? (wide ? 22 : 14) : wide ? -22 : -14;
  const baseRotateX = countryFace ? 2 : wide ? 6 : 4;
  const depthZ = countryFace ? 0 : wide ? 36 : 18;
  const edgeDepthZ = wide ? -20 : -14;
  const [tilt, setTilt] = useState({ x: baseRotateX, y: baseRotateY });

  const conditionGlow = {
    CLEAN: "from-sky-500/35 via-primary/12",
    CAUTION: "from-amber-500/30 via-amber-500/8",
    RISK: "from-red-500/30 via-red-500/8",
  }[condition];

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const resetTilt = useCallback(() => {
    setTilt({ x: baseRotateX, y: baseRotateY });
  }, [baseRotateX, baseRotateY]);

  useEffect(() => {
    resetTilt();
  }, [resetTilt, isRtl]);

  const onPointerMove = (e: React.PointerEvent) => {
    if (reduceMotion || !isDesktop || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      x: baseRotateX - py * (countryFace ? 1.6 : wide ? 2.8 : 2.2),
      y: baseRotateY + px * (countryFace ? 2.4 : wide ? 4 : 3.2),
    });
  };

  const cardShadow = countryFace
    ? ""
    : flat
    ? "shadow-md shadow-black/8 dark:shadow-black/30"
    : !isDesktop
      ? "shadow-2xl shadow-black/15 dark:shadow-black/40"
      : wide
        ? "shadow-[0_24px_48px_-22px_rgba(0,0,0,0.17)] dark:shadow-[0_28px_52px_-20px_rgba(0,0,0,0.4)]"
        : isRtl
          ? "shadow-[-18px_24px_44px_-18px_rgba(0,0,0,0.32)] dark:shadow-[-20px_28px_50px_-16px_rgba(0,0,0,0.6)]"
          : "shadow-[18px_24px_44px_-18px_rgba(0,0,0,0.32)] dark:shadow-[20px_28px_50px_-16px_rgba(0,0,0,0.6)]";

  const cardTransform = isDesktop && (!flat || countryFace)
    ? depthZ > 0
      ? `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(${depthZ}px)`
      : `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`
    : isDesktop && flat
      ? `rotateY(${isRtl ? 4 : -4}deg) rotateX(1deg)`
      : `rotateY(${isRtl ? 6 : -6}deg) rotateX(2deg)`;

  return (
    <div
      ref={stageRef}
      className={cn(
        "relative w-full min-w-0 mx-auto",
        countryFace ? "" : "lg:mx-0 lg:ms-auto",
        flat
          ? "pt-1 pb-0 w-full max-w-[min(100%,380px)]"
          : cn("py-1 md:py-2 lg:py-3", wide && "pb-6 lg:pb-8"),
        wide && !flat ? "max-w-[min(100%,420px)]" : !flat ? "max-w-[min(100%,320px)]" : "",
      )}
      style={
        flat && !countryFace
          ? undefined
          : {
              perspective: countryFace ? "1400px" : wide ? "1100px" : "1600px",
              perspectiveOrigin: countryFace || wide
                ? isRtl ? "78% 42%" : "22% 42%"
                : isRtl ? "65% 42%" : "35% 42%",
            }
      }
      onPointerMove={flat && !countryFace ? undefined : onPointerMove}
      onPointerLeave={flat && !countryFace ? undefined : resetTilt}
    >
      {!flat && (
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -inset-8 -z-20 rounded-[2rem] blur-3xl",
          "bg-gradient-to-br to-transparent",
          conditionGlow,
          wide ? "opacity-35" : "opacity-50",
        )}
      />
      )}

      {/* Floor reflection */}
      {!flat && (
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute rounded-[100%] blur-2xl -z-10",
          wide ? "bottom-0 h-12 w-[68%] opacity-40" : "-bottom-3 h-14 w-[76%] opacity-60",
          isRtl ? "right-[14%] bg-primary/12" : "left-[14%] bg-primary/12",
        )}
        style={{ transform: "rotateX(78deg) scaleY(0.45)" }}
      />
      )}

      <motion.div
        className="relative w-full [transform-style:preserve-3d]"
        animate={reduceMotion || !isDesktop || (flat && !countryFace) ? undefined : { y: [0, -5, 0] }}
        transition={
          reduceMotion || !isDesktop || (flat && !countryFace)
            ? undefined
            : { duration: 6, repeat: Infinity, ease: "easeInOut" }
        }
      >
        <div
          className={cn(
            "relative w-full [transform-style:preserve-3d]",
            isDesktop && (!flat || countryFace) && "transition-transform duration-300 ease-out",
          )}
          style={{
            transformOrigin,
            transform: cardTransform,
          }}
        >
          {/* Card thickness — outer edge depth (homepage cards only) */}
          {isDesktop && !flat && !countryFace && (
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-3 bottom-3 rounded-sm hidden md:block",
                wide ? "w-3" : "w-2.5 top-4 bottom-4",
                isRtl
                  ? "-left-2.5 bg-gradient-to-l from-black/35 via-black/18 to-black/8 dark:from-black/60 dark:via-black/30 dark:to-black/15"
                  : "-right-2.5 bg-gradient-to-r from-black/35 via-black/18 to-black/8 dark:from-black/60 dark:via-black/30 dark:to-black/15",
              )}
              style={{ transform: `translateZ(${edgeDepthZ}px)` }}
            />
          )}

          {isDesktop && !flat && wide && !countryFace && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl hidden md:block bg-black/[0.06] dark:bg-black/30 border border-black/10 dark:border-white/5"
              style={{ transform: "translateZ(-10px)" }}
            />
          )}

          {!flat && !countryFace && (
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute hidden md:block -z-20 rounded-[100%] blur-xl",
              wide ? "-bottom-4 h-6 w-[72%] opacity-35" : "-bottom-5 h-8 w-[90%]",
              isRtl ? "right-[8%] bg-black/20 dark:bg-black/35" : "left-[8%] bg-black/20 dark:bg-black/35",
            )}
            style={{ transform: "rotateX(82deg) scaleY(0.5)" }}
          />
          )}

          <div
            className={cn(
              "relative rounded-2xl overflow-hidden [transform-style:preserve-3d]",
              countryFace
                ? "border border-border/60 bg-background shadow-none"
                : cn(
                  "border border-white/30 dark:border-white/12",
                  "bg-white dark:bg-[#0d1117]",
                  flat ? cardShadow : cn(cardShadow, !wide && accentClass),
                ),
            )}
          >
            {isDesktop && !flat && (
              <div
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-y-0 w-[2px] hidden md:block z-20",
                  isRtl
                    ? "right-0 bg-gradient-to-l from-white/25 to-transparent"
                    : "left-0 bg-gradient-to-r from-white/30 to-transparent",
                )}
              />
            )}
            {isDesktop && !flat && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 hidden md:block z-10 rounded-2xl"
                style={{
                  background: countryFace
                    ? isRtl
                      ? "linear-gradient(225deg, rgba(255,255,255,0.08) 0%, transparent 40%)"
                      : "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 40%)"
                    : wide
                      ? isRtl
                        ? "linear-gradient(225deg, rgba(255,255,255,0.14) 0%, transparent 32%, transparent 68%, rgba(0,0,0,0.05) 100%)"
                        : "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, transparent 32%, transparent 68%, rgba(0,0,0,0.05) 100%)"
                      : "linear-gradient(135deg, rgba(255,255,255,0.16) 0%, transparent 38%, transparent 62%, rgba(0,0,0,0.04) 100%)",
                }}
              />
            )}
            {children}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function pickFrozenCar(pool: DemoCar[]): DemoCar {
  return pool.find((c) => c.condition === "CLEAN") ?? pool[0]!;
}

export function VinDemoCard({
  country,
  showcase = false,
  frozen = false,
  heroSide = false,
  overlay = false,
  embedded = false,
  livePing,
  countryPage = false,
}: {
  country?: "usa" | "korea" | "canada" | "china" | "japan" | "uae";
  showcase?: boolean;
  /** Single static preview — no carousel, transitions, or dot nav. */
  frozen?: boolean;
  /** Homepage hero flanks — larger layout beside the VIN form. */
  heroSide?: boolean;
  /** Compact card for map overlay on country pages. */
  overlay?: boolean;
  /** Inside a shared panel shell — skip outer card chrome. */
  embedded?: boolean;
  /** When set on overlay cards, syncs carousel to decorative map pings. */
  livePing?: ActiveMapLivePing | null;
  /** Richer showcase layout on country landing pages. */
  countryPage?: boolean;
}) {
  const { t } = useTranslation();
  const lightMotion = useLightMotion();
  // Phones / reduced-motion: behave like frozen — no 5s carousel or Framer remounts.
  const staticPreview = frozen || lightMotion;
  const pool = useMemo(() => carsForCountry(country), [country]);
  const cars = staticPreview ? [pickFrozenCar(pool)] : pool;

  const [idx, setIdx] = useState(0);
  const liveSync = overlay && livePing !== undefined && !staticPreview;

  useEffect(() => {
    setIdx((i) => (cars.length === 0 ? 0 : i % cars.length));
  }, [cars.length]);

  useEffect(() => {
    if (!liveSync || !livePing || cars.length === 0) return;
    setIdx(demoCarIndexForLiveEvent(cars, livePing.eventKey));
  }, [liveSync, livePing, cars]);

  useEffect(() => {
    if (staticPreview || cars.length === 0 || liveSync) return;
    const timer = setInterval(() => setIdx(i => (i + 1) % cars.length), 5000);
    return () => clearInterval(timer);
  }, [cars.length, staticPreview, liveSync]);

  useEffect(() => {
    if (cars.length === 0) return;
    const urls = staticPreview
      ? [cars[0]!.photo]
      : [
          cars[idx]?.photo,
          cars[(idx + 1) % cars.length]?.photo,
        ].filter((u): u is string => Boolean(u));
    preloadDemoCarPhotos(urls);
  }, [cars, staticPreview, idx]);

  const car = cars[idx] ?? cars[0];
  if (!car) return null;
  const displayFlag = country === "canada" && car.origin === "USA" ? "ca" : car.flagImg;
  const subtitle = demoCardSubtitle(car, t);
  const c = COND[car.condition];
  const compact = showcase && !heroSide && !overlay;
  const rowClass = cn(
    compact ? "px-3 py-1.5" : "px-5 py-3",
    "flex items-center justify-between border-b border-black/[0.05] dark:border-white/[0.05] last:border-0",
  );
  const photoHeight = compact
    ? "h-32 sm:h-36 lg:h-40"
    : heroSide
      ? "h-48 lg:h-52"
      : "h-44";

  // US max = 200k mi → red above 140k mi (70%)
  // Korean max = 320k km → red above 224k km (70%)
  const maxMileage = car.unit === "mi" ? 200_000 : 320_000;
  const mileagePct = Math.min(100, Math.round((car.mileage / maxMileage) * 100));

  if (showcase && !heroSide) {
    const slideFlag =
      country === "canada" && car.origin === "USA" ? "ca" : car.flagImg;
    const { make, model } = demoCarMakeModel(car);

    if (overlay) {
      const cardBody = (
        <>
          {livePing && (
            <AnimatePresence mode="wait">
              <motion.div
                key={livePing.pingId}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.28 }}
                className="flex items-center gap-2 border-b border-primary/25 bg-primary/[0.08] px-2.5 py-1.5"
              >
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[9px] font-bold text-foreground">
                    {t(livePing.city.cityLabelKey)} · {t(livePing.eventKey)}
                  </p>
                  <p className="truncate text-[8px] text-muted-foreground">
                    {t("demo_live_preview")}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-primary">
                  {t("live_feed_badge")}
                </span>
              </motion.div>
            </AnimatePresence>
          )}

          <div className={cn("h-0.5 bg-gradient-to-r", c.accentBar)} />

          <div className="relative">
            <div className="relative h-28 overflow-hidden bg-muted/35">
              {cars.map((slideCar, slideIdx) => {
                const isActive = slideIdx === idx;
                const isNext = slideIdx === (idx + 1) % cars.length;
                return (
                  <div
                    key={slideCar.vin}
                    className={cn(
                      "absolute inset-0 transition-opacity duration-500 ease-out",
                      isActive ? "opacity-100 z-[1]" : "opacity-0 z-0 pointer-events-none",
                    )}
                    aria-hidden={!isActive}
                  >
                    <DemoCarPhoto
                      src={slideCar.photo}
                      alt={`${slideCar.year} ${slideCar.name}`}
                      eager={isActive || isNext}
                    />
                  </div>
                );
              })}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-2">
                <div className="inline-flex items-center rounded-full bg-black/45 p-1 backdrop-blur-sm">
                  <FlagImg code={slideFlag} size={16} className="rounded-sm shadow-sm" />
                </div>
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide backdrop-blur-sm",
                  c.badge,
                )}>
                  {t(CONDITION_LABEL_KEYS[car.condition])}
                </span>
              </div>
              <div className="absolute inset-x-0 bottom-0 p-2.5">
                <div className="flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white leading-tight truncate">
                      {car.year} {make}{model ? ` ${model}` : ""}
                    </p>
                    <p className="mt-0.5 text-[9px] text-white/60 truncate">
                      {subtitle}
                    </p>
                  </div>
                  <div className="shrink-0 rounded-md border border-white/15 bg-black/35 px-2 py-1 text-center backdrop-blur-sm">
                    <p className={cn("text-base font-black tabular-nums leading-none", c.scoreColor)}>
                      {car.score.toFixed(1)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <div key={car.vin + "-overlay-stats"}>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 bg-muted/[0.15] px-2.5 py-2">
                  <div className="min-w-0">
                    <p className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("demo_odometer")}
                    </p>
                    <p className={cn("text-[11px] font-bold tabular-nums", milTextColor(mileagePct))}>
                      {car.mileage.toLocaleString()} {car.unit}
                    </p>
                  </div>
                  <div className="min-w-0 text-end">
                    <p className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("mock_label_accidents")}
                    </p>
                    <p className={cn(
                      "text-[11px] font-bold",
                      car.accidents === 0 ? "text-primary" : car.accidents >= 3 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400",
                    )}>
                      {car.accidents === 0 ? t("demo_none_found") : `${car.accidents} ${t("demo_found")}`}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("mock_label_owners")}
                    </p>
                    <p className={cn(
                      "text-[11px] font-bold",
                      car.owners <= 1 ? "text-primary" : car.owners >= 4 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400",
                    )}>
                      {car.owners === 1 ? t("owner_single") : `${car.owners} ${t("mock_label_owners")}`}
                    </p>
                  </div>
                  <div className="min-w-0 text-end">
                    <p className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("mock_label_salvage")}
                    </p>
                    <p className={cn(
                      "text-[11px] font-bold",
                      car.salvage ? "text-red-600 dark:text-red-400" : "text-primary",
                    )}>
                      {car.salvage ? t("demo_flagged") : t("report_clean")}
                    </p>
                  </div>
                </div>
                <div className="border-t border-border/50 px-2.5 py-1.5">
                  <p className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("vin_label")}
                  </p>
                  <div className="mt-0.5">
                    <DemoVinBlurredTail vin={car.vin} className="text-[10px]" />
                  </div>
                </div>
              </div>
            </AnimatePresence>
          </div>
        </>
      );

      if (embedded) {
        return <div className="w-full">{cardBody}</div>;
      }

      return (
        <motion.div
          key={livePing?.pingId ?? "idle"}
          initial={livePing ? { scale: 0.985, opacity: 0.92 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "w-full max-w-[300px] overflow-hidden rounded-2xl bg-background/95 shadow-xl shadow-black/10 backdrop-blur-sm dark:shadow-black/45",
            livePing
              ? "ring-2 ring-primary/45 shadow-primary/10"
              : "ring-1 ring-black/10 dark:ring-white/10",
          )}
        >
          {cardBody}
        </motion.div>
      );
    }

    return (
      <DemoCardShowcase wide flat accentClass="" condition={car.condition}>
        <div className="overflow-hidden rounded-2xl bg-background">
          <div className={cn("h-0.5 bg-gradient-to-r", c.accentBar)} />

          <div className="relative">
            <div className={cn(
              "relative overflow-hidden bg-muted/35",
              countryPage ? "h-40" : "h-36",
            )}>
              {cars.map((slideCar, slideIdx) => {
                const isActive = slideIdx === idx;
                const isNext = slideIdx === (idx + 1) % cars.length;
                return (
                  <div
                    key={slideCar.vin}
                    className={cn(
                      "absolute inset-0 transition-opacity duration-500 ease-out",
                      isActive ? "opacity-100 z-[1]" : "opacity-0 z-0 pointer-events-none",
                    )}
                    aria-hidden={!isActive}
                  >
                    <DemoCarPhoto
                      src={slideCar.photo}
                      alt={`${slideCar.year} ${slideCar.name}`}
                      eager={isActive || isNext}
                    />
                  </div>
                );
              })}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <AnimatePresence mode="wait">
                <div
                  key={car.vin + "-overlay"}
                  className="absolute top-3 left-3 right-3 flex items-center justify-between gap-3"
                >
                  <div className="inline-flex items-center rounded-full bg-black/45 p-1.5 backdrop-blur-sm">
                    <FlagImg code={slideFlag} size={18} className="rounded-sm shadow-sm" />
                  </div>
                  <span className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide backdrop-blur-sm",
                    c.badge,
                  )}>
                    {t(CONDITION_LABEL_KEYS[car.condition])}
                  </span>
                </div>
              </AnimatePresence>
              <AnimatePresence mode="wait">
                <div
                  key={car.vin + "-hero"}
                  className="absolute inset-x-0 bottom-0 p-3"
                >
                  <div className="flex items-end justify-between gap-2.5">
                    <div className="min-w-0">
                      <p className="text-base font-bold text-white leading-tight truncate">
                        {car.year} {make}{model ? ` ${model}` : ""}
                      </p>
                      <p className="mt-0.5 text-[10px] text-white/60 truncate">
                        {subtitle}
                      </p>
                    </div>
                    <div className="shrink-0 rounded-lg border border-white/15 bg-black/35 px-2.5 py-1.5 text-center backdrop-blur-sm">
                      <p className={cn("text-lg font-black tabular-nums leading-none", c.scoreColor)}>
                        {car.score.toFixed(1)}
                      </p>
                      <p className="mt-0.5 text-[8px] font-semibold uppercase tracking-wide text-white/55">
                        {t("demo_trust_score")}
                      </p>
                    </div>
                  </div>
                </div>
              </AnimatePresence>
            </div>

          <AnimatePresence mode="wait">
            <div key={car.vin + "-stats"}>
              {countryPage && (
                <div className="border-b border-border/60 bg-card/30 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("vin_label")}
                    </p>
                    <DemoVinBlurredTail vin={car.vin} className="text-[10px]" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-1 border-b border-border/60 bg-card/30 px-3 py-2">
                <div className="min-w-0 text-center">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{t("year")}</p>
                  <p className="mt-0.5 text-xs font-bold tabular-nums">{car.year}</p>
                </div>
                <div className="min-w-0 text-center border-x border-border/50 px-1">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{t("make")}</p>
                  <p className="mt-0.5 text-xs font-bold truncate" title={make}>{make}</p>
                </div>
                <div className="min-w-0 text-center">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{t("model")}</p>
                  <p className="mt-0.5 text-xs font-bold truncate" title={model || car.name}>{model || car.name}</p>
                </div>
              </div>

              {countryPage ? (
                <DemoMileageTimeline car={car} />
              ) : (
                <div className="border-b border-border/60 bg-muted/[0.15] px-3 py-2">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Gauge className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("demo_odometer")}
                      </span>
                    </div>
                    <span className={cn("text-xs font-bold tabular-nums", milTextColor(mileagePct))}>
                      {car.mileage.toLocaleString()} {car.unit}
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-black/[0.06] dark:bg-white/8 overflow-hidden">
                    <div
                      className={cn("h-1 rounded-full", milColor(mileagePct))}
                      style={{ width: `${mileagePct}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-1.5 p-2.5">
                <div className="rounded-lg border border-border/60 bg-card/80 px-2.5 py-2">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className={cn("h-3.5 w-3.5", car.accidents === 0 ? "text-primary/70" : car.accidents >= 3 ? "text-red-500" : "text-amber-500")} />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("mock_label_accidents")}
                    </span>
                  </div>
                  <p className={cn(
                    "mt-1 text-xs font-bold",
                    car.accidents === 0 ? "text-primary" : car.accidents >= 3 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400",
                  )}>
                    {car.accidents === 0 ? t("demo_none_found") : `${car.accidents} ${t("demo_found")}`}
                  </p>
                </div>

                <div className="rounded-lg border border-border/60 bg-card/80 px-2.5 py-2">
                  <div className="flex items-center gap-1.5">
                    <Users className={cn("h-3.5 w-3.5", car.owners <= 1 ? "text-primary/70" : car.owners >= 4 ? "text-red-500" : "text-amber-500")} />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("mock_label_owners")}
                    </span>
                  </div>
                  <p className={cn(
                    "mt-1 text-xs font-bold",
                    car.owners <= 1 ? "text-primary" : car.owners >= 4 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400",
                  )}>
                    {car.owners === 1 ? t("owner_single") : `${car.owners} ${t("mock_label_owners")}`}
                  </p>
                </div>

                <div className="rounded-lg border border-border/60 bg-card/80 px-2.5 py-2">
                  <div className="flex items-center gap-1.5">
                    <ShieldAlert className={cn("h-3.5 w-3.5", car.salvage ? "text-red-500" : "text-primary/70")} />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("mock_label_salvage")}
                    </span>
                  </div>
                  <p className={cn(
                    "mt-1 text-xs font-bold",
                    car.salvage ? "text-red-600 dark:text-red-400" : "text-primary",
                  )}>
                    {car.salvage ? t("demo_flagged") : t("report_clean")}
                  </p>
                </div>

                <div className="rounded-lg border border-border/60 bg-card/80 px-2.5 py-2">
                  <div className="flex items-center gap-1.5">
                    <Fingerprint className={cn("h-3.5 w-3.5", car.stolen ? "text-red-500" : "text-primary/70")} />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("theft_records")}
                    </span>
                  </div>
                  <p className={cn(
                    "mt-1 text-xs font-bold",
                    car.stolen ? "text-red-600 dark:text-red-400" : "text-primary",
                  )}>
                    {car.stolen ? t("theft_flagged") : t("report_not_stolen")}
                  </p>
                </div>
              </div>
            </div>
          </AnimatePresence>
          </div>
        </div>
      </DemoCardShowcase>
    );
  }

  const card = (
    <div className={cn(
      "w-full min-w-0 rounded-2xl overflow-hidden select-none isolate [transform:translateZ(0)]",
      "border border-black/[0.08] dark:border-white/[0.08]",
      "bg-white dark:bg-[#0d1117]",
      !compact && c.lightGlow,
      !compact && c.darkGlow,
      heroSide && "shadow-xl shadow-black/10 dark:shadow-black/45",
    )}>
      {/* Accent stripe */}
      <div className={cn("h-[3px] bg-gradient-to-r", c.accentBar)} />

      {/* ── Car photo ── */}
      <div className={cn(
        "relative overflow-hidden bg-muted/40 dark:bg-white/[0.03] isolate [transform:translateZ(0)]",
        photoHeight,
      )}>
        {staticPreview ? (
          <div className="absolute inset-0 overflow-hidden [transform:translateZ(0)]">
            <DemoCarPhoto
              src={car.photo}
              alt={`${car.year} ${car.name}`}
              eager
            />
          </div>
        ) : (
          <div className="absolute inset-0 overflow-hidden [transform:translateZ(0)]">
            {cars.map((slideCar, slideIdx) => {
              const isActive = slideIdx === idx;
              const isNext = slideIdx === (idx + 1) % cars.length;
              return (
                <div
                  key={slideCar.vin}
                  className={cn(
                    "absolute inset-0 overflow-hidden transition-opacity duration-500 ease-out",
                    isActive ? "opacity-100 z-[1]" : "opacity-0 z-0 pointer-events-none",
                  )}
                  aria-hidden={!isActive}
                >
                  <div
                    className={cn(
                      "h-full w-full transition-transform duration-[5000ms] ease-linear",
                      isActive ? "scale-[1.06]" : "scale-100",
                    )}
                  >
                    <DemoCarPhoto
                      src={slideCar.photo}
                      alt={`${slideCar.year} ${slideCar.name}`}
                      eager={isActive || isNext}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Subtle scan shimmer */}
        {!compact && !staticPreview && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.12] dark:opacity-[0.08] bg-[linear-gradient(180deg,transparent_0%,rgba(255,255,255,0.35)_48%,transparent_100%)] bg-[length:100%_220%] animate-[demo-scan_4.5s_ease-in-out_infinite]"
        />
        )}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(255,255,255,0.18),transparent_55%)]"
        />

        {/* Bottom gradient fade into card */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white dark:from-[#0d1117] to-transparent" />

        {/* Top overlay: VIN + badge */}
        <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/40 to-transparent" />
        {staticPreview ? (
          <div className="absolute top-3 left-4 right-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FlagImg code={displayFlag} size={20} className="rounded-sm shadow-sm" />
              <span className="font-mono text-[10px] text-white/80 tracking-widest drop-shadow">
                {truncVin(car.vin)}
              </span>
            </div>
            <span className={cn(
              "rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide backdrop-blur-sm",
              c.badge,
            )}>
              {t(CONDITION_LABEL_KEYS[car.condition])}
            </span>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={car.vin + "-overlay"}
              className="absolute top-3 left-4 right-4 flex items-center justify-between"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="flex items-center gap-2">
                <FlagImg code={displayFlag} size={20} className="rounded-sm shadow-sm" />
                <span className="font-mono text-[10px] text-white/80 tracking-widest drop-shadow">
                  {truncVin(car.vin)}
                </span>
              </div>
              <span className={cn(
                "rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide backdrop-blur-sm",
                c.badge,
              )}>
                {t(CONDITION_LABEL_KEYS[car.condition])}
              </span>
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* ── Car info + score ── */}
      <div className={cn(compact ? "px-3 pt-1 pb-2" : "px-5 pt-1 pb-4")}>
        {staticPreview ? (
          <div>
            <p className={cn(
              "text-foreground dark:text-white font-bold leading-tight",
              compact ? "text-[15px]" : heroSide ? "text-lg" : "text-[17px]",
            )}>
              {car.year} {car.name}
            </p>
            <p className="text-muted-foreground/50 dark:text-white/25 text-[10px] font-mono tracking-wide mt-0.5">
              {subtitle}
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={car.vin + "-info"}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <p className={cn(
                "text-foreground dark:text-white font-bold leading-tight",
                compact ? "text-[15px]" : "text-[17px]",
              )}>
                {car.year} {car.name}
              </p>
              <p className="text-muted-foreground/50 dark:text-white/25 text-[10px] font-mono tracking-wide mt-0.5">
                {subtitle}
              </p>
            </motion.div>
          </AnimatePresence>
        )}

        <div className="mt-4">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60 dark:text-white/35">
              {t("demo_trust_score")}
            </span>
            {staticPreview ? (
              <span className={cn("font-black tabular-nums", heroSide ? "text-3xl" : compact ? "text-[1.35rem]" : "text-3xl", c.scoreColor)}>
                {car.score.toFixed(1)}
                <span className="text-sm font-semibold text-muted-foreground/40 dark:text-white/25"> /10</span>
              </span>
            ) : (
              <AnimatePresence mode="wait">
                <motion.span
                  key={car.vin + "-score"}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className={cn("font-black tabular-nums", compact ? "text-[1.35rem]" : "text-3xl", c.scoreColor)}
                >
                  {car.score.toFixed(1)}
                  <span className="text-sm font-semibold text-muted-foreground/40 dark:text-white/25"> /10</span>
                </motion.span>
              </AnimatePresence>
            )}
          </div>
          <div className="h-2 rounded-full bg-black/[0.06] dark:bg-white/8 overflow-hidden">
            {staticPreview ? (
              <div
                className={cn("h-2 rounded-full", c.barColor)}
                style={{ width: `${car.score * 10}%` }}
              />
            ) : (
              <motion.div
                key={car.vin + "-bar"}
                className={cn("h-2 rounded-full relative overflow-hidden", c.barColor)}
                initial={{ width: "0%" }}
                animate={{ width: `${car.score * 10}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              >
                <motion.div
                  aria-hidden
                  className="absolute inset-y-0 w-10 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                  animate={{ left: ["-20%", "120%"] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.2 }}
                />
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* ── Data rows ── */}
      <div className="border-t border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.025]">
        {staticPreview ? (
          <div>
            <div className={cn(rowClass, "flex-col items-stretch gap-2")}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gauge className={ICO} />
                  <span className={LBL}>{t("demo_odometer")}</span>
                </div>
                <span className={cn("text-[12px] font-semibold tabular-nums", milTextColor(mileagePct))}>
                  {car.mileage.toLocaleString()} {car.unit}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-black/[0.06] dark:bg-white/8 overflow-hidden">
                <div
                  className={cn("h-1.5 rounded-full", milColor(mileagePct))}
                  style={{ width: `${mileagePct}%` }}
                />
              </div>
            </div>

            <div className={rowClass}>
              <div className="flex items-center gap-2">
                <AlertTriangle className={cn(ICO, car.accidents > 0 && "text-amber-500 dark:text-amber-400/60")} />
                <span className={LBL}>{t("mock_label_accidents")}</span>
              </div>
              <span className={cn("text-[12px] font-semibold",
                car.accidents === 0 ? c.okColor : car.accidents >= 3 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
              )}>
                {car.accidents === 0 ? t("demo_none_found") : `${car.accidents} ${t("demo_found")}`}
              </span>
            </div>

            <div className={rowClass}>
              <div className="flex items-center gap-2">
                <ShieldAlert className={cn(ICO, car.salvage && "text-red-500 dark:text-red-400/60")} />
                <span className={LBL}>{t("mock_label_salvage")}</span>
              </div>
              <span className={cn("text-[12px] font-semibold",
                car.salvage ? "text-red-600 dark:text-red-400" : c.okColor
              )}>
                {car.salvage ? t("demo_flagged") : t("report_clean")}
              </span>
            </div>

            {!compact && (
            <div className={rowClass}>
              <div className="flex items-center gap-2">
                <Users className={cn(ICO, car.owners > 2 && "text-amber-500 dark:text-amber-400/60")} />
                <span className={LBL}>{t("mock_label_owners")}</span>
              </div>
              <span className={cn(
                "text-[12px] font-semibold",
                car.owners <= 1 ? c.okColor : car.owners >= 4 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400",
              )}>
                {car.owners === 1
                  ? t("owner_single")
                  : `${car.owners} ${t("mock_label_owners")}`}
              </span>
            </div>
            )}
          </div>
        ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={car.vin + "-rows"}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className={cn(rowClass, "flex-col items-stretch gap-2")}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gauge className={ICO} />
                  <span className={LBL}>{t("demo_odometer")}</span>
                </div>
                <span className={cn("text-[12px] font-semibold tabular-nums", milTextColor(mileagePct))}>
                  {car.mileage.toLocaleString()} {car.unit}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-black/[0.06] dark:bg-white/8 overflow-hidden">
                <motion.div
                  key={car.vin + "-mil"}
                  className={cn("h-1.5 rounded-full", milColor(mileagePct))}
                  initial={{ width: "0%" }}
                  animate={{ width: `${mileagePct}%` }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                />
              </div>
            </div>

            <div className={rowClass}>
              <div className="flex items-center gap-2">
                <AlertTriangle className={cn(ICO, car.accidents > 0 && "text-amber-500 dark:text-amber-400/60")} />
                <span className={LBL}>{t("mock_label_accidents")}</span>
              </div>
              <span className={cn("text-[12px] font-semibold",
                car.accidents === 0 ? c.okColor : car.accidents >= 3 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
              )}>
                {car.accidents === 0 ? t("demo_none_found") : `${car.accidents} ${t("demo_found")}`}
              </span>
            </div>

            <div className={rowClass}>
              <div className="flex items-center gap-2">
                <ShieldAlert className={cn(ICO, car.salvage && "text-red-500 dark:text-red-400/60")} />
                <span className={LBL}>{t("mock_label_salvage")}</span>
              </div>
              <span className={cn("text-[12px] font-semibold",
                car.salvage ? "text-red-600 dark:text-red-400" : c.okColor
              )}>
                {car.salvage ? t("demo_flagged") : t("report_clean")}
              </span>
            </div>

            {!compact && (
            <div className={rowClass}>
              <div className="flex items-center gap-2">
                <Users className={cn(ICO, car.owners > 2 && "text-amber-500 dark:text-amber-400/60")} />
                <span className={LBL}>{t("mock_label_owners")}</span>
              </div>
              <span className={cn(
                "text-[12px] font-semibold",
                car.owners <= 1 ? c.okColor : car.owners >= 4 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400",
              )}>
                {car.owners === 1
                  ? t("owner_single")
                  : `${car.owners} ${t("mock_label_owners")}`}
              </span>
            </div>
            )}

            {!compact && (
            <div className={rowClass}>
              <div className="flex items-center gap-2">
                <Fingerprint className={ICO} />
                <span className={LBL}>{t("theft_records")}</span>
              </div>
              <span className={cn("text-[12px] font-semibold",
                car.stolen ? "text-red-600 dark:text-red-400" : c.okColor
              )}>
                {car.stolen ? t("stolen") : t("not_stolen")}
              </span>
            </div>
            )}
          </motion.div>
        </AnimatePresence>
        )}
      </div>

      {/* ── Dot nav ── */}
      {!staticPreview && (
      <div className={cn(
        "bg-black/[0.02] dark:bg-white/[0.02] border-t border-black/[0.05] dark:border-white/[0.05] flex items-center justify-between gap-3",
        compact ? "px-3 py-1.5" : "px-5 py-3",
      )}>
        <span className="text-[10px] font-medium text-muted-foreground/70 dark:text-white/30 tabular-nums">
          {idx + 1}<span className="opacity-40 mx-0.5">/</span>{cars.length}
        </span>
        <div className="flex gap-1.5 items-center">
          {cars.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1} / ${cars.length}`}
              aria-current={i === idx ? "true" : undefined}
              onClick={() => setIdx(i)}
              className={cn(
                "rounded-full transition-all duration-500",
                i === idx
                  ? "w-5 h-1.5 bg-primary shadow-[0_0_10px_rgba(34,197,94,0.45)]"
                  : "w-1.5 h-1.5 bg-black/15 dark:bg-white/15 hover:bg-black/30 dark:hover:bg-white/30",
              )}
            />
          ))}
        </div>
      </div>
      )}
    </div>
  );

  if (heroSide) {
    return (
      <div className="w-full max-w-[min(100%,360px)]" aria-hidden>
        {card}
      </div>
    );
  }

  return card;
}
