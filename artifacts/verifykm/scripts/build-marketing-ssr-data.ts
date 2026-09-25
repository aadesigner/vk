/**
 * Snapshot marketing SSR body copy for prerender + server inject.
 * Run: pnpm exec tsx scripts/build-marketing-ssr-data.ts
 */
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { MarketingSsrContent, MarketingSsrData } from "@workspace/marketing-page-seo";
import { SUPPORTED_LANGS, type Language } from "../src/lib/languages";
import { pathFor, pathForCountry } from "../src/lib/localized-routes";
import { getB2bCopy, getRegionHeadlineLabel } from "../src/pages/api-b2b/copy";
import { API_B2B_REGIONS } from "../src/pages/api-b2b/regions";

const __dir = dirname(fileURLToPath(import.meta.url));
const i18nDir = join(__dir, "../src/i18n");
const outPath = join(__dir, "marketing-ssr-data.json");
const libOutPath = join(__dir, "../src/lib/marketing-ssr-data.json");
const workspaceOutPath = join(__dir, "../../../lib/marketing-page-seo/marketing-ssr-data.json");

type Dict = Record<string, string>;

function loadI18n(lang: Language): Dict {
  const raw = readFileSync(join(i18nDir, `${lang}.json`), "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw) as Dict;
}

function pick(t: Dict, key: string): string {
  return (t[key] ?? "").trim();
}

function bullets(t: Dict, keys: string[]): string[] {
  return keys.map((key) => pick(t, key)).filter(Boolean);
}

function section(t: Dict, titleKey: string, bodyKey: string) {
  const title = pick(t, titleKey);
  const body = pick(t, bodyKey);
  if (!title || !body) return null;
  return { title, body };
}

function marketingNavLinks(t: Dict, lang: Language): MarketingSsrContent["links"] {
  return [
    { href: pathFor(lang, "home"), label: pick(t, "footer_check_vin") },
    { href: pathFor(lang, "pricing"), label: pick(t, "pricing") },
    { href: pathFor(lang, "how_it_works"), label: pick(t, "how_it_works") },
    { href: pathFor(lang, "faq"), label: pick(t, "faq") },
    { href: pathForCountry(lang, "usa"), label: pick(t, "country_usa_name") },
    { href: pathForCountry(lang, "korea"), label: pick(t, "country_korea_name") },
  ].filter((link) => link.label);
}

function withNavLinks(t: Dict, lang: Language, content: MarketingSsrContent): MarketingSsrContent {
  return { ...content, links: marketingNavLinks(t, lang) };
}

function homeContent(t: Dict, lang: Language): MarketingSsrContent {
  const h1 = lang === "sq"
    ? `${pick(t, "hero_headline_1")}, ${pick(t, "hero_headline_2")}`
    : `${pick(t, "hero_headline_1")} ${pick(t, "hero_headline_2")}`.replace(/\s+/g, " ").trim();

  const seoBody = pick(t, "seo_home_body");
  const seoMarkets = pick(t, "seo_home_markets");

  return withNavLinks(t, lang, {
    h1,
    lead: pick(t, "hero_subtext"),
    bullets: bullets(t, [
      "cycling_hidden_accidents",
      "cycling_salvage_titles",
      "cycling_mileage_rollbacks",
      "cycling_theft_records",
      ...(seoMarkets ? ["seo_home_markets"] : []),
    ]),
    sections: [
      seoBody
        ? {
            title: pick(t, "pricing_seo_product_name") || pick(t, "what_we_check") || "Vehicle history",
            body: seoBody,
          }
        : null,
      section(t, "what_we_check", "what_we_check_sub"),
      section(t, "report_mileage", "feature_mileage_seo"),
      section(t, "report_accidents", "feature_accidents_seo"),
      section(t, "report_salvage", "feature_salvage_seo"),
      section(t, "report_theft", "feature_theft_seo"),
      section(t, "how_it_works", "how_it_works_desc"),
      section(t, "faq_q1", "faq_a1"),
      section(t, "faq_q2", "faq_a2"),
      section(t, "faq_q3", "faq_a3"),
      section(t, "faq_q7", "faq_a7"),
      seoMarkets
        ? { title: pick(t, "home_stats_from") || "Markets", body: seoMarkets }
        : null,
    ].filter((row): row is { title: string; body: string } => row != null),
  });
}

function pricingContent(t: Dict, lang: Language): MarketingSsrContent {
  return withNavLinks(t, lang, {
    h1: `${pick(t, "pricing_hero_title_1")} ${pick(t, "pricing_hero_title_2")}`.trim(),
    lead: pick(t, "pricing_hero_lead"),
    bullets: bullets(t, [
      "pricing_feature_accidents",
      "report_mileage",
      "report_salvage",
      "report_theft",
      "pricing_seo_value_delivery_title",
      "pricing_guarantee_band_title",
    ]),
    sections: [
      section(t, "pricing_seo_title", "pricing_seo_sub"),
      section(t, "pricing_seo_value_pay_title", "pricing_seo_value_pay_desc"),
      section(t, "pricing_seo_value_account_title", "pricing_seo_value_account_desc"),
      section(t, "pricing_seo_value_delivery_title", "pricing_seo_value_delivery_desc"),
      section(t, "pricing_guarantee_band_title", "pricing_guarantee_band_sub"),
      section(t, "report_mileage", "feature_mileage_seo"),
      section(t, "report_accidents", "feature_accidents_seo"),
      section(t, "faq_q6", "faq_a6"),
      section(t, "faq_q7", "faq_a7"),
    ].filter((row): row is { title: string; body: string } => row != null),
  });
}

function howItWorksContent(t: Dict, lang: Language): MarketingSsrContent {
  return withNavLinks(t, lang, {
    h1: pick(t, "how_it_works"),
    lead: pick(t, "how_it_works_desc"),
    bullets: bullets(t, ["step_1_title", "step_2_title", "step_3_title"]),
    sections: [
      section(t, "step_1_title", "step_1_desc"),
      section(t, "step_2_title", "step_2_desc"),
      section(t, "step_3_title", "step_3_desc"),
      section(t, "what_we_check", "what_we_check_sub"),
      section(t, "report_mileage", "feature_mileage_seo"),
      section(t, "report_accidents", "feature_accidents_seo"),
      section(t, "faq_q3", "faq_a3"),
    ].filter((row): row is { title: string; body: string } => row != null),
  });
}

function faqContent(t: Dict, lang: Language): MarketingSsrContent {
  return withNavLinks(t, lang, {
    h1: pick(t, "faq_title"),
    lead: pick(t, "faq_subtitle"),
    bullets: bullets(t, [
      "faq_q1",
      "faq_q2",
      "faq_q3",
      "faq_q4",
      "faq_q6",
      "faq_q7",
      "faq_1_q",
      "faq_2_q",
      "faq_3_q",
    ]),
    sections: [
      section(t, "faq_q1", "faq_a1"),
      section(t, "faq_q2", "faq_a2"),
      section(t, "faq_q3", "faq_a3"),
      section(t, "faq_q4", "faq_a4"),
      section(t, "faq_q5", "faq_a5"),
      section(t, "faq_q6", "faq_a6"),
      section(t, "faq_q7", "faq_a7"),
      section(t, "faq_q8", "faq_a8"),
      section(t, "faq_1_q", "faq_1_a"),
      section(t, "faq_2_q", "faq_2_a"),
      section(t, "faq_3_q", "faq_3_a"),
    ].filter((row): row is { title: string; body: string } => row != null),
  });
}

function freeDecoderContent(t: Dict, lang: Language): MarketingSsrContent {
  return withNavLinks(t, lang, {
    h1: `${pick(t, "free_decoder_title_lead")} ${pick(t, "free_decoder_title_highlight")}`.trim(),
    lead: pick(t, "free_decoder_subtitle"),
    bullets: bullets(t, [
      "free_decoder_badge",
      "free_decoder_what_decode",
      "free_decoder_what_locked",
      "free_decoder_what_full",
    ]),
    sections: [
      section(t, "free_decoder_what_decode", "free_decoder_what_decode_desc"),
      section(t, "free_decoder_what_locked", "free_decoder_what_locked_desc"),
      section(t, "free_decoder_what_full", "free_decoder_what_full_desc"),
      section(t, "free_decoder_cta_title", "free_decoder_cta_desc"),
      section(t, "report_mileage", "feature_mileage_seo"),
      section(t, "report_accidents", "feature_accidents_seo"),
    ].filter((row): row is { title: string; body: string } => row != null),
  });
}

function countryContent(t: Dict, lang: Language, prefix: string): MarketingSsrContent {
  const origin = pick(t, `${prefix}_headline_origin`);
  const verb = pick(t, `${prefix}_headline_verb`);
  const primary = pick(t, `${prefix}_cycling_0`);
  const h1 = `${verb} ${primary} ${origin}`.replace(/\s+/g, " ").trim();

  return withNavLinks(t, lang, {
    h1,
    lead: pick(t, `${prefix}_description`),
    bullets: bullets(t, [
      `${prefix}_included_0`,
      `${prefix}_included_1`,
      `${prefix}_included_2`,
      `${prefix}_included_3`,
      `${prefix}_cycling_1`,
      `${prefix}_cycling_2`,
    ]),
    sections: [
      section(t, `${prefix}_issues_sub`, `${prefix}_included_sub`),
      section(t, "report_mileage", `${prefix}_wwc_mileage_seo`),
      section(t, "report_accidents", `${prefix}_wwc_accidents_seo`),
      section(t, "report_salvage", `${prefix}_wwc_salvage_seo`),
      section(t, "report_theft", `${prefix}_wwc_theft_seo`),
      section(t, `${prefix}_faq_0_q`, `${prefix}_faq_0_a`),
      section(t, `${prefix}_faq_1_q`, `${prefix}_faq_1_a`),
      section(t, `${prefix}_faq_2_q`, `${prefix}_faq_2_a`),
    ].filter((row): row is { title: string; body: string } => row != null),
  });
}

function b2bContent(lang: Language, rest: string): MarketingSsrContent {
  const c = getB2bCopy(lang);
  let title = c.seoHomeTitle;
  let description = c.seoHomeDesc;
  const tail = rest.replace(/^\/api-b2b/, "") || "";
  if (tail === "/plans") {
    title = c.seoPlansTitle;
    description = c.seoPlansDesc;
  } else if (tail === "/contact") {
    title = c.seoContactTitle;
    description = c.seoContactDesc;
  } else if (tail === "/vin-decoder") {
    title = c.seoDecoderTitle;
    description = c.seoDecoderDesc;
  } else if (tail.startsWith("/")) {
    const slug = tail.slice(1);
    const region = API_B2B_REGIONS.find((r) => r.slug === slug);
    if (region) {
      const label = getRegionHeadlineLabel(c, region.slug, lang);
      title = c.seoRegionTitle.replace(/\{region\}/g, label);
      description = c.seoRegionDesc.replace(/\{region\}/g, label);
    }
  }
  return { h1: title, lead: description };
}

const PAGE_BUILDERS: Record<string, (t: Dict, lang: Language) => MarketingSsrContent> = {
  home: homeContent,
  pricing: pricingContent,
  how_it_works: howItWorksContent,
  faq: faqContent,
  free_decoder: freeDecoderContent,
  country_usa: (t, lang) => countryContent(t, lang, "country_usa"),
  country_korea: (t, lang) => countryContent(t, lang, "country_korea"),
  country_canada: (t, lang) => countryContent(t, lang, "country_canada"),
  country_china: (t, lang) => countryContent(t, lang, "country_china"),
  country_japan: (t, lang) => countryContent(t, lang, "country_japan"),
  country_uae: (t, lang) => countryContent(t, lang, "country_uae"),
};

const data: MarketingSsrData = {};

for (const pageKey of Object.keys(PAGE_BUILDERS)) {
  data[pageKey as keyof MarketingSsrData] = {};
  const build = PAGE_BUILDERS[pageKey]!;
  for (const lang of SUPPORTED_LANGS) {
    const t = loadI18n(lang);
    const content = build(t, lang);
    if (content.h1 && content.lead) {
      data[pageKey as keyof MarketingSsrData]![lang] = content;
    }
  }
}

const b2bPaths = [
  "/api-b2b",
  "/api-b2b/plans",
  "/api-b2b/contact",
  "/api-b2b/vin-decoder",
  ...API_B2B_REGIONS.map((r) => `/api-b2b/${r.slug}`),
] as const;

for (const rest of b2bPaths) {
  const key = rest === "/api-b2b" ? "api_b2b" : `api_b2b${rest.replace(/\//g, "_")}`;
  const bucket: Record<string, MarketingSsrContent> = {};
  for (const lang of SUPPORTED_LANGS) {
    const content = b2bContent(lang, rest);
    if (content.h1 && content.lead) bucket[lang] = content;
  }
  (data as Record<string, Record<string, MarketingSsrContent>>)[key] = bucket;
}

const json = `${JSON.stringify(data, null, 2)}\n`;
writeFileSync(outPath, json, "utf8");
writeFileSync(libOutPath, json, "utf8");
writeFileSync(workspaceOutPath, json, "utf8");

const seoDataSrc = join(__dir, "../src/lib/seo-data.json");
const b2bSeoSrc = join(__dir, "b2b-seo-data.json");
const workspaceSeoOut = join(__dir, "../../../lib/marketing-page-seo/marketing-seo-data.json");
const workspaceB2bOut = join(__dir, "../../../lib/marketing-page-seo/marketing-b2b-seo-data.json");
copyFileSync(seoDataSrc, workspaceSeoOut);
copyFileSync(b2bSeoSrc, workspaceB2bOut);

console.log(`Wrote marketing SSR data → ${outPath}`);
