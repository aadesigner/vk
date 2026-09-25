import type { DemoCar } from "@/components/vin-demo-card";
import type { CoverageLiveEventKey } from "@/lib/coverage-live-events";

/** Pick the demo vehicle that best illustrates a decorative map ping. */
export function demoCarIndexForLiveEvent(
  cars: DemoCar[],
  eventKey: CoverageLiveEventKey,
): number {
  if (cars.length === 0) return 0;

  const ranked = cars
    .map((car, index) => ({ car, index, score: scoreDemoCarForEvent(car, eventKey) }))
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.index ?? 0;
}

function scoreDemoCarForEvent(car: DemoCar, eventKey: CoverageLiveEventKey): number {
  switch (eventKey) {
    case "live_feed_ping_accident":
      return car.accidents >= 3 ? 4 : car.accidents > 0 ? 3 : 0;
    case "live_feed_ping_auction":
      return car.salvage ? 4 : car.condition === "RISK" ? 3 : car.condition === "CAUTION" ? 2 : 1;
    case "live_feed_ping_insurance":
      return car.condition === "CLEAN" ? 3 : car.accidents === 0 ? 2 : 0;
    case "live_feed_ping_salvage":
      return car.salvage ? 4 : car.condition === "RISK" ? 2 : 0;
    case "live_feed_ping_theft":
      return car.stolen ? 4 : car.condition === "RISK" ? 2 : 0;
    default:
      return 0;
  }
}
