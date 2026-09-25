import { Check } from "lucide-react";
import { EnterReveal } from "@/components/enter-reveal";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/context";
import {
  useWhatWeCheckFeatures,
  whatWeCheckSubtitle,
  type WhatWeCheckMarket,
} from "@/lib/what-we-check-features";

type Props = {
  subtitle?: string;
  market?: WhatWeCheckMarket;
  /** Kept so existing call sites compile; homepage no longer auto-rotates a preview card. */
  autoRotate?: boolean;
  className?: string;
};

/**
 * Four checks as a card grid. Country pages and the homepage share this layout.
 */
export function WhatWeCheckSection({ subtitle, market, className }: Props) {
  const { t } = useTranslation();
  const features = useWhatWeCheckFeatures(t, market);
  const sectionSubtitle = whatWeCheckSubtitle(t, market, subtitle);

  return (
    <section className={cn("relative overflow-hidden bg-background px-4 py-14 md:py-20", className)}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_0%_0%,rgba(0,165,253,0.08),transparent_60%)]" />
      <div className="relative mx-auto max-w-6xl">
        <EnterReveal inView y={12} className="mb-8 max-w-2xl space-y-3 md:mb-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#0088d4]">
            {t("home_badge_most_checked")}
          </p>
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">{t("what_we_check")}</h2>
          <p className="text-base leading-relaxed text-muted-foreground">{sectionSubtitle}</p>
        </EnterReveal>

        <div className="grid gap-4 md:grid-cols-2">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <EnterReveal key={feature.id} inView y={16} delay={index * 0.05}>
                <article className="group relative h-full overflow-hidden rounded-3xl border border-[#00a5fd]/20 bg-card p-5 shadow-[0_18px_50px_-32px_rgba(0,165,253,0.55)] transition-transform duration-300 hover:-translate-y-0.5 md:p-6">
                  <div className="relative flex items-start gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00a5fd] to-[#0077c8] text-white shadow-[0_10px_24px_-12px_rgba(0,165,253,0.9)]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <h3 className="text-lg font-bold tracking-tight">{feature.title}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">{feature.desc}</p>
                      {feature.stat ? (
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0088d4] dark:text-[#33bbfd]">
                          {feature.stat}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 font-mono text-sm font-black tabular-nums leading-none text-[#0088d4] dark:text-[#7dd3fc]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <ul className="relative mt-5 grid gap-2 sm:grid-cols-2">
                    {feature.includes.slice(0, 4).map((item) => (
                      <li key={item} className="flex items-start gap-2 rounded-xl bg-[#00a5fd]/[0.06] px-3 py-2 text-sm text-foreground/85">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#00a5fd]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </EnterReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
