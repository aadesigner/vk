/**
 * Wipe client access + sitemap entries for VINs already removed from catalog.
 * Usage: pnpm exec tsx --import ./load-env.mjs scripts/purge-removed-catalog-vins.mjs VIN [VIN...]
 */
import { wipeRemovedCatalogVin } from "../src/lib/vinService.js";

const vins = process.argv.slice(2).map((v) => v.trim().toUpperCase()).filter(Boolean);
if (vins.length === 0) {
  console.error("Usage: purge-removed-catalog-vins.mjs VIN [VIN...]");
  process.exit(1);
}

for (const vin of vins) {
  const result = await wipeRemovedCatalogVin(vin);
  console.log(vin, result);
}
