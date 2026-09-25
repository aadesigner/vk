/**
 * VIN page SSR body injection — mirrors @workspace/vin-page-seo for Node scripts.
 */
import { vinSeoFromRest } from "./seo-inject.mjs";

const NAV = {
  en: { home: "Check VIN", pricing: "Pricing", howItWorks: "How it works", freeDecoder: "Free VIN Decoder", faq: "FAQ" },
  de: { home: "VIN prüfen", pricing: "Preise", howItWorks: "So funktioniert's", freeDecoder: "Kostenloser VIN-Decoder", faq: "Häufig gestellte Fragen" },
  es: { home: "Consultar VIN", pricing: "Precios", howItWorks: "Cómo funciona", freeDecoder: "Decodificador VIN gratis", faq: "Preguntas frecuentes" },
  fr: { home: "Vérifier le VIN", pricing: "Tarifs", howItWorks: "Comment ça marche", freeDecoder: "Décodeur VIN gratuit", faq: "FAQ" },
  sq: { home: "Kontrollo VIN", pricing: "Çmimet", howItWorks: "Si funksionon", freeDecoder: "Dekoder VIN falas", faq: "Pyetje të shpeshta" },
  pl: { home: "Sprawdź VIN", pricing: "Cennik", howItWorks: "Jak to działa", freeDecoder: "Darmowy dekoder VIN", faq: "FAQ" },
  ro: { home: "Verifică VIN", pricing: "Prețuri", howItWorks: "Cum funcționează", freeDecoder: "Decoder VIN gratuit", faq: "Întrebări frecvente" },
  bg: { home: "Провери VIN", pricing: "Цени", howItWorks: "Как работи", freeDecoder: "Безплатен VIN декодер", faq: "ЧЗВ" },
  ka: { home: "VIN შემოწმება", pricing: "ფასები", howItWorks: "როგორ მუშაობს", freeDecoder: "უფასო VIN დეკoderi", faq: "FAQ" },
  ar: { home: "تحقق من VIN", pricing: "الأسعار", howItWorks: "كيف يعمل", freeDecoder: "فك تشفير VIN مجاني", faq: "الأسئلة الشائعة" },
  uk: { home: "Перевірити VIN", pricing: "Ціни", howItWorks: "Як це працює", freeDecoder: "Безкоштовний VIN-декодер", faq: "FAQ" },
  ru: { home: "Проверить VIN", pricing: "Цены", howItWorks: "Как это работает", freeDecoder: "Бесплатный VIN-декодер", faq: "FAQ" },
  zh: { home: "查询 VIN", pricing: "价格", howItWorks: "如何运作", freeDecoder: "免费 VIN 解码", faq: "常见问题" },
};

const VIN_LABEL = {
  en: "VIN", de: "FIN", es: "VIN", fr: "VIN", sq: "VIN", pl: "VIN", ro: "VIN", bg: "VIN", ka: "VIN", ar: "VIN", uk: "VIN", ru: "VIN", zh: "VIN",
};

const CTA = {
  en: "Unlock the full vehicle history report on verifykm.com.",
  de: "Vollständigen Fahrzeughistorienbericht auf verifykm.com freischalten.",
  es: "Desbloquee el informe completo del historial del vehículo en verifykm.com.",
  fr: "Débloquez le rapport historique complet sur verifykm.com.",
  sq: "Zhbllokoni raportin e plotë të historikut të automjetit në verifykm.com.",
  pl: "Odblokuj pełny raport historii pojazdu na verifykm.com.",
  ro: "Deblocați raportul complet al istoricului vehiculului pe verifykm.com.",
  bg: "Отключете пълния отчет за историята на автомобила на verifykm.com.",
  ka: "\u10D2\u10D0\u10E0\u10EB\u10D8\u10D7 \u10E1\u10E0\u10E3\u10DA\u10D8 \u10D0\u10DC\u10D2\u10D0\u10E0\u10D8\u10E8\u10D8 verifykm.com-\u10D6\u10D4.",
  ar: "افتح تقرير تاريخ المركبة الكامل على verifykm.com.",
  uk: "Відкрийте повний звіт історії авто на verifykm.com.",
  ru: "Откройте полный отчёт по истории авто на verifykm.com.",
  zh: "在 verifykm.com 解锁完整车辆历史报告。",
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

import { localizedPath } from "./localized-routes.mjs";

function buildNavLinks(lang) {
  const nav = NAV[lang] ?? NAV.en;
  return [
    { href: localizedPath(lang, ""), label: nav.home },
    { href: localizedPath(lang, "/pricing"), label: nav.pricing },
    { href: localizedPath(lang, "/how-it-works"), label: nav.howItWorks },
    { href: localizedPath(lang, "/faq"), label: nav.faq },
  ];
}

export function resolveVinSsrContent(rest, lang) {
  const seo = vinSeoFromRest(rest, lang);
  if (!seo?.title || !seo.description) return null;
  const m = rest.match(/^\/vin\/([A-HJ-NPR-Z0-9]{17})$/i);
  if (!m) return null;
  const vin = m[1].toUpperCase();
  return {
    heading: seo.title.replace(/\s*\|\s*verifykm\s*$/i, ""),
    vin,
    vinLabel: VIN_LABEL[lang] ?? VIN_LABEL.en,
    intro: seo.description,
    specs: [],
    cta: CTA[lang] ?? CTA.en,
    links: buildNavLinks(lang),
  };
}

function buildVinSsrStyleBlock() {
  return `<style id="verifykm-vin-ssr-style">
      #root{position:relative;z-index:1;min-height:100vh}
      #root .app-boot-shell{position:relative;z-index:1;min-height:100vh}
      .verifykm-vin-ssr{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
    </style>`;
}

function buildVinSsrBodyBlock(content) {
  const navLinks = (content.links ?? [])
    .filter((link) => link.href?.trim() && link.label?.trim())
    .map(
      (link) =>
        `          <li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`,
    )
    .join("\n");

  const navBlock = navLinks
    ? `        <nav aria-label="Site navigation">
          <ul>
${navLinks}
          </ul>
        </nav>`
    : "";

  return `<main id="verifykm-vin-ssr" class="verifykm-vin-ssr">
      <article>
        <h1>${escapeHtml(content.heading)}</h1>
        <p><strong>${escapeHtml(content.vinLabel)}:</strong> ${escapeHtml(content.vin)}</p>
        <p class="lead">${escapeHtml(content.intro)}</p>
${navBlock}
        <p>${escapeHtml(content.cta)}</p>
      </article>
    </main>`;
}

export function removeVinSsrFromHtml(html) {
  return html
    .replace(/\n?\s*<style id="verifykm-vin-ssr-style"[^>]*>[\s\S]*?<\/style>/g, "")
    .replace(/\n?\s*<main id="verifykm-vin-ssr"[\s\S]*?<\/main>/g, "");
}

export function injectVinSsrIntoHtml(html, content) {
  if (!content?.heading?.trim() || !content.intro?.trim()) return html;

  let out = removeVinSsrFromHtml(html);
  const bodyBlock = buildVinSsrBodyBlock(content);

  out = out.replace(
    /(<div id="root">[\s\S]*?<\/div>)(\s*<script type="module")/i,
    `$1\n    ${bodyBlock}$2`,
  );

  if (!out.includes('id="verifykm-vin-ssr-style"')) {
    out = out.replace(/<\/head>/i, `${buildVinSsrStyleBlock()}\n  </head>`);
  }

  return out;
}
