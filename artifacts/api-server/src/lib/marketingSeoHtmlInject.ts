import type { MarketingSsrData } from "@workspace/marketing-page-seo";
import {
  injectMarketingMetaSeoIntoHtml,
  injectMarketingSsrIntoHtml,
  parseMarketingPath,
  resolveMarketingSsrContent,
} from "@workspace/marketing-page-seo";
import marketingSsrData from "@workspace/marketing-page-seo/marketing-ssr-data.json" with { type: "json" };

const data = marketingSsrData as MarketingSsrData;

/** Inject marketing H1/hero SSR body for indexable routes (fallback when prerender shell missing). */
export function injectMarketingPageSsrIntoHtml(
  html: string,
  pageKey: string,
  rest: string,
  lang: string,
): string {
  const content = resolveMarketingSsrContent(data, pageKey, rest, lang);
  if (!content) return html;
  return injectMarketingSsrIntoHtml(html, content);
}

export function injectMarketingPageSsrFromPath(html: string, reqPath: string): string {
  const parsed = parseMarketingPath(reqPath);
  if (!parsed) return html;
  return injectMarketingPageSsrIntoHtml(html, parsed.pageKey, parsed.rest, parsed.lang);
}

/** Localized title/meta for marketing routes when SPA fallback serves root index.html. */
export function injectMarketingPageMetaFromPath(
  html: string,
  reqPath: string,
  siteOrigin: string,
): string {
  return injectMarketingMetaSeoIntoHtml(html, reqPath, siteOrigin);
}

/** Meta tags + SSR body snapshot for crawlers and no-prerender fallback. */
export function injectMarketingPageSeoFromPath(
  html: string,
  reqPath: string,
  siteOrigin: string,
): string {
  let out = injectMarketingPageMetaFromPath(html, reqPath, siteOrigin);
  out = injectMarketingPageSsrFromPath(out, reqPath);
  return out;
}
