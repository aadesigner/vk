import { isVagWmi } from "./vag-wmi";
import { decodeAudiEuHomologation, homologationToDisplay, isAudiHomologationVin } from "./eu-zzz-homologation";
import { decodeFordEuModel, isFordEuWmi } from "./ford-eu";
import { decodeJlrEuModel } from "./jlr-eu";

/**
 * European VIN model decoding (VAG Group + Audi).
 * EU-format VINs use ZZZ filler at positions 4–6; model platform at position 7 (index 6).
 */

/** Volkswagen Group — position 7–8 only (aligned with vag-modern; no pos-7 invent). */
const VAG_MODEL_AT_78: Record<string, string> = {
  "1K": "Golf",
  "1T": "Touran",
  "1J": "Jetta",
  "1G": "Golf / Jetta",
  "1H": "Golf / Vento",
  "1Y": "New Beetle Cabriolet",
  "3C": "Passat",
  "3D": "Arteon",
  "3H": "Arteon",
  "5N": "Tiguan",
  "5M": "Golf Plus",
  "5K": "Golf / Jetta",
  "5T": "Touran",
  "5Z": "Fox",
  "6R": "Polo",
  "6N": "Polo",
  "6J": "Taigo",
  "6C": "Polo",
  "7P": "Touareg",
  "7L": "Touareg",
  "7H": "Transporter / Multivan",
  "7N": "Sharan",
  "7E": "Caddy",
  "7J": "Multivan",
  // Typ 9N = Polo Mk4 (NOT Touran — Touran is 1T / 5T)
  "9N": "Polo",
  "9C": "New Beetle",
  // Gen 3 Touareg (CR platform) — common Bratislava (WVG) encoding
  CR: "Touareg",
  AU: "Golf",
  AW: "Polo",
  A1: "T-Roc",
  C1: "T-Cross",
  CJ: "Passat Variant",
  E1: "ID.3",
  E2: "ID.4",
  E3: "ID.5",
  E4: "ID.7",
  EB: "ID. Buzz",
  SH: "T-Roc",
  SY: "Crafter",
  SF: "Multivan",
  SG: "California",
  SK: "Caddy",
  ST: "ID. Buzz Cargo",
  "2H": "Amarok",
  "2D": "Caddy",
  "2E": "Crafter",
  "2K": "Caddy / Caddy Maxi",
  "2F": "Caddy Maxi",
  DF: "Sharan",
  CD: "Golf",
  BP: "Arteon",
  AA: "Up!",
  CT: "Tiguan",
  R4: "Tayron",
};

// Single-char VAG_MODEL_AT_7 / AUDI_MODEL_AT_7 removed — inventing Golf from "1"
// (Typ 16 Beetle/Jetta) was a real production bug.

function isVagPrefix(prefix: string): boolean {
  return isVagWmi(prefix) || prefix.startsWith("3VW");
}

function isAudiEuPrefix(prefix: string): boolean {
  return prefix.startsWith("WAU") || prefix.startsWith("TRU");
}

function hasZzzFiller(vin: string): boolean {
  return vin.slice(3, 6) === "ZZZ";
}

/**
 * EU type-approval VINs use ZZZ at positions 4–6; positions 7–9 are the homologation code
 * (e.g. Audi 4G6), not US-style engine/transmission letters at position 8.
 * Applies to BMW, Mercedes, Audi, Porsche, VW, JLR, Peugeot, etc.
 */
export function hasEuZzzTypeApprovalDescriptor(vin: string): boolean {
  return vin.toUpperCase().length >= 9 && hasZzzFiller(vin);
}

/** @deprecated Use hasEuZzzTypeApprovalDescriptor — kept as alias for clarity at call sites. */
export function isEuZzzTypeApprovalVin(vin: string): boolean {
  return hasEuZzzTypeApprovalDescriptor(vin);
}

/** Decode model from EU VAG/Audi ZZZ-format VINs (2-char type only — never invent from pos.7). */
export function decodeModelEuropean(vin: string): string | null {
  const u = vin.toUpperCase();
  if (u.length < 8 || !hasZzzFiller(u)) return null;

  const wmi = u.slice(0, 3);
  const code78 = u.length >= 8 ? u.slice(6, 8) : "";

  // VW passenger/commercial first — Bratislava (WVG) builds Touareg/Up! alongside Audi SUVs.
  // Prefer platform codes (7P/7L/CR/…) before Audi homologation so Touareg is not missed.
  if (isVagPrefix(wmi)) {
    const from78 = VAG_MODEL_AT_78[code78];
    if (from78) return from78;
    // 3-char type codes e.g. CR7 (Touareg III)
    if (u.length >= 9) {
      const code79 = u.slice(6, 9);
      if (code79.startsWith("CR")) return "Touareg";
      if (code79.startsWith("7P") || code79.startsWith("7L")) return "Touareg";
    }
    // Unknown 2-char type → null (never invent from position 7 alone).
    return null;
  }

  // Audi homologation (WAU/TRU, or WVG when Audi SUV type code)
  if (isAudiEuPrefix(wmi) || (wmi === "WVG" && isAudiHomologationVin(u))) {
    const audi = decodeAudiEuHomologation(u);
    if (audi) return homologationToDisplay(audi);
    // No single-char invent for Audi either.
    return null;
  }

  if (wmi.startsWith("SAL") || wmi.startsWith("SAJ")) {
    return decodeJlrEuModel(u);
  }
  if (isFordEuWmi(wmi)) {
    return decodeFordEuModel(u);
  }

  return null;
}
