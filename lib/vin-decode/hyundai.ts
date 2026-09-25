/**
 * Hyundai VIN model decode — WMI + platform prefixes + year-gated line codes.
 * Prefer omit over inventing a model when position 4 is shared across eras
 * (e.g. J = early Elantra vs Tucson 2005+).
 *
 * Model line (pos. 4) reference: Wikibooks Hyundai VIN codes.
 */

import { compilePrefixRules, matchLongestPrefix, type PrefixRule } from "./prefix-match";
import { isoModelYearCandidates } from "./iso-year";

/** Try each ISO year candidate; return a line hit only when the model is unique. */
function decodeHyundaiLineUnique(vin: string): PrefixRule | null {
  const maxY = new Date().getFullYear() + 2;
  const years = isoModelYearCandidates(vin[9] ?? "").filter((y) => y >= 1980 && y <= maxY);
  const hits: PrefixRule[] = [];
  for (const year of years) {
    const hit = decodeHyundaiLineYear(vin, year);
    if (hit) hits.push(hit);
  }
  if (hits.length === 0) return null;
  const models = new Set(hits.map((h) => h.model));
  if (models.size !== 1) return null;
  return hits[0]!;
}

/** Documented / high-confidence platform prefixes (longest match wins). */
const HYUNDAI_PLATFORM_RULES: PrefixRule[] = compilePrefixRules([
  // Tucson — Korea / EU / US
  { prefix: "KMHK381", model: "Tucson", chassis: "NX4" },
  { prefix: "KMHK481", model: "Tucson", chassis: "TL" },
  { prefix: "KMHNU81", model: "Tucson", chassis: "NX4" },
  { prefix: "KMHNU8", model: "Tucson", chassis: "NX4" },
  { prefix: "KMHN381", model: "Tucson", chassis: "NX4" },
  // Do not map bare KMHS381 → Tucson (that prefix is Santa Fe Sport in our fixtures).
  { prefix: "KMHS281A", model: "Tucson", chassis: "NX4" },
  { prefix: "KMHS481", model: "Tucson", chassis: "TL" },
  { prefix: "KM8J3", model: "Tucson", chassis: "NX4 US" },
  { prefix: "KM8J2", model: "Tucson", chassis: "NX4 US" },
  { prefix: "KM8JC", model: "Tucson", chassis: "NX4 US" },
  { prefix: "KM8JD", model: "Tucson", chassis: "NX4 US" },
  { prefix: "KM8JE", model: "Tucson", chassis: "NX4 US" },
  { prefix: "KM8JF", model: "Tucson", chassis: "NX4 US" },
  { prefix: "KM8JH", model: "Tucson" },
  { prefix: "KM8JN", model: "Tucson" },
  { prefix: "KM8JT", model: "Tucson" },
  { prefix: "KM8JU", model: "Tucson" },
  { prefix: "5NMJB", model: "Tucson", chassis: "NX4 US" },
  { prefix: "5NMJC", model: "Tucson", chassis: "NX4 US" },
  { prefix: "5NMJE", model: "Tucson", chassis: "NX4 US" },
  { prefix: "5NMJF", model: "Tucson", chassis: "NX4 US" },
  { prefix: "5NMJH", model: "Tucson", chassis: "NX4 US" },
  // Genesis US (HMMA Alabama) — NHTSA ErrorCode 0: 5NMMCET… = Genesis GV70
  // Do NOT remap bare 5NM (shared with Hyundai Tucson/Santa Fe).
  { prefix: "5NMM", model: "GV70", chassis: "JK1 US" },
  { prefix: "TMAH381", model: "Tucson", chassis: "NX4 EU" },
  { prefix: "TMAJB81", model: "Tucson", chassis: "NX4 EU" },
  { prefix: "TMAJC81", model: "Tucson", chassis: "NX4 EU" },
  { prefix: "TMAJD81", model: "Tucson", chassis: "NX4 EU" },
  { prefix: "TMAJE81", model: "Tucson", chassis: "NX4 EU" },
  { prefix: "TMAB381", model: "Tucson" },
  { prefix: "TMAD381", model: "Tucson" },
  // Santa Fe
  { prefix: "KMHK251", model: "Santa Fe", chassis: "TM" },
  { prefix: "KMHS381", model: "Santa Fe Sport" },
  { prefix: "KMHSW", model: "Santa Fe Sport" },
  { prefix: "KMHS", model: "Santa Fe Sport" },
  // Do not map bare KMHR → Santa Fe (pos.4 R is Venue / Palisade / Kona era).
  { prefix: "KM8S3", model: "Santa Fe", chassis: "TM US" },
  { prefix: "KM8S2", model: "Santa Fe" },
  { prefix: "5NMS2", model: "Santa Fe", chassis: "TM US" },
  { prefix: "5NMS3", model: "Santa Fe", chassis: "MX5 US" },
  { prefix: "5NMSA", model: "Santa Fe" },
  { prefix: "5NMSB", model: "Santa Fe" },
  // Santa Cruz
  { prefix: "KM8R3", model: "Santa Cruz" },
  { prefix: "KM8RC", model: "Santa Cruz" },
  { prefix: "5NTJC", model: "Santa Cruz" },
  // Kona
  { prefix: "KMHR581", model: "Kona", chassis: "OS" },
  { prefix: "KMHR681", model: "Kona", chassis: "SX2" },
  { prefix: "KMHK581", model: "Kona", chassis: "OS" },
  { prefix: "TMAH581", model: "Kona", chassis: "OS EU" },
  { prefix: "TMAJ681", model: "Kona", chassis: "SX2 EU" },
  { prefix: "KMHH281", model: "Kona", chassis: "SX2" },
  // i30 / i20 / i10 / Bayon
  { prefix: "KMHC751", model: "i30", chassis: "PD" },
  { prefix: "KMHC851", model: "i30", chassis: "GD" },
  { prefix: "TMAJ381", model: "i30", chassis: "PD EU" },
  // Bayon / i20 / i10 use pos.4 B (or plant-specific NLH/TMA), not J — J is Tucson/Nexo era.
  { prefix: "TMAJ281", model: "i20", chassis: "BC3 EU" },
  { prefix: "TMAJ481", model: "i10", chassis: "AC3" },
  { prefix: "NLHBR51", model: "i20", chassis: "TR plant" },
  { prefix: "NLHBW51", model: "Bayon" },
  { prefix: "NLHBV51", model: "i20 N" },
  { prefix: "NLHBB51", model: "Bayon" },
  { prefix: "KMHBB51", model: "Bayon" },
  { prefix: "KMHB381", model: "i20", chassis: "BC3" },
  { prefix: "KMHB281", model: "i20", chassis: "GB" },
  { prefix: "KMHA381", model: "i10", chassis: "AC3" },
  // IONIQ 5 / 6 — specific NE platforms only (do NOT map bare KMHL*; that is also Sonata DN8 KR)
  { prefix: "KMHL341", model: "IONIQ 5", yearFrom: 2021, yearTo: 2099 },
  { prefix: "KMHLW4", model: "IONIQ 5", yearFrom: 2021, yearTo: 2099 },
  { prefix: "KMHM341", model: "IONIQ 6", yearFrom: 2022, yearTo: 2099 },
  { prefix: "KMHN341", model: "IONIQ 5 N", yearFrom: 2023, yearTo: 2099 },
  { prefix: "KMHC281", model: "IONIQ", yearFrom: 2016, yearTo: 2022 },
  { prefix: "KMHC381", model: "IONIQ", yearFrom: 2016, yearTo: 2022 },
  // i40 VF (EU D-segment, 2011–2019) — L-line before Sonata DN8 reused it from MY2020.
  // Body digit: 4 = saloon, 8 = Tourer/wagon. C/B series prefixes are well-attested.
  { prefix: "KMHLC81", model: "i40", chassis: "VF" },
  { prefix: "KMHLC41", model: "i40", chassis: "VF" },
  { prefix: "KMHLB81", model: "i40", chassis: "VF" },
  { prefix: "KMHLB41", model: "i40", chassis: "VF" },
  // Elantra CN7 — longer than KMHL24 Sonata rule below
  { prefix: "KMHL241", model: "Elantra", chassis: "CN7" },
  { prefix: "KMHD281", model: "Elantra", chassis: "CN7" },
  { prefix: "KMHD641", model: "Elantra", chassis: "AD" },
  { prefix: "5NPD8", model: "Elantra", chassis: "CN7 US" },
  { prefix: "5NPDH", model: "Elantra", chassis: "CN7 US" },
  { prefix: "5NPET", model: "Elantra" },
  // Sonata — US Alabama + Korea (E through MY2019 KR; L = DN8 KR from MY2020 per Wikibooks)
  { prefix: "5NPE2", model: "Sonata", chassis: "DN8" },
  { prefix: "5NPE3", model: "Sonata", chassis: "DN8" },
  { prefix: "KMHE3", model: "Sonata" },
  { prefix: "KMHE2", model: "Sonata" },
  { prefix: "KMHE1", model: "Sonata" },
  { prefix: "KMHL14", model: "Sonata", chassis: "DN8" },
  { prefix: "KMHL24", model: "Sonata", chassis: "DN8" },

  // Palisade / Venue / Nexo
  { prefix: "KM8Y3", model: "Palisade" },
  { prefix: "5NMYA", model: "Palisade" },
  { prefix: "KMHR281", model: "Venue" },
  { prefix: "KMHJ551", model: "Nexo" },
  { prefix: "KMHN551", model: "Nexo" },
  // Staria / commercial light
  { prefix: "KMFWB", model: "Staria", yearFrom: 2021, yearTo: 2099 },
  { prefix: "KMFWA", model: "Staria", yearFrom: 2021, yearTo: 2099 },
  { prefix: "KMFWC", model: "Staria", yearFrom: 2021, yearTo: 2099 },
  // Creta / Casper / Inster (regional)
  { prefix: "MALA51", model: "Creta", chassis: "SU2 IN" },
  { prefix: "MALB51", model: "Creta", chassis: "SU2 IN" },
  { prefix: "MALAN51", model: "i20" },
  { prefix: "MALBB51", model: "i20" },
  { prefix: "MALA851", model: "Grand i10" },
  // Beijing Hyundai — line letters are shared with the global Hyundai grammar.
  { prefix: "LBEJ", model: "Tucson" },
  { prefix: "LBED", model: "Elantra" },
  { prefix: "LBEE", model: "Sonata" },
  { prefix: "KMHK381A", model: "Tucson", chassis: "NX4" },
  { prefix: "KMHH381", model: "Kona", chassis: "OS" },
  { prefix: "TMAJ581", model: "Kona", chassis: "SX2 EU" },
  { prefix: "KMHC551", model: "i30 N", chassis: "PD" },
  { prefix: "5NMS4", model: "Santa Fe", chassis: "MX5 US" },
  { prefix: "KMHS4", model: "Santa Fe", chassis: "MX5" },
]);

const EV_ENGINE_CHARS = new Set(["L", "N", "S", "T", "W", "Z"]);

const HYUNDAI_REGIONAL_FAMILY: Record<string, string> = {
  MAL: "i10 / i20 / Verna / Venue / Creta / Alcazar",
  LBE: "Elantra / Sonata / Tucson",
  TMA: "i30 / Tucson / Kona",
  TMC: "i30 / Tucson / Kona",
  "2HM": "Sonata",
  "9BH": "HB20 / Creta",
  "95P": "Tucson / ix35 / HR",
  MF3: "IONIQ 5 / Creta / Stargazer",
  Z94: "Solaris / Creta",
  PFD: "IONIQ 5 / IONIQ 6",
  "7YA": "IONIQ 5 / IONIQ 9",
  AC5: "Hyundai South Africa",
  MB2: "Hyundai India MPV",
  NLJ: "Hyundai commercial van",
  "8LG": "Hyundai Ecuador model",
};

export function isHyundaiVin(vin: string): boolean {
  const wmi = vin.slice(0, 3).toUpperCase();
  return (
    wmi.startsWith("KMH")
    || wmi.startsWith("KMF")
    || wmi === "KM8"
    || wmi.startsWith("TMA")
    || wmi.startsWith("TMC")
    || wmi.startsWith("NLH")
    || wmi.startsWith("NLJ")
    || wmi.startsWith("5NM")
    || wmi.startsWith("5NP")
    || wmi.startsWith("5NT")
    || wmi === "7YA"
    || wmi.startsWith("2HM")
    || wmi.startsWith("9BH")
    || wmi === "95P"
    || wmi.startsWith("MAL")
    || wmi === "MB2"
    || wmi.startsWith("MF3")
    || wmi.startsWith("LBE")
    || wmi === "PFD"
    || wmi === "Z94"
    || wmi === "8LG"
    || wmi === "AC5"
  );
}

/**
 * Year-aware model-line fallback when platform prefix is unknown.
 * Only emit models when Wikibooks + WMI/year make the mapping reliable.
 */
function decodeHyundaiLineYear(vin: string, year: number | null): PrefixRule | null {
  if (year == null) return null;
  const wmi = vin.slice(0, 3);
  const line = vin[3];
  const engine = vin[7];
  const prefix = vin.slice(0, 4);

  // North-America MPV WMI — pos.4 J is Tucson (Santa Cruz is KM8R*).
  if (wmi === "KM8" || wmi.startsWith("5NM") || wmi.startsWith("5NT")) {
    if (prefix.startsWith("KM8R") && year >= 2022) {
      return { prefix, model: "Santa Cruz" };
    }
    if (line === "J" && year >= 2005) {
      return { prefix, model: "Tucson", chassis: year >= 2021 ? "NX4" : undefined };
    }
    if (line === "S" && year >= 2001) {
      return { prefix, model: "Santa Fe" };
    }
    if (line === "Y" && year >= 2019) {
      return { prefix, model: "Palisade" };
    }
  }

  // Czech plant — Tucson is the dominant J-line SUV export.
  if (wmi.startsWith("TMA") || wmi.startsWith("TMC")) {
    if (line === "J" && year >= 2015) {
      return { prefix, model: "Tucson", chassis: year >= 2021 ? "NX4 EU" : undefined };
    }
  }

  // Korea passenger WMI — Elantra used J only through ~2000; later J is Tucson/Nexo/Santa Cruz.
  if (wmi.startsWith("KMH")) {
    if (line === "J" && year >= 2005) {
      if (year >= 2019 && engine === "6") {
        return { prefix, model: "Nexo" };
      }
      if (year >= 2019 && year <= 2025 && engine && EV_ENGINE_CHARS.has(engine)) {
        // Hydrogen / EV line sharing J — omit unless platform rule hit.
        return null;
      }
      if (year >= 2022 && (vin[4] === "T" || vin.startsWith("KMHS"))) {
        // Prefer platform rules; don't guess Santa Cruz on KMH.
      }
      return { prefix, model: "Tucson", chassis: year >= 2021 ? "NX4" : year >= 2015 ? "TL" : undefined };
    }
    if (line === "S" && year >= 2001 && year <= 2023) {
      return { prefix, model: "Santa Fe" };
    }
    if (line === "K") {
      if (year >= 2021 && engine && EV_ENGINE_CHARS.has(engine)) {
        return { prefix, model: "IONIQ 5" };
      }
      if (year >= 2018 && year <= 2023) {
        return { prefix, model: "Kona", chassis: "OS" };
      }
    }
    if (line === "M" && year >= 2022 && engine && EV_ENGINE_CHARS.has(engine)) {
      return { prefix, model: "IONIQ 6" };
    }
    if (line === "D" && year >= 2001 && year <= 2020) {
      // D-line is shared: Elantra (sedan, body '4') vs i30 FD/GD (5-door hatch
      // body '5', wagon/tourer body '8'). Elantra GT is the i30 GD rebadge, so a
      // D-line hatch/wagon in the i30 production window is an i30, not an Elantra.
      const body = vin[5]; // position 6 — body type
      if ((body === "5" || body === "8") && year >= 2007 && year <= 2017) {
        return { prefix, model: "i30", chassis: year >= 2012 ? "GD" : "FD" };
      }
      return { prefix, model: "Elantra" };
    }
    // Wikibooks pos.4 L: i40 (2011–2019), Sonata 2020+ (Korean), Elantra 2021+, IONIQ 5 platforms.
    // IONIQ 5 uses dedicated platforms (KMHL341 / KMHLW4) matched above — not bare KMHL.
    if (line === "L" && year >= 2011 && year <= 2019) {
      // i40 VF occupied Korea L-line before Sonata DN8 reused it from MY2020.
      return { prefix, model: "i40", chassis: "VF" };
    }
    if (line === "L" && year >= 2020) {
      const series = vin.slice(4, 7); // positions 5–7
      if (year >= 2021 && series === "241") {
        return { prefix, model: "Elantra", chassis: "CN7" };
      }
      if (year >= 2021 && (series.startsWith("341") || vin.startsWith("KMHLW4"))) {
        return { prefix, model: "IONIQ 5" };
      }
      if (year >= 2022 && engine && EV_ENGINE_CHARS.has(engine) && (series.startsWith("34") || vin[4] === "W")) {
        return { prefix, model: "IONIQ 5" };
      }
      // Default L-line Korea from MY2020: Sonata DN8 (was incorrectly falling through to IONIQ 5)
      return { prefix, model: "Sonata", chassis: "DN8" };
    }
    if (line === "E" && year >= 2006 && year <= 2019) {
      return { prefix, model: "Sonata" };
    }
    if (line === "R" && year >= 2019) {
      // Venue vs Palisade — omit without platform hit.
      return null;
    }
  }

  // Alabama passenger — Elantra / Sonata.
  if (wmi.startsWith("5NP")) {
    if (line === "D" || line === "E" || line === "L") {
      if (line === "E") return { prefix, model: "Sonata" };
      return { prefix, model: "Elantra" };
    }
  }

  return null;
}

export function matchHyundaiRule(vin: string): PrefixRule | null {
  const u = vin.toUpperCase().trim();
  if (u.length < 10 || !isHyundaiVin(u)) return null;

  const platform = matchLongestPrefix(u, HYUNDAI_PLATFORM_RULES);
  if (platform) return platform;

  const line = decodeHyundaiLineUnique(u);
  if (line) return line;

  const family = HYUNDAI_REGIONAL_FAMILY[u.slice(0, 3)];
  return family ? { prefix: u.slice(0, 3), model: family } : null;
}

export function decodeHyundaiModel(vin: string): string | null {
  return matchHyundaiRule(vin)?.model ?? null;
}

/**
 * Pos.8 engine labels for Hyundai — letter reuse is extreme across eras.
 * Prefer model/year when available; omit when still ambiguous.
 */
export function decodeHyundaiEngine(
  vin: string,
  model: string | null,
  year: number | null,
): string | null {
  const eng = vin[7]?.toUpperCase();
  if (!eng) return null;
  const m = (model ?? "").toLowerCase();

  if (/ioniq|nexo/.test(m)) {
    const ev: Record<string, string> = {
      L: "Electric — 77.4 kWh (Long Range)",
      N: "Electric (EV)",
      S: "Electric — 58 kWh (Standard Range)",
      T: "Electric — 53 kWh (Standard)",
      W: "Electric — 72.6 kWh",
      Z: "Electric (EV)",
      "6": "Hydrogen fuel cell",
    };
    return ev[eng] ?? null;
  }

  // Shared ICE / HEV codes used on Tucson, Santa Fe, Kona, Santa Cruz, etc.
  if (!/tucson|santa fe|santa cruz|kona|palisade|venue/.test(m)) return null;

  if (eng === "L") return "2.4L Theta II GDI I4";

  const ice: Record<string, string> = {
    A: "2.0L I4 (G4NA)",
    B: "2.0L I4 (Beta II / Theta II)",
    C: "2.4L I4 (Theta II)",
    E: "2.5L Smartstream I4",
    F: "2.0L Nu GDI I4",
    G: "2.4L Theta II GDI I4",
    H: "1.6T Hybrid (T-GDi HEV)",
    K: "2.0L Turbo (G4KH)",
    P: "2.5L Turbo I4",
    R: "1.6T Hybrid (T-GDi HEV)",
    V: "2.0L Diesel TCI",
    "1": "1.6T Hybrid (Smartstream)",
    "4": "2.0L Nu GDI I4",
  };
  // Omit D — reused as 2.7 V6 and diesels across eras.
  if (eng === "D") return null;
  if (eng === "2") {
    if (year != null && year >= 2022) return "1.6T Plug-in Hybrid";
    return "1.6L Gamma turbo I4";
  }
  return ice[eng] ?? null;
}
