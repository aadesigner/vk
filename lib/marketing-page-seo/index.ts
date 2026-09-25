export type MarketingSsrSection = { title: string; body: string };

export type MarketingSsrLink = { href: string; label: string };

export type MarketingSsrContent = {
  h1: string;
  lead: string;
  bullets?: string[];
  sections?: MarketingSsrSection[];
  links?: MarketingSsrLink[];
};

/** Page keys with generated SSR body content (indexable marketing routes). */
export const MARKETING_SSR_PAGE_KEYS = [
  "home",
  "pricing",
  "free_decoder",
  "how_it_works",
  "faq",
  "country_usa",
  "country_korea",
  "country_canada",
  "country_china",
  "country_japan",
  "country_uae",
  "api_b2b",
] as const;

export type MarketingSsrPageKey = (typeof MARKETING_SSR_PAGE_KEYS)[number];

export type MarketingSsrData = Record<
  string,
  Partial<Record<string, MarketingSsrContent>>
>;

/** Map SPA pageKey + route rest to marketing-ssr-data.json bucket key. */
export function marketingSsrDataKey(pageKey: string, rest: string): string | null {
  if (pageKey === "api_b2b") {
    if (!rest || rest === "/api-b2b") return "api_b2b";
    return `api_b2b${rest.replace(/^\/api-b2b/, "").replace(/\//g, "_")}`;
  }
  if (MARKETING_SSR_PAGE_KEYS.includes(pageKey as MarketingSsrPageKey)) {
    return pageKey;
  }
  return null;
}

export function escapeMarketingHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Native labels for crawlable locale-home links in marketing SSR HTML. */
const SSR_LOCALE_HOME_LINKS: ReadonlyArray<{ code: string; label: string }> = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "sq", label: "Shqip" },
  { code: "pl", label: "Polski" },
  { code: "ro", label: "Română" },
  { code: "bg", label: "Български" },
  { code: "ka", label: "ქართული" },
  { code: "ar", label: "العربية" },
  { code: "uk", label: "Українська" },
  { code: "ru", label: "Русский" },
  { code: "zh", label: "中文" },
];

export function buildMarketingSsrStyleBlock(): string {
  return `<style id="verifykm-page-ssr-style">
      #root{position:relative;z-index:1;min-height:100vh}
      #root .app-boot-shell{position:relative;z-index:1;min-height:100vh}
      .verifykm-page-ssr{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
    </style>`;
}

export function buildMarketingSsrBodyBlock(content: MarketingSsrContent): string {
  const bullets = (content.bullets ?? [])
    .filter(Boolean)
    .map((item) => `          <li>${escapeMarketingHtml(item)}</li>`)
    .join("\n");

  const bulletBlock = bullets
    ? `        <ul>\n${bullets}\n        </ul>`
    : "";

  const sections = (content.sections ?? [])
    .filter((section) => section.title?.trim() && section.body?.trim())
    .map(
      (section) => `        <section>
          <h2>${escapeMarketingHtml(section.title)}</h2>
          <p>${escapeMarketingHtml(section.body)}</p>
        </section>`,
    )
    .join("\n");

  const navLinks = (content.links ?? [])
    .filter((link) => link.href?.trim() && link.label?.trim())
    .map(
      (link) =>
        `          <li><a href="${escapeMarketingHtml(link.href)}">${escapeMarketingHtml(link.label)}</a></li>`,
    )
    .join("\n");

  const navBlock = navLinks
    ? `        <nav aria-label="Site navigation">
          <ul>
${navLinks}
          </ul>
        </nav>`
    : "";

  const localeLinks = SSR_LOCALE_HOME_LINKS.map(
    ({ code, label }) =>
      `          <li><a href="/${code}">${escapeMarketingHtml(label)}</a></li>`,
  ).join("\n");

  const localeNavBlock = `        <nav aria-label="Languages">
          <ul>
${localeLinks}
          </ul>
        </nav>`;

  return `<main id="verifykm-page-ssr" class="verifykm-page-ssr">
      <article>
        <h1>${escapeMarketingHtml(content.h1)}</h1>
        <p class="lead">${escapeMarketingHtml(content.lead)}</p>
${navBlock}
${localeNavBlock}
${bulletBlock}
${sections}
      </article>
    </main>`;
}

export function removeMarketingSsrFromHtml(html: string): string {
  return html
    .replace(/\n?\s*<style id="verifykm-page-ssr-style"[^>]*>[\s\S]*?<\/style>/g, "")
    .replace(/\n?\s*<main id="verifykm-page-ssr"[\s\S]*?<\/main>/g, "");
}

export function injectMarketingSsrIntoHtml(
  html: string,
  content: MarketingSsrContent | null | undefined,
): string {
  if (!content?.h1?.trim() || !content.lead?.trim()) return html;

  let out = removeMarketingSsrFromHtml(html);
  const bodyBlock = buildMarketingSsrBodyBlock(content);

  out = out.replace(
    /(<div id="root">[\s\S]*?<\/div>)(\s*<script type="module")/i,
    `$1\n    ${bodyBlock}$2`,
  );

  if (!out.includes('id="verifykm-page-ssr-style"')) {
    out = out.replace(/<\/head>/i, `${buildMarketingSsrStyleBlock()}\n  </head>`);
  }

  return out;
}

export {
  injectMarketingMetaSeoIntoHtml,
  parseMarketingPath,
  resolveMarketingMetaSeo,
  type MarketingMetaSeo,
} from "./marketing-meta-seo";

export function resolveMarketingSsrContent(
  data: MarketingSsrData,
  pageKey: string,
  rest: string,
  lang: string,
): MarketingSsrContent | null {
  const key = marketingSsrDataKey(pageKey, rest);
  if (!key) return null;
  const page = data[key];
  if (!page) return null;
  const entry = page[lang] ?? page.en;
  if (!entry?.h1?.trim() || !entry.lead?.trim()) return null;
  return entry;
}
