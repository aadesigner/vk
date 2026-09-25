import { resolveKrwPerUsd } from "@/lib/korean-currency";
import { useKrwPerUsd } from "@/hooks/use-krw-per-usd";

/** Prefer the live admin rate so Settings → KRW/USD updates all Korean report amounts. */
export function useReportKrwPerUsd(_stored?: number | null): number {
  return useKrwPerUsd();
}

export function resolveReportKrwPerUsd(_stored: number | null | undefined, fallback: number): number {
  return resolveKrwPerUsd(fallback);
}
