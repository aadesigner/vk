import type { Language } from "@/i18n/context";
import {
  localizeProviderDate,
  translateProviderChartLabel,
} from "@/lib/korean-provider-text";
import {
  convertKrwToUsd,
  isKoreanCountry,
  resolveKrwPerUsd,
} from "@/lib/korean-currency";

export type MarketChartPoint = {
  label: string;
  value: number;
  kind: "estimated" | "last_auction" | "auction_history";
};

type MarketDataSlice = {
  estimatedValue?: number | null;
  lastAuctionPrice?: number | null;
  lastAuctionDate?: string | null;
  currency?: string | null;
};

type AuctionSlice = {
  date?: string | null;
  finalPrice?: number | null;
};

/** True when market figures should be treated as KRW and converted to USD for display. */
export function marketValuesAreKrw(
  currency?: string | null,
  vehicleCountry?: string | null,
  sampleValue?: number | null,
): boolean {
  const cur = (currency ?? "").toUpperCase();
  if (cur === "KRW" || cur === "WON" || cur === "₩") return true;
  if (cur === "USD" || cur === "EUR") return false;
  if (isKoreanCountry(vehicleCountry) && (sampleValue == null || sampleValue >= 100_000)) {
    return true;
  }
  return false;
}

export function toMarketDisplayUsd(
  value: number,
  opts: {
    currency?: string | null;
    vehicleCountry?: string | null;
    krwPerUsd?: number | null;
  },
): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (!marketValuesAreKrw(opts.currency, opts.vehicleCountry, value)) {
    return Math.round(value);
  }
  const rate = resolveKrwPerUsd(opts.krwPerUsd);
  const usd = convertKrwToUsd(value, rate);
  return usd > 0 ? Math.round(usd) : Math.round(value);
}

export function buildMarketChartPoints(
  marketData: MarketDataSlice | null | undefined,
  auctionHistory: AuctionSlice[] | null | undefined,
  t: (key: string) => string,
  language: Language,
  vehicleCountry?: string | null,
  krwPerUsd?: number | null,
): MarketChartPoint[] {
  const currency = marketData?.currency ?? null;
  const toUsd = (v: number) =>
    toMarketDisplayUsd(v, { currency, vehicleCountry, krwPerUsd });

  const history = (auctionHistory ?? [])
    .filter((e) => e.finalPrice != null && e.finalPrice > 0)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  if (history.length >= 2) {
    return history.map((e, i) => ({
      label: translateProviderChartLabel(e.date, language, vehicleCountry) ?? String(i + 1),
      value: toUsd(e.finalPrice!),
      kind: "auction_history",
    }));
  }

  const points: MarketChartPoint[] = [];
  const est = marketData?.estimatedValue;
  const auction = marketData?.lastAuctionPrice;

  if (est != null && est > 0) {
    points.push({ label: t("chart_est_value"), value: toUsd(est), kind: "estimated" });
  }
  if (auction != null && auction > 0) {
    const auctionLabel =
      translateProviderChartLabel(marketData?.lastAuctionDate, language, vehicleCountry)
      ?? localizeProviderDate(marketData?.lastAuctionDate, language, undefined, vehicleCountry)
      ?? t("chart_last_auction");
    points.push({ label: auctionLabel, value: toUsd(auction), kind: "last_auction" });
  }

  if (points.length === 0 && history.length === 1) {
    points.push({
      label: translateProviderChartLabel(history[0].date, language, vehicleCountry) ?? "1",
      value: toUsd(history[0].finalPrice!),
      kind: "last_auction",
    });
  }

  return points;
}

/** Full localized auction date for market data rows (month name + day + year). */
export function formatMarketAuctionDate(
  date: string | null | undefined,
  language: Language,
  vehicleYear?: number | null,
  vehicleCountry?: string | null,
): string | null {
  return localizeProviderDate(date, language, vehicleYear, vehicleCountry);
}

export function formatMarketCurrency(value: number, currency?: string | null): string {
  const n = Math.round(Number.isFinite(value) ? value : 0);
  const code = (currency ?? "USD").toUpperCase();
  if (code === "USD" || code === "$") return `$${n.toLocaleString()}`;
  if (code === "EUR" || code === "€") return `€${n.toLocaleString()}`;
  if (code === "KRW" || code === "WON" || code === "₩") return `₩${n.toLocaleString()}`;
  return `${code} ${n.toLocaleString()}`;
}

export function marketCurrencySymbol(currency?: string | null): string {
  const code = currency ?? "USD";
  return code === "USD" ? "$" : `${code} `;
}
