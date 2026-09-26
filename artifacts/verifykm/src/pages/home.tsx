import { useState, useEffect, useMemo, Suspense } from "react";
import { useTranslation } from "@/i18n/context";
import { Button } from "@/components/ui/button";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useDisplayPrice } from "@/hooks/use-display-price";
import {
  ShieldCheck, Search, FileText,
  ArrowRight, Zap, RotateCcw,
} from "lucide-react";
import { HomeStatsStrip } from "@/components/home-stats-strip";
import { DeferredSection } from "@/components/deferred-section";
import { SectionFallback } from "@/components/section-fallback";
import { Badge } from "@/components/ui/badge";
import { EnterReveal } from "@/components/enter-reveal";
import { SEOHead, usePageSeo, organizationJsonLd } from "@/components/seo";
import { redirectGuestForVinCheckout, persistVinForCheckout, clearStoredPendingVin } from "@/lib/checkout-vin-flow";
import { HeroVinForm } from "@/components/hero-vin-form";
import { HeroReportPreview } from "@/components/hero-report-preview";
import { prefetchFlags } from "@/components/flag-img";
import { useVinLookupDisabledForUser } from "@/hooks/use-site-public-flags";
import { useLightMotion } from "@/hooks/use-light-motion";
import { lazyWithRetry } from "@/lib/lazy-with-retry";
import { cn } from "@/lib/utils";
import { pathFor } from "@/lib/localized-routes";

const CompareTable = lazyWithRetry(() =>
  import("@/components/compare-table").then((m) => ({ default: m.CompareTable })),
);
const WhatWeCheckSection = lazyWithRetry(() =>
  import("@/components/what-we-check-section").then((m) => ({ default: m.WhatWeCheckSection })),
);
const HomepageTestimonials = lazyWithRetry(() => import("@/components/homepage-testimonials"));
const HomeCountriesCoverageSection = lazyWithRetry(() =>
  import("@/components/home-countries-coverage-section").then((m) => ({
    default: m.HomeCountriesCoverageSection,
  })),
);

function useSteps(t: (k: string) => string) {
  return [
    { n: "01", title: t("step_1_title"), desc: t("step_1_desc"), icon: Search },
    { n: "02", title: t("step_2_title"), desc: t("step_2_desc"), icon: ShieldCheck },
    { n: "03", title: t("step_3_title"), desc: t("step_3_desc"), icon: FileText },
  ];
}

export default function Home() {
  const { t, language } = useTranslation();
  const [, setLocation] = useLocation();
  const { isSignedIn, user } = useAuth();
  const [vin, setVin] = useState(() => {
    if (typeof window === "undefined") return "";
    const urlVin = new URLSearchParams(window.location.search).get("vin");
    if (!urlVin) return "";
    const cleaned = urlVin.trim().toUpperCase().replace(/[\s-]/g, "");
    return cleaned;
  });
  const { displayPrice, basePrice: pricingBase, isDiscount, fmtPrice } = useDisplayPrice();

  const STEPS = useSteps(t);

  const vinLookupDisabled = useVinLookupDisabledForUser(user?.isAdmin);
  const lightMotion = useLightMotion();
  // Phones: don't preload several heavy chunks while still scrolling the hero.
  const deferNear = lightMotion ? "100px 0px" : "480px 0px";
  const deferMid = lightMotion ? "120px 0px" : "400px 0px";
  const deferFar = lightMotion ? "140px 0px" : "280px 0px";

  useEffect(() => {
    prefetchFlags(["ca", "us", "kr", "cn", "ae", "jp"]);
  }, []);

  useEffect(() => {
    if (window.location.hash !== "#check-vin") return;
    const el = document.getElementById("check-vin");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.querySelector("input")?.focus();
  }, []);

  const handleCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (vinLookupDisabled) return;
    const v = vin.trim().toUpperCase().replace(/[\s-]/g, "");
    if (!isSignedIn) {
      const authPath = redirectGuestForVinCheckout(v, language);
      if (authPath) setLocation(authPath);
      return;
    }
    // Always pass ?vin= so checkout replaces any previously stored VIN
    const normalized = persistVinForCheckout(v);
    if (!normalized) {
      clearStoredPendingVin();
    }
    setLocation(pathFor(language, "checkout", { query: `vin=${encodeURIComponent(normalized || v)}` }));
  };

  const seo = usePageSeo("home");
  const orgJsonLd = useMemo(
    () => organizationJsonLd(
      typeof window !== "undefined" ? window.location.origin : "https://verifykm.com",
      seo.description,
    ),
    [seo.description],
  );

  /** Visual only — shrink long H1s (e.g. Albanian) so mobile stays ~3 lines; EN unchanged. */
  const compactHeroH1 = useMemo(() => {
    if (language === "zh") return false;
    const line1 = `${t("hero_headline_lead")} ${t("hero_headline_tail")}`;
    return line1.length + t("hero_headline_2").length >= 52;
  }, [language, t]);

  return (
    <div className="flex flex-col">
      <SEOHead
        title={seo.title}
        description={seo.description}
        lang={seo.lang}
        canonicalPath={seo.canonicalPath}
        ogImage={seo.ogImage}
        ogImageAlt={seo.ogImageAlt}
        jsonLd={orgJsonLd}
      />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-white px-4 pb-10 pt-9 text-slate-950 md:pb-14 md:pt-12 lg:pt-14">
        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(23rem,27rem)] lg:items-center lg:gap-14">
          <EnterReveal y={12} className="relative text-center lg:self-center lg:translate-y-8 lg:text-left">
            <span
              aria-hidden
              className="pointer-events-none absolute -left-3 -top-10 hidden select-none font-black uppercase leading-none tracking-[-0.08em] text-[#00a5fd]/[0.09] lg:block"
              style={{ fontSize: compactHeroH1 ? "6.4rem" : "7.4rem" }}
            >
              {t("hero_headline_lead")}
            </span>
            <h1
              className={cn(
                "relative font-extrabold tracking-[-0.055em] text-slate-950",
                compactHeroH1
                  ? "text-[2.55rem] leading-[0.98] sm:text-[3.05rem] lg:text-[3.55rem]"
                  : "text-[2.9rem] leading-[0.92] sm:text-[3.55rem] lg:text-[4.45rem]",
              )}
            >
              {language === "zh" ? (
                <>
                  {t("hero_headline_lead")}
                  <span className="text-[#0077c8]">{t("hero_headline_2")}</span>
                </>
              ) : (
                <>
                  <span className="block">
                    {t("hero_headline_lead")} {t("hero_headline_tail")}
                  </span>
                  <span className="relative mt-1.5 inline-block text-[#073454]">
                    <span aria-hidden className="absolute inset-x-[-0.08em] bottom-[-0.06em] -z-10 h-[0.26em] bg-[#8fd8fe]" />
                    <span className="relative">{t("hero_headline_2")}</span>
                  </span>
                </>
              )}
            </h1>
            <p className="relative mx-auto mt-5 max-w-lg text-[1.05rem] leading-relaxed text-slate-600 sm:text-lg lg:mx-0 lg:max-w-[34rem]">
              {t("hero_subtext")}
            </p>
            <div id="check-vin" className="relative mt-7">
              <HeroVinForm
                vin={vin}
                onVinChange={setVin}
                onSubmit={handleCheck}
                disabled={vinLookupDisabled}
                placeholder={language === "sq" ? t("vin_placeholder_chassis") : t("vin_placeholder")}
                className="mx-auto w-full max-w-xl lg:mx-0 lg:max-w-none"
                layout="home"
              />
            </div>
          </EnterReveal>

          <HeroReportPreview className="mx-auto w-full max-w-md lg:mx-0 lg:max-w-none" />
        </div>

        <div className="relative z-10 mx-auto mt-14 hidden max-w-6xl lg:mt-20 lg:block">
          <HomeStatsStrip />
        </div>
      </section>

      <DeferredSection minHeight={160} rootMargin={deferNear}>
        <Suspense fallback={<SectionFallback minHeight={160} />}>
          <WhatWeCheckSection autoRotate className="pt-12 md:pt-16 lg:pt-20 pb-12 md:pb-20" />
        </Suspense>
      </DeferredSection>

      {/* ── HOW IT WORKS ── */}
      <section className="relative overflow-hidden border-y border-[#00a5fd]/15 bg-[#f4f8fc] px-4 py-14 dark:bg-[#070d16] md:py-20">
        <div className="relative mx-auto max-w-6xl">
          <EnterReveal inView y={12} className="mb-8 max-w-xl space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#0088d4]">
              {t("home_badge_3_steps")}
            </p>
            <h2 className="text-3xl font-extrabold md:text-4xl">{t("how_it_works")}</h2>
            <p className="text-base text-muted-foreground">{t("how_it_works_desc")}</p>
          </EnterReveal>
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map(({ n, title, desc, icon: StepIcon }, i) => (
              <li key={n} className="relative rounded-3xl border border-[#00a5fd]/15 bg-background p-5 shadow-[0_16px_40px_-30px_rgba(0,165,253,0.5)]">
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00a5fd] to-[#0077c8] text-white shadow-[0_10px_24px_-12px_rgba(0,165,253,0.9)]">
                    <StepIcon className="h-5 w-5" />
                  </span>
                  <span className="text-2xl font-black text-[#00a5fd]/25">{n}</span>
                </div>
                <h3 className="text-lg font-bold tracking-tight">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
                {i < STEPS.length - 1 ? (
                  <span className="pointer-events-none absolute -right-3 top-1/2 hidden h-px w-6 bg-[#00a5fd]/40 md:block" />
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <DeferredSection minHeight={360} rootMargin={deferMid}>
        <Suspense fallback={<SectionFallback minHeight={360} />}>
          <HomeCountriesCoverageSection />
        </Suspense>
      </DeferredSection>

      {/* ── TESTIMONIALS ── */}
      <DeferredSection minHeight={420} rootMargin={deferFar}>
        <Suspense fallback={<SectionFallback minHeight={420} />}>
          <HomepageTestimonials />
        </Suspense>
      </DeferredSection>

      {/* ── COMPARISON TABLE ── */}
      <DeferredSection minHeight={280} rootMargin={deferFar}>
        <Suspense fallback={<SectionFallback minHeight={280} />}>
          <CompareTable market="home" />
        </Suspense>
      </DeferredSection>

      {/* ── BOTTOM CTA ── */}
      <section className="relative overflow-hidden bg-[#071018] px-4 py-16 md:py-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_100%,rgba(0,165,253,0.28),transparent_62%)]" />
        <div className="relative mx-auto max-w-3xl text-center">
          <EnterReveal inView y={16} className="space-y-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7dd3fc]">
              {t("pricing_hero_eyebrow")}
            </p>
            <h2 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">
              {t("cta_title")}
            </h2>
            <p className="mx-auto max-w-lg text-base leading-relaxed text-[#e7eef6]">
              {t("cta_desc")}
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <div className="flex items-end justify-center gap-2">
                {isDiscount ? (
                  <Badge className="mb-2 border-0 bg-orange-500 text-white">{t("limited_time")}</Badge>
                ) : null}
                <span className="text-5xl font-black tabular-nums leading-none text-white">
                  {displayPrice != null ? fmtPrice(displayPrice) : "—"}
                </span>
                {isDiscount ? (
                  <span className="pb-1 text-base text-[#d7e4f2] line-through tabular-nums">
                    {pricingBase != null ? fmtPrice(pricingBase) : null}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 rounded-full px-6 text-base font-bold vk-cta-pulse">
                <Link href={pathFor(language, "pricing")}>
                  {t("get_started")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-white/20 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white"
              >
                <Link href={pathFor(language, "pricing")}>{t("see_whats_included")}</Link>
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-1">
              {[
                { icon: Zap, label: t("trust_instant_report") },
                { icon: RotateCcw, label: t("trust_money_back") },
              ].map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-1.5 text-sm text-[#e7eef6]">
                  <Icon className="h-4 w-4 text-[#7dd3fc]" />
                  {label}
                </span>
              ))}
            </div>
          </EnterReveal>
        </div>
      </section>
    </div>
  );
}
