import { useRef, useState, useEffect, useMemo, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { decodeVinLocalFree } from "@workspace/vin-decode";
import { useTranslation } from "@/i18n/context";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useDisplayPrice } from "@/hooks/use-display-price";
import { DEFAULT_PRICING } from "@/lib/pricing-defaults";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SiteFaqAccordion } from "@/components/site-faq-accordion";
import {
  ShieldCheck,
  Zap, ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { EnterReveal } from "@/components/enter-reveal";
import { useLightMotion } from "@/hooks/use-light-motion";
import { SEOHead, usePageSeo } from "@/components/seo";
import { DeferredSection } from "@/components/deferred-section";
import { SectionFallback } from "@/components/section-fallback";
import { getVinValidationErrorKey } from "@/lib/vin-validation";
import { redirectGuestForVinCheckout } from "@/lib/checkout-vin-flow";
import { isTrustworthyVinDecode, shouldShowPendingVinDoubleCheck } from "@/lib/vin-decode-preview";
import { FlagImg } from "@/components/flag-img";
import { formatImageFlagAlt } from "@/lib/flag-alt";
import { HeroVinForm } from "@/components/hero-vin-form";
import { VinDecodeRecheckHint } from "@/components/vin-decode-recheck-hint";
import { VinPendingDoubleCheckHint } from "@/components/vin-pending-double-check-hint";
import { useVinLookupDisabledForUser } from "@/hooks/use-site-public-flags";
import { lazyWithRetry } from "@/lib/lazy-with-retry";
import { pathFor, pathForCountry } from "@/lib/localized-routes";
import { HeroReportPreview } from "@/components/hero-report-preview";

const CompareTable = lazyWithRetry(() =>
  import("@/components/compare-table").then((m) => ({ default: m.CompareTable })),
);
const CountryCheckDossier = lazyWithRetry(() =>
  import("@/components/country-check-dossier").then((m) => ({ default: m.CountryCheckDossier })),
);
const CountryRisksIncludedSection = lazyWithRetry(() =>
  import("@/components/country-risks-included").then((m) => ({ default: m.CountryRisksIncludedSection })),
);

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type Severity = "high" | "medium" | "low";
type CountryMarket = "usa" | "korea" | "canada" | "china" | "japan" | "uae";

interface CountryMeta {
  flagImg: string;
  vinPrefix: string;
  totalVehicles: string;
  topRisk: string;
  popularBrands: string[];
  issueIndices: number[];
  issueSeverities: Severity[];
}

const COUNTRY_META: Record<string, CountryMeta> = {
  usa: {
    flagImg: "us",
    vinPrefix: "1, 4, 5",
    totalVehicles: "280M+",
    topRisk: "Odometer rollback",
    popularBrands: ["Ford", "Chevrolet", "Toyota", "Honda", "Ram", "GMC", "Jeep", "Tesla"],
    issueIndices: [0, 1, 2],
    issueSeverities: ["high", "high", "medium"],
  },
  korea: {
    flagImg: "kr",
    vinPrefix: "K",
    totalVehicles: "25M+",
    topRisk: "Hidden accidents",
    popularBrands: ["Hyundai", "Kia", "Genesis", "Ssangyong", "GM Korea", "Renault Korea", "BMW", "Toyota"],
    issueIndices: [0, 1, 3],
    issueSeverities: ["high", "high", "medium"],
  },
  canada: {
    flagImg: "ca",
    vinPrefix: "2",
    totalVehicles: "30M+",
    topRisk: "Branded titles",
    popularBrands: ["Toyota", "Honda", "Ford", "Chevrolet", "GMC", "Ram", "Hyundai", "Kia"],
    issueIndices: [0, 1, 2],
    issueSeverities: ["high", "high", "medium"],
  },
  china: {
    flagImg: "cn",
    vinPrefix: "L, LE",
    totalVehicles: "350M+",
    topRisk: "Odometer fraud",
    popularBrands: ["BYD", "NIO", "XPeng", "Zeekr", "Geely", "Li Auto", "Chery", "GAC"],
    issueIndices: [0, 1, 2],
    issueSeverities: ["high", "high", "medium"],
  },
  japan: {
    flagImg: "jp",
    vinPrefix: "J",
    totalVehicles: "78M+",
    topRisk: "Auction damage grades",
    popularBrands: ["Toyota", "Honda", "Nissan", "Mazda", "Subaru", "Lexus", "Suzuki", "Mitsubishi"],
    issueIndices: [0, 1, 2],
    issueSeverities: ["high", "high", "medium"],
  },
  uae: {
    flagImg: "ae",
    vinPrefix: "J, W, 5",
    totalVehicles: "3M+",
    topRisk: "Import flood damage",
    popularBrands: ["Audi", "Porsche", "Ferrari", "Lamborghini", "Mercedes-Benz", "BMW", "Bentley", "Lexus"],
    issueIndices: [0, 1, 2],
    issueSeverities: ["high", "high", "medium"],
  },
};

function useCountryContent(slug: string, t: (k: string) => string) {
  if (!(slug in COUNTRY_META)) return null;
  const meta = COUNTRY_META[slug];
  return {
    description: t(`country_${slug}_description`),
    issues: meta.issueIndices.map(i => t(`country_${slug}_issue_${i}`)),
    included: [0, 1, 2, 3, 4, 5].map(i => t(`country_${slug}_included_${i}`)),
    faq:      [0, 1, 2].map(i => ({ q: t(`country_${slug}_faq_${i}_q`), a: t(`country_${slug}_faq_${i}_a`) })),
  };
}

interface Props { params: { lang: string; country: string } }

export default function CountryPage({ params }: Props) {
  const { t, language } = useTranslation();
  const [, setLocation] = useLocation();
  const { isSignedIn, user } = useAuth();
  const lightMotion = useLightMotion();
  const [vin, setVin] = useState("");
  const [error, setError] = useState("");
  const vinRef  = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLElement>(null);

  const slug        = params.country.toLowerCase();
  const meta        = COUNTRY_META[slug];
  const content     = useCountryContent(slug, t);
  const countryName = t(`country_${slug}_name`);
  const isKnownCountry = slug in COUNTRY_META;

  const normalizedCountryVin = vin.trim().toUpperCase();
  const countryLocalDecode = useMemo(
    () => (normalizedCountryVin.length === 17 ? decodeVinLocalFree(normalizedCountryVin) : null),
    [normalizedCountryVin],
  );
  const showVinRecheckHint =
    isKnownCountry
    && normalizedCountryVin.length === 17
    && !getVinValidationErrorKey(normalizedCountryVin)
    && !!countryLocalDecode
    && !isTrustworthyVinDecode({
      vin: normalizedCountryVin,
      make: countryLocalDecode.make,
      model: countryLocalDecode.model,
      year: countryLocalDecode.year ?? null,
    });
  const countryDecodeTrustworthy = !!countryLocalDecode && isTrustworthyVinDecode({
    vin: normalizedCountryVin,
    make: countryLocalDecode.make,
    model: countryLocalDecode.model,
    year: countryLocalDecode.year ?? null,
  });
  const { data: countryPeek } = useQuery({
    queryKey: ["/api/vin/peek", "country", slug, normalizedCountryVin],
    enabled: isSignedIn && isKnownCountry && normalizedCountryVin.length === 17 && countryDecodeTrustworthy,
    queryFn: async () => {
      const r = await fetch(`${basePath}/api/vin/peek/${encodeURIComponent(normalizedCountryVin)}`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("peek_error");
      return r.json() as {
        manualPending?: boolean;
        dataAvailable?: boolean;
        checkUnavailable?: boolean;
      };
    },
    staleTime: 60_000,
  });
  const showCountryPendingDoubleCheck = isKnownCountry && !!countryPeek && shouldShowPendingVinDoubleCheck({
    vin: normalizedCountryVin,
    make: countryLocalDecode?.make,
    model: countryLocalDecode?.model,
    year: countryLocalDecode?.year ?? null,
    ...countryPeek,
  });
  const vinFormAlerts = (variant: "default" | "on-dark") => (
    showVinRecheckHint || showCountryPendingDoubleCheck
  ) ? (
    <AnimatePresence>
      {showVinRecheckHint && (
        <motion.div
          key="vin-recheck-hint"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
        >
          <VinDecodeRecheckHint variant={variant} />
        </motion.div>
      )}
      {showCountryPendingDoubleCheck && (
        <motion.div
          key="vin-pending-double-check"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
        >
          <VinPendingDoubleCheckHint variant={variant} />
        </motion.div>
      )}
    </AnimatePresence>
  ) : null;

  const countryKey =
    slug === "korea" ? "country_korea"
      : slug === "canada" ? "country_canada"
        : slug === "china" ? "country_china"
          : slug === "japan" ? "country_japan"
            : slug === "uae" ? "country_uae"
              : slug === "usa" ? "country_usa"
                : "not_found";
  const seo = usePageSeo(countryKey);

  const {
    displayPrice: rawDisplay, basePrice: rawBase,
    isDiscount, loading: priceLoading, currencySymbol, fmtPrice,
  } = useDisplayPrice();
  const displayPrice = rawDisplay ?? DEFAULT_PRICING.discountPrice;
  const basePrice = rawBase ?? DEFAULT_PRICING.basePrice;

  const heroPriceLine = (
    <div className="px-1 flex items-center justify-center gap-2 text-sm text-muted-foreground text-center w-full mx-auto">
      <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
      <span>
        {t("country_cta_desc")}{" "}
        {priceLoading ? (
          <Skeleton className="h-4 w-12 rounded inline-block align-middle" />
        ) : (
          <span className="inline-flex items-baseline gap-1.5">
            <span className="font-bold text-primary">{fmtPrice(displayPrice)}</span>
            {isDiscount && basePrice > displayPrice && (
              <span className="line-through text-muted-foreground/60 text-xs">{fmtPrice(basePrice)}</span>
            )}
          </span>
        )}
      </span>
    </div>
  );

  if (!meta || !content) {
    return (
      <>
        <SEOHead title={seo.title} description={seo.description} lang={seo.lang} noIndex favicons={seo.favicons} />
        <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
          <h1 className="text-3xl font-bold">{t("country_not_found")}</h1>
          <Button asChild><Link href={`/${language}`}>{t("back_to_home")}</Link></Button>
        </div>
      </>
    );
  }

  const vinLookupDisabled = useVinLookupDisabledForUser(user?.isAdmin);

  const handleCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (vinLookupDisabled) return;
    const v = vin.trim().toUpperCase();
    const validationKey = getVinValidationErrorKey(v);
    if (validationKey) { setError(t(validationKey)); return; }
    setError("");
    if (!isSignedIn) {
      const authPath = redirectGuestForVinCheckout(v, language);
      if (authPath) setLocation(authPath);
      return;
    }
    sessionStorage.setItem("checkout_vin", v);
    setLocation(pathFor(language, "checkout"));
  };

  const focusVin = () => {
    heroRef.current?.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => vinRef.current?.focus(), 400);
  };

  const otherCountries = Object.entries(COUNTRY_META).filter(([k]) => k !== slug);

  return (
    <div>
      <SEOHead title={seo.title} description={seo.description} lang={seo.lang} canonicalPath={seo.canonicalPath} ogImage={seo.ogImage} ogImageAlt={seo.ogImageAlt} favicons={seo.favicons} jsonLd={seo.jsonLd} />

      {/* ─────────────────────── HERO ─────────────────────── */}
      <section ref={heroRef} className="relative overflow-x-hidden px-4 -mt-[var(--site-header-offset,76px)] pt-[calc(2rem+var(--site-header-offset,76px))] md:pt-[calc(3.5rem+var(--site-header-offset,76px))] pb-0">
        {/* Base: light = pale sky wash, dark = deep navy */}
        <div className="absolute inset-0 -z-20 bg-gradient-to-b from-sky-50/70 via-sky-50/20 to-background dark:hidden" />
        <div className="absolute inset-0 -z-20 hidden dark:block" style={{ background: "#060a14" }} />
        {/* Blueprint grid — softer than the homepage dot field */}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#00a5fd_1px,transparent_1px),linear-gradient(to_bottom,#00a5fd_1px,transparent_1px)] [background-size:64px_64px] opacity-[0.05] dark:opacity-[0.10]" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(#00a5fd_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.04] dark:opacity-[0.10]" />
        {/* Brand cyan/blue glow from top */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_55%_at_50%_-5%,rgba(0,165,253,0.14),transparent)] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-5%,rgba(0,165,253,0.22),transparent)]" />
        {/* Secondary accent glow bottom-left in dark */}
        <div className="absolute inset-0 -z-10 hidden dark:block bg-[radial-gradient(ellipse_50%_40%_at_0%_100%,rgba(0,165,253,0.10),transparent)]" />
        {/* Fade to background */}
        <div className="absolute bottom-0 left-0 right-0 h-40 -z-10 bg-gradient-to-t from-background to-transparent" />

        <div className="max-w-7xl mx-auto pb-8 md:pb-12 lg:pb-20 relative z-10 grid gap-8 lg:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(300px,400px)] lg:items-center">

          {/* Left */}
          <EnterReveal
            y={16}
            className="space-y-8 pt-2 md:pt-6 lg:pt-14 relative z-20 text-center lg:text-start"
          >
            <div className="flex items-center justify-center gap-3 lg:justify-start">
              <FlagImg
                code={meta.flagImg}
                size={40}
                priority
                className="rounded-md shadow-md ring-1 ring-black/10"
                alt={formatImageFlagAlt(countryName, t)}
              />
            </div>

            {/* Same H1 on every breakpoint: keyword + origin. */}
            <h1 className="text-[2.9rem] sm:text-4xl md:text-5xl lg:text-[3.35rem] xl:text-[3.65rem] font-extrabold tracking-tight leading-[1.1]">
              {(() => {
                const verb = t(`country_${slug}_headline_verb`);
                return verb ? <>{verb}{" "}</> : null;
              })()}
              <span className="text-primary">{t(`country_${slug}_cycling_0`)}</span>
              <br />
              <span className="mt-1 inline text-foreground/90">
                {t(`country_${slug}_headline_origin`)}
              </span>
            </h1>

            <p className="text-sm md:text-base text-muted-foreground mx-auto lg:mx-0 max-w-lg leading-relaxed">
              {content.description}
            </p>

            {/* VIN form */}
            <HeroVinForm
              vin={vin}
              onVinChange={(v) => { setVin(v); setError(""); }}
              onSubmit={handleCheck}
              error={error}
              disabled={vinLookupDisabled}
              placeholder={language === "sq" ? t("vin_placeholder_chassis") : t("vin_placeholder")}
              inputRef={vinRef}
              className="relative z-20 lg:mx-0"
              alerts={vinFormAlerts("default")}
            />
          </EnterReveal>

          {/* Right — case file (visible on mobile too) */}
          <EnterReveal
            y={16}
            delay={0.08}
            className="relative z-0 mx-auto flex w-full min-w-0 max-w-[400px] flex-col items-center pt-2 lg:sticky lg:top-8 lg:max-w-[400px] lg:justify-self-end lg:-translate-x-8 lg:pt-4"
          >
            <HeroReportPreview country={slug as CountryMarket} />
            <div className="mt-3 w-full">{heroPriceLine}</div>
          </EnterReveal>
        </div>
      </section>

      {/* ─────────────────────── BRANDS ─────────────────────── */}
      <div className="px-4 py-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#0088d4]">
            {t("popular_brands")}
          </p>
          <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
            {meta.popularBrands.map((brand, i) => (
              <li key={brand} className="inline-flex items-center">
                {i > 0 && (
                  <span aria-hidden className="mx-1.5 text-[#00a5fd]/35">·</span>
                )}
                <button
                  type="button"
                  onClick={focusVin}
                  className="text-sm text-foreground/55 transition-colors hover:text-[#0088d4]"
                >
                  {brand}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ─────────────────────── EVIDENCE INDEX ─────────────────────── */}
      <DeferredSection minHeight={320}>
        <Suspense fallback={<SectionFallback minHeight={320} />}>
          <CountryCheckDossier market={slug as CountryMarket} />
        </Suspense>
      </DeferredSection>

      {/* ─────────────────────── RISKS + INCLUDED ─────────────────────── */}
      <DeferredSection minHeight={360}>
        <Suspense fallback={<SectionFallback minHeight={360} />}>
          <CountryRisksIncludedSection
            slug={slug as CountryMarket}
            issues={content.issues}
            included={content.included}
            severities={meta.issueSeverities}
          />
        </Suspense>
      </DeferredSection>

      {/* ─────────────────────── FAQ ─────────────────────── */}
      <section className="relative overflow-hidden py-16 md:py-24 px-4 bg-muted/25 dark:bg-white/[0.015] border-t">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.45)_1px,transparent_1px)] [background-size:96px_100%] opacity-50"
        />
        <div className="relative max-w-2xl mx-auto">
          <EnterReveal inView y={16} className="mb-8 border-b border-dashed border-border/70 pb-5">
            <p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#0088d4] dark:text-[#33bbfd]">
              <FlagImg code={meta.flagImg} size={14} className="rounded-[2px]" alt={formatImageFlagAlt(countryName, t)} />
              {countryName} · {t("country_vin_checks")}
            </p>
            <h2 className="mt-2 text-2xl md:text-3xl font-extrabold tracking-tight">{t("faq")}</h2>
          </EnterReveal>

          <SiteFaqAccordion items={content.faq} />
        </div>
      </section>

      {/* ─────────────────────── COMPARISON TABLE ─────────────────────── */}
      <DeferredSection minHeight={280}>
        <Suspense fallback={<SectionFallback minHeight={280} />}>
          <CompareTable market={
            slug === "korea" ? "korea"
              : slug === "canada" ? "canada"
                : slug === "china" ? "china"
                  : slug === "japan" ? "japan"
                    : slug === "uae" ? "uae"
                      : "usa"
          } />
        </Suspense>
      </DeferredSection>

      {/* ─────────────────────── CTA ─────────────────────── */}
      <section className="relative overflow-hidden border-t border-border/60 bg-muted/20 px-4 py-14 dark:bg-[#060a14] md:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.45)_1px,transparent_1px)] [background-size:96px_100%] opacity-50"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00a5fd]/40 to-transparent"
        />

        <EnterReveal inView y={16} className="relative z-10 mx-auto max-w-3xl">
          <div className="relative overflow-hidden rounded-lg border border-[#00a5fd]/25 bg-card/90 shadow-[0_20px_55px_-32px_rgba(0,165,253,0.5)] dark:bg-[#060a14]/80">
            <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[#00a5fd]" />

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border/60 bg-muted/30 px-3 py-2.5 pl-4 dark:bg-white/[0.03]">
              <p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#0088d4] dark:text-[#33bbfd]">
                <FlagImg code={meta.flagImg} size={14} className="rounded-[2px] shadow-sm" alt={formatImageFlagAlt(countryName, t)} />
                {countryName} · {t("country_vin_checks")}
              </p>
              <p className="flex items-baseline gap-2 text-[11px] text-muted-foreground">
                {t("country_cta_desc")}
                {priceLoading ? (
                  <Skeleton className="inline-block h-4 w-12 rounded align-middle" />
                ) : (
                  <span className="inline-flex items-baseline gap-1.5 font-mono tabular-nums">
                    <span className="text-sm font-bold text-foreground">{fmtPrice(displayPrice)}</span>
                    {isDiscount && basePrice > displayPrice && (
                      <span className="text-muted-foreground/55 line-through">{fmtPrice(basePrice)}</span>
                    )}
                  </span>
                )}
              </p>
            </div>

            <div className="space-y-4 px-4 py-5 pl-5 sm:px-5 sm:pl-6">
              <h2 className="text-2xl font-bold leading-tight tracking-tight md:text-3xl">
                {t("country_cta_heading").replace("{country}", countryName)}
              </h2>

              <HeroVinForm
                vin={vin}
                onVinChange={(v) => { setVin(v); setError(""); }}
                onSubmit={handleCheck}
                error={error}
                disabled={vinLookupDisabled}
                placeholder={language === "sq" ? t("vin_placeholder_chassis") : t("vin_placeholder")}
                className="mx-0 max-w-none sm:max-w-none"
                alerts={vinFormAlerts("default")}
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-dashed border-border/60 bg-muted/20 px-4 py-2.5 pl-5 text-[11px] text-muted-foreground dark:bg-white/[0.02]">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-[#00a5fd]" />
                {t("trust_secure_payment")}
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-[#00a5fd]" />
                {t("trust_instant_report")}
              </span>
            </div>
          </div>
        </EnterReveal>
      </section>

      {/* ─────────────────────── OTHER COUNTRIES ─────────────────────── */}
      <section className="relative overflow-hidden border-t border-white/10 bg-[#030712] px-4 py-14 md:py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(0,165,253,0.12),transparent)]" />
        <div className="relative mx-auto max-w-3xl">
          <EnterReveal inView y={12} className="mb-8 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#00a5fd]">
              {t("stats_countries_badge")}
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
              {t("browse_countries")}
            </h2>
          </EnterReveal>

          <div className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
            {otherCountries.map(([key, c]) => (
              <Link
                key={key}
                href={pathForCountry(language, key)}
                className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-[#00a5fd]/10 sm:px-5 sm:py-4"
              >
                <FlagImg
                  code={c.flagImg}
                  size={28}
                  className="h-5 w-auto rounded-[2px] shadow-sm ring-1 ring-white/10"
                  alt={formatImageFlagAlt(t(`country_${key}_name`), t)}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold tracking-tight text-white">{t(`country_${key}_name`)}</p>
                  <p className="truncate text-xs text-[#d7e4f2]">{t(`home_country_${key}_h0`)}</p>
                </div>
                <span className="hidden font-mono text-[11px] tabular-nums text-white/40 sm:inline">
                  {c.totalVehicles}
                </span>
                <ArrowRight className="h-4 w-4 text-[#d7e4f2] transition-all group-hover:translate-x-0.5 group-hover:text-[#00a5fd]" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
