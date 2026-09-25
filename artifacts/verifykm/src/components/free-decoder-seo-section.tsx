import { useMemo } from "react";
import { pathFor } from "@/lib/localized-routes";
import { Link } from "wouter";
import { useTranslation } from "@/i18n/context";
import { useDisplayPrice } from "@/hooks/use-display-price";
import { motion } from "framer-motion";
import {
  Search, Factory, Settings2, ShieldCheck, ChevronRight,
  Sparkles, Hash, Layers, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFaqAccordion } from "@/components/site-faq-accordion";
import { cn } from "@/lib/utils";
import {
  FREE_DECODER_BRAND_CARDS,
  FREE_DECODER_FAQ_COUNT,
  FREE_DECODER_STEPS,
} from "@/lib/free-decoder-brands";

const STEP_ICONS = {
  search: Search,
  factory: Factory,
  settings: Settings2,
  shield: ShieldCheck,
} as const;

type Props = {
  onTryVin: (vin: string) => void;
  onUnlock?: () => void;
};

export function FreeDecoderSeoSection({ onTryVin, onUnlock }: Props) {
  const { t, language } = useTranslation();
  const { fmtPrice, displayPrice } = useDisplayPrice();
  const priceLabel = displayPrice != null ? fmtPrice(displayPrice) : "…";

  const faqs = useMemo(
    () =>
      Array.from({ length: FREE_DECODER_FAQ_COUNT }, (_, i) => ({
        q: t(`free_decoder_faq_${i}_q`),
        a: t(`free_decoder_faq_${i}_a`),
      })),
    [t],
  );

  return (
    <div className="space-y-16 md:space-y-20">
      {/* Intro */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        className="text-center max-w-3xl mx-auto space-y-4"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3.5 py-1 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          {t("free_decoder_seo_badge")}
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">
          {t("free_decoder_seo_title")}
        </h2>
        <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
          {t("free_decoder_seo_sub")}
        </p>
      </motion.div>

      {/* How it works */}
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h3 className="text-xl md:text-2xl font-bold">{t("free_decoder_seo_how_title")}</h3>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">{t("free_decoder_seo_how_sub")}</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FREE_DECODER_STEPS.map(({ icon, key }, i) => {
            const Icon = STEP_ICONS[icon];
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="rounded-2xl border border-border/70 bg-card/80 p-5 space-y-3 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Icon className="h-5 w-5 text-primary/80" />
                </div>
                <p className="text-sm font-semibold leading-snug">{t(`${key}_title`)}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{t(`${key}_desc`)}</p>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Brand decoders */}
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h3 className="text-xl md:text-2xl font-bold">{t("free_decoder_seo_brands_title")}</h3>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">{t("free_decoder_seo_brands_sub")}</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FREE_DECODER_BRAND_CARDS.map((brand, i) => (
            <motion.button
              key={brand.id}
              type="button"
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              onClick={() => onTryVin(brand.sampleVin)}
              className={cn(
                "group text-left rounded-2xl border bg-card p-5 space-y-3 transition-all",
                "hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                brand.ring,
                "hover:border-primary/35",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className={cn(
                    "h-11 w-11 rounded-xl flex items-center justify-center font-black text-sm uppercase tracking-tight",
                    brand.bg,
                    brand.text,
                  )}
                >
                  {t(`free_decoder_brand_${brand.id}_short`)}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
              </div>
              <div className="space-y-1.5">
                <p className="font-bold text-sm leading-snug">{t(`free_decoder_brand_${brand.id}_title`)}</p>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                  {t(`free_decoder_brand_${brand.id}_desc`)}
                </p>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground/80 tracking-wider pt-1 border-t border-border/50">
                {brand.sampleVin.slice(0, 11)}…
              </p>
            </motion.button>
          ))}
        </div>
      </div>

      {/* VIN structure */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="rounded-2xl border border-border/70 bg-muted/30 dark:bg-white/[0.03] p-6 md:p-8 space-y-6"
      >
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          <div className="flex-1 space-y-3">
            <div className="inline-flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-widest">
              <Hash className="h-3.5 w-3.5" />
              {t("free_decoder_seo_vin_badge")}
            </div>
            <h3 className="text-lg md:text-xl font-bold">{t("free_decoder_seo_vin_title")}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{t("free_decoder_seo_vin_desc")}</p>
          </div>
          <div className="flex flex-wrap gap-2 md:max-w-md shrink-0">
            {[
              { label: "WMI", descKey: "free_decoder_seo_vin_wmi" },
              { label: "VDS", descKey: "free_decoder_seo_vin_vds" },
              { label: "VIS", descKey: "free_decoder_seo_vin_vis" },
            ].map(({ label, descKey }) => (
              <div
                key={label}
                className="rounded-xl border border-border/60 bg-background px-4 py-3 min-w-[7rem] flex-1"
              >
                <p className="font-mono font-bold text-primary text-sm">{label}</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{t(descKey)}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs sm:text-sm tracking-[0.2em] justify-center flex-wrap text-center">
          <span className="rounded-lg bg-primary/15 text-primary px-2 py-1 font-bold">WBA</span>
          <span className="text-muted-foreground">·</span>
          <span className="rounded-lg bg-muted px-2 py-1 text-foreground/80">3V7106F</span>
          <span className="text-muted-foreground">·</span>
          <span className="rounded-lg bg-muted px-2 py-1 text-foreground/80">J995387</span>
        </div>
      </motion.div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-widest">
            <Layers className="h-3.5 w-3.5" />
            {t("free_decoder_seo_faq_badge")}
          </div>
          <h3 className="text-xl md:text-2xl font-bold">{t("free_decoder_seo_faq_title")}</h3>
        </div>
        <SiteFaqAccordion idPrefix="decoder" items={faqs} />
      </div>

      {/* Bottom CTA */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="rounded-2xl bg-gradient-to-br from-[hsl(217,80%,28%)] via-primary to-[hsl(199,76%,32%)] p-7 md:p-9 overflow-hidden relative"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_80%_30%,rgba(255,255,255,0.1),transparent)]" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="space-y-2 max-w-lg">
            <h3 className="text-xl md:text-2xl font-bold text-white">{t("free_decoder_seo_cta_title")}</h3>
            <p className="text-white/65 text-sm leading-relaxed">{t("free_decoder_seo_cta_desc")}</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            {onUnlock ? (
              <Button
                type="button"
                size="lg"
                className="bg-white text-primary hover:bg-white/90 font-bold h-12 px-8 rounded-xl shadow-xl"
                onClick={onUnlock}
              >
                {t("free_decoder_unlock_btn")} — {priceLabel}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                asChild
                size="lg"
                className="bg-white text-primary hover:bg-white/90 font-bold h-12 px-8 rounded-xl shadow-xl"
              >
                <Link href={pathFor(language, "pricing")}>
                  {t("free_decoder_seo_cta_btn")}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
