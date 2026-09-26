import { Check } from "lucide-react";
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
 * Mobile-first header + cards so long translations (Albanian, German, …) wrap cleanly.
 */
export function CountryCheckDossier({ market, subtitle, className }: Props) {
  const { t } = useTranslation();
  const features = useWhatWeCheckFeatures(t, market);
  const sectionSubtitle = whatWeCheckSubtitle(t, market, subtitle);

  return (
    <section
      className={cn(
        "relative overflow-hidden border-t border-border/60 bg-background px-4 py-12 md:py-16",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00a5fd]/40 to-transparent" />

      <div className="relative mx-auto max-w-6xl">
        <EnterReveal inView y={12} className="mb-7 max-w-2xl space-y-2.5 md:mb-9">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0088d4] dark:text-[#33bbfd]">
            {t("country_dossier_eyebrow")}
          </p>
          <h2 className="text-[1.7rem] font-extrabold leading-[1.15] tracking-tight text-balance sm:text-3xl md:text-4xl">
            {t("what_we_check")}
          </h2>
          <p className="text-[15px] leading-relaxed text-pretty text-muted-foreground">
            {sectionSubtitle}
          </p>
        </EnterReveal>

        <div className="grid gap-3 sm:grid-cols-2 md:gap-4">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <EnterReveal key={feature.id} inView y={14} delay={i * 0.04}>
                <article className="flex h-full flex-col rounded-2xl border border-border/70 bg-card/90 p-4 sm:p-5 dark:bg-[#060a14]/75">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00a5fd]/10 ring-1 ring-inset ring-[#00a5fd]/20">
                      <Icon className="h-4 w-4 text-[#0088d4] dark:text-[#33bbfd]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[15px] font-bold leading-snug text-pretty sm:text-base">
                        {feature.title}
                      </h3>
                      <p className="mt-1 text-[12px] leading-snug text-pretty text-muted-foreground">
                        <span className="font-semibold tabular-nums text-[#0088d4] dark:text-[#33bbfd]">
                          {feature.stat}
                        </span>
                        {" "}
                        {feature.statLabel}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-[13px] leading-relaxed text-pretty text-muted-foreground">
                    {feature.seo}
                  </p>

                  <ul className="mt-3 space-y-1.5">
                    {feature.includes.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#00a5fd]" />
                        <span className="text-[13px] leading-snug text-pretty text-foreground/85">{item}</span>
                      </li>
                    ))}
                  </ul>

                  <p className="mt-4 border-t border-border/50 pt-3 text-[12px] leading-snug text-pretty text-foreground/75">
                    <span className="font-semibold text-foreground/90">{t("what_we_check_real_example")}: </span>
                    {feature.example}
                  </p>
                </article>
              </EnterReveal>
            );
          })}
        </div>

        <p className="mx-auto mt-5 max-w-lg text-center text-[12px] leading-relaxed text-pretty text-muted-foreground/75">
          {t("country_dossier_footnote")}
        </p>
      </div>
    </section>
  );
}
