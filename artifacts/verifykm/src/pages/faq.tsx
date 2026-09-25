import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "@/i18n/context";
import { useLocation, Link } from "wouter";
import { EnterReveal } from "@/components/enter-reveal";
import { SEOHead, usePageSeo, faqPageJsonLd } from "@/components/seo";
import { HeroVinForm } from "@/components/hero-vin-form";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { redirectGuestForVinCheckout } from "@/lib/checkout-vin-flow";
import { SiteFaqAccordion } from "@/components/site-faq-accordion";
import {
  ArrowRight,
  Headset,
  Search,
  FileText,
  ShieldCheck,
  Gauge,
  AlertTriangle,
  Lock,
  Camera,
  Users,
  Globe2,
  Clock,
  CreditCard,
  RotateCcw,
  UserCircle,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { pathFor } from "@/lib/localized-routes";

type FaqItem = {
  q: string;
  a: string;
  icon: LucideIcon;
  rich?: "report";
};

type FaqCategory = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: FaqItem[];
};

function ReportIncludesAnswer() {
  const { t } = useTranslation();
  const items = [
    { icon: Gauge, label: t("report_mileage") },
    { icon: AlertTriangle, label: t("report_accidents") },
    { icon: ShieldCheck, label: t("report_salvage") },
    { icon: Lock, label: t("report_theft") },
    { icon: Users, label: t("report_ownership") },
    { icon: Camera, label: t("faq_report_photos") },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed">{t("faq_a5")}</p>
      <ul className="overflow-hidden rounded-md border border-border/70 bg-muted/20 dark:bg-white/[0.02]">
        {items.map(({ icon: Icon, label }, i) => (
          <li
            key={label}
            className={cn(
              "relative flex items-center gap-2.5 px-3 py-2 pl-5",
              i > 0 && "border-t border-dashed border-border/55",
            )}
          >
            <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-[#00a5fd]/30" />
            <Icon className="h-3.5 w-3.5 shrink-0 text-[#0088d4] dark:text-[#33bbfd]" />
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-[13px] font-medium leading-snug">{label}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs leading-relaxed text-muted-foreground/80">{t("faq_a5_note")}</p>
    </div>
  );
}

export default function FAQ() {
  const { t, language } = useTranslation();
  const [, setLocation] = useLocation();
  const { isSignedIn } = useAuth();
  const [vin, setVin] = useState("");
  const [vinError, setVinError] = useState("");
  const seo = usePageSeo("faq");

  const handleCheck = (e: FormEvent) => {
    e.preventDefault();
    const v = vin.trim().toUpperCase();
    if (!v) { setVinError(t("vin_error_required")); return; }
    if (v.length !== 17) { setVinError(t("vin_error_length")); return; }
    setVinError("");
    if (!isSignedIn) {
      const authPath = redirectGuestForVinCheckout(v, language);
      if (authPath) { setLocation(authPath); return; }
    }
    sessionStorage.setItem("checkout_vin", v);
    setLocation(pathFor(language, "checkout"));
  };

  const categories: FaqCategory[] = useMemo(() => [
    {
      id: "basics",
      label: t("faq_cat_basics"),
      icon: Search,
      items: [
        { q: t("faq_q1"), a: t("faq_a1"), icon: Search },
        { q: t("faq_q2"), a: t("faq_a2"), icon: Globe2 },
        { q: t("faq_q3"), a: t("faq_a3"), icon: Clock },
      ],
    },
    {
      id: "report",
      label: t("faq_cat_report"),
      icon: FileText,
      items: [
        { q: t("faq_q4"), a: t("faq_a4"), icon: ShieldCheck },
        { q: t("faq_q5"), a: t("faq_a5"), icon: FileText, rich: "report" },
      ],
    },
    {
      id: "account",
      label: t("faq_cat_account"),
      icon: CreditCard,
      items: [
        { q: t("faq_q6"), a: t("faq_a6"), icon: CreditCard },
        { q: t("faq_q7"), a: t("faq_a7"), icon: RotateCcw },
        { q: t("faq_q8"), a: t("faq_a8"), icon: UserCircle },
      ],
    },
  ], [t]);

  const flatItems = useMemo(
    () => categories.flatMap((c) => c.items.map(({ q, a }) => ({ q, a }))),
    [categories],
  );

  const faqJsonLd = useMemo(
    () => faqPageJsonLd(flatItems),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute when locale strings change
    [language],
  );

  const categoryIds = useMemo(() => categories.map((c) => c.id), [categories]);
  const [activeCategory, setActiveCategory] = useState(categoryIds[0]);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Index highlight follows the section nearest the top of the viewport.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        const id = visible?.target.getAttribute("data-faq-category");
        if (id) setActiveCategory(id);
      },
      { rootMargin: "-140px 0px -55% 0px" },
    );
    categoryIds.forEach((id) => {
      const el = sectionRefs.current[id];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [categoryIds]);

  let itemIndex = 0;

  const scrollToCategory = (id: string) => {
    const el = document.getElementById(`faq-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const totalAnswers = flatItems.length;

  return (
    <>
      <SEOHead
        title={seo.title}
        description={seo.description}
        lang={seo.lang}
        canonicalPath={seo.canonicalPath}
        jsonLd={faqJsonLd}
      />

      {/* ───── Hero — help-desk header, left aligned ───── */}
      <section className="relative w-full overflow-x-clip border-b border-border/60 px-5 py-12 md:py-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_15%_-15%,rgba(0,165,253,0.13),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.5)_1px,transparent_1px)] [background-size:96px_100%] opacity-50" />

        <EnterReveal y={12} className="relative mx-auto w-full min-w-0 max-w-6xl">
          <div className="grid min-w-0 gap-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="min-w-0 space-y-4 border-l-2 border-[#00a5fd] pl-5 sm:pl-6">
              <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#0088d4] dark:text-[#33bbfd]">
                <span className="inline-flex items-center gap-1.5">
                  <Headset className="h-3.5 w-3.5" />
                  {t("faq_desk_ref")}
                </span>
                <span aria-hidden className="h-3 w-px bg-border" />
                <span className="text-muted-foreground/80">{t("faq_badge")}</span>
              </p>
              <h1 className="text-3xl font-extrabold leading-[1.12] tracking-tight sm:text-4xl md:text-[2.65rem]">
                {t("faq_title")}
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {t("faq_subtitle")}
              </p>
            </div>

            <dl className="flex w-full max-w-full divide-x divide-border/70 overflow-hidden rounded-md border border-border/70 bg-card/60 md:w-auto dark:bg-white/[0.02]">
              {[
                { key: t("faq_desk_sections"), val: categories.length },
                { key: t("faq_desk_answers"), val: totalAnswers },
              ].map(({ key, val }) => (
                <div key={key} className="px-5 py-3">
                  <dt className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
                    {key}
                  </dt>
                  <dd className="mt-0.5 font-mono text-xl font-black tabular-nums text-[#0088d4] dark:text-[#33bbfd]">
                    {String(val).padStart(2, "0")}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </EnterReveal>
      </section>

      {/* ───── Index + answers ───── */}
      <section className="mx-auto w-full min-w-0 max-w-6xl overflow-x-clip px-5 pb-16 pt-8 md:pb-20">
        <div className="grid min-w-0 gap-8 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
          {/* Question index */}
          <nav aria-label={t("faq_title")} className="min-w-0 max-w-full lg:sticky lg:top-28 lg:self-start">
            <p className="mb-2 font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-muted-foreground/70">
              {t("faq_desk_index")}
            </p>
            <ul className="flex max-w-full gap-1.5 overflow-x-auto overscroll-x-contain pb-1 lg:flex-col lg:gap-0 lg:overflow-visible lg:rounded-md lg:border lg:border-border/70 lg:bg-card/50 lg:pb-0 dark:lg:bg-white/[0.02]">
              {categories.map((category, i) => {
                const active = activeCategory === category.id;
                return (
                  <li key={category.id} className="shrink-0 lg:w-full lg:shrink">
                    <button
                      type="button"
                      onClick={() => scrollToCategory(category.id)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "relative flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors",
                        "lg:rounded-none lg:border-x-0 lg:border-t-0 lg:border-b lg:border-dashed lg:border-border/55 lg:last:border-b-0",
                        active
                          ? "border-[#00a5fd]/45 bg-[#00a5fd]/[0.07] text-foreground lg:bg-[#00a5fd]/[0.06]"
                          : "border-border/70 text-muted-foreground hover:border-[#00a5fd]/35 hover:text-foreground lg:border-border/55",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "absolute inset-y-0 left-0 hidden w-[3px] lg:block",
                          active ? "bg-[#00a5fd]" : "bg-transparent",
                        )}
                      />
                      <span
                        className={cn(
                          "font-mono text-[10px] font-bold tabular-nums lg:pl-1.5",
                          active ? "text-[#0088d4] dark:text-[#33bbfd]" : "text-muted-foreground/60",
                        )}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <category.icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="whitespace-nowrap text-xs font-semibold lg:whitespace-normal">
                        {category.label}
                      </span>
                      <span className="ml-auto hidden font-mono text-[10px] tabular-nums text-muted-foreground/50 lg:inline">
                        {category.items.length}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Answers */}
          <div className="min-w-0 space-y-8">
            {categories.map((category, catIdx) => {
              const start = itemIndex;
              itemIndex += category.items.length;
              return (
              <EnterReveal key={category.id} inView y={14} delay={catIdx * 0.04} className="space-y-3">
                <div
                  id={`faq-${category.id}`}
                  data-faq-category={category.id}
                  ref={(el) => { sectionRefs.current[category.id] = el; }}
                  className="scroll-mt-28 flex items-center gap-2.5 border-b border-dashed border-border/70 pb-2.5"
                >
                  <span className="font-mono text-[10px] font-black tabular-nums text-[#0088d4] dark:text-[#33bbfd]">
                    {String(catIdx + 1).padStart(2, "0")}
                  </span>
                  <category.icon className="h-3.5 w-3.5 shrink-0 text-[#0088d4] dark:text-[#33bbfd]" />
                  <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    {category.label}
                  </h2>
                  <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground/50">
                    {String(category.items.length).padStart(2, "0")}
                  </span>
                </div>

                <SiteFaqAccordion
                  idPrefix={category.id}
                  startIndex={start}
                  items={category.items.map((item) => ({
                    q: item.q,
                    a: item.rich === "report" ? <ReportIncludesAnswer /> : item.a,
                  }))}
                />
              </EnterReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───── CTA — open-a-case desk panel ───── */}
      <section className="relative w-full overflow-x-clip border-t border-border/60 bg-muted/25 px-4 py-14 md:py-16 dark:bg-white/[0.015]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_0%,rgba(0,165,253,0.10),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.45)_1px,transparent_1px)] [background-size:96px_100%] opacity-50" />

        <EnterReveal inView y={14} className="relative z-10 mx-auto w-full min-w-0 max-w-2xl">
          <div className="w-full min-w-0 overflow-hidden rounded-lg border border-[#00a5fd]/25 bg-background shadow-[0_18px_50px_-32px_rgba(0,165,253,0.5)]">
            <div className="relative flex items-center gap-2.5 border-b border-border/60 bg-[#00a5fd]/[0.05] px-4 py-2.5 pl-5">
              <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[#00a5fd]" />
              <Headset className="h-3.5 w-3.5 shrink-0 text-[#0088d4] dark:text-[#33bbfd]" />
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-[#0088d4] dark:text-[#33bbfd]">
                {t("faq_cta_panel_label")}
              </p>
              <span className="ml-auto font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
                {t("faq_cta_eyebrow")}
              </span>
            </div>

            <div className="space-y-6 px-5 py-8 pl-6 sm:px-8 sm:pl-9">
              <div className="space-y-2.5">
                <h2 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
                  {t("faq_cta_title")}
                </h2>
                <p className="max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {t("faq_cta_subtitle")}
                </p>
              </div>

              <HeroVinForm
                vin={vin}
                onVinChange={(v) => { setVin(v); setVinError(""); }}
                onSubmit={handleCheck}
                error={vinError}
                placeholder={t("vin_placeholder")}
                className="w-full min-w-0 max-w-xl"
              />

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-dashed border-border/60 pt-5">
                {[
                  { icon: Zap, label: t("trust_instant_report") },
                  { icon: RotateCcw, label: t("money_back") },
                ].map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-[#0088d4] dark:text-[#33bbfd]" />
                    {label}
                  </span>
                ))}
                <Button asChild variant="ghost" size="sm" className="ml-auto h-8 rounded-md text-xs font-semibold text-[#0088d4] hover:bg-[#00a5fd]/10 dark:text-[#33bbfd]">
                  <Link href={pathFor(language, "pricing")}>
                    {t("see_whats_included")}
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </EnterReveal>
      </section>
    </>
  );
}
