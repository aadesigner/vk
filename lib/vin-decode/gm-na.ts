/**
 * GM North America VIN model decode (Chevrolet / GMC / Cadillac MPV lines).
 *
 * Sources (no guessing):
 * - GM VIN Standards MID (NHTSA manufacturer filing) — chassis codes at pos. 5–6
 * - NHTSA vPIC DecodeVinValues — modern T1 / crossover prefixes
 *
 * Ambiguous or unverified codes → null.
 */

import { compilePrefixRules, matchLongestPrefix, type PrefixRule } from "./prefix-match";

const CHEVY_TRUCK_WMI = new Set(["1GC", "2GC", "3GC"]);
const GMC_TRUCK_WMI = new Set(["1GT", "2GT", "3GT"]);
const CHEVY_MPV_WMI = new Set(["1GN", "2GN", "3GN"]);
const GMC_MPV_WMI = new Set(["1GK", "2GK", "3GK"]);
const CHEVY_CAR_WMI = new Set(["1G1", "2G1", "3G1"]);
const CADILLAC_MPV_WMI = new Set(["1GY", "3GY"]);
const CHEVY_KR_WMI = new Set(["KL7", "KL8", "KL4"]);

/** MID Book 52 — Colorado chassis (pos. 5–6) under Chevy truck WMI. */
const COLORADO_CHASSIS = new Set([
  "SA", "SB", "SC", "SD", "S9",
  "TB", "TC", "TD", "T9",
]);

/** MID Book 6 — Silverado chassis families (pos. 5–6). */
const SILVERADO_1500 = new Set([
  "CN", "CP", "CR", "CS", "CT", "C9",
  "KN", "KP", "KR", "KS", "KT",
]);
const SILVERADO_2500 = new Set([
  "CU", "CV", "CW", "CX",
  "KU", "KV", "KW", "KX",
]);
const SILVERADO_3500 = new Set([
  "CY", "CZ", "C0", "C1",
  "KY", "KZ", "K0", "K1",
]);

/** MID Book 6 — Tahoe when pos.4 is L (classic K2XX). */
const TAHOE_CHASSIS_L = new Set([
  "CA", "CB", "CC", "CD", "CE", "C7",
  "KA", "KB", "KC", "KD", "KE", "KF", "K7",
]);

/** MID Book 6 — Suburban when pos.4 is S. */
const SUBURBAN_CHASSIS_S = new Set([
  "CG", "CH", "CJ", "CK", "C8",
  "KG", "KH", "KJ", "KK", "KL", "KM", "K8",
]);

/** MID Book 17 — Traverse chassis (pos. 5–6). */
const TRAVERSE_CHASSIS = new Set([
  "RE", "RF", "RG", "RH", "RJ", "R8",
  "VF", "VG", "VH", "VJ", "V8",
]);

/** MID Book 7L — Equinox chassis when pos.4 is A. */
const EQUINOX_CHASSIS_A = new Set([
  "LA", "LB", "LC", "LD", "LE", "LF", "LG", "L9",
]);

/** MID Book J — Trax chassis. */
const TRAX_CHASSIS = new Set([
  "JK", "JL", "JM", "JN", "JP", "JR", "J7", "J8",
]);

/** MID Book 8 — Express van chassis. */
const EXPRESS_CHASSIS = new Set([
  "GA", "GB", "GC", "GD", "GE", "GF", "GG", "GH", "GJ", "GK",
  "GL", "GM", "GN", "GP", "GR", "GS", "GT", "GU", "GV", "G9",
]);

/**
 * Longest-prefix rules for modern platforms (chassis books changed).
 * Each prefix verified via NHTSA DecodeVinValues (model field).
 */
const GM_PREFIX_RULES: PrefixRule[] = compilePrefixRules([
  // Chevrolet Silverado T1XX
  { prefix: "1GCUY", model: "Silverado 1500", chassis: "T1XX" },
  { prefix: "1GCUD", model: "Silverado 1500", chassis: "T1XX" },
  { prefix: "1GCPY", model: "Silverado 1500", chassis: "T1XX" },
  { prefix: "1GCRY", model: "Silverado 1500", chassis: "T1XX" },
  { prefix: "3GCUY", model: "Silverado 1500", chassis: "T1XX" },
  { prefix: "3GCPY", model: "Silverado 1500", chassis: "T1XX" },
  { prefix: "1GC4Y", model: "Silverado HD", chassis: "T1XX HD" },
  { prefix: "1GC3Y", model: "Silverado HD", chassis: "T1XX HD" },
  { prefix: "3GC4Y", model: "Silverado HD", chassis: "T1XX HD" },
  // GMC Sierra T1XX
  { prefix: "1GTU9", model: "Sierra 1500", chassis: "T1XX" },
  { prefix: "1GTU7", model: "Sierra 1500", chassis: "T1XX" },
  { prefix: "1GTP9", model: "Sierra 1500", chassis: "T1XX" },
  { prefix: "1GTR9", model: "Sierra 1500", chassis: "T1XX" },
  { prefix: "3GTU9", model: "Sierra 1500", chassis: "T1XX" },
  { prefix: "1GT49", model: "Sierra HD", chassis: "T1XX HD" },
  { prefix: "1GT39", model: "Sierra HD", chassis: "T1XX HD" },
  // Colorado / Canyon GMT31XX
  { prefix: "1GCHS", model: "Colorado", chassis: "GMT31XX" },
  { prefix: "1GCHT", model: "Colorado", chassis: "GMT31XX" },
  { prefix: "1GCDT", model: "Colorado", chassis: "GMT31XX" },
  { prefix: "1GCDS", model: "Colorado", chassis: "GMT31XX" },
  { prefix: "1GTG5", model: "Canyon", chassis: "GMT31XX" },
  { prefix: "1GTG6", model: "Canyon", chassis: "GMT31XX" },
  { prefix: "1GTF5", model: "Canyon", chassis: "GMT31XX" },
  // Tahoe / Yukon GMT1XX (NHTSA)
  { prefix: "1GNSK", model: "Tahoe", chassis: "GMT1XX" },
  { prefix: "1GNSC", model: "Tahoe", chassis: "GMT1XX" },
  { prefix: "1GNFK", model: "Tahoe", chassis: "GMT1XX" },
  { prefix: "1GNLC", model: "Tahoe", chassis: "K2XX" },
  { prefix: "1GNLK", model: "Tahoe", chassis: "K2XX" },
  { prefix: "1GKS2", model: "Yukon", chassis: "GMT1XX" },
  { prefix: "1GKS1", model: "Yukon", chassis: "GMT1XX" },
  { prefix: "1GKGK", model: "Yukon", chassis: "GMT1XX" },
  // Suburban / Yukon XL — longer prefixes first
  { prefix: "1GNSKHK", model: "Suburban", chassis: "GMT1XX" },
  { prefix: "1GNSKH", model: "Suburban", chassis: "GMT1XX" },
  { prefix: "1GNSCH", model: "Suburban", chassis: "GMT1XX" },
  { prefix: "1GNGK", model: "Suburban", chassis: "GMT1XX" },
  { prefix: "1GKS2HK", model: "Yukon XL", chassis: "GMT1XX" },
  // Traverse / Acadia
  { prefix: "1GNER", model: "Traverse", chassis: "C1XX" },
  { prefix: "1GNEV", model: "Traverse", chassis: "C1XX" },
  { prefix: "1GNKV", model: "Traverse", chassis: "Lambda" },
  { prefix: "1GNKR", model: "Traverse", chassis: "Lambda" },
  { prefix: "1GKKN", model: "Acadia", chassis: "C1XX" },
  { prefix: "1GKKV", model: "Acadia", chassis: "C1XX" },
  // Equinox / Terrain 3rd gen
  { prefix: "2GNAX", model: "Equinox", chassis: "D2XX", yearFrom: 2018, yearTo: 2099 },
  { prefix: "3GNAX", model: "Equinox", chassis: "D2XX", yearFrom: 2018, yearTo: 2099 },
  { prefix: "2GNAL", model: "Equinox", chassis: "D2XX", yearFrom: 2018, yearTo: 2099 },
  { prefix: "3GNAL", model: "Equinox", chassis: "D2XX", yearFrom: 2018, yearTo: 2099 },
  { prefix: "2GKAL", model: "Terrain", chassis: "D2XX", yearFrom: 2018, yearTo: 2099 },
  { prefix: "3GKAL", model: "Terrain", chassis: "D2XX", yearFrom: 2018, yearTo: 2099 },
  { prefix: "2GKFL", model: "Terrain", chassis: "D2XX", yearFrom: 2018, yearTo: 2099 },
  // Blazer / Trailblazer / Trax / Spark
  { prefix: "3GNKB", model: "Blazer", chassis: "C1UL", yearFrom: 2019, yearTo: 2099 },
  { prefix: "3GNBK", model: "Blazer", chassis: "C1UL", yearFrom: 2019, yearTo: 2099 },
  { prefix: "KL79M", model: "Trailblazer", chassis: "9BXX", yearFrom: 2021, yearTo: 2099 },
  { prefix: "KL77L", model: "Trax", chassis: "SGM", yearFrom: 2023, yearTo: 2099 },
  { prefix: "KL8CB", model: "Spark", chassis: "M300", yearFrom: 2016, yearTo: 2099 },
  { prefix: "KL8CD", model: "Spark", chassis: "M300", yearFrom: 2016, yearTo: 2099 },
  // Camaro / Malibu / Corvette / Impala
  { prefix: "1G1FB", model: "Camaro", chassis: "Alpha", yearFrom: 2016, yearTo: 2099 },
  { prefix: "1G1FH", model: "Camaro", chassis: "Alpha", yearFrom: 2016, yearTo: 2099 },
  { prefix: "1G1FK", model: "Camaro", chassis: "Alpha", yearFrom: 2016, yearTo: 2099 },
  { prefix: "2G1FB", model: "Camaro", chassis: "Alpha", yearFrom: 2016, yearTo: 2099 },
  { prefix: "1G1ZD", model: "Malibu", chassis: "E2XX", yearFrom: 2016, yearTo: 2099 },
  { prefix: "1G1ZE", model: "Malibu", chassis: "E2XX", yearFrom: 2016, yearTo: 2099 },
  { prefix: "1G1ZB", model: "Malibu", chassis: "E2XX", yearFrom: 2016, yearTo: 2099 },
  { prefix: "1G1JA", model: "Malibu", chassis: "E2XX", yearFrom: 2016, yearTo: 2099 },
  { prefix: "1G1YY", model: "Corvette" },
  { prefix: "1G1YC", model: "Corvette", chassis: "C8", yearFrom: 2020, yearTo: 2099 },
  { prefix: "1G1YZ", model: "Corvette", chassis: "C7", yearFrom: 2014, yearTo: 2019 },
  { prefix: "1G1YA", model: "Corvette", chassis: "C7", yearFrom: 2014, yearTo: 2019 },
  { prefix: "2G1W", model: "Impala" },
  { prefix: "1G1W", model: "Impala" },
  // Cadillac
  { prefix: "1GYKN", model: "XT5" },
  { prefix: "1GYKP", model: "XT5" },
  { prefix: "1GYKZ", model: "XT4" },
  { prefix: "1GYS4", model: "Escalade" },
  { prefix: "1GYS3", model: "Escalade" },
  { prefix: "1GYS2", model: "Escalade" },
]);

function decodeFromChassisBooks(vin: string): string | null {
  const wmi = vin.slice(0, 3);
  const pos4 = vin[3] ?? "";
  const chassis = vin.slice(4, 6);

  if (CHEVY_TRUCK_WMI.has(wmi) && COLORADO_CHASSIS.has(chassis)) {
    return "Colorado";
  }

  if (CHEVY_TRUCK_WMI.has(wmi)) {
    if (EXPRESS_CHASSIS.has(chassis)) return "Express";
    if (SILVERADO_1500.has(chassis)) return "Silverado 1500";
    if (SILVERADO_2500.has(chassis)) return "Silverado 2500";
    if (SILVERADO_3500.has(chassis)) return "Silverado 3500";
  }
  if (GMC_TRUCK_WMI.has(wmi)) {
    // Same Book 6 chassis letters as Silverado → Sierra (MID GMC twin).
    if (SILVERADO_1500.has(chassis)) return "Sierra 1500";
    if (SILVERADO_2500.has(chassis)) return "Sierra 2500";
    if (SILVERADO_3500.has(chassis)) return "Sierra 3500";
  }

  if (CHEVY_MPV_WMI.has(wmi)) {
    if (pos4 === "L" && TAHOE_CHASSIS_L.has(chassis)) return "Tahoe";
    if (pos4 === "S" && SUBURBAN_CHASSIS_S.has(chassis)) return "Suburban";
    if (TRAVERSE_CHASSIS.has(chassis)) return "Traverse";
    if (pos4 === "A" && EQUINOX_CHASSIS_A.has(chassis)) return "Equinox";
    if (TRAX_CHASSIS.has(chassis)) return chassis === "J8" ? "Tracker" : "Trax";
  }
  if (GMC_MPV_WMI.has(wmi)) {
    if (pos4 === "L" && TAHOE_CHASSIS_L.has(chassis)) return "Yukon";
    if (pos4 === "S" && SUBURBAN_CHASSIS_S.has(chassis)) return "Yukon XL";
    if (TRAVERSE_CHASSIS.has(chassis)) return "Acadia";
  }

  if (CHEVY_KR_WMI.has(wmi) && TRAX_CHASSIS.has(chassis)) {
    return chassis === "J8" ? "Tracker" : "Trax";
  }

  return null;
}

export function isGmNaVin(vin: string): boolean {
  const wmi = vin.slice(0, 3).toUpperCase();
  return (
    CHEVY_TRUCK_WMI.has(wmi) ||
    GMC_TRUCK_WMI.has(wmi) ||
    CHEVY_MPV_WMI.has(wmi) ||
    GMC_MPV_WMI.has(wmi) ||
    CHEVY_CAR_WMI.has(wmi) ||
    CADILLAC_MPV_WMI.has(wmi) ||
    CHEVY_KR_WMI.has(wmi)
  );
}

export function matchGmNaRule(vin: string): PrefixRule | null {
  const u = vin.toUpperCase().trim();
  if (u.length < 8) return null;
  return matchLongestPrefix(u, GM_PREFIX_RULES);
}

export function decodeGmNaModel(vin: string): string | null {
  const u = vin.toUpperCase().trim();
  if (u.length < 8) return null;
  if (!isGmNaVin(u)) return null;

  const prefix = matchGmNaRule(u);
  if (prefix?.model) return prefix.model;

  return decodeFromChassisBooks(u);
}
