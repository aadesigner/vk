import { resolveLatestOdometerKm, parseKmFromText } from "@workspace/odometer-resolve";

const KM_PER_MILE = 1.609344;

export type AdminCatalogMileageTouched = {
  odometer?: boolean;
  mileageHistory?: boolean;
};

function odometerScalarsEqual(a: unknown, b: unknown): boolean {
  const na = a == null || a === "" ? null : Number(a);
  const nb = b == null || b === "" ? null : Number(b);
  if (na == null && nb == null) return true;
  if (na == null || nb == null || !Number.isFinite(na) || !Number.isFinite(nb)) return false;
  return na === nb;
}

function normalizeMileageHistoryForCompare(history: unknown): unknown[] {
  if (!Array.isArray(history)) return [];
  return history.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
    const e = entry as Record<string, unknown>;
    const odo = e.odometer != null ? Number(e.odometer) : null;
    return {
      date: e.date ?? null,
      odometer: odo != null && Number.isFinite(odo) ? odo : null,
      source: e.source ?? null,
      unit: e.unit ?? null,
    };
  });
}

function mileageHistoriesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalizeMileageHistoryForCompare(a))
    === JSON.stringify(normalizeMileageHistoryForCompare(b));
}

/** Detect which mileage fields the admin actually edited (full-form saves always include both keys). */
export function detectAdminCatalogMileageTouched(
  previous: Record<string, unknown>,
  catalogFields: Record<string, unknown>,
): AdminCatalogMileageTouched {
  return {
    odometer:
      "odometer" in catalogFields
      && !odometerScalarsEqual(previous.odometer, catalogFields.odometer),
    mileageHistory:
      "mileageHistory" in catalogFields
      && !mileageHistoriesEqual(previous.mileageHistory, catalogFields.mileageHistory),
  };
}

function maxOdometerFromMileageHistory(history: unknown): number | null {
  if (!Array.isArray(history)) return null;
  let max: number | null = null;
  for (const raw of history) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const odo = Number((raw as { odometer?: unknown }).odometer);
    if (!Number.isFinite(odo) || odo <= 0) continue;
    max = max == null ? odo : Math.max(max, odo);
  }
  return max;
}

/** Keep admin mileage authoritative — drop readings above a locked odometer. */
export function reconcileLockedOdometerData(
  data: Record<string, unknown>,
  lockedKm: number,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    ...data,
    odometer: lockedKm,
    mileage: lockedKm,
    miles: Math.round(lockedKm / KM_PER_MILE),
    odometerLocked: true,
  };

  if (Array.isArray(out.mileageHistory)) {
    out.mileageHistory = (out.mileageHistory as Record<string, unknown>[])
      .filter((entry) => {
        const odo = Number(entry.odometer);
        return Number.isFinite(odo) && odo > 0 && odo <= lockedKm;
      });
    const hasExact = (out.mileageHistory as { odometer?: number }[])
      .some((e) => e.odometer === lockedKm);
    if (!hasExact) {
      out.mileageHistory = [
        { date: new Date().toISOString().slice(0, 10), odometer: lockedKm },
        ...(out.mileageHistory as unknown[]),
      ];
    }
  } else {
    out.mileageHistory = [{
      date: new Date().toISOString().slice(0, 10),
      odometer: lockedKm,
    }];
  }

  capOwnerRegistryMileageToLock(out, lockedKm);

  return out;
}

/** Prevent stale owner/registry rows from overriding admin mileage on serve or client resolve. */
function capOwnerRegistryMileageToLock(data: Record<string, unknown>, lockedKm: number): void {
  if (Array.isArray(data.ownerHistory)) {
    data.ownerHistory = (data.ownerHistory as Record<string, unknown>[]).map((entry) => {
      const mi = Number(entry.mileage);
      if (Number.isFinite(mi) && mi > lockedKm) return { ...entry, mileage: lockedKm };
      return entry;
    });
  }

  if (Array.isArray(data.registryHistory)) {
    data.registryHistory = (data.registryHistory as Record<string, unknown>[]).map((event) => {
      let next = event;
      const mi = Number(event.mileage);
      if (Number.isFinite(mi) && mi > lockedKm) next = { ...next, mileage: lockedKm };

      if (Array.isArray(next.details)) {
        const details = (next.details as Array<{ label?: unknown; value?: unknown }>).map((row) => {
          const parsed = parseKmFromText(typeof row.value === "string" ? row.value : null);
          if (parsed != null && parsed > lockedKm) {
            return { ...row, value: `${lockedKm.toLocaleString("en-US")} km` };
          }
          return row;
        });
        next = { ...next, details };
      }

      return next;
    });
  }
}

function resolveAdminOdometerLockKm(
  normalized: Record<string, unknown>,
  touched: AdminCatalogMileageTouched,
): number | null {
  const scalar = normalized.odometer != null ? Number(normalized.odometer) : null;
  const scalarValid = scalar != null && Number.isFinite(scalar) && scalar > 0;
  const historyMax = maxOdometerFromMileageHistory(normalized.mileageHistory);

  if (touched.odometer && scalarValid && touched.mileageHistory && historyMax != null) {
    return Math.max(scalar, historyMax);
  }
  if (touched.odometer && scalarValid) return scalar;
  if (touched.mileageHistory && historyMax != null) return historyMax;
  return null;
}

/**
 * Admin catalog save — honor manual odometer / mileage timeline edits.
 * Prevents stale owner/registry rows from overriding admin corrections on serve.
 */
export function finalizeAdminCatalogSave(
  input: Record<string, unknown>,
  touched: AdminCatalogMileageTouched = {},
): Record<string, unknown> {
  const normalized = prepareManualPublishCatalogData(input);
  const lockKm = resolveAdminOdometerLockKm(normalized, touched);
  if (lockKm != null) {
    return reconcileLockedOdometerData(normalized, lockKm);
  }

  if (touched.odometer === true) {
    const withoutLock = { ...normalized };
    delete withoutLock.odometerLocked;
    return withoutLock;
  }

  return normalized;
}

function isMilesUnit(unit: unknown): boolean {
  const s = String(unit ?? "").trim().toLowerCase();
  return s === "mi" || s === "mile" || s === "miles" || s === "ml";
}

function milesToKm(mi: number): number {
  return Math.round(mi * KM_PER_MILE);
}

/** Normalize mileage units and resolve odometer before catalog publish (score + display). */
export function prepareManualPublishCatalogData(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const data = { ...input };

  if (Array.isArray(data.mileageHistory)) {
    data.mileageHistory = (data.mileageHistory as Record<string, unknown>[]).map((entry) => {
      const odo = entry.odometer != null ? Number(entry.odometer) : NaN;
      if (Number.isFinite(odo) && odo > 0 && isMilesUnit(entry.unit)) {
        return { ...entry, odometer: milesToKm(odo), unit: "km" };
      }
      return entry;
    });
  }

  if (Array.isArray(data.ownerHistory)) {
    data.ownerHistory = (data.ownerHistory as Record<string, unknown>[]).map((entry) => {
      const mi = entry.mileage != null ? Number(entry.mileage) : NaN;
      if (Number.isFinite(mi) && mi > 0 && isMilesUnit(entry.unit)) {
        return { ...entry, mileage: milesToKm(mi), unit: "km" };
      }
      return entry;
    });
  }

  const primaryOdometer = data.odometer != null ? Number(data.odometer) : null;
  const hasValidPrimary =
    primaryOdometer != null && Number.isFinite(primaryOdometer) && primaryOdometer > 0;

  if (data.odometerLocked === true && hasValidPrimary) {
    data.odometer = primaryOdometer;
    data.miles = Math.round(primaryOdometer / KM_PER_MILE);
    return data;
  }

  const resolvedOdometer = resolveLatestOdometerKm({
    odometer: Number.isFinite(primaryOdometer) ? primaryOdometer : null,
    country: typeof data.country === "string" ? data.country : null,
    mileageHistory: data.mileageHistory as Array<{ odometer?: number | null; source?: string | null }> | undefined,
    ownerHistory: data.ownerHistory as Array<{ mileage?: number | null }> | undefined,
    registryHistory: data.registryHistory as Array<{
      mileage?: number | null;
      details?: Array<{ label: string; value: string }>;
    }> | undefined,
  });

  if (resolvedOdometer != null) {
    data.odometer = resolvedOdometer;
  }

  if (resolvedOdometer != null) {
    data.miles = Math.round(resolvedOdometer / KM_PER_MILE);
  }

  return data;
}
