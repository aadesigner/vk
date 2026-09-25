import type { Language } from "@/lib/languages";

type LocalCurrency = {
  code: string;
  locale: string;
  /** Whole units for lek, hryvnia, and rubles. Two decimals where the unit is closer to the euro. */
  digits: 0 | 2;
};

/**
 * Home currency for each language. Euro-area languages stay off this map
 * (German, Spanish, French, and English), so the price stays in euros there.
 */
export const LOCAL_CURRENCY: Partial<Record<Language, LocalCurrency>> = {
  sq: { code: "ALL", locale: "sq-AL", digits: 0 },
  pl: { code: "PLN", locale: "pl-PL", digits: 2 },
  ro: { code: "RON", locale: "ro-RO", digits: 2 },
  bg: { code: "BGN", locale: "bg-BG", digits: 2 },
  ka: { code: "GEL", locale: "ka-GE", digits: 2 },
  ar: { code: "SAR", locale: "ar-SA", digits: 2 },
  uk: { code: "UAH", locale: "uk-UA", digits: 0 },
  ru: { code: "RUB", locale: "ru-RU", digits: 0 },
  zh: { code: "CNY", locale: "zh-CN", digits: 2 },
};

const RATE_URLS = [
  "https://latest.currency-api.pages.dev/v1/currencies/eur.min.json",
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.min.json",
];

let cachedRates: Record<string, number> | null = null;
let pendingRates: Promise<Record<string, number> | null> | null = null;

/** EUR rates per unit. Display only. Payment stays in euros. */
export function loadEurRates(): Promise<Record<string, number> | null> {
  if (cachedRates) return Promise.resolve(cachedRates);
  if (pendingRates) return pendingRates;
  pendingRates = (async () => {
    for (const url of RATE_URLS) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = (await res.json()) as { eur?: Record<string, number> };
        const eur = data?.eur;
        if (eur && typeof eur === "object") {
          cachedRates = eur;
          return cachedRates;
        }
      } catch {
        /* try the next source */
      }
    }
    pendingRates = null;
    return null;
  })();
  return pendingRates;
}

export function convertIndicative(eur: number, rate: number, digits: 0 | 2): number {
  if (digits === 0) return Math.round(eur * rate);
  return Math.round(eur * rate * 100) / 100;
}

export function formatLocalAmount(amount: number, spec: LocalCurrency): string {
  return new Intl.NumberFormat(spec.locale, {
    style: "currency",
    currency: spec.code,
    minimumFractionDigits: spec.digits,
    maximumFractionDigits: spec.digits,
  }).format(amount);
}

export function indicativeLocalLabels(
  language: Language,
  rate: number,
  saleEur: number,
  listEur: number | null,
): { sale: string; list: string | null } | null {
  const spec = LOCAL_CURRENCY[language];
  if (!spec || !(rate > 0)) return null;
  return {
    sale: formatLocalAmount(convertIndicative(saleEur, rate, spec.digits), spec),
    list:
      listEur != null && listEur > saleEur
        ? formatLocalAmount(convertIndicative(listEur, rate, spec.digits), spec)
        : null,
  };
}
