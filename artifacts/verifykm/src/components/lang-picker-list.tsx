import { useEffect, type MouseEvent } from "react";
import { Check } from "lucide-react";
import { FlagImg, prefetchFlags, type FlagVariant } from "@/components/flag-img";
import { formatImageFlagAlt } from "@/lib/flag-alt";
import {
  LANG_PICKER_OPTIONS,
  localeHomePath,
  shouldSoftNavigateClick,
  type Language,
} from "@/lib/languages";
import { useTranslation } from "@/i18n/context";
import { cn } from "@/lib/utils";

export function usePrefetchPickerFlags(open: boolean): void {
  useEffect(() => {
    if (!open) return;
    prefetchFlags(LANG_PICKER_OPTIONS.map((l) => l.flag));
  }, [open]);
}

export function LangPickerList({
  language,
  onSelect,
  hrefForLanguage,
  tone = "nav",
  layout = "default",
  flagVariant = tone === "nav" ? "list" : tone === "footer" ? "list" : "default",
}: {
  language: Language;
  onSelect: (code: Language) => void;
  /** Real href per locale so crawlers / middle-click get a usable URL. */
  hrefForLanguage?: (code: Language) => string;
  tone?: "nav" | "footer";
  /** Mobile navbar — single column, larger touch targets */
  layout?: "default" | "mobile";
  flagVariant?: FlagVariant;
}) {
  const { t } = useTranslation();
  const isFooter = tone === "footer";
  const isMobile = layout === "mobile";

  return (
    <div
      role="listbox"
      className={cn(
        "grid gap-0.5 overflow-y-auto overscroll-contain",
        isMobile
          ? "grid-cols-1 max-h-[min(22rem,58vh)] py-0.5"
          : "grid-cols-1 sm:grid-cols-2 max-h-[min(18rem,70vh)]",
      )}
    >
      {LANG_PICKER_OPTIONS.map((l) => {
        const active = language === l.code;
        const href = hrefForLanguage?.(l.code) ?? localeHomePath(l.code);

        const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
          if (!shouldSoftNavigateClick(e)) return;
          e.preventDefault();
          onSelect(l.code);
        };

        return (
          <a
            key={l.code}
            href={href}
            role="option"
            aria-selected={active}
            aria-current={active ? "page" : undefined}
            onClick={onClick}
            className={cn(
              "flex items-center gap-2.5 rounded-xl text-left min-w-0 transition-colors duration-100 touch-manipulation",
              isMobile ? "px-3 py-2.5" : isFooter ? "px-3 py-2.5" : "px-2.5 py-2",
              isFooter
                ? active
                  ? "bg-primary/20 text-white ring-1 ring-primary/40 shadow-sm shadow-primary/10"
                  : "text-white/75 hover:bg-white/[0.07] hover:text-white"
                : active
                  ? "bg-primary/[0.08] text-primary"
                  : "text-foreground hover:bg-primary/[0.06] active:bg-primary/10",
            )}
          >
            <FlagImg
              code={l.flag}
              variant={flagVariant}
              priority={active}
              alt={formatImageFlagAlt(l.label, t)}
            />
            <span className={cn(
              "truncate flex-1",
              isMobile ? "text-[15px]" : isFooter ? "text-sm" : "text-[13px]",
              active && "font-semibold",
            )}>
              {l.label}
            </span>
            {active && <Check className={cn("text-primary shrink-0", isMobile ? "h-3.5 w-3.5" : isFooter ? "h-4 w-4" : "h-3 w-3")} />}
          </a>
        );
      })}
    </div>
  );
}
