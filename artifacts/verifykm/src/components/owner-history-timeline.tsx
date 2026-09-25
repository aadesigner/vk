import { useState } from "react";
import { DollarSign, Gauge, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { HistoryShowAllButton } from "@/components/history-show-all-button";
import { sliceForHistoryPreview } from "@/lib/history-section-limit";
import { sortHistoryNewestFirst } from "@/lib/history-sort";
import { translateKoreanProviderPhrase, localizeProviderDate } from "@/lib/korean-provider-text";
import { translateLotStatus } from "@/lib/translate-lot-status";
import { cleanDisplayStr, type OwnerHistoryLike } from "@/lib/report-display";
import { formatLocationLabel, countryLabelsFromT } from "@/lib/format-country-name";
import type { Language } from "@/i18n/context";
import { cn } from "@/lib/utils";

type Props = {
  history: OwnerHistoryLike[];
  t: (key: string) => string;
  language: Language;
  vehicleYear?: number | null;
  vehicleCountry?: string | null;
};

export function OwnerHistoryTimeline({ history, t, language, vehicleYear, vehicleCountry }: Props) {
  const [expanded, setExpanded] = useState(false);
  const countryLabels = countryLabelsFromT(t);
  const sorted = sortHistoryNewestFirst(history);
  const visible = sliceForHistoryPreview(sorted, expanded);

  return (
    <div className="space-y-3">
      <div>
        {visible.map((entry, i) => {
          const ownerNumber = sorted.length - i;
          const isLatest = i === 0 && sorted.length > 1;
          const isFirstOwner = ownerNumber === 1;
          const isLast = i === visible.length - 1;
          const cond = translateLotStatus(t, cleanDisplayStr(entry.condition));
          const status = translateLotStatus(t, cleanDisplayStr(entry.lotStatus))
            ?? translateKoreanProviderPhrase(t, cleanDisplayStr(entry.lotStatus));
          const displayDate = localizeProviderDate(entry.date, language, vehicleYear, vehicleCountry);
          return (
            <div key={i} className="relative pl-7">
              <div className={cn(
                "absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-background ring-2",
                isLatest ? "bg-[#00a5fd] ring-[#00a5fd]/30"
                  : isFirstOwner ? "bg-muted-foreground/50 ring-muted-foreground/25"
                  : "bg-amber-500 ring-amber-500/30",
              )} />
              {!isLast && <div className="absolute left-[6px] top-5 bottom-0 w-0.5 bg-border" />}
              <div className={cn("pb-5", isLast && "pb-0")}>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-bold">{t("owner_transfer")} #{ownerNumber}</span>
                  {isLatest && <Badge variant="secondary" className="text-[10px]">{t("latest")}</Badge>}
                </div>
                {displayDate && (
                  <p className="text-xs text-muted-foreground">{displayDate}</p>
                )}
                {entry.location && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {formatLocationLabel(entry.location, language, countryLabels)}
                  </p>
                )}
                {entry.mileage != null && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Gauge className="h-3 w-3 shrink-0" />{entry.mileage.toLocaleString()} km
                  </p>
                )}
                {entry.auctionPrice != null && (
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1 mt-0.5">
                    <DollarSign className="h-3 w-3 shrink-0" />
                    {entry.auctionPrice.toLocaleString()}
                  </p>
                )}
                {(cond || status) && (
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {cond && (
                      <span className="text-xs bg-muted rounded-md px-2 py-0.5 text-muted-foreground">
                        {t("condition")}: {cond}
                      </span>
                    )}
                    {status && (
                      <span className="text-xs bg-muted rounded-md px-2 py-0.5 text-muted-foreground">
                        {status}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <HistoryShowAllButton
        total={sorted.length}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        t={t}
      />
    </div>
  );
}
