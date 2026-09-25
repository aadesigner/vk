import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "@/i18n/context";
import { cn } from "@/lib/utils";
import { CoverageMapLiveMarkers } from "@/components/coverage-map-live-markers";
import type { ActiveMapLivePing } from "@/lib/coverage-live-events";
import {
  geographyTier,
  getCountryMapConfig,
  type CountryMarket,
} from "@/lib/country-map-config";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";
/** High-detail Natural Earth coastlines */
import worldTopo from "world-atlas/countries-10m.json";

const MAP_WIDTH = 1050;
const MAP_HEIGHT = 750;

function geographyStyle(
  tier: "focus" | "near" | "extended",
): Record<string, CSSProperties> {
  return {
    default: {
      fill: tier === "focus"
        ? "hsl(var(--primary) / 0.34)"
        : tier === "near"
          ? "hsl(var(--muted-foreground) / 0.06)"
          : "hsl(var(--muted-foreground) / 0.028)",
      stroke: tier === "focus"
        ? "hsl(var(--primary) / 0.38)"
        : tier === "near"
          ? "hsl(var(--border) / 0.22)"
          : "hsl(var(--border) / 0.12)",
      strokeWidth: tier === "focus" ? 0.55 : tier === "near" ? 0.3 : 0.22,
      strokeLinejoin: "round",
      strokeLinecap: "round",
      outline: "none",
    },
    hover: {
      fill: tier === "focus"
        ? "hsl(var(--primary) / 0.48)"
        : tier === "near"
          ? "hsl(var(--muted-foreground) / 0.08)"
          : "hsl(var(--muted-foreground) / 0.035)",
      stroke: tier === "focus"
        ? "hsl(var(--primary) / 0.52)"
        : tier === "near"
          ? "hsl(var(--border) / 0.22)"
          : "hsl(var(--border) / 0.12)",
      strokeWidth: tier === "focus" ? 0.65 : tier === "near" ? 0.3 : 0.22,
      outline: "none",
    },
    pressed: { outline: "none" },
  };
}

type Props = {
  country: CountryMarket;
  className?: string;
  showLivePings?: boolean;
  pings?: ActiveMapLivePing[];
  highlightPingId?: string | null;
};

export function CountryFocusMapVisual({
  country,
  className,
  showLivePings = true,
  pings = [],
  highlightPingId = null,
}: Props) {
  const { t } = useTranslation();
  const config = getCountryMapConfig(country);
  const [focusedHovered, setFocusedHovered] = useState(false);
  const glowId = `country-map-glow-${country}`;

  const visibleNames = useMemo(
    () => new Set([
      config.geographyName,
      ...config.nearbyGeographyNames,
      ...config.extendedGeographyNames,
    ]),
    [config],
  );

  const { type: projectionType, ...projectionConfig } = config.projection;
  const countryLabel = t(`country_${country}_name`);

  return (
    <>
      <span className="sr-only">{countryLabel}</span>
      <div
        className={cn(
          "country-focus-map-panel relative h-full w-full overflow-visible select-none",
          className,
        )}
        role="img"
        aria-label={countryLabel}
      >
        <div
          className={cn(
            "pointer-events-none absolute start-[16%] top-[12%] z-10 rounded-full border border-primary/25 bg-background/85 px-3 py-1.5 text-xs font-semibold text-foreground shadow-lg backdrop-blur-md transition-all duration-300",
            focusedHovered
              ? "translate-y-0 opacity-100"
              : "-translate-y-1 opacity-0",
          )}
        >
          {countryLabel}
        </div>

        {/* No CSS stretch — projection controls scale; keeps Japan/Korea proportions true */}
        <div className="flex h-full w-full items-center justify-center">
          <ComposableMap
            projection={projectionType}
            projectionConfig={projectionConfig}
            width={MAP_WIDTH}
            height={MAP_HEIGHT}
            preserveAspectRatio="xMidYMid meet"
            className="country-focus-map-svg"
          >
            <defs>
              <radialGradient id={glowId} cx="52%" cy="46%" r="55%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
                <stop offset="60%" stopColor="hsl(var(--primary))" stopOpacity="0.03" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect
              width={MAP_WIDTH}
              height={MAP_HEIGHT}
              fill={`url(#${glowId})`}
              opacity={0.55}
            />

            <Geographies geography={worldTopo}>
              {({ geographies }) =>
                geographies
                  .filter((geo) => visibleNames.has(geo.properties.name ?? ""))
                  .map((geo) => {
                    const name = geo.properties.name ?? "";
                    const tier = geographyTier(name, config);
                    if (!tier) return null;

                    const focused = tier === "focus";

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        tabIndex={focused ? 0 : -1}
                        aria-label={focused ? countryLabel : undefined}
                        onMouseEnter={() => focused && setFocusedHovered(true)}
                        onMouseLeave={() => focused && setFocusedHovered(false)}
                        onFocus={() => focused && setFocusedHovered(true)}
                        onBlur={() => focused && setFocusedHovered(false)}
                        className={cn(
                          "transition-[fill,stroke] duration-300",
                          focused
                            ? "cursor-pointer pointer-events-auto"
                            : "pointer-events-none",
                        )}
                        style={geographyStyle(tier)}
                      />
                    );
                  })
              }
            </Geographies>

            {showLivePings && pings.length > 0 && (
              <CoverageMapLiveMarkers
                pings={pings}
                highlightPingId={highlightPingId}
              />
            )}
          </ComposableMap>
        </div>

        <div aria-hidden className="country-focus-map-vignette" />
        <div aria-hidden className="country-focus-map-vignette-left" />
      </div>
    </>
  );
}
