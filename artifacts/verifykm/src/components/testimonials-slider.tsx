import { useEffect, useState } from "react";
import { Star, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { useTranslation } from "@/i18n/context";
import { flagAltFromCode } from "@/lib/flag-alt";
import { cn } from "@/lib/utils";
import type { Testimonial } from "@/data/testimonials";

type TestimonialsSliderProps = {
  testimonials: Testimonial[];
  titleKey?: string;
  subtitleKey?: string;
  className?: string;
};

export function TestimonialsSlider({
  testimonials,
  titleKey = "testimonials_title",
  subtitleKey = "testimonials_subtitle",
  className,
}: TestimonialsSliderProps) {
  const { t, language } = useTranslation();
  const [start, setStart] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = testimonials.length;

  useEffect(() => {
    setStart(0);
  }, [language]);

  useEffect(() => {
    if (paused || count < 2) return;
    const timer = setInterval(() => setStart((i) => (i + 1) % count), 7000);
    return () => clearInterval(timer);
  }, [paused, count]);

  const visible = [0, 1, 2].map((offset) => testimonials[(start + offset) % Math.max(count, 1)]).filter(Boolean);

  const step = (dir: 1 | -1) => {
    if (count === 0) return;
    setStart((i) => (i + dir + count) % count);
  };

  return (
    <section className={cn("bg-[#f4f8fc] px-4 py-16 dark:bg-[#070d16] md:py-24", className)}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 md:mb-10 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#0088d4]">
              {t("testimonials_trust_badge")}
            </p>
            <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">{t(titleKey)}</h2>
            <p className="text-base leading-relaxed text-muted-foreground">{t(subtitleKey)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => step(-1)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#00a5fd]/25 bg-background text-foreground shadow-sm transition-colors hover:border-[#00a5fd]/50"
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#00a5fd]/25 bg-background text-foreground shadow-sm transition-colors hover:border-[#00a5fd]/50"
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          className="grid gap-4 md:grid-cols-3"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {visible.map((tm, index) => (
            <article
              key={`${tm.name}-${start}-${index}`}
              className={cn(
                "flex h-full flex-col rounded-3xl border border-[#00a5fd]/15 bg-background p-5 shadow-[0_16px_40px_-28px_rgba(0,165,253,0.45)] md:p-6",
                index > 0 && "hidden md:flex",
              )}
            >
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={cn(
                        "h-3.5 w-3.5",
                        s <= tm.stars
                          ? "fill-amber-400 text-amber-400"
                          : "fill-muted-foreground/15 text-muted-foreground/25",
                      )}
                    />
                  ))}
                </div>
                {tm.date ? <span className="text-[11px] text-muted-foreground">{tm.date}</span> : null}
              </div>
              <p className="flex-1 text-[15px] leading-relaxed text-foreground/90">
                &ldquo;{tm.text}&rdquo;
              </p>
              {tm.resultBadge ? (
                <div className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600 dark:bg-red-950/40 dark:text-red-400">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {tm.resultBadge}
                </div>
              ) : null}
              <div className="mt-5 flex items-center gap-3 border-t border-border/60 pt-4">
                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white", tm.avatarBg)}>
                  {tm.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">{tm.name}</span>
                    <img
                      src={`https://flagcdn.com/${tm.flagCode}.svg`}
                      alt={flagAltFromCode(tm.flagCode, t)}
                      className="h-3.5 w-auto shrink-0 rounded-sm"
                    />
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">{tm.car}</p>
                </div>
                <span className="hidden items-center gap-1 text-[10px] font-semibold text-[#0088d4] xl:inline-flex dark:text-[#00a5fd]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t("auth_verified_purchase")}
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
