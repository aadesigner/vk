/**
 * Encar uses "Month YY" (e.g. "January 20" = Jan 2020, "August 23" = Aug 2023).
 * Legacy JS Date parsing produced calendar dates in year 2001 ("August 23, 2001").
 */

const ENGLISH_MONTH_INDEX: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

export function isoDateYear(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-\d{2}-\d{2}/);
  return m ? Number(m[1]) : null;
}

function encarMonthYearIso(month: number, twoDigitYear: number): string {
  const year = 2000 + twoDigitYear;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/** "August 23, 2001" / "August 23" mis-parsed — reinterpret as Encar month + 2-digit year. */
export function repairEnglishMonthYearLabel(
  text: string | null | undefined,
  vehicleYear?: number | null,
): string | null {
  if (!text) return null;
  const trimmed = text.trim();

  const with2001 = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+2001$/i);
  if (with2001) {
    const month = ENGLISH_MONTH_INDEX[with2001[1]!.toLowerCase()];
    const yy = parseInt(with2001[2]!, 10);
    if (month != null && yy >= 19 && yy <= 99) {
      const iso = encarMonthYearIso(month, yy);
      return applyVehicleYearFloor(iso, vehicleYear);
    }
    return null;
  }

  const monthYy = trimmed.match(/^([A-Za-z]+)\s+(\d{2})$/i);
  if (monthYy) {
    const month = ENGLISH_MONTH_INDEX[monthYy[1]!.toLowerCase()];
    const yy = parseInt(monthYy[2]!, 10);
    if (month == null || yy < 19 || yy > 99) return null;
    if (yy === 30 || yy === 31) return null;
    const iso = encarMonthYearIso(month, yy);
    return applyVehicleYearFloor(iso, vehicleYear);
  }

  return null;
}

/** US / provider calendar labels → YYYY-MM-DD (not Encar month+YY). */
function flexibleNumericDateToIso(text: string): string | null {
  const ymd = text.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?:\b|[T\s])/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2]!.padStart(2, "0")}-${ymd[3]!.padStart(2, "0")}`;
  }

  const dmy = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmy) {
    const a = parseInt(dmy[1]!, 10);
    const b = parseInt(dmy[2]!, 10);
    const year = dmy[3]!;
    let month: number;
    let day: number;
    if (a > 12) {
      day = a;
      month = b;
    } else if (b > 12) {
      month = a;
      day = b;
    } else {
      day = a;
      month = b;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
}

function standardCalendarLabelToIso(text: string): string | null {
  const flexible = flexibleNumericDateToIso(text);
  if (flexible) return flexible;

  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    return `${slash[3]}-${slash[1]!.padStart(2, "0")}-${slash[2]!.padStart(2, "0")}`;
  }

  const monthDayYear = text.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/i);
  if (monthDayYear) {
    const month = ENGLISH_MONTH_INDEX[monthDayYear[1]!.toLowerCase()];
    if (month != null) {
      return `${monthDayYear[3]}-${String(month).padStart(2, "0")}-${String(monthDayYear[2]).padStart(2, "0")}`;
    }
  }

  const dayMonthYear = text.match(/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/i);
  if (dayMonthYear) {
    const month = ENGLISH_MONTH_INDEX[dayMonthYear[2]!.toLowerCase()];
    if (month != null) {
      return `${dayMonthYear[3]}-${String(month).padStart(2, "0")}-${String(dayMonthYear[1]).padStart(2, "0")}`;
    }
  }

  const yearMonth = text.match(/^(\d{4})-(\d{2})$/);
  if (yearMonth) return `${yearMonth[1]}-${yearMonth[2]}-01`;

  return null;
}

/** ISO dates like 2001-08-23 from JS parsing "August 23" — day field holds 2-digit year. */
export function repairEncarMisParsedIsoDate(
  iso: string | null | undefined,
  vehicleYear?: number | null,
): string | null {
  if (!iso) return null;
  const m = iso.match(/^2001-(\d{2})-(\d{2})$/);
  if (!m) return iso;

  const month = Number(m[1]);
  const twoDigitYear = Number(m[2]);
  if (month < 1 || month > 12 || twoDigitYear < 19 || twoDigitYear > 99) return iso;

  const repaired = encarMonthYearIso(month, twoDigitYear);
  return applyVehicleYearFloor(repaired, vehicleYear);
}

export function applyVehicleYearFloor(
  iso: string | null | undefined,
  vehicleYear?: number | null,
): string | null {
  if (!iso) return null;
  const y = isoDateYear(iso);
  if (y == null) return iso;
  if (vehicleYear != null && y < vehicleYear) return null;
  if (y > new Date().getFullYear() + 1) return null;
  return iso;
}

/** Normalize stored report dates — repair Encar mis-parses and drop pre-production years. */
export function sanitizeReportIsoDate(
  date: string | null | undefined,
  vehicleYear?: number | null,
): string | null {
  if (date == null || date === "") return null;
  const trimmed = date.trim();
  if (!trimmed) return null;

  const fromLabel = repairEnglishMonthYearLabel(trimmed, vehicleYear);
  if (fromLabel) return fromLabel;

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const iso = trimmed.slice(0, 10);
    const repaired = repairEncarMisParsedIsoDate(iso, vehicleYear);
    return applyVehicleYearFloor(repaired, vehicleYear);
  }

  if (/^\d{8}$/.test(trimmed)) {
    const iso = `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
    return applyVehicleYearFloor(repairEncarMisParsedIsoDate(iso, vehicleYear), vehicleYear);
  }

  const fromCalendar = standardCalendarLabelToIso(trimmed);
  if (fromCalendar) {
    return applyVehicleYearFloor(fromCalendar, vehicleYear);
  }

  const encarOnly = repairEnglishMonthYearLabel(trimmed, vehicleYear);
  return applyVehicleYearFloor(encarOnly, vehicleYear);
}

export function repairDatedRecords<T extends { date?: string | null }>(
  items: T[] | null | undefined,
  vehicleYear?: number | null,
): T[] {
  return (items ?? []).map((item) => ({
    ...item,
    date: sanitizeReportIsoDate(item.date ?? null, vehicleYear),
  }));
}
