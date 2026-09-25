import fs from "fs";
const p = "C:/Users/Pc/Downloads/vk/artifacts/verifykm/src/i18n/en.json";
const d = JSON.parse(fs.readFileSync(p, "utf8"));
Object.assign(d, {
  hero_badge: "Evidence-first VIN checks",
  hero_headline_1: "Pull the truth from the VIN.",
  hero_headline_2: "before you hand over cash",
  hero_subtext: "VerifyKM is built for importers and serious buyers: auction hits, insurance claims, odometer trails and branded titles — in one blue-and-white dossier, not a generic green checklist.",
  how_it_works: "How VerifyKM works",
  how_it_works_desc: "No fluff. Enter the chassis number, unlock the file, read what the records actually say.",
  step_1_title: "Enter the chassis",
  step_1_desc: "17 characters from the dash, door jamb or export papers — we take it from there.",
  step_2_title: "Unlock after payment",
  step_2_desc: "Provider pulls run only once you pay. You are not charged for empty curiosity.",
  step_3_title: "Read the dossier",
  step_3_desc: "Mileage trail, damage hits, salvage and theft flags — evidence you can act on.",
  cta_title: "Stop guessing. Start verifying.",
  cta_desc: "One VIN. One dossier. Built for buyers who need proof, not marketing copy.",
  get_started: "Start investigation",
  check_vin: "Investigate VIN",
  check_now: "Run check",
  see_whats_included: "See what we uncover",
  pricing: "Plans",
  per_report: "per full dossier",
  vin_check: "VIN investigation",
});
fs.writeFileSync(p, JSON.stringify(d, null, 2) + "\n");
console.log("voice ok");
