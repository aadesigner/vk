import { Check, FileSearch } from "lucide-react";
import { EnterReveal } from "@/components/enter-reveal";
import { useTranslation } from "@/i18n/context";
import { cn } from "@/lib/utils";
import {
  useWhatWeCheckFeatures,
  whatWeCheckSubtitle,
  type WhatWeCheckMarket,
} from "@/lib/what-we-check-features";

type Props = {
  market: WhatWeCheckMarket;
  subtitle?: string;
  className?: string;
};

/**
 * Country-page counterpart to WhatWeCheckSection.
 *
 * The homepage rotates a single report preview; country pages instead lay the
 * four checks out as a static exhibit grid so the market page reads like a
 * dossier index rather than a repeat of the home carousel.
 */
export function CountryCheckDossier({ market, subtitle, className }: Props) {
  const { t } = useTranslation();
  const features = useWhatWeCheckFeatures(t, market);
  const sectionSubtitle = whatWeCheckSubtitle(t, market, subtitle);

  return (
    <section
      className={cn(
        "relative overflow-hidden border-t border-border/60 bg-background px-4 py-14 md:py-20",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.5)_1px,transparent_1px)] [background-size:120px_100%] opacity-40" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00a5fd]/40 to-transparent" />

      <div className="relative mx-auto max-w-6xl">
        <EnterReveal inView y={12} className="mb-8 md:mb-10">
          <div className="flex flex-col gap-4 border-b border-dashed border-border/70 pb-6 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2.5">
              <p className="inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#0088d4] dark:text-[#33bbfd]">
                <FileSearch className="h-3.5 w-3.5" />
                {t("country_dossier_eyebrow")}
              </p>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{t("what_we_check")}</h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground md:text-right">
              {sectionSubtitle}
            </p>
          </div>
        </EnterReveal>

        <div className="grid gap-3.5 md:grid-cols-2 md:gap-4">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <EnterReveal key={feature.id} inView y={14} delay={i * 0.04}>
                <article className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-border/70 bg-card/80 transition-colors hover:border-[#00a5fd]/45 dark:bg-[#060a14]/70">
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-[3px] bg-[#00a5fd]/35 transition-colors group-hover:bg-[#00a5fd]"
                  />

                  <header className="flex items-start gap-3 border-b border-border/60 px-4 py-3.5 pl-5 sm:px-5 sm:pl-6">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#00a5fd]/10 ring-1 ring-inset ring-[#00a5fd]/25">
                      <Icon className="h-4 w-4 text-[#0088d4] dark:text-[#33bbfd]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80">
                        {t("country_dossier_exhibit")} {String(i + 1).padStart(2, "0")}
                      </p>
                      <h3 className="mt-0.5 truncate text-base font-bold leading-tight">{feature.title}</h3>
                    </div>
                    <div className="shrink-0 border-l border-border/60 pl-3 text-right">
                      <p className="font-mono text-sm font-bold tabular-nums text-[#0088d4] dark:text-[#33bbfd]">
                        {feature.stat}
                      </p>
                      <p className="text-[9px] uppercase tracking-wide text-muted-foreground/80">
                        {feature.statLabel}
                      </p>
                    </div>
                  </header>

                  <div className="flex-1 space-y-3 px-4 py-3.5 pl-5 sm:px-5 sm:pl-6">
                    <p className="text-[13px] leading-relaxed text-muted-foreground">{feature.seo}</p>

                    <div className="space-y-1.5">
                      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
                        {t("country_dossier_checks_label")}
                      </p>
                      <ul className="grid gap-x-3 gap-y-1 sm:grid-cols-2">
                        {feature.includes.map((item) => (
                          <li key={item} className="flex items-start gap-1.5">
                            <Check className="mt-[0.2rem] h-3 w-3 shrink-0 text-[#00a5fd]" />
                            <span className="text-[12px] leading-snug text-foreground/85">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <footer className="border-t border-dashed border-border/60 bg-muted/25 px-4 py-2.5 pl-5 sm:px-5 sm:pl-6 dark:bg-white/[0.02]">
                    <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
                      {t("what_we_check_real_example")}
                    </p>
                    <p className="mt-0.5 text-[12px] leading-snug text-foreground/75">{feature.example}</p>
                  </footer>
                </article>
              </EnterReveal>
            );
          })}
        </div>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-muted-foreground/70">
          {t("country_dossier_footnote")}
        </p>
      </div>
    </section>
  );
}
