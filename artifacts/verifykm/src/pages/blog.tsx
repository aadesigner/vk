import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { useTranslation } from "@/i18n/context";
import { EnterReveal } from "@/components/enter-reveal";
import { Button } from "@/components/ui/button";
import { BlogDemo } from "@/components/blog-demo";
import { BLOG_ARTICLES, blogCover, blogPostPath, type BlogArticle } from "@/content/blog";
import { pathFor } from "@/lib/localized-routes";
import type { Language } from "@/lib/languages";
import { cn } from "@/lib/utils";

function minutesLabel(minutes: number, unit: string) {
  return `${minutes} ${unit}`;
}

function Cover({
  id,
  alt,
  className,
}: {
  id: string;
  alt: string;
  className?: string;
}) {
  return (
    <img
      src={blogCover(id)}
      alt={alt}
      className={cn("h-full w-full object-cover", className)}
    />
  );
}

function ArticleCard({
  article,
  language,
  readLabel,
  minuteUnit,
  featured = false,
}: {
  article: BlogArticle;
  language: Language;
  readLabel: string;
  minuteUnit: string;
  featured?: boolean;
}) {
  const title = article.title[language];

  if (featured) {
    return (
      <Link href={blogPostPath(language, article.id)} className="group block">
        <article className="grid overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-[0_24px_50px_-36px_rgba(15,23,42,0.45)] lg:grid-cols-[1.25fr_minmax(0,1fr)]">
          <div className="relative h-64 overflow-hidden sm:h-80 lg:h-full lg:min-h-[26rem]">
            <Cover
              id={article.id}
              alt={title}
              className="transition duration-500 group-hover:scale-[1.03]"
            />
            <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#0088d4]">
              {article.kicker[language]}
            </span>
          </div>
          <div className="flex flex-col justify-center px-6 py-7 sm:px-8 sm:py-10 lg:px-10">
            <h2 className="text-3xl font-extrabold leading-[1.12] tracking-tight text-slate-950 sm:text-4xl">
              {title}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
              {article.description[language]}
            </p>
            <div className="mt-7 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                {minutesLabel(article.minutes, minuteUnit)}
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0088d4]">
                {readLabel}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
              </span>
            </div>
          </div>
        </article>
      </Link>
    );
  }

  return (
    <Link href={blogPostPath(language, article.id)} className="group block h-full">
      <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_36px_-28px_rgba(15,23,42,0.4)] transition-shadow hover:shadow-[0_22px_40px_-24px_rgba(0,165,253,0.45)]">
        <div className="relative aspect-[16/10] overflow-hidden">
          <Cover
            id={article.id}
            alt={title}
            className="transition duration-500 group-hover:scale-[1.04]"
          />
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#0088d4]">
            {article.kicker[language]}
          </span>
        </div>
        <div className="flex flex-1 flex-col px-4 py-4 sm:px-5 sm:py-5">
          <h2 className="text-lg font-extrabold leading-snug tracking-tight text-slate-950">
            {title}
          </h2>
          <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-600">
            {article.description[language]}
          </p>
          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
              <Clock className="h-3.5 w-3.5" />
              {minutesLabel(article.minutes, minuteUnit)}
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-[#0088d4]">
              {readLabel}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

export function BlogIndexPage(_props: { params: { lang: string } }) {
  const { t, language } = useTranslation();
  const lang = language as Language;
  const [featured, ...rest] = BLOG_ARTICLES;

  return (
    <div className="bg-[#f4f8fb] text-slate-950">
      <section className="px-4 pb-6 pt-10 md:pb-8 md:pt-14">
        <EnterReveal className="mx-auto max-w-6xl">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#0088d4]">
            {t("blog_kicker")}
          </p>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <h1 className="max-w-2xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              {t("blog_title")}
            </h1>
            <p className="max-w-md text-base leading-relaxed text-slate-600">
              {t("blog_intro")}
            </p>
          </div>
        </EnterReveal>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        {featured ? (
          <ArticleCard
            article={featured}
            language={lang}
            readLabel={t("blog_read")}
            minuteUnit={t("blog_min")}
            featured
          />
        ) : null}
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((article, index) => (
            <EnterReveal key={article.id} inView delay={Math.min(index * 0.03, 0.12)} y={12}>
            <ArticleCard
              article={article}
              language={lang}
              readLabel={t("blog_read")}
              minuteUnit={t("blog_min")}
            />
            </EnterReveal>
          ))}
        </div>
      </section>
    </div>
  );
}

export function BlogArticlePage({ params }: { params: { lang: string; article?: string } }) {
  const articleSlug = params.article ?? "";
  const { t, language } = useTranslation();
  const lang = language as Language;
  const article = BLOG_ARTICLES.find((item) =>
    Object.values(item.slug).some((slug) => slug.toLowerCase() === articleSlug.toLowerCase()),
  );

  if (!article) {
    return (
      <div className="mx-auto max-w-3xl bg-[#f4f8fb] px-4 py-16 text-slate-950">
        <Link
          href={pathFor(lang, "blog")}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#0088d4]"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t("blog_back")}
        </Link>
        <h1 className="mt-6 text-2xl font-extrabold">{t("blog_missing")}</h1>
      </div>
    );
  }

  const index = BLOG_ARTICLES.findIndex((item) => item.id === article.id);
  const related = [1, 2, 3]
    .map((step) => BLOG_ARTICLES[(index + step) % BLOG_ARTICLES.length])
    .filter((item): item is BlogArticle => Boolean(item) && item.id !== article.id);

  return (
    <div className="bg-[#f4f8fb] text-slate-950">
      <div className="mx-auto max-w-6xl px-4 pt-6">
        <Link
          href={pathFor(lang, "blog")}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#0088d4] hover:text-[#006eaf]"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t("blog_back")}
        </Link>
      </div>

      <article className="mx-auto max-w-6xl px-4 pb-10 pt-4">
        <div className="relative overflow-hidden rounded-[1.6rem] bg-slate-900 shadow-[0_28px_60px_-36px_rgba(15,23,42,0.55)]">
          <div className="h-72 sm:h-96 md:h-[32rem]">
            <Cover id={article.id} alt={article.title[lang]} className="blog-hero-photo object-[center_42%]" />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/15 to-slate-950/10" />
          <div className="absolute inset-x-0 bottom-0 px-5 pb-6 sm:px-8 sm:pb-8 md:px-10 md:pb-10">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#7dd3fc]">
              {article.kicker[lang]}
            </p>
            <h1 className="mt-2 max-w-3xl text-3xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-4xl md:text-5xl">
              {article.title[lang]}
            </h1>
            <p className="mt-4 inline-flex items-center gap-1.5 font-mono text-[11px] text-white/80">
              <Clock className="h-3.5 w-3.5" />
              {minutesLabel(article.minutes, t("blog_min"))}
            </p>
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-3xl">
          <p className="text-xl leading-relaxed text-slate-700 sm:text-[1.35rem]">
            {article.description[lang]}
          </p>
          <BlogDemo id={article.id} lang={lang} />
          <div className="mt-10 space-y-8">
            {article.sections.map((section, sectionIndex) => (
              <EnterReveal key={section.h.en} inView delay={Math.min(sectionIndex * 0.04, 0.12)} y={14}>
              <section className="rounded-2xl border border-slate-200 bg-white px-5 py-6 sm:px-7 sm:py-7">
                <p className="font-mono text-[11px] font-bold text-[#0088d4]">
                  {String(sectionIndex + 1).padStart(2, "0")}
                </p>
                <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950">{section.h[lang]}</h2>
                {section.figure ? (
                  <img
                    src={section.figure}
                    alt={section.h[lang]}
                    loading="lazy"
                    className="mt-4 aspect-[16/10] w-full rounded-xl object-cover"
                  />
                ) : null}
                <p className="mt-3 text-[15px] leading-7 text-slate-700 sm:text-base">{section.p[lang]}</p>
              </section>
              </EnterReveal>
            ))}
          </div>
          <nav className="mt-8 flex flex-wrap gap-2" aria-label={t("nav_blog")}>
            <Link
              href={pathFor(lang, "pricing")}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:border-[#00a5fd] hover:text-[#0088d4]"
            >
              {t("pricing")}
            </Link>
            <Link
              href={pathFor(lang, "how_it_works")}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:border-[#00a5fd] hover:text-[#0088d4]"
            >
              {t("how_it_works")}
            </Link>
            <Link
              href={pathFor(lang, "faq")}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:border-[#00a5fd] hover:text-[#0088d4]"
            >
              {t("nav_faq")}
            </Link>
          </nav>
        </div>
      </article>

      <section className="mx-auto max-w-3xl px-4 pb-14">
        <div className="overflow-hidden rounded-[1.6rem] bg-[#073454] px-6 py-7 text-white sm:px-8 sm:py-8">
          <h2 className="text-2xl font-extrabold tracking-tight">{t("blog_cta_title")}</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
            {t("blog_cta_text")}
          </p>
          <Button asChild className="mt-5 h-11 rounded-xl bg-[#00a5fd] px-5 text-white hover:bg-[#33bbfd]">
            <Link href={`/${language}#check-vin`}>{t("check_vin")}</Link>
          </Button>
        </div>
      </section>

      <section className="border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="mb-5 text-2xl font-extrabold tracking-tight">{t("blog_related")}</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <ArticleCard
                key={item.id}
                article={item}
                language={lang}
                readLabel={t("blog_read")}
                minuteUnit={t("blog_min")}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
