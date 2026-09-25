import { db, systemSettingsTable } from "@workspace/db";
import { desc } from "drizzle-orm";

export const DEFAULT_KRW_PER_USD = 1415;

export function isKoreanReportData(data: Record<string, unknown> | null | undefined): boolean {
  return String(data?.country ?? "").toLowerCase() === "kr";
}

export function readFrozenKrwPerUsd(data: Record<string, unknown> | null | undefined): number | null {
  const rate = data?.krwPerUsd;
  return typeof rate === "number" && rate > 0 ? rate : null;
}

/** Stamp exchange rate on Korean report payloads; preserve an existing frozen rate when set. */
export function applyFrozenKrwPerUsd(
  data: Record<string, unknown>,
  opts: { existingRate?: number | null; currentRate: number },
): Record<string, unknown> {
  if (!isKoreanReportData(data)) return data;

  const frozen = opts.existingRate ?? readFrozenKrwPerUsd(data);
  if (frozen != null) {
    return frozen === data.krwPerUsd ? data : { ...data, krwPerUsd: frozen };
  }

  const rate = opts.currentRate > 0 ? opts.currentRate : DEFAULT_KRW_PER_USD;
  return { ...data, krwPerUsd: rate };
}

export async function getCurrentKrwPerUsd(): Promise<number> {
  const [settings] = await db
    .select({ krwPerUsd: systemSettingsTable.krwPerUsd })
    .from(systemSettingsTable)
    .orderBy(desc(systemSettingsTable.id))
    .limit(1);

  const rate = settings?.krwPerUsd;
  return typeof rate === "number" && rate > 0 ? rate : DEFAULT_KRW_PER_USD;
}
