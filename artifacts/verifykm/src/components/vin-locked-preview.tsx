import type { ElementType } from "react";
import {
  Lock,
  Gauge,
  AlertTriangle,
  ShieldCheck,
  Users,
  TrendingUp,
  FileText,
  Shield,
  Sparkles,
  ChevronRight,
  Droplets,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { VinReportSection, ACCENT_HEADER_WASH, type VinReportSectionAccent } from "@/components/vin-report-section";
import { ReportReveal } from "@/components/report-reveal";

/** Blurred placeholder body shown inside locked report sections. */
export function VinLockedSectionBody({
  hint,
  variant = "rows",
}: {
  hint: string;
  variant?: "rows" | "stats" | "timeline";
}) {
  return (
    <div className="relative min-h-[112px] overflow-hidden">
      <div className="px-5 py-4 sm:px-6 sm:py-5">
        <div className="select-none pointer-events-none blur-[3.5px] opacity-80" aria-hidden>
          {variant === "stats" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border bg-muted/40 p-3 space-y-2">
                <div className="h-2 w-14 rounded-full bg-muted-foreground/25" />
                <div className="h-5 w-20 rounded-md bg-muted-foreground/20" />
              </div>
              <div className="rounded-xl border bg-muted/40 p-3 space-y-2">
                <div className="h-2 w-16 rounded-full bg-muted-foreground/25" />
                <div className="h-5 w-16 rounded-md bg-muted-foreground/20" />
              </div>
              <div className="col-span-2 rounded-xl border bg-muted/30 p-3 space-y-2">
                <div className="h-2 w-24 rounded-full bg-muted-foreground/20" />
                <div className="h-2 w-full rounded-full bg-muted-foreground/15" />
                <div className="h-2 w-2/3 rounded-full bg-muted-foreground/15" />
              </div>
            </div>
          ) : variant === "timeline" ? (
            <LockedTimelineSketch className="h-28 w-full" />
          ) : (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="mt-1 h-2.5 w-2.5 rounded-full bg-muted-foreground/30 shrink-0" />
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="h-2.5 rounded-full bg-muted-foreground/25" style={{ width: `${55 - i * 8}%` }} />
                      <div className="h-2 w-12 rounded-full bg-muted-foreground/20 shrink-0" />
                    </div>
                    <div className="h-2 rounded-full bg-muted-foreground/15" style={{ width: `${78 - i * 12}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-4 bg-gradient-to-b from-background/25 via-background/70 to-background/90"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, transparent, transparent 8px, rgba(0,0,0,0.03) 8px, rgba(0,0,0,0.03) 10px)",
        }}
      >
        <div className="flex max-w-[92%] items-center gap-2.5 rounded-md border border-[#00a5fd]/25 bg-[#071018] px-3.5 py-2.5 text-white shadow-md">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#00a5fd] text-white">
            <Lock className="h-3.5 w-3.5" />
          </div>
          <p className="text-xs font-semibold leading-snug text-white/90">{hint}</p>
        </div>
      </div>
    </div>
  );
}

/** Decorative mileage curve used under blur on locked pages (no real VIN data). */
function LockedTimelineSketch({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 120" className={cn("overflow-visible", className)} aria-hidden preserveAspectRatio="none">
      <defs>
        <linearGradient id="locked-tl-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.22" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[30, 60, 90].map((y) => (
        <line key={y} x1="8" x2="392" y1={y} y2={y} className="stroke-border/70" strokeWidth="1" strokeDasharray="4 6" />
      ))}
      <path
        d="M 12 98 C 70 92, 90 70, 130 62 S 190 55, 220 48 S 280 40, 310 28 S 360 22, 388 18"
        fill="none"
        className="stroke-primary"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M 12 98 C 70 92, 90 70, 130 62 S 190 55, 220 48 S 280 40, 310 28 S 360 22, 388 18 L 388 110 L 12 110 Z"
        fill="url(#locked-tl-fill)"
      />
      {[
        { x: 12, y: 98, c: "fill-slate-400" },
        { x: 130, y: 62, c: "fill-red-500" },
        { x: 220, y: 48, c: "fill-amber-500" },
        { x: 310, y: 28, c: "fill-sky-500" },
        { x: 388, y: 18, c: "fill-primary" },
      ].map((p) => (
        <circle key={p.x} cx={p.x} cy={p.y} r="4.5" className={cn(p.c, "stroke-background")} strokeWidth="2" />
      ))}
    </svg>
  );
}

function sectionToneFromChip(accent: string): VinReportSectionAccent {
  if (/\borange\b/.test(accent)) return "orange";
  if (/\bemerald\b|\bteal\b/.test(accent)) return "sky";
  if (/\bsky\b/.test(accent)) return "sky";
  if (/\bviolet\b|\bpurple\b/.test(accent)) return "purple";
  if (/\brose\b|\bred\b/.test(accent)) return "rose";
  if (/\bamber\b/.test(accent)) return "amber";
  if (/\bslate\b/.test(accent)) return "slate";
  return "primary";
}

/** Highlight the numeric count inside a localized "{count} found" label. */
function FoundCountLabel({
  count,
  label,
  className,
}: {
  count: number;
  label?: string;
  className?: string;
}) {
  const text = label ?? String(count);
  const token = String(count);
  const idx = text.indexOf(token);
  if (idx < 0) {
    return <span className={className}>{text}</span>;
  }
  return (
    <span className={className}>
      {text.slice(0, idx)}
      <span className="text-primary font-extrabold tabular-nums">{token}</span>
      {text.slice(idx + token.length)}
    </span>
  );
}

/** Compact primary pill for section headers — number pops, rest stays quiet. */
function FoundCountBadge({
  count,
  label,
}: {
  count: number;
  label?: string;
}) {
  const text = label ?? String(count);
  const token = String(count);
  const idx = text.indexOf(token);
  const prefix = idx > 0 ? text.slice(0, idx).trim() : "";
  const suffix = idx >= 0 ? text.slice(idx + token.length).trim() : text;

  return (
    <span
      className="ml-auto shrink-0 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-gradient-to-r from-primary/15 to-primary/5 pl-1 pr-2.5 py-0.5 shadow-[inset_0_1px_0_0_hsl(var(--primary)/0.12)]"
      title={text}
    >
      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-extrabold tabular-nums leading-none text-primary-foreground shadow-sm shadow-primary/30">
        {count}
      </span>
      {(prefix || suffix) && (
        <span className="text-[10px] font-semibold tracking-wide text-primary/80">
          {prefix ? `${prefix} ${suffix}`.trim() : suffix}
        </span>
      )}
    </span>
  );
}

type LockedSectionCardProps = {
  title: string;
  icon?: ElementType;
  delay?: number;
  hint: string;
  variant?: "rows" | "stats" | "timeline";
  accent?: string;
  className?: string;
  /** Safe count badge — never use for accidents. */
  foundCount?: number | null;
  foundLabel?: string;
};

export function VinLockedSectionCard({
  title,
  icon: Icon,
  delay = 0,
  hint,
  variant = "rows",
  accent = "bg-muted text-muted-foreground",
  className,
  foundCount,
  foundLabel,
}: LockedSectionCardProps) {
  const tone = sectionToneFromChip(accent);
  const showFound = foundCount != null && foundCount > 0;
  return (
    <ReportReveal delay={delay} y={14} className={className}>
      <VinReportSection accent={tone}>
        <div
          className={cn(
            "px-5 py-3.5 sm:px-6 sm:py-4 border-b border-border/60 flex items-center gap-2.5",
            ACCENT_HEADER_WASH[tone],
          )}
        >
          {Icon && (
            <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center shrink-0", accent)}>
              <Icon className="h-3.5 w-3.5" />
            </div>
          )}
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground min-w-0 truncate">{title}</h2>
          {showFound ? (
            <FoundCountBadge count={foundCount} label={foundLabel} />
          ) : (
            <Lock className="h-3 w-3 text-muted-foreground/50 ml-auto shrink-0" />
          )}
        </div>
        <VinLockedSectionBody hint={hint} variant={variant} />
      </VinReportSection>
    </ReportReveal>
  );
}

export function VinLockedHeroStat({
  label,
  foundCount,
  foundLabel,
}: {
  label: string;
  foundCount?: number | null;
  foundLabel?: string;
}) {
  const showFound = foundCount != null && foundCount > 0;
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-muted/80 border border-border/60 px-2.5 py-1 w-full justify-center">
      {showFound ? (
        <FoundCountLabel
          count={foundCount}
          label={foundLabel}
          className="text-[10px] font-bold text-muted-foreground shrink-0"
        />
      ) : (
        <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
      )}
      <span className="text-[10px] font-medium text-muted-foreground truncate">{label}</span>
    </div>
  );
}

type FindingRow = {
  key: string;
  count: number;
  label: string;
  icon: ElementType;
};

/**
 * Locked findings — same visual language as HeroSummaryList (quiet rows under title).
 * No nested card chrome; lives in the hero details column.
 */
export function VinLockedFindingsSummary({
  signals,
  t,
  className,
  /** When true, registryHistory rows are GetCarAPI Events (not Korean registry). */
  eventsMode = false,
}: {
  vin?: string;
  signals: {
    mileageRecordCount: number;
    ownerCount: number;
    insuranceClaimCount: number;
    auctionRecordCount: number;
    registryRecordCount: number;
    floodRecordCount: number;
  };
  t: (key: string) => string;
  className?: string;
  eventsMode?: boolean;
}) {
  const rows: FindingRow[] = [
    signals.mileageRecordCount > 0 && {
      key: "mileage",
      count: signals.mileageRecordCount,
      label: t("vin_public_mileage_section"),
      icon: Gauge,
    },
    signals.ownerCount > 0 && {
      key: "owners",
      count: signals.ownerCount,
      label: t("vin_result_owners_title"),
      icon: Users,
    },
    signals.insuranceClaimCount > 0 && {
      key: "insurance",
      count: signals.insuranceClaimCount,
      label: t("report_insurance_claims"),
      icon: FileText,
    },
    signals.floodRecordCount > 0 && {
      key: "flood",
      count: signals.floodRecordCount,
      label: t("report_flood_section"),
      icon: Droplets,
    },
    signals.auctionRecordCount > 0 && {
      key: "auctions",
      count: signals.auctionRecordCount,
      label: t("auction_history"),
      icon: TrendingUp,
    },
    signals.registryRecordCount > 0 && {
      key: "registry",
      count: signals.registryRecordCount,
      label: t(eventsMode ? "report_events_history" : "report_registry_history"),
      icon: Shield,
    },
  ].filter(Boolean) as FindingRow[];

  if (rows.length === 0) return null;

  return (
    <div className={cn("pt-3 space-y-2.5 print:hidden", className)}>
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/75">
          {t("vin_public_preview_eyebrow")}
        </p>
        <span className="h-px flex-1 bg-border/60" aria-hidden />
      </div>

      <ul className="flex flex-col gap-2">
        {rows.map(({ key, count, label, icon: Icon }) => (
          <li
            key={key}
            className="flex items-center gap-2.5 text-sm font-medium text-foreground"
          >
            <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="leading-snug min-w-0 truncate flex-1">{label}</span>
            <FoundCountLabel
              count={count}
              label={t("vin_public_found_count").replace("{count}", String(count))}
              className="shrink-0 text-[11px] font-semibold text-muted-foreground"
            />
          </li>
        ))}
      </ul>

      <p className="text-[11px] leading-relaxed text-muted-foreground/90 pt-0.5">
        {t("vin_public_preview_unlock_hint")}
      </p>
    </div>
  );
}

type VinLockedTimelinePreviewProps = {
  t: (key: string) => string;
  priceLabel?: string | null;
  onUnlock?: () => void;
};

/** Full-width locked history graph teaser (decorative, no real report data). */
export function VinLockedTimelinePreview({ t, priceLabel, onUnlock }: VinLockedTimelinePreviewProps) {
  return (
    <ReportReveal delay={0.08} y={12} className="print:hidden">
      <VinReportSection>
      <div className="flex items-center justify-between gap-3 px-3 pt-3 sm:px-5 sm:pt-4">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          {t("report_timeline_title")}
        </h2>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/50 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
          <Lock className="h-3 w-3" />
          {t("vin_public_timeline_locked")}
        </div>
      </div>

      <div className="relative mt-1 px-2 pb-3 sm:px-3">
        <div className="select-none pointer-events-none blur-[4px] opacity-75 scale-[1.01]" aria-hidden>
          <LockedTimelineSketch className="h-[11.5rem] w-full sm:h-[14rem]" />
          <div className="mt-1 flex justify-between px-6 text-[10px] tabular-nums text-muted-foreground">
            <span>’18</span>
            <span>’20</span>
            <span>’22</span>
            <span>’24</span>
            <span>’26</span>
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-border/60 px-2 pt-2.5">
            {[
              t("report_timeline_accident"),
              t("report_timeline_insurance"),
              t("report_timeline_auction"),
              t("report_timeline_owner"),
            ].map((label) => (
              <li key={label} className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-background/20 via-background/65 to-background/90 px-4">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center shadow-sm">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <div className="text-center max-w-sm">
            <p className="text-sm font-semibold text-foreground">{t("vin_public_timeline_locked_title")}</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {t("vin_public_timeline_locked_desc")}
            </p>
          </div>
          {onUnlock ? (
            <Button
              type="button"
              size="sm"
              className="font-bold rounded-full h-9 px-5 text-xs shadow-md shadow-primary/20 gap-1"
              onClick={onUnlock}
            >
              {priceLabel
                ? `${t("vin_public_check_cta")} — ${priceLabel}`
                : t("vin_public_check_cta")}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>
      </VinReportSection>
    </ReportReveal>
  );
}

type TeaserCard = {
  icon: ElementType;
  title: string;
  sample: string;
  color: string;
  bg: string;
  border: string;
};

type VinLockedTeaserPanelProps = {
  t: (key: string) => string;
  priceLabel: string | null;
  onUnlock: () => void;
  /** When false, hide Korean-registry teaser (non-KR vehicles). Default true for backward compat. */
  showKoreanRegistry?: boolean;
};

export function VinLockedTeaserPanel({
  t,
  priceLabel,
  onUnlock,
  showKoreanRegistry = true,
}: VinLockedTeaserPanelProps) {
  const cards: TeaserCard[] = [
    {
      icon: AlertTriangle,
      title: t("vin_public_accidents_section"),
      sample: t("free_decoder_teaser_accidents_sample"),
      color: "text-orange-500",
      bg: "bg-orange-500/10",
      border: "border-orange-200/80 dark:border-orange-900/40",
    },
    {
      icon: Gauge,
      title: t("vin_public_mileage_section"),
      sample: t("free_decoder_teaser_mileage_sample"),
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-blue-200/80 dark:border-blue-900/40",
    },
    {
      icon: ShieldCheck,
      title: t("vin_public_safety_section"),
      sample: t("free_decoder_teaser_salvage_sample"),
      color: "text-[#00a5fd]",
      bg: "bg-[#00a5fd]/10",
      border: "border-[#b3e3fe]/80 dark:border-[#004d7a]/40",
    },
    {
      icon: Users,
      title: t("vin_result_owners_title"),
      sample: t("vin_public_owners_label"),
      color: "text-violet-500",
      bg: "bg-violet-500/10",
      border: "border-violet-200/80 dark:border-violet-900/40",
    },
  ];

  const extraSections = [
    { icon: FileText, label: t("report_insurance_claims") },
    ...(showKoreanRegistry
      ? [{ icon: Shield, label: t("report_registry_history") }]
      : []),
    { icon: TrendingUp, label: t("report_market_data") },
  ];

  return (
    <div className="space-y-6 print:hidden">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border bg-muted/50 text-sm font-semibold text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
          {t("free_decoder_locked_section")}
        </div>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map(({ icon: Icon, title, sample, color, bg, border }) => (
          <VinReportSection
            key={title}
            className={cn(border)}
          >
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", bg)}>
                  <Icon className={cn("h-4 w-4", color)} />
                </div>
                <p className="font-semibold text-sm">{title}</p>
              </div>
              <div className="select-none pointer-events-none space-y-2" aria-hidden>
                <div className="blur-sm text-xs text-muted-foreground font-mono">{sample}</div>
                <div className="blur-sm space-y-1.5">
                  <div className="h-2 bg-muted-foreground/20 rounded-full w-full" />
                  <div className="h-2 bg-muted-foreground/20 rounded-full w-3/4" />
                  <div className="h-2 bg-muted-foreground/20 rounded-full w-1/2" />
                </div>
              </div>
            </div>
            <div className="absolute inset-0 bg-background/75 backdrop-blur-[3px] flex flex-col items-center justify-center gap-3 p-4">
              <div className="h-10 w-10 rounded-full bg-muted border-2 border-border flex items-center justify-center">
                <Lock className="h-4 w-4 text-muted-foreground" />
              </div>
              <Button
                type="button"
                size="sm"
                className="font-bold rounded-xl h-9 px-5 text-xs w-full max-w-[180px] shadow-md shadow-primary/20"
                onClick={onUnlock}
              >
                {priceLabel
                  ? `${t("vin_public_check_cta")} — ${priceLabel}`
                  : t("vin_public_check_cta")}
              </Button>
            </div>
          </VinReportSection>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {extraSections.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="rounded-xl border bg-card/80 px-3 py-3 flex items-center gap-2.5 opacity-90"
          >
            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground truncate">{label}</p>
              <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1 mt-0.5">
                <Lock className="h-2.5 w-2.5 shrink-0" />
                {t("vin_public_locked_hint")}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type VinLockedIntroBannerProps = {
  t: (key: string) => string;
  priceLabel?: string | null;
  onUnlock: () => void;
};

export function VinLockedIntroBanner({ t, priceLabel, onUnlock }: VinLockedIntroBannerProps) {
  return (
    <ReportReveal y={8} className="print:hidden relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] via-card to-card px-4 py-4 sm:px-5 sm:py-4">
      <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
      <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="h-10 w-10 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">{t("vin_public_unlock_title")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
            {t("vin_public_unlock_desc")}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="shrink-0 font-bold rounded-full h-9 px-4 text-xs gap-1 shadow-md shadow-primary/15"
          onClick={onUnlock}
        >
          {priceLabel
            ? `${t("vin_public_check_cta")} — ${priceLabel}`
            : t("vin_public_check_cta")}
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </ReportReveal>
  );
}
