import { cn } from "@/lib/utils";
import { FlagImg } from "@/components/flag-img";
import { formatImageFlagAlt } from "@/lib/flag-alt";
import { useHomeStats } from "@/lib/home-stats";
import { useTranslation } from "@/i18n/context";
import { PrefetchLink } from "@/components/prefetch-link";
import { pathForCountry } from "@/lib/localized-routes";

export function HomeStatsStrip({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  const { t, language } = useTranslation();
  const stats = useHomeStats(t);

  return (
    <div className={cn("home-stats-strip relative z-[1]", className)}>
      <span className="sr-only">{t("home_stats_from")}</span>
      <ul className="grid grid-cols-6 items-center gap-2" role="list">
        {stats.map((stat) => {
          const name = t(stat.nameKey);
          return (
            <li key={stat.id}>
              <PrefetchLink
                href={pathForCountry(language, stat.id)}
                aria-label={name}
                className="group flex min-w-0 items-center justify-center gap-2 outline-none opacity-45 transition-opacity duration-150 hover:opacity-100 focus-visible:opacity-100"
              >
                <FlagImg
                  code={stat.flag}
                  variant="nav"
                  size={22}
                  className="home-stats-flag shrink-0 rounded-md shadow-md ring-1 ring-black/10 transition-transform duration-150 group-hover:-translate-y-0.5"
                  alt={formatImageFlagAlt(stat.label, t)}
                />
                <span className={cn(
                  "min-w-0 truncate text-[13px] font-semibold transition-colors",
                  onDark
                    ? "text-[#e7eef6] group-hover:text-[#7dd3fc]"
                    : "text-slate-800 group-hover:text-[#0088d4]",
                )}>
                  {stat.label}
                </span>
              </PrefetchLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
