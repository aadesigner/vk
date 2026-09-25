export function parseKmFromText(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.match(/([\d,]+)\s*km/i);
  if (!match) return null;
  const value = Number(match[1]!.replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function isKoreaVehicleCountry(country: string | null | undefined): boolean {
  const c = (country ?? "").trim().toLowerCase();
  return c === "kr" || c === "korea" || c === "kor" || c === "south korea";
}

export type OdometerResolveInput = {
  odometer?: number | null;
  /** When true, use `odometer` as-is (admin manual entry) — ignore registry/claims max. */
  odometerLocked?: boolean;
  country?: string | null;
  mileageHistory?: Array<{
    odometer?: number | null;
    /** `na_auction` = Copart/IAAI listing — often miles converted to km. */
    source?: string | null;
  }> | null;
  ownerHistory?: Array<{ mileage?: number | null }> | null;
  registryHistory?: Array<{
    mileage?: number | null;
    details?: Array<{ value?: string | null }> | null;
  }> | null;
};

function collectRegistryOwnerMileageKm(input: OdometerResolveInput): number[] {
  const values: number[] = [];
  const add = (value?: number | null) => {
    if (value != null && value > 0) values.push(value);
  };

  for (const event of input.registryHistory ?? []) {
    add(event.mileage);
    for (const row of event.details ?? []) {
      add(parseKmFromText(row.value));
    }
  }

  for (const entry of input.ownerHistory ?? []) {
    add(entry.mileage);
  }

  return values;
}

function isNaAuctionMileageEntry(entry: { source?: string | null }): boolean {
  return entry.source === "na_auction";
}

/** Allow listing readings modestly above the last Korean registry inspection. */
function isPlausibleListingAboveRegistry(value: number, koreanRegistryMax: number): boolean {
  return value <= koreanRegistryMax + 50_000 || value <= koreanRegistryMax * 1.2;
}

function collectListingMileageKm(
  input: OdometerResolveInput,
  koreanRegistryMax: number,
): number[] {
  const values: number[] = [];
  const add = (value?: number | null, opts?: { source?: string | null }) => {
    if (value == null || value <= 0) return;
    if (opts?.source === "na_auction") return;
    if (!isPlausibleListingAboveRegistry(value, koreanRegistryMax)) return;
    values.push(value);
  };

  add(input.odometer);

  for (const entry of input.mileageHistory ?? []) {
    if (isNaAuctionMileageEntry(entry)) continue;
    add(entry.odometer, entry);
  }

  return values;
}

function collectAllMileageKm(input: OdometerResolveInput): number[] {
  const values: number[] = [];
  const add = (value?: number | null) => {
    if (value != null && value > 0) values.push(value);
  };

  add(input.odometer);

  for (const entry of input.mileageHistory ?? []) {
    add(entry.odometer);
  }

  for (const entry of input.ownerHistory ?? []) {
    add(entry.mileage);
  }

  for (const event of input.registryHistory ?? []) {
    add(event.mileage);
    for (const row of event.details ?? []) {
      add(parseKmFromText(row.value));
    }
  }

  return values;
}

/**
 * Highest trustworthy km reading.
 * For Korean vehicles with registry mileage, ignore inflated US auction odometers
 * (miles → km) while still allowing Encar listings above the last inspection.
 */
export function resolveLatestOdometerKm(input: OdometerResolveInput): number | null {
  if (input.odometerLocked === true) {
    const odo = input.odometer;
    if (odo != null && Number.isFinite(odo) && odo > 0) return odo;
    return null;
  }

  const registryOwner = collectRegistryOwnerMileageKm(input);
  const koreanRegistryMax = registryOwner.length > 0 ? Math.max(...registryOwner) : null;

  if (
    isKoreaVehicleCountry(input.country)
    && koreanRegistryMax != null
    && (input.registryHistory?.length ?? 0) > 0
  ) {
    const listing = collectListingMileageKm(input, koreanRegistryMax);
    const candidates = [...registryOwner, ...listing];
    return candidates.length > 0 ? Math.max(...candidates) : null;
  }

  const all = collectAllMileageKm(input);
  return all.length > 0 ? Math.max(...all) : null;
}
