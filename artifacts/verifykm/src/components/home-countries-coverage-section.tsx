import { Link } from "wouter";
import { EnterReveal } from "@/components/enter-reveal";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/context";
import { formatImageFlagAlt } from "@/lib/flag-alt";
import { pathForCountry } from "@/lib/localized-routes";

type Market = {
  slug: string;
  flagCode: string;
  nameKey: string;
  hintKey: string;
};

const MARKETS: Market[] = [
  { slug: "usa", flagCode: "us", nameKey: "country_usa_name", hintKey: "home_country_usa_h0" },
  { slug: "korea", flagCode: "kr", nameKey: "country_korea_name", hintKey: "home_country_korea_h0" },
  { slug: "canada", flagCode: "ca", nameKey: "country_canada_name", hintKey: "home_country_canada_h0" },
  { slug: "china", flagCode: "cn", nameKey: "country_china_name", hintKey: "home_country_china_h0" },
  { slug: "japan", flagCode: "jp", nameKey: "country_japan_name", hintKey: "home_country_japan_h0" },
  { slug: "uae", flagCode: "ae", nameKey: "country_uae_name", hintKey: "home_country_uae_h0" },
];

/** Markets strip — dossier lanes, not kmcheck-style country cards / world map. */
export function HomeCountriesCoverageSection() {
  const { t, language } = useTranslation();

  return (
    <section className="relative overflow-hidden border-y border-[#00a5fd]/10 bg-[#030712] py-14 md:py-20 px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(0,165,253,0.12),transparent)]" />
      <div className="relative mx-auto max-w-5xl">
        <EnterReveal inView y={12} className="mb-8 md:mb-10 space-y-2 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#00a5fd]">
            {t("stats_countries_badge")}
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
            {t("countries_title")}
          </h2>
          <p className="mx-auto max-w-xl text-sm md:text-base text-white/50">
            {t("countries_subtitle")}
          </p>
        </EnterReveal>

        <div className="divide-y divide-white/10 rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
          {MARKETS.map((m, i) => (
            <EnterReveal key={m.slug} inView y={8} delay={i * 0.03}>
              <Link
                href={pathForCountry(language, m.slug)}
                className={cn(
                  "group flex items-center gap-4 px-4 py-3.5 sm:px-5 sm:py-4",
                  "hover:bg-[#00a5fd]/10 transition-colors",
                )}
              >
                <img
                  src={`https://flagcdn.com/${m.flagCode}.svg`}
                  alt={formatImageFlagAlt(t(m.nameKey), t)}
                  width={28}
                  height={20}
                  loading="lazy"
                  decoding="async"
                  className="h-5 w-auto rounded-[2px] shadow-sm ring-1 ring-white/10"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white tracking-tight">{t(m.nameKey)}</p>
                  <p className="text-xs text-white/45 truncate">{t(m.hintKey)}</p>
                </div>
                <span className="hidden sm:inline text-[11px] font-semibold uppercase tracking-wider text-[#00a5fd]/80 group-hover:text-[#00a5fd]">
                  {t("footer_investigate_label")}
                </span>
                <ArrowRight className="h-4 w-4 text-white/30 group-hover:text-[#00a5fd] group-hover:translate-x-0.5 transition-all" />
              </Link>
            </EnterReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
