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
      <p
        className={cn(
          "text-center font-mono text-[10px] font-bold uppercase tracking-[0.2em]",
          onDark ? "text-white/40" : "text-slate-400",
        )}
      >
        {t("home_stats_from")}
      </p>
      <ul className="mt-4 flex flex-wrap items-center justify-center gap-2" role="list">
        {stats.map((stat) => {
          const name = t(stat.nameKey);
          return (
            <li key={stat.id}>
              <PrefetchLink
                href={pathForCountry(language, stat.id)}
                aria-label={name}
                className={cn(
                  "group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 outline-none transition-colors duration-150",
                  onDark
                    ? "border-white/15 bg-white/5 hover:border-[#00a5fd]/45 hover:bg-white/10"
                    : "border-[#00a5fd]/15 bg-[#f7fbfe] hover:border-[#00a5fd]/40 hover:bg-white",
                )}
              >
                <FlagImg
                  code={stat.flag}
                  variant="nav"
                  size={18}
                  className="home-stats-flag shrink-0 rounded-[3px] ring-1 ring-black/10"
                  alt={formatImageFlagAlt(stat.label, t)}
                />
                <span
                  className={cn(
                    "text-[13px] font-semibold leading-none",
                    onDark
                      ? "text-[#e7eef6] group-hover:text-[#7dd3fc]"
                      : "text-slate-800 group-hover:text-[#0088d4]",
                  )}
                >
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
