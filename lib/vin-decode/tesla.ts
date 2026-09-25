/**
 * Tesla model / battery / motor / plant decoding.
 * Pos 4 = model line, 5 = body, 7 = battery chemistry, 8 = motor/drive,
 * 11 = assembly plant. Sources: Tesla service manuals (NHTSA vPIC MY2024+),
 * Tesla Model Y service documentation.
 */

import type { BrandVinSpec } from "./brand-vin-spec";

export const TESLA_WMIS = new Set([
  "5YJ", "7SA", "7G2", "SFZ", // NHTSA-listed US WMIs (+ SFZ Roadster-era)
  "LRW", "XP7",               // Shanghai / Berlin (widely used; not in NHTSA WMI list)
]);

export function isTeslaVin(vin: string): boolean {
  return TESLA_WMIS.has(vin.slice(0, 3).toUpperCase());
}

const MODEL_AT_4: Record<string, string> = {
  S: "Model S",
  "3": "Model 3",
  X: "Model X",
  Y: "Model Y",
  C: "Cybertruck",
  T: "Semi",
  R: "Roadster",
};

const MODEL_BODY: Record<string, string> = {
  "Model S": "Sedan",
  "Model 3": "Sedan",
  "Model X": "SUV",
  "Model Y": "SUV",
  Cybertruck: "Pickup",
  Semi: "Truck",
  Roadster: "Sports Car",
};

const BATTERY_AT_7: Record<string, string> = {
  E: "Li-ion (NCA/NMC)",
  F: "LFP (Lithium Iron Phosphate)",
  H: "LFP (High Capacity)",
  S: "Standard Range",
  R: "Long Range",
  P: "Li-ion (Performance Pack)",
};

/** Motor / drive unit at position 8 — varies by model line. */
function decodeTeslaMotor(model: string, motorChar: string): { drive: string | null; motor: string } {
  const c = motorChar.toUpperCase();
  if (model === "Model 3" || model === "Model Y") {
    const map: Record<string, { drive: string; motor: string }> = {
      A: { drive: "Rear-Wheel Drive", motor: "Single Motor" },
      B: { drive: "All-Wheel Drive", motor: "Dual Motor (Standard)" },
      C: { drive: "All-Wheel Drive", motor: "Dual Motor (Performance)" },
      D: { drive: "Rear-Wheel Drive", motor: "Single Motor (Standard)" },
      E: { drive: "All-Wheel Drive", motor: "Dual Motor (Standard)" },
      F: { drive: "All-Wheel Drive", motor: "Dual Motor (Performance)" },
      J: { drive: "Rear-Wheel Drive", motor: "Single Motor (Hairpin)" },
      K: { drive: "All-Wheel Drive", motor: "Dual Motor (Hairpin)" },
      L: { drive: "All-Wheel Drive", motor: "Performance (Hairpin)" },
    };
    const hit = map[c];
    if (hit) return { drive: hit.drive, motor: hit.motor };
  }
  if (model === "Model S" || model === "Model X") {
    const map: Record<string, { drive: string; motor: string }> = {
      "5": { drive: "All-Wheel Drive", motor: "Dual Motor (Long Range)" },
      "6": { drive: "All-Wheel Drive", motor: "Tri Motor (Plaid)" },
      A: { drive: "Rear-Wheel Drive", motor: "Single Motor" },
      B: { drive: "All-Wheel Drive", motor: "Dual Motor" },
      C: { drive: "All-Wheel Drive", motor: "Dual Motor (Performance)" },
    };
    const hit = map[c];
    if (hit) return { drive: hit.drive, motor: hit.motor };
  }
  if (model === "Cybertruck") {
    const map: Record<string, { drive: string; motor: string }> = {
      D: { drive: "All-Wheel Drive", motor: "Dual Motor (Standard)" },
      E: { drive: "All-Wheel Drive", motor: "Tri Motor (Cyberbeast)" },
    };
    const hit = map[c];
    if (hit) return { drive: hit.drive, motor: hit.motor };
  }
  if (model === "Semi") {
    if (c === "B") return { drive: "All-Wheel Drive", motor: "Dual Drive Rear Axle" };
  }
  return { drive: null, motor: "Electric Motor" };
}

const PLANT_AT_11: Record<string, { city: string; country: string }> = {
  F: { city: "Fremont, California", country: "United States" },
  A: { city: "Austin, Texas", country: "United States" },
  C: { city: "Shanghai", country: "China" },
  B: { city: "Grünheide (Berlin)", country: "Germany" },
  N: { city: "Reno, Nevada", country: "United States" },
  "3": { city: "Hethel, Norfolk", country: "United Kingdom" },
};

function decodeTeslaBody(model: string, bodyChar: string): string | null {
  const base = MODEL_BODY[model] ?? null;
  if (model === "Model Y") {
    if (bodyChar === "G") return "SUV (5-door, LHD)";
    if (bodyChar === "H") return "SUV (5-door, RHD)";
  }
  return base;
}

export function decodeTeslaSpec(vin: string): BrandVinSpec | null {
  const upper = vin.toUpperCase().trim();
  if (!isTeslaVin(upper)) return null;

  const modelChar = upper[3];
  const model = MODEL_AT_4[modelChar];
  if (!model) return null;

  const batteryChar = upper[6];
  const motorChar = upper[7];
  const battery = BATTERY_AT_7[batteryChar] ?? "Electric";
  const { drive, motor } = decodeTeslaMotor(model, motorChar);
  const plant = PLANT_AT_11[upper[10]] ?? null;

  return {
    make: "Tesla",
    model,
    bodyStyle: decodeTeslaBody(model, upper[4]),
    fuelType: "Electric",
    driveType: drive,
    engineDecoded: `${motor} · ${battery}`,
    transmissionDecoded: "Single-Speed Automatic",
    plantCity: plant?.city ?? null,
    plantCountry: plant?.country ?? null,
  };
}

export function decodeTeslaModel(vin: string): string | null {
  return decodeTeslaSpec(vin)?.model ?? null;
}
