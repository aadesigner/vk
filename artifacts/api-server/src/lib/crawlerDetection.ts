/** Common search/social/preview crawlers — never apply client geo language redirects for these. */
const CRAWLER_RE = /bot|crawl|spider|slurp|mediapartners|facebookexternalhit|whatsapp|telegram|discord|linkedin|pinterest|preview|archiver|wget|curl|python-requests|go-http-client|semrush|ahrefs|mj12bot|petalbot|applebot|bingpreview|yandex|baidu|duckduck/i;

export function isCrawlerUserAgent(userAgent: string | undefined | null): boolean {
  if (!userAgent || typeof userAgent !== "string") return false;
  return CRAWLER_RE.test(userAgent);
}
