import { BLOG_ARTICLES, articleIdFromSlug, articleSlug } from "../src/content/blog.ts";

const langs = ["en", "de", "es", "fr", "sq", "pl", "ro", "bg", "ka", "ar", "uk", "ru", "zh"] as const;
const seen = new Map<string, string>();
const dups: string[] = [];
const missing: string[] = [];

for (const article of BLOG_ARTICLES) {
  for (const lang of langs) {
    if (!article.title[lang] || !article.slug[lang] || !article.description[lang] || !article.kicker[lang]) {
      missing.push(`${article.id} meta ${lang}`);
    }
    for (const section of article.sections) {
      if (!section.h[lang] || !section.p[lang]) missing.push(`${article.id} section ${lang}`);
    }
    const key = article.slug[lang];
    const prev = seen.get(key);
    if (prev && prev !== article.id) dups.push(`${key} ${prev} ${article.id}`);
    else seen.set(key, article.id);
  }
}

console.log(JSON.stringify({
  articles: BLOG_ARTICLES.length,
  sq: BLOG_ARTICLES[0]?.title.sq,
  id: articleIdFromSlug("si-te-kontrollosh-kilometrat-e-makines-falas"),
  en: articleSlug("en", "free-km"),
  missing,
  dups,
}, null, 2));
