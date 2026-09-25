import { Router } from "express";
import { db } from "@workspace/db";
import { announcementsTable } from "@workspace/db";
import { eq, and, or, isNull, gt, desc } from "drizzle-orm";
import { makeTtlCache } from "../lib/ttlCache.js";

const router = Router();

type AnnouncementRow = typeof announcementsTable.$inferSelect;

type LangOverride = {
  message?: string;
  linkText?: string;
  linkUrl?: string;
  hidden?: boolean;
};

const cache = makeTtlCache<AnnouncementRow | null>(2 * 60_000);

export function invalidateAnnouncementsCache(): void {
  cache.invalidate();
}

router.get("/announcements/active", async (req, res) => {
  const row = await cache.getOrFetch(async () => {
    const now = new Date();
    const [found] = await db
      .select()
      .from(announcementsTable)
      .where(
        and(
          eq(announcementsTable.isActive, true),
          or(isNull(announcementsTable.endsAt), gt(announcementsTable.endsAt, now))
        )
      )
      .orderBy(desc(announcementsTable.id))
      .limit(1);
    return found ?? null;
  });

  if (!row) {
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
    res.json(null);
    return;
  }

  const lang = typeof req.query.lang === "string" ? req.query.lang : null;

  if (lang && row.translations) {
    const overrides = (row.translations as Record<string, LangOverride>)[lang];
    if (overrides) {
      if (overrides.hidden) {
        res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
        res.json(null);
        return;
      }
      res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
      res.json({
        ...row,
        message:  overrides.message  ?? row.message,
        linkText: overrides.linkText !== undefined ? overrides.linkText  : row.linkText,
        linkUrl:  overrides.linkUrl  !== undefined ? overrides.linkUrl   : row.linkUrl,
      });
      return;
    }
  }

  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
  res.json(row);
});

export default router;
