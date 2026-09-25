/** Shared VIN report page SEO — titles, descriptions, JSON-LD, URL parsing. */

export const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/i;

export const VIN_SEO_LANGS = ["en", "de", "es", "fr", "sq", "pl", "ro", "bg", "ka", "ar", "uk", "ru", "zh"] as const;
export type VinSeoLang = (typeof VIN_SEO_LANGS)[number];

export type VinSeoVehicle = {
  vin: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  trim?: string | null;
  engine?: string | null;
  transmission?: string | null;
  color?: string | null;
  country?: string | null;
  bodyType?: string | null;
  fuelType?: string | null;
  thumbnailUrl?: string | null;
};

export function normalizeVin(vin: string): string {
  return String(vin ?? "").trim().toUpperCase();
}

export function isValidVin(vin: string): boolean {
  return VIN_RE.test(normalizeVin(vin));
}

/** Path after lang prefix, e.g. `/vin/WBA…` or `/vin/processing`. */
export function isIndexableVinRest(rest: string): boolean {
  const m = rest.match(/^\/vin\/([^/]+)$/);
  if (!m) return false;
  const segment = m[1]!.toLowerCase();
  if (segment === "processing") return false;
  return isValidVin(segment);
}

export function parseVinPagePath(pathname: string): { lang: VinSeoLang; vin: string; rest: string } | null {
  const path = pathname.split("?")[0]!.replace(/\/$/, "") || "/";
  const m = path.match(/^\/(en|de|es|fr|sq|pl|ro|bg|ka|ar|uk|ru|zh)(\/vin\/([A-HJ-NPR-Z0-9]{17}))$/i);
  if (!m?.[3]) return null;
  const vin = normalizeVin(m[3]);
  if (!isValidVin(vin)) return null;
  return { lang: m[1] as VinSeoLang, vin, rest: `/vin/${vin}` };
}

export function buildVehicleTitle(v: VinSeoVehicle): string {
  const vin = normalizeVin(v.vin);
  if (v.make) {
    return [v.year ? String(v.year) : null, v.make, v.model ?? null].filter(Boolean).join(" ");
  }
  return `VIN ${vin}`;
}

export function vehicleHasIdentity(v: VinSeoVehicle): boolean {
  return !!v.make;
}

function specSnippet(v: VinSeoVehicle): string {
  const parts: string[] = [];
  if (v.trim) parts.push(v.trim);
  if (v.engine) parts.push(v.engine);
  if (v.transmission) parts.push(v.transmission);
  if (v.bodyType) parts.push(v.bodyType);
  if (v.fuelType) parts.push(v.fuelType);
  if (v.color) parts.push(v.color);
  return parts.slice(0, 3).join(" · ");
}

type TitleFn = (vehicle: string, vin: string) => string;
type DescFn = (vehicle: string, vin: string, specs: string) => string;

const TITLES: Record<VinSeoLang, TitleFn> = {
  en: (vehicle, vin) => `${vehicle} — ${vin}`,
  de: (vehicle, vin) => `${vehicle} — ${vin}`,
  es: (vehicle, vin) => `${vehicle} — ${vin}`,
  fr: (vehicle, vin) => `${vehicle} — ${vin}`,
  ar: (vehicle, vin) => `${vehicle} — ${vin}`,
  uk: (vehicle, vin) => `${vehicle} — ${vin}`,
  ru: (vehicle, vin) => `${vehicle} — ${vin}`,
  ro: (vehicle, vin) => `${vehicle} — ${vin}`,
  pl: (vehicle, vin) => `${vehicle} — ${vin}`,
  ka: (vehicle, vin) => `${vehicle} — ${vin}`,
  bg: (vehicle, vin) => `${vehicle} — ${vin}`,
  sq: (vehicle, vin) => `${vehicle} — ${vin}`,
  zh: (vehicle, vin) => `${vehicle} — ${vin}`,
};

const VIN_ONLY_TITLES: Record<VinSeoLang, (vin: string) => string> = {
  en: (vin) => `VIN ${vin} — Vehicle History Report | verifykm`,
  de: (vin) => `VIN ${vin} — Fahrzeughistorienbericht | verifykm`,
  es: (vin) => `VIN ${vin} — Informe historial del vehículo | verifykm`,
  fr: (vin) => `VIN ${vin} — Rapport historique véhicule | verifykm`,
  ar: (vin) => `VIN ${vin} — تقرير تاريخ المركبة | verifykm`,
  uk: (vin) => `VIN ${vin} — звіт історії авто | verifykm`,
  ru: (vin) => `VIN ${vin} — отчёт по истории авто | verifykm`,
  ro: (vin) => `VIN ${vin} — raport istoric vehicul | verifykm`,
  pl: (vin) => `VIN ${vin} — raport historii pojazdu | verifykm`,
  ka: (vin) => `VIN ${vin} — \u10D0\u10D5\u10E2\u10DD\u10DB\u10DD\u10D1\u10D8\u10DA\u10D8\u10E1 \u10D8\u10E1\u10E2\u10DD\u10E0\u10D8\u10D8\u10E1 \u10D0\u10DC\u10D2\u10D0\u10E0\u10D8\u10E8\u10D8 | verifykm`,
  bg: (vin) => `VIN ${vin} — отчет за история на автомобил | verifykm`,
  sq: (vin) => `VIN ${vin} — raport historiku automjeti | verifykm`,
  zh: (vin) => `VIN ${vin} — 车辆历史报告 | verifykm`,
};

const LOCKED_DESCRIPTIONS: Record<VinSeoLang, DescFn> = {
  en: (vehicle, vin, specs) => {
    const specsPart = specs ? ` ${specs}.` : "";
    return `Preview ${vehicle} VIN ${vin}. Basic specs are free — unlock the full report for mileage, accidents, ownership, insurance and auction history.${specsPart} verifykm.com.`;
  },
  de: (vehicle, vin, specs) => {
    const specsPart = specs ? ` ${specs}.` : "";
    return `Vorschau ${vehicle} VIN ${vin}. Basisdaten gratis — Vollbericht für Kilometerstand, Unfälle, Halter, Versicherung und Auktionen freischalten.${specsPart} verifykm.com.`;
  },
  es: (vehicle, vin, specs) => {
    const specsPart = specs ? ` ${specs}.` : "";
    return `Vista previa de ${vehicle} VIN ${vin}. Especificaciones básicas gratis — desbloquee el informe completo de kilometraje, accidentes, propietarios, seguro y subastas.${specsPart} verifykm.com.`;
  },
  fr: (vehicle, vin, specs) => {
    const specsPart = specs ? ` ${specs}.` : "";
    return `Aperçu de ${vehicle} VIN ${vin}. Spécifications de base gratuites — débloquez le rapport complet : kilométrage, accidents, propriétaires, assurance et enchères.${specsPart} verifykm.com.`;
  },
  ar: (vehicle, vin, specs) => {
    const specsPart = specs ? ` ${specs}.` : "";
    return `معاينة ${vehicle} VIN ${vin}. المواصفات الأساسية مجانية — افتح التقرير الكامل للمسافة المقطوعة والحوادث والملكية والتأمين والمزادات.${specsPart} verifykm.com.`;
  },
  uk: (vehicle, vin, specs) => {
    const specsPart = specs ? ` ${specs}.` : "";
    return `Попередній перегляд ${vehicle} VIN ${vin}. Базові дані безкоштовно — відкрийте повний звіт про пробіг, ДТП, власників, страхування та аукціони.${specsPart} verifykm.com.`;
  },
  ru: (vehicle, vin, specs) => {
    const specsPart = specs ? ` ${specs}.` : "";
    return `Предпросмотр ${vehicle} VIN ${vin}. Базовые данные бесплатно — откройте полный отчёт о пробеге, ДТП, владельцах, страховании и аукционах.${specsPart} verifykm.com.`;
  },
  ro: (vehicle, vin, specs) => {
    const specsPart = specs ? ` ${specs}.` : "";
    return `Previzualizare ${vehicle} VIN ${vin}. Specificații de bază gratuite — deblocați raportul complet pentru kilometraj, accidente, proprietari, asigurare și licitații.${specsPart} verifykm.com.`;
  },
  pl: (vehicle, vin, specs) => {
    const specsPart = specs ? ` ${specs}.` : "";
    return `Podgląd ${vehicle} VIN ${vin}. Podstawowe dane gratis — odblokuj pełny raport przebiegu, wypadków, właścicieli, ubezpieczenia i aukcji.${specsPart} verifykm.com.`;
  },
  ka: (vehicle, vin, specs) => {
    const specsPart = specs ? ` ${specs}.` : "";
    return `\u10EC\u10D8\u10DC\u10D0\u10E1\u10EC\u10D0\u10E0\u10D8 ${vehicle} VIN ${vin}. \u10E1\u10D0\u10D1\u10D6\u10D8\u10E1 \u10DB\u10DD\u10DC\u10D0\u10EA\u10D4\u10DB\u10DA\u10DD\u10D1\u10D0 \u10E3\u10D0\u10D1\u10DA\u10DD \u2014 \u10D2\u10D0\u10E0\u10D1\u10D4\u10D6\u10D8, \u10D0\u10D5\u10D0\u10E0\u10D8\u10D4\u10D1\u10D8, \u10DB\u10E4\u10DA\u10DD\u10D1\u10D4\u10DA\u10D7\u10D0 \u10D3\u10D0 \u10D3\u10D0\u10D6\u10E6\u10D5\u10D4\u10D5\u10D0 \u10D8\u10E1\u10D7\u10DD\u10E0\u10D8\u10D8\u10E1 \u10E1\u10E0\u10E3\u10DA\u10D8 \u10D0\u10DC\u10D2\u10D0\u10E0\u10D8\u10E8\u10D8\u10E1 \u10D2\u10D0\u10E0\u10EB\u10DB\u10DD\u10D5\u10D7.${specsPart} verifykm.com.`;
  },
  bg: (vehicle, vin, specs) => {
    const specsPart = specs ? ` ${specs}.` : "";
    return `Преглед на ${vehicle} VIN ${vin}. Основни данни безплатно — отключете пълния отчет за пробег, катастрофи, собственици, застраховка и търгове.${specsPart} verifykm.com.`;
  },
  sq: (vehicle, vin, specs) => {
    const specsPart = specs ? ` ${specs}.` : "";
    return `Parapamje e ${vehicle} VIN ${vin}. Specifikimet bazë falas — zhbllokoni raportin e plotë për kilometrazhin, aksidentet, pronarët, sigurimin dhe ankandet.${specsPart} verifykm.com.`;
  },
  zh: (vehicle, vin, specs) => {
    const specsPart = specs ? ` ${specs}.` : "";
    return `预览 ${vehicle} VIN ${vin}。基础信息免费 — 解锁完整报告可查看里程、事故、车主、保险与拍卖记录。${specsPart} verifykm.com.`;
  },
};

const LOCKED_VIN_ONLY_DESCRIPTIONS: Record<VinSeoLang, (vin: string) => string> = {
  en: (vin) => `Preview VIN ${vin} on verifykm.com — unlock the full vehicle history report.`,
  de: (vin) => `VIN ${vin} Vorschau auf verifykm.com — Vollbericht zur Fahrzeughistorie freischalten.`,
  es: (vin) => `Vista previa del VIN ${vin} en verifykm.com — desbloquee el informe completo del vehículo.`,
  fr: (vin) => `Aperçu du VIN ${vin} sur verifykm.com — débloquez le rapport historique complet.`,
  ar: (vin) => `معاينة VIN ${vin} على verifykm.com — افتح تقرير تاريخ المركبة الكامل.`,
  uk: (vin) => `Попередній перегляд VIN ${vin} на verifykm.com — відкрийте повний звіт історії авто.`,
  ru: (vin) => `Предпросмотр VIN ${vin} на verifykm.com — откройте полный отчёт по истории авто.`,
  ro: (vin) => `Previzualizare VIN ${vin} pe verifykm.com — deblocați raportul complet al vehiculului.`,
  pl: (vin) => `Podgląd VIN ${vin} na verifykm.com — odblokuj pełny raport historii pojazdu.`,
  ka: (vin) => `VIN ${vin} \u10EC\u10D8\u10DC\u10D0\u10E1\u10EC\u10D0\u10E0\u10D8 verifykm.com-\u10D6\u10D4 \u2014 \u10E1\u10E0\u10E3\u10DA\u10D8 \u10D0\u10DC\u10D2\u10D0\u10E0\u10D8\u10E8\u10D8\u10E1 \u10D2\u10D0\u10E0\u10EB\u10DB\u10DD\u10D5\u10D7.`,
  bg: (vin) => `Преглед на VIN ${vin} в verifykm.com — отключете пълния отчет за историята на автомобила.`,
  sq: (vin) => `Parapamje VIN ${vin} në verifykm.com — zhbllokoni raportin e plotë të historikut.`,
  zh: (vin) => `在 verifykm.com 预览 VIN ${vin} — 解锁完整车辆历史报告。`,
};

type SsrLabels = {
  vin: string;
  make: string;
  model: string;
  year: string;
  engine: string;
  transmission: string;
  color: string;
  country: string;
  intro: string;
  cta: string;
};

const SSR_LABELS: Record<VinSeoLang, SsrLabels> = {
  en: {
    vin: "VIN",
    make: "Make",
    model: "Model",
    year: "Year",
    engine: "Engine",
    transmission: "Transmission",
    color: "Color",
    country: "Country",
    intro: "Free preview of {vehicle} with basic specifications. Unlock the full report for mileage, accidents, ownership changes, insurance claims, and auction records.",
    cta: "Unlock the full vehicle history report on verifykm.com.",
  },
  de: {
    vin: "FIN",
    make: "Marke",
    model: "Modell",
    year: "Baujahr",
    engine: "Motor",
    transmission: "Getriebe",
    color: "Farbe",
    country: "Land",
    intro: "Kostenlose Vorschau von {vehicle} mit Basisdaten. Vollbericht für Kilometerstand, Unfälle, Halterwechsel, Versicherung und Auktionen freischalten.",
    cta: "Vollständigen Fahrzeughistorienbericht auf verifykm.com freischalten.",
  },
  es: {
    vin: "VIN",
    make: "Marca",
    model: "Modelo",
    year: "Año",
    engine: "Motor",
    transmission: "Transmisión",
    color: "Color",
    country: "País",
    intro: "Vista previa gratuita de {vehicle} con especificaciones básicas. Desbloquee el informe completo de kilometraje, accidentes, propietarios, seguros y subastas.",
    cta: "Desbloquee el informe completo del historial del vehículo en verifykm.com.",
  },
  fr: {
    vin: "VIN",
    make: "Marque",
    model: "Modèle",
    year: "Année",
    engine: "Moteur",
    transmission: "Transmission",
    color: "Couleur",
    country: "Pays",
    intro: "Aperçu gratuit de {vehicle} avec les spécifications de base. Débloquez le rapport complet : kilométrage, accidents, propriétaires, assurance et enchères.",
    cta: "Débloquez le rapport historique complet sur verifykm.com.",
  },
  ar: {
    vin: "VIN",
    make: "الشركة",
    model: "الطراز",
    year: "السنة",
    engine: "المحرك",
    transmission: "ناقل الحركة",
    color: "اللون",
    country: "البلد",
    intro: "معاينة مجانية لـ {vehicle} مع المواصفات الأساسية. افتح التقرير الكامل للمسافة المقطوعة والحوادث وتغييرات الملكية ومطالبات التأمين وسجلات المزادات.",
    cta: "افتح تقرير تاريخ المركبة الكامل على verifykm.com.",
  },
  uk: {
    vin: "VIN",
    make: "Марка",
    model: "Модель",
    year: "Рік",
    engine: "Двигун",
    transmission: "КПП",
    color: "Колір",
    country: "Країна",
    intro: "Безкоштовний перегляд {vehicle} з базовими даними. Відкрийте повний звіт про пробіг, ДТП, зміни власників, страхування та аукціони.",
    cta: "Відкрийте повний звіт історії авто на verifykm.com.",
  },
  ru: {
    vin: "VIN",
    make: "Марка",
    model: "Модель",
    year: "Год",
    engine: "Двигатель",
    transmission: "КПП",
    color: "Цвет",
    country: "Страна",
    intro: "Бесплатный предпросмотр {vehicle} с базовыми данными. Откройте полный отчёт о пробеге, ДТП, смене владельцев, страховании и аукционах.",
    cta: "Откройте полный отчёт по истории авто на verifykm.com.",
  },
  ro: {
    vin: "VIN",
    make: "Marcă",
    model: "Model",
    year: "An",
    engine: "Motor",
    transmission: "Transmisie",
    color: "Culoare",
    country: "Țară",
    intro: "Previzualizare gratuită pentru {vehicle} cu specificații de bază. Deblocați raportul complet pentru kilometraj, accidente, schimbări de proprietar, asigurări și licitații.",
    cta: "Deblocați raportul complet al istoricului vehiculului pe verifykm.com.",
  },
  pl: {
    vin: "VIN",
    make: "Marka",
    model: "Model",
    year: "Rok",
    engine: "Silnik",
    transmission: "Skrzynia",
    color: "Kolor",
    country: "Kraj",
    intro: "Bezpłatny podgląd {vehicle} z podstawowymi danymi. Odblokuj pełny raport przebiegu, wypadków, zmian właściciela, ubezpieczeń i aukcji.",
    cta: "Odblokuj pełny raport historii pojazdu na verifykm.com.",
  },
  ka: {
    vin: "VIN",
    make: "\u10DB\u10D0\u10E0\u10D9\u10D0",
    model: "\u10DB\u10DD\u10D3\u10D4\u10DA\u10D8",
    year: "\u10EC\u10DA\u10D8",
    engine: "\u10D0\u10D2\u10E0\u10D4\u10D2\u10D0\u10E2\u10D8",
    transmission: "\u10E2\u10E0\u10D0\u10DC\u10E1\u10DB\u10D8\u10E1\u10D8\u10D0",
    color: "\u10E4\u10D4\u10E0\u10D8",
    country: "\u10E9\u10D4\u10D5\u10D4\u10D1\u10D4\u10D1\u10D8",
    intro: "{vehicle}-\u10D8\u10E1 \u10E3\u10D0\u10D1\u10DA\u10DD \u10EC\u10D8\u10DC\u10D0\u10E1\u10EC\u10D0\u10E0\u10D8 \u10DC\u10D0\u10EE\u10D5\u10D0 \u10E1\u10D0\u10D1\u10D6\u10D8\u10E1 \u10DB\u10DD\u10DC\u10D0\u10EA\u10D4\u10DB\u10DA\u10DD\u10D1\u10D8\u10D7. \u10D2\u10D0\u10E0\u10EB\u10D8\u10D7 \u10E1\u10E0\u10E3\u10DA\u10D8 \u10D0\u10DC\u10D2\u10D0\u10E0\u10D8\u10E8\u10D8 \u10D2\u10D0\u10E0\u10D4\u10D1\u10D4\u10D6\u10D8\u10E1\u10D7\u10D5\u10D8\u10E1, \u10D0\u10D5\u10D0\u10E0\u10D8\u10D4\u10D1\u10D8\u10E1, \u10DB\u10E4\u10DA\u10DD\u10D1\u10D4\u10DA\u10D7\u10D0 \u10E9\u10D0\u10D7\u10D4\u10D5\u10D8\u10E1, \u10D3\u10D0\u10D6\u10E6\u10D5\u10D4\u10D5\u10D0 \u10D3\u10D0 \u10D0\u10E3\u10E5\u10EA\u10D8\u10DD\u10DC\u10D4\u10D1\u10D8\u10E1\u10D7\u10D5\u10D8\u10E1.",
    cta: "\u10D2\u10D0\u10E0\u10EB\u10D8\u10D7 \u10E1\u10E0\u10E3\u10DA\u10D8 \u10D0\u10DC\u10D2\u10D0\u10E0\u10D8\u10E8\u10D8 verifykm.com-\u10D6\u10D4.",
  },
  bg: {
    vin: "VIN",
    make: "Марка",
    model: "Модел",
    year: "Година",
    engine: "Двигател",
    transmission: "Скоростна кутия",
    color: "Цвят",
    country: "Държава",
    intro: "Безплатен преглед на {vehicle} с основни данни. Отключете пълния отчет за пробег, катастрофи, смяна на собственици, застраховки и търгове.",
    cta: "Отключете пълния отчет за историята на автомобила на verifykm.com.",
  },
  sq: {
    vin: "VIN",
    make: "Marka",
    model: "Modeli",
    year: "Viti",
    engine: "Motori",
    transmission: "Transmisioni",
    color: "Ngjyra",
    country: "Shteti",
    intro: "Parapamje falas e {vehicle} me specifikime bazë. Zhbllokoni raportin e plotë për kilometrazhin, aksidentet, ndryshimet e pronarit, sigurimin dhe ankandet.",
    cta: "Zhbllokoni raportin e plotë të historikut të automjetit në verifykm.com.",
  },
  zh: {
    vin: "VIN",
    make: "品牌",
    model: "车型",
    year: "年份",
    engine: "发动机",
    transmission: "变速箱",
    color: "颜色",
    country: "国家",
    intro: "{vehicle} 免费预览含基础规格。解锁完整报告可查看里程、事故、过户、保险索赔与拍卖记录。",
    cta: "在 verifykm.com 解锁完整车辆历史报告。",
  },
};

export type VinSsrLink = { href: string; label: string };

export type VinSsrBodyContent = {
  heading: string;
  vin: string;
  vinLabel: string;
  intro: string;
  specs: Array<{ label: string; value: string }>;
  cta: string;
  links?: VinSsrLink[];
  /** Optional unique locked findings paragraph (no accident counts). */
  findingsSummary?: string;
};

type SsrNavLabels = {
  home: string;
  pricing: string;
  howItWorks: string;
  freeDecoder: string;
  faq: string;
};

const SSR_NAV: Record<VinSeoLang, SsrNavLabels> = {
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

export function buildVinSsrNavLinks(lang: VinSeoLang): VinSsrLink[] {
  const nav = SSR_NAV[lang] ?? SSR_NAV.en;
  const base = `/${lang}`;
  return [
    { href: base, label: nav.home },
    { href: `${base}/pricing`, label: nav.pricing },
    { href: `${base}/how-it-works`, label: nav.howItWorks },
    { href: `${base}/free-vin-decoder`, label: nav.freeDecoder },
    { href: `${base}/faq`, label: nav.faq },
  ];
}

const DESCRIPTIONS: Record<VinSeoLang, DescFn> = {
  en: (vehicle, vin, specs) => {
    const specsPart = specs ? ` ${specs}.` : "";
    return `Check ${vehicle} VIN ${vin}: mileage, accidents, ownership history, insurance & auction records.${specsPart} Instant full report on verifykm.com.`;
  },
  de: (vehicle, vin, specs) => {
    const specsPart = specs ? ` ${specs}.` : "";
    return `Prüfen Sie ${vehicle} VIN ${vin}: Kilometerstand, Unfälle, Halterhistorie, Versicherung und Auktionen.${specsPart} Sofortiger Vollbericht auf verifykm.com.`;
  },
  es: (vehicle, vin, specs) => {
    const specsPart = specs ? ` ${specs}.` : "";
    return `Verifique ${vehicle} VIN ${vin}: kilometraje, accidentes, historial de propietarios, seguro y subastas.${specsPart} Informe completo al instante en verifykm.com.`;
  },
  fr: (vehicle, vin, specs) => {
    const specsPart = specs ? ` ${specs}.` : "";
    return `Vérifiez ${vehicle} VIN ${vin} : kilométrage, accidents, historique des propriétaires, assurance et enchères.${specsPart} Rapport complet instantané sur verifykm.com.`;
  },
  ar: (vehicle, vin, specs) => {
    const specsPart = specs ? ` ${specs}.` : "";
    return `تحقق من ${vehicle} VIN ${vin}: الكيلومترات، الحوادث، سجل الملكية، التأمين ومزادات البيع.${specsPart} تقرير فوري على verifykm.com.`;
  },
  uk: (vehicle, vin, specs) => {
    const specsPart = specs ? ` ${specs}.` : "";
    return `Перевірте ${vehicle} VIN ${vin}: пробіг, ДТП, історія власників, страхування та аукціони.${specsPart} Миттєвий звіт на verifykm.com.`;
  },
  ru: (vehicle, vin, specs) => {
    const specsPart = specs ? ` ${specs}.` : "";
    return `Проверьте ${vehicle} VIN ${vin}: пробег, ДТП, история владельцев, страхование и аукционы.${specsPart} Мгновенный отчёт на verifykm.com.`;
  },
  ro: (vehicle, vin, specs) => {
    const specsPart = specs ? ` ${specs}.` : "";
    return `Verificați ${vehicle} VIN ${vin}: kilometraj, accidente, istoric proprietari, asigurare și licitații.${specsPart} Raport complet instant pe verifykm.com.`;
  },
  pl: (vehicle, vin, specs) => {
    const specsPart = specs ? ` ${specs}.` : "";
    return `Sprawdź ${vehicle} VIN ${vin}: przebieg, wypadki, historia właścicieli, ubezpieczenie i aukcje.${specsPart} Pełny raport natychmiast na verifykm.com.`;
  },
  ka: (vehicle, vin, specs) => {
    const specsPart = specs ? ` ${specs}.` : "";
    return `\u10E8\u10D4\u10D0\u10DB\u10DD\u10EC\u10DB\u10D4\u10D7 ${vehicle} VIN ${vin}: \u10D2\u10D0\u10E0\u10D1\u10D4\u10DC\u10D8, \u10D0\u10D5\u10D0\u10E0\u10D8\u10D4\u10D1\u10D8, \u10DB\u10E4\u10DA\u10DD\u10D1\u10D4\u10DA\u10D7\u10D0 \u10D8\u10E1\u10E2\u10DD\u10E0\u10D8\u10D0, \u10D3\u10D0\u10D6\u10E6\u10D5\u10D4\u10D5\u10D0 \u10D3\u10D0 \u10D0\u10E3\u10E5\u10EA\u10D8\u10DD\u10DC\u10D4\u10D1\u10D8.${specsPart} \u10E1\u10E0\u10E3\u10DA\u10D8 \u10D0\u10DC\u10D2\u10D0\u10E0\u10D8\u10E8\u10D8 \u10DB\u10D0\u10E8\u10D8\u10DC\u10D5\u10D4 verifykm.com-\u10D6\u10D4.`;
  },
  bg: (vehicle, vin, specs) => {
    const specsPart = specs ? ` ${specs}.` : "";
    return `Проверете ${vehicle} VIN ${vin}: пробег, катастрофи, история на собственици, застраховка и търгове.${specsPart} Пълен отчет мигновено на verifykm.com.`;
  },
  sq: (vehicle, vin, specs) => {
    const specsPart = specs ? ` ${specs}.` : "";
    return `Kontrollo ${vehicle} VIN ${vin}: kilometrat, aksidentet, historinë e pronarëve, sigurimin dhe ankandet.${specsPart} Raport i menjëhershëm në verifykm.com.`;
  },
  zh: (vehicle, vin, specs) => {
    const specsPart = specs ? ` ${specs}.` : "";
    return `查询 ${vehicle} VIN ${vin}：里程、事故、车主历史、保险与拍卖记录。${specsPart} 在 verifykm.com 即时获取完整报告。`;
  },
};

const VIN_ONLY_DESCRIPTIONS: Record<VinSeoLang, (vin: string) => string> = {
  en: (vin) => `Check VIN ${vin}: mileage, accidents, ownership history, insurance & auction records. Instant full report on verifykm.com.`,
  de: (vin) => `VIN ${vin} prüfen: Kilometerstand, Unfälle, Halterhistorie, Versicherung und Auktionen. Sofortiger Vollbericht auf verifykm.com.`,
  es: (vin) => `Verifique VIN ${vin}: kilometraje, accidentes, historial de propietarios, seguro y subastas. Informe completo al instante en verifykm.com.`,
  fr: (vin) => `Vérifiez VIN ${vin} : kilométrage, accidents, historique des propriétaires, assurance et enchères. Rapport complet instantané sur verifykm.com.`,
  ar: (vin) => `تحقق من VIN ${vin}: الكيلومترات، الحوادث، سجل الملكية، التأمين ومزادات البيع. تقرير فوري على verifykm.com.`,
  uk: (vin) => `Перевірте VIN ${vin}: пробіг, ДТП, історія власників, страхування та аукціони. Миттєвий звіт на verifykm.com.`,
  ru: (vin) => `Проверьте VIN ${vin}: пробег, ДТП, история владельцев, страхование и аукционы. Мгновенный отчёт на verifykm.com.`,
  ro: (vin) => `Verificați VIN ${vin}: kilometraj, accidente, istoric proprietari, asigurare și licitații. Raport complet instant pe verifykm.com.`,
  pl: (vin) => `Sprawdź VIN ${vin}: przebieg, wypadki, historia właścicieli, ubezpieczenie i aukcje. Pełny raport natychmiast na verifykm.com.`,
  ka: (vin) => `\u10E8\u10D4\u10D0\u10DB\u10DD\u10EC\u10DB\u10D4\u10D7 VIN ${vin}: \u10D2\u10D0\u10E0\u10D1\u10D4\u10DC\u10D8, \u10D0\u10D5\u10D0\u10E0\u10D8\u10D4\u10D1\u10D8, \u10DB\u10E4\u10DA\u10DD\u10D1\u10D4\u10DA\u10D7\u10D0 \u10D8\u10E1\u10E2\u10DD\u10E0\u10D8\u10D0, \u10D3\u10D0\u10D6\u10E6\u10D5\u10D4\u10D5\u10D0 \u10D3\u10D0 \u10D0\u10E3\u10E5\u10EA\u10D8\u10DD\u10DC\u10D4\u10D1\u10D8. \u10E1\u10E0\u10E3\u10DA\u10D8 \u10D0\u10DC\u10D2\u10D0\u10E0\u10D8\u10E8\u10D8 \u10DB\u10D0\u10E8\u10D8\u10DC\u10D5\u10D4 verifykm.com-\u10D6\u10D4.`,
  bg: (vin) => `Проверете VIN ${vin}: пробег, катастрофи, история на собственици, застраховка и търгове. Пълен отчет мигновено на verifykm.com.`,
  sq: (vin) => `Kontrollo VIN ${vin}: kilometrat, aksidentet, historinë e pronarëve, sigurimin dhe ankandet. Raport i menjëhershëm në verifykm.com.`,
  zh: (vin) => `查询 VIN ${vin}：里程、事故、车主历史、保险与拍卖记录。在 verifykm.com 即时获取完整报告。`,
};

export function buildVinOnlyPageTitle(lang: VinSeoLang, vin: string): string {
  const fn = VIN_ONLY_TITLES[lang] ?? VIN_ONLY_TITLES.en;
  return fn(normalizeVin(vin));
}

export function buildVinOnlyPageDescription(lang: VinSeoLang, vin: string): string {
  const fn = VIN_ONLY_DESCRIPTIONS[lang] ?? VIN_ONLY_DESCRIPTIONS.en;
  return fn(normalizeVin(vin));
}

export function buildVinPageTitle(lang: VinSeoLang, vehicle: VinSeoVehicle): string {
  const vin = normalizeVin(vehicle.vin);
  if (!vehicleHasIdentity(vehicle)) {
    return buildVinOnlyPageTitle(lang, vin);
  }
  const fn = TITLES[lang] ?? TITLES.en;
  return fn(buildVehicleTitle(vehicle), vin);
}

export function buildVinPageDescription(
  lang: VinSeoLang,
  vehicle: VinSeoVehicle,
  opts?: { locked?: boolean; findingsSummary?: string | null },
): string {
  const vin = normalizeVin(vehicle.vin);
  const locked = opts?.locked !== false;
  const findings = opts?.findingsSummary?.trim();

  if (locked && findings) {
    return `${findings} verifykm.com.`;
  }

  if (!vehicleHasIdentity(vehicle)) {
    if (locked) {
      const fn = LOCKED_VIN_ONLY_DESCRIPTIONS[lang] ?? LOCKED_VIN_ONLY_DESCRIPTIONS.en;
      return fn(vin);
    }
    return buildVinOnlyPageDescription(lang, vin);
  }

  if (locked) {
    const fn = LOCKED_DESCRIPTIONS[lang] ?? LOCKED_DESCRIPTIONS.en;
    return fn(buildVehicleTitle(vehicle), vin, specSnippet(vehicle));
  }

  const fn = DESCRIPTIONS[lang] ?? DESCRIPTIONS.en;
  return fn(buildVehicleTitle(vehicle), vin, specSnippet(vehicle));
}

export function buildVinSsrBodyContent(
  lang: VinSeoLang,
  vehicle: VinSeoVehicle,
  opts?: { findingsSummary?: string | null },
): VinSsrBodyContent | null {
  if (!vehicleHasIdentity(vehicle)) return null;

  const labels = SSR_LABELS[lang] ?? SSR_LABELS.en;
  const heading = buildVehicleTitle(vehicle);
  const specs: Array<{ label: string; value: string }> = [];

  if (vehicle.make) specs.push({ label: labels.make, value: vehicle.make });
  if (vehicle.model) specs.push({ label: labels.model, value: vehicle.model });
  if (vehicle.year != null) specs.push({ label: labels.year, value: String(vehicle.year) });
  if (vehicle.engine) specs.push({ label: labels.engine, value: vehicle.engine });
  if (vehicle.transmission) specs.push({ label: labels.transmission, value: vehicle.transmission });
  if (vehicle.color) specs.push({ label: labels.color, value: vehicle.color });
  if (vehicle.country) specs.push({ label: labels.country, value: vehicle.country });

  const findingsSummary = opts?.findingsSummary?.trim() || undefined;
  const intro = findingsSummary
    ?? labels.intro.replace("{vehicle}", heading);

  return {
    heading,
    vin: normalizeVin(vehicle.vin),
    vinLabel: labels.vin,
    intro,
    ...(findingsSummary ? { findingsSummary } : {}),
    specs,
    cta: labels.cta,
    links: buildVinSsrNavLinks(lang),
  };
}

export function buildVinOnlySsrBodyContent(lang: VinSeoLang, vin: string): VinSsrBodyContent {
  const normalized = normalizeVin(vin);
  const labels = SSR_LABELS[lang] ?? SSR_LABELS.en;
  const titleFn = VIN_ONLY_TITLES[lang] ?? VIN_ONLY_TITLES.en;
  const descFn = LOCKED_VIN_ONLY_DESCRIPTIONS[lang] ?? LOCKED_VIN_ONLY_DESCRIPTIONS.en;

  return {
    heading: titleFn(normalized).replace(/\s*\|\s*verifykm\s*$/i, ""),
    vin: normalized,
    vinLabel: labels.vin,
    intro: descFn(normalized),
    specs: [],
    cta: labels.cta,
    links: buildVinSsrNavLinks(lang),
  };
}

export function resolveVinSsrBodyContent(
  lang: VinSeoLang,
  vehicle: VinSeoVehicle,
  opts?: { findingsSummary?: string | null },
): VinSsrBodyContent {
  return buildVinSsrBodyContent(lang, vehicle, opts) ?? buildVinOnlySsrBodyContent(lang, vehicle.vin);
}

/** Resolve relative API image paths to absolute URLs for Open Graph / Twitter cards. */
export function resolveAbsoluteAssetUrl(origin: string, url: string | null | undefined): string | undefined {
  const trimmed = String(url ?? "").trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = origin.replace(/\/$/, "");
  return trimmed.startsWith("/") ? `${base}${trimmed}` : `${base}/${trimmed}`;
}

export type VinPageSeo = {
  title: string;
  description: string;
  canonicalPath: string;
  /** When true, emit noindex (empty / missing report shells). Catalog reports stay indexable. */
  noIndex: boolean;
  jsonLd: Record<string, unknown>[];
  ogImage?: string;
  ogImageAlt?: string;
};

export function buildVinPageSeo(
  lang: VinSeoLang,
  vehicle: VinSeoVehicle,
  origin: string,
  opts?: {
    odometer?: number | null;
    isUnlocked?: boolean;
    findingsSummary?: string | null;
  },
): VinPageSeo {
  const vin = normalizeVin(vehicle.vin);
  const vehicleTitle = buildVehicleTitle(vehicle);
  const canonicalPath = `/${lang}/vin/${vin}`;
  const siteOrigin = origin.replace(/\/$/, "");
  const pageUrl = `${siteOrigin}${canonicalPath}`;
  const absoluteImage = resolveAbsoluteAssetUrl(siteOrigin, vehicle.thumbnailUrl);

  const isUnlocked = opts?.isUnlocked === true;
  const pageDescription = buildVinPageDescription(lang, vehicle, {
    locked: !isUnlocked,
    findingsSummary: !isUnlocked ? opts?.findingsSummary : undefined,
  });

  const vehicleLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    "@id": `${pageUrl}#vehicle`,
    vehicleIdentificationNumber: vin,
    name: vehicleTitle,
    url: pageUrl,
    ...(vehicle.year && { modelDate: String(vehicle.year) }),
    ...(vehicle.make && { brand: { "@type": "Brand", name: vehicle.make }, manufacturer: { "@type": "Organization", name: vehicle.make } }),
    ...(vehicle.model && { model: vehicle.model }),
    ...(vehicle.color && { color: vehicle.color }),
    ...(vehicle.bodyType && { bodyType: vehicle.bodyType }),
    ...(vehicle.fuelType && { fuelType: vehicle.fuelType }),
    ...(opts?.isUnlocked && opts.odometer != null && {
      mileageFromOdometer: {
        "@type": "QuantitativeValue",
        value: opts.odometer,
        unitCode: "KMT",
      },
    }),
    ...(absoluteImage && { image: absoluteImage }),
  };

  const webPageLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${pageUrl}#webpage`,
    url: pageUrl,
    name: buildVinPageTitle(lang, vehicle),
    description: pageDescription,
    inLanguage: lang,
    isPartOf: { "@type": "WebSite", name: "verifykm.com", url: siteOrigin },
    about: { "@id": `${pageUrl}#vehicle` },
    primaryImageOfPage: absoluteImage ?? undefined,
  };

  const noIndex = !absoluteImage;

  return {
    title: buildVinPageTitle(lang, vehicle),
    description: pageDescription,
    canonicalPath,
    noIndex,
    jsonLd: noIndex ? [] : [webPageLd, vehicleLd],
    ogImage: absoluteImage,
    ogImageAlt: vehicleTitle,
  };
}

export function escapeVinHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildVinSsrStyleBlock(): string {
  return `<style id="verifykm-vin-ssr-style">
      #root{position:relative;z-index:1;min-height:100vh}
      #root .app-boot-shell{position:relative;z-index:1;min-height:100vh}
      .verifykm-vin-ssr{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
    </style>`;
}

export function buildVinSsrBodyBlock(content: VinSsrBodyContent): string {
  const specRows = content.specs
    .map(
      (row) =>
        `          <dt>${escapeVinHtml(row.label)}</dt><dd>${escapeVinHtml(row.value)}</dd>`,
    )
    .join("\n");

  const specBlock = specRows
    ? `        <dl>
${specRows}
        </dl>`
    : "";

  const navLinks = (content.links ?? [])
    .filter((link) => link.href?.trim() && link.label?.trim())
    .map(
      (link) =>
        `          <li><a href="${escapeVinHtml(link.href)}">${escapeVinHtml(link.label)}</a></li>`,
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
        <h1>${escapeVinHtml(content.heading)}</h1>
        <p><strong>${escapeVinHtml(content.vinLabel)}:</strong> ${escapeVinHtml(content.vin)}</p>
        <p class="lead">${escapeVinHtml(content.intro)}</p>
${content.findingsSummary && content.findingsSummary !== content.intro
  ? `        <p class="findings">${escapeVinHtml(content.findingsSummary)}</p>\n`
  : ""}${navBlock}
${specBlock}
        <p>${escapeVinHtml(content.cta)}</p>
      </article>
    </main>`;
}

export function removeVinSsrFromHtml(html: string): string {
  return html
    .replace(/\n?\s*<style id="verifykm-vin-ssr-style"[^>]*>[\s\S]*?<\/style>/g, "")
    .replace(/\n?\s*<main id="verifykm-vin-ssr"[\s\S]*?<\/main>/g, "");
}

export function injectVinSsrIntoHtml(html: string, content: VinSsrBodyContent | null | undefined): string {
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

export {
  extractLockedPreviewSignals,
  buildLockedHistorySummary,
  lockedPreviewSignalsHaveFindings,
  sanitizeLockedPreviewSignalsForClient,
  LOCKED_PUBLIC_FORBIDDEN_KEYS,
  type LockedPreviewSignals,
} from "./locked-preview";

