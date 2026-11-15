/**
 * Mileage severity colors for gauges / badges / status cards.
 * Thresholds are in **km** (canonical report unit; miles are display-only).
 *
 * Bands (approx.):
 * - 0–80k   green
 * - 80–140k lime / light green-yellow
 * - 140–180k amber / yellow
 * - 180–240k light orange
 * - 240–275k deep orange
 * - 275k+   red
 */
export function mileageColor(km: number): { bar: string; dot: string; text: string } {
  if (km < 80_000) {
    return {
      bar: "bg-emerald-500",
      dot: "bg-emerald-500 ring-emerald-500/30",
      text: "text-emerald-700 dark:text-emerald-400",
    };
  }
  if (km < 140_000) {
    return {
      bar: "bg-lime-500",
      dot: "bg-lime-500 ring-lime-500/30",
      text: "text-lime-700 dark:text-lime-400",
    };
  }
  if (km < 180_000) {
    return {
      bar: "bg-amber-400",
      dot: "bg-amber-400 ring-amber-400/30",
      text: "text-amber-700 dark:text-amber-300",
    };
  }
  if (km < 240_000) {
    return {
      bar: "bg-orange-400",
      dot: "bg-orange-400 ring-orange-400/30",
      text: "text-orange-700 dark:text-orange-300",
    };
  }
  if (km < 275_000) {
    return {
      bar: "bg-orange-600",
      dot: "bg-orange-600 ring-orange-600/30",
      text: "text-orange-800 dark:text-orange-300",
    };
  }
  return {
    bar: "bg-red-500",
    dot: "bg-red-500 ring-red-500/30",
    text: "text-red-700 dark:text-red-400",
  };
}
