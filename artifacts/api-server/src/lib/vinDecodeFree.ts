import { decodeVin, decodeCountry, type VinDecodeResult } from "@workspace/vin-decode";
import { isPlausibleMake, isPlausibleModel } from "@workspace/vin-decode";
import { decodeVinDiagnostics, type VinDiagnostic, decodePremiumEuropeanModel, decodeLocalSeries, decodeLocalTrim, formatProductionYearRange, isMercedesEuroBaumusterVin, bmwEtkOmitsIsoYear } from "@workspace/vin-decode";

/**
 * Generation production window — only for European FINs that omit ISO year
 * (Mercedes Baumuster / classic BMW ETK). Pure local map lookup; no I/O.
 */
function buildModelYearRange(vin: string, year: number | null, series: string | null): string | null {
  if (year != null) return null;
  if (!isMercedesEuroBaumusterVin(vin) && !bmwEtkOmitsIsoYear(vin)) return null;
  const range = formatProductionYearRange(series);
  return range && series ? `${range} (${series})` : range;
}

export type FreeDecodeResponse = {
  vin: string;
  year: number | null;
  /**
   * Generation production window (e.g. "2016–2023 (W213)") when the exact model
   * year is not encoded in the VIN (European Mercedes FINs). Null when `year` is set.
   */
  modelYearRange: string | null;
  /** Always null — manufacture/calendar year is not in the VIN. */
  manufactureYear: null;
  make: string | null;
  model: string | null;
  series: string | null;
  trim: string | null;
  manufacturer: string | null;
  vehicleType: string | null;
  bodyStyle: string | null;
  doors: string | null;
  engineCylinders: string | null;
  engineDisplacementL: string | null;
  engineHp: string | null;
  engineKw: string | null;
  engineDecoded: string | null;
  engineCode: string | null;
  fuelType: string | null;
  fuelTypeSecondary: string | null;
  driveType: string | null;
  transmissionStyle: string | null;
  transmissionSpeeds: string | null;
  turbo: string | null;
  electrificationLevel: string | null;
  gvwr: string | null;
  vehicleDescriptor: string | null;
  plantCountry: string | null;
  plantCity: string | null;
  plantCode: string | null;
  countryOfOrigin: string | null;
  abs: string | null;
  esc: string | null;
  tpms: string | null;
  seatBeltType: string | null;
  airbagLocations: string | null;
  wmi: string;
  checkDigitValid: boolean;
  source: "nhtsa" | "local" | "hybrid";
  diagnostics: VinDiagnostic[];
};

type NhtsaRow = { Variable: string; Value: string | null };

type NhtsaParsed = {
  errorCode: number;
  make: string | null;
  model: string | null;
  series: string | null;
  trim: string | null;
  manufacturer: string | null;
  vehicleType: string | null;
  bodyStyle: string | null;
  doors: string | null;
  year: number | null;
  engineCylinders: string | null;
  engineDisplacementL: string | null;
  engineModel: string | null;
  engineHp: string | null;
  engineKw: string | null;
  fuelType: string | null;
  fuelTypeSecondary: string | null;
  driveType: string | null;
  transmissionStyle: string | null;
  transmissionSpeeds: string | null;
  turbo: string | null;
  electrificationLevel: string | null;
  gvwr: string | null;
  vehicleDescriptor: string | null;
  plantCountry: string | null;
  plantCity: string | null;
  abs: string | null;
  esc: string | null;
  tpms: string | null;
  seatBeltType: string | null;
  airbagLocations: string | null;
};

const INVALID_VALUES = new Set([
  "", "Not Applicable", "N/A", "NA", "null", "undefined",
]);

const NHTSA_CACHE_MAX = 2_000;
const NHTSA_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const NHTSA_FETCH_TIMEOUT_MS = 6_000;
const nhtsaCache = new Map<string, { data: NhtsaParsed | null; expires: number }>();
const NHTSA_API_BASE = "https://vpic.nhtsa.dot.gov/api/vehicles";

function cleanNhtsa(value: string | null | undefined): string | null {
  if (value == null) return null;
  const v = value.trim();
  if (!v || INVALID_VALUES.has(v)) return null;
  return v;
}

export { isPlausibleModel, isPlausibleMake };

function pickModel(nhtsaModel: string | null, localModel: string | null, vin: string): string | null {
  const premium = decodePremiumEuropeanModel(vin);
  if (premium && isPlausibleModel(premium, vin)) return premium;
  if (isPlausibleModel(localModel, vin)) return localModel!.trim();
  if (isPlausibleModel(nhtsaModel, vin)) return nhtsaModel!.trim();
  return null;
}

function pickMake(nhtsaMake: string | null, localMake: string | null, vin: string): string | null {
  const n = cleanNhtsa(nhtsaMake);
  if (n) {
    const formatted = titleCaseMake(n);
    return isPlausibleMake(formatted, vin) ? formatted : null;
  }
  return isPlausibleMake(localMake, vin) ? localMake : null;
}

function pickSeries(nhtsaSeries: string | null, vin: string, model?: string | null): string | null {
  const localSeries = decodeLocalSeries(vin, model);
  if (localSeries) return localSeries;
  return cleanNhtsa(nhtsaSeries);
}

function plausibleModelYear(year: number | null | undefined): year is number {
  if (year == null || !Number.isFinite(year)) return false;
  const max = new Date().getFullYear() + 2;
  return year >= 1980 && year <= max;
}

/** Prefer local year; never take NHTSA year when the VIN omits ISO year (MB Baumuster / BMW ETK). */
function pickYear(
  vin: string,
  nhtsaYear: number | null,
  localYear: number | null,
  nhtsaErrorCode: number,
): number | null {
  // Pos.10 is steering (MB) or non-year (BMW ETK) — NHTSA still invents ISO years like 2001 from "1".
  if (isMercedesEuroBaumusterVin(vin) || bmwEtkOmitsIsoYear(vin)) {
    return plausibleModelYear(localYear) ? localYear : null;
  }

  const localOk = plausibleModelYear(localYear);
  const nhtsaOk = plausibleModelYear(nhtsaYear);

  if (!nhtsaOk) return localOk ? localYear : null;
  if (!localOk) return nhtsaYear;

  if (nhtsaErrorCode !== 0 && localYear !== nhtsaYear) return localYear;
  return nhtsaYear;
}

/** Normalize NHTSA ALL-CAPS makes to readable form. */
function titleCaseMake(make: string): string {
  const special: Record<string, string> = {
    BMW: "BMW",
    GMC: "GMC",
    RAM: "Ram",
    MINI: "MINI",
    KIA: "Kia",
    BYD: "BYD",
    NIO: "NIO",
    "MERCEDES-BENZ": "Mercedes-Benz",
    "LAND ROVER": "Land Rover",
    "ASTON MARTIN": "Aston Martin",
    "ROLLS-ROYCE": "Rolls-Royce",
    "ALFA ROMEO": "Alfa Romeo",
    "GENERAL MOTORS": "General Motors",
    "AMERICAN HONDA MOTOR CO., INC.": "Honda",
  };
  const key = make.toUpperCase();
  if (special[key]) return special[key];
  return make
    .toLowerCase()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function buildEngineDecoded(nhtsa: NhtsaParsed, local: VinDecodeResult): string | null {
  if (local.engineDecoded) return local.engineDecoded;
  const parts: string[] = [];
  if (nhtsa.engineDisplacementL) parts.push(`${nhtsa.engineDisplacementL}L`);
  if (nhtsa.engineCylinders) parts.push(`${nhtsa.engineCylinders}-cylinder`);
  if (nhtsa.engineHp) parts.push(`${nhtsa.engineHp} hp`);
  if (nhtsa.engineModel) parts.push(`(${nhtsa.engineModel})`);
  return parts.length > 0 ? parts.join(" ") : null;
}

function summarizeAirbags(get: (variable: string) => string | null): string | null {
  const parts = [
    get("Front Air Bag Locations"),
    get("Side Air Bag Locations"),
    get("Curtain Air Bag Locations"),
    get("Knee Air Bag Locations"),
  ].filter(Boolean);
  return parts.length > 0 ? [...new Set(parts)].join(" · ") : null;
}

function fieldFromRow(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const raw = row[key];
    if (raw == null) continue;
    const cleaned = cleanNhtsa(String(raw));
    if (cleaned) return cleaned;
  }
  return null;
}

/** Compact NHTSA payload (~2 KB vs ~80 KB for full DecodeVin). */
function parseNhtsaValuesRow(row: Record<string, unknown>): NhtsaParsed {
  const errorCodeRaw = fieldFromRow(row, "ErrorCode");
  const errorCode = errorCodeRaw === "0" ? 0 : 1;
  const yearStr = fieldFromRow(row, "ModelYear");
  const hpFrom = fieldFromRow(row, "EngineBrakeHPFrom", "EngineHPFrom");
  const hpTo = fieldFromRow(row, "EngineBrakeHPTo", "EngineHPTo");
  const engineHp = hpFrom && hpTo && hpFrom !== hpTo ? `${hpFrom}–${hpTo}` : hpFrom ?? hpTo ?? fieldFromRow(row, "EngineHP");
  const summarizeValuesAirbags = (): string | null => summarizeAirbags((name) => {
    const map: Record<string, string> = {
      "Front Air Bag Locations": "FrontAirBagLocations",
      "Side Air Bag Locations": "SideAirBagLocations",
      "Curtain Air Bag Locations": "CurtainAirBagLocations",
      "Knee Air Bag Locations": "KneeAirBagLocations",
    };
    return fieldFromRow(row, map[name] ?? name);
  });
  return {
    errorCode: Number.isFinite(errorCode) ? errorCode : 1,
    make: fieldFromRow(row, "Make"),
    model: fieldFromRow(row, "Model"),
    series: fieldFromRow(row, "Series", "Series2"),
    trim: fieldFromRow(row, "Trim", "Trim2"),
    manufacturer: fieldFromRow(row, "Manufacturer", "ManufacturerName"),
    vehicleType: fieldFromRow(row, "VehicleType"),
    bodyStyle: fieldFromRow(row, "BodyClass"),
    doors: fieldFromRow(row, "Doors"),
    year: yearStr ? parseInt(yearStr, 10) : null,
    engineCylinders: fieldFromRow(row, "EngineCylinders", "EngineNumberofCylinders"),
    engineDisplacementL: fieldFromRow(row, "DisplacementL", "Displacement(L)"),
    engineModel: fieldFromRow(row, "EngineModel"),
    engineHp,
    engineKw: fieldFromRow(row, "EnginePowerKW", "EnginePower(kW)"),
    fuelType: fieldFromRow(row, "FuelTypePrimary", "FuelType-Primary"),
    fuelTypeSecondary: fieldFromRow(row, "FuelTypeSecondary", "FuelType-Secondary"),
    driveType: fieldFromRow(row, "DriveType"),
    transmissionStyle: fieldFromRow(row, "TransmissionStyle"),
    transmissionSpeeds: fieldFromRow(row, "TransmissionSpeeds"),
    turbo: fieldFromRow(row, "Turbo"),
    electrificationLevel: fieldFromRow(row, "ElectrificationLevel"),
    gvwr: fieldFromRow(row, "GVWR", "GrossVehicleWeightRatingFrom", "GrossVehicleWeightRatingTo"),
    vehicleDescriptor: fieldFromRow(row, "VehicleDescriptor"),
    plantCountry: fieldFromRow(row, "PlantCountry")?.replace(/\s*\([^)]*\)/, "").trim() ?? null,
    plantCity: fieldFromRow(row, "PlantCity"),
    abs: fieldFromRow(row, "ABS", "AntilockBrakingSystem(ABS)"),
    esc: fieldFromRow(row, "ESC", "ElectronicStabilityControl(ESC)"),
    tpms: fieldFromRow(row, "TPMS", "TirePressureMonitoringSystem(TPMS)Type"),
    seatBeltType: fieldFromRow(row, "SeatBeltsAll", "SeatBeltType"),
    airbagLocations: summarizeValuesAirbags(),
  };
}

export function parseNhtsaApiPayload(json: { Results?: unknown[] }): NhtsaParsed | null {
  const first = json.Results?.[0];
  if (!first || typeof first !== "object" || Array.isArray(first)) return null;
  const row = first as Record<string, unknown>;
  if ("Variable" in row) {
    return parseNhtsaResponse(json as { Results?: NhtsaRow[] });
  }
  return parseNhtsaValuesRow(row);
}

function parseNhtsaResponse(json: { Results?: NhtsaRow[] }): NhtsaParsed | null {
  const rows = json.Results ?? [];
  const byVar = new Map<string, string | null>();
  for (const r of rows) {
    if (r.Variable) byVar.set(r.Variable, r.Value);
  }
  const get = (variable: string): string | null => cleanNhtsa(byVar.get(variable) ?? null);
  const errorCodeRaw = get("Error Code");
  const errorCode = errorCodeRaw === "0" ? 0 : 1;
  const yearStr = get("Model Year");
  const hpFrom = get("Engine Brake (hp) From");
  const hpTo = get("Engine Brake (hp) To");
  const engineHp = hpFrom && hpTo && hpFrom !== hpTo ? `${hpFrom}–${hpTo}` : hpFrom ?? hpTo;
  return {
    errorCode: Number.isFinite(errorCode) ? errorCode : 1,
    make: get("Make"),
    model: get("Model"),
    series: get("Series") ?? get("Series2"),
    trim: get("Trim") ?? get("Trim2"),
    manufacturer: get("Manufacturer Name"),
    vehicleType: get("Vehicle Type"),
    bodyStyle: get("Body Class"),
    doors: get("Doors"),
    year: yearStr ? parseInt(yearStr, 10) : null,
    engineCylinders: get("Engine Number of Cylinders"),
    engineDisplacementL: get("Displacement (L)"),
    engineModel: get("Engine Model"),
    engineHp,
    engineKw: get("Engine Power (kW)"),
    fuelType: get("Fuel Type - Primary"),
    fuelTypeSecondary: get("Fuel Type - Secondary"),
    driveType: get("Drive Type"),
    transmissionStyle: get("Transmission Style"),
    transmissionSpeeds: get("Transmission Speeds"),
    turbo: get("Turbo"),
    electrificationLevel: get("Electrification Level"),
    gvwr: get("Gross Vehicle Weight Rating From") ?? get("Gross Vehicle Weight Rating To"),
    vehicleDescriptor: get("Vehicle Descriptor"),
    plantCountry: get("Plant Country")?.replace(/\s*\([^)]*\)/, "").trim() ?? null,
    plantCity: get("Plant City"),
    abs: get("Antilock Braking System (ABS)"),
    esc: get("Electronic Stability Control (ESC)"),
    tpms: get("Tire Pressure Monitoring System (TPMS) Type"),
    seatBeltType: get("Seat Belt Type"),
    airbagLocations: summarizeAirbags(get),
  };
}

function emptyExtendedFields(): Pick<
  FreeDecodeResponse,
  | "series" | "doors" | "engineHp" | "engineKw" | "fuelTypeSecondary" | "transmissionSpeeds"
  | "turbo" | "electrificationLevel" | "gvwr" | "vehicleDescriptor"
  | "abs" | "esc" | "tpms" | "seatBeltType" | "airbagLocations"
> {
  return {
    series: null,
    doors: null,
    engineHp: null,
    engineKw: null,
    fuelTypeSecondary: null,
    transmissionSpeeds: null,
    turbo: null,
    electrificationLevel: null,
    gvwr: null,
    vehicleDescriptor: null,
    abs: null,
    esc: null,
    tpms: null,
    seatBeltType: null,
    airbagLocations: null,
  };
}

function nhtsaExtendedFields(nhtsa: NhtsaParsed): ReturnType<typeof emptyExtendedFields> {
  return {
    series: nhtsa.series,
    doors: nhtsa.doors,
    engineHp: nhtsa.engineHp,
    engineKw: nhtsa.engineKw,
    fuelTypeSecondary: nhtsa.fuelTypeSecondary,
    transmissionSpeeds: nhtsa.transmissionSpeeds,
    turbo: nhtsa.turbo,
    electrificationLevel: nhtsa.electrificationLevel,
    gvwr: nhtsa.gvwr,
    vehicleDescriptor: nhtsa.vehicleDescriptor,
    abs: nhtsa.abs,
    esc: nhtsa.esc,
    tpms: nhtsa.tpms,
    seatBeltType: nhtsa.seatBeltType,
    airbagLocations: nhtsa.airbagLocations,
  };
}

function appendNhtsaDiagnostics(base: VinDiagnostic[], nhtsa: NhtsaParsed): VinDiagnostic[] {
  const out = [...base];
  const push = (category: VinDiagnostic["category"], labelKey: string, value: string | null) => {
    const v = value?.trim();
    if (!v) return;
    if (out.some((d) => d.labelKey === labelKey && d.value === v)) return;
    out.push({ category, labelKey, value: v });
  };

  push("identity", "vehicle_descriptor", nhtsa.vehicleDescriptor);
  push("identity", "series", nhtsa.series);
  push("body", "doors", nhtsa.doors);
  push("powertrain", "engine_hp", nhtsa.engineHp);
  push("powertrain", "turbo", nhtsa.turbo);
  push("options", "electrification", nhtsa.electrificationLevel);
  push("drivetrain", "transmission_speeds", nhtsa.transmissionSpeeds);
  push("safety", "abs", nhtsa.abs);
  push("safety", "esc", nhtsa.esc);
  push("safety", "tpms", nhtsa.tpms);
  push("safety", "seat_belts", nhtsa.seatBeltType);
  push("safety", "airbags", nhtsa.airbagLocations);
  push("structure", "gvwr", nhtsa.gvwr);

  return out;
}

function getCachedNhtsa(vin: string): NhtsaParsed | null | undefined {
  const entry = nhtsaCache.get(vin);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) {
    nhtsaCache.delete(vin);
    return undefined;
  }
  return entry.data;
}

function pruneNhtsaCache(): void {
  const now = Date.now();
  for (const [key, entry] of nhtsaCache) {
    if (now > entry.expires) nhtsaCache.delete(key);
  }
  while (nhtsaCache.size > NHTSA_CACHE_MAX) {
    const oldest = nhtsaCache.keys().next().value;
    if (!oldest) break;
    nhtsaCache.delete(oldest);
  }
}

function setCachedNhtsa(vin: string, data: NhtsaParsed | null): void {
  pruneNhtsaCache();
  nhtsaCache.set(vin, { data, expires: Date.now() + NHTSA_CACHE_TTL_MS });
}

export async function fetchNhtsaDecode(vin: string): Promise<NhtsaParsed | null> {
  const cached = getCachedNhtsa(vin);
  if (cached !== undefined) return cached;

  try {
    const resp = await fetch(
      `${NHTSA_API_BASE}/DecodeVinValues/${encodeURIComponent(vin)}?format=json`,
      { signal: AbortSignal.timeout(NHTSA_FETCH_TIMEOUT_MS) },
    );
    if (!resp.ok) {
      setCachedNhtsa(vin, null);
      return null;
    }
    const json = await resp.json() as { Results?: unknown[] };
    const parsed = parseNhtsaApiPayload(json);
    setCachedNhtsa(vin, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function mergeFreeDecode(
  vin: string,
  local: VinDecodeResult,
  nhtsa: NhtsaParsed | null,
  checkDigitValid: boolean,
): FreeDecodeResponse {
  const wmi = vin.slice(0, 3);
  const hasNhtsaMake = nhtsa != null && !!cleanNhtsa(nhtsa.make);
  const localDiagnostics = decodeVinDiagnostics(vin, local);

  if (!hasNhtsaMake) {
    const model = isPlausibleModel(local.model, vin) ? local.model : null;
    const series = pickSeries(null, vin, model);
    return {
      vin: local.vin,
      year: local.year,
      modelYearRange: buildModelYearRange(vin, local.year, series),
      manufactureYear: null,
      make: isPlausibleMake(local.make, vin) ? local.make : null,
      model,
      series,
      trim: decodeLocalTrim(vin, model),
      manufacturer: local.make,
      vehicleType: null,
      bodyStyle: local.bodyStyleDecoded,
      doors: null,
      engineCylinders: local.engineCylinders,
      engineDisplacementL: local.engineDisplacement,
      engineHp: null,
      engineKw: null,
      engineDecoded: local.engineDecoded,
      engineCode: local.engineCode,
      fuelType: local.fuelType,
      fuelTypeSecondary: null,
      driveType: local.driveType,
      transmissionStyle: local.transmissionDecoded,
      transmissionSpeeds: null,
      turbo: null,
      electrificationLevel: null,
      gvwr: null,
      vehicleDescriptor: null,
      plantCountry: local.plantCountry,
      plantCity: local.plantCity,
      plantCode: local.plantCode,
      countryOfOrigin: local.country ?? decodeCountry(vin),
      abs: null,
      esc: null,
      tpms: null,
      seatBeltType: null,
      airbagLocations: null,
      wmi,
      checkDigitValid,
      source: "local",
      diagnostics: localDiagnostics,
    };
  }

  const model = pickModel(nhtsa!.model, local.model, vin);
  const usedLocalModel = model === local.model && isPlausibleModel(local.model, vin);
  const usedNhtsaCore = !!nhtsa!.make && (nhtsa!.model === model || !usedLocalModel);
  const localTrim = decodeLocalTrim(vin, model);
  const extended = nhtsaExtendedFields(nhtsa!);
  const year = pickYear(vin, nhtsa!.year, local.year, nhtsa!.errorCode);
  const series = pickSeries(nhtsa!.series, vin, model);

  return {
    vin: local.vin,
    year,
    modelYearRange: buildModelYearRange(vin, year, series),
    manufactureYear: null,
    make: pickMake(nhtsa!.make, local.make, vin),
    model,
    series,
    trim: nhtsa!.trim ?? localTrim,
    manufacturer: nhtsa!.manufacturer ?? local.make,
    vehicleType: nhtsa!.vehicleType,
    bodyStyle: nhtsa!.bodyStyle ?? local.bodyStyleDecoded,
    doors: extended.doors,
    engineCylinders: nhtsa!.engineCylinders ?? local.engineCylinders,
    engineDisplacementL: nhtsa!.engineDisplacementL ?? local.engineDisplacement,
    engineHp: extended.engineHp,
    engineKw: extended.engineKw,
    engineDecoded: buildEngineDecoded(nhtsa!, local),
    engineCode: local.engineCode,
    fuelType: nhtsa!.fuelType ?? local.fuelType,
    fuelTypeSecondary: extended.fuelTypeSecondary,
    driveType: nhtsa!.driveType ?? local.driveType,
    transmissionStyle: nhtsa!.transmissionStyle ?? local.transmissionDecoded,
    transmissionSpeeds: extended.transmissionSpeeds,
    turbo: extended.turbo,
    electrificationLevel: extended.electrificationLevel,
    gvwr: extended.gvwr,
    vehicleDescriptor: extended.vehicleDescriptor,
    plantCountry: nhtsa!.plantCountry ?? local.plantCountry,
    plantCity: nhtsa!.plantCity ?? local.plantCity,
    plantCode: local.plantCode,
    countryOfOrigin: decodeCountry(vin) ?? local.country,
    abs: extended.abs,
    esc: extended.esc,
    tpms: extended.tpms,
    seatBeltType: extended.seatBeltType,
    airbagLocations: extended.airbagLocations,
    wmi,
    checkDigitValid,
    source: usedNhtsaCore && (local.engineDecoded || local.plantCity) ? "hybrid" : "nhtsa",
    diagnostics: appendNhtsaDiagnostics(localDiagnostics, nhtsa!),
  };
}

export async function decodeFreeVin(vin: string, checkDigitValid: boolean): Promise<FreeDecodeResponse> {
  const local = decodeVin(vin);
  let nhtsa: NhtsaParsed | null = null;
  try {
    nhtsa = await fetchNhtsaDecode(vin);
  } catch {
    nhtsa = null;
  }
  return mergeFreeDecode(vin, local, nhtsa, checkDigitValid);
}
