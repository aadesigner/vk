/**
 * Marketing page SSR body injection — mirrors @workspace/marketing-page-seo for Node scripts.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MARKETING_SSR_PAGE_KEYS } from "./marketing-ssr-keys.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));

let marketingSsrData = null;

function loadMarketingSsrData() {
  if (marketingSsrData) return marketingSsrData;
  marketingSsrData = JSON.parse(
    readFileSync(join(__dir, "../src/lib/marketing-ssr-data.json"), "utf8"),
  );
  return marketingSsrData;
}

function escapeMarketingHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function marketingSsrDataKey(pageKey, rest) {
  if (pageKey === "api_b2b") {
    if (!rest || rest === "/api-b2b") return "api_b2b";
    return `api_b2b${rest.replace(/^\/api-b2b/, "").replace(/\//g, "_")}`;
  }
  if (MARKETING_SSR_PAGE_KEYS.includes(pageKey)) return pageKey;
  return null;
}

export function resolveMarketingSsrContent(pageKey, rest, lang) {
  const data = loadMarketingSsrData();
  const key = marketingSsrDataKey(pageKey, rest);
  if (!key) return null;
  const page = data[key];
  if (!page) return null;
  const entry = page[lang] ?? page.en;
  if (!entry?.h1?.trim() || !entry.lead?.trim()) return null;
  return entry;
}

function buildMarketingSsrStyleBlock() {
  return `<style id="verifykm-page-ssr-style">
      #root{position:relative;z-index:1;min-height:100vh}
      #root .app-boot-shell{position:relative;z-index:1;min-height:100vh}
      .verifykm-page-ssr{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
    </style>`;
}

function buildMarketingSsrBodyBlock(content) {
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

  return `<main id="verifykm-page-ssr" class="verifykm-page-ssr">
      <article>
        <h1>${escapeMarketingHtml(content.h1)}</h1>
        <p class="lead">${escapeMarketingHtml(content.lead)}</p>
${navBlock}
${bulletBlock}
${sections}
      </article>
    </main>`;
}

export function removeMarketingSsrFromHtml(html) {
  return html
    .replace(/\n?\s*<style id="verifykm-page-ssr-style"[^>]*>[\s\S]*?<\/style>/g, "")
    .replace(/\n?\s*<main id="verifykm-page-ssr"[\s\S]*?<\/main>/g, "");
}

export function injectMarketingSsrIntoHtml(html, content) {
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
