import { CircleHelp } from "lucide-react";
import { useTranslation } from "@/i18n/context";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { VinReportSectionAccent } from "@/components/vin-report-section";

/** Section header accent for ownership count risk. */
export function ownershipSectionAccent(ownerCount: number | null | undefined): VinReportSectionAccent {
  if (ownerCount == null || !Number.isFinite(ownerCount)) return "sky";
  if (ownerCount > 8) return "rose";
  if (ownerCount > 5) return "orange";
  return "sky";
}

/** True when owner count is elevated enough to warrant a “what this means” hint. */
export function isHighOwnerCount(ownerCount: number | null | undefined): boolean {
  return ownerCount != null && Number.isFinite(ownerCount) && ownerCount > 5;
}

/** Section header accent for safety — red when salvage or stolen. */
export function safetySectionAccent(
  isSalvage: boolean | null | undefined,
  isStolen: boolean | null | undefined,
): VinReportSectionAccent {
  if (isSalvage === true || isStolen === true) return "rose";
  return "sky";
}

/**
 * Problem title brands that need explanation (lemon / rebuilt / other branded titles).
 * Plain “salvage” alone is covered by SalvageMeaningHint.
 */
export type TitleBrandHintKind = "lemon" | "rebuilt" | "branded";

export function titleBrandHintKind(
  titleStatus: string | null | undefined,
): TitleBrandHintKind | null {
  if (!titleStatus || titleStatus === "[object Object]") return null;
  const s = titleStatus.toLowerCase();
  if (/\blemon\b|manufacturer\s*buyback|\bbuyback\b/.test(s)) return "lemon";
  if (/\brebuilt\b|\breconstructed\b/.test(s)) return "rebuilt";
  if (
    /\b(junk|flood|hail|fire|theft\s*recovery|parts\s*only|non[\s-]?repairable|export\s*only|branded)\b/.test(s)
  ) {
    return "branded";
  }
  return null;
}

type HintTone = "rose" | "amber" | "orange";

const TONE_TRIGGER: Record<HintTone, string> = {
  rose: "text-red-700 dark:text-red-400 hover:bg-red-500/10 focus-visible:ring-red-500/40",
  amber: "text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 focus-visible:ring-amber-500/40",
  orange: "text-orange-700 dark:text-orange-400 hover:bg-orange-500/10 focus-visible:ring-orange-500/40",
};

const TONE_POPOVER: Record<HintTone, string> = {
  rose: "border-red-200/70 dark:border-red-900/50",
  amber: "border-amber-200/70 dark:border-amber-900/50",
  orange: "border-orange-200/70 dark:border-orange-900/50",
};

type ReportMeaningHintProps = {
  titleKey: string;
  bodyKey: string;
  learnKey?: string;
  tone?: HintTone;
  className?: string;
  labeled?: boolean;
};

/**
 * Shared click/tap “what this means” popover — works on mobile (tap) and desktop.
 */
export function ReportMeaningHint({
  titleKey,
  bodyKey,
  learnKey,
  tone = "rose",
  className,
  labeled = false,
}: ReportMeaningHintProps) {
  const { t } = useTranslation();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 rounded-md",
            "focus-visible:outline-none focus-visible:ring-2",
            TONE_TRIGGER[tone],
            labeled ? "px-1.5 py-0.5 text-[11px] font-semibold" : "p-0.5",
            className,
          )}
          aria-label={t(titleKey)}
        >
          <CircleHelp className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
          {labeled && learnKey ? <span>{t(learnKey)}</span> : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className={cn(
          "w-[min(20rem,calc(100vw-2rem))] p-3.5 space-y-1.5 bg-card shadow-lg",
          TONE_POPOVER[tone],
        )}
      >
        <p className="text-sm font-semibold text-foreground leading-snug">{t(titleKey)}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{t(bodyKey)}</p>
      </PopoverContent>
    </Popover>
  );
}

/** Hover/click explanation of what a salvage / write-off title means. */
export function SalvageMeaningHint({
  className,
  labeled = false,
}: {
  className?: string;
  labeled?: boolean;
}) {
  return (
    <ReportMeaningHint
      titleKey="salvage_meaning_title"
      bodyKey="salvage_meaning_body"
      learnKey="salvage_meaning_learn"
      tone="rose"
      className={className}
      labeled={labeled}
    />
  );
}

/** Odometer declined between dated readings — likely rollback / tampering risk. */
export function MileageRollbackHint({
  className,
  labeled = false,
}: {
  className?: string;
  labeled?: boolean;
}) {
  return (
    <ReportMeaningHint
      titleKey="rollback_meaning_title"
      bodyKey="rollback_meaning_body"
      learnKey="rollback_meaning_learn"
      tone="amber"
      className={className}
      labeled={labeled}
    />
  );
}

/** Lemon / rebuilt / other branded title status. */
export function TitleBrandHint({
  kind,
  className,
  labeled = false,
}: {
  kind: TitleBrandHintKind;
  className?: string;
  labeled?: boolean;
}) {
  const keys =
    kind === "lemon"
      ? {
          titleKey: "lemon_meaning_title",
          bodyKey: "lemon_meaning_body",
          learnKey: "lemon_meaning_learn",
        }
      : kind === "rebuilt"
        ? {
            titleKey: "rebuilt_meaning_title",
            bodyKey: "rebuilt_meaning_body",
            learnKey: "rebuilt_meaning_learn",
          }
        : {
            titleKey: "branded_title_meaning_title",
            bodyKey: "branded_title_meaning_body",
            learnKey: "branded_title_meaning_learn",
          };

  return (
    <ReportMeaningHint
      {...keys}
      tone={kind === "lemon" ? "rose" : "orange"}
      className={className}
      labeled={labeled}
    />
  );
}

/** Many prior owners — higher wear / unknown maintenance risk. */
export function HighOwnerCountHint({
  className,
  labeled = false,
}: {
  className?: string;
  labeled?: boolean;
}) {
  return (
    <ReportMeaningHint
      titleKey="owners_meaning_title"
      bodyKey="owners_meaning_body"
      learnKey="owners_meaning_learn"
      tone="orange"
      className={className}
      labeled={labeled}
    />
  );
}
