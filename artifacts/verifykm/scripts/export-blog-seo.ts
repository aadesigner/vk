/**
 * Writes scripts/blog-seo.json from the live article copy.
 * Run: pnpm exec tsx scripts/export-blog-seo.ts
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BLOG_ARTICLES, BLOG_INDEX_META, BLOG_INDEX_SLUG } from "../src/content/blog.ts";

const dir = dirname(fileURLToPath(import.meta.url));
const langs = ["en", "de", "es", "fr", "sq", "pl", "ro", "bg", "ka", "ar", "uk", "ru", "zh"] as const;

const slugToId: Record<string, string> = {};
for (const article of BLOG_ARTICLES) {
  for (const slug of Object.values(article.slug)) {
    slugToId[slug] = article.id;
  }
}

const data = {
  indexSlug: BLOG_INDEX_SLUG,
  index: Object.fromEntries(
    langs.map((lang) => [
      lang,
      {
        title: BLOG_INDEX_META.title[lang],
        description: BLOG_INDEX_META.description[lang],
      },
    ]),
  ),
  slugToId,
  articles: BLOG_ARTICLES.map((article) => ({
    id: article.id,
    slug: article.slug,
    title: article.title,
    description: article.description,
    sections: Object.fromEntries(
      langs.map((lang) => [
        lang,
        article.sections.map((section) => ({
          title: section.h[lang],
          body: section.p[lang],
        })),
      ]),
    ),
  })),
};

writeFileSync(join(dir, "blog-seo.json"), `${JSON.stringify(data)}\n`);
console.log(`blog-seo.json articles=${data.articles.length} slugs=${Object.keys(slugToId).length}`);
