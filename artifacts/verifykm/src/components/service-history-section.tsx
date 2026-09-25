import { useState } from "react";
import {
  Wrench,
  Calendar,
  MapPin,
  Gauge,
  ClipboardCheck,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { sortHistoryNewestFirst } from "@/lib/history-sort";
import { sliceForHistoryPreview } from "@/lib/history-section-limit";
import { HistoryShowAllButton } from "@/components/history-show-all-button";
import { VinReportSection, VinReportSectionHeader } from "@/components/vin-report-section";
import { ReportReveal } from "@/components/report-reveal";
import {
  localizeProviderDate,
  translateKoreanProviderPhrase,
  translateKoreanProviderText,
  translateProviderDateInText,
} from "@/lib/korean-provider-text";
import { cleanDisplayText, sanitizeRegistryDetailRows } from "@/lib/report-display";
import {
  translateRegistryFieldLabel,
  translateRegistryDetailValue,
} from "@/lib/registry-history";
import { splitColonTitle } from "@/lib/history-event-details";
import { formatMilesInParens } from "@/lib/format-km-with-miles";
import { cn } from "@/lib/utils";
import type { Language } from "@/i18n/context";

export type ServiceHistoryEntry = {
  date?: string | null;
  mileage?: number | null;
  title?: string | null;
  location?: string | null;
  description?: string | null;
  details?: Array<{ label: string; value: string }>;
};

type Props = {
  events: ServiceHistoryEntry[];
  vehicleYear?: number | null;
  vehicleCountry?: string | null;
  t: (key: string) => string;
  language: Language;
  variant?: "report" | "public";
  className?: string;
  delay?: number;
};

const CHIP_PREVIEW = 8;

function isInspectionEntry(event: ServiceHistoryEntry): boolean {
  const title = (event.title ?? "").toLowerCase();
  return /inspect|inspection|검수|점검/.test(title)
    || (event.details ?? []).some((row) => /inspect/i.test(row.label));
}

function localizeServiceTitle(
  t: (key: string) => string,
  language: Language,
  title: string,
): string {
  const fromPhrase = translateKoreanProviderPhrase(t, title)
    ?? translateKoreanProviderText(t, title);
  const base = fromPhrase && fromPhrase !== title ? fromPhrase : title;
  return translateProviderDateInText(base, language) ?? base;
}

/** Split Carfax-style "Oil · Brakes · Tires" work lists into chips. */
function splitWorkItems(description: string | null | undefined): string[] {
  const raw = cleanDisplayText(description);
  if (!raw) return [];
  return raw
    .split(/\s*[·•|;]\s*|\s+-\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

function ServiceDetails({
  details,
  vehicleYear,
  t,
  language,
}: {
  details: Array<{ label: string; value: string }>;
  vehicleYear?: number | null;
  t: Props["t"];
  language: Language;
}) {
  if (!details.length) return null;
  return (
    <dl className="space-y-2 pt-2.5 border-t border-border/50">
      {details.map((row, i) => (
        <div key={`${row.label}-${i}`} className="min-w-0">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80 mb-0.5">
            {translateRegistryFieldLabel(t, row.label)}
          </dt>
          <dd className="text-xs font-normal text-foreground leading-relaxed break-words">
            {translateRegistryDetailValue(t, language, row.label, row.value, vehicleYear)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function WorkChips({
  items,
  expanded,
  onExpand,
}: {
  items: string[];
  expanded: boolean;
  onExpand?: () => void;
}) {
  if (items.length === 0) return null;
  const visible = expanded || items.length <= CHIP_PREVIEW
    ? items
    : items.slice(0, CHIP_PREVIEW);
  const hidden = items.length - visible.length;

  return (
    <div className="flex flex-wrap gap-1 pt-0.5">
      {visible.map((item, i) => (
        <span
          key={`${i}-${item.slice(0, 24)}`}
          className="inline-flex max-w-full items-center rounded-md border border-[#00a5fd]/15 bg-[#00a5fd]/[0.06] px-1.5 py-0.5 text-[10px] font-medium leading-snug text-foreground/80 dark:border-[#33bbfd]/15 dark:bg-[#00a5fd]/[0.07]"
        >
          <span className="truncate">{item}</span>
        </span>
      ))}
      {hidden > 0 && onExpand ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          className="inline-flex items-center rounded-md border border-border/60 bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          +{hidden}
        </button>
      ) : null}
    </div>
  );
}

function ServiceRow({
  event,
  vehicleYear,
  vehicleCountry,
  t,
  language,
  index,
  total,
  isLatest,
}: {
  event: ServiceHistoryEntry;
  vehicleYear?: number | null;
  vehicleCountry?: string | null;
  t: Props["t"];
  language: Language;
  index: number;
  total: number;
  isLatest: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [chipsOpen, setChipsOpen] = useState(false);
  const inspection = isInspectionEntry(event);

  let rawTitle = cleanDisplayText(event.title);
  const split = splitColonTitle(rawTitle);
  if (split) rawTitle = split.title;

  const providerDetails = sanitizeRegistryDetailRows([
    ...(split ? [{ label: split.label, value: split.value }] : []),
    ...(event.details ?? []),
  ]);
  // Skip Date / Mileage / Location — already shown on the card chrome
  const details = providerDetails.filter(
    (d) => !/^(date|mileage|odometer|location|details)$/i.test(d.label.trim()),
  );
  const hasDetails = details.length > 0;

  const title = localizeServiceTitle(
    t,
    language,
    rawTitle || (inspection ? t("registry_type_inspection") : t("service_history_default_title")),
  );
  const location = cleanDisplayText(event.location);
  const workItems = splitWorkItems(event.description).filter(
    (item) => item.toLowerCase() !== title.toLowerCase(),
  );
  const displayDate = event.date
    ? localizeProviderDate(event.date, language, vehicleYear, vehicleCountry)
    : null;
  const mileage = event.mileage != null && Number(event.mileage) > 0
    ? Number(event.mileage)
    : null;
  const isLast = index === total - 1;

  const Icon: LucideIcon = inspection ? ClipboardCheck : Wrench;
  const accent = inspection
    ? {
        rail: "bg-violet-500",
        ring: "ring-violet-500/30",
        icon: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
        wash: "from-violet-500/[0.04]",
        border: "border-violet-500/20",
      }
    : {
        rail: "bg-[#00a5fd]",
        ring: "ring-[#00a5fd]/30",
        icon: "bg-[#00a5fd]/10 text-[#0077c2] dark:text-[#33bbfd]",
        wash: "from-sky-500/[0.04]",
        border: "border-[#00a5fd]/20",
      };

  return (
    <div className="relative pl-5 sm:pl-6">
      <div
        className={cn(
          "absolute left-0 top-4 h-2.5 w-2.5 rounded-full border-2 border-background ring-2",
          accent.rail,
          accent.ring,
          isLatest && "h-3 w-3 top-3.5 left-[-1px]",
        )}
      />
      {!isLast && (
        <div className="absolute left-[4.5px] top-7 bottom-0 w-px bg-gradient-to-b from-border via-border/80 to-transparent" />
      )}

      <div className={cn("pb-3 sm:pb-3.5", isLast && "pb-0")}>
        <div
          className={cn(
            "relative overflow-hidden rounded-xl border bg-card/80",
            isLatest ? cn("border-l-[3px]", accent.border, "border-border/60") : "border-border/60",
            "bg-gradient-to-br",
            accent.wash,
            "to-transparent",
          )}
        >
          <div
            className={cn(
              "w-full text-left px-3 py-2.5 sm:px-3.5 sm:py-3",
              hasDetails && "cursor-pointer hover:bg-muted/25 transition-colors",
            )}
            role={hasDetails ? "button" : undefined}
            tabIndex={hasDetails ? 0 : undefined}
            onClick={() => hasDetails && setOpen((v) => !v)}
            onKeyDown={(e) => {
              if (!hasDetails) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpen((v) => !v);
              }
            }}
            aria-expanded={hasDetails ? open : undefined}
          >
            <div className="flex items-start gap-2.5 sm:gap-3">
              <div
                className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.06]",
                  accent.icon,
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>

              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {displayDate ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium tabular-nums text-muted-foreground">
                          <Calendar className="h-3 w-3 shrink-0 opacity-70" />
                          {displayDate}
                        </span>
                      ) : null}
                      {isLatest ? (
                        <Badge
                          variant="secondary"
                          className="h-4 px-1.5 text-[9px] font-semibold uppercase tracking-wide"
                        >
                          {t("latest")}
                        </Badge>
                      ) : null}
                      {inspection ? (
                        <span className="text-[9px] font-semibold uppercase tracking-wide text-violet-600/90 dark:text-violet-300/90">
                          {t("registry_type_inspection")}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[13px] font-semibold leading-snug tracking-tight text-foreground">
                      {title}
                    </p>
                  </div>
                  {hasDetails ? (
                    <ChevronDown
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform",
                        open && "rotate-180",
                      )}
                    />
                  ) : null}
                </div>

                <WorkChips
                  items={workItems}
                  expanded={chipsOpen}
                  onExpand={() => setChipsOpen(true)}
                />

                {(mileage != null || location) && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {mileage != null && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-background/70 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                        <Gauge className="h-2.5 w-2.5 shrink-0 opacity-80" />
                        {mileage.toLocaleString()} km
                        <span className="font-normal opacity-65">{formatMilesInParens(mileage, t)}</span>
                      </span>
                    )}
                    {location && (
                      <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-border/50 bg-background/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        <MapPin className="h-2.5 w-2.5 shrink-0 opacity-80" />
                        <span className="truncate">{location}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {hasDetails && open && (
            <div className="px-3 pb-3 pt-0 sm:px-3.5">
              <ServiceDetails
                details={details}
                vehicleYear={vehicleYear}
                t={t}
                language={language}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ServicesList({
  events,
  vehicleYear,
  vehicleCountry,
  t,
  language,
  expanded,
  onToggle,
}: {
  events: ServiceHistoryEntry[];
  vehicleYear?: number | null;
  vehicleCountry?: string | null;
  t: Props["t"];
  language: Language;
  expanded: boolean;
  onToggle: () => void;
}) {
  const visible = sliceForHistoryPreview(events, expanded);
  return (
    <div className="space-y-0">
      {visible.map((event, i) => (
        <ServiceRow
          key={`${event.date ?? ""}-${event.title ?? ""}-${i}`}
          event={event}
          vehicleYear={vehicleYear}
          vehicleCountry={vehicleCountry}
          t={t}
          language={language}
          index={i}
          total={visible.length}
          isLatest={i === 0 && events.length > 1}
        />
      ))}
      <HistoryShowAllButton
        total={events.length}
        expanded={expanded}
        onToggle={onToggle}
        t={t}
      />
    </div>
  );
}

function ServicesSummary({
  events,
  vehicleYear,
  vehicleCountry,
  t,
  language,
}: {
  events: ServiceHistoryEntry[];
  vehicleYear?: number | null;
  vehicleCountry?: string | null;
  t: Props["t"];
  language: Language;
}) {
  const latest = events[0];
  const latestDate = latest?.date
    ? localizeProviderDate(latest.date, language, vehicleYear, vehicleCountry)
    : null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border/50 pb-3">
      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-[#00a5fd]/80" aria-hidden />
        <span className="font-semibold tabular-nums text-foreground">{events.length}</span>
        <span>{t("service_records")}</span>
      </span>
      {latestDate ? (
        <span className="ml-auto text-[11px] text-muted-foreground">
          <span className="text-muted-foreground/80">{t("latest")}</span>
          {" · "}
          <span className="font-medium tabular-nums text-foreground/90">{latestDate}</span>
        </span>
      ) : null}
    </div>
  );
}

/** Hidden when `events` is empty. */
export function ServiceHistorySection({
  events,
  vehicleYear,
  vehicleCountry,
  t,
  language,
  variant = "report",
  className,
  delay = 0.1,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  if (!events.length) return null;

  const sorted = sortHistoryNewestFirst(events);

  const body = (
    <>
      <ServicesSummary
        events={sorted}
        vehicleYear={vehicleYear}
        vehicleCountry={vehicleCountry}
        t={t}
        language={language}
      />
      <ServicesList
        events={sorted}
        vehicleYear={vehicleYear}
        vehicleCountry={vehicleCountry}
        t={t}
        language={language}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
      />
    </>
  );

  if (variant === "public") {
    return (
      <ReportReveal delay={delay} y={12} className={className}>
        <VinReportSection accent="sky">
          <VinReportSectionHeader
            variant="public"
            icon={Wrench}
            accent="sky"
            title={t("report_service_history")}
            trailing={
              <Badge variant="secondary" className="text-[11px] sm:text-xs shrink-0">
                {sorted.length}
              </Badge>
            }
          />
          <div className="px-4 py-3 sm:px-5 sm:py-3.5">{body}</div>
        </VinReportSection>
      </ReportReveal>
    );
  }

  return (
    <ReportReveal delay={delay} y={16} inView className={className}>
      <VinReportSection accent="sky">
        <VinReportSectionHeader
          icon={Wrench}
          accent="sky"
          title={t("report_service_history")}
          trailing={
            <Badge variant="secondary" className="text-xs shrink-0">
              {sorted.length}
            </Badge>
          }
        />
        <div className="px-4 py-3.5 sm:px-5">{body}</div>
      </VinReportSection>
    </ReportReveal>
  );
}
