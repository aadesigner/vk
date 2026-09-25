import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "@/i18n/context";
import { FlagImg } from "@/components/flag-img";
import { formatImageFlagAlt } from "@/lib/flag-alt";
import { cn } from "@/lib/utils";
import { pathFor, pathForCountry } from "@/lib/localized-routes";

const COUNTRY_CONTINENTS = ["americas", "asia"] as const;
type CountryContinent = (typeof COUNTRY_CONTINENTS)[number];

const CONTINENT_LABEL_KEY: Record<CountryContinent, "nav_continent_americas" | "nav_continent_asia"> = {
  americas: "nav_continent_americas",
  asia: "nav_continent_asia",
};

export const COUNTRY_LINKS = [
  {
    slug: "canada",
    img: "ca",
    continent: "americas" as const,
    labelKey: "country_canada_label" as const,
    nameKey: "country_canada_name" as const,
    countKey: "country_canada_count" as const,
  },
  {
    slug: "usa",
    img: "us",
    continent: "americas" as const,
    labelKey: "country_usa_label" as const,
    nameKey: "country_usa_name" as const,
    countKey: "country_usa_count" as const,
  },
  {
    slug: "korea",
    img: "kr",
    continent: "asia" as const,
    labelKey: "country_korea_label" as const,
    nameKey: "country_korea_name" as const,
    countKey: "country_korea_count" as const,
  },
  {
    slug: "uae",
    img: "ae",
    continent: "asia" as const,
    labelKey: "country_uae_label" as const,
    nameKey: "country_uae_name" as const,
    countKey: "country_uae_count" as const,
  },
  {
    slug: "china",
    img: "cn",
    continent: "asia" as const,
    labelKey: "country_china_label" as const,
    nameKey: "country_china_name" as const,
    countKey: "country_china_count" as const,
  },
  {
    slug: "japan",
    img: "jp",
    continent: "asia" as const,
    labelKey: "country_japan_label" as const,
    nameKey: "country_japan_name" as const,
    countKey: "country_japan_count" as const,
  },
] as const;

export function CountryNavMenuGroups({
  language,
  isActive,
  onNavigate,
  layout = "desktop",
}: {
  language: string;
  isActive: (slug: string) => boolean;
  onNavigate?: () => void;
  layout?: "desktop" | "mobile" | "grid";
}) {
  const { t } = useTranslation();

  if (layout === "grid") {
    return (
      <div className="grid grid-cols-2 gap-1.5">
        {COUNTRY_LINKS.map(({ slug, img, labelKey }) => {
          const active = isActive(slug);
          const label = t(labelKey);
          return (
            <Link
              key={slug}
              href={pathForCountry(language, slug)}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2.5 py-2.5 text-[13px] font-medium touch-manipulation",
                active
                  ? "bg-primary/10 text-primary"
                  : "bg-muted/50 text-foreground/85 active:bg-muted",
              )}
            >
              <FlagImg
                code={img}
                size={20}
                priority
                className="h-3.5 w-[1.35rem] shrink-0 rounded-[2px] object-cover"
                alt={formatImageFlagAlt(label, t)}
              />
              <span className="min-w-0 truncate leading-none">{label}</span>
            </Link>
          );
        })}
      </div>
    );
  }

  const groups = COUNTRY_CONTINENTS.map((continent) => ({
    continent,
    items: COUNTRY_LINKS.filter((link) => link.continent === continent),
  }));

  if (layout === "mobile") {
    return (
      <>
        {groups.map((group, groupIndex) => (
          <div key={group.continent}>
            <p
              className={cn(
                "px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground",
                groupIndex > 0 ? "pt-3" : "pt-1",
              )}
            >
              {t(CONTINENT_LABEL_KEY[group.continent])}
            </p>
            {group.items.map(({ slug, img, labelKey }) => {
              const active = isActive(slug);
              return (
                <Link
                  key={slug}
                  href={pathForCountry(language, slug)}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium touch-manipulation",
                    active ? "bg-primary/8 text-primary" : "hover:bg-primary/[0.06] active:bg-primary/10",
                  )}
                >
                  <FlagImg code={img} size={20} priority className="w-3.5 h-2.5" alt={formatImageFlagAlt(t(labelKey), t)} />
                  <span className="flex-1">{t(labelKey)}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </>
    );
  }

  return (
    <div role="menu" className="p-2.5">
      {groups.map((group, groupIndex) => (
        <div key={group.continent} className={cn(groupIndex > 0 && "mt-2 border-t border-border/50 pt-2")}>
          <p className="px-3 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
            {t(CONTINENT_LABEL_KEY[group.continent])}
          </p>
          <ul className="space-y-0.5">
            {group.items.map(({ slug, img, labelKey }) => {
              const active = isActive(slug);
              const label = t(labelKey);
              return (
                <li key={slug} role="none">
                  <Link
                    href={pathForCountry(language, slug)}
                    role="menuitem"
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-medium tracking-tight",
                      "transition-colors duration-75",
                      active
                        ? "bg-primary/[0.09] text-primary"
                        : "text-foreground/85 hover:bg-muted/70 hover:text-foreground dark:hover:bg-white/[0.06]",
                    )}
                  >
                    <FlagImg
                      code={img}
                      size={24}
                      priority
                      className="h-4 w-6 shrink-0 rounded-[2px] object-cover ring-1 ring-black/5 dark:ring-white/10"
                      alt={formatImageFlagAlt(label, t)}
                    />
                    <span className="min-w-0 flex-1 truncate leading-none">{label}</span>
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 shrink-0",
                        active ? "text-primary/70" : "text-muted-foreground/50",
                      )}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
