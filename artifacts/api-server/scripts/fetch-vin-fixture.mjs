/**
 * One-shot: fetch local-report for a VIN, save raw provider JSON locally, print salvage QA.
 * Usage: pnpm exec tsx --import ./load-env.mjs scripts/fetch-vin-fixture.mjs WBA5V510XKAJ52378
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "@workspace/db";
import { providersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  extractInsuranceV2FromLots,
  extractLotTitle,
  isSalvageTitle,
  normalizeCarstatResponse,
} from "../src/lib/vinService.ts";

const vin = (process.argv[2] ?? "").toUpperCase();
if (vin.length !== 17) {
  console.error("Usage: tsx scripts/fetch-vin-fixture.mjs <VIN>");
  process.exit(1);
}

const [provider] = await db
  .select()
  .from(providersTable)
  .where(eq(providersTable.isActive, true))
  .limit(1);

if (!provider?.apiKey?.trim()) {
  console.error("No active provider with api_key");
  process.exit(1);
}

const base = String(provider.baseUrl)
  .replace(/\/$/, "")
  .replace("://api.carstat.dev", "://carstat.dev");
const url = `${base}/api/local-report/${encodeURIComponent(vin)}`;
const res = await fetch(url, {
  headers: { Accept: "application/json", "x-api-key": provider.apiKey },
});
const body = await res.json();

if (!res.ok) {
  console.error("HTTP", res.status, JSON.stringify(body).slice(0, 500));
  process.exit(1);
}

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "fixtures");
mkdirSync(dir, { recursive: true });
const outPath = join(dir, `${vin}-carstat-raw.json`);
writeFileSync(outPath, JSON.stringify(body, null, 2), "utf8");
console.log("Saved raw provider JSON →", outPath);

const lots = Array.isArray(body.lots) ? body.lots : [];
const insurance = extractInsuranceV2FromLots(lots);
const totalLoss = Number(insurance.totalLossCnt ?? 0);
console.log("\n=== Salvage inputs ===");
console.log({
  totalLossCnt: insurance.totalLossCnt,
  is_salvage: insurance.is_salvage ?? insurance.isSalvage ?? insurance.salvage ?? insurance.totalLoss,
  accidentCnt: insurance.accidentCnt,
  accidentsInInsurance: Array.isArray(insurance.accidents) ? insurance.accidents.length : 0,
});

console.log("\n=== Lot titles ===");
for (const [i, lot] of lots.entries()) {
  const title = extractLotTitle(lot);
  if (!title) continue;
  console.log(`lot[${i}]`, lot.domain?.name, JSON.stringify(title), "→ isSalvageTitle:", isSalvageTitle(title));
}

const norm = normalizeCarstatResponse(body);
console.log("\n=== Normalized ===");
console.log({
  isSalvage: norm.isSalvage,
  titleStatus: norm.titleStatus,
  accidentCount: norm.accidentCount,
  country: norm.country,
});

process.exit(0);
