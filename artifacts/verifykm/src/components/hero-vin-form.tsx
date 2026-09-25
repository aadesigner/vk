import type { FormEvent, ReactNode, RefObject } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VinLookupDisabledBanner } from "@/components/vin-lookup-disabled-banner";
import { WhereToFindVinHelp } from "@/components/where-to-find-vin-help";
import { VinCheckSubmitLabel } from "@/components/vin-check-submit-label";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/context";

type HeroVinFormProps = {
  vin: string;
  onVinChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  error?: string;
  disabled?: boolean;
  placeholder: string;
  alerts?: ReactNode;
  inputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
  helpVariant?: "default" | "on-dark";
  /** When set, always use this i18n key for the submit button (e.g. check_vin_short). */
  submitLabelKey?: string;
  showHelp?: boolean;
  /** Homepage hero only — larger field and a fill track. Other pages stay as they are. */
  layout?: "default" | "home";
};

export function HeroVinForm({
  vin,
  onVinChange,
  onSubmit,
  error,
  disabled,
  placeholder,
  alerts,
  inputRef,
  className,
  helpVariant = "default",
  submitLabelKey,
  showHelp = true,
  layout = "default",
}: HeroVinFormProps) {
  const { t } = useTranslation();
  const vinLen = vin.length;
  const isComplete = vinLen === 17;
  const showMessages = Boolean(error) || Boolean(alerts);
  const isHome = layout === "home";
  const helpOnDark = helpVariant === "on-dark";
  const fieldOnDark = helpOnDark && !isHome;

  const onVinInput = (value: string) => onVinChange(value.replace(/\s/g, "").toUpperCase());

  const pipGroups = [3, 6, 8];
  let pipIndex = 0;
  const pips = (
    <div className="flex items-end gap-2.5 px-1" aria-hidden>
      {pipGroups.map((count, group) => {
        const start = pipIndex;
        pipIndex += count;
        return (
          <div key={group} className="flex min-w-0 flex-1 items-end gap-[3px]">
            {Array.from({ length: count }, (_, offset) => {
              const i = start + offset;
              const filled = i < vinLen;
              const current = filled && i === vinLen - 1 && !isComplete;
              return (
                <span
                  key={i}
                  className={cn(
                    "flex-1 rounded-full transition-all duration-150",
                    current ? "h-2.5" : "h-1.5",
                    filled
                      ? fieldOnDark
                        ? "bg-white"
                        : isComplete
                          ? "bg-[#00a5fd]"
                          : "bg-[#33bbfd]"
                      : fieldOnDark
                        ? "bg-white/35"
                        : "bg-[#00a5fd]/25",
                  )}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (disabled || !isComplete) return;
    onSubmit(e);
  };

  const submitDisabled = Boolean(disabled) || !isComplete;

  return (
    <form onSubmit={handleFormSubmit} className={cn("max-w-lg sm:max-w-xl w-full mx-auto space-y-3 text-left", className)}>
      <VinLookupDisabledBanner compact />

      {/* VIN is always LTR — keep field layout left-aligned in Arabic/RTL pages. */}
      <div className={cn(disabled && "opacity-60 pointer-events-none")} dir="ltr">
        <div
          className={cn(
            "hero-vin-field relative space-y-2 overflow-hidden rounded-[1.35rem] border p-2",
            isHome && "sm:p-2.5",
            fieldOnDark && "hero-vin-field--on-dark",
            fieldOnDark
              ? "border-white/35 bg-white/15"
              : "border-slate-200 bg-white text-slate-950 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.45)] focus-within:border-[#00a5fd]",
          )}
        >
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Input
              ref={inputRef}
              dir="ltr"
              className={cn(
                "vin-input-ltr h-12 min-w-0 flex-1 border-0 bg-transparent pl-3 pr-1 font-mono text-[15px] font-semibold tracking-[0.14em] shadow-none placeholder:font-sans placeholder:font-normal placeholder:tracking-normal focus-visible:ring-0 sm:h-[3.25rem] sm:text-[17px]",
                fieldOnDark ? "text-white placeholder:text-white/80" : "text-slate-950 placeholder:text-slate-400",
              )}
              placeholder={placeholder}
              value={vin}
              onChange={(e) => onVinInput(e.target.value)}
              maxLength={17}
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              aria-label={placeholder}
            />
            <span
              className={cn(
                "shrink-0 font-mono text-[11px] font-semibold tabular-nums sm:text-xs",
                isComplete
                  ? fieldOnDark ? "text-white" : "text-[#0088d4]"
                  : fieldOnDark ? "text-white/70" : "text-slate-400",
              )}
              aria-hidden
            >
              {String(vinLen).padStart(2, "0")}
              <span className={fieldOnDark ? "text-white/40" : "text-slate-300"}>/17</span>
            </span>
            <span className="sr-only" aria-live="polite">{vinLen}/17</span>
            <Button
              type="submit"
              disabled={submitDisabled}
              className={cn(
                "hero-vin-submit h-11 shrink-0 rounded-xl px-3.5 text-sm font-bold sm:h-12 sm:px-5 disabled:bg-[#d7eefe] disabled:text-[#0a4668] disabled:opacity-100 disabled:shadow-none",
                isComplete && "shadow-[0_10px_24px_-12px_rgba(0,165,253,0.9)]",
              )}
            >
              {submitLabelKey ? t(submitLabelKey) : <VinCheckSubmitLabel />}
            </Button>
          </div>
          {pips}
        </div>
        {showMessages && (
          <div className="mt-2 space-y-2">
            {error && (
              <p className={cn(
                "rounded-2xl border px-3 py-2 text-sm",
                fieldOnDark
                  ? "border-red-300/40 bg-red-500/15 text-red-50"
                  : "border-destructive/25 bg-destructive/5 text-destructive",
              )}>
                {error}
              </p>
            )}
            {alerts}
          </div>
        )}
      </div>

      {showHelp && <WhereToFindVinHelp variant={helpVariant} />}
    </form>
  );
}
