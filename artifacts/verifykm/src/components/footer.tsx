import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PrefetchLink } from "@/components/prefetch-link";
import { useTranslation, ensureDict } from "@/i18n/context";
import { VerifyKMLogo } from "@/components/logo";
import { ChevronUp, ArrowRight } from "lucide-react";
import { setStoredLangPreference } from "@/lib/lang-preference";
import {
  LANG_PICKER_OPTIONS,
  isSupportedLang,
  localeHomePath,
  type Language,
} from "@/lib/languages";
import { FlagImg, prefetchFlags } from "@/components/flag-img";
import { formatImageFlagAlt } from "@/lib/flag-alt";
import { LangPickerList, usePrefetchPickerFlags } from "@/components/lang-picker-list";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { pathFor, pathForCountry, remapPathForLang } from "@/lib/localized-routes";
import { Button } from "@/components/ui/button";

type FooterLangPos = { bottom: number; left: number };

function measureFooterLangPos(btn: HTMLButtonElement): FooterLangPos {
  const rect = btn.getBoundingClientRect();
  return {
    bottom: window.innerHeight - rect.top + 10,
    left: Math.max(12, Math.min(rect.left, window.innerWidth - 18 * 16 - 12)),
  };
}

const LANGS = LANG_PICKER_OPTIONS.map((l) => ({
  code: l.code,
  label: l.label,
  img: l.flag,
}));

const MARKETS = [
  { code: "us", slug: "usa", nameKey: "country_usa_name" },
  { code: "kr", slug: "korea", nameKey: "country_korea_name" },
  { code: "ca", slug: "canada", nameKey: "country_canada_name" },
  { code: "cn", slug: "china", nameKey: "country_china_name" },
  { code: "jp", slug: "japan", nameKey: "country_japan_name" },
  { code: "ae", slug: "uae", nameKey: "country_uae_name" },
] as const;

const EXPLORE_LINKS = [
  { page: "how_it_works" as const, labelKey: "nav_how_it_works" },
  { page: "pricing" as const, labelKey: "pricing" },
  { page: "faq" as const, labelKey: "nav_faq" },
  { page: "blog" as const, labelKey: "nav_blog" },
] as const;

const LEGAL_LINKS = [
  { href: (lang: string) => `/${lang}/terms`, labelKey: "terms" },
  { href: (lang: string) => `/${lang}/privacy`, labelKey: "privacy" },
  { href: (lang: string) => `/${lang}/privacy#cookies`, labelKey: "cookies" },
] as const;

export function Footer() {
  const { t, language, setLanguage } = useTranslation();
  const [location, setLocation] = useLocation();
  const [langOpen, setLangOpen] = useState(false);
  const langBtnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<FooterLangPos | null>(null);

  const current = LANGS.find((l) => l.code === language) ?? LANGS[0];

  usePrefetchPickerFlags(langOpen);

  useEffect(() => {
    prefetchFlags(MARKETS.map((m) => m.code));
  }, []);

  useLayoutEffect(() => {
    if (!langOpen || !langBtnRef.current) {
      if (!langOpen) setPos(null);
      return;
    }
    const place = () => {
      if (!langBtnRef.current) return;
      setPos(measureFooterLangPos(langBtnRef.current));
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [langOpen]);

  useEffect(() => {
    if (!langOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLangOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [langOpen]);

  const handleLanguageChange = (lang: string) => {
    if (!isSupportedLang(lang)) return;
    const next: Language = lang;
    const here = typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}${window.location.hash}`
      : location;
    const target = remapPathForLang(here, language, next);
    void ensureDict(next).then(() => {
      setStoredLangPreference(next);
      setLanguage(next);
      setLocation(target);
      setLangOpen(false);
    });
  };

  const shell = "mx-auto w-full max-w-[80rem] px-5 sm:px-8 lg:px-12 xl:px-16";

  return (
    <footer className="relative overflow-hidden border-t border-[#00a5fd]/25 bg-[#020617] text-white print:hidden">
      <div className="flex h-1 w-full" aria-hidden>
        <span className="flex-1 bg-[#00a5fd]" />
        <span className="w-24 bg-[#7dd3fc]" />
        <span className="w-12 bg-white/20" />
      </div>
      <div className="pointer-events-none absolute -right-16 top-16 h-72 w-72 rounded-full bg-[#00a5fd]/[0.08] blur-3xl" />
      <div className="pointer-events-none absolute -left-20 bottom-0 h-56 w-56 rounded-full bg-[#00a5fd]/[0.05] blur-3xl" />

      <div className="relative border-b border-white/8 bg-[#00a5fd]/[0.08]">
        <div className={cn(shell, "flex flex-col items-start justify-between gap-6 py-9 sm:flex-row sm:items-center sm:py-11")}>
          <div className="max-w-3xl space-y-2">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.28em] text-[#7dd3fc]">
              {t("footer_investigate_label")}
            </p>
            <p className="text-xl font-extrabold tracking-tight text-white sm:text-2xl lg:text-[1.75rem] lg:leading-snug">
              {t("footer_investigate_cta")}
            </p>
          </div>
          <Button asChild className="h-12 shrink-0 rounded-md bg-[#00a5fd] px-7 font-bold text-[#041018] shadow-none hover:bg-[#33bbfd]">
            <PrefetchLink
              href={`/${language}#check-vin`}
              onClick={(e) => {
                const path = (location.split("?")[0] ?? "").replace(/\/$/, "") || "/";
                const home = `/${language}`.replace(/\/$/, "") || "/";
                if (path !== home && path !== "/") return;
                e.preventDefault();
                const el = document.getElementById("check-vin");
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
                window.setTimeout(() => el?.querySelector("input")?.focus(), 300);
              }}
            >
              {t("check_vin")}
              <ArrowRight className="h-4 w-4" />
            </PrefetchLink>
          </Button>
        </div>
      </div>

      <div className={cn(shell, "relative grid gap-12 py-14 lg:grid-cols-12 lg:gap-x-12 lg:gap-y-10 lg:py-16")}>
        <div className="space-y-5 lg:col-span-5">
          <PrefetchLink href={`/${language}`} className="inline-flex">
            <VerifyKMLogo variant="dark" className="h-14 md:h-16" />
          </PrefetchLink>
          <p className="max-w-xl text-[15px] leading-relaxed text-[#e7eef6]">
            {t("footer_tagline")}
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#9fd4f5]">
            {t("footer_data_source")}
          </p>
        </div>

        <div className="grid gap-10 sm:grid-cols-2 lg:col-span-4 lg:gap-8">
          <div>
            <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#7dd3fc]">
              {t("footer_explore")}
            </p>
            <ul className="space-y-3">
              {EXPLORE_LINKS.map(({ page, labelKey }) => (
                <li key={page}>
                  <PrefetchLink
                    href={pathFor(language, page)}
                    className="text-sm text-[#e7eef6] transition-colors hover:text-white"
                  >
                    {t(labelKey)}
                  </PrefetchLink>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#7dd3fc]">
              {t("footer_legal")}
            </p>
            <ul className="space-y-3">
              {LEGAL_LINKS.map(({ href, labelKey }) => (
                <li key={labelKey}>
                  <PrefetchLink
                    href={href(language)}
                    className="text-sm text-[#e7eef6] transition-colors hover:text-white"
                  >
                    {t(labelKey)}
                  </PrefetchLink>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-3.5 lg:col-span-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#7dd3fc]">
            {t("footer_language")}
          </p>
          <button
            ref={langBtnRef}
            type="button"
            aria-haspopup="listbox"
            aria-expanded={langOpen}
            aria-label={current.label}
            onClick={() => {
              if (langOpen) {
                setLangOpen(false);
                setPos(null);
                return;
              }
              setLangOpen(true);
            }}
            className="inline-flex h-11 w-full items-center gap-2.5 rounded-md border border-white/12 bg-white/[0.06] px-3.5 text-sm text-white/85 hover:border-[#00a5fd]/40 hover:bg-white/[0.09]"
          >
            <FlagImg code={current.img} size={16} priority alt={formatImageFlagAlt(current.label, t)} />
            <span className="flex-1 truncate text-left font-medium">{current.label}</span>
            <ChevronUp className={cn("h-3.5 w-3.5 opacity-55", langOpen && "rotate-180")} />
          </button>

          {typeof document !== "undefined"
            ? createPortal(
                <AnimatePresence>
                  {langOpen && pos && (
                    <motion.div
                      className="fixed inset-0 z-[90]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onMouseDown={() => {
                        setLangOpen(false);
                        setPos(null);
                      }}
                    >
                      <motion.div
                        role="listbox"
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.98 }}
                        transition={{ duration: 0.18 }}
                        className="absolute w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-white/12 bg-[#0c121c] p-1.5 shadow-[0_-16px_48px_-12px_rgba(0,0,0,0.65)]"
                        style={{ bottom: pos.bottom, left: pos.left }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <div className="max-h-[min(20rem,50vh)] overflow-y-auto">
                          <LangPickerList
                            language={language}
                            tone="footer"
                            hrefForLanguage={(code) =>
                              remapPathForLang(
                                typeof window !== "undefined"
                                  ? `${window.location.pathname}${window.location.search}${window.location.hash}`
                                  : location,
                                language,
                                code,
                              )
                            }
                            onSelect={handleLanguageChange}
                          />
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>,
                document.body,
              )
            : null}

          <nav aria-label={t("footer_language")} className="pt-1">
            <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
              {LANG_PICKER_OPTIONS.map((l) => {
                const active = l.code === language;
                return (
                  <li key={l.code}>
                    <PrefetchLink
                      href={localeHomePath(l.code)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "text-[12px] leading-snug transition-colors",
                        active ? "font-semibold text-white" : "text-[#d7e4f2] hover:text-white",
                      )}
                      onClick={() => {
                        setStoredLangPreference(l.code);
                        setLanguage(l.code);
                      }}
                    >
                      {l.label}
                    </PrefetchLink>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>

      <div className="relative border-t border-white/8">
        <div className={cn(shell, "py-8")}>
          <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#7dd3fc]">
            {t("footer_markets")}
          </p>
          <div className="flex flex-wrap gap-2.5">
            {MARKETS.map(({ code, slug, nameKey }) => (
              <PrefetchLink
                key={slug}
                href={pathForCountry(language, slug)}
                className="inline-flex items-center gap-2.5 rounded-md border border-white/12 bg-white/[0.05] px-3.5 py-2 text-sm text-[#e7eef6] transition-colors hover:border-[#00a5fd]/45 hover:bg-white/[0.08] hover:text-white"
              >
                <FlagImg code={code} size={16} className="rounded-[1px]" alt={formatImageFlagAlt(t(nameKey), t)} />
                {t(nameKey)}
              </PrefetchLink>
            ))}
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/8 bg-[#01040c]">
        <div className={cn(shell, "flex flex-col gap-2 py-5 text-[12px] text-[#d7e4f2] sm:flex-row sm:items-center sm:justify-between")}>
          <p className="font-medium text-white/80">© {new Date().getFullYear()} VerifyKM.com</p>
          <p>{t("footer_rights_line")}</p>
        </div>
      </div>
    </footer>
  );
}
