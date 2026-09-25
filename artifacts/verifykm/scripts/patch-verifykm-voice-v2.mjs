/**
 * Distinct VerifyKM EN voice + SEO meta (from this point forward vs kmcheck).
 */
import fs from "fs";

const enPath = "C:/Users/Pc/Downloads/vk/artifacts/verifykm/src/i18n/en.json";
const seoPath = "C:/Users/Pc/Downloads/vk/artifacts/verifykm/src/lib/seo-data.json";

const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
Object.assign(en, {
  hero_badge: "Chassis investigation desk",
  hero_headline_1: "Open the VIN dossier.",
  hero_headline_2: "before the seller controls the story",
  hero_subtext:
    "VerifyKM turns a 17-character chassis number into an evidence file — auction trails, insurance hits, odometer history and branded titles — so imports and private buys start with records, not promises.",
  how_it_works: "The VerifyKM workflow",
  how_it_works_desc: "Enter the chassis. Unlock the file. Read what the databases already know.",
  countries_title: "Markets we investigate",
  countries_subtitle: "Pick a market lane. Each guide explains what VerifyKM looks for on that origin.",
  stats_countries_badge: "Coverage lanes",
  cta_title: "Buy with a dossier. Not a vibe.",
  cta_desc: "€19.99 unlocks one full VIN file — or save with multi-report packs.",
  footer_tagline:
    "VerifyKM is a VIN investigation desk for importers and careful buyers. Evidence first. Guesswork never.",
  footer_data_source: "Auction · insurance · marketplace · registration signals",
  footer_investigate_label: "Investigate",
  footer_investigate_cta: "Don't buy a car you're unsure about. Buy it sure.",
  footer_explore: "Explore",
  footer_markets: "Market lanes",
  footer_rights_line: "VIN investigation for serious used-car decisions.",
  footer_language: "Language",
  footer_legal: "Legal",
  check_vin: "Open dossier",
  get_started: "Start dossier",
  my_reports: "My dossiers",
  view_report: "Open dossier",
  view_dossier: "Open dossier",
  dashboard_case_file: "Case file",
  vin_case_id_label: "Case ID · VIN",
  pricing_hero_title_1: "One payment.",
  pricing_hero_title_2: "One full evidence file.",
  pricing_hero_lead:
    "€19.99 per dossier (was €29.99). Packs: €16.99 each ×3, or €12.99 each ×5.",
  pricing_subtitle: "Transparent dossier pricing — no subscription, no reseller portal.",
  free_decoder_title: "Free chassis decoder",
  free_decoder_title_highlight: "chassis decoder",
  free_decoder_subtitle:
    "Read factory year, make, model and plant from the VIN structure — then unlock the full VerifyKM dossier for mileage and damage evidence.",
  faq: "Questions",
  nav_how_it_works: "Workflow",
  pricing: "Dossier pricing",
});
fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + "\n");
console.log("en voice keys updated");

const seo = JSON.parse(fs.readFileSync(seoPath, "utf8"));
const patches = {
  home: {
    title: "VIN Dossier Investigation — Mileage, Accidents & Title Risk | VerifyKM",
    description:
      "Open a VerifyKM VIN dossier. Surface odometer trails, auction hits, salvage brands and theft signals for cars from the USA, Korea, Canada, China, Japan and Dubai.",
  },
  pricing: {
    title: "Dossier Pricing — €19.99 VIN File | VerifyKM",
    description:
      "One payment unlocks a full VIN dossier at €19.99 (standard €29.99). Multi-report packs from €12.99 per file. Instant delivery. No subscription.",
  },
  how_it_works: {
    title: "VerifyKM Workflow — VIN Dossier in Three Steps",
    description:
      "Enter a chassis number, unlock the evidence file, read mileage, accidents and title flags. Built for importers and careful buyers.",
  },
  faq: {
    title: "VerifyKM FAQ — VIN Dossiers, Coverage & Delivery",
    description:
      "Answers on markets, report speed, refunds and what appears inside a VerifyKM VIN dossier.",
  },
  free_decoder: {
    title: "Free Chassis Decoder — Year, Make, Model | VerifyKM",
    description:
      "Decode any 17-character VIN for factory specs free. Unlock a VerifyKM dossier for verified mileage, accidents and salvage status.",
  },
};

for (const [key, val] of Object.entries(patches)) {
  if (!seo[key]?.en) {
    console.warn("missing seo key", key);
    continue;
  }
  seo[key].en.title = val.title;
  seo[key].en.description = val.description;
}
fs.writeFileSync(seoPath, JSON.stringify(seo, null, 2) + "\n");
console.log("seo en patches applied");
