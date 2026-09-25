/** Normalize provider fuel tokens (Carstat, NHTSA, auction APIs). */
function normalizeFuelToken(value: string): string {
  return value.toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

const FUEL_EXACT_KEYS: Record<string, string> = {
  gas: "fuel_petrol",
  gasoline: "fuel_petrol",
  petrol: "fuel_petrol",
  benzin: "fuel_petrol",
  benzine: "fuel_petrol",
  unleaded: "fuel_petrol",
  diesel: "fuel_diesel",
  "diesel fuel": "fuel_diesel",
  biodiesel: "fuel_biodiesel",
  electric: "fuel_electric",
  ev: "fuel_electric",
  bev: "fuel_electric",
  hybrid: "fuel_hybrid",
  hev: "fuel_hybrid",
  "plug-in hybrid": "fuel_phev",
  "plug in hybrid": "fuel_phev",
  phev: "fuel_phev",
  lpg: "fuel_lpg",
  "liquefied petroleum gas": "fuel_lpg",
  hydrogen: "fuel_hydrogen",
  fcev: "fuel_hydrogen",
  cng: "fuel_cng",
  "natural gas": "fuel_cng",
  "compressed natural gas": "fuel_cng",
  "flex fuel": "fuel_flex",
  flex: "fuel_flex",
  e85: "fuel_e85",
  ethanol: "fuel_e85",
};

function resolveFuelI18nKey(normalized: string): string | null {
  const exact = FUEL_EXACT_KEYS[normalized];
  if (exact) return exact;

  const first = normalized.split(/[\s,/;|]+/)[0] ?? "";
  if (first && FUEL_EXACT_KEYS[first]) return FUEL_EXACT_KEYS[first];

  if (/plug[- ]?in/.test(normalized) && normalized.includes("hybrid")) return "fuel_phev";
  if (normalized.includes("diesel")) return "fuel_diesel";
  if (normalized.includes("hybrid")) return "fuel_hybrid";
  if (normalized.includes("electric") || normalized.includes("battery")) return "fuel_electric";
  if (normalized.includes("hydrogen")) return "fuel_hydrogen";
  if (normalized.includes("lpg") || normalized.includes("propane")) return "fuel_lpg";
  if (normalized.includes("cng") || normalized.includes("natural gas")) return "fuel_cng";
  if (normalized.includes("ethanol") || normalized.includes("e85")) return "fuel_e85";
  if (normalized.includes("biodiesel")) return "fuel_biodiesel";
  if (
    normalized.includes("gasoline")
    || normalized.includes("petrol")
    || normalized.includes("benzin")
    || /\bgas\b/.test(normalized)
  ) {
    return "fuel_petrol";
  }

  return null;
}

export function translateFuelType(
  t: (key: string) => string,
  value: string | null | undefined,
): string | null {
  if (!value || value === "[object Object]") return null;
  const key = resolveFuelI18nKey(normalizeFuelToken(value));
  if (!key) return null;
  const translated = t(key);
  return translated !== key ? translated : value;
}
