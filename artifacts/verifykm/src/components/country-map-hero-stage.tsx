import { useMemo } from "react";
import { EnterReveal } from "@/components/enter-reveal";
import { CountryFocusMapVisual } from "@/components/country-focus-map-visual";
import { VinDemoCard } from "@/components/vin-demo-card";
import { useCoverageMapLivePings } from "@/hooks/use-coverage-map-live-pings";
import { citiesForCountry } from "@/lib/coverage-live-events";
import {
  getCountryMapConfig,
  type CountryMarket,
} from "@/lib/country-map-config";

type Props = {
  country: CountryMarket;
};

export function CountryMapHeroStage({ country }: Props) {
  const config = getCountryMapConfig(country);
  const liveCities = useMemo(
    () => citiesForCountry(config.liveCityIds),
    [config.liveCityIds],
  );
  const livePings = useCoverageMapLivePings({
    cities: liveCities,
    maxPings: 10,
    maxLabels: 3,
    enabled: true,
  });

  const featuredPing = useMemo(() => {
    if (livePings.length === 0) return null;
    for (let i = livePings.length - 1; i >= 0; i -= 1) {
      if (livePings[i]!.showLabel) return livePings[i]!;
    }
    return livePings[livePings.length - 1]!;
  }, [livePings]);

  return (
    <EnterReveal y={16} delay={0.08} className="relative hidden lg:block w-full min-w-0">
      <div className="relative w-full min-h-[500px] lg:min-h-[560px] xl:min-h-[600px]">
        <CountryFocusMapVisual
          country={country}
          pings={livePings}
          highlightPingId={featuredPing?.pingId}
          showLivePings
          className="absolute inset-0 h-full w-full"
        />

        <div className="absolute top-[8%] end-[1%] z-10 w-[300px] pointer-events-none">
          <VinDemoCard country={country} showcase overlay livePing={featuredPing} />
        </div>
      </div>
    </EnterReveal>
  );
}
