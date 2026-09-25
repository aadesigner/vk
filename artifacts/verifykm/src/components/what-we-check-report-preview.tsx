import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Gauge, Lock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/context";
import { useLightMotion } from "@/hooks/use-light-motion";
import { VerifyKMLogo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { DemoCarPhoto } from "@/components/demo-car-photo";
import { AnimatedMileageKm } from "@/components/vin-mileage-animated";
import type { WhatWeCheckFeature, WhatWeCheckMarket } from "@/lib/what-we-check-features";
import { getWhatWeCheckDemoReport, type WwcDemoFinding } from "@/lib/what-we-check-demo";
import { scoreStylesForDisplay } from "@/lib/vin-condition-score";
import { localizeProviderDate } from "@/lib/korean-provider-text";
import type { Language } from "@/lib/languages";

/** Phones / reduced-motion: never start preview blocks at opacity 0. */
function usePreviewMotionOff() {
  const reduced = useReducedMotion();
  const light = useLightMotion();
  return Boolean(reduced || light);
}

const EASE = [0.22, 1, 0.36, 1] as const;

function formatWwcDemoDate(date: string, language: Language): string {
  if (!date || date === "—") return date;
  const iso = /^\d{4}-\d{2}$/.test(date) ? `${date}-01` : date;
  return localizeProviderDate(iso, language) ?? date;
}

function formatReportGeneratedDate(language: Language): string {
  const now = new Date();
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return localizeProviderDate(iso, language) ?? iso;
}

/** Newest first for timeline tables. Unknown/"—" dates stay at the bottom. */
function sortHistoryNewestFirst<T extends { date: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.date === "—" && b.date === "—") return 0;
    if (a.date === "—") return 1;
    if (b.date === "—") return -1;
    return b.date.localeCompare(a.date);
  });
}

function useDesktopTiltEnabled(reduced: boolean | null) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (reduced) {
      setEnabled(false);
      return;
    }
    const mq = window.matchMedia("(min-width: 1024px) and (pointer: fine)");
    const update = () => setEnabled(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [reduced]);

  return enabled;
}

function ReportTiltShell({
  children,
  reduced,
}: {
  children: React.ReactNode;
  reduced: boolean | null;
}) {
  // Soft hover lift only — 3D rotate/translateZ broke chip hit-testing on desktop.
  const tiltEnabled = useDesktopTiltEnabled(reduced);
  const [hovering, setHovering] = useState(false);

  if (!tiltEnabled) {
    return <div className="relative w-full">{children}</div>;
  }

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div
        className={cn(
          "pointer-events-none absolute -bottom-4 left-[10%] right-[10%] h-5 rounded-[100%] blur-2xl transition-opacity duration-300",
          hovering ? "opacity-100 bg-black/20 dark:bg-black/45" : "opacity-60 bg-black/10 dark:bg-black/30",
        )}
        aria-hidden
      />
      <motion.div
        className="relative will-change-transform"
        animate={{ y: hovering ? -3 : 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
      >
        {children}
      </motion.div>
    </div>
  );
}

const FEATURE_THEME = {
  mileage: {
    icon: Gauge,
    accent: "text-orange-600 dark:text-orange-400",
    bar: "from-orange-500 via-orange-400 to-amber-400",
    ring: "ring-orange-500/35",
    chipActive: "ring-orange-500/40 bg-orange-50/80 dark:bg-orange-950/30",
  },
  accidents: {
    icon: AlertTriangle,
    accent: "text-red-600 dark:text-red-400",
    bar: "from-red-500 via-red-400 to-rose-400",
    ring: "ring-red-500/35",
    chipActive: "ring-red-500/40 bg-red-50/80 dark:bg-red-950/30",
  },
  salvage: {
    icon: ShieldCheck,
    accent: "text-[#0088d4] dark:text-[#00a5fd]",
    bar: "from-blue-500 via-sky-400 to-cyan-400",
    ring: "ring-[#00a5fd]/35",
    chipActive: "ring-[#00a5fd]/40 bg-[#e6f6ff]/80 dark:bg-sky-950/30",
  },
  theft: {
    icon: Lock,
    accent: "text-[#0088d4] dark:text-[#00a5fd]",
    bar: "from-blue-500 via-sky-400 to-cyan-400",
    ring: "ring-[#00a5fd]/35",
    chipActive: "ring-[#00a5fd]/40 bg-[#e6f6ff]/80 dark:bg-sky-950/30",
  },
} as const;

function findingToneClass(tone: WwcDemoFinding["tone"]) {
  if (tone === "negative") {
    return "border-red-200/70 bg-red-50/60 text-red-950 dark:border-red-900/50 dark:bg-red-950/25 dark:text-red-100";
  }
  if (tone === "positive") {
    return "border-[#b3e3fe]/70 bg-[#e6f6ff]/60 text-[#003a5c] dark:border-[#004d7a]/50 dark:bg-sky-950/25 dark:text-sky-100";
  }
  return "border-border/60 bg-muted/30 text-foreground";
}

function ScoreBadge({
  score,
  label,
  textColor,
  bgColor,
  borderColor,
}: {
  score: number;
  label: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
}) {
  return (
    <div
      className={cn(
        "shrink-0 rounded-xl border-2 px-3 py-2 text-center min-w-[4.25rem] shadow-sm",
        bgColor,
        borderColor,
      )}
    >
      <p className={cn("text-xl font-black tabular-nums leading-none", textColor)}>{score.toFixed(1)}</p>
      <p className="text-[9px] font-semibold text-muted-foreground mt-0.5">/10</p>
      <p className={cn("text-[8px] font-bold mt-1 leading-tight line-clamp-2 max-w-[4.5rem] mx-auto", textColor)}>
        {label}
      </p>
    </div>
  );
}

function MileageDemo({ odometer, flaggedLabel }: { odometer: number; flaggedLabel: string }) {
  const reduced = usePreviewMotionOff();
  const chartW = 320;
  const chartH = 118;
  const padX = 18;
  const padY = 16;
  const labelH = 18;
  const viewH = chartH + labelH;
  const minKm = 30_000;
  const maxKm = 150_000;

  const toY = (km: number) =>
    padY + (1 - (km - minKm) / (maxKm - minKm)) * (chartH - padY * 2);

  const readings = [
    { x: padX, km: 42_100, label: "2019" },
    { x: 110, km: 89_200, label: "2021" },
    { x: 185, km: 64_500, label: "2022", rollback: true as const },
    { x: chartW - padX, km: 138_600, label: "2023" },
  ];

  const points = readings.map((r) => ({ ...r, y: toY(r.km) }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1]!.x} ${chartH - padY / 2} L ${points[0]!.x} ${chartH - padY / 2} Z`;
  const fmtKm = (km: number) => `${Math.round(km / 1000)}k`;

  return (
    <div className="rounded-xl border border-border/60 bg-gradient-to-b from-background to-muted/15 p-3 sm:p-3.5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-baseline gap-1.5">
          <AnimatedMileageKm value={odometer} className="text-xl sm:text-2xl font-black tabular-nums text-foreground" />
          <span className="text-[10px] font-semibold text-muted-foreground">km</span>
        </div>
        <motion.span
          className="text-[9px] font-bold text-orange-900 dark:text-orange-100 bg-orange-100 dark:bg-orange-950/50 border border-orange-200/80 dark:border-orange-800/60 rounded-md px-2 py-0.5 leading-snug max-w-[55%] text-right"
          initial={reduced ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.3 }}
        >
          {flaggedLabel}
        </motion.span>
      </div>
      <svg
        viewBox={`0 0 ${chartW} ${viewH}`}
        className="w-full h-auto max-h-[7.25rem] sm:max-h-[8rem] text-foreground"
        style={{ aspectRatio: `${chartW} / ${viewH}` }}
        aria-hidden
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="wwcMileageFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ea580c" stopOpacity="0.22" />
            <stop offset="55%" stopColor="#ea580c" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="wwcMileageStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.45" />
            <stop offset="40%" stopColor="#ea580c" stopOpacity="0.95" />
            <stop offset="70%" stopColor="#ea580c" stopOpacity="0.95" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={padX}
            x2={chartW - padX}
            y1={padY + t * (chartH - padY * 2)}
            y2={padY + t * (chartH - padY * 2)}
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeWidth="1"
          />
        ))}
        <motion.path
          d={areaPath}
          fill="url(#wwcMileageFill)"
          initial={reduced ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: EASE }}
        />
        <motion.path
          d={linePath}
          fill="none"
          stroke="url(#wwcMileageStroke)"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: EASE }}
        />
        {/* Rollback callout segment */}
        <motion.line
          x1={points[1]!.x}
          y1={points[1]!.y}
          x2={points[2]!.x}
          y2={points[2]!.y}
          stroke="#ea580c"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="5 4"
          initial={reduced ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.35 }}
        />
        {points.map((p, i) => (
          <g key={p.label}>
            <motion.circle
              cx={p.x}
              cy={p.y}
              r={p.rollback ? 5.5 : 4.25}
              fill={p.rollback ? "#ea580c" : "hsl(var(--background))"}
              stroke={p.rollback ? "#ea580c" : "currentColor"}
              strokeWidth={p.rollback ? 2 : 1.75}
              strokeOpacity={p.rollback ? 1 : 0.55}
              initial={reduced ? { scale: 1 } : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15 + i * 0.1, type: "spring", stiffness: 380, damping: 22 }}
            />
            {p.rollback ? (
              <circle cx={p.x} cy={p.y} r={2} fill="hsl(var(--background))" />
            ) : (
              <circle cx={p.x} cy={p.y} r={1.75} fill="currentColor" fillOpacity="0.7" />
            )}
            <text
              x={p.x}
              y={p.y - (p.rollback ? 11 : 9)}
              textAnchor="middle"
              fontSize="9"
              fill={p.rollback ? "#c2410c" : "currentColor"}
              fillOpacity={p.rollback ? 1 : 0.55}
              fontWeight="700"
            >
              {fmtKm(p.km)}
            </text>
            <text
              x={p.x}
              y={chartH + 14}
              textAnchor="middle"
              fontSize="9"
              fill="currentColor"
              fillOpacity="0.45"
              fontWeight="600"
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function AccidentDemo({ t }: { t: (k: string) => string }) {
  const reduced = usePreviewMotionOff();

  /** Top-down car silhouette — body, glass, wheels, then panel damage overlays. */
  const bodyPath =
    "M 50 3 C 59 3 68 7 71 16 L 75 28 Q 78 38 78 48 L 79 64 L 78 80 Q 77 94 73 104 L 70 114 C 67 123 59 127 50 127 C 41 127 33 123 30 114 L 27 104 Q 23 94 22 80 L 21 64 L 22 48 Q 22 38 25 28 L 29 16 C 32 7 41 3 50 3 Z";
  const windshieldPath = "M 37 34 L 63 34 L 61 50 L 39 50 Z";
  const rearGlassPath = "M 39 72 L 61 72 L 59 84 L 41 84 Z";
  const wheels: Array<{ x: number; y: number }> = [
    { x: 16, y: 26 },
    { x: 74, y: 26 },
    { x: 16, y: 88 },
    { x: 74, y: 88 },
  ];

  const zones = [
    { id: "front", hot: true, d: "M 35 6 L 65 6 L 62 40 L 38 40 Z" },
    { id: "left", hot: true, d: "M 24 38 L 38 40 L 38 90 L 24 94 Z" },
    { id: "right", hot: true, d: "M 76 38 L 62 40 L 62 90 L 76 94 Z" },
    { id: "rear", hot: false, d: "M 38 96 L 62 96 L 64 118 L 36 118 Z" },
  ];

  return (
    <div className="rounded-xl border border-border/60 bg-gradient-to-b from-background to-muted/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
        {t("wwc_demo_accident_map")}
      </p>
      <svg viewBox="0 0 100 132" className="w-full h-[6.5rem] sm:h-[7rem] text-foreground" aria-hidden preserveAspectRatio="xMidYMid meet">
        {/* Ground shadow */}
        <ellipse cx="50" cy="124" rx="26" ry="3.5" fill="currentColor" fillOpacity="0.07" />

        {/* Wheels */}
        {wheels.map((w) => (
          <rect
            key={`${w.x}-${w.y}`}
            x={w.x}
            y={w.y}
            width="10"
            height="18"
            rx="3"
            fill="currentColor"
            fillOpacity="0.22"
            stroke="currentColor"
            strokeOpacity="0.35"
            strokeWidth="0.75"
          />
        ))}

        {/* Body shell */}
        <path
          d={bodyPath}
          fill="currentColor"
          fillOpacity="0.07"
          stroke="currentColor"
          strokeOpacity="0.22"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />

        {/* Glass */}
        <path d={windshieldPath} fill="#60a5fa" fillOpacity="0.28" stroke="currentColor" strokeOpacity="0.12" strokeWidth="0.5" />
        <path d={rearGlassPath} fill="#60a5fa" fillOpacity="0.2" stroke="currentColor" strokeOpacity="0.1" strokeWidth="0.5" />

        {/* Side mirrors */}
        <ellipse cx="19" cy="54" rx="3.2" ry="2" fill="currentColor" fillOpacity="0.18" />
        <ellipse cx="81" cy="54" rx="3.2" ry="2" fill="currentColor" fillOpacity="0.18" />

        {/* Headlights / taillights */}
        <circle cx="35" cy="12" r="2.2" fill="#fde047" fillOpacity="0.75" />
        <circle cx="65" cy="12" r="2.2" fill="#fde047" fillOpacity="0.75" />
        <circle cx="37" cy="118" r="1.8" fill="#f87171" fillOpacity="0.55" />
        <circle cx="63" cy="118" r="1.8" fill="#f87171" fillOpacity="0.55" />

        {/* Damage panel overlays */}
        {zones.map((z, i) => (
          <motion.g key={z.id}>
            <motion.path
              d={z.d}
              fill={z.hot ? "#ef4444" : "currentColor"}
              fillOpacity={z.hot ? 0.38 : 0.04}
              stroke={z.hot ? "#dc2626" : "currentColor"}
              strokeOpacity={z.hot ? 0.9 : 0.1}
              strokeWidth="1"
              strokeLinejoin="round"
              initial={reduced ? { opacity: 1 } : { opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.07, duration: 0.32, ease: EASE }}
              style={{ transformOrigin: "50px 65px" }}
            />
            {z.hot && !reduced && (
              <motion.path
                d={z.d}
                fill="#ef4444"
                fillOpacity={0.2}
                stroke="none"
                animate={{ fillOpacity: [0.28, 0.1, 0.28] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: i * 0.12 }}
              />
            )}
          </motion.g>
        ))}

        {/* Center axis hint — reads as top-down car direction */}
        <line x1="50" y1="8" x2="50" y2="122" stroke="currentColor" strokeOpacity="0.06" strokeWidth="0.75" strokeDasharray="2 2" />
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
          {t("wwc_demo_event_front")}
        </span>
        <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
          {t("damage_val_side")} ×2
        </span>
        <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
          {t("wwc_demo_event_rear")}
        </span>
      </div>
    </div>
  );
}

function SalvageDemo({ clearLabel, note }: { clearLabel: string; note: string }) {
  return (
    <div className="rounded-xl border border-[#b3e3fe]/70 dark:border-[#004d7a]/45 bg-gradient-to-br from-sky-50/80 via-background to-background dark:from-sky-950/35 dark:via-background dark:to-background p-3.5 flex items-center gap-3 min-h-[4.5rem]">
      <div className="shrink-0 w-10 h-10 rounded-full bg-[#00a5fd]/10 ring-1 ring-[#00a5fd]/25 flex items-center justify-center">
        <CheckCircle2 className="w-5 h-5 text-[#0088d4] dark:text-[#00a5fd]" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-[#003a5c] dark:text-sky-100">{clearLabel}</p>
        <p className="text-[10px] text-[#006aa8]/75 dark:text-[#33bbfd]/70 mt-0.5 leading-snug">{note}</p>
      </div>
    </div>
  );
}

function TheftDemo({ clearLabel, note }: { clearLabel: string; note: string }) {
  return (
    <div className="rounded-xl border border-[#b3e3fe]/70 dark:border-[#004d7a]/45 bg-gradient-to-br from-sky-50/80 via-background to-background dark:from-sky-950/35 dark:via-background dark:to-background p-3.5 flex items-center gap-3 min-h-[4.5rem]">
      <div className="shrink-0 w-10 h-10 rounded-full bg-[#00a5fd]/10 ring-1 ring-[#00a5fd]/25 flex items-center justify-center">
        <CheckCircle2 className="w-5 h-5 text-[#0088d4] dark:text-[#00a5fd]" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-[#003a5c] dark:text-sky-100">{clearLabel}</p>
        <p className="text-[10px] text-[#006aa8]/75 dark:text-[#33bbfd]/70 mt-0.5 leading-snug">{note}</p>
      </div>
    </div>
  );
}

function FeatureDemonstration({
  featureId,
  demo,
  t,
}: {
  featureId: WhatWeCheckFeature["id"];
  demo: ReturnType<typeof getWhatWeCheckDemoReport>;
  t: (k: string) => string;
}) {
  if (featureId === "mileage") {
    return <MileageDemo odometer={demo.odometer} flaggedLabel={t(demo.findings.mileage.valueKey)} />;
  }
  if (featureId === "accidents") {
    return <AccidentDemo t={t} />;
  }
  if (featureId === "salvage") {
    return <SalvageDemo clearLabel={t(demo.findings.salvage.valueKey)} note={t("wwc_demo_salvage_note")} />;
  }
  return <TheftDemo clearLabel={t(demo.findings.theft.valueKey)} note={t("wwc_demo_theft_note")} />;
}

function DocTable({
  columns,
  rows,
}: {
  columns: [string, string];
  rows: Array<{ date: string; primary: string; detail: string }>;
}) {
  const reduced = usePreviewMotionOff();
  return (
    <div className="rounded-lg border border-border/55 overflow-hidden bg-background/60">
      <table className="w-full border-collapse text-[9px] sm:text-[10px]">
        <thead>
          <tr className="border-b border-border/50 bg-muted/30">
            {columns.map((col) => (
              <th key={col} className="py-1.5 px-2.5 text-left text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <motion.tr
              key={`${row.date}-${row.primary}-${i}`}
              className="border-b border-border/25 last:border-0 even:bg-muted/10"
              initial={reduced ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.06 + i * 0.08, duration: 0.3, ease: EASE }}
            >
              <td className="py-2 px-2.5 text-muted-foreground whitespace-nowrap align-top font-medium tabular-nums w-[3.25rem]">
                {row.date}
              </td>
              <td className="py-2 px-2.5 text-foreground align-top leading-snug line-clamp-2">
                <span className="font-semibold">{row.primary || "—"}</span>
                {row.detail ? <span className="text-muted-foreground"> · {row.detail}</span> : null}
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WhatWeCheckReportPreview({
  feature,
  market,
  onSelectFeature,
}: {
  feature: WhatWeCheckFeature;
  market?: WhatWeCheckMarket;
  onSelectFeature?: (id: WhatWeCheckFeature["id"]) => void;
}) {
  const { t, language } = useTranslation();
  const reduced = usePreviewMotionOff();
  const demo = getWhatWeCheckDemoReport(market);
  const theme = FEATURE_THEME[feature.id];
  const scoreNum = parseFloat(demo.score);
  const scoreStyle = scoreStylesForDisplay(scoreNum, t);
  const isRiskAccent = scoreNum < 6;

  const historyTitle =
    feature.id === "mileage"
      ? t("print_summary_mileage_history")
      : feature.id === "accidents"
        ? t("vin_public_accidents_section")
        : feature.id === "salvage"
          ? t("report_salvage")
          : t("report_theft");

  const historyRows =
    feature.id === "mileage"
      ? demo.mileageRows
      : feature.id === "accidents"
        ? demo.accidentRows
        : feature.id === "salvage"
          ? [{ date: "—", primary: t(demo.findings.salvage.valueKey), detailKey: "wwc_demo_salvage_note" }]
          : [{ date: "—", primary: t(demo.findings.theft.valueKey), detailKey: "wwc_demo_theft_note" }];

  const tableRows = sortHistoryNewestFirst(historyRows).slice(0, 2).map((row) => ({
    date: formatWwcDemoDate(row.date, language),
    primary: row.primaryKey ? t(row.primaryKey) : row.primary,
    detail: t(row.detailKey),
  }));

  const tableColumns: [string, string] =
    feature.id === "salvage" || feature.id === "theft"
      ? [t("wwc_demo_col_date"), t("wwc_demo_col_status")]
      : [t("wwc_demo_col_date"), feature.id === "mileage" ? t("mock_label_mileage") : t("wwc_demo_col_event")];

  const generatedDate = formatReportGeneratedDate(language);

  return (
    <motion.div
      className="relative h-full w-full flex flex-col justify-center"
      initial={reduced ? false : { opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <div className="relative mx-auto w-full max-w-[640px] md:max-w-[680px] lg:max-w-none lg:w-full pb-2">
        <ReportTiltShell reduced={reduced}>
        {/* Offset paper sheets — reads as a printed PDF stack */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-3 -bottom-1.5 top-2 rounded-2xl border border-border/40 bg-card/70 dark:bg-card/40 shadow-sm"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-1.5 -bottom-0.5 top-1 rounded-2xl border border-border/50 bg-card/85 dark:bg-card/55"
        />
        <article
          className={cn(
            "relative overflow-hidden rounded-2xl border border-border/70 bg-card",
            "shadow-[0_18px_40px_-24px_rgba(0,0,0,0.35)] dark:shadow-[0_22px_48px_-22px_rgba(0,0,0,0.65)]",
            "ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
            "transition-shadow duration-300 lg:hover:shadow-[0_24px_50px_-22px_rgba(0,0,0,0.4)]",
          )}
        >
          {/* Score accent — fixed for this car, does not change when switching sections */}
          <div
            className={cn(
              "absolute inset-x-0 top-0 z-20 h-[2.5px] bg-gradient-to-r",
              scoreStyle.accentBar,
              isRiskAccent && "vin-hero-accent-risk",
            )}
            aria-hidden
          />
          <div
            className={cn("pointer-events-none absolute inset-x-0 top-0 z-10 h-12 bg-gradient-to-b", scoreStyle.accentGlow)}
            aria-hidden
          />

          <header className="relative z-[1] px-5 sm:px-6 pt-5 pb-4 border-b border-border/55">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <VerifyKMLogo className="h-5 shrink-0" />
                <span className="hidden sm:inline h-3.5 w-px bg-border/70" aria-hidden />
                <span className="hidden sm:inline text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80 truncate">
                  {t("print_summary_title")}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  variant="outline"
                  className="text-[9px] font-bold uppercase tracking-[0.12em] border-[#00a5fd]/30 text-[#0077c2] dark:text-[#00a5fd] bg-[#00a5fd]/[0.07]"
                >
                  {t("what_we_check_sample_badge")}
                </Badge>
                <span className="text-[9px] text-muted-foreground tabular-nums hidden sm:inline">{generatedDate}</span>
              </div>
            </div>

            <div className="grid grid-cols-[7rem_minmax(0,1fr)] sm:grid-cols-[9.5rem_minmax(0,1fr)] gap-4 sm:gap-5 items-start">
              <motion.div
                key={demo.photoUrl}
                className="rounded-xl border border-border/60 overflow-hidden aspect-[4/3] bg-muted/40 shadow-[0_8px_20px_-12px_rgba(0,0,0,0.35)] ring-1 ring-black/[0.03] dark:ring-white/[0.05]"
                initial={reduced ? false : { opacity: 0.7, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: EASE }}
              >
                <DemoCarPhoto src={demo.photoUrl} alt={demo.vehicleTitle} eager />
              </motion.div>

              <div className="min-w-0 flex gap-2.5">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground sm:hidden">
                    {t("print_summary_title")}
                  </p>
                  <h3 className="text-lg sm:text-xl font-extrabold tracking-tight leading-[1.15] line-clamp-1 text-foreground">
                    {demo.vehicleTitle}
                  </h3>
                  <div className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-muted/25 px-2 py-1">
                    <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">VIN</span>
                    <span className="font-mono text-[10px] sm:text-[11px] font-semibold tracking-wide text-foreground tabular-nums">
                      {demo.vin}
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-muted-foreground line-clamp-1">
                    {t(demo.originKey)} · {demo.trim}
                  </p>
                </div>
                <ScoreBadge
                  score={scoreNum}
                  label={scoreStyle.label}
                  textColor={scoreStyle.textColor}
                  bgColor={scoreStyle.bgColor}
                  borderColor={scoreStyle.borderColor}
                />
              </div>
            </div>
          </header>

          <div className="relative z-[2] px-5 sm:px-6 py-3.5 border-b border-border/55 bg-gradient-to-b from-muted/25 to-muted/10">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-2.5">
              {t("print_summary_findings")}
            </p>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3" role="group" aria-label={t("print_summary_findings")}>
              {(Object.keys(demo.findings) as Array<keyof typeof demo.findings>).map((id) => {
                const item = demo.findings[id];
                const Icon = FEATURE_THEME[id].icon;
                const active = feature.id === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelectFeature?.(id)}
                    aria-pressed={active}
                    className={cn(
                      "relative z-[1] rounded-lg border px-2.5 py-2 sm:px-3 sm:py-2.5 flex items-start gap-2 text-left transition-all duration-200",
                      onSelectFeature && "cursor-pointer hover:opacity-90 active:scale-[0.98]",
                      findingToneClass(item.tone),
                      active
                        ? cn("ring-2 ring-offset-1 ring-offset-background shadow-sm opacity-100 scale-[1.02]", FEATURE_THEME[id].chipActive, FEATURE_THEME[id].ring)
                        : cn(
                            "opacity-55 scale-[0.98]",
                            onSelectFeature && "hover:opacity-75 hover:scale-[1]",
                          ),
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", FEATURE_THEME[id].accent)} />
                    <div className="min-w-0">
                      <p className="text-[9px] font-semibold uppercase tracking-wide opacity-75 leading-none truncate">
                        {t(item.labelKey)}
                      </p>
                      <p className="text-[11px] sm:text-xs font-bold mt-0.5 leading-snug line-clamp-2">{t(item.valueKey)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={feature.id}
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="relative px-5 sm:px-6 py-3.5 border-b border-border/55"
            >
              <div className="flex items-center gap-2 mb-2.5">
                <span className={cn("h-3.5 w-0.5 rounded-full shrink-0 bg-gradient-to-b", theme.bar)} />
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-foreground">{historyTitle}</p>
              </div>
              <FeatureDemonstration featureId={feature.id} demo={demo} t={t} />
            </motion.div>
          </AnimatePresence>

          <div className="relative px-5 sm:px-6 py-3.5 bg-gradient-to-b from-transparent to-muted/10">
            <DocTable columns={tableColumns} rows={tableRows} />
          </div>

          <footer className="relative px-5 sm:px-6 py-2.5 border-t border-border/50 bg-muted/15">
            <div className="flex items-center justify-center gap-2">
              <span className="h-px w-6 bg-border/70" aria-hidden />
              <p className="text-[9px] text-muted-foreground text-center leading-snug line-clamp-2 max-w-md">
                {t("what_we_check_disclaimer")}
              </p>
              <span className="h-px w-6 bg-border/70" aria-hidden />
            </div>
          </footer>
        </article>
        </ReportTiltShell>
      </div>
    </motion.div>
  );
}
