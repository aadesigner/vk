/**
 * QA: local keyword quality for every language except English & Albanian.
 *
 * Scores home + country + free-decoder titles/descriptions against common
 * market search intents (what buyers typically type). Not search-volume API data —
 * based on typical SERP intent for VIN / car-history products.
 *
 * Usage:
 *   node artifacts/verifykm/scripts/qa-seo-keywords.mjs
 *   pnpm --filter @workspace/verifykm run qa:seo-keywords
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const seoData = JSON.parse(readFileSync(join(root, "src/lib/seo-data.json"), "utf8"));

const PAGES = [
  "home",
  "pricing",
  "free_decoder",
  "how_it_works",
  "faq",
  "country_usa",
  "country_korea",
  "country_canada",
];

/**
 * @typedef {{ term: string, weight: number, aliases?: string[] }} Keyword
 * @typedef {{
 *   market: string,
 *   peopleSearch: string[],
 *   keywords: Keyword[],
 *   avoidLoanwords?: string[],
 * }} LangProfile
 */

/** Core intents buyers search in each market (weight 3 = head term, 2 = strong, 1 = supporting). */
const LANG_PROFILES = /** @type {Record<string, LangProfile>} */ ({
  de: {
    market: "Germany / Austria / Switzerland",
    peopleSearch: [
      "Kilometerstand prüfen",
      "Fahrzeughistorie / Fahrzeugcheck",
      "Unfallwagen prüfen",
      "VIN prüfen / Fahrgestellnummer",
      "Totalschaden / Unfallauto",
      "USA Import Auto prüfen",
    ],
    keywords: [
      { term: "kilometerstand", weight: 3, aliases: ["kilometerstände"] },
      { term: "unfall", weight: 3, aliases: ["unfälle", "unfallhistorie", "unfallwagen"] },
      { term: "vin", weight: 2 },
      { term: "fahrzeughistorie", weight: 2, aliases: ["historienbericht", "fahrzeug"] },
      { term: "totalschaden", weight: 2 },
      { term: "diebstahl", weight: 1 },
      { term: "import", weight: 1, aliases: ["importe", "usa"] },
    ],
    avoidLoanwords: ["salvage"],
  },
  es: {
    market: "Spain / LatAm",
    peopleSearch: [
      "verificar kilometraje",
      "historial del coche / historial vehicular",
      "siniestro total",
      "consultar VIN",
      "coche americano / coches de USA",
      "decodificador VIN gratis",
    ],
    keywords: [
      { term: "kilometraje", weight: 3 },
      { term: "accidente", weight: 3, aliases: ["accidentes"] },
      { term: "siniestro", weight: 2, aliases: ["siniestro total"] },
      { term: "vin", weight: 2 },
      { term: "historial", weight: 2 },
      { term: "robo", weight: 1, aliases: ["robos"] },
      { term: "usa", weight: 1, aliases: ["americanos", "americanas", "corea", "canadá", "canada"] },
    ],
  },
  fr: {
    market: "France / Belgium / Luxembourg",
    peopleSearch: [
      "historique véhicule / historique auto",
      "vérifier kilométrage",
      "contrôle VIN / numéro VIN",
      "véhicule accidenté / épave",
      "voiture USA / import USA",
      "décodeur VIN gratuit",
    ],
    keywords: [
      { term: "kilométrage", weight: 3, aliases: ["kilometrage"] },
      { term: "accident", weight: 3, aliases: ["accidents"] },
      { term: "historique", weight: 2 },
      { term: "vin", weight: 2 },
      { term: "épave", weight: 2, aliases: ["epave"] },
      { term: "vol", weight: 1 },
      { term: "usa", weight: 1, aliases: ["corée", "coree", "canada"] },
    ],
    avoidLoanwords: ["salvage"],
  },
  pl: {
    market: "Poland",
    peopleSearch: [
      "sprawdzenie VIN / sprawdź VIN",
      "przebieg auta",
      "historia pojazdu",
      "auta z USA / auto z USA",
      "wypadki / bezwypadkowe",
      "darmowy dekoder VIN",
    ],
    keywords: [
      { term: "przebieg", weight: 3 },
      { term: "wypadk", weight: 3, aliases: ["wypadek", "wypadki", "wypadków"] },
      { term: "vin", weight: 2 },
      { term: "historia", weight: 2, aliases: ["historii"] },
      { term: "sprawdzen", weight: 2, aliases: ["sprawdzenie", "sprawdź", "sprawdz"] },
      { term: "kradzież", weight: 1, aliases: ["kradziez"] },
      { term: "usa", weight: 1, aliases: ["korei", "kanady"] },
    ],
    avoidLoanwords: ["salvage"],
  },
  ro: {
    market: "Romania / Moldova",
    peopleSearch: [
      "verificare VIN",
      "verificare kilometraj",
      "istoric auto / raport auto",
      "mașini din SUA / import USA",
      "accidente auto",
      "decodor VIN gratuit",
    ],
    keywords: [
      { term: "kilometraj", weight: 3, aliases: ["kilometrajul"] },
      { term: "accident", weight: 3, aliases: ["accidente", "accidentele"] },
      { term: "vin", weight: 2 },
      { term: "verificare", weight: 2 },
      { term: "istoric", weight: 2 },
      { term: "furt", weight: 1 },
      { term: "sua", weight: 1, aliases: ["coreea", "canada"] },
    ],
    avoidLoanwords: ["salvage"],
  },
  bg: {
    market: "Bulgaria",
    peopleSearch: [
      "проверка VIN / проверка на VIN",
      "проверка на пробег",
      "история на автомобил",
      "авто от САЩ / внос САЩ",
      "катастрофи / ПТП",
      "безплатен VIN декодер",
    ],
    keywords: [
      { term: "пробег", weight: 3 },
      { term: "катастроф", weight: 3, aliases: ["катастрофа", "катастрофи"] },
      { term: "vin", weight: 2 },
      { term: "проверка", weight: 2 },
      { term: "история", weight: 2 },
      { term: "кражба", weight: 1 },
      { term: "сащ", weight: 1, aliases: ["корея", "канада"] },
    ],
    avoidLoanwords: ["salvage"],
  },
  ar: {
    market: "Arabic (MENA / GCC)",
    peopleSearch: [
      "فحص VIN",
      "فحص السيارة / تقرير السيارة",
      "كيلومترات السيارة",
      "حوادث السيارة",
      "سيارات أمريكية",
      "فك تشفير VIN مجاناً",
    ],
    keywords: [
      { term: "كيلومتر", weight: 3, aliases: ["الكيلومترات", "كيلومترات"] },
      { term: "حوادث", weight: 3, aliases: ["الحوادث"] },
      { term: "vin", weight: 2 },
      { term: "فحص", weight: 2 },
      { term: "إتلاف", weight: 2, aliases: ["الإتلاف"] },
      { term: "سرقة", weight: 1 },
      { term: "أمريك", weight: 1, aliases: ["كوري", "كند"] },
    ],
  },
  uk: {
    market: "Ukraine",
    peopleSearch: [
      "перевірка VIN",
      "перевірка пробігу",
      "історія авто / звіт VIN",
      "авто з США / авто з Кореї",
      "ДТП",
      "безкоштовний декодер VIN",
    ],
    keywords: [
      { term: "пробіг", weight: 3 },
      { term: "дтп", weight: 3 },
      { term: "vin", weight: 2 },
      { term: "перевірк", weight: 2, aliases: ["перевірка", "перевір"] },
      { term: "історі", weight: 2, aliases: ["історія", "історію"] },
      { term: "угон", weight: 1, aliases: ["угони", "крадіж", "крадіжок"] },
      { term: "сша", weight: 1, aliases: ["коре", "канад"] },
    ],
  },
  ru: {
    market: "Russia / CIS (RU locale)",
    peopleSearch: [
      "проверка VIN",
      "проверка пробега",
      "история автомобиля / отчёт VIN",
      "авто из США / авто из Кореи",
      "ДТП",
      "бесплатный декодер VIN",
    ],
    keywords: [
      { term: "пробег", weight: 3 },
      { term: "дтп", weight: 3 },
      { term: "vin", weight: 2 },
      { term: "проверк", weight: 2, aliases: ["проверка", "проверь"] },
      { term: "истори", weight: 2, aliases: ["история", "историю"] },
      { term: "угон", weight: 1, aliases: ["угоны"] },
      { term: "сша", weight: 1, aliases: ["коре", "канад"] },
    ],
  },
});

function normalize(text) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFKC");
}

function blobFor(lang, pageKey) {
  const entry = seoData[pageKey]?.[lang];
  if (!entry) return "";
  return normalize(`${entry.title ?? ""} ${entry.description ?? ""}`);
}

function matchTerm(blob, keyword) {
  const needles = [keyword.term, ...(keyword.aliases ?? [])].map((n) => normalize(n));
  return needles.some((n) => n && blob.includes(n));
}

function grade(scorePct) {
  if (scorePct >= 85) return "A";
  if (scorePct >= 70) return "B";
  if (scorePct >= 55) return "C";
  if (scorePct >= 40) return "D";
  return "F";
}

function scoreLang(lang, profile) {
  /** Count each keyword once across all indexable pages (presence, not per-page). */
  let earned = 0;
  let possible = 0;
  const hits = [];
  const misses = [];
  const loanwordHits = [];

  const corpus = PAGES.map((p) => blobFor(lang, p)).join(" \n ");

  for (const kw of profile.keywords) {
    possible += kw.weight;
    if (matchTerm(corpus, kw)) {
      earned += kw.weight;
      hits.push(kw.term);
    } else {
      misses.push(kw.term);
    }
  }

  for (const loan of profile.avoidLoanwords ?? []) {
    if (corpus.includes(normalize(loan))) {
      loanwordHits.push(loan);
    }
  }

  /** Soft penalty when English loanwords dominate where locals don't search that way. */
  const penalty = Math.min(15, loanwordHits.length * 8);
  const rawPct = possible > 0 ? Math.round((earned / possible) * 100) : 0;
  const pct = Math.max(0, rawPct - penalty);

  /** Page-level: home & USA are most important for head traffic. */
  const homeBlob = blobFor(lang, "home");
  const headHits = profile.keywords
    .filter((k) => k.weight >= 3)
    .filter((k) => matchTerm(homeBlob, k))
    .map((k) => k.term);
  const headMiss = profile.keywords
    .filter((k) => k.weight >= 3)
    .filter((k) => !matchTerm(homeBlob, k))
    .map((k) => k.term);

  return {
    lang,
    market: profile.market,
    peopleSearch: profile.peopleSearch,
    pct,
    grade: grade(pct),
    hits,
    misses,
    loanwordHits,
    headHits,
    headMiss,
    homeTitle: seoData.home?.[lang]?.title ?? "(missing)",
  };
}

const results = Object.entries(LANG_PROFILES).map(([lang, profile]) => scoreLang(lang, profile));
results.sort((a, b) => b.pct - a.pct);

console.log("\n══════════════════════════════════════════════════════════");
console.log("  LOCAL KEYWORD QA  (excludes en + sq)");
console.log("  What buyers typically search vs what our meta uses");
console.log("══════════════════════════════════════════════════════════\n");

for (const r of results) {
  console.log(`── ${r.lang.toUpperCase()} · ${r.market} · ${r.grade} (${r.pct}%)`);
  console.log(`   Home title: ${r.homeTitle}`);
  console.log(`   People usually search:`);
  for (const q of r.peopleSearch) console.log(`     • ${q}`);
  console.log(`   ✓ Present in meta corpus: ${r.hits.join(", ") || "(none)"}`);
  if (r.misses.length) console.log(`   ✗ Missing intents:       ${r.misses.join(", ")}`);
  if (r.headMiss.length) {
    console.log(`   ! Home title missing head terms: ${r.headMiss.join(", ")}`);
  }
  if (r.loanwordHits.length) {
    console.log(`   ⚠ English loanword still used: ${r.loanwordHits.join(", ")} (locals rarely search this)`);
  }
  console.log("");
}

const avg = Math.round(results.reduce((s, r) => s + r.pct, 0) / results.length);
const weak = results.filter((r) => r.pct < 70);
const strong = results.filter((r) => r.pct >= 70);

console.log("──────────────────────────────────────────────────────────");
console.log(`Average keyword fit: ${avg}%`);
console.log(`Strong (B+): ${strong.map((r) => `${r.lang}=${r.grade}`).join(", ") || "none"}`);
console.log(`Needs work:  ${weak.map((r) => `${r.lang}=${r.grade}(${r.pct}%)`).join(", ") || "none"}`);
console.log("──────────────────────────────────────────────────────────\n");

console.log("Summary judgment:");
console.log("  Structure is ready. Keyword fit varies by market.");
console.log("  Best local language: prefer langs with A/B above.");
console.log("  Fix loanwords (salvage→local) and home head terms before calling SEO 'killer'.\n");

/** Soft exit: report only unless --strict */
if (process.argv.includes("--strict") && weak.length) {
  console.error(`STRICT FAIL — ${weak.length} language(s) below 70% keyword fit`);
  process.exit(1);
}

process.exit(0);
