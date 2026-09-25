import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const p = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/i18n/en.json");
const data = JSON.parse(fs.readFileSync(p, "utf8"));

const patch = {
  hero_badge: "VIN investigation · Instant report",
  hero_headline_1: "Investigate the VIN.",
  hero_headline_lead: "Investigate",
  hero_headline_tail: "the VIN —",
  hero_headline_2: "mileage, damage & title risk",
  hero_subtext:
    "VerifyKM digs into auction, insurance and marketplace records so you can spot rolled odometers, undisclosed accidents and salvage brands before you buy.",
  hero_checks_today: "VIN checks run today",
  how_it_works_desc:
    "Three moves: enter the VIN, unlock the dossier, review mileage, accidents and title flags with evidence — not guesses.",
  step_1_title: "Drop in the VIN",
  step_1_desc: "Paste the 17-character chassis number from the dash, door jamb or paperwork.",
  step_2_title: "Unlock the dossier",
  step_2_desc: "We query partner networks after payment — you only pay when you want the full file.",
  step_3_title: "Read the evidence",
  step_3_desc: "Mileage timeline, accident hits, salvage/theft signals and more — delivered in seconds.",
  cta_title: "Don't buy blind. Verify first.",
  cta_desc: "One VIN. One clear dossier. Mileage, accidents and title risk — ready in seconds.",
  footer_tagline:
    "VerifyKM investigates vehicle history across major import markets — so used-car decisions start with evidence, not seller claims.",
  footer_data_source: "Secure checkout · Multi-source auction, insurance & marketplace records",
  footer_company: "VerifyKM",
  pricing_hero_title: "Clear pricing. Full dossier.",
  pricing_hero_title_1: "Pay once.",
  pricing_hero_title_2: "Unlock the full VIN file.",
  pricing_hero_eyebrow: "No subscription · One report",
  pricing_hero_lead:
    "Investigate mileage, accidents and title status in a single report — built for buyers who want proof before they commit.",
  pricing_subtitle: "Straightforward pricing. One VIN dossier with everything we can find.",
  seo_home_body:
    "VerifyKM.com investigates vehicle history by VIN. Enter a 17-character chassis number to surface odometer readings, accident records, salvage brands and theft signals across the USA, Korea, Canada, China, Japan and Dubai.",
  seo_home_markets:
    "VIN investigation for cars from the USA, Korea, Canada, China, Japan and Dubai — mileage, accidents, salvage and theft in one dossier.",
  nav_how_it_works: "How it works",
  home_stats_from: "Investigate cars from:",
};

let n = 0;
for (const [k, v] of Object.entries(patch)) {
  if (!(k in data)) {
    console.warn("missing key", k);
    continue;
  }
  data[k] = v;
  n++;
}
fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
console.log("patched", n, "en keys");

// English SEO titles/descriptions — distinct VerifyKM voice
const seoPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/lib/seo-data.json");
const seo = JSON.parse(fs.readFileSync(seoPath, "utf8"));
if (seo.home?.en) {
  seo.home.en.title = "VIN Investigation — Mileage, Accidents & Title Risk | VerifyKM.com";
  seo.home.en.description =
    "Investigate any VIN with VerifyKM. Surface real mileage, accident records, salvage brands and theft signals for cars from the USA, Korea, Canada, China, Japan and Dubai.";
}
if (seo.pricing?.en) {
  seo.pricing.en.title = "Pricing — Full VIN Dossier | VerifyKM.com";
  seo.pricing.en.description =
    "One payment unlocks a full VIN dossier: mileage timeline, accidents, salvage and theft signals. Instant delivery. No subscription.";
}
if (seo.how_it_works?.en) {
  seo.how_it_works.en.title = "How VerifyKM Works — VIN Dossier in 3 Steps | VerifyKM.com";
  seo.how_it_works.en.description =
    "Enter a VIN, unlock the dossier, read the evidence. VerifyKM investigates mileage, accidents and title risk before you buy.";
}
if (seo.faq?.en) {
  seo.faq.en.title = "FAQ — VIN Investigation & Reports | VerifyKM.com";
  seo.faq.en.description =
    "Answers on coverage, delivery speed, refunds and what appears in a VerifyKM VIN dossier.";
}
fs.writeFileSync(seoPath, JSON.stringify(seo, null, 2) + "\n");
console.log("patched seo-data en home/pricing/how/faq");
