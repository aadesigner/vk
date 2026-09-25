/**
 * Deeper model decode for BMW, Mercedes-Benz, Audi, Porsche, Volkswagen, and MINI VINs.
 * Uses manufacturer-specific VDS prefix tables (positions 4–7+).
 *
 * Note: factory option packages (SA codes) are not encoded in the public VIN;
 * this module covers model line, chassis generation, body style, and engine family.
 */

import {
  decodeAudiEuHomologation,
  decodeBmwEuHomologation,
  decodeMercedesEuHomologation,
} from "./eu-zzz-homologation";
import { decodeJlrEu } from "./jlr-eu";
import { isMercedesEuroBaumusterVin } from "./mercedes-baumuster";
import { decodeBmwEtk, bmwEtkOmitsIsoYear } from "./bmw-etk";
import { isVagWmi, normalizeVagVinForPremium } from "./vag-wmi";
import { compilePrefixRules, matchLongestPrefix, type PrefixRule } from "./prefix-match";
import {
  decodeAudiModern,
  decodePorscheModern,
  decodeVolkswagenModern,
  isAudiVin,
  isPorscheVin,
  isVolkswagenVin,
} from "./vag-modern";
import { resolveIsoModelYear } from "./iso-year";

export { isMercedesEuroBaumusterVin } from "./mercedes-baumuster";
export { isBmwEuroEtkVin, bmwEtkOmitsIsoYear } from "./bmw-etk";

type PremiumPrefixRule = PrefixRule & { chassis?: string };

/**
 * Model-year from VIN position 10 (ISO 3779).
 * Returns a year only when exactly one ISO cycle remains after optional
 * chassis gating — never "prefer recent".
 *
 * Classic European Mercedes Baumuster FINs do not encode year at pos.10
 * (that digit is LHD/RHD) — returns null for those VINs.
 * Classic BMW ETK FINs often put "0" at pos.10 — also null.
 */
export function premiumVinModelYear(vin: string, window?: { from: number; to: number } | null): number | null {
  if (isMercedesEuroBaumusterVin(vin)) return null;
  if (bmwEtkOmitsIsoYear(vin)) return null;
  // Unique ISO cycle only — pass a chassis/production window when available; never prefer-recent.
  return resolveIsoModelYear(vin[9] ?? "", window ?? null);
}

/** @deprecated Use premiumVinModelYear */
function bmwVinModelYear(vin: string): number | null {
  return premiumVinModelYear(vin);
}

/**
 * Generation chassis → valid model-year window.
 * If year is outside the window (or year unknown), chassis is stripped — model stays.
 * Platform tokens that are literal in the VIN (e.g. Touareg 7P) are intentionally omitted.
 */
const CHASSIS_YEAR: Record<string, { from: number; to: number }> = {
  // BMW
  "E90/E91": { from: 2005, to: 2012 },
  "E92 Coupé": { from: 2006, to: 2013 },
  "E93 Convertible": { from: 2007, to: 2013 },
  "F30 Sedan": { from: 2012, to: 2019 },
  "F31 Touring": { from: 2012, to: 2019 },
  "F30/F31": { from: 2012, to: 2019 },
  "G20/G21": { from: 2019, to: 2099 },
  "G20 (US)": { from: 2019, to: 2099 },
  "F10/F11": { from: 2010, to: 2017 },
  "F10 (US)": { from: 2010, to: 2017 },
  "G30/G31": { from: 2017, to: 2023 },
  "G30 (US)": { from: 2017, to: 2023 },
  "G60": { from: 2024, to: 2099 },
  "G11/G12": { from: 2015, to: 2022 },
  "G11 LCI": { from: 2019, to: 2022 },
  "G12": { from: 2015, to: 2022 },
  "G70": { from: 2022, to: 2099 },
  "F48/U11": { from: 2015, to: 2099 },
  "F48 US": { from: 2015, to: 2022 },
  "F48": { from: 2015, to: 2022 },
  "U11": { from: 2022, to: 2099 },
  "F39": { from: 2018, to: 2023 },
  "F20/F21": { from: 2011, to: 2019 },
  "F40": { from: 2019, to: 2099 },
  "Active Tourer (F45)": { from: 2014, to: 2021 },
  "G42 Coupé": { from: 2021, to: 2099 },
  "F44 Gran Coupé": { from: 2020, to: 2099 },
  "F06 Gran Coupé": { from: 2012, to: 2019 },
  "F12/F13": { from: 2011, to: 2018 },
  "F12/F13 Convertible": { from: 2011, to: 2018 },
  "G14/G15/G16": { from: 2018, to: 2099 },
  "G22 Coupé": { from: 2020, to: 2099 },
  "G23 Convertible": { from: 2020, to: 2099 },
  "G26 Gran Coupé": { from: 2021, to: 2099 },
  "G22/G26": { from: 2020, to: 2099 },
  "F32 Coupé": { from: 2013, to: 2020 },
  "F33 Convertible": { from: 2014, to: 2020 },
  "F36 Gran Coupé": { from: 2014, to: 2020 },
  "G01": { from: 2017, to: 2099 },
  "G01 (US)": { from: 2017, to: 2099 },
  "G02": { from: 2018, to: 2099 },
  "G02 (US)": { from: 2018, to: 2099 },
  "G05": { from: 2018, to: 2099 },
  "G05 (US)": { from: 2018, to: 2099 },
  "G06": { from: 2019, to: 2099 },
  "G07": { from: 2018, to: 2099 },
  "G07 (US)": { from: 2018, to: 2099 },
  // Classic BMW ETK generations (year often omitted on EU FINs)
  "E30": { from: 1982, to: 1994 },
  "E36": { from: 1990, to: 2000 },
  "E38": { from: 1994, to: 2001 },
  "E39": { from: 1995, to: 2004 },
  "E46": { from: 1998, to: 2006 },
  "E53": { from: 1999, to: 2006 },
  "E60": { from: 2003, to: 2010 },
  "E61": { from: 2004, to: 2010 },
  "E65": { from: 2001, to: 2008 },
  "E66": { from: 2001, to: 2008 },
  "E70": { from: 2006, to: 2013 },
  "E71": { from: 2008, to: 2014 },
  "E83": { from: 2003, to: 2010 },
  "E84": { from: 2009, to: 2015 },
  "E87": { from: 2004, to: 2011 },
  "E81": { from: 2007, to: 2012 },
  "E82 Coupé": { from: 2007, to: 2013 },
  "E88 Convertible": { from: 2008, to: 2013 },
  "F25": { from: 2010, to: 2017 },
  "F15": { from: 2013, to: 2018 },
  "F16": { from: 2014, to: 2019 },
  "F11 Touring": { from: 2010, to: 2017 },
  // MINI
  "R55": { from: 2007, to: 2014 },
  "R56": { from: 2006, to: 2013 },
  "R60": { from: 2010, to: 2016 },
  "R61": { from: 2012, to: 2016 },
  "F54": { from: 2015, to: 2099 },
  "F55": { from: 2014, to: 2099 },
  "F56": { from: 2014, to: 2099 },
  "F60": { from: 2016, to: 2099 },
  "Electric": { from: 2019, to: 2099 },
  // Rolls-Royce
  "Ghost": { from: 2009, to: 2099 },
  "Phantom VIII": { from: 2017, to: 2099 },
  "Cullinan": { from: 2018, to: 2099 },
  "Wraith": { from: 2013, to: 2023 },
  "Dawn": { from: 2015, to: 2023 },
  "Spectre": { from: 2023, to: 2099 },
  // Mercedes
  "W177": { from: 2018, to: 2099 },
  "W176": { from: 2012, to: 2018 },
  "W169": { from: 2004, to: 2012 },
  "W168": { from: 1997, to: 2004 },
  "C117": { from: 2013, to: 2019 },
  "C118": { from: 2019, to: 2099 },
  "R172": { from: 2011, to: 2020 },
  "C190": { from: 2014, to: 2021 },
  "W205": { from: 2014, to: 2021 },
  "W206": { from: 2021, to: 2099 },
  "W204": { from: 2007, to: 2014 },
  "W203": { from: 2000, to: 2007 },
  "W202": { from: 1993, to: 2000 },
  "W213": { from: 2016, to: 2023 },
  "W214": { from: 2023, to: 2099 },
  "W212": { from: 2009, to: 2016 },
  "C207": { from: 2009, to: 2017 },
  "C218": { from: 2011, to: 2020 },
  "R231": { from: 2012, to: 2020 },
  "W211": { from: 2002, to: 2009 },
  "W210": { from: 1995, to: 2003 },
  "W222": { from: 2013, to: 2020 },
  "W223": { from: 2020, to: 2099 },
  "W221": { from: 2005, to: 2013 },
  "W220": { from: 1998, to: 2005 },
  "X253": { from: 2015, to: 2022 },
  "C253": { from: 2016, to: 2023 },
  "X254": { from: 2022, to: 2099 },
  "C254": { from: 2023, to: 2099 },
  "W163": { from: 1997, to: 2005 },
  "W166": { from: 2011, to: 2019 },
  "X166": { from: 2006, to: 2019 },
  "C292": { from: 2015, to: 2019 },
  "W167": { from: 2019, to: 2099 },
  "X167": { from: 2019, to: 2099 },
  "W167/X167": { from: 2019, to: 2099 },
  "X156": { from: 2014, to: 2020 },
  "H247": { from: 2020, to: 2099 },
  "H247/X247": { from: 2019, to: 2099 },
  "X247": { from: 2019, to: 2099 },
  "W246": { from: 2011, to: 2019 },
  "W245": { from: 2005, to: 2011 },
  "W247": { from: 2019, to: 2099 },
  "W251": { from: 2005, to: 2013 },
  "W164": { from: 2005, to: 2011 },
  "X164": { from: 2006, to: 2012 },
  "X204": { from: 2008, to: 2015 },
  "W463/W465": { from: 1990, to: 2099 },
  "W463": { from: 1990, to: 2099 },
  "W465": { from: 2024, to: 2099 },
  "V297": { from: 2021, to: 2099 },
  "V294": { from: 2022, to: 2099 },
  "X294": { from: 2022, to: 2099 },
  "X296": { from: 2022, to: 2099 },
  "X243": { from: 2021, to: 2099 },
  "H243/X243": { from: 2021, to: 2099 },
  "C236": { from: 2023, to: 2099 },
  "N293": { from: 2019, to: 2023 },
  "C238": { from: 2017, to: 2023 },
  "C192": { from: 2023, to: 2099 },
  "R232": { from: 2022, to: 2099 },
  "C257": { from: 2018, to: 2099 },
  // Porsche (generation codes that are NOT unique in VIN alone)
  "992": { from: 2019, to: 2099 },
  "991": { from: 2012, to: 2019 },
  "981/718": { from: 2012, to: 2099 },
  "9YA": { from: 2017, to: 2099 },
  "971": { from: 2016, to: 2099 },
  "J1": { from: 2019, to: 2099 },
  "95B": { from: 2014, to: 2099 },
  "E3": { from: 2017, to: 2099 },
  // VW generation labels (when not literal Typ in VIN)
  "Mk8": { from: 2019, to: 2099 },
  "B6-B8/3C": { from: 2005, to: 2023 },
  "5N": { from: 2007, to: 2018 },
  "CT1": { from: 2016, to: 2099 },
  "Mk4": { from: 2018, to: 2099 },
  "Mk2/Mk3": { from: 2012, to: 2099 },
  "Puma": { from: 2019, to: 2099 },
  "Mondeo Mk5": { from: 2014, to: 2022 },
  "Mk5": { from: 2003, to: 2009 },
  "Mk6": { from: 2008, to: 2013 },
  "Mk7": { from: 2012, to: 2020 },
  "Mk7/Mk8": { from: 2012, to: 2099 },
  // VW Touareg platforms (Typ codes in VIN)
  "7L": { from: 2002, to: 2010 },
  "7P": { from: 2010, to: 2018 },
  "CR": { from: 2018, to: 2099 },
  // VW New Beetle A5 (Typ 16) — key must stay distinct from Audi A5/F5
  "Typ 16": { from: 1979, to: 1992 },
  "Beetle A5": { from: 2012, to: 2019 },
  "GE": { from: 2019, to: 2099 },
  "PS": { from: 2019, to: 2099 },
  // MEB / PPE electric platforms (modern cycle only)
  "E1 (MEB)": { from: 2020, to: 2099 },
  "E2 (MEB)": { from: 2021, to: 2099 },
  "E3 (MEB)": { from: 2022, to: 2099 },
  "E4 (MEB)": { from: 2023, to: 2099 },
  "E8 (MEB)": { from: 2021, to: 2099 },
  "EB (MEB)": { from: 2022, to: 2099 },
  "ST (MEB)": { from: 2022, to: 2099 },
  "MEB": { from: 2020, to: 2099 },
  "5A (MEB)": { from: 2021, to: 2099 },
  "NM (MEB)": { from: 2021, to: 2099 },
  "NY (MEB)": { from: 2022, to: 2099 },
  "PY (MEB)": { from: 2025, to: 2099 },
  "RV (MEB)": { from: 2021, to: 2099 },
  "FZ/F4 (MEB)": { from: 2021, to: 2099 },
  "GH (PPE)": { from: 2023, to: 2099 },
  "GF (PPE)": { from: 2023, to: 2099 },
  "PPE": { from: 2023, to: 2099 },
  "XAB (PPE)": { from: 2023, to: 2099 },
  // Common VW EU type chassis
  "AW": { from: 2017, to: 2099 },
  "CD": { from: 2020, to: 2099 },
  "A1": { from: 2017, to: 2099 },
  "A1/SH": { from: 2017, to: 2099 },
  "C1": { from: 2019, to: 2099 },
  "R4": { from: 2023, to: 2099 },
  "3H": { from: 2017, to: 2099 },
  "3D": { from: 2017, to: 2099 },
  "BP": { from: 2017, to: 2099 },
  "1T": { from: 2003, to: 2015 },
  "5T": { from: 2015, to: 2099 },
  "2H": { from: 2010, to: 2099 },
  "SK": { from: 2020, to: 2099 },
  "SF": { from: 2022, to: 2099 },
  "T7": { from: 2021, to: 2099 },
  "T5/T6": { from: 2003, to: 2099 },
  "T6": { from: 2015, to: 2099 },
  "T6.1/T7": { from: 2019, to: 2099 },
  "6R": { from: 2009, to: 2017 },
  "6C": { from: 2014, to: 2017 },
  "6N": { from: 1994, to: 2001 },
  "6J": { from: 2021, to: 2099 },
  "9N": { from: 2002, to: 2009 },
  "NX": { from: 2020, to: 2099 },
  "NU": { from: 2017, to: 2099 },
  "NS": { from: 2017, to: 2099 },
  "NW": { from: 2019, to: 2099 },
  "NJ": { from: 2021, to: 2099 },
  "NZ": { from: 2024, to: 2099 },
  "PJ": { from: 2021, to: 2099 },
  "PV": { from: 2024, to: 2099 },
  "B6/B7": { from: 2005, to: 2014 },
  "B8": { from: 2014, to: 2023 },
  // Passat B9 only — never bare "B9" (collides with Audi A4 B9).
  "B9/CJ": { from: 2023, to: 2099 },
  // Audi Typ / generation (EU ZZZ + modern)
  "8V": { from: 2012, to: 2020 },
  "8V/FF": { from: 2012, to: 2020 },
  "FF": { from: 2020, to: 2099 },
  "8X": { from: 2010, to: 2018 },
  // Audi Typ GB (Q4 e-tron) uses chassis "MEB" — do not key "GB" here (Hyundai i20).
  "F5": { from: 2016, to: 2099 },
  "8S": { from: 2014, to: 2099 },
  "42": { from: 2015, to: 2099 },
  "8Y": { from: 2020, to: 2099 },
  "FW": { from: 2021, to: 2099 },
  // Audi SUV platforms (NA pos.7–8) — keys must match chassis strings on WA1 hits
  "4M/F1": { from: 2019, to: 2099 },
  "4M/F7": { from: 2016, to: 2099 },
  "FY": { from: 2018, to: 2099 },
  "8R/FP": { from: 2009, to: 2017 },
  "8R": { from: 2009, to: 2017 },
  "GU": { from: 2022, to: 2099 },
  "F3": { from: 2019, to: 2099 },
  "8U/FS": { from: 2012, to: 2018 },
  "8U": { from: 2012, to: 2018 },
  "4L": { from: 2006, to: 2015 },
  "4M": { from: 2015, to: 2099 },
  "4N/F8": { from: 2018, to: 2099 },
  "B9/8W": { from: 2016, to: 2099 },
  "GA": { from: 2017, to: 2099 },
  // Porsche family windows (generation not always in type alone)
  "970": { from: 2009, to: 2016 },
  "971": { from: 2016, to: 2099 },
  "970/971": { from: 2009, to: 2099 },
  "976": { from: 2024, to: 2099 },
  "981/982": { from: 2012, to: 2099 },
  "92A": { from: 2010, to: 2017 },
  "E3/9YA": { from: 2017, to: 2099 },
  "92A/E3": { from: 2010, to: 2099 },
  // Smart / MCC
  "450": { from: 1998, to: 2007 },
  "451": { from: 2007, to: 2015 },
  "452": { from: 2003, to: 2006 },
  "453": { from: 2014, to: 2019 },
  "HX11": { from: 2022, to: 2099 },
  "HC11": { from: 2022, to: 2099 },
  // BMW i / M platforms
  "I01": { from: 2014, to: 2022 },
  "I12": { from: 2014, to: 2020 },
  "I20": { from: 2021, to: 2099 },
  "F80": { from: 2014, to: 2018 },
  "F82": { from: 2014, to: 2020 },
  "F90": { from: 2017, to: 2023 },
  "G90": { from: 2024, to: 2099 },
  "G80": { from: 2020, to: 2099 },
  "G82": { from: 2020, to: 2099 },
  "F80/G80": { from: 2014, to: 2099 },
  "F82/G82": { from: 2014, to: 2099 },
  // WBS5 spans F10 (2011–16), F90 (2017–23), G90 (2024+) — year window only (not display).
  "F90/G90": { from: 2011, to: 2099 },
  "F10/F90/G90": { from: 2011, to: 2099 },
  "C9/FN": { from: 2023, to: 2099 },
  "4S": { from: 2006, to: 2015 },
  "8P": { from: 2003, to: 2013 },
  "8L": { from: 1996, to: 2003 },
  "8Z": { from: 1999, to: 2005 },
  "8T": { from: 2007, to: 2016 },
  "8F": { from: 2009, to: 2017 },
  "8E": { from: 2000, to: 2008 },
  "8K": { from: 2007, to: 2015 },
  "8H": { from: 2002, to: 2009 },
  "FJ": { from: 2018, to: 2099 },
  "AA": { from: 2011, to: 2099 },
  "NMS/A3": { from: 2011, to: 2099 },
  "5N/BW": { from: 2007, to: 2018 },
  "RM": { from: 2017, to: 2099 },
  "B2": { from: 2021, to: 2099 },
  "CA": { from: 2017, to: 2099 },
  "2K": { from: 2003, to: 2020 },
  "2D": { from: 2003, to: 2010 },
  "2F": { from: 2007, to: 2015 },
  "7E": { from: 2010, to: 2015 },
  "7N": { from: 2010, to: 2099 },
  "DF": { from: 2010, to: 2099 },
  "SY": { from: 2016, to: 2099 },
  "2E": { from: 2006, to: 2016 },
  "1G": { from: 1983, to: 1992 },
  "1H": { from: 1991, to: 1999 },
  "1J": { from: 1997, to: 2006 },
  "5K": { from: 2008, to: 2013 },
  "5M": { from: 2004, to: 2014 },
  "1Y": { from: 2003, to: 2010 },
  "9C": { from: 1998, to: 2011 },
  // Hyundai / Kia platform codes (from hyundai.ts chassis labels)
  "NX4": { from: 2021, to: 2099 },
  "NX4 US": { from: 2021, to: 2099 },
  "NX4 EU": { from: 2021, to: 2099 },
  "TL": { from: 2015, to: 2021 },
  "MX5": { from: 2024, to: 2099 },
  "MX5 US": { from: 2024, to: 2099 },
  "TM": { from: 2018, to: 2023 },
  "TM US": { from: 2018, to: 2023 },
  "SX2": { from: 2023, to: 2099 },
  "SX2 EU": { from: 2023, to: 2099 },
  "OS": { from: 2017, to: 2023 },
  "OS EU": { from: 2017, to: 2023 },
  "SU2 IN": { from: 2015, to: 2099 },
  "CN7": { from: 2020, to: 2099 },
  "CN7 US": { from: 2020, to: 2099 },
  "DN8": { from: 2019, to: 2099 },
  "PD": { from: 2016, to: 2099 },
  "PD EU": { from: 2016, to: 2099 },
  "BC3": { from: 2020, to: 2099 },
  "BC3 EU": { from: 2020, to: 2099 },
  "AC3": { from: 2019, to: 2099 },
  "VF": { from: 2011, to: 2019 },
  "JK1 US": { from: 2021, to: 2099 },
  "AD": { from: 2016, to: 2020 },
  "GD": { from: 2012, to: 2017 },
  "GB": { from: 2014, to: 2020 },
  // Toyota / Lexus platform codes (labels already on asian-eu / us-vds)
  "XA50": { from: 2019, to: 2099 },
  "XA50 UK": { from: 2019, to: 2099 },
  "XA40": { from: 2013, to: 2018 },
  "XV70": { from: 2018, to: 2024 },
  "XV70 Hybrid": { from: 2018, to: 2024 },
  "XV50": { from: 2012, to: 2017 },
  "XV40": { from: 2007, to: 2011 },
  "N300": { from: 2016, to: 2023 },
  "XK70": { from: 2022, to: 2099 },
  "XK50": { from: 2010, to: 2021 },
  "XK60": { from: 2008, to: 2022 },
  "XU70": { from: 2020, to: 2099 },
  "XU50": { from: 2014, to: 2019 },
  "XP210": { from: 2020, to: 2099 },
  "XP210 UK": { from: 2020, to: 2099 },
  "XP210 FR": { from: 2020, to: 2099 },
  "XP130": { from: 2011, to: 2020 },
  "E210": { from: 2019, to: 2099 },
  "E210 UK": { from: 2019, to: 2099 },
  "E210 2.0L": { from: 2019, to: 2099 },
  "E170": { from: 2014, to: 2019 },
  "JPD20": { from: 2021, to: 2099 },
  "A90": { from: 2019, to: 2099 },
  "A90 EU": { from: 2019, to: 2099 },
  "XL40": { from: 2021, to: 2099 },
  "XL30": { from: 2011, to: 2020 },
  "XG10": { from: 2020, to: 2099 },
  "XZ10": { from: 2019, to: 2099 }, // Lexus ES 7th gen
  // GM NA platforms (us-vds / gm-na chassis tokens)
  "D2XX": { from: 2018, to: 2099 },
  "SGM": { from: 2023, to: 2099 }, // Trax 2nd gen
  "C1UL": { from: 2019, to: 2099 },
  "9BXX": { from: 2021, to: 2099 },
  "E2XX": { from: 2016, to: 2099 },
  "Alpha": { from: 2016, to: 2099 },
  "M300": { from: 2016, to: 2099 },
  "AX20": { from: 2023, to: 2099 },
  "AX10": { from: 2017, to: 2023 },
  "XW60": { from: 2023, to: 2099 },
  "XW50": { from: 2016, to: 2022 },
  "XW30": { from: 2009, to: 2015 },
  "XW20": { from: 2003, to: 2009 },
  "S220": { from: 2022, to: 2099 },
  "AZ20": { from: 2022, to: 2099 },
  "J300": { from: 2021, to: 2099 },
  "J200": { from: 2008, to: 2021 },
  "J150": { from: 2009, to: 2023 },
  "N280": { from: 2010, to: 2024 },
  "AB40": { from: 2014, to: 2021 },
  "AB10": { from: 2005, to: 2014 },
  // Honda generation labels (exact strings from us-vds / asian-eu)
  "10th gen": { from: 2016, to: 2022 },
  "11th gen": { from: 2022, to: 2099 },
  "11th gen Hybrid": { from: 2023, to: 2099 },
  "5th gen": { from: 2017, to: 2022 },
  "5th gen Hybrid": { from: 2020, to: 2022 },
  "5th gen CA": { from: 2017, to: 2022 },
  "6th gen": { from: 2023, to: 2099 },
  "HR-V 3rd gen": { from: 2023, to: 2099 },
  "Fit 3rd gen": { from: 2014, to: 2020 },
  "Fit 2nd gen": { from: 2009, to: 2014 },
  "RW": { from: 2017, to: 2023 },
  "FK2/FK8": { from: 2015, to: 2021 },
  "FK": { from: 2012, to: 2017 },
  // Ford NA platforms
  "P702": { from: 2021, to: 2099 },
  "P415": { from: 2009, to: 2014 },
  "P415/P552": { from: 2009, to: 2020 },
  "S550": { from: 2015, to: 2023 },
  "S650": { from: 2024, to: 2099 },
  "S197": { from: 2005, to: 2014 },
  "U625": { from: 2020, to: 2099 },
  "U553": { from: 2018, to: 2099 },
  "U725": { from: 2021, to: 2099 },
  "CX430": { from: 2021, to: 2099 },
  "CX482": { from: 2020, to: 2099 },
  "V363": { from: 2015, to: 2099 },
  "Mk3 US": { from: 2012, to: 2018 },
  "Super Duty": { from: 2017, to: 2099 },
  "Mach-E": { from: 2021, to: 2099 },
  "Maverick": { from: 2022, to: 2099 },
  // Land Rover / Range Rover / Jaguar platforms
  "L316": { from: 1983, to: 2016 },
  "L318": { from: 1990, to: 2004 },
  "L319": { from: 2005, to: 2016 },
  "L314": { from: 1998, to: 2006 },
  "L320": { from: 2006, to: 2013 },
  "L322": { from: 2002, to: 2012 },
  "L359": { from: 2007, to: 2015 },
  "L405": { from: 2013, to: 2022 },
  "L405/L460": { from: 2013, to: 2099 },
  "L460": { from: 2022, to: 2099 },
  "L494": { from: 2014, to: 2022 },
  "L461": { from: 2023, to: 2099 },
  "L538": { from: 2012, to: 2019 },
  "L551": { from: 2020, to: 2099 },
  "L560": { from: 2017, to: 2099 },
  "L550": { from: 2014, to: 2099 },
  "L462": { from: 2017, to: 2099 },
  "L663": { from: 2020, to: 2099 },
  "X761": { from: 2016, to: 2099 },
  "X540": { from: 2018, to: 2099 },
  "X590": { from: 2019, to: 2099 },
  "X260": { from: 2015, to: 2099 },
  "X152": { from: 2013, to: 2099 },
  "X760": { from: 2015, to: 2099 },
  "X351": { from: 2010, to: 2019 },
  "X150": { from: 2006, to: 2014 },
  "X200": { from: 1999, to: 2008 },
  "X400": { from: 2001, to: 2009 },
  // Audi generation labels
  "C7": { from: 2011, to: 2018 },
  "C8": { from: 2018, to: 2099 },
  "C9": { from: 2023, to: 2099 },
  "B9 8W": { from: 2015, to: 2099 },
  "B8 8K": { from: 2008, to: 2016 },
  "C7 4G": { from: 2011, to: 2018 },
  "C8 4K": { from: 2018, to: 2099 },
  "C6 4F": { from: 2004, to: 2011 },
  // Audi Typ codes (EU ZZZ / homologation) — wide enough for NA digit-year fixtures
  "4H": { from: 2010, to: 2018 },
  "4E": { from: 2002, to: 2010 },
  "4D": { from: 1994, to: 2010 },
  "4N": { from: 2017, to: 2099 },
  "4A": { from: 2018, to: 2099 },
  "4K": { from: 2008, to: 2099 },
  "FD": { from: 2008, to: 2099 },
  "8W": { from: 2015, to: 2099 },
};

/** Chassis codes uniquely encoded in the VIN (Mercedes Baumuster / BMW E/F/G gens). */
function isLiteralPlatformChassis(key: string): boolean {
  // Mercedes W213, X253, C238, …
  if (/^[WCXARNVH]\d{3}\b/.test(key)) return true;
  // BMW E60, F10, G20, R56, U11, …
  if (/^[EFRGU]\d{2}\b/.test(key)) return true;
  // Land Rover / Jaguar Lxxx / Xxxx platforms
  if (/^L\d{3}\b/.test(key) || /^X\d{3}\b/.test(key)) return true;
  // Rolls model names / MINI Electric token kept when year unknown
  if (/^(Ghost|Phantom|Cullinan|Wraith|Dawn|Spectre|Electric)\b/i.test(key)) return true;
  // VAG Typ codes encoded in the VIN (CD, SF, E1, 5N, T7, …) — not slash compounds
  if (/^[A-Z0-9]{2}$/i.test(key) && CHASSIS_YEAR[key]) return true;
  if (/\((MEB|PPE)\)/i.test(key)) return true;
  // Smart MCC body series 450–454 / HX11 / HC11
  if (/^(450|451|452|453|454|HX11|HC11)$/i.test(key)) return true;
  return false;
}

/**
 * Production-year window for a chassis/generation code (e.g. "W213" → 2016–2023).
 * Used when the exact model year is not encoded (Euro Mercedes / classic BMW ETK).
 * Also resolves compound labels like "G16 Gran Coupé" via the leading platform token.
 */
export function chassisProductionWindow(
  chassis: string | null,
): { from: number; to: number } | null {
  if (!chassis) return null;
  const key = chassis.replace(/\s*\(US\)\s*$/i, "").trim();
  if (CHASSIS_YEAR[key]) return CHASSIS_YEAR[key]!;
  // Slash compounds: "G30/G31" → try left token.
  const slash = key.split("/")[0]!.trim();
  if (slash !== key && CHASSIS_YEAR[slash]) return CHASSIS_YEAR[slash]!;
  // Multi-word labels: "5th gen Hybrid" → "5th gen" → skip bare "5th".
  if (key.includes(" ")) {
    const parts = key.split(/\s+/);
    for (let n = parts.length - 1; n >= 2; n--) {
      const sub = parts.slice(0, n).join(" ");
      if (CHASSIS_YEAR[sub]) return CHASSIS_YEAR[sub]!;
    }
  }

  // "G16 Gran Coupé" / "F33 Convertible" → match G16 / F33 inside slash groups too.
  const token = key.match(/^([EFRGULWXHACVN]\d{2,3})\b/i)?.[1]?.toUpperCase();
  if (!token) return null;
  if (CHASSIS_YEAR[token]) return CHASSIS_YEAR[token]!;
  for (const [k, w] of Object.entries(CHASSIS_YEAR)) {
    const parts = k.split(/[/\s]+/).map((p) => p.toUpperCase());
    if (parts.includes(token)) return w;
  }
  return null;
}

/**
 * Formats a chassis production window as a human range, e.g. "2016–2023" or
 * "2020–present". Returns null when the generation window is unknown.
 */
export function formatProductionYearRange(chassis: string | null): string | null {
  const w = chassisProductionWindow(chassis);
  if (!w) return null;
  const currentYear = new Date().getFullYear();
  const to = w.to >= currentYear + 1 ? "present" : String(w.to);
  return `${w.from}\u2013${to}`;
}

function applyChassisYearGate(chassis: string | null, year: number | null): string | null {
  if (!chassis) return null;
  const key = chassis.replace(/\s*\(US\)\s*$/i, "").trim();
  const bounds = CHASSIS_YEAR[key]
    ?? CHASSIS_YEAR[key.split("/")[0]!]
    ?? (key.includes(" ") ? CHASSIS_YEAR[key.split(" ")[0]!] : undefined);
  if (!bounds) return chassis; // literal VIN platform token (7P, CR, NX, …)
  // Year unknown: keep chassis only when uniquely encoded in the VIN (Baumuster / ETK).
  // Compound labels like G30/G31 from prefix tables are generation claims — omit without a year.
  if (year == null) {
    if (key.includes("/")) return null;
    return isLiteralPlatformChassis(key) ? chassis : null;
  }
  if (year < bounds.from || year > bounds.to) return null;
  return chassis;
}

function finalizePremium(
  model: string,
  chassis: string | null,
  year: number | null,
): PremiumEuropeanDecode {
  const gated = applyChassisYearGate(chassis, year);
  return { model, chassis: gated, displayModel: formatDisplay(model, gated) };
}

/**
 * BMW F32/F33/F36 use ETK type codes at VDS positions 4–5 (VIN indices 3–4).
 * e.g. 3V71 = F33 428i Convertible (N26) — not F36 despite the trailing "7".
 */
function resolveBmwFourSeriesBody(vin: string): PremiumEuropeanDecode | null {
  const wmi = vin.slice(0, 3);
  if (
    !wmi.startsWith("WBA") && !wmi.startsWith("5UX") && !wmi.startsWith("5UM")
    && !wmi.startsWith("4US") && !wmi.startsWith("3MW") && !wmi.startsWith("3MF")
  ) return null;

  const usSuffix = wmi.startsWith("WBA") ? "" : " (US)";

  // F30 sedans that share a 3V1… prefix (must beat the 3V → F33 rule below).
  if (vin.startsWith("WBA3V1") || vin.startsWith("5UX3V1")) {
    const chassis = `F30 Sedan${usSuffix}`;
    const year = premiumVinModelYear(vin, chassisProductionWindow(chassis));
    return finalizePremium("3 Series", chassis, year);
  }

  const type45 = vin.slice(3, 5);

  if (type45 === "3V" || type45 === "3T" || type45 === "3U") {
    const chassis = `F33 Convertible${usSuffix}`;
    const year = premiumVinModelYear(vin, chassisProductionWindow(chassis));
    return finalizePremium("4 Series", chassis, year);
  }
  if (type45 === "3N" || type45 === "3R" || type45 === "3P" || type45 === "3S") {
    const chassis = `F32 Coupé${usSuffix}`;
    const year = premiumVinModelYear(vin, chassisProductionWindow(chassis));
    return finalizePremium("4 Series", chassis, year);
  }

  // F36 Gran Coupé — ETK codes 4A–4F (4C overlaps G26 from ~2021).
  if (type45 === "4A") {
    // 4A historically F36; G23 Convertible only when year uniquely fits G23 and not F36.
    const f36 = `F36 Gran Coupé${usSuffix}`;
    const g23 = `G23 Convertible${usSuffix}`;
    const yF36 = premiumVinModelYear(vin, chassisProductionWindow(f36));
    const yG23 = premiumVinModelYear(vin, chassisProductionWindow(g23));
    if (yG23 != null && yF36 == null) return finalizePremium("4 Series", g23, yG23);
    if (yF36 != null) return finalizePremium("4 Series", f36, yF36);
    return finalizePremium("4 Series", null, premiumVinModelYear(vin));
  }
  if (type45 === "4C") {
    // Overlap F36 vs G26 — only name a chassis when the ISO year uniquely resolves
    // into one generation window; otherwise model-only.
    const f36 = `F36 Gran Coupé${usSuffix}`;
    const g26 = `G26 Gran Coupé${usSuffix}`;
    const yF36 = premiumVinModelYear(vin, chassisProductionWindow(f36));
    const yG26 = premiumVinModelYear(vin, chassisProductionWindow(g26));
    if (yG26 != null && yF36 == null) return finalizePremium("4 Series", g26, yG26);
    if (yF36 != null && yG26 == null) return finalizePremium("4 Series", f36, yF36);
    return finalizePremium("4 Series", null, premiumVinModelYear(vin));
  }
  if (type45 === "4B" || type45 === "4D" || type45 === "4E" || type45 === "4F") {
    const chassis = `F36 Gran Coupé${usSuffix}`;
    const year = premiumVinModelYear(vin, chassisProductionWindow(chassis));
    return finalizePremium("4 Series", chassis, year);
  }

  return null;
}

// BMW: position 4 alone is NOT the series — 4 Series F32/F33/F36 use ETK type codes at 4–5.
// Ambiguous short prefixes (WBA3A/B/C) → model only; E90 reused on F30 VINs without year gate was a real bug.
const BMW_RULES = compilePrefixRules([
  { prefix: "WBA3V1", model: "3 Series", chassis: "F30 Sedan" },
  { prefix: "WBA3VG", model: "3 Series", chassis: "F31 Touring" },
  { prefix: "WBA3W", model: "3 Series", chassis: "G20/G21" },
  // Do NOT attach E90/E92/E93 — those prefixes were reused on later gens.
  { prefix: "WBA3C", model: "3 Series" },
  { prefix: "WBA3B", model: "3 Series" },
  { prefix: "WBA3A", model: "3 Series" },
  { prefix: "WBA4S", model: "4 Series", chassis: "G22 Coupé" },
  { prefix: "WBA4C", model: "4 Series", chassis: "G26 Gran Coupé" },
  { prefix: "WBA4A", model: "4 Series", chassis: "G23 Convertible" },
  { prefix: "WBA4W", model: "4 Series", chassis: "G22/G26" },
  { prefix: "WBA5E", model: "5 Series", chassis: "G30/G31" },
  { prefix: "WBA5J", model: "5 Series", chassis: "F10/F11" },
  { prefix: "WBA5U", model: "5 Series", chassis: "G60" },
  { prefix: "WBA7C", model: "7 Series", chassis: "G11/G12" },
  { prefix: "WBA7L", model: "7 Series", chassis: "G70" },
  // WBA7G spans pre-LCI and LCI — use full G11/G12 window (not LCI-only).
  { prefix: "WBA7G", model: "7 Series", chassis: "G11/G12" },
  { prefix: "WBA7H", model: "7 Series", chassis: "G70" },
  { prefix: "WBA7U", model: "7 Series", chassis: "G12" },
  // X1 — F48 vs U11 share WBA71; leave chassis null (year-ambiguous).
  { prefix: "WBA71", model: "X1" },
  { prefix: "WBA72", model: "X2", chassis: "F39" },
  { prefix: "5YM8", model: "X1", chassis: "F48 US" },
  { prefix: "5YM1", model: "X1" },
  { prefix: "WBA1C", model: "1 Series", chassis: "F20/F21" },
  { prefix: "WBA1H", model: "1 Series", chassis: "F40" },
  { prefix: "WBA2A", model: "2 Series", chassis: "Active Tourer (F45)" },
  { prefix: "WBA2T", model: "2 Series", chassis: "G42 Coupé" },
  { prefix: "WBA2X", model: "2 Series", chassis: "F44 Gran Coupé" },
  { prefix: "WBAJV6", model: "6 Series", chassis: "F12/F13 Convertible" },
  { prefix: "WBA6D", model: "6 Series", chassis: "F06 Gran Coupé" },
  { prefix: "WBA6C", model: "6 Series", chassis: "F12/F13" },
  { prefix: "WBA6F", model: "6 Series", chassis: "F12/F13" },
  { prefix: "WBA6", model: "6 Series" },
  // EU letter type codes (ETK model nos at pos.4–7) — not WBA8* numeric series.
  // XA71/XA72 = 535d F10 N57Z; XA5* = F10 530d/535d family (must beat WBAX3… SUV rules).
  { prefix: "WBAXA71", model: "5 Series", chassis: "F10/F11" },
  { prefix: "WBAXA72", model: "5 Series", chassis: "F10/F11" },
  { prefix: "WBAXA5", model: "5 Series", chassis: "F10/F11" },
  { prefix: "WBAXA", model: "5 Series", chassis: "F10/F11" },
  // DZ21/DZ2C = 840i Convertible G14; GV81 = M850i Gran Coupé G16; GW41 = 840d Gran Coupé G16.
  { prefix: "WBADZ", model: "8 Series", chassis: "G14 Convertible" },
  { prefix: "WBAGV", model: "8 Series", chassis: "G16 Gran Coupé" },
  { prefix: "WBAGW", model: "8 Series", chassis: "G16 Gran Coupé" },
  { prefix: "WBAFY", model: "8 Series", chassis: "G14 Convertible" },
  { prefix: "WBAAE", model: "8 Series", chassis: "G15 Coupé" },
  { prefix: "WBABC", model: "8 Series", chassis: "G15 Coupé" },
  { prefix: "WBA8C", model: "8 Series", chassis: "G14/G15/G16" },
  { prefix: "WBA8", model: "8 Series" },
  // JC31 = 520d G30 (ETK); keep prefix at JC so JC3x/JC5x stay 5 Series.
  { prefix: "WBAJC", model: "5 Series", chassis: "G30/G31" },
  { prefix: "WBAJE", model: "5 Series", chassis: "G30/G31" },
  { prefix: "WBAJS", model: "5 Series", chassis: "G30/G31" },
  { prefix: "WBA21E", model: "X7", chassis: "G07" },
  { prefix: "WBA21C", model: "X7", chassis: "G07" },
  { prefix: "WBA21B", model: "X7", chassis: "G07" },
  { prefix: "WBA21", model: "X7", chassis: "G07" },
  { prefix: "WBA53A", model: "X5", chassis: "G05" },
  { prefix: "WBA53B", model: "X5", chassis: "G05" },
  { prefix: "WBA53", model: "X5", chassis: "G05" },
  { prefix: "WBA31A", model: "X3", chassis: "G01" },
  { prefix: "WBA31B", model: "X3", chassis: "G01" },
  { prefix: "WBA31", model: "X3", chassis: "G01" },
  { prefix: "WBA13A", model: "X4", chassis: "G02" },
  { prefix: "WBA13", model: "X4", chassis: "G02" },
  { prefix: "WBA11A", model: "X6", chassis: "G06" },
  { prefix: "WBA11", model: "X6", chassis: "G06" },
  { prefix: "WBAX3", model: "X3", chassis: "G01" },
  { prefix: "WBAX4", model: "X4", chassis: "G02" },
  { prefix: "WBAX5", model: "X5", chassis: "G05" },
  { prefix: "WBAX6", model: "X6", chassis: "G06" },
  { prefix: "WBAX7", model: "X7", chassis: "G07" },
  { prefix: "WBA3", model: "3 Series" },
  { prefix: "WBA4", model: "4 Series" },
  { prefix: "WBA5", model: "5 Series" },
  { prefix: "WBA7", model: "7 Series" },
  { prefix: "5UX3W", model: "3 Series", chassis: "G20 (US)" },
  { prefix: "5UX5J", model: "5 Series", chassis: "F10 (US)" },
  { prefix: "5UX5E", model: "5 Series", chassis: "G30 (US)" },
  { prefix: "5UXWX", model: "X3", chassis: "G01 (US)" },
  { prefix: "5UXKR", model: "X5", chassis: "G05 (US)" },
  { prefix: "5UXKS", model: "X5", chassis: "G05 (US)" },
  { prefix: "5UXCW", model: "X7", chassis: "G07 (US)" },
  { prefix: "5UXCR", model: "X7", chassis: "G07 (US)" },
  { prefix: "5UX53", model: "X7", chassis: "G07 (US)" },
  { prefix: "5UXXW", model: "X3", chassis: "G01 (US)" },
  { prefix: "5UX43", model: "X4", chassis: "G02 (US)" },
  // BMW Mexico / legacy NA — NHTSA DecodeVinValues samples
  { prefix: "3MW5R", model: "3 Series", chassis: "G20 (MX)" },
  { prefix: "5UMB", model: "Z4" },
  { prefix: "WBS3", model: "M3", chassis: "F80/G80" },
  { prefix: "WBS4", model: "M4", chassis: "F82/G82" },
  { prefix: "WBS5", model: "M5" },
  { prefix: "WBY1", model: "i3", chassis: "I01" },
  { prefix: "WBY2", model: "i7", chassis: "G70" },
  { prefix: "WBY5", model: "i4", chassis: "G26 Gran Coupé" },
  { prefix: "WBY8", model: "i8", chassis: "I12" },
  { prefix: "WBY7", model: "iX", chassis: "I20" },
]);

const MERCEDES_RULES = compilePrefixRules([
  { prefix: "WDD177", model: "A-Class", chassis: "W177" },
  { prefix: "WDD176", model: "A-Class", chassis: "W176" },
  { prefix: "WDD169", model: "A-Class", chassis: "W169" },
  { prefix: "WDD168", model: "A-Class", chassis: "W168" },
  { prefix: "WDD118", model: "CLA", chassis: "C118" },
  { prefix: "WDD117", model: "CLA", chassis: "C117" },
  // Letter-VDS coupe/roadster/4-door-coupe lines (pos 4–5). These share pos-4
  // letters with unrelated models, so they MUST be matched at 2 chars, not 1.
  // Verified against NHTSA vPIC: SJ/5J = CLA, PK = SLK/SLC, JK = SL, LJ = CLS.
  { prefix: "WDDSJ", model: "CLA", chassis: "C117" },
  { prefix: "WDD5J", model: "CLA", chassis: "C118" },
  { prefix: "WDDPK", model: "SLK / SLC", chassis: "R172" },
  { prefix: "WDDJK", model: "SL", chassis: "R231" },
  { prefix: "WDD205", model: "C-Class", chassis: "W205" },
  { prefix: "WDD206", model: "C-Class", chassis: "W206" },
  { prefix: "WDD204", model: "C-Class", chassis: "W204" },
  { prefix: "WDD203", model: "C-Class", chassis: "W203" },
  { prefix: "WDD202", model: "C-Class", chassis: "W202" },
  { prefix: "WDD213", model: "E-Class", chassis: "W213" },
  { prefix: "WDD214", model: "E-Class", chassis: "W214" },
  { prefix: "WDD212", model: "E-Class", chassis: "W212" },
  { prefix: "WDD211", model: "E-Class", chassis: "W211" },
  { prefix: "WDD210", model: "E-Class", chassis: "W210" },
  { prefix: "WDD207", model: "E-Class Coupé/Cabrio", chassis: "C207" },
  { prefix: "WDD218", model: "CLS", chassis: "C218" },
  { prefix: "WDD257", model: "CLS", chassis: "C257" },
  { prefix: "WDD222", model: "S-Class", chassis: "W222" },
  { prefix: "WDD223", model: "S-Class", chassis: "W223" },
  { prefix: "WDD221", model: "S-Class", chassis: "W221" },
  { prefix: "WDD220", model: "S-Class", chassis: "W220" },
  { prefix: "WDD253", model: "GLC", chassis: "X253" },
  { prefix: "WDD254", model: "GLC", chassis: "X254" },
  // W166: sold as ML through MY2015, renamed GLE from MY2016 (refined by year below).
  { prefix: "WDD166", model: "GLE", chassis: "W166" },
  // 167 = GLE (W167) and GLS (X167) — do not pick one from chassis digits alone.
  { prefix: "WDD167", model: "GLE / GLS", chassis: "W167/X167" },
  { prefix: "WDD156", model: "GLA", chassis: "X156" },
  // 247 = GLA (H247) and GLB (X247) — do not pick one from chassis digits alone.
  { prefix: "WDD247", model: "GLA / GLB", chassis: "H247/X247" },
  { prefix: "WDD246", model: "B-Class", chassis: "W246" },
  { prefix: "WDD163", model: "ML-Class", chassis: "W163" },
  { prefix: "WDD164", model: "ML-Class", chassis: "W164" },
  // Digit 251 mapped historically as GLK (X204) in this codebase — keep stable.
  { prefix: "WDD251", model: "GLK", chassis: "X204" },
  { prefix: "WDD292", model: "GLE Coupé", chassis: "C292" },
  { prefix: "WDD463", model: "G-Class", chassis: "W463/W465" },
  { prefix: "WDD465", model: "G-Class", chassis: "W465" },
  { prefix: "WDD290", model: "EQS", chassis: "V297" },
  { prefix: "WDD294", model: "EQE", chassis: "V294" },
  { prefix: "WDD296", model: "EQS SUV", chassis: "X296" },
  // 243 = EQA (H243) and EQB (X243) — do not pick one.
  { prefix: "WDD243", model: "EQA / EQB", chassis: "H243/X243" },
  { prefix: "WDD293", model: "EQC", chassis: "N293" },
  { prefix: "WDD236", model: "CLE", chassis: "C236" },
  { prefix: "WDD245", model: "B-Class", chassis: "W245" },
  { prefix: "WDD238", model: "E-Class Coupé/Cabrio", chassis: "C238" },
  { prefix: "WDD172", model: "SLK / SLC", chassis: "R172" },
  { prefix: "WDD231", model: "SL", chassis: "R231" },
  { prefix: "WDD190", model: "AMG GT", chassis: "C190" },
  { prefix: "WDD192", model: "AMG GT", chassis: "C192" },
  { prefix: "WDD197", model: "SL", chassis: "R232" },
  { prefix: "WDDLJ", model: "CLS", chassis: "C257" },
]);

/**
 * Mercedes passenger cars — position 4 series letter (North American / letter VDS).
 * Letters were reused across generations; year-band the class.
 * When year is null, modern-only windows may uniquely resolve the ISO letter
 * (never old-cycle-only windows that invent 1980s cars from modern VINs).
 */
function mercedesPassengerSeriesAt4(
  letter: string,
  year: number | null,
  vin?: string,
): { model: string; chassis?: string } | null {
  const modernGate = (
    model: string,
    chassis: string | undefined,
    from: number,
    to: number,
  ): { model: string; chassis?: string } | null => {
    if (!vin) return null;
    const y = premiumVinModelYear(vin, { from, to });
    return y != null ? { model, chassis } : null;
  };

  switch (letter) {
    case "H":
      if (year == null) return modernGate("E-Class", "W212", 2009, 2016);
      return year <= 2000 ? { model: "C-Class" } : { model: "E-Class", chassis: "W212" };
    case "Z":
      // W213 family letter — attach chassis only when year fits (or is still unknown).
      if (year != null && (year < 2016 || year > 2023)) return { model: "E-Class" };
      return { model: "E-Class", chassis: "W213" };
    case "1":
      return { model: "E-Class Coupé/Cabrio", chassis: "C238" };
    case "K":
      if (year != null && year >= 2009 && year <= 2017) {
        return { model: "E-Class Coupé/Cabrio", chassis: "C207" };
      }
      if (year == null) return modernGate("E-Class Coupé/Cabrio", "C207", 2009, 2017);
      return null;
    case "L":
      if (year != null && year >= 2023) return { model: "E-Class", chassis: "W214" };
      if (year != null && year >= 2011 && year <= 2020) return { model: "CLS", chassis: "C218" };
      if (year == null && vin) {
        const e214 = modernGate("E-Class", "W214", 2023, 2099);
        if (e214) return e214;
        return modernGate("CLS", "C218", 2011, 2020);
      }
      return null;
    case "G":
      if (year == null) return modernGate("C-Class", "W204", 2007, 2014);
      return year <= 2006 ? { model: "S-Class" } : { model: "C-Class", chassis: "W204" };
    case "W":
      if (year == null) return modernGate("C-Class", "W205", 2014, 2021);
      if (year < 2014) return { model: "SLK" };
      return { model: "C-Class", chassis: "W205" };
    case "A":
      if (year != null && year >= 2021) return { model: "C-Class", chassis: "W206" };
      return modernGate("C-Class", "W206", 2021, 2099);
    case "R":
      if (year != null && year <= 2007) return { model: "C-Class" };
      return null;
    case "U":
      if (year != null && year <= 2009) return { model: "E-Class" };
      if (year != null && year >= 2013 && year <= 2020) return { model: "S-Class", chassis: "W222" };
      if (year == null) return modernGate("S-Class", "W222", 2013, 2020);
      return null;
    case "J":
      if (year != null && year <= 2003) return { model: "E-Class" };
      if (year != null && year >= 2012) return { model: "SL-Class", chassis: "R231" };
      if (year == null) return modernGate("SL-Class", "R231", 2012, 2020);
      return null;
    case "M":
      if (year != null && year >= 2023) return { model: "CLE", chassis: "C236" };
      return modernGate("CLE", "C236", 2023, 2099);
    case "E":
      if (year != null && year >= 2022) return { model: "EQE", chassis: "V294" };
      return modernGate("EQE", "V294", 2022, 2099);
    case "C":
      if (year != null && year >= 2021) return { model: "EQS", chassis: "V297" };
      return modernGate("EQS", "V297", 2021, 2099);
    default:
      return null;
  }
}

/**
 * Mercedes SUVs (WDC / W1N / 4JG) — North American letter VDS.
 * Position 4 = series/platform; position 5 = body style (disambiguates GLE vs GLS, GLA vs GLB, etc.).
 * Source: Wikibooks Mercedes-Benz VIN Codes (SUV series + body tables).
 * When year is null, year-gated branches use unique production windows only.
 */
function mercedesSuvFromLetterVds(
  series: string,
  body: string,
  year: number | null,
  vin?: string,
): { model: string; chassis?: string } | null {
  const gate = (
    gates: Array<{ model: string; chassis?: string; from: number; to: number }>,
  ): { model: string; chassis?: string } | null => {
    if (!vin) return null;
    const hits: Array<{ model: string; chassis?: string; year: number }> = [];
    for (const g of gates) {
      const y = premiumVinModelYear(vin, { from: g.from, to: g.to });
      if (y != null) hits.push({ model: g.model, chassis: g.chassis, year: y });
    }
    return hits.length === 1 ? { model: hits[0]!.model, chassis: hits[0]!.chassis } : null;
  };

  switch (series) {
    case "A":
      return { model: "ML-Class", chassis: "W163" };
    case "B":
      // B+F ≈ X164 GL; otherwise W164 M-Class
      if (body === "F") return { model: "GL-Class", chassis: "X164" };
      return { model: "ML-Class", chassis: "W164" };
    case "C":
      // Series C = R-Class (W251). G-Class uses Y/W (and older body R/C).
      if (body === "C" || body === "R" || body === "H") {
        if (year != null && year >= 2024) return { model: "G-Class", chassis: "W465" };
        if (year != null) return { model: "G-Class", chassis: "W463" };
        return gate([
          { model: "G-Class", chassis: "W463", from: 1990, to: 2023 },
          { model: "G-Class", chassis: "W465", from: 2024, to: 2099 },
        ]) ?? { model: "G-Class", chassis: "W463" };
      }
      return { model: "R-Class", chassis: "W251" };
    case "D":
      // D+M (2022+) = EQS SUV; D+F = X166 GL/GLS; D+D/E = GLE Coupe; D+A = W166 ML/GLE
      if (body === "M") {
        if (year != null && year >= 2022) return { model: "EQS SUV", chassis: "X296" };
        if (year == null) return gate([{ model: "EQS SUV", chassis: "X296", from: 2022, to: 2099 }]);
        return null;
      }
      if (body === "F") {
        if (year != null && year >= 2017) return { model: "GLS", chassis: "X166" };
        if (year != null) return { model: "GL-Class", chassis: "X166" };
        return gate([
          { model: "GL-Class", chassis: "X166", from: 2006, to: 2016 },
          { model: "GLS", chassis: "X166", from: 2017, to: 2019 },
        ]);
      }
      if (body === "D" || body === "E") return { model: "GLE Coupe", chassis: "C292" };
      if (year != null && year < 2016) return { model: "ML-Class", chassis: "W166" };
      if (year != null) return { model: "GLE", chassis: "W166" };
      return gate([
        { model: "ML-Class", chassis: "W166", from: 2011, to: 2015 },
        { model: "GLE", chassis: "W166", from: 2016, to: 2019 },
      ]);
    case "E":
      return { model: "GLE Coupe", chassis: "C292" };
    case "F":
      // F+F = X167 GLS; F+B/A = W167/C167 GLE — otherwise ambiguous
      if (body === "F") return { model: "GLS", chassis: "X167" };
      if (body === "B" || body === "A") return { model: "GLE", chassis: "W167" };
      return null;
    case "G":
      // Series G = GLK (X204) or EQE SUV (X294). Mid years are ambiguous.
      if (year != null && year >= 2022) return { model: "EQE SUV", chassis: "X294" };
      if (year != null && year <= 2015) return { model: "GLK", chassis: "X204" };
      if (year == null) {
        return gate([
          { model: "GLK", chassis: "X204", from: 2008, to: 2015 },
          { model: "EQE SUV", chassis: "X294", from: 2022, to: 2099 },
        ]) ?? { model: "GLK / EQE SUV" };
      }
      return null;
    case "0":
      if (body === "J") return { model: "GLC Coupe", chassis: "C253" };
      return { model: "GLC", chassis: "X253" };
    case "K":
      if (body === "J") return { model: "GLC Coupe", chassis: "C254" };
      return { model: "GLC", chassis: "X254" };
    case "J":
      // Letter J as series ≈ GLC Coupe (C253); also covered via 0+J / K+J.
      if (year != null && year >= 2023) return { model: "GLC Coupe", chassis: "C254" };
      if (year != null) return { model: "GLC Coupe", chassis: "C253" };
      return gate([
        { model: "GLC Coupe", chassis: "C253", from: 2016, to: 2022 },
        { model: "GLC Coupe", chassis: "C254", from: 2023, to: 2099 },
      ]) ?? { model: "GLC Coupe", chassis: "C253" };
    case "T":
      return { model: "GLA", chassis: "X156" };
    case "Y":
      return { model: "G-Class", chassis: "W463" };
    case "W":
      return { model: "G-Class", chassis: "W465" };
    case "R":
      return { model: "G-Class", chassis: "W463" };
    case "4":
      // 4+M = GLB; 4+N/G = GLA (H247)
      if (body === "M") return { model: "GLB", chassis: "X247" };
      if (body === "N" || body === "G") return { model: "GLA", chassis: "H247" };
      return { model: "GLA / GLB", chassis: "H247/X247" };
    case "9":
      return { model: "EQB", chassis: "X243" };
    case "N":
      // Body N is GLA (H247); rare as series — treat as GLA when present on SUV WMI.
      return { model: "GLA", chassis: "H247" };
    default:
      return null;
  }
}

/**
 * Legacy WA1 pos.4 fallbacks removed: on NA Audi SUVs position 4 is trim tier
 * (Premium / Prestige / S line), not the model. Model is positions 7–8 via
 * decodeAudiModern (F1=Q8, FY=Q5, F7=Q7, F3=Q3, …).
 */
const AUDI_US_RULES = compilePrefixRules([]);

const AUDI_RULES = compilePrefixRules([
  { prefix: "WAUZZZ8V", model: "A3", chassis: "8V" },
  { prefix: "WAUZZZ8Y", model: "A3 / S3 / RS3", chassis: "8Y" },
  { prefix: "WAUZZZ8X", model: "A1", chassis: "8X" },
  { prefix: "WAUZZZFF", model: "A3", chassis: "FF" },
  { prefix: "WAUZZZF5", model: "A5", chassis: "F5" },
  { prefix: "WAUZZZFG", model: "R8", chassis: "42" },
  { prefix: "WAUZZZFV", model: "TT", chassis: "8S" },
  { prefix: "WAUZZZ8Z", model: "A2", chassis: "8Z" },
  { prefix: "WAUZZZ8W", model: "A4 / S4 / RS4", chassis: "B9 8W" },
  { prefix: "WAUZZZ8K", model: "A4" },
  { prefix: "WAUZZZ8H", model: "A4 / A5" },
  { prefix: "WAUZZZ8N", model: "TT", chassis: "8N" },
  // C7/C8 typcodes — never "A6 / A7". C8 A6 is 4A*; C8 A7 is 4K*.
  { prefix: "WAUZZZ4G8", model: "A7 Sportback", chassis: "C7" },
  { prefix: "WAUZZZ4GA", model: "A7 Sportback", chassis: "C7" },
  { prefix: "WAUZZZ4GF", model: "A7 Sportback", chassis: "C7" },
  { prefix: "WAUZZZ4G5", model: "A6 Avant", chassis: "C7" },
  { prefix: "WAUZZZ4GD", model: "A6 Avant", chassis: "C7" },
  { prefix: "WAUZZZ4G2", model: "A6", chassis: "C7" },
  { prefix: "WAUZZZ4GC", model: "A6", chassis: "C7" },
  { prefix: "WAUZZZ4GH", model: "A6 allroad", chassis: "C7" },
  { prefix: "WAUZZZ4GJ", model: "A6 allroad", chassis: "C7" },
  { prefix: "WAUZZZ4F", model: "A6 Avant" },
  { prefix: "WAUZZZ4KA", model: "A7 Sportback", chassis: "C8" },
  { prefix: "WAUZZZ4K8", model: "A7 Sportback", chassis: "C8" },
  { prefix: "WAUZZZ4K", model: "A7 Sportback", chassis: "C8" },
  // Typ 4H = A8 D4 (was wrongly A7). Typ 4A = A6 (C4 and C8).
  { prefix: "WAUZZZ4H", model: "A8 / S8", chassis: "4H" },
  { prefix: "WAUZZZ4D", model: "A8 / S8", chassis: "4D" },
  { prefix: "WAUZZZ4E", model: "A8 / S8", chassis: "4E" },
  { prefix: "WAUZZZ4A5", model: "A6 Avant", chassis: "4A" },
  { prefix: "WAUZZZ4A2", model: "A6", chassis: "4A" },
  { prefix: "WAUZZZ4AH", model: "A6 allroad", chassis: "4A" },
  { prefix: "WAUZZZ4A", model: "A6", chassis: "4A" },
  // GY = A3 Typ 8Y; GA = Q2 (not Q5/Q7).
  { prefix: "WAUZZZGY", model: "A3 / S3 / RS3", chassis: "8Y" },
  { prefix: "WAUZZZGA", model: "Q2", chassis: "GA" },
  { prefix: "WAUZZZGE", model: "Q8 / e-tron" },
  { prefix: "WAUZZZGS", model: "Q3" },
  { prefix: "WAUZZZGU", model: "Q5 / SQ5", chassis: "GU" },
  { prefix: "WAUZZZGH", model: "A6 e-tron / S6 e-tron", chassis: "PPE" },
  { prefix: "WAUZZZGF", model: "Q6 e-tron / SQ6 e-tron", chassis: "PPE" },
  { prefix: "WAUZZZFW", model: "e-tron GT", chassis: "J1" },
  { prefix: "WAUZZZGB", model: "Q4 e-tron" },
  { prefix: "WAUZZZFG", model: "R8", chassis: "42" },
  { prefix: "WAUZZZFX", model: "R8", chassis: "4S" },
  { prefix: "WAUZZZTR", model: "TT" },
]);

const PORSCHE_RULES = compilePrefixRules([
  // "99" is the long-running 911 family code — do NOT hardcode 992.
  { prefix: "WP0ZZZ99", model: "911" },
  { prefix: "WP0ZZZ97", model: "Panamera", chassis: "970/971" },
  { prefix: "WP0ZZZ98", model: "Boxster/Cayman", chassis: "981/982" },
  { prefix: "WP0ZZZ92", model: "Cayenne", chassis: "92A/E3" },
  { prefix: "WP0ZZZ95", model: "Panamera", chassis: "970/971" },
  { prefix: "WP0ZZZ9Y", model: "Taycan", chassis: "J1" },
  { prefix: "WP1ZZZ9Z", model: "Macan", chassis: "95B" },
  { prefix: "WP1ZZZ92", model: "Cayenne", chassis: "E3/9YA" },
  { prefix: "WP0AA", model: "911" },
  { prefix: "WP0AB", model: "Boxster/Cayman" },
  { prefix: "WP0AC", model: "Cayenne" },
  { prefix: "WP0AZ", model: "Panamera" },
  { prefix: "WP0AG", model: "Taycan" },
  { prefix: "WP1AA", model: "Cayenne" },
  { prefix: "WP1AZ", model: "Macan" },
]);

/** Bratislava (WVG) also builds these VW platforms — prefer over Audi homologation. */
const VW_PLATFORM_CODES_ON_WVG = new Set([
  "7P", "7L", "CR", "AA", "1T", "1K", "1Z", "1J", "2H", "2D", "2E", "2F", "2K",
  "3C", "3D", "5N", "5M", "5Z", "6R", "6J", "6C", "7H", "7N", "7E", "9N", "9Z",
  "AU", "AW", "AX", "AZ", "CJ", "E1", "E2", "SH", "SY", "SK", "ST", "CD", "BP", "DF",
  "SF", "SG", "7J",
]);

const VW_RULES = compilePrefixRules([
  // Typ 1K = Golf Mk5 (not Mk7/8). Keep model only — Typ→Mk mapping was wrong.
  { prefix: "WVWZZZ1K", model: "Golf", chassis: "Mk5" },
  { prefix: "WVWZZZ1Z", model: "Golf" },
  // Typ 3C = Passat B6/B7 (not B8).
  { prefix: "WVWZZZ3C", model: "Passat", chassis: "B6/B7" },
  { prefix: "WVWZZZ3D", model: "Arteon", chassis: "3H" },
  { prefix: "WVWZZZ5N", model: "Tiguan", chassis: "AD1/AD2" },
  { prefix: "WVWZZZ5M", model: "Golf Plus", chassis: "5M" },
  { prefix: "WVWZZZ7P", model: "Touareg", chassis: "7P" },
  { prefix: "WVWZZZ7L", model: "Touareg", chassis: "7L" },
  { prefix: "WVWZZZCR", model: "Touareg", chassis: "CR" },
  { prefix: "WVWZZZAW", model: "Polo", chassis: "6R/AW" },
  { prefix: "WVWZZZE1", model: "ID.3", chassis: "E1 (MEB)" },
  { prefix: "WVWZZZE2", model: "ID.4", chassis: "E2 (MEB)" },
  { prefix: "WVWZZZE3", model: "ID.5", chassis: "E3 (MEB)" },
  { prefix: "WVWZZZE4", model: "ID.7", chassis: "E4 (MEB)" },
  { prefix: "WVGZZZEB", model: "ID. Buzz", chassis: "EB (MEB)" },
  { prefix: "WVWZZZCJ", model: "Passat Variant", chassis: "B9/CJ" },
  { prefix: "WVWZZZCT", model: "Tiguan", chassis: "CT1" },
  { prefix: "WVWZZZR4", model: "Tayron", chassis: "R4" },
  { prefix: "WVWZZZSY", model: "Crafter", chassis: "SY" },
  // Typ AU = Golf Mk7 (not Mk6).
  { prefix: "WVWZZZAU", model: "Golf", chassis: "Mk7" },
  { prefix: "WVWZZZ1J", model: "Jetta" },
  { prefix: "WVWZZZ1G", model: "Golf / Jetta", chassis: "1G" },
  { prefix: "WVWZZZ1H", model: "Golf / Vento", chassis: "1H" },
  { prefix: "WVWZZZ5K", model: "Golf / Jetta", chassis: "5K" },
  { prefix: "WVWZZZAA", model: "Up!" },
  { prefix: "WVWZZZ2K", model: "Caddy / Caddy Maxi", chassis: "2K" },
  { prefix: "WVWZZZ1T", model: "Touran", chassis: "1T" },
  { prefix: "WVWZZZ5T", model: "Touran", chassis: "5T" },
  { prefix: "WVWZZZ9N", model: "Polo", chassis: "9N" },
  { prefix: "WVGZZZ1T", model: "Touran", chassis: "1T" },
  { prefix: "WVGZZZ5T", model: "Touran", chassis: "5T" },
  { prefix: "WVGZZZ7P", model: "Touareg", chassis: "7P" },
  { prefix: "WVGZZZ7L", model: "Touareg", chassis: "7L" },
  { prefix: "WVGZZZCR", model: "Touareg", chassis: "CR" },
  { prefix: "WVGZZZAA", model: "Up!" },
  { prefix: "WVWZZZSH", model: "T-Roc" },
  { prefix: "WVWZZZCD", model: "Golf", chassis: "Mk8" },
  { prefix: "WVWZZZBP", model: "Arteon" },
  { prefix: "WVWZZZ2H", model: "Amarok" },
  { prefix: "WVWZZZ7H", model: "Transporter / Multivan", chassis: "T5/T6" },
  { prefix: "WVWZZZ6R", model: "Polo", chassis: "6R" },
  { prefix: "WVWZZZ6J", model: "Taigo" },
  { prefix: "WVWZZZDF", model: "Sharan" },
  { prefix: "WVWZZZ7N", model: "Sharan" },
  { prefix: "WVWZZZ2D", model: "Caddy", chassis: "C5" },
  { prefix: "WVWZZZ2E", model: "Crafter", chassis: "2E" },
  { prefix: "WVWZZZ7E", model: "Caddy", chassis: "C4" },
  { prefix: "WVWZZZ2F", model: "Caddy Maxi" },
  { prefix: "WVWZZZSK", model: "Caddy", chassis: "SK" },
  { prefix: "WVWZZZ6C", model: "Polo", chassis: "6C" },
  { prefix: "WV2ZZZSF", model: "Multivan", chassis: "T7" },
  { prefix: "WV2ZZZSG", model: "California", chassis: "T6.1/T7" },
  { prefix: "WV2ZZZ7H", model: "Multivan", chassis: "T6/T6.1" },
  { prefix: "WV2ZZZ7J", model: "Multivan", chassis: "T6" },
  { prefix: "WV1ZZZ7H", model: "Transporter", chassis: "T6" },
  { prefix: "WV1ZZZ7J", model: "Transporter", chassis: "T6" },
  { prefix: "WV2ZZZ2K", model: "Caddy", chassis: "C5" },
  { prefix: "WV2ZZZ2E", model: "Crafter", chassis: "2E" },
  { prefix: "WVGZZZ2D", model: "Caddy", chassis: "C5" },
  { prefix: "WVGZZZ2E", model: "Crafter", chassis: "2E" },
  { prefix: "3VWZZZ", model: "Volkswagen" },
]);

const MINI_RULES = compilePrefixRules([
  // Modern F-gen (longest first via compile)
  { prefix: "WMWXP7", model: "MINI Cooper", chassis: "F56" },
  { prefix: "WMWXP9", model: "MINI Cooper", chassis: "F55" },
  { prefix: "WMWXS7", model: "MINI Clubman", chassis: "F54" },
  { prefix: "WMWXS1", model: "MINI Countryman", chassis: "F60" },
  { prefix: "WMWZP7", model: "MINI Cooper SE", chassis: "Electric" },
  { prefix: "WMWZB9", model: "MINI Cooper SE", chassis: "Electric" },
  // R-gen (2001–2016 era) — year-ambiguous WMWX alone is intentionally omitted
  { prefix: "WMWRC3", model: "MINI Cooper", chassis: "R56" },
  { prefix: "WMWRF3", model: "MINI Cooper", chassis: "R56" },
  { prefix: "WMWRH3", model: "MINI Cooper", chassis: "R55" },
  { prefix: "WMWRJ3", model: "MINI Clubman", chassis: "R55" },
  { prefix: "WMWZC3", model: "MINI Cooper", chassis: "R56" },
  { prefix: "WMWZB3", model: "MINI Cooper", chassis: "R56" },
  { prefix: "WMWMF3", model: "MINI Countryman", chassis: "R60" },
  { prefix: "WMWZB5", model: "MINI Paceman", chassis: "R61" },
  { prefix: "WMWZK5", model: "MINI Paceman", chassis: "R61" },
]);

/** Rolls-Royce — SCA* model lines with chassis when stable. */
const ROLLS_RULES = compilePrefixRules([
  { prefix: "SCAF", model: "Spectre", chassis: "Spectre" },
  { prefix: "SCAC", model: "Cullinan", chassis: "Cullinan" },
  { prefix: "SCAD", model: "Wraith", chassis: "Wraith" },
  { prefix: "SCAB", model: "Phantom", chassis: "Phantom VIII" },
  { prefix: "SCAA", model: "Ghost", chassis: "Ghost" },
  { prefix: "SCAE", model: "Dawn", chassis: "Dawn" },
]);

export type PremiumEuropeanDecode = {
  model: string;
  chassis: string | null;
  displayModel: string;
};

function formatDisplay(model: string, chassis: string | null): string {
  if (!chassis) return model;
  if (chassis.startsWith(model)) return chassis;
  return `${model} (${chassis})`;
}

/** W1K / WDB / WDC / WDF / W1N / 4JG share VDS chassis codes with WDD — alias for rule matching only. */
function mercedesRuleVin(vin: string): string {
  if (vin.startsWith("W1K") || vin.startsWith("W1N") || vin.startsWith("4JG")) {
    return `WDD${vin.slice(3)}`;
  }
  if (vin.startsWith("WDB") || vin.startsWith("WDC") || vin.startsWith("WDF")) {
    return `WDD${vin.slice(3)}`;
  }
  return vin;
}

function isMercedesPassengerWmi(wmi: string): boolean {
  // W1L / W1M / 55S are in WMI_MAP for make identity only — do not run letter-VDS
  // series fallbacks until their VDS layouts are verified (avoids invented models).
  return wmi.startsWith("WDD") || wmi.startsWith("W1K") || wmi.startsWith("WDB") || wmi.startsWith("WDF");
}

function isMercedesSuvWmi(wmi: string): boolean {
  return wmi.startsWith("WDC") || wmi === "W1N" || wmi.startsWith("4JG");
}

function mercedesHasChassisDigits(vin: string): boolean {
  return /^\d{3}$/.test(mercedesRuleVin(vin).slice(3, 6));
}

/** W166 mid-cycle rename: sold as ML through MY2015, GLE from MY2016. */
function finalizeW166(year: number | null): PremiumEuropeanDecode {
  if (year != null && year < 2016) return finalizePremium("ML-Class", "W166", year);
  if (year != null && year >= 2016) return finalizePremium("GLE", "W166", year);
  return finalizePremium("ML / GLE", "W166", year);
}

function isMercedes166Hit(hit: PremiumEuropeanDecode, ruleVin: string): boolean {
  return hit.chassis === "W166" || ruleVin.slice(3, 6) === "166";
}

function decodeMercedesPremium(upper: string): PremiumEuropeanDecode | null {
  const wmi = upper.slice(0, 3);
  const ruleVin = mercedesRuleVin(upper);

  if (mercedesHasChassisDigits(upper)) {
    const chassisHit = decodeFromRules(ruleVin, MERCEDES_RULES);
    if (chassisHit) {
      if (isMercedes166Hit(chassisHit, ruleVin)) {
        return finalizeW166(premiumVinModelYear(upper, chassisProductionWindow("W166")));
      }
      return chassisHit;
    }
  }

  const longHit = decodeFromRules(ruleVin, MERCEDES_RULES);
  if (longHit) {
    if (isMercedes166Hit(longHit, ruleVin)) {
      return finalizeW166(premiumVinModelYear(upper, chassisProductionWindow("W166")));
    }
    return longHit;
  }

  // Letter VDS without chassis digits — year only when ISO cycle is unique (no prefer-recent).
  const year = premiumVinModelYear(upper);

  if (isMercedesSuvWmi(wmi)) {
    const suv = mercedesSuvFromLetterVds(upper[3]!, upper[4]!, year, upper);
    if (suv) {
      if (suv.chassis === "W166" || (suv.model === "GLE" && suv.chassis === "W166")) {
        return finalizeW166(premiumVinModelYear(upper, chassisProductionWindow("W166")));
      }
      if (suv.model === "ML-Class" && suv.chassis === "W166") {
        return finalizeW166(premiumVinModelYear(upper, chassisProductionWindow("W166")));
      }
      return finalizePremium(
        suv.model,
        suv.chassis ?? null,
        premiumVinModelYear(upper, chassisProductionWindow(suv.chassis ?? null)),
      );
    }
  }

  if (isMercedesPassengerWmi(wmi)) {
    const series = mercedesPassengerSeriesAt4(ruleVin[3]!, year, upper);
    if (series) {
      return finalizePremium(
        series.model,
        series.chassis ?? null,
        premiumVinModelYear(upper, chassisProductionWindow(series.chassis ?? null)),
      );
    }
  }

  return null;
}

function decodeFromRules(vin: string, rules: readonly PremiumPrefixRule[]): PremiumEuropeanDecode | null {
  const hit = matchLongestPrefix(vin, rules) as PremiumPrefixRule | null;
  if (!hit) return null;
  const year = premiumVinModelYear(vin, chassisProductionWindow(hit.chassis ?? null));
  return finalizePremium(hit.model, hit.chassis ?? null, year);
}

function fromHomologation(
  hit: ReturnType<typeof decodeAudiEuHomologation>,
  vin: string,
): PremiumEuropeanDecode | null {
  if (!hit) return null;
  const year = premiumVinModelYear(vin, chassisProductionWindow(hit.chassis));
  return finalizePremium(hit.model, hit.chassis, year);
}

export function decodePremiumEuropean(vin: string): PremiumEuropeanDecode | null {
  const raw = vin.trim().toUpperCase();
  if (raw.length !== 17) return null;

  // Bratislava (WVG): Touareg/Up! share the plant with Audi SUVs.
  // Prefer known VW platform codes before Audi homologation.
  if (raw.startsWith("WVG") && raw.slice(3, 6) === "ZZZ") {
    const modernVw = decodeVolkswagenModern(raw);
    if (modernVw) {
      return finalizePremium(
        modernVw.model,
        modernVw.chassis,
        premiumVinModelYear(raw, chassisProductionWindow(modernVw.chassis)),
      );
    }
    const platform78 = raw.slice(6, 8);
    const isVwPlatform =
      VW_PLATFORM_CODES_ON_WVG.has(platform78) ||
      raw.slice(6, 9).startsWith("CR") ||
      platform78 === "7P" ||
      platform78 === "7L";
    if (isVwPlatform) {
      const vwHit = decodeFromRules(normalizeVagVinForPremium(raw), VW_RULES)
        ?? decodeFromRules(raw, VW_RULES);
      if (vwHit) return vwHit;
    }
    const audiHit = fromHomologation(decodeAudiEuHomologation(raw), raw);
    if (audiHit) return audiHit;
  }

  const upper = normalizeVagVinForPremium(raw);
  const wmi = upper.slice(0, 3);

  if (
    wmi.startsWith("WBA") || wmi.startsWith("WBS") || wmi.startsWith("WBY") || wmi.startsWith("WBX")
    || wmi.startsWith("WB5") || wmi.startsWith("WAP")
    || wmi.startsWith("5UX") || wmi.startsWith("5UM") || wmi.startsWith("5YM") || wmi.startsWith("4US")
    || wmi.startsWith("3MW") || wmi.startsWith("3MF")
  ) {
    if (raw.slice(3, 6) === "ZZZ") {
      const euHit = fromHomologation(decodeBmwEuHomologation(raw), raw);
      if (euHit) return euHit;
    }
    const f4Body = resolveBmwFourSeriesBody(upper);
    if (f4Body) return f4Body;
    // Modern digit/letter series prefixes first (WBA3V1, WBAXA71, …).
    const modern = decodeFromRules(upper, BMW_RULES);
    if (modern) return modern;
    // Classic European ETK type codes (NC71 → E60, …).
    const etk = decodeBmwEtk(raw);
    if (etk) {
      return finalizePremium(
        etk.model,
        etk.chassis,
        premiumVinModelYear(raw, chassisProductionWindow(etk.chassis)),
      );
    }
    return null;
  }
  if (isMercedesPassengerWmi(wmi) || isMercedesSuvWmi(wmi)) {
    if (raw.slice(3, 6) === "ZZZ") {
      const euHit = fromHomologation(decodeMercedesEuHomologation(raw), raw);
      if (euHit) {
        // Homologation embeds chassis digits at pos. 7–9 (e.g. WDDZZZ166…).
        if (euHit.chassis === "W166" || raw.slice(6, 9) === "166") {
          return finalizeW166(premiumVinModelYear(raw, chassisProductionWindow("W166")));
        }
        return euHit;
      }
    }
    return decodeMercedesPremium(upper);
  }
  if (isAudiVin(raw)) {
    if (raw.slice(3, 6) === "ZZZ") {
      const euHit = fromHomologation(decodeAudiEuHomologation(raw), raw);
      if (euHit) return euHit;
    }
    const modernAudi = decodeAudiModern(raw);
    if (modernAudi) {
      return finalizePremium(
        modernAudi.model,
        modernAudi.chassis,
        premiumVinModelYear(raw, chassisProductionWindow(modernAudi.chassis)),
      );
    }
    if (wmi.startsWith("WA1")) return decodeFromRules(upper, AUDI_US_RULES);
    return decodeFromRules(upper, AUDI_RULES);
  }
  if (isPorscheVin(raw)) {
    const modernPorsche = decodePorscheModern(raw);
    if (modernPorsche) {
      return finalizePremium(
        modernPorsche.model,
        modernPorsche.chassis,
        premiumVinModelYear(raw, chassisProductionWindow(modernPorsche.chassis)),
      );
    }
    return decodeFromRules(upper, PORSCHE_RULES);
  }
  if (isVolkswagenVin(raw)) {
    const modernVw = decodeVolkswagenModern(raw);
    if (modernVw) {
      return finalizePremium(
        modernVw.model,
        modernVw.chassis,
        premiumVinModelYear(raw, chassisProductionWindow(modernVw.chassis)),
      );
    }
  }
  if (isVagWmi(wmi) || upper.startsWith("3VW")) {
    return decodeFromRules(upper, VW_RULES);
  }
  if (wmi.startsWith("WMW")) {
    return decodeFromRules(upper, MINI_RULES);
  }
  if (wmi.startsWith("SCA")) {
    return decodeFromRules(upper, ROLLS_RULES);
  }
  if (wmi.startsWith("SAL") || wmi.startsWith("SAJ") || wmi.startsWith("SAD")) {
    const jlr = decodeJlrEu(raw);
    if (jlr) {
      return {
        model: jlr.model,
        chassis: jlr.chassis,
        displayModel: jlr.displayModel,
      };
    }
  }
  return null;
}

export function decodePremiumEuropeanModel(vin: string): string | null {
  return decodePremiumEuropean(vin)?.displayModel ?? null;
}

/** Platform / chassis / generation (Series field). */
export function decodePremiumEuropeanSeries(vin: string): string | null {
  return decodePremiumEuropean(vin)?.chassis ?? null;
}

/**
 * @deprecated Equipment trim is rarely in the VIN — use decodeLocalTrim / NHTSA.
 * Kept as alias of chassis for older call sites; prefer decodePremiumEuropeanSeries.
 */
export function decodePremiumEuropeanTrim(vin: string): string | null {
  return decodePremiumEuropeanSeries(vin);
}

export function isPremiumEuropeanVin(vin: string): boolean {
  return decodePremiumEuropean(vin) != null;
}
