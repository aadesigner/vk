/**
 * QA: fetch local-report + normalize market data for one VIN.
 * Usage: pnpm exec tsx --import ./load-env.mjs scripts/qa-vin-market.mjs 5YFS4MCE0NP127131
 */
import { db } from "@workspace/db";
import { providersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { normalizeCarstatResponse } from "../src/lib/vinService.ts";

const vin = (process.argv[2] ?? "").toUpperCase();
if (vin.length !== 17) {
  console.error("Usage: tsx scripts/qa-vin-market.mjs <VIN>");
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

console.log("HTTP", res.status);
console.log("vehicle", body.year, body.manufacturer?.name, body.model?.name);
console.log("lots", body.lots?.length ?? 0);

for (const [i, lot] of (body.lots ?? []).entries()) {
  console.log(
    `lot[${i}]`,
    JSON.stringify({
      domain: lot.domain?.name,
      sale_date: lot.sale_date,
      sale_date_updated_at: lot.sale_date_updated_at,
      final_bid: lot.final_bid,
      bid: lot.bid,
      buy_now: lot.buy_now,
      status: lot.status?.name,
      final_bid_updated_at: lot.final_bid_updated_at,
      updated_at: lot.updated_at,
      country: lot.location?.country?.iso,
    }),
  );
}

const norm = normalizeCarstatResponse(body);
console.log("\nnormalized.marketData:", JSON.stringify(norm.marketData, null, 2));
console.log("auctionHistory[0]:", JSON.stringify(norm.auctionHistory?.[0] ?? null, null, 2));
console.log("country:", norm.country);

process.exit(0);
