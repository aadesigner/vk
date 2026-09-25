import { Router } from "express";
import { db, providersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { makeTtlCache } from "../lib/ttlCache.js";

const router = Router();

const SUPPORTED_COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "DE", name: "Germany" },
  { code: "UA", name: "Ukraine" },
  { code: "PL", name: "Poland" },
  { code: "KR", name: "South Korea" },
  { code: "JP", name: "Japan" },
  { code: "GB", name: "United Kingdom" },
  { code: "FR", name: "France" },
  { code: "NL", name: "Netherlands" },
  { code: "RU", name: "Russia" },
] as const;

export const SUPPORTED_COUNTRY_CODES = SUPPORTED_COUNTRIES.map((c) => c.code);

type CountryEntry = {
  code: string;
  name: string;
  hasProvider: boolean;
};

const cache = makeTtlCache<CountryEntry[]>(30 * 60_000);

export function invalidateCountriesCache(): void {
  cache.invalidate();
}

router.get("/countries", async (_req, res) => {
  const countries = await cache.getOrFetch(async () => {
    const activeProviders = await db
      .select({ countryCode: providersTable.countryCode })
      .from(providersTable)
      .where(eq(providersTable.isActive, true));

    const activeCodes = new Set(activeProviders.map((p) => p.countryCode));

    return SUPPORTED_COUNTRIES.map((c) => ({
      code: c.code,
      name: c.name,
      hasProvider: activeCodes.has(c.code),
    }));
  });

  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=1800");
  res.json(countries);
});

export default router;
