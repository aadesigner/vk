import { useEffect, useState } from "react";
import type { Language } from "@/lib/languages";
import {
  LOCAL_CURRENCY,
  indicativeLocalLabels,
  loadEurRates,
} from "@/lib/indicative-local-price";

/** Rough local-currency line under the euro price. Hidden when rates fail to load. */
export function useIndicativeLocalPrice(
  language: Language,
  chargeCurrency: string,
  saleEur: number,
  listEur: number | null,
): { sale: string; list: string | null } | null {
  const spec = chargeCurrency === "EUR" ? LOCAL_CURRENCY[language] : undefined;
  const [rate, setRate] = useState<number | null>(null);

  useEffect(() => {
    setRate(null);
    if (!spec) return;
    let cancelled = false;
    void loadEurRates().then((rates) => {
      if (cancelled || !rates) return;
      const next = rates[spec.code.toLowerCase()];
      if (typeof next === "number" && next > 0) setRate(next);
    });
    return () => {
      cancelled = true;
    };
  }, [spec]);

  if (!spec || rate == null) return null;
  return indicativeLocalLabels(language, rate, saleEur, listEur);
}
