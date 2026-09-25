/**
 * QA: Korean insurance claim USD conversion (KRW → USD display).
 * Run: node scripts/qa-korean-currency.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let errors = 0;

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  errors++;
}

function ok(msg) {
  console.log(`OK: ${msg}`);
}

const DEFAULT_KRW_PER_USD = 1537;

function convertKrwToUsd(krw, krwPerUsd) {
  if (!Number.isFinite(krw) || !Number.isFinite(krwPerUsd) || krwPerUsd <= 0) return 0;
  return krw / krwPerUsd;
}

function formatKoreanInsuranceAmount(krw, krwPerUsd) {
  const rate = krwPerUsd > 0 ? krwPerUsd : DEFAULT_KRW_PER_USD;
  const usd = Math.round(convertKrwToUsd(krw, rate));
  return `$${usd.toLocaleString("en-US")} (₩${krw.toLocaleString("en-US")})`;
}

const sample = formatKoreanInsuranceAmount(7_060_220, 1537);
if (sample !== "$4,594 (₩7,060,220)") {
  fail(`sample conversion expected "$4,594 (₩7,060,220)", got "${sample}"`);
} else {
  ok("sample claim converts to USD primary + won in parentheses");
}

const schema = readFileSync(path.join(root, "../../lib/db/src/schema/settings.ts"), "utf8");
if (!schema.includes("krwPerUsd")) fail("system_settings schema missing krwPerUsd");
else ok("DB schema has krwPerUsd");

const payments = readFileSync(path.join(root, "../api-server/src/routes/payments.ts"), "utf8");
if (!payments.includes("krwPerUsd")) fail("public-settings missing krwPerUsd");
else ok("public-settings exposes krwPerUsd");

const admin = readFileSync(path.join(root, "../api-server/src/routes/admin.ts"), "utf8");
if (!admin.includes("krwPerUsd")) fail("admin settings missing krwPerUsd");
else ok("admin settings supports krwPerUsd");

const claimsSection = readFileSync(path.join(root, "src/components/insurance-claims-section.tsx"), "utf8");
if (!claimsSection.includes("krwPerUsd")) fail("InsuranceClaimsSection missing krwPerUsd prop");
else ok("InsuranceClaimsSection passes krwPerUsd");

const adminSettings = readFileSync(path.join(root, "src/pages/admin/settings.tsx"), "utf8");
if (!adminSettings.includes("krwPerUsd")) fail("admin settings UI missing krwPerUsd");
else ok("admin settings UI has KRW/USD rate field");

const i18nEn = readFileSync(path.join(root, "src/i18n/en.json"), "utf8");
if (!i18nEn.includes("report_insurance_claims_note")) {
  fail("en.json missing report_insurance_claims_note");
} else {
  ok("i18n has insurance claims note");
}

if (errors > 0) {
  console.error(`\nFAILED — ${errors} issue(s)`);
  process.exit(1);
}
console.log("\nAll Korean currency QA checks passed");
