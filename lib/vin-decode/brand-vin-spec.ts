/**
 * Aggregates manufacturer-specific VIN decoders (Volvo, Tesla, BYD, Zeekr, Xiaomi).
 */

import { decodeBydSpec, isBydVin } from "./byd";
import { decodeOpelVauxhallMake, decodeOpelVauxhallModel, decodeOpelVauxhallPlant, isOpelVauxhallVin } from "./opel-vauxhall";
import { decodeTeslaSpec, isTeslaVin } from "./tesla";
import { decodeVolvoSpec, isVolvoVin } from "./volvo";
import { decodeXiaomiSpec, isXiaomiVin } from "./xiaomi";
import { decodeZeekrSpec, isZeekrVin } from "./zeekr";

export type BrandVinSpec = {
  make?: string;
  model: string;
  bodyStyle: string | null;
  fuelType: string | null;
  driveType: string | null;
  engineDecoded: string | null;
  transmissionDecoded: string | null;
  plantCity: string | null;
  plantCountry: string | null;
};

function volvoAsBrandSpec(vin: string): BrandVinSpec | null {
  const v = decodeVolvoSpec(vin);
  if (!v) return null;
  return {
    make: "Volvo",
    model: v.model,
    bodyStyle: v.bodyStyle,
    fuelType: v.fuelType,
    driveType: v.driveType,
    engineDecoded: null,
    transmissionDecoded: null,
    plantCity: null,
    plantCountry: null,
  };
}

/** Run all dedicated brand decoders; first match wins. */
export function resolveBrandVinSpec(vin: string): BrandVinSpec | null {
  const upper = vin.toUpperCase().trim();
  if (upper.length !== 17) return null;

  if (isVolvoVin(upper)) return volvoAsBrandSpec(upper);
  if (isOpelVauxhallVin(upper)) {
    const plant = decodeOpelVauxhallPlant(upper);
    const make = decodeOpelVauxhallMake(upper);
    const model = decodeOpelVauxhallModel(upper);
    if (!make) return null;
    return {
      make,
      model: model ?? "",
      bodyStyle: null,
      fuelType: null,
      driveType: null,
      engineDecoded: null,
      transmissionDecoded: null,
      plantCity: plant?.city ?? null,
      plantCountry: plant?.country ?? null,
    };
  }
  if (isTeslaVin(upper)) return decodeTeslaSpec(upper);
  if (isBydVin(upper)) return decodeBydSpec(upper);
  if (isZeekrVin(upper)) return decodeZeekrSpec(upper);
  if (isXiaomiVin(upper)) return decodeXiaomiSpec(upper);
  return null;
}

export function resolveBrandVinModel(vin: string): string | null {
  return resolveBrandVinSpec(vin)?.model ?? null;
}

export function resolveBrandVinMake(
  vin: string,
  wmiMake: string | null,
): string | null {
  return resolveBrandVinSpec(vin)?.make ?? wmiMake;
}
