import { useState } from "react";
import {
  ClipboardList,
  Gauge,
  MapPin,
  Wallet,
  Calendar,
  ChevronDown,
  Shield,
  Car,
  FileWarning,
  UserRound,
  ClipboardCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { HistoryShowAllButton } from "@/components/history-show-all-button";
import { VinReportSection, VinReportSectionHeader } from "@/components/vin-report-section";
import { ReportReveal } from "@/components/report-reveal";
import { sliceForHistoryPreview } from "@/lib/history-section-limit";
import { KoreanWonAmount, textContainsWon } from "@/components/korean-won-amount";
import { isKoreanCountry } from "@/lib/korean-currency";
import {
  type RegistryHistoryEntry,
  formatRegistryEventsCount,
  formatRegistryMileage,
  getRecallCompletionStatus,
  localizeRegistryDate,
  localizeRegistrySubtitle,
  translateRegistryDetailValue,
  translateRegistryEventType,
  translateRegistryFieldLabel,
} from "@/lib/registry-history";
import { isRegistryAmountLabel } from "@workspace/korean-registry";
import type { Language } from "@/i18n/context";
import { sortHistoryNewestFirst } from "@/lib/history-sort";
import { sanitizeRegistryDetailRows } from "@/lib/report-display";
import { ensureExpandableDetails } from "@/lib/history-event-details";
import { formatLocationLabel, countryLabelsFromT } from "@/lib/format-country-name";

type Props = {
  events: RegistryHistoryEntry[];
  country?: string | null;
  vehicleYear?: number | null;
  krwPerUsd?: number | null;
  t: (key: string) => string;
  language: Language;
  variant?: "report" | "public";
  /** Registry timeline vs dedicated recalls section vs GetCarAPI events list. */
  kind?: "registry" | "recall" | "events";
  className?: string;
  delay?: number;
};

const TYPE_VISUAL: Record<string, { icon: LucideIcon; dot: string; ring: string; badge: string }> = {
  inspection: {
    icon: ClipboardCheck,
    dot: "bg-violet-500",
    ring: "ring-violet-500/30",
    badge: "bg-violet-500/10 text-violet-800 dark:text-violet-300",
  },
  owner_change: {
    icon: UserRound,
    dot: "bg-blue-500",
    ring: "ring-blue-500/30",
    badge: "bg-blue-500/10 text-blue-800 dark:text-blue-300",
  },
  insurance_event: {
    icon: Shield,
    dot: "bg-amber-500",
    ring: "ring-amber-500/30",
    badge: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
  },
  new_car_delivery: {
    icon: Car,
    dot: "bg-[#00a5fd]",
    ring: "ring-[#00a5fd]/30",
    badge: "bg-[#00a5fd]/10 text-[#006aa8] dark:text-[#33bbfd]",
  },
  first_registration: {
    icon: Car,
    dot: "bg-[#00a5fd]",
    ring: "ring-[#00a5fd]/30",
    badge: "bg-[#00a5fd]/10 text-[#006aa8] dark:text-[#33bbfd]",
  },
  delivery: {
    icon: Car,
    dot: "bg-[#00a5fd]",
    ring: "ring-[#00a5fd]/30",
    badge: "bg-[#00a5fd]/10 text-[#006aa8] dark:text-[#33bbfd]",
  },
  registration_change: {
    icon: ClipboardList,
    dot: "bg-sky-500",
    ring: "ring-sky-500/30",
    badge: "bg-sky-500/10 text-sky-800 dark:text-sky-300",
  },
  recall: {
    icon: FileWarning,
    dot: "bg-red-500",
    ring: "ring-red-500/30",
    badge: "bg-red-500/10 text-red-800 dark:text-red-300",
  },
  no_insurance: {
    icon: Shield,
    dot: "bg-muted-foreground/70",
    ring: "ring-muted-foreground/25",
    badge: "bg-muted text-muted-foreground",
  },
};

const DEFAULT_VISUAL = {
  icon: ClipboardList,
  dot: "bg-violet-500",
  ring: "ring-violet-500/30",
  badge: "bg-violet-500/10 text-violet-800 dark:text-violet-300",
};

function typeVisual(type?: string | null) {
  return TYPE_VISUAL[type ?? ""] ?? DEFAULT_VISUAL;
}

function EventDetails({
  event,
  country,
  vehicleYear,
  krwPerUsd,
  t,
  language,
}: {
  event: RegistryHistoryEntry;
  country?: string | null;
  vehicleYear?: number | null;
  krwPerUsd?: number | null;
  t: Props["t"];
  language: Language;
}) {
  const rows = sanitizeRegistryDetailRows(event.details);
  if (!rows.length) return null;

  return (
    <dl className="space-y-2 pt-2.5 border-t border-border/50">
      {rows.map((row, i) => (
        <div
          key={`${row.label}-${i}`}
          className={cn("min-w-0", row.label.toLowerCase().includes("defect") && "sm:col-span-2")}
        >
          <dt className="text-[10px] font-normal text-muted-foreground mb-0.5">
            {translateRegistryFieldLabel(t, row.label)}
          </dt>
          <dd className="text-xs font-normal text-foreground mt-0.5 whitespace-pre-wrap break-words leading-relaxed">
            {isKoreanCountry(country) && (textContainsWon(row.value) || isRegistryAmountLabel(row.label)) ? (
              <KoreanWonAmount text={row.value} krwPerUsd={krwPerUsd} amountLabel={row.label} />
            ) : (
              translateRegistryDetailValue(t, language, row.label, row.value, vehicleYear)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function RegistryEventCard({
  event,
  country,
  vehicleYear,
  krwPerUsd,
  t,
  language,
  index,
  total,
  isLatest,
  isRecall,
}: {
  event: RegistryHistoryEntry;
  country?: string | null;
  vehicleYear?: number | null;
  krwPerUsd?: number | null;
  t: Props["t"];
  language: Language;
  index: number;
  total: number;
  isLatest: boolean;
  isRecall?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const expanded = ensureExpandableDetails({
    title: event.title,
    details: event.details,
    date: event.date,
    subtitle: event.subtitle,
    mileage: event.mileage,
    location: event.location,
    amount: event.amount,
  });
  const details = expanded.details;
  const hasDetails = details.length > 0;
  const visual = typeVisual(event.type);
  const TypeIcon = visual.icon;
  const typeLabel = translateRegistryEventType(t, event.type, expanded.title ?? event.title, language);
  const subtitle = localizeRegistrySubtitle(t, language, event.subtitle, country, krwPerUsd);
  const showSubtitle = Boolean(
    subtitle
    && subtitle.toLowerCase() !== typeLabel.toLowerCase(),
  );
  const countryLabels = countryLabelsFromT(t);
  const location = event.location
    ? formatLocationLabel(event.location, language, countryLabels)
    : null;
  const date = localizeRegistryDate(language, event.date, vehicleYear, country);
  const isLast = index === total - 1;
  const recallStatus = isRecall ? getRecallCompletionStatus(event) : null;

  return (
    <div className={cn("border-b border-[#00a5fd]/10 last:border-b-0", isLast && "border-b-0")}>
      <div className={cn("pb-3", isLast && "pb-0")}>
        <div className="relative overflow-hidden">
          <button
            type="button"
            className={cn(
              "w-full px-1 py-3 text-left transition-colors",
              hasDetails && "cursor-pointer hover:bg-[#f7fbfe]",
              !hasDetails && "cursor-default",
            )}
            onClick={() => hasDetails && setOpen((v) => !v)}
            disabled={!hasDetails}
            aria-expanded={hasDetails ? open : undefined}
          >
            <div className="flex items-start gap-3">
              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#00a5fd]/15 bg-[#eef8fd]", visual.badge)}>
                <TypeIcon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    {date && (
                      <p className="flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        <Calendar className="h-3 w-3 shrink-0" />
                        {date}
                      </p>
                    )}
                    <p className="text-sm font-semibold leading-snug text-[#071018]">{typeLabel}</p>
                    {recallStatus === "done" && (
                      <Badge
                        className="mt-1 max-w-full border-0 bg-[#00a5fd]/15 text-[#006aa8] dark:text-[#33bbfd] text-[10px] px-1.5 py-0.5 font-medium leading-tight whitespace-normal text-left"
                      >
                        {t("recall_status_done")}
                      </Badge>
                    )}
                    {recallStatus === "not_done" && (
                      <Badge
                        className="mt-1 max-w-full border-0 bg-amber-500/15 text-amber-900 dark:text-amber-300 text-[10px] px-1.5 py-0.5 font-medium leading-tight whitespace-normal text-left"
                      >
                        {t("recall_status_not_done")}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0 pt-0.5">
                    {isLatest && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                        {t("latest")}
                      </Badge>
                    )}
                    {hasDetails && (
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 text-muted-foreground transition-transform",
                          open && "rotate-180",
                        )}
                      />
                    )}
                  </div>
                </div>

                {showSubtitle && (
                  <p className="text-[11px] font-normal text-muted-foreground leading-snug line-clamp-2">{subtitle}</p>
                )}

                {(event.mileage != null || event.amount || location) && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {event.mileage != null && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-normal bg-background/70 border border-border/50 rounded-md px-1.5 py-0.5 tabular-nums text-muted-foreground">
                        <Gauge className="h-2.5 w-2.5 shrink-0" />
                        {formatRegistryMileage(event.mileage)}
                      </span>
                    )}
                    {event.amount && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-normal bg-[#00a5fd]/10 text-[#006aa8] dark:text-[#33bbfd] rounded-md px-1.5 py-0.5">
                        <Wallet className="h-2.5 w-2.5 shrink-0" />
                        {isKoreanCountry(country) ? (
                          <KoreanWonAmount
                            text={event.amount}
                            krwPerUsd={krwPerUsd}
                            amountLabel={event.type === "new_car_delivery" ? "New car list price" : undefined}
                          />
                        ) : (
                          event.amount
                        )}
                      </span>
                    )}
                    {location && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-normal bg-background/70 border border-border/50 rounded-md px-1.5 py-0.5 max-w-full text-muted-foreground">
                        <MapPin className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{location}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </button>

          {hasDetails && open && (
            <div className="px-3 pb-2.5 pt-0">
              <EventDetails
                event={{ ...event, title: expanded.title ?? event.title, details }}
                country={country}
                vehicleYear={vehicleYear}
                krwPerUsd={krwPerUsd}
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

export function RegistryHistorySection({
  events,
  country,
  vehicleYear,
  krwPerUsd,
  t,
  language,
  variant = "report",
  kind = "registry",
  className,
  delay = 0.1,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!events.length) return null;

  const sortedEvents = sortHistoryNewestFirst(events);
  const visibleEvents = sliceForHistoryPreview(sortedEvents, expanded);
  const isRecall = kind === "recall";
  const isEvents = kind === "events";
  const HeaderIcon = isRecall ? FileWarning : ClipboardList;
  const accent = isRecall ? "rose" as const : isEvents ? "sky" as const : "purple" as const;
  const titleKey = isRecall
    ? "report_recall_history"
    : isEvents
      ? "report_events_history"
      : "report_registry_history";
  const noteKey = isRecall
    ? "report_recall_history_note"
    : isEvents
      ? "report_events_history_note"
      : "report_registry_history_note";

  const body = (
    <VinReportSection className={className} accent={accent}>
      <VinReportSectionHeader
        variant={variant === "public" ? "public" : "report"}
        icon={HeaderIcon}
        accent={accent}
        title={t(titleKey)}
        subtitle={variant === "report" ? t(noteKey) : undefined}
        trailing={
          <Badge variant="secondary" className="text-xs shrink-0">
            {formatRegistryEventsCount(t, sortedEvents.length)}
          </Badge>
        }
      />
      <div className="px-4 py-3">
        {variant === "public" && (
          <p className="text-[11px] text-muted-foreground mb-2.5 leading-snug">{t(noteKey)}</p>
        )}
        <div className="space-y-0">
          {visibleEvents.map((event, i) => (
            <RegistryEventCard
              key={`${event.type}-${event.date}-${i}`}
              event={event}
              country={country}
              vehicleYear={vehicleYear}
              krwPerUsd={krwPerUsd}
              t={t}
              language={language}
              index={i}
              total={visibleEvents.length}
              isLatest={i === 0 && sortedEvents.length > 1}
              isRecall={isRecall}
            />
          ))}
        </div>
        <HistoryShowAllButton
          total={sortedEvents.length}
          expanded={expanded}
          onToggle={() => setExpanded((v) => !v)}
          t={t}
          className="mt-2"
        />
      </div>
    </VinReportSection>
  );

  if (variant === "public") {
    return (
      <ReportReveal delay={delay} y={12}>
        {body}
      </ReportReveal>
    );
  }

  return (
    <ReportReveal delay={delay} y={16} inView>
      {body}
    </ReportReveal>
  );
}
