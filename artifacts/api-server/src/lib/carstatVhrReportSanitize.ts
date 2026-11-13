/**
 * Redact / sanitize Carstat VHR report payloads for customer delivery.
 * Never expose upstream HTML/JSON URLs to the browser.
 */

/** Hosts we will fetch for HTML proxy (SSRF allowlist). Exact CDN + carstat only. */
const ALLOWED_REPORT_HOST_SUFFIXES = [
  "v-h-r.b-cdn.net",
  "carstat.dev",
  "api.carstat.dev",
];

export function assertAllowedVhrReportUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid report URL");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Report URL must be HTTPS");
  }
  const host = parsed.hostname.toLowerCase();
  const ok = ALLOWED_REPORT_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
  if (!ok) {
    throw new Error(`Report host not allowed: ${host}`);
  }
  return parsed;
}

/** Neutral customer-facing labels — never expose Carstat product/source marketing names. */
export function publicVhrSourceLabel(sourceId: number): string {
  switch (sourceId) {
    case 1:
      return "Auction history";
    case 2:
    case 3:
      return "Listing archive";
    case 4:
      return "Inspection";
    case 5:
      return "Vehicle history";
    case 68:
      return "Insurance history";
    default:
      return "History report";
  }
}

export type ClientVhrReport = {
  sourceId: number;
  sourceName: string;
  fetchedAt: string | null;
  hasHtml: boolean;
  hasJson: boolean;
  htmlUrl: null;
  jsonUrl: null;
};

function redactOne(pr: Record<string, unknown>): ClientVhrReport {
  const htmlUrl = typeof pr.htmlUrl === "string" ? pr.htmlUrl.trim() : "";
  const jsonUrl = typeof pr.jsonUrl === "string" ? pr.jsonUrl.trim() : "";
  const sourceId = typeof pr.sourceId === "number" ? pr.sourceId : Number(pr.sourceId) || 0;
  return {
    sourceId,
    sourceName: publicVhrSourceLabel(sourceId),
    fetchedAt: typeof pr.fetchedAt === "string" ? pr.fetchedAt : null,
    hasHtml: !!htmlUrl,
    hasJson: !!jsonUrl,
    htmlUrl: null,
    jsonUrl: null,
  };
}

/** Strip upstream URLs from lookup data before sending to the browser. */
export function redactCarstatVhrDataForClient(
  data: Record<string, unknown>,
): Record<string, unknown> {
  if (data.dataSource !== "carstat_vhr") return data;
  const reports = Array.isArray(data.vhrReports) ? data.vhrReports : null;
  const redactedList = reports
    ? reports
      .filter((r): r is Record<string, unknown> => !!r && typeof r === "object" && !Array.isArray(r))
      .map(redactOne)
    : [];
  const primary = data.vhrReport;
  const redactedPrimary =
    primary && typeof primary === "object" && !Array.isArray(primary)
      ? redactOne(primary as Record<string, unknown>)
      : redactedList[0] ?? null;
  return {
    ...data,
    vhrReports: redactedList,
    vhrReport: redactedPrimary,
  };
}

const BRAND_HIDE_CSS = `
<style id="km-vhr-brand-hide">
  a[href*="carstat.dev" i],
  a[href*="v-h-r.b-cdn.net" i],
  img[alt*="Carstat" i],
  img[src*="carstat" i] {
    opacity: 0 !important;
    pointer-events: none !important;
    max-height: 0 !important;
    overflow: hidden !important;
  }
</style>
`;

const BRAND_HIDE_JS = `
<script id="km-vhr-brand-hide-js">
(function () {
  try {
    document.querySelectorAll('a[href*="carstat"]').forEach(function (el) {
      el.removeAttribute("href");
    });
  } catch (e) {}
})();
</script>
`;

/** Light sanitize: strip provider brand links + inject brand-hide CSS/JS. */
export function sanitizeVhrReportHtml(rawHtml: string): string {
  let html = String(rawHtml || "");
  if (!html.trim()) return html;
  // Neutralize outbound provider URLs so customers cannot click through to Carstat/CDN.
  html = html.replace(
    /\b(href|src)\s*=\s*(["'])([^"']*(?:carstat\.dev|v-h-r\.b-cdn\.net)[^"']*)\2/gi,
    '$1=$2#$2',
  );
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${BRAND_HIDE_CSS}</head>`);
  }
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${BRAND_HIDE_CSS}${BRAND_HIDE_JS}</body>`);
  }
  return `${BRAND_HIDE_CSS}${html}${BRAND_HIDE_JS}`;
}
