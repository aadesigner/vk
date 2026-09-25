import { historyDateSortKey } from "@/lib/history-sort";

export const TIMELINE_EVENT_TYPES = [
  "production",
  "accident",
  "insurance",
  "mileage",
  "service",
  "auction",
  "owner",
  "registry",
] as const;

export type TimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number];

type Dated = { date?: string | null };

export type TimelineEvent = {
  id: string;
  type: TimelineEventType;
  date: string;
  dayKey: string;
  sortKey: number;
  mileage?: number | null;
  severity?: string | null;
  description?: string | null;
  title?: string | null;
  subtitle?: string | null;
  location?: string | null;
  condition?: string | null;
  damage?: string | null;
  primaryDamage?: string | null;
  secondaryDamage?: string | null;
  lossAmount?: number | null;
  currency?: string | null;
  accidentType?: string | null;
  accidentCountry?: string | null;
  auctionPrice?: number | null;
  finalPrice?: number | null;
  lotStatus?: string | null;
  /** Manual mileage title (admin titleStatus field). */
  titleStatus?: string | null;
  productionYear?: number;
  /** Registry / Events detail rows (label + value). */
  details?: Array<{ label: string; value: string }>;
};

export type CollectTimelineInput = {
  year?: number | null;
  accidents?: Array<Dated & {
    severity?: string | null;
    description?: string | null;
    primaryDamage?: string | null;
    secondaryDamage?: string | null;
    odometerAtLoss?: number | null;
    lossAmount?: number | null;
    currency?: string | null;
    type?: string | null;
    country?: string | null;
  }>;
  insuranceClaims?: Array<Dated & {
    type?: string | null;
    description?: string | null;
    lossAmount?: number | null;
    currency?: string | null;
  }>;
  mileageHistory?: Array<Dated & {
    odometer?: number | null;
    condition?: string | null;
    damage?: string | null;
    primaryDamage?: string | null;
    description?: string | null;
    location?: string | null;
    auctionPrice?: number | null;
    lotStatus?: string | null;
    titleStatus?: string | null;
    title?: string | null;
  }>;
  serviceHistory?: Array<Dated & {
    mileage?: number | null;
    title?: string | null;
    location?: string | null;
    description?: string | null;
  }>;
  auctionHistory?: Array<Dated & {
    city?: string | null;
    state?: string | null;
    country?: string | null;
    condition?: string | null;
    damage?: string | null;
    primaryDamage?: string | null;
    finalPrice?: number | null;
    auctionPrice?: number | null;
    lotStatus?: string | null;
  }>;
  ownerHistory?: Array<Dated & {
    location?: string | null;
    mileage?: number | null;
    condition?: string | null;
    auctionPrice?: number | null;
    lotStatus?: string | null;
  }>;
  registryHistory?: Array<Dated & {
    title?: string | null;
    subtitle?: string | null;
    mileage?: number | null;
    location?: string | null;
    amount?: string | null;
    details?: Array<{ label?: string | null; value?: string | null }> | null;
  }>;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Calendar day key (YYYY-MM-DD) for a parseable history date, else null. */
export function historyDateDayKey(date: string | null | undefined): string | null {
  if (!date) return null;
  const trimmed = date.trim();
  if (!trimmed) return null;
  const sortKey = historyDateSortKey(trimmed);
  if (!Number.isFinite(sortKey) || sortKey === Number.NEGATIVE_INFINITY) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }

  const d = new Date(sortKey);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function joinLocation(parts: Array<string | null | undefined>): string | null {
  const cleaned = parts.map((p) => p?.trim()).filter((p): p is string => Boolean(p));
  return cleaned.length ? cleaned.join(", ") : null;
}

function firstText(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    const t = v?.trim();
    if (t) return t;
  }
  return null;
}

function enrichOwnerEventsFromSameDay(raw: TimelineEvent[]): void {
  for (const event of raw) {
    if (event.type !== "owner") continue;
    const sameDay = raw.filter((e) => e.dayKey === event.dayKey && e !== event);
    const auction = sameDay.find((e) => e.type === "auction");
    const withKm = sameDay.find((e) => e.mileage != null && e.mileage > 0);
    if ((event.mileage == null || event.mileage <= 0) && withKm?.mileage) {
      event.mileage = withKm.mileage;
    }
    if (auction) {
      if (auction.location && (!event.location || auction.location.length > event.location.length)) {
        event.location = auction.location;
      }
      event.lotStatus = event.lotStatus ?? auction.lotStatus;
      event.condition = event.condition ?? auction.condition;
      event.auctionPrice = event.auctionPrice ?? auction.finalPrice ?? auction.auctionPrice;
    }
  }
}

function pushEvent(out: TimelineEvent[], event: Omit<TimelineEvent, "id"> & { id?: string }): void {
  out.push({
    ...event,
    id: event.id ?? `${event.type}-${event.dayKey}-${out.length}`,
  });
}

export function collectReportTimelineEvents(input: CollectTimelineInput): TimelineEvent[] {
  const raw: TimelineEvent[] = [];

  if (input.year != null && input.year >= 1980 && input.year <= 2100) {
    const date = `${input.year}-01-01`;
    const sortKey = historyDateSortKey(date);
    if (sortKey !== Number.NEGATIVE_INFINITY) {
      pushEvent(raw, {
        id: `production-${input.year}`,
        type: "production",
        date,
        dayKey: date,
        sortKey,
        productionYear: input.year,
      });
    }
  }

  (input.accidents ?? []).forEach((row, i) => {
    const dayKey = historyDateDayKey(row.date);
    if (!dayKey || !row.date) return;
    pushEvent(raw, {
      id: `accident-${dayKey}-${i}`,
      type: "accident",
      date: row.date,
      dayKey,
      sortKey: historyDateSortKey(row.date),
      mileage: row.odometerAtLoss,
      severity: row.severity,
      description: row.description,
      primaryDamage: row.primaryDamage,
      secondaryDamage: row.secondaryDamage,
      lossAmount: row.lossAmount,
      currency: row.currency,
      accidentType: row.type,
      accidentCountry: row.country,
    });
  });

  (input.insuranceClaims ?? []).forEach((row, i) => {
    const dayKey = historyDateDayKey(row.date);
    if (!dayKey || !row.date) return;
    pushEvent(raw, {
      id: `insurance-${dayKey}-${i}`,
      type: "insurance",
      date: row.date,
      dayKey,
      sortKey: historyDateSortKey(row.date),
      title: row.type,
      description: row.description,
      lossAmount: row.lossAmount,
      currency: row.currency,
    });
  });

  (input.serviceHistory ?? []).forEach((row, i) => {
    const dayKey = historyDateDayKey(row.date);
    if (!dayKey || !row.date) return;
    pushEvent(raw, {
      id: `service-${dayKey}-${i}`,
      type: "service",
      date: row.date,
      dayKey,
      sortKey: historyDateSortKey(row.date),
      mileage: row.mileage,
      title: row.title,
      location: row.location,
      description: row.description,
    });
  });

  (input.auctionHistory ?? []).forEach((row, i) => {
    const dayKey = historyDateDayKey(row.date);
    if (!dayKey || !row.date) return;
    pushEvent(raw, {
      id: `auction-${dayKey}-${i}`,
      type: "auction",
      date: row.date,
      dayKey,
      sortKey: historyDateSortKey(row.date),
      location: joinLocation([row.city, row.state, row.country]),
      condition: row.condition,
      damage: row.damage,
      primaryDamage: row.primaryDamage,
      finalPrice: row.finalPrice,
      auctionPrice: row.auctionPrice,
      lotStatus: row.lotStatus,
    });
  });

  (input.ownerHistory ?? []).forEach((row, i) => {
    const dayKey = historyDateDayKey(row.date);
    if (!dayKey || !row.date) return;
    pushEvent(raw, {
      id: `owner-${dayKey}-${i}`,
      type: "owner",
      date: row.date,
      dayKey,
      sortKey: historyDateSortKey(row.date),
      mileage: row.mileage,
      location: row.location,
      condition: row.condition,
      auctionPrice: row.auctionPrice,
      lotStatus: row.lotStatus,
    });
  });

  (input.registryHistory ?? []).forEach((row, i) => {
    const dayKey = historyDateDayKey(row.date);
    if (!dayKey || !row.date) return;
    const details = (row.details ?? [])
      .map((d) => {
        const label = d.label?.trim();
        const value = d.value?.trim();
        if (!label || !value) return null;
        return { label, value };
      })
      .filter((d): d is { label: string; value: string } => d != null);
    pushEvent(raw, {
      id: `registry-${dayKey}-${i}`,
      type: "registry",
      date: row.date,
      dayKey,
      sortKey: historyDateSortKey(row.date),
      mileage: row.mileage,
      title: row.title,
      subtitle: row.subtitle,
      location: row.location,
      description: row.amount,
      ...(details.length > 0 ? { details } : {}),
    });
  });

  (input.mileageHistory ?? []).forEach((row, i) => {
    const dayKey = historyDateDayKey(row.date);
    if (!dayKey || !row.date) return;
    pushEvent(raw, {
      id: `mileage-${dayKey}-${i}`,
      type: "mileage",
      date: row.date,
      dayKey,
      sortKey: historyDateSortKey(row.date),
      mileage: row.odometer,
      condition: row.condition,
      damage: row.damage,
      primaryDamage: row.primaryDamage,
      description: row.description,
      location: row.location,
      auctionPrice: row.auctionPrice,
      lotStatus: row.lotStatus,
      titleStatus: firstText(row.titleStatus, row.title),
    });
  });

  const seen = new Set<string>();
  const auctionKeys = new Set(
    raw
      .filter((e) => e.type === "auction")
      .map((e) => `${e.dayKey}|${e.mileage != null && e.mileage > 0 ? e.mileage : ""}`),
  );

  enrichOwnerEventsFromSameDay(raw);

  const out: TimelineEvent[] = [];
  for (const event of raw) {
    const mile = event.mileage != null && event.mileage > 0 ? String(event.mileage) : "";
    const dedupeKey = `${event.dayKey}|${event.type}|${mile}`;
    if (seen.has(dedupeKey)) continue;

    if (event.type === "mileage") {
      const lotKey = `${event.dayKey}|${mile}`;
      if (auctionKeys.has(lotKey)) continue;
    }

    seen.add(dedupeKey);
    out.push(event);
  }

  out.sort((a, b) => a.sortKey - b.sortKey || a.type.localeCompare(b.type) || a.id.localeCompare(b.id));
  return out;
}

/**
 * Graph-worthy history — production year alone is not enough.
 * A single bare odometer reading is not enough either. Show when there is
 * service / accident / insurance / owner / auction / registry, annotated
 * mileage (manual location or notes), or 2+ dated mileage days.
 */
const TIMELINE_GRAPH_NON_MILEAGE_TYPES = new Set<TimelineEventType>([
  "accident",
  "insurance",
  "service",
  "owner",
  "auction",
  "registry",
]);

/** Admin-entered mileage notes (location, title, services text, condition, damage). */
export function hasManualMileageDetail(event: TimelineEvent): boolean {
  if (event.type !== "mileage") return false;
  return Boolean(
    event.location?.trim()
    || event.description?.trim()
    || event.titleStatus?.trim()
    || event.title?.trim()
    || event.condition?.trim()
    || event.damage?.trim()
    || event.primaryDamage?.trim()
    || event.secondaryDamage?.trim(),
  );
}

/** Calendar day of the chronologically latest mileage reading, if any. */
export function latestMileageDayKey(events: TimelineEvent[]): string | null {
  let best: TimelineEvent | null = null;
  for (const event of events) {
    if (event.type !== "mileage") continue;
    if (!best || event.sortKey > best.sortKey) best = event;
  }
  return best?.dayKey ?? null;
}

/**
 * Notable event markers, plus the latest bare mileage day so the line end
 * stays clickable. Intermediate bare odometer days stay line-only.
 */
export function shouldShowTimelineMarkerGroup(
  events: TimelineEvent[],
  opts?: { latestMileageDay?: string | null },
): boolean {
  if (events.some((event) => event.type !== "mileage" || hasManualMileageDetail(event))) {
    return true;
  }
  const latest = opts?.latestMileageDay;
  if (!latest) return false;
  return events.some((event) => event.type === "mileage" && event.dayKey === latest);
}

export function shouldShowReportTimeline(events: TimelineEvent[]): boolean {
  if (events.some((event) => TIMELINE_GRAPH_NON_MILEAGE_TYPES.has(event.type))) {
    return true;
  }

  if (events.some((event) => event.type === "mileage" && hasManualMileageDetail(event))) {
    return true;
  }

  const mileageDays = new Set(
    events.filter((event) => event.type === "mileage").map((event) => event.dayKey),
  );
  return mileageDays.size >= 2;
}
