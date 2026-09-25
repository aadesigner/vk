import { useTranslation } from "@/i18n/context";
import { pathFor } from "@/lib/localized-routes";
import type { Language } from "@/lib/languages";
import { useDisplayPrice } from "@/hooks/use-display-price";
import { useIndicativeLocalPrice } from "@/hooks/use-indicative-local-price";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { useState, useMemo, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2, RotateCcw, Coins,
} from "lucide-react";
import { EnterReveal } from "@/components/enter-reveal";
import { SEOHead, usePageSeo, productOfferJsonLd } from "@/components/seo";
import { SITE_ORIGIN } from "@/lib/seo-config";
import { DEFAULT_PRICING } from "@/lib/pricing-defaults";
import { getTestimonials } from "@/data/testimonials";
import { TestimonialsSlider } from "@/components/testimonials-slider";
import { HeroVinForm } from "@/components/hero-vin-form";
import { AUTH_RETURN_PATH_KEY, redirectGuestForVinCheckout } from "@/lib/checkout-vin-flow";
import { CREDIT_PACKS, rememberCreditPack, type CreditPackId } from "@/lib/creditPacks";
import { cn } from "@/lib/utils";
import { SiteFaqAccordion } from "@/components/site-faq-accordion";

const CARD_FEATURES = [
  "full_vehicle_history",
  "pricing_feature_accidents",
  "mileage_verification",
  "theft_records",
  "photos_available",
  "auction_history",
] as const;

const SEO_INCLUDED = [
  { feature: "full_vehicle_history", desc: "desc_vehicle_history" },
  { feature: "pricing_feature_accidents", desc: "desc_accident_records" },
  { feature: "mileage_verification", desc: "desc_mileage_verification" },
  { feature: "theft_records", desc: "desc_theft_records" },
  { feature: "auction_history", desc: "desc_auction_history" },
  { feature: "technical_specs", desc: "desc_technical_specs" },
] as const;

const SEO_VALUE_PROPS = [
  { titleKey: "pricing_seo_value_pay_title", descKey: "pricing_seo_value_pay_desc" },
  { titleKey: "pricing_seo_value_account_title", descKey: "pricing_seo_value_account_desc" },
  { titleKey: "pricing_seo_value_delivery_title", descKey: "pricing_seo_value_delivery_desc" },
] as const;

function PricingHeroPrice({
  amount,
  baseAmount,
  currencySymbol,
  currency,
  language,
  loading,
  showDiscount,
}: {
  amount: number;
  baseAmount: number | null;
  currencySymbol: string;
  currency: string;
  language: Language;
  loading: boolean;
  showDiscount: boolean;
}) {
  const listEur = showDiscount && baseAmount != null && baseAmount > amount ? baseAmount : null;
  const local = useIndicativeLocalPrice(language, currency, amount, listEur);
  const [whole, fraction] = amount.toFixed(2).split(".");

  if (loading) {
    return <Skeleton className="h-12 w-32 rounded-md" />;
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-2 font-mono tabular-nums leading-none">
        <div className="inline-flex items-end leading-none">
          <span className="pb-1 pe-0.5 text-lg font-semibold text-muted-foreground sm:text-xl">
            {currencySymbol}
          </span>
          <span className="text-[2.85rem] font-bold tracking-tight text-foreground sm:text-[3.15rem]">
            {whole}
          </span>
          <span className="pb-1 ps-0.5 text-lg font-bold text-foreground/70 sm:text-xl">
            .{fraction}
          </span>
        </div>
        {listEur != null && (
          <span className="pb-1.5 text-base font-medium text-muted-foreground/60 line-through">
            {currencySymbol}
            {listEur.toFixed(2)}
          </span>
        )}
      </div>
      {local ? (
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-sm font-medium tabular-nums text-muted-foreground">
          <span>≈ {local.sale}</span>
          {local.list ? (
            <span className="text-muted-foreground/60 line-through">≈ {local.list}</span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

function FeatureGrid({ items }: { items: { key: string; label: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
      {items.map(({ key, label }) => (
        <div key={key} className="flex items-start gap-1.5 min-w-0">
          <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary shrink-0 mt-0.5" />
          <span className="text-[11px] sm:text-sm font-medium leading-snug">{label}</span>
        </div>
      ))}
    </div>
  );
}

export default function Pricing() {
  const { t, language } = useTranslation();
  const {
    displayPrice: rawDisplayPrice,
    basePrice,
    isDiscount: discountEnabled,
    loading: priceLoading,
    currencySymbol,
    currency,
  } = useDisplayPrice();
  const { isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  const [vin, setVin] = useState("");
  const [vinError, setVinError] = useState("");
  const [selectedPack, setSelectedPack] = useState<CreditPackId>("pack3");

  const TESTIMONIALS = useMemo(() => getTestimonials(language), [language]);
  const displayPrice =
    rawDisplayPrice ??
    (discountEnabled ? DEFAULT_PRICING.discountPrice : DEFAULT_PRICING.basePrice);
  const savePct =
    discountEnabled && basePrice
      ? Math.round(((basePrice - displayPrice) / basePrice) * 100)
      : 0;

  const handleGetReport = (e?: FormEvent) => {
    e?.preventDefault();
    const normalized = vin.trim().toUpperCase();
    if (!normalized) {
      setVinError(t("vin_error_required"));
      return;
    }
    if (normalized.length !== 17) {
      setVinError(t("vin_error_length"));
      return;
    }
    setVinError("");
    if (!isSignedIn) {
      const authPath = redirectGuestForVinCheckout(normalized, language);
      if (authPath) setLocation(authPath);
      return;
    }
    sessionStorage.setItem("checkout_vin", normalized);
    setLocation(pathFor(language, "checkout"));
  };

  const handleBuyCredits = (packId: CreditPackId) => {
    rememberCreditPack(packId);
    const path = pathFor(language, "credits_checkout", { query: `pack=${packId}` });
    if (!isSignedIn) {
      sessionStorage.setItem(AUTH_RETURN_PATH_KEY, path);
      setLocation(pathFor(language, "sign_up"));
      return;
    }
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    window.location.assign(`${base}${path}`);
  };

  const faqs = [
    { q: t("faq_1_q"), a: t("faq_1_a") },
    { q: t("faq_2_q"), a: t("faq_2_a") },
    { q: t("faq_3_q"), a: t("faq_3_a") },
  ];

  const seo = usePageSeo("pricing");
  const selectedPackData = CREDIT_PACKS[selectedPack];

  const pricingJsonLd = useMemo(() => {
    const price = rawDisplayPrice ?? (discountEnabled ? DEFAULT_PRICING.discountPrice : DEFAULT_PRICING.basePrice);
    return productOfferJsonLd({
      name: t("pricing_seo_product_name"),
      description: seo.description,
      url: `${SITE_ORIGIN}${pathFor(language, "pricing")}`,
      price,
      currency,
    });
  }, [rawDisplayPrice, discountEnabled, t, seo.description, language, currency]);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={seo.title}
        description={seo.description}
        lang={seo.lang}
        canonicalPath={seo.canonicalPath}
        jsonLd={pricingJsonLd}
      />

      {/* Hero — split layout + premium card */}
      <section className="relative overflow-hidden border-b border-border/60 -mt-[var(--site-header-offset,76px)] pt-[calc(2.5rem+var(--site-header-offset,76px))] pb-10 sm:pt-[calc(3rem+var(--site-header-offset,76px))] sm:pb-12 md:pt-[calc(4rem+var(--site-header-offset,76px))] md:pb-16 lg:pt-[calc(5rem+var(--site-header-offset,76px))] lg:pb-20">
        <div className="absolute inset-0 bg-gradient-to-b from-sky-50/80 via-blue-50/25 to-background dark:hidden" />
        <div className="absolute inset-0 hidden dark:block bg-[#060a14]" />
        <div className="absolute inset-0 bg-[radial-gradient(#00a5fd_1px,transparent_1px)] [background-size:28px_28px] opacity-[0.06] dark:opacity-[0.18]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_15%_-5%,rgba(0,165,253,0.16),transparent)] dark:bg-[radial-gradient(ellipse_75%_55%_at_15%_-5%,rgba(0,165,253,0.28),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_45%_at_95%_20%,rgba(0,165,253,0.10),transparent)] dark:bg-[radial-gradient(ellipse_50%_45%_at_95%_20%,rgba(0,165,253,0.20),transparent)]" />
        <div
          aria-hidden
          className="hero-orb-a pointer-events-none absolute -top-10 left-[5%] h-48 w-48 rounded-full bg-primary/10 blur-3xl"
        />
        <div
          aria-hidden
          className="hero-orb-b pointer-events-none absolute top-24 right-[8%] h-40 w-40 rounded-full bg-[#00a5fd]/10 blur-3xl hidden sm:block"
        />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <EnterReveal y={16} className="mx-auto mb-8 max-w-2xl space-y-3 text-center sm:mb-10">
            <h1 className="text-[2.4rem] font-black leading-[1.1] tracking-tight sm:text-[3rem] lg:text-[3.35rem]">
              {t("pricing_hero_title_1")}{" "}
              <span className="bg-gradient-to-r from-[#33bbfd] to-[#00a5fd] bg-clip-text text-transparent">
                {t("pricing_hero_title_2")}
              </span>
            </h1>
            <p className="text-base text-muted-foreground sm:text-lg">
              {t("pricing_subtitle")}
            </p>
          </EnterReveal>

          <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] lg:items-start">
            <EnterReveal y={14}>
              <div className="overflow-hidden rounded-3xl border border-[#00a5fd]/25 bg-card shadow-[0_24px_60px_-36px_rgba(0,165,253,0.55)]">
                <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4 sm:px-6">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{t("pricing_line_single")}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t("pricing_hero_account")}</p>
                  </div>
                  {discountEnabled && savePct > 0 && (
                    <span className="shrink-0 rounded-full bg-orange-500 px-2.5 py-1 text-[11px] font-bold text-white">
                      {t("pricing_save").replace("{n}", String(savePct))}
                    </span>
                  )}
                </div>

                <div className="space-y-5 px-5 py-5 sm:px-6">
                  <PricingHeroPrice
                    amount={displayPrice}
                    baseAmount={discountEnabled ? (basePrice ?? null) : null}
                    currencySymbol={currencySymbol}
                    currency={currency}
                    language={language}
                    loading={priceLoading}
                    showDiscount={discountEnabled}
                  />
                  <FeatureGrid items={CARD_FEATURES.map((key) => ({ key, label: t(key) }))} />
                  <HeroVinForm
                    vin={vin}
                    onVinChange={(v) => {
                      setVin(v);
                      setVinError("");
                    }}
                    onSubmit={handleGetReport}
                    error={vinError}
                    placeholder={t("vin_placeholder")}
                    submitLabelKey="check_vin_short"
                    showHelp={false}
                    className="max-w-none mx-0 [&_.hero-vin-field]:rounded-2xl [&_input]:h-12 [&_input]:text-sm [&_button]:h-10 [&_button]:px-3 [&_button]:text-xs"
                  />
                </div>
              </div>
            </EnterReveal>

            <EnterReveal y={14} delay={0.06}>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 text-slate-950 sm:p-6">
                <div className="mb-4 space-y-1">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Coins className="h-4 w-4 text-[#0088d4]" />
                    {t("pricing_packs_section")}
                  </p>
                  <p className="text-sm text-slate-500">{t("pricing_packs_section_lead")}</p>
                </div>

                <div className="space-y-2" role="radiogroup" aria-label={t("pricing_packs_section")}>
                  {(["pack3", "pack5"] as const).map((id) => {
                    const active = selectedPack === id;
                    const option = CREDIT_PACKS[id];
                    return (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setSelectedPack(id)}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                          "outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                          active
                            ? "border-[#00a5fd]/50 bg-white shadow-sm ring-1 ring-inset ring-[#00a5fd]/30"
                            : "border-slate-200 bg-white hover:border-[#00a5fd]/40",
                        )}
                      >
                        <span>
                          <span className="block text-sm font-semibold text-slate-950">{t(`pricing_plan_${id}_title`)}</span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {t("pricing_line_each")} {currencySymbol}{option.unitPrice.toFixed(2)}
                          </span>
                        </span>
                        <span className="text-right">
                          {id === "pack3" ? (
                            <span className="mb-1 block text-[11px] font-semibold text-[#0088d4]">{t("pricing_best_value")}</span>
                          ) : null}
                          {(() => {
                            const listUnit = discountEnabled
                              ? (basePrice ?? DEFAULT_PRICING.basePrice)
                              : displayPrice;
                            const fullTotal = Math.round(listUnit * option.credits * 100) / 100;
                            const showFull = fullTotal > option.totalPrice + 0.009;
                            return (
                              <span className="flex items-baseline justify-end gap-1.5">
                                {showFull ? (
                                  <span className="text-xs font-medium tabular-nums text-slate-400 line-through">
                                    {currencySymbol}{fullTotal.toFixed(2)}
                                  </span>
                                ) : null}
                                <span className="text-lg font-bold tabular-nums text-slate-950">
                                  {currencySymbol}{option.totalPrice.toFixed(2)}
                                </span>
                              </span>
                            );
                          })()}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <p className="mt-4 text-sm text-slate-500">
                  {t("pricing_plan_reports_included").replace("{n}", String(selectedPackData.credits))}
                  {" "}
                  {t("pricing_credits_never_expire")}
                </p>
                <Button
                  className="mt-4 h-11 w-full rounded-full text-sm font-bold"
                  onClick={() => handleBuyCredits(selectedPack)}
                >
                  {t("pricing_buy_pack").replace("{n}", String(selectedPackData.credits))}
                </Button>
              </div>
            </EnterReveal>
          </div>

          <p className="mt-6 inline-flex w-full items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground sm:text-xs">
            <RotateCcw className="h-3.5 w-3.5 text-primary shrink-0" />
            {t("money_back")}
          </p>
        </div>
      </section>

      {/* What's included */}
      <section className="border-b border-slate-200 bg-[#f7fafc] px-4 py-14 md:py-20">
        <div className="mx-auto max-w-5xl">
          <EnterReveal inView y={12} className="max-w-xl border-l-[3px] border-[#00a5fd] pl-5 text-left">
            <h2 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-[2.4rem]">
              {t("pricing_seo_title")}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-slate-600">
              {t("pricing_seo_sub")}
            </p>
          </EnterReveal>

          <ul className="mt-10 grid gap-3 sm:grid-cols-2">
            {SEO_INCLUDED.map(({ feature, desc }, i) => (
              <li
                key={feature}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:px-5"
              >
                <p className="font-mono text-[11px] font-bold text-[#0088d4]">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-1.5 text-sm font-semibold text-slate-950">{t(feature)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{t(desc)}</p>
              </li>
            ))}
          </ul>

          <ul className="mt-8 grid gap-6 text-center sm:grid-cols-3">
            {SEO_VALUE_PROPS.map(({ titleKey, descKey }) => (
              <li key={titleKey}>
                <h3 className="text-sm font-semibold text-slate-950">{t(titleKey)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{t(descKey)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <TestimonialsSlider testimonials={TESTIMONIALS} className="bg-muted/40 border-y" />

      {/* FAQ */}
      <section className="px-4 py-14 md:py-16 bg-muted/25 border-t border-border/60">
        <div className="max-w-2xl mx-auto">
          <h2 className="mb-6 text-2xl font-extrabold tracking-tight sm:text-3xl">{t("faq")}</h2>
          <SiteFaqAccordion items={faqs} />
        </div>
      </section>
    </div>
  );
}
