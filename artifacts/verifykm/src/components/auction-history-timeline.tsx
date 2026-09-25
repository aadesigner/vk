import { useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { HistoryShowAllButton } from "@/components/history-show-all-button";
import { sliceForHistoryPreview } from "@/lib/history-section-limit";
import { sortHistoryNewestFirst } from "@/lib/history-sort";
import { localizeProviderDate } from "@/lib/korean-provider-text";
import { translateDamageLabel } from "@/lib/translate-damage-label";
import { translateTitleStatus } from "@/lib/translate-title-status";
import { translateLotStatus } from "@/lib/translate-lot-status";
import { cleanDisplayStr, type AuctionHistoryLike } from "@/lib/report-display";
import { formatLocationLabel, countryLabelsFromT, type CountryLabelOverrides } from "@/lib/format-country-name";
import type { Language } from "@/i18n/context";
import { cn } from "@/lib/utils";

type Props = {
  history: AuctionHistoryLike[];
  t: (key: string) => string;
  language: Language;
  vehicleYear?: number | null;
  vehicleCountry?: string | null;
};

function cleanStr(v: string | null | undefined): string | null {
  return cleanDisplayStr(v);
}

function formatUsd(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug">
      <span className="text-muted-foreground/70">{label}: </span>
      <span className="text-foreground/90">{value}</span>
    </p>
  );
}

function AuctionLotCard({
  entry,
  index,
  lotNumber,
  isLatest,
  t,
  language,
  vehicleYear,
  vehicleCountry,
  countryLabels,
}: {
  entry: AuctionHistoryLike;
  index: number;
  lotNumber: number;
  isLatest: boolean;
  t: (key: string) => string;
  language: Language;
  vehicleYear?: number | null;
  vehicleCountry?: string | null;
  countryLabels: CountryLabelOverrides;
}) {
  const [open, setOpen] = useState(index === 0);
  const rawStatus = cleanStr(entry.lotStatus);
  const status = translateLotStatus(t, rawStatus);
  const displayDate = entry.date
    ? localizeProviderDate(entry.date, language, vehicleYear, vehicleCountry)
    : null;
  const locationParts = [entry.city, entry.state, entry.country].filter(Boolean);
  const locationStr = locationParts.length > 0
    ? formatLocationLabel(locationParts.join(", "), language, countryLabels)
    : null;
  const cond = translateLotStatus(t, cleanStr(entry.condition));
  const primaryDmg = translateDamageLabel(t, cleanStr(entry.primaryDamage) ?? cleanStr(entry.damage));
  const secondaryDmg = translateDamageLabel(t, cleanStr(entry.secondaryDamage));
  const titleLabel = translateTitleStatus(t, cleanStr(entry.titleStatus));
  const hasBids = entry.openingBid != null || entry.buyNowPrice != null || entry.finalPrice != null;
  const hasDetails = !!(cond || primaryDmg || secondaryDmg || titleLabel || hasBids || locationStr);

  return (
    <div className="rounded-lg border border-border/60">
      <button
        type="button"
        onClick={() => hasDetails && setOpen((v) => !v)}
        className={cn(
          "w-full text-left px-3.5 py-3 sm:px-4",
          hasDetails && "cursor-pointer hover:bg-muted/20",
        )}
        aria-expanded={hasDetails ? open : undefined}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-sm font-semibold tracking-tight text-foreground">
                {t("auction_record_n")} #{lotNumber}
              </p>
              {isLatest ? (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium">
                  {t("latest")}
                </Badge>
              ) : null}
              {status ? (
                <span className="text-[10px] text-muted-foreground">· {status}</span>
              ) : null}
            </div>
            {displayDate ? (
              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{displayDate}</p>
            ) : null}
            {locationStr && !open ? (
              <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                <span className="truncate">{locationStr}</span>
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {entry.finalPrice != null ? (
              <p className="text-sm font-semibold tabular-nums text-primary">
                {formatUsd(entry.finalPrice)}
              </p>
            ) : null}
            {hasDetails ? (
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground/60 transition-transform duration-200",
                  open && "rotate-180",
                )}
                aria-hidden
              />
            ) : null}
          </div>
        </div>
      </button>

      {open && hasDetails ? (
        <div className="space-y-2.5 border-t border-border/50 px-3.5 py-3 sm:px-4">
          {locationStr ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground leading-snug">
              <MapPin className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
              {locationStr}
            </p>
          ) : null}

          {(cond || primaryDmg || secondaryDmg || titleLabel) ? (
            <div className="space-y-1">
              {cond ? <MetaRow label={t("condition")} value={cond} /> : null}
              {primaryDmg ? <MetaRow label={t("primary_damage")} value={primaryDmg} /> : null}
              {secondaryDmg ? <MetaRow label={t("secondary_damage")} value={secondaryDmg} /> : null}
              {titleLabel ? <MetaRow label={t("title_status")} value={titleLabel} /> : null}
            </div>
          ) : null}

          {hasBids ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 pt-0.5">
              {entry.openingBid != null ? (
                <div>
                  <p className="text-[10px] text-muted-foreground">{t("auction_opening_bid")}</p>
                  <p className="text-sm font-medium tabular-nums">{formatUsd(entry.openingBid)}</p>
                </div>
              ) : null}
              {entry.buyNowPrice != null ? (
                <div>
                  <p className="text-[10px] text-muted-foreground">{t("auction_buy_now")}</p>
                  <p className="text-sm font-medium tabular-nums">{formatUsd(entry.buyNowPrice)}</p>
                </div>
              ) : null}
              {entry.finalPrice != null ? (
                <div>
                  <p className="text-[10px] font-medium text-primary">{t("auction_final_price")}</p>
                  <p className="text-sm font-semibold tabular-nums text-primary">{formatUsd(entry.finalPrice)}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function AuctionHistoryTimeline({ history, t, language, vehicleYear, vehicleCountry }: Props) {
  const [expanded, setExpanded] = useState(false);
  const countryLabels = countryLabelsFromT(t);
  const sorted = sortHistoryNewestFirst(history);
  const visible = sliceForHistoryPreview(sorted, expanded);

  return (
    <div className="space-y-2">
      {visible.map((entry, i) => {
        const lotNumber = sorted.length - i;
        return (
          <AuctionLotCard
            key={`${entry.date ?? ""}-${entry.finalPrice ?? ""}-${i}`}
            entry={entry}
            index={i}
            lotNumber={lotNumber}
            isLatest={i === 0}
            t={t}
            language={language}
            vehicleYear={vehicleYear}
            vehicleCountry={vehicleCountry}
            countryLabels={countryLabels}
          />
        );
      })}
      <HistoryShowAllButton
        total={sorted.length}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        t={t}
      />
    </div>
  );
}
