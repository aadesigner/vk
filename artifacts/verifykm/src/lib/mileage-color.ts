export function mileageColor(km: number): { bar: string; dot: string; text: string } {
  if (km < 100_000) return { bar: "bg-[#00a5fd]",  dot: "bg-[#00a5fd] ring-[#00a5fd]/30",  text: "text-[#0369a1] dark:text-[#33bbfd]" };
  if (km < 140_000) return { bar: "bg-lime-500",   dot: "bg-lime-500 ring-lime-500/30",   text: "text-lime-700 dark:text-lime-400" };
  if (km < 180_000) return { bar: "bg-amber-500",  dot: "bg-amber-500 ring-amber-500/30", text: "text-amber-700 dark:text-amber-400" };
  if (km < 200_000) return { bar: "bg-orange-500", dot: "bg-orange-500 ring-orange-500/30", text: "text-orange-700 dark:text-orange-400" };
  if (km < 230_000) return { bar: "bg-orange-600", dot: "bg-orange-600 ring-orange-600/30", text: "text-orange-800 dark:text-orange-300" };
  if (km < 250_000) return { bar: "bg-orange-700", dot: "bg-orange-700 ring-orange-700/30", text: "text-orange-800 dark:text-orange-300" };
  return               { bar: "bg-red-600",    dot: "bg-red-600 ring-red-600/30",    text: "text-red-800 dark:text-red-300" };
}
