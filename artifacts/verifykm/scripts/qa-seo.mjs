/**
 * QA: verify every indexable page has title + description in all languages.
 * Usage: node artifacts/verifykm/scripts/qa-seo.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SEO_LANGS, vinSeoFromRest } from "./seo-inject.mjs";
import { SEO_OG_PAGES } from "./seo-og-config.mjs";
import { SUPPORTED_LANGS } from "./languages.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const seoData = JSON.parse(readFileSync(join(root, "src/lib/seo-data.json"), "utf8"));
const langs = SUPPORTED_LANGS;
const indexableKeys = [
  "home",
  "pricing",
  "free_decoder",
  "how_it_works",
  "faq",
  "terms",
  "privacy",
  "country_usa",
  "country_korea",
  "country_canada",
  "country_china",
  "country_uae",
];

let errors = 0;
for (const key of indexableKeys) {
  const page = seoData[key];
  if (!page) {
    console.error("MISSING PAGE KEY:", key);
    errors++;
    continue;
  }
  for (const lang of langs) {
    const entry = page[lang];
    if (!entry?.title?.trim() || !entry?.description?.trim()) {
      console.error(`MISSING ${key}.${lang}`);
      errors++;
    }
    if (entry?.title && !entry.title.includes("verifykm.com")) {
      console.warn(`WARN ${key}.${lang}: title missing brand`);
    }
    if (
      ["home", "country_usa", "country_korea", "country_canada", "country_china", "country_japan", "country_uae"].includes(key)
      && entry?.title
      && entry.title.length > 60
    ) {
      console.warn(`WARN ${key}.${lang}: title ${entry.title.length} chars (target ≤60)`);
    }
  }
}

/** VIN catalog page SEO (per-lang title/description templates) */
const SAMPLE_VIN = "1HGBH41JXMN109186";
for (const lang of SEO_LANGS) {
  const vinSeo = vinSeoFromRest(`/vin/${SAMPLE_VIN}`, lang);
  if (!vinSeo?.title?.includes(SAMPLE_VIN) || !vinSeo?.description?.includes(SAMPLE_VIN)) {
    console.error(`VIN SEO missing VIN for lang: ${lang}`);
    errors++;
  }
  if (!vinSeo?.title?.includes("verifykm") || !vinSeo?.description?.includes("verifykm.com")) {
    console.error(`VIN SEO missing brand for lang: ${lang}`);
    errors++;
  }
}

/** Static VIN-related page SEO entries (all langs) */
const vinPageKeys = [
  "vin_result",
  "free_decoder",
  "auth",
  "dashboard",
  "sign_up",
  "checkout",
  "purchases",
];
for (const key of vinPageKeys) {
  const page = seoData[key];
  if (!page) {
    console.error("MISSING VIN PAGE KEY:", key);
    errors++;
    continue;
  }
  for (const lang of langs) {
    const entry = page[lang];
    if (!entry?.title?.trim() || !entry?.description?.trim()) {
      console.error(`MISSING ${key}.${lang}`);
      errors++;
    }
    const blob = `${entry?.title ?? ""} ${entry?.description ?? ""}`.toLowerCase();
    if (!blob.includes("vin")) {
      console.error(`${key}.${lang}: title/description must mention VIN`);
      errors++;
    }
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

/** Romanian i18n: vin_* keys must match en key set */
const enI18n = readJson(join(root, "src/i18n/en.json"));
const roI18n = readJson(join(root, "src/i18n/ro.json"));
const enKeys = Object.keys(enI18n);
const roKeys = new Set(Object.keys(roI18n));
const missingRo = enKeys.filter((k) => !roKeys.has(k));
if (missingRo.length > 0) {
  console.error("ro.json missing keys:", missingRo.length);
  errors++;
}
const vinKeyAllowEnglish = new Set([
  "vin_label",
  "vin_segment_model",
  "free_decoder_field_model",
  "free_decoder_field_turbo",
  "free_decoder_field_abs",
  "free_decoder_diag_wmi",
  "free_decoder_diag_vds",
  "free_decoder_diag_vis",
  "free_decoder_diag_turbo",
  "free_decoder_diag_abs",
  "free_decoder_diag_gvwr",
  "vin_share_whatsapp",
  "vin_share_facebook",
  "vin_share_telegram",
  "vin_share_x",
]);
const untranslatedVin = enKeys
  .filter((k) => k.startsWith("vin_") || k.startsWith("free_decoder"))
  .filter((k) => roI18n[k] === enI18n[k] && !vinKeyAllowEnglish.has(k));
if (untranslatedVin.length > 0) {
  console.error("ro.json untranslated vin/free_decoder keys:", untranslatedVin.slice(0, 10).join(", "));
  errors += untranslatedVin.length;
}

/** Polish i18n: pl.json key parity and vin translations */
const plI18nPath = join(root, "src/i18n/pl.json");
if (existsSync(plI18nPath)) {
  const plI18n = readJson(plI18nPath);
  const plKeys = new Set(Object.keys(plI18n));
  const missingPl = enKeys.filter((k) => !plKeys.has(k));
  if (missingPl.length > 0) {
    console.error("pl.json missing keys:", missingPl.length);
    errors++;
  }
  const untranslatedPlVin = enKeys
    .filter((k) => k.startsWith("vin_") || k.startsWith("free_decoder"))
    .filter((k) => plI18n[k] === enI18n[k] && !vinKeyAllowEnglish.has(k));
  if (untranslatedPlVin.length > 0) {
    console.error("pl.json untranslated vin/free_decoder keys:", untranslatedPlVin.slice(0, 10).join(", "));
    errors += untranslatedPlVin.length;
  }
} else {
  console.error("MISSING pl.json");
  errors++;
}

/** de/fr/bg SEO must not be English placeholders */
const EN_HOME_TITLE = seoData.home?.en?.title ?? "";
for (const lang of ["de", "fr", "bg"]) {
  const homeTitle = seoData.home?.[lang]?.title ?? "";
  if (homeTitle === EN_HOME_TITLE) {
    console.error(`${lang} home SEO title is still English placeholder`);
    errors++;
  }
  const vinSeo = vinSeoFromRest(`/vin/${SAMPLE_VIN}`, lang);
  if (lang === "de" && !vinSeo?.title?.includes("Fahrzeug")) {
    console.error("de VIN SEO title not localized");
    errors++;
  }
  if (lang === "fr" && !vinSeo?.title?.includes("Rapport")) {
    console.error("fr VIN SEO title not localized");
    errors++;
  }
  if (lang === "bg" && !/отчет|история/i.test(vinSeo?.title ?? "")) {
    console.error("bg VIN SEO title not localized");
    errors++;
  }
}

function checkI18nParity(langCode, label) {
  const path = join(root, `src/i18n/${langCode}.json`);
  if (!existsSync(path)) {
    console.error(`MISSING ${langCode}.json`);
    errors++;
    return;
  }
  const dict = readJson(path);
  const dictKeys = new Set(Object.keys(dict));
  const missing = enKeys.filter((k) => !dictKeys.has(k));
  if (missing.length > 0) {
    console.error(`${label} missing keys:`, missing.length);
    errors += missing.length;
  }
  const untranslated = enKeys
    .filter((k) => dict[k] === enI18n[k] && !vinKeyAllowEnglish.has(k))
    .filter((k) => !/^(admin|vin_label|vin_segment_|free_decoder_field_|free_decoder_diag_)/i.test(k));
  if (untranslated.length > 80) {
    console.error(`${label} too many untranslated keys (${untranslated.length}):`, untranslated.slice(0, 8).join(", "));
    errors++;
  }
}

checkI18nParity("de", "de.json");
checkI18nParity("fr", "fr.json");
checkI18nParity("bg", "bg.json");

const bootstrap = readFileSync(join(root, "public/seo-bootstrap.js"), "utf8");
for (const lang of langs) {
  if (!bootstrap.includes(`"${lang}"`)) {
    console.error("BOOTSTRAP missing lang:", lang);
    errors++;
  }
}
if (!bootstrap.includes("Fahrzeughistorienbericht")) {
  console.error("BOOTSTRAP missing German VIN title template");
  errors++;
}

const ogDir = join(root, "public", "seo", "og");
const OG_MAX_BYTES = { home: 40_000, country: 52_000 };
for (const { pageKey } of SEO_OG_PAGES) {
  const max = pageKey === "home" ? OG_MAX_BYTES.home : OG_MAX_BYTES.country;
  for (const lang of langs) {
    const file = join(ogDir, `${pageKey}-${lang}.webp`);
    if (!existsSync(file)) {
      console.error(`MISSING OG image: seo/og/${pageKey}-${lang}.webp`);
      errors++;
      continue;
    }
    const size = statSync(file).size;
    if (size > max) {
      console.error(`OG image too heavy: seo/og/${pageKey}-${lang}.webp (${Math.round(size / 1024)}KB > ${Math.round(max / 1024)}KB)`);
      errors++;
    }
  }
}

if (errors === 0) {
  console.log(`OK — ${indexableKeys.length} pages × ${langs.length} languages verified`);
  console.log(`OK — VIN catalog SEO for ${SEO_LANGS.length} languages`);
  console.log(`OK — ${vinPageKeys.length} VIN-related static SEO pages × ${langs.length} languages`);
  console.log("OK — pl.json i18n key parity and vin translations");
  console.log("OK — ro.json i18n key parity and vin translations");
  console.log("OK — de/fr/bg i18n key parity");
} else {
  console.error(`FAILED — ${errors} issue(s)`);
  process.exit(1);
}

/** Albanian (sq) keyword alignment — natural search intents */
const SQ_KEYWORDS = {
  home: ["kontroll kilometrash", "shasi"],
  pricing: ["çmime", "shasi", "historiku"],
  free_decoder: ["shasi", "dekodues"],
  how_it_works: ["funksionon", "shasi"],
  faq: ["pyetje", "shasi"],
  country_usa: ["historia e makinës", "shba"],
  country_korea: ["kilometrat", "koreja"],
  country_canada: ["kanadaja"],
};

let sqWarn = 0;
for (const [key, needles] of Object.entries(SQ_KEYWORDS)) {
  const entry = seoData[key]?.sq;
  if (!entry) continue;
  const blob = `${entry.title} ${entry.description}`.toLowerCase();
  for (const needle of needles) {
    if (!blob.includes(needle)) {
      console.warn(`WARN sq.${key}: missing keyword "${needle}" in title/description`);
      sqWarn++;
    }
  }
}
if (sqWarn === 0) {
  console.log("OK — Albanian SEO keywords aligned for indexable pages");
}

/** English keyword alignment — homepage/country keep mileage-check; other pages use VIN/history */
const EN_KEYWORDS = {
  home: ["car mileage check", "usa mileage", "korean"],
  pricing: ["vin history", "pricing"],
  free_decoder: ["vin decoder", "vin"],
  how_it_works: ["how it works", "vin"],
  faq: ["faq", "vin history"],
  country_usa: ["us car history", "mileage"],
  country_korea: ["korean car km", "south korea"],
  country_canada: ["canadian car history"],
  country_china: ["chinese car history"],
  country_uae: ["uae car history"],
};

let enWarn = 0;
for (const [key, needles] of Object.entries(EN_KEYWORDS)) {
  const entry = seoData[key]?.en;
  if (!entry) continue;
  const blob = `${entry.title} ${entry.description}`.toLowerCase();
  for (const needle of needles) {
    if (!blob.includes(needle)) {
      console.warn(`WARN en.${key}: missing keyword "${needle}" in title/description`);
      enWarn++;
    }
  }
}
if (enWarn === 0) {
  console.log("OK — English SEO keywords aligned for indexable pages");
}

/** sq: homepage/country titles use "kontroll kilometrash" (not other marketing pages) */
const SQ_TITLE_KEYS = [
  "home",
  "country_usa",
  "country_korea",
  "country_canada",
];
for (const key of SQ_TITLE_KEYS) {
  const title = (seoData[key]?.sq?.title ?? "").toLowerCase();
  if (title.includes("kontroll kilometra") && !title.includes("kilometrash")) {
    console.warn(`WARN sq.${key}: title uses "kilometra" without "kilometrash"`);
    sqWarn++;
  }
}

/** sq i18n: stable H1 (no rotating primary keyword) */
const sqI18nPath = join(root, "src/i18n/sq.json");
if (existsSync(sqI18nPath)) {
  const sqI18n = readJson(sqI18nPath);
  if (sqI18n.hero_headline_1 !== "Kontroll kilometrash") {
    console.warn('WARN sq.json: hero_headline_1 should be "Kontroll kilometrash"');
    sqWarn++;
  }
  if (!(sqI18n.hero_headline_2 ?? "").toLowerCase().includes("aksidente")) {
    console.warn("WARN sq.json: hero_headline_2 should mention aksidente");
    sqWarn++;
  }
  for (const slug of ["usa", "korea", "canada", "china", "japan", "uae"]) {
    if (sqI18n[`country_${slug}_headline_verb`] !== "Kontroll") {
      console.warn(`WARN sq.json: country_${slug}_headline_verb should be Kontroll`);
      sqWarn++;
    }
    if ((sqI18n[`country_${slug}_headline_origin`] ?? "").includes("makinat")) {
      console.warn(`WARN sq.json: country_${slug}_headline_origin should use makina not makinat`);
      sqWarn++;
    }
    if ((sqI18n[`country_${slug}_cycling_0`] ?? "") !== "kilometrash") {
      console.warn(`WARN sq.json: country_${slug}_cycling_0 should be kilometrash (stable H1 primary)`);
      sqWarn++;
    }
  }
  const sub = sqI18n.hero_subtext ?? "";
  if (!sub.toLowerCase().includes("kontroll kilometrash")) {
    console.warn("WARN sq.json: hero_subtext missing kontroll kilometrash");
    sqWarn++;
  }
  if (!(sqI18n.seo_home_body ?? "").toLowerCase().includes("kontroll kilometrash")) {
    console.warn("WARN sq.json: seo_home_body missing kontroll kilometrash");
    sqWarn++;
  }
}

/** en i18n: stable H1 + market keywords */
const enI18nPath = join(root, "src/i18n/en.json");
if (existsSync(enI18nPath)) {
  const enI18nSeo = readJson(enI18nPath);
  if (!(enI18nSeo.hero_headline_1 ?? "").toLowerCase().includes("mileage")) {
    console.warn("WARN en.json: hero_headline_1 should mention mileage");
    enWarn++;
  }
  if ((enI18nSeo.country_usa_cycling_0 ?? "") !== "history") {
    console.warn('WARN en.json: country_usa_cycling_0 should be "history"');
    enWarn++;
  }
  if ((enI18nSeo.country_korea_cycling_0 ?? "") !== "km history") {
    console.warn('WARN en.json: country_korea_cycling_0 should be "km history"');
    enWarn++;
  }
  if (!(enI18nSeo.seo_home_body ?? "").toLowerCase().includes("usa mileage")) {
    console.warn("WARN en.json: seo_home_body missing USA mileage");
    enWarn++;
  }
}

if (sqWarn === 0) {
  console.log("OK — Albanian title/H1 SEO alignment");
}
if (enWarn === 0) {
  console.log("OK — English title/H1 SEO alignment");
}

/** Marketing SSR body snapshots — crawlers need H1 + lead in first HTML */
const marketingSsrPath = join(root, "src/lib/marketing-ssr-data.json");
if (!existsSync(marketingSsrPath)) {
  console.error("MISSING marketing-ssr-data.json — run build-marketing-ssr-data.ts");
  errors++;
} else {
  const marketingSsr = JSON.parse(readFileSync(marketingSsrPath, "utf8"));
  const ssrPages = [
    "home",
    "pricing",
    "free_decoder",
    "how_it_works",
    "faq",
    "country_usa",
    "country_korea",
    "country_canada",
    "country_china",
    "country_uae",
  ];
  for (const key of ssrPages) {
    const page = marketingSsr[key];
    if (!page) {
      console.error(`MISSING marketing SSR page: ${key}`);
      errors++;
      continue;
    }
    for (const lang of langs) {
      const entry = page[lang];
      if (!entry?.h1?.trim() || !entry?.lead?.trim()) {
        console.error(`MISSING marketing SSR ${key}.${lang}`);
        errors++;
      }
      if (!entry?.links?.length) {
        console.error(`MISSING marketing SSR links ${key}.${lang}`);
        errors++;
      }
    }
  }
  const enHomeH1 = marketingSsr.home?.en?.h1 ?? "";
  const sqHomeH1 = marketingSsr.home?.sq?.h1 ?? "";
  if (!enHomeH1.toLowerCase().includes("mileage") && !enHomeH1.toLowerCase().includes("accident")) {
    console.error("marketing SSR en.home h1 missing core keywords");
    errors++;
  }
  if (!sqHomeH1.toLowerCase().includes("kontroll")) {
    console.error("marketing SSR sq.home h1 missing kontroll");
    errors++;
  }
  if (errors === 0) {
    console.log(`OK — marketing SSR body for ${ssrPages.length} pages × ${langs.length} languages`);
  }
}
