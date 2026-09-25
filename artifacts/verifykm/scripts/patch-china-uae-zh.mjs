/**
 * Applies China/UAE market i18n + SEO patches and creates zh.json locale bundle.
 * Run: node scripts/patch-china-uae-zh.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SUPPORTED_LANGS } from "./languages.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, "..");
const i18nDir = path.join(root, "src", "i18n");
const legalDir = path.join(i18nDir, "legal");
const seoPath = path.join(root, "src", "lib", "seo-data.json");

const data = JSON.parse(
  fs.readFileSync(path.join(dir, "data", "china-uae-markets.json"), "utf8"),
);

const LANGS = SUPPORTED_LANGS;

/** Compare-table keys not in china-uae-markets.json */
const COMPARE_I18N = {
  en: {
    compare_row_chinese: "Chinese vehicle records",
    compare_row_uae: "UAE / GCC vehicle records",
    compare_desc_china: "China-only tools miss export and cross-border history. verifykm covers Chinese vehicles, Korea, USA, and more in one report.",
    compare_desc_uae: "GCC listings often hide import flood damage. verifykm covers UAE imports, USA, Korea, and Canada in one report.",
  },
  de: {
    compare_row_chinese: "Chinesische Fahrzeugdaten",
    compare_row_uae: "VAE / GCC Fahrzeugdaten",
    compare_desc_china: "China-only Tools übersehen Export- und Grenzhistorie. verifykm deckt China, Korea, USA und mehr in einem Bericht ab.",
    compare_desc_uae: "GCC-Anzeigen verbergen oft Import-Schäden. verifykm deckt VAE-Importe, USA, Korea und Kanada in einem Bericht ab.",
  },
  es: {
    compare_row_chinese: "Registros de vehículos chinos",
    compare_row_uae: "Registros VAE / GCC",
    compare_desc_china: "Las herramientas solo para China omiten historial de exportación. verifykm cubre China, Corea, EE. UU. y más en un informe.",
    compare_desc_uae: "Los anuncios del GCC a menudo ocultan daños por inundación. verifykm cubre importaciones VAE, EE. UU., Corea y Canadá.",
  },
  fr: {
    compare_row_chinese: "Données véhicules chinois",
    compare_row_uae: "Données EAU / GCC",
    compare_desc_china: "Les outils Chine seuls manquent l'historique export. verifykm couvre la Chine, la Corée, les USA et plus dans un rapport.",
    compare_desc_uae: "Les annonces GCC cachent souvent les inondations à l'import. verifykm couvre les importations EAU, USA, Corée et Canada.",
  },
  sq: {
    compare_row_chinese: "Regjistra makinash kineze",
    compare_row_uae: "Regjistra EAU / GCC",
    compare_desc_china: "Mjetet vetëm për Kinën humbin historinë e eksportit. verifykm mbulon Kinën, Korenë, SHBA-në dhe më shumë.",
    compare_desc_uae: "Njoftimet GCC fshehin shpesh dëmtimet nga përmbytja. verifykm mbulon importet EAU, SHBA, Kore dhe Kanada.",
  },
  pl: {
    compare_row_chinese: "Chińskie dane pojazdów",
    compare_row_uae: "Dane ZEA / GCC",
    compare_desc_china: "Narzędzia tylko dla Chin pomijają historię eksportu. verifykm obejmuje Chiny, Koreę, USA i więcej w jednym raporcie.",
    compare_desc_uae: "Oferty GCC często ukrywają szkody powodziowe importu. verifykm obejmuje importy ZEA, USA, Koreę i Kanadę.",
  },
  ro: {
    compare_row_chinese: "Înregistrări vehicule chinezești",
    compare_row_uae: "Înregistrări EAU / GCC",
    compare_desc_china: "Instrumentele doar pentru China omit istoricul de export. verifykm acoperă China, Coreea, SUA și altele într-un raport.",
    compare_desc_uae: "Anunțurile GCC ascund adesea daune de inundație la import. verifykm acoperă importurile EAU, SUA, Coreea și Canada.",
  },
  bg: {
    compare_row_chinese: "Китайски автомобилни данни",
    compare_row_uae: "Данни ОАЕ / GCC",
    compare_desc_china: "Инструментите само за Китай пропускат експортна история. verifykm покрива Китай, Корея, САЩ и още в един отчет.",
    compare_desc_uae: "Обявите в GCC често крият щети от наводнение при внос. verifykm покрива внос ОАЕ, САЩ, Корея и Канада.",
  },
  ar: {
    compare_row_chinese: "سجلات المركبات الصينية",
    compare_row_uae: "سجلات الإمارات / دول الخليج",
    compare_desc_china: "أدوات الصين وحدها تفوت تاريخ التصدير. verifykm يغطي الصين وكوريا والولايات المتحدة والمزيد في تقرير واحد.",
    compare_desc_uae: "إعلانات الخليج غالباً تخفي أضرار الفيضانات. verifykm يغطي واردات الإمارات والولايات المتحدة وكوريا وكندا.",
  },
  uk: {
    compare_row_chinese: "Китайські дані авто",
    compare_row_uae: "Дані ОАЕ / GCC",
    compare_desc_china: "Інструменти лише для Китаю пропускають експортну історію. verifykm охоплює Китай, Корею, США та інше в одному звіті.",
    compare_desc_uae: "Оголошення GCC часто приховують пошкодження від повеней. verifykm охоплює імпорт ОАЕ, США, Корею та Канаду.",
  },
  ru: {
    compare_row_chinese: "Китайские данные авто",
    compare_row_uae: "Данные ОАЭ / GCC",
    compare_desc_china: "Инструменты только для Китая упускают экспортную историю. verifykm охватывает Китай, Корею, США и др. в одном отчёте.",
    compare_desc_uae: "Объявления GCC часто скрывают ущерб от наводнений. verifykm охватывает импорт ОАЭ, США, Корею и Канаду.",
  },
  zh: {
    compare_row_chinese: "中国车辆记录",
    compare_row_uae: "阿联酋 / 海湾国家记录",
    compare_desc_china: "仅覆盖中国的工具会遗漏出口和跨境历史。verifykm 在一份报告中涵盖中国、韩国、美国等市场。",
    compare_desc_uae: "海湾地区车源常隐藏进口水淹车记录。verifykm 在一份报告中涵盖阿联酋进口、美国、韩国和加拿大。",
  },
};

function mergeMarketKeys(locale, market) {
  const patch = data[market]?.[locale];
  if (!patch) throw new Error(`Missing ${market} patch for ${locale}`);
  return patch;
}

// ── i18n locale files ──
for (const locale of LANGS) {
  if (locale === "zh") continue;
  const filePath = path.join(i18nDir, `${locale}.json`);
  const json = JSON.parse(fs.readFileSync(filePath, "utf8"));
  Object.assign(json, mergeMarketKeys(locale, "china"), mergeMarketKeys(locale, "uae"), COMPARE_I18N[locale] ?? COMPARE_I18N.en);
  fs.writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`, "utf8");
  console.log(`Patched i18n/${locale}.json`);
}

// ── zh.json: full locale from zh-part-*.json (see build-zh-i18n.mjs) ──
import { spawnSync } from "node:child_process";
const buildZh = spawnSync(process.execPath, ["scripts/build-zh-i18n.mjs"], {
  cwd: root,
  stdio: "inherit",
});
if (buildZh.status !== 0) process.exit(buildZh.status ?? 1);

// legal/zh.json is maintained by build-zh-i18n workflow / manual legal translation — do not overwrite with en

// ── seo-data.json ──
const seo = JSON.parse(fs.readFileSync(seoPath, "utf8"));

for (const lang of LANGS) {
  if (!seo.country_china) seo.country_china = {};
  if (!seo.country_uae) seo.country_uae = {};
  seo.country_china[lang] = data.seo.country_china[lang];
  seo.country_uae[lang] = data.seo.country_uae[lang];
}

for (const [pageKey, entry] of Object.entries(data.seo.zh_pages)) {
  if (!seo[pageKey]) {
    console.warn(`seo-data missing page key: ${pageKey}`);
    continue;
  }
  seo[pageKey].zh = entry;
}

fs.writeFileSync(seoPath, `${JSON.stringify(seo, null, 2)}\n`, "utf8");
console.log("Patched seo-data.json (country_china, country_uae, zh for all pages)");

console.log("Done.");
