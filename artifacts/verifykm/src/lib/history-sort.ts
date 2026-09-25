const EN_MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** Numeric sort key for history rows; higher = more recent. Missing/invalid dates sort last. */
export function historyDateSortKey(date: string | null | undefined): number {
  if (!date) return Number.NEGATIVE_INFINITY;

  const trimmed = date.trim();
  if (!trimmed) return Number.NEGATIVE_INFINITY;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const ts = Date.parse(`${trimmed}T12:00:00`);
    return Number.isNaN(ts) ? Number.NEGATIVE_INFINITY : ts;
  }

  if (/^\d{8}$/.test(trimmed)) {
    const y = trimmed.slice(0, 4);
    const m = trimmed.slice(4, 6);
    const d = trimmed.slice(6, 8);
    const ts = Date.parse(`${y}-${m}-${d}T12:00:00`);
    return Number.isNaN(ts) ? Number.NEGATIVE_INFINITY : ts;
  }

  const english = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2})(?:,\s*(\d{4}))?$/);
  if (english) {
    const month = EN_MONTHS.indexOf(english[1]!.toLowerCase());
    if (month >= 0) {
      const day = parseInt(english[2]!, 10);
      const year = english[3] ? parseInt(english[3], 10) : Number.NEGATIVE_INFINITY;
      if (year !== Number.NEGATIVE_INFINITY) {
        return Date.UTC(year, month, day);
      }
    }
  }

  const encarMonthYear = trimmed.match(/^([A-Za-z]+)\s+(\d{2})$/i);
  if (encarMonthYear) {
    const month = EN_MONTHS.indexOf(encarMonthYear[1]!.toLowerCase());
    const yy = parseInt(encarMonthYear[2]!, 10);
    if (month >= 0 && yy >= 19 && yy <= 99 && yy !== 30 && yy !== 31) {
      return Date.UTC(2000 + yy, month, 1);
    }
  }

  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function historyMileageSortKey(mileage: number | null | undefined): number {
  return mileage != null && mileage > 0 ? mileage : Number.NEGATIVE_INFINITY;
}

/** Newest first (top to bottom). Tie-break undated rows by higher mileage (proxy for recency). */
export function sortHistoryNewestFirst<T>(
  items: T[],
  getDate: (item: T) => string | null | undefined = (item) =>
    (item as { date?: string | null }).date,
  getMileage: (item: T) => number | null | undefined = (item) =>
    (item as { mileage?: number | null }).mileage ?? (item as { odometer?: number | null }).odometer,
): T[] {
  return items
    .map((item, index) => ({
      item,
      index,
      dateKey: historyDateSortKey(getDate(item)),
      mileageKey: historyMileageSortKey(getMileage(item)),
    }))
    .sort((a, b) => {
      if (a.dateKey !== b.dateKey) return b.dateKey - a.dateKey;
      if (a.mileageKey !== b.mileageKey) return b.mileageKey - a.mileageKey;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}
