import { useState, useMemo, type FormEvent } from "react";
import { useTranslation } from "@/i18n/context";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { EnterReveal } from "@/components/enter-reveal";
import { SEOHead, usePageSeo } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { HeroVinForm } from "@/components/hero-vin-form";
import { WhatWeCheckSection } from "@/components/what-we-check-section";
import { useAuth } from "@/lib/auth-context";
import { redirectGuestForVinCheckout } from "@/lib/checkout-vin-flow";
import {
  Search, Database, FileText, Zap, RotateCcw, Globe2,
  ArrowRight, ShieldCheck, CheckCircle2, FolderOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { pathFor } from "@/lib/localized-routes";

const VIN_EXAMPLE = "WAUZZZ8K9NA123456";
const DEMO_VEHICLE = "Audi A4 2022";

type Step = {
  num: string;
  label: string;
  title: string;
  desc: string;
  icon: LucideIcon;
};

const PREVIEW =
  "overflow-hidden rounded-[1.25rem] bg-[#071018] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";

function StepPreview({ step, t }: { step: number; t: (k: string) => string }) {
  if (step === 0) {
    return (
      <div className={PREVIEW}>
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7dd3fc]">{t("hiw_preview_intake")}</p>
          <span className="h-1.5 w-1.5 rounded-full bg-[#00a5fd]" />
        </div>
        <div className="space-y-3 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d7e4f2]">{t("hiw_vin_field_label")}</p>
          <p className="rounded-xl border border-[#00a5fd]/25 bg-[#0c1524] px-3 py-2.5 font-mono text-[13px] font-semibold tracking-[0.16em] text-white">
            {VIN_EXAMPLE}
          </p>
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#00a5fd] text-white">
              <Search className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d7e4f2]">{t("hiw_match_label")}</p>
              <p className="truncate text-sm font-bold">{DEMO_VEHICLE}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 1) {
    const sources = [
      t("auction_history"),
      t("accident_history"),
      t("mileage_verification"),
      t("theft_records"),
    ];
    return (
      <div className={PREVIEW}>
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7dd3fc]">{t("hiw_preview_query")}</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d7e4f2]">{t("hiw_sources_label")}</p>
        </div>
        <div className="space-y-3 p-4">
          <ul className="grid grid-cols-1 gap-2">
            {sources.map((src) => (
              <li key={src} className="flex items-center gap-2.5 rounded-xl bg-white/[0.04] px-3 py-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#33bbfd]" />
                <span className="min-w-0 truncate text-[13px] font-medium text-white/85">{src}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d7e4f2]">
              <span>{t("hiw_mock_scanning")}</span>
              <span className="tabular-nums text-[#7dd3fc]">100%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#0077c8] to-[#33bbfd]"
                initial={{ width: "0%" }}
                whileInView={{ width: "100%" }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={PREVIEW}>
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7dd3fc]">{t("hiw_preview_dossier")}</p>
        <span className="rounded-full bg-[#00a5fd]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7dd3fc]">
          {t("hiw_status_complete")}
        </span>
      </div>
      <div className="space-y-3 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d7e4f2]">{t("hiw_findings_label")}</p>
        <div className="rounded-xl bg-white/[0.04] px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d7e4f2]">{t("mileage")}</p>
          <p className="mt-1 text-3xl font-black tracking-tight">
            68,400 <span className="text-base font-semibold text-[#d7e4f2]">km</span>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: t("mock_label_accidents"), val: t("demo_none_found") },
            { label: t("mock_label_salvage"), val: t("report_clean") },
          ].map((row) => (
            <div key={row.label} className="rounded-xl bg-white/[0.04] px-3 py-2.5">
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[#d7e4f2]">{row.label}</p>
              <p className="mt-1 truncate text-sm font-bold text-[#7dd3fc]">{row.val}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HowItWorks() {
  const { t, language } = useTranslation();
  const [, setLocation] = useLocation();
  const { isSignedIn } = useAuth();
  const [vin, setVin] = useState("");
  const [vinError, setVinError] = useState("");
  const seo = usePageSeo("how_it_works");

  const steps: Step[] = useMemo(() => [
    { num: "01", label: t("hiw_step1_label"), title: t("hiw_step1_title"), desc: t("hiw_step1_desc"), icon: Search },
    { num: "02", label: t("hiw_step2_label"), title: t("hiw_step2_title"), desc: t("hiw_step2_desc"), icon: Database },
    { num: "03", label: t("hiw_step3_label"), title: t("hiw_step3_title"), desc: t("hiw_step3_desc"), icon: FileText },
  ], [t]);

  const custody = useMemo(() => [
    { icon: Zap, key: t("hiw_custody_key_speed"), label: t("hiw_trust_speed"), desc: t("pricing_compare_instant") },
    { icon: Globe2, key: t("hiw_custody_key_sources"), label: t("hiw_trust_official"), desc: t("pricing_compare_official") },
    { icon: RotateCcw, key: t("hiw_custody_key_refund"), label: t("hiw_trust_refund"), desc: t("money_back_desc") },
  ], [t]);

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

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={seo.title}
        description={seo.description}
        lang={seo.lang}
        canonicalPath={seo.canonicalPath}
      />

      {/* ───── Hero — left-aligned case intake header ───── */}
      <section className="relative overflow-hidden border-b border-border/60 px-4 py-12 md:py-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_15%_-10%,rgba(0,165,253,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.5)_1px,transparent_1px)] [background-size:96px_100%] opacity-50" />

        <EnterReveal y={14} className="relative mx-auto max-w-6xl">
          <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="relative space-y-4 border-l-2 border-[#00a5fd] pl-5 sm:pl-6">
              <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#0088d4] dark:text-[#33bbfd]">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {t("hiw_file_ref")}
                </span>
                <span aria-hidden className="h-3 w-px bg-border" />
                <span className="text-muted-foreground/80">{t("hiw_badge")}</span>
              </p>
              <h1 className="text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl md:text-[2.75rem]">
                {t("hiw_title")}
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {t("hiw_subtitle")}
              </p>
            </div>

            {/* Stage index — reads like a dossier table of contents */}
            <ul className="w-full shrink-0 space-y-0 rounded-md border border-border/70 bg-card/60 p-1 md:w-[17rem] dark:bg-white/[0.02]">
              <li className="px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-muted-foreground/70">
                {t("hiw_stages_label")}
              </li>
              {steps.map(({ num, title }) => (
                <li
                  key={num}
                  className="flex items-center gap-2.5 border-t border-dashed border-border/55 px-2.5 py-2"
                >
                  <span className="font-mono text-[10px] font-bold tabular-nums text-[#0088d4] dark:text-[#33bbfd]">
                    {num}
                  </span>
                  <span className="truncate text-xs font-semibold text-foreground/85">{title}</span>
                </li>
              ))}
            </ul>
          </div>
        </EnterReveal>
      </section>

      {/* ───── Three stages ───── */}
      <section className="relative overflow-hidden bg-[#f4f8fc] px-4 py-16 dark:bg-[#030712] md:py-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_40%_at_50%_0%,rgba(0,165,253,0.16),transparent_70%)]" />

        <div className="relative mx-auto max-w-6xl">
          <EnterReveal inView y={12} className="mx-auto mb-10 max-w-2xl text-center md:mb-14">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#0088d4] dark:text-[#7dd3fc]">
              {t("home_badge_3_steps")}
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">
              {t("hiw_timeline_title")}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t("hiw_timeline_sub")}
            </p>
          </EnterReveal>

          <ol className="grid items-stretch gap-5 lg:grid-cols-3">
            {steps.map(({ num, label, title, desc, icon: Icon }, i) => (
              <EnterReveal key={num} inView y={16} delay={i * 0.05} className="h-full">
                <li className="flex h-full flex-col overflow-hidden rounded-[1.7rem] border border-[#00a5fd]/15 bg-background shadow-[0_28px_60px_-40px_rgba(0,136,212,0.7)]">
                  <div className="flex flex-1 flex-col p-5 sm:p-6">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00a5fd] to-[#0077c8] text-white shadow-[0_12px_28px_-14px_rgba(0,165,253,0.95)]">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="text-right">
                        <span className="block text-2xl font-black tabular-nums leading-none text-[#00a5fd]/30">{num}</span>
                        <span className="mt-1 block text-[11px] font-bold uppercase tracking-[0.16em] text-[#0088d4] dark:text-[#7dd3fc]">
                          {label}
                        </span>
                      </span>
                    </div>
                    <h3 className="text-xl font-bold tracking-tight">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
                  </div>
                  <div className="px-3 pb-3 sm:px-4 sm:pb-4">
                    <StepPreview step={i} t={t} />
                  </div>
                </li>
              </EnterReveal>
            ))}
          </ol>
        </div>
      </section>

      <WhatWeCheckSection autoRotate />

      {/* ───── Chain of custody — ledger rows, not floating cards ───── */}
      <section className="relative overflow-hidden border-y border-border/60 bg-muted/20 px-4 py-14 md:py-16 dark:bg-white/[0.015]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.45)_1px,transparent_1px)] [background-size:96px_100%] opacity-50" />

        <div className="relative mx-auto max-w-4xl">
          <EnterReveal inView y={12} className="mb-6">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#0088d4] dark:text-[#33bbfd]">
              {t("hiw_custody_title")}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t("hiw_custody_sub")}</p>
          </EnterReveal>

          <dl className="overflow-hidden rounded-md border border-border/70 bg-background">
            {custody.map(({ icon: Icon, key, label, desc }, i) => (
              <EnterReveal
                key={key}
                inView
                y={10}
                delay={i * 0.04}
                className={cn(i > 0 && "border-t border-border/60")}
              >
                <div className="relative grid gap-1 px-4 py-3.5 pl-6 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-baseline sm:gap-4 sm:px-5 sm:pl-7">
                  <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-[#00a5fd]/30" />
                  <dt className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-[#0088d4] dark:text-[#33bbfd]" />
                    {key}
                  </dt>
                  <dd className="min-w-0">
                    <p className="text-sm font-bold">{label}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{desc}</p>
                  </dd>
                </div>
              </EnterReveal>
            ))}
          </dl>
        </div>
      </section>

      {/* ───── CTA — navy case-intake panel ───── */}
      <section className="relative overflow-hidden bg-slate-950 px-4 py-16 md:py-20 dark:bg-[#060a12]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgba(0,165,253,0.16),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:64px_64px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00a5fd]/50 to-transparent" />

        <EnterReveal inView y={14} className="relative z-10 mx-auto max-w-3xl">
          <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] backdrop-blur-[2px]">
            <div className="flex items-center gap-2.5 border-b border-white/10 bg-white/[0.04] px-4 py-2.5 pl-5">
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-[#33bbfd]" />
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-[#33bbfd]">
                {t("hiw_cta_eyebrow")}
              </p>
              <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#d7e4f2]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00a5fd] opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#00a5fd]" />
                </span>
                {t("instant_digital_report")}
              </span>
            </div>

            <div className="space-y-7 px-4 py-8 pl-5 sm:px-8 sm:py-10 text-center">
              <div className="space-y-3">
                <h2 className="text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl md:text-4xl">
                  {t("hiw_cta_title")}
                </h2>
                <p className="mx-auto max-w-lg text-sm leading-relaxed text-[#e7eef6] sm:text-base">
                  {t("hiw_cta_subtitle")}
                </p>
              </div>

              <HeroVinForm
                vin={vin}
                onVinChange={(v) => { setVin(v); setVinError(""); }}
                onSubmit={handleCheck}
                error={vinError}
                placeholder={t("vin_placeholder")}
                helpVariant="on-dark"
                className="mx-auto max-w-xl"
              />

              <div className="flex flex-col items-center justify-center gap-2.5 border-t border-dashed border-white/10 pt-6 sm:flex-row sm:gap-3">
                <Button asChild variant="outline" size="lg" className="h-10 rounded-md border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
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
    </div>
  );
}
