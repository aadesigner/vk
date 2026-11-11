/**
 * Redact / sanitize Carstat USA report payloads for customer delivery.
 * Never expose upstream PDF/HTML URLs to the browser; strip provider branding where possible.
 */

const PROVIDER_HOST_RE =
  /(?:^|\.)(?:carfax\.com|carfax\.io|carfaxonline\.com|carstat\.dev|import-motor\.com|report-cars\.b-cdn\.net|b-cdn\.net|reportdelivery\.production\.aws\.carfax\.io|vhrjs\.s3\.|storage\.beget\.cloud)$/i;

/** Hosts we will fetch for HTML/PDF proxy (SSRF allowlist). */
const ALLOWED_REPORT_HOST_SUFFIXES = [
  "report-cars.b-cdn.net",
  "b-cdn.net",
  "carstat.dev",
  "api.carstat.dev",
];

export function assertAllowedUsaReportUrl(url: string): URL {
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

export type ClientUsaPdfReport = {
  type: string;
  vehicle: string | null;
  fetchedAt: string | null;
  hasPdf: boolean;
  hasHtml: boolean;
  /** Always null for clients — use /pdf-proxy or /html-proxy. */
  pdfUrl: null;
  htmlUrl: null;
};

/** Strip upstream URLs from lookup data before sending to the browser. */
export function redactCarstatUsaDataForClient(
  data: Record<string, unknown>,
): Record<string, unknown> {
  if (data.dataSource !== "carstat_usa") return data;
  const pr = data.pdfReport;
  if (!pr || typeof pr !== "object" || Array.isArray(pr)) return data;
  const p = pr as Record<string, unknown>;
  const pdfUrl = typeof p.pdfUrl === "string" ? p.pdfUrl.trim() : "";
  const htmlUrl = typeof p.htmlUrl === "string" ? p.htmlUrl.trim() : "";
  const redacted: ClientUsaPdfReport = {
    type: typeof p.type === "string" ? p.type : "carfax",
    vehicle: typeof p.vehicle === "string" ? p.vehicle : null,
    fetchedAt: typeof p.fetchedAt === "string" ? p.fetchedAt : null,
    hasPdf: !!pdfUrl,
    hasHtml: !!htmlUrl,
    pdfUrl: null,
    htmlUrl: null,
  };
  return { ...data, pdfReport: redacted };
}

const BRAND_HIDE_CSS = `
<style id="km-usa-brand-hide">
  img[alt*="CARFAX" i],
  img[alt*="Carfax" i],
  img[alt*="AutoCheck" i],
  img[src*="CarfaxLogo" i],
  img[src*="carfax" i],
  img[src*="Carfox" i],
  img[src*="carfox" i],
  img[src*="car-fox" i],
  img[src*="autocheck" i],
  img[src*="carstat" i],
  img.section-header-logo,
  img.advantage-dealer-logo,
  img.headerRowIcon,
  #summary-section-title-logo,
  .about-carfax,
  .facebook-link,
  .twitter-link,
  .desktop-damage-detail-full-fox,
  .mobile-damage-detail-fox,
  .detail-record-xperts-fox,
  a[href*="carfax" i],
  a[href*="carstat" i],
  a[href*="autocheck" i],
  a[href*="carfaxonline" i] {
    display: none !important;
    visibility: hidden !important;
    width: 0 !important;
    height: 0 !important;
    overflow: hidden !important;
  }
</style>
`;

const BRAND_GUARD_JS = `
<script id="km-usa-brand-guard">
(function () {
  function isProviderUrl(href) {
    if (!href) return false;
    try {
      var u = new URL(href, window.location.href);
      if (u.protocol !== "http:" && u.protocol !== "https:") return false;
      return /carfax|carstat|autocheck|import-motor|report-cars|b-cdn\\.net|reportdelivery/i.test(u.hostname + u.pathname);
    } catch (e) {
      return /carfax|carstat|autocheck/i.test(String(href));
    }
  }
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a") : null;
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (isProviderUrl(href) || /^https?:/i.test(href)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
  document.addEventListener("auxclick", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a") : null;
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
  }, true);
})();
</script>
`;

/** Fetch-ready HTML: hide brand marks, neutralize outbound provider links, generic title. */
export function sanitizeUsaReportHtml(html: string): string {
  let out = html;

  out = out.replace(/<title[^>]*>[\s\S]*?<\/title>/i, "<title>Vehicle history report</title>");

  // Provider HTML often ships CSP / XFO metas → Chrome "This content is blocked" inside our iframe.
  out = out.replace(
    /<meta\b[^>]*\bhttp-equiv\s*=\s*["']?(?:Content-Security-Policy|X-Frame-Options)["']?[^>]*>/gi,
    "",
  );

  // Neutralize navigation <a href> only — never rewrite script/link/img asset URLs or the report blanks out.
  out = out.replace(
    /(<a\b[^>]*\bhref\s*=\s*)(["'])(https?:\/\/[^"']+)\2/gi,
    (full, prefix: string, quote: string, href: string) => {
      try {
        const host = new URL(href).hostname.toLowerCase();
        if (PROVIDER_HOST_RE.test(host) || /carfax|carstat|autocheck/i.test(href)) {
          return `${prefix}${quote}#${quote} rel="nofollow noopener" onclick="return false;"`;
        }
      } catch {
        /* keep */
      }
      // Block any remaining absolute navigation from the framed report.
      if (/^https?:\/\//i.test(href)) {
        return `${prefix}${quote}#${quote} rel="nofollow noopener" onclick="return false;"`;
      }
      return full;
    },
  );

  if (/<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, `${BRAND_HIDE_CSS}${BRAND_GUARD_JS}</head>`);
  } else {
    out = `${BRAND_HIDE_CSS}${BRAND_GUARD_JS}${out}`;
  }

  return out;
}

export function isProviderReportHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_REPORT_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}
