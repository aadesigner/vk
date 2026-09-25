/** Volkswagen passenger / commercial WMIs used by the local VW model resolver. */
export function isVagWmi(wmi: string): boolean {
  const w = wmi.toUpperCase().slice(0, 3);
  return (
    w === "WVW" || w === "WVG" || w === "WV1" || w === "WV2" || w === "WV3"
    || w === "1VW" || w === "1V2" || w === "3VW" || w === "3VV"
    || w === "9BW" || w === "8AP"
  );
}

/** Normalize alternate VAG plant WMIs so shared WVW prefix tables apply. */
export function normalizeVagVinForPremium(vin: string): string {
  const upper = vin.toUpperCase();
  if (upper.startsWith("WVG")) return `WVW${upper.slice(3)}`;
  return upper;
}
