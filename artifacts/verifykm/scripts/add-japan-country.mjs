/**
 * Add Japan marketing country (slug: japan, flag: jp) across i18n + SEO data.
 * Run: node artifacts/verifykm/scripts/add-japan-country.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const i18nDir = path.join(root, "src", "i18n");

/** @type {Record<string, Record<string, string>>} */
const LOCALE = {
  en: {
    home_stat_japan: "Japan",
    home_country_japan_h0: "Auction grade & export history",
    home_country_japan_h1: "Odometer & service records",
    home_country_japan_h2: "Accident & flood risk signals",
    country_japan_label: "Japan",
    country_japan_name: "Japan",
    country_japan_headline_verb: "Japan",
    country_japan_headline_origin: "for Japanese cars",
    country_japan_headline_origin_prefix: "for cars from ",
    country_japan_cycling_0: "mileage check",
    country_japan_cycling_1: "accidents & repairs",
    country_japan_cycling_2: "auction history",
    country_japan_cycling_3: "export records",
    country_japan_count: "78M+",
    country_japan_description:
      "Japan mileage check — verify odometer readings, auction grades, accidents and export history on Japanese cars before you buy or import.",
    country_japan_issue_0: "Odometer rollback — frequent on high-mileage domestic and exported cars",
    country_japan_issue_1: "Hidden auction damage grades — sheet-metal repairs not disclosed overseas",
    country_japan_issue_2: "Flood or typhoon damage vehicles relisted without full disclosure",
    country_japan_issue_3: "Export record gaps — cars shipped overseas with incomplete domestic history",
    country_japan_included_0: "Auction grade and marketplace listing signals",
    country_japan_included_1: "Insurance claim and collision history indicators",
    country_japan_included_2: "Registration and ownership transfer signals",
    country_japan_included_3: "Salvage, write-off and rebuilt flags where available",
    country_japan_included_4: "Odometer rollback detection across service records",
    country_japan_included_5: "Export and cross-border history signals",
    country_japan_issues_sub: "The most common red flags on Japanese used vehicles — before you hand over a deposit.",
    country_japan_included_sub:
      "Every report pulls auction, registration and service signals across Japan's major markets and export channels.",
    country_japan_included_note: "Data is sourced directly from providers — we do not estimate or fabricate records.",
    country_japan_faq_0_q: "What does a Japanese VIN starting with 'J' mean?",
    country_japan_faq_0_a:
      "VINs starting with 'J' are assigned to vehicles manufactured in Japan. It confirms factory origin but does not guarantee a clean history — always check mileage, auction grades and accident records.",
    country_japan_faq_1_q: "Are Toyota, Honda and Nissan vehicles covered?",
    country_japan_faq_1_a:
      "Yes. Our reports cover major Japanese brands including Toyota, Honda, Nissan, Mazda, Subaru, Lexus, Suzuki and Mitsubishi, as well as imported vehicles registered in Japan.",
    country_japan_faq_2_q: "Can I check a Japanese car before importing it?",
    country_japan_faq_2_a:
      "Yes. Run a VIN check before export to surface odometer fraud, auction damage grades and hidden accident repairs that may not appear in your destination country.",
    country_japan_wwc_mileage_seo:
      "We cross-check odometer readings against registration signals, service records and marketplace data across Japan.",
    country_japan_wwc_accidents_seo:
      "We surface collision and insurance claim history — including hidden body repairs often omitted in private and export sales.",
    country_japan_wwc_salvage_seo:
      "We flag salvage, write-off and flood-risk vehicles — including cars relisted after insurance total-loss declarations.",
    country_japan_wwc_theft_seo:
      "We check theft and recovery records plus export/import signals so cross-border history does not stay hidden.",
    country_japan_wwc_theft_stat_label: "theft & export records checked",
    footer_japan_heading: "Japan",
    footer_japan_link_1: "Japanese used car history",
    footer_japan_link_2: "Auction & export records",
    footer_japan_link_3: "Odometer & accident history",
    footer_japan_link_4: "Toyota Honda Nissan history",
    compare_desc_japan:
      "Japan-only tools miss export and cross-border history. verifykm covers Japanese vehicles, Korea, USA, and more in one report.",
    demo_card_origin_japan: "Japan",
  },
  de: {
    home_stat_japan: "Japan",
    home_country_japan_h0: "Auktionsnoten & Exporthistorie",
    home_country_japan_h1: "Kilometerstand & Service",
    home_country_japan_h2: "Unfall- & Flutschäden",
    country_japan_label: "Japan",
    country_japan_name: "Japan",
    country_japan_headline_verb: "Japan",
    country_japan_headline_origin: "für japanische Autos",
    country_japan_headline_origin_prefix: "für Autos aus ",
    country_japan_cycling_0: "Kilometercheck",
    country_japan_cycling_1: "Unfälle & Reparaturen",
    country_japan_cycling_2: "Auktionshistorie",
    country_japan_cycling_3: "Exportdaten",
    country_japan_count: "78M+",
    country_japan_description:
      "Japan-Kilometercheck — prüfen Sie Tachostand, Auktionsnoten, Unfälle und Exporthistorie japanischer Autos vor Kauf oder Import.",
    country_japan_issue_0: "Tachomanipulation — häufig bei hochkilometrigen Inlands- und Exportfahrzeugen",
    country_japan_issue_1: "Versteckte Auktionsschäden — Blechreparaturen oft nicht ausgewiesen",
    country_japan_issue_2: "Flut-/Taifunschäden ohne vollständige Angabe erneut verkauft",
    country_japan_issue_3: "Lücken in Exportdaten — unvollständige Inlandshistorie beim Versand",
    country_japan_included_0: "Auktionsnoten und Marktplatzsignale",
    country_japan_included_1: "Versicherungs- und Kollisionsindikatoren",
    country_japan_included_2: "Zulassungs- und Eigentumswechsel",
    country_japan_included_3: "Salvage-, Totalschaden- und Rebuild-Flags",
    country_japan_included_4: "Tachomanipulation über Servicedaten",
    country_japan_included_5: "Export- und grenzüberschreitende Signale",
    country_japan_issues_sub: "Die häufigsten Warnsignale bei gebrauchten japanischen Fahrzeugen — vor der Anzahlung.",
    country_japan_included_sub:
      "Jeder Bericht nutzt Auktions-, Zulassungs- und Service-Signale aus Japans wichtigsten Märkten und Exportkanälen.",
    country_japan_included_note: "Daten stammen direkt von Anbietern — wir schätzen oder erfinden keine Einträge.",
    country_japan_faq_0_q: "Was bedeutet eine japanische FIN mit „J“?",
    country_japan_faq_0_a:
      "FIN mit „J“ stehen für Fahrzeuge aus japanischer Produktion. Das bestätigt den Herstellungsort, aber nicht eine saubere Historie — prüfen Sie immer Kilometer, Auktionsnoten und Unfälle.",
    country_japan_faq_1_q: "Sind Toyota, Honda und Nissan abgedeckt?",
    country_japan_faq_1_a:
      "Ja. Unsere Berichte decken große japanische Marken wie Toyota, Honda, Nissan, Mazda, Subaru, Lexus, Suzuki und Mitsubishi ab sowie importierte, in Japan zugelassene Fahrzeuge.",
    country_japan_faq_2_q: "Kann ich ein japanisches Auto vor dem Import prüfen?",
    country_japan_faq_2_a:
      "Ja. Führen Sie einen VIN-Check vor dem Export durch, um Tachobetrug, Auktionsschäden und versteckte Unfallreparaturen zu finden.",
    country_japan_wwc_mileage_seo:
      "Wir gleichen Tachostände mit Zulassungssignalen, Service- und Marktdaten in ganz Japan ab.",
    country_japan_wwc_accidents_seo:
      "Wir zeigen Kollisions- und Versicherungsdaten — inkl. versteckter Karosseriereparaturen.",
    country_japan_wwc_salvage_seo:
      "Wir kennzeichnen Salvage-, Totalschaden- und Flutrisiko-Fahrzeuge.",
    country_japan_wwc_theft_seo:
      "Wir prüfen Diebstahl-/Wiederfindungsdaten sowie Export-/Importsignale.",
    country_japan_wwc_theft_stat_label: "Diebstahl- & Exportdaten geprüft",
    footer_japan_heading: "Japan",
    footer_japan_link_1: "Japanische Gebrauchtwagenhistorie",
    footer_japan_link_2: "Auktion & Exportdaten",
    footer_japan_link_3: "Kilometer & Unfallhistorie",
    footer_japan_link_4: "Toyota Honda Nissan Historie",
    compare_desc_japan:
      "Nur-Japan-Tools fehlen Export- und Grenzdaten. verifykm deckt japanische Fahrzeuge, Korea, USA und mehr in einem Bericht ab.",
    demo_card_origin_japan: "Japan",
  },
};

// Reuse EN structure; fill remaining locales with quality translations
LOCALE.es = {
  ...Object.fromEntries(Object.keys(LOCALE.en).map((k) => [k, LOCALE.en[k]])),
  home_stat_japan: "Japón",
  home_country_japan_h0: "Grado de subasta e historial de exportación",
  home_country_japan_h1: "Odómetro y registros de servicio",
  home_country_japan_h2: "Accidentes y riesgo de inundación",
  country_japan_label: "Japón",
  country_japan_name: "Japón",
  country_japan_headline_verb: "Japón",
  country_japan_headline_origin: "para coches japoneses",
  country_japan_headline_origin_prefix: "para coches de ",
  country_japan_cycling_0: "chequeo de kilometraje",
  country_japan_cycling_1: "accidentes y reparaciones",
  country_japan_cycling_2: "historial de subastas",
  country_japan_cycling_3: "registros de exportación",
  country_japan_description:
    "Chequeo de kilometraje Japón — verifique odómetro, grados de subasta, accidentes e historial de exportación antes de comprar o importar.",
  country_japan_issue_0: "Retroceso del odómetro — frecuente en coches de alto kilometraje y exportación",
  country_japan_issue_1: "Daños de subasta ocultos — reparaciones de chapa no reveladas en el extranjero",
  country_japan_issue_2: "Daños por inundación o tifón revendidos sin divulgación completa",
  country_japan_issue_3: "Huecos en exportación — historial nacional incompleto al enviarse",
  country_japan_included_0: "Grados de subasta y señales de mercado",
  country_japan_included_1: "Indicadores de seguros y colisiones",
  country_japan_included_2: "Registro y transferencia de propiedad",
  country_japan_included_3: "Marcas de salvamento, baja y reconstrucción",
  country_japan_included_4: "Detección de fraude de odómetro en servicios",
  country_japan_included_5: "Señales de exportación y cruce de fronteras",
  country_japan_issues_sub: "Las señales de alerta más comunes en usados japoneses — antes del depósito.",
  country_japan_included_sub:
    "Cada informe combina señales de subasta, registro y servicio en los principales mercados y canales de exportación de Japón.",
  country_japan_included_note: "Datos de proveedores directos — no estimamos ni inventamos registros.",
  country_japan_faq_0_q: "¿Qué significa un VIN japonés que empieza por «J»?",
  country_japan_faq_0_a:
    "Los VIN con «J» se asignan a vehículos fabricados en Japón. Confirma el origen, no un historial limpio — revise siempre kilometraje, subastas y accidentes.",
  country_japan_faq_1_q: "¿Están cubiertos Toyota, Honda y Nissan?",
  country_japan_faq_1_a:
    "Sí. Cubrimos marcas japonesas principales como Toyota, Honda, Nissan, Mazda, Subaru, Lexus, Suzuki y Mitsubishi, además de importados registrados en Japón.",
  country_japan_faq_2_q: "¿Puedo revisar un coche japonés antes de importarlo?",
  country_japan_faq_2_a:
    "Sí. Haga un chequeo VIN antes de la exportación para detectar fraude de odómetro, daños de subasta y reparaciones ocultas.",
  country_japan_wwc_mileage_seo:
    "Cruzamos lecturas del odómetro con señales de registro, servicio y datos de mercado en Japón.",
  country_japan_wwc_accidents_seo:
    "Mostramos historial de colisiones y seguros — incluidas reparaciones de carrocería ocultas.",
  country_japan_wwc_salvage_seo:
    "Marcamos salvamento, baja y riesgo de inundación — incluidos coches revendidos tras pérdida total.",
  country_japan_wwc_theft_seo:
    "Revisamos robos/recuperaciones y señales de exportación/importación.",
  country_japan_wwc_theft_stat_label: "robos y exportaciones verificados",
  footer_japan_heading: "Japón",
  footer_japan_link_1: "Historial de usados japoneses",
  footer_japan_link_2: "Subasta y exportación",
  footer_japan_link_3: "Odómetro y accidentes",
  footer_japan_link_4: "Historial Toyota Honda Nissan",
  compare_desc_japan:
    "Las herramientas solo Japón omiten historial de exportación. verifykm cubre vehículos japoneses, Corea, EE. UU. y más en un informe.",
  demo_card_origin_japan: "Japón",
};

LOCALE.fr = {
  ...Object.fromEntries(Object.keys(LOCALE.en).map((k) => [k, LOCALE.en[k]])),
  home_stat_japan: "Japon",
  home_country_japan_h0: "Notes d'enchères et export",
  home_country_japan_h1: "Compteur et entretien",
  home_country_japan_h2: "Accidents et risque d'inondation",
  country_japan_label: "Japon",
  country_japan_name: "Japon",
  country_japan_headline_verb: "Japon",
  country_japan_headline_origin: "pour voitures japonaises",
  country_japan_headline_origin_prefix: "pour voitures de ",
  country_japan_cycling_0: "contrôle kilométrique",
  country_japan_cycling_1: "accidents et réparations",
  country_japan_cycling_2: "historique d'enchères",
  country_japan_cycling_3: "dossiers d'export",
  country_japan_description:
    "Contrôle kilométrique Japon — vérifiez compteur, notes d'enchères, accidents et historique d'export avant achat ou import.",
  country_japan_issue_0: "Fraude au compteur — fréquente sur véhicules à fort kilométrage et export",
  country_japan_issue_1: "Dommages d'enchères cachés — tôlerie non déclarée à l'étranger",
  country_japan_issue_2: "Dégâts d'inondation/typhon revendus sans divulgation complète",
  country_japan_issue_3: "Lacunes d'export — historique national incomplet à l'expédition",
  country_japan_included_0: "Notes d'enchères et signaux marketplace",
  country_japan_included_1: "Indicateurs d'assurance et collisions",
  country_japan_included_2: "Immatriculation et transferts de propriété",
  country_japan_included_3: "Flags salvage, épave et reconstruit",
  country_japan_included_4: "Détection de fraude au compteur via l'entretien",
  country_japan_included_5: "Signaux d'export et transfrontaliers",
  country_japan_issues_sub: "Les signaux d'alerte les plus courants sur les occasions japonaises — avant l'acompte.",
  country_japan_included_sub:
    "Chaque rapport croise enchères, immatriculation et entretien sur les principaux marchés et canaux d'export du Japon.",
  country_japan_included_note: "Données issues des fournisseurs — nous n'estimons ni n'inventons aucun enregistrement.",
  country_japan_faq_0_q: "Que signifie un VIN japonais commençant par « J » ?",
  country_japan_faq_0_a:
    "Les VIN en « J » désignent des véhicules fabriqués au Japon. Cela confirme l'origine, pas un historique propre — vérifiez toujours kilométrage, enchères et accidents.",
  country_japan_faq_1_q: "Toyota, Honda et Nissan sont-ils couverts ?",
  country_japan_faq_1_a:
    "Oui. Nos rapports couvrent Toyota, Honda, Nissan, Mazda, Subaru, Lexus, Suzuki et Mitsubishi, ainsi que les importés immatriculés au Japon.",
  country_japan_faq_2_q: "Puis-je vérifier une voiture japonaise avant import ?",
  country_japan_faq_2_a:
    "Oui. Lancez un contrôle VIN avant l'export pour détecter fraude au compteur, notes d'enchères et réparations cachées.",
  country_japan_wwc_mileage_seo:
    "Nous croisons les lectures du compteur avec immatriculation, entretien et données de marché au Japon.",
  country_japan_wwc_accidents_seo:
    "Nous exposons collisions et sinistres — y compris réparations de carrosserie cachées.",
  country_japan_wwc_salvage_seo:
    "Nous signalons salvage, épave et risque d'inondation.",
  country_japan_wwc_theft_seo:
    "Nous vérifions vols/récupérations et signaux d'export/import.",
  country_japan_wwc_theft_stat_label: "vols et exports vérifiés",
  footer_japan_heading: "Japon",
  footer_japan_link_1: "Historique occasion japonaise",
  footer_japan_link_2: "Enchères et export",
  footer_japan_link_3: "Compteur et accidents",
  footer_japan_link_4: "Historique Toyota Honda Nissan",
  compare_desc_japan:
    "Les outils Japon-only manquent l'historique d'export. verifykm couvre le Japon, la Corée, les USA et plus dans un rapport.",
  demo_card_origin_japan: "Japon",
};

function cloneFromEnWithOverrides(overrides) {
  return { ...LOCALE.en, ...overrides };
}

LOCALE.sq = cloneFromEnWithOverrides({
  home_stat_japan: "Japoni",
  country_japan_label: "Japoni",
  country_japan_name: "Japoni",
  country_japan_headline_verb: "Japoni",
  country_japan_headline_origin: "për makina japoneze",
  country_japan_headline_origin_prefix: "për makina nga ",
  country_japan_cycling_0: "kontroll kilometrash",
  country_japan_cycling_1: "aksidente dhe riparime",
  country_japan_cycling_2: "histori ankandi",
  country_japan_cycling_3: "rekorde eksporti",
  country_japan_description:
    "Kontroll kilometrash Japoni — verifikoni odometrin, notat e ankandit, aksidentet dhe historinë e eksportit para blerjes ose importit.",
  footer_japan_heading: "Japoni",
  demo_card_origin_japan: "Japoni",
  compare_desc_japan:
    "Mjetet vetëm për Japoninë humbasin historinë e eksportit. verifykm mbulon makina japoneze, Kore, SHBA dhe më shumë në një raport.",
});

LOCALE.pl = cloneFromEnWithOverrides({
  home_stat_japan: "Japonia",
  country_japan_label: "Japonia",
  country_japan_name: "Japonia",
  country_japan_headline_verb: "Japonia",
  country_japan_headline_origin: "dla aut japońskich",
  country_japan_headline_origin_prefix: "dla aut z ",
  country_japan_cycling_0: "sprawdzenie przebiegu",
  country_japan_cycling_1: "wypadki i naprawy",
  country_japan_cycling_2: "historia aukcji",
  country_japan_cycling_3: "rekordy eksportu",
  country_japan_description:
    "Sprawdzenie przebiegu Japonia — zweryfikuj licznik, oceny aukcyjne, wypadki i historię eksportu przed zakupem lub importem.",
  footer_japan_heading: "Japonia",
  demo_card_origin_japan: "Japonia",
  compare_desc_japan:
    "Narzędzia tylko dla Japonii pomijają historię eksportu. verifykm obejmuje Japonię, Koreę, USA i więcej w jednym raporcie.",
});

LOCALE.ro = cloneFromEnWithOverrides({
  home_stat_japan: "Japonia",
  country_japan_label: "Japonia",
  country_japan_name: "Japonia",
  country_japan_headline_verb: "Japonia",
  country_japan_headline_origin: "pentru mașini japoneze",
  country_japan_headline_origin_prefix: "pentru mașini din ",
  country_japan_cycling_0: "verificare kilometraj",
  country_japan_cycling_1: "accidente și reparații",
  country_japan_cycling_2: "istoric licitații",
  country_japan_cycling_3: "înregistrări export",
  country_japan_description:
    "Verificare kilometraj Japonia — verificați odometrul, notele de licitație, accidentele și istoricul de export înainte de cumpărare sau import.",
  footer_japan_heading: "Japonia",
  demo_card_origin_japan: "Japonia",
  compare_desc_japan:
    "Instrumentele doar Japonia ratează istoricul de export. verifykm acoperă Japonia, Coreea, SUA și mai mult într-un raport.",
});

LOCALE.bg = cloneFromEnWithOverrides({
  home_stat_japan: "Япония",
  country_japan_label: "Япония",
  country_japan_name: "Япония",
  country_japan_headline_verb: "Япония",
  country_japan_headline_origin: "за японски автомобили",
  country_japan_headline_origin_prefix: "за автомобили от ",
  country_japan_cycling_0: "проверка на километраж",
  country_japan_cycling_1: "катастрофи и ремонти",
  country_japan_cycling_2: "аукционна история",
  country_japan_cycling_3: "експортни записи",
  country_japan_description:
    "Проверка на километраж Япония — проверете километража, аукционните оценки, катастрофите и експортната история преди покупка или внос.",
  footer_japan_heading: "Япония",
  demo_card_origin_japan: "Япония",
  compare_desc_japan:
    "Инструментите само за Япония пропускат експортната история. verifykm покрива Япония, Корея, САЩ и още в един доклад.",
});

LOCALE.ka = cloneFromEnWithOverrides({
  home_stat_japan: "იაპონია",
  country_japan_label: "იაპონია",
  country_japan_name: "იაპონია",
  country_japan_headline_verb: "იაპონია",
  country_japan_headline_origin: "იაპონური მანქანებისთვის",
  country_japan_headline_origin_prefix: "მანქანებისთვის ",
  country_japan_cycling_0: "გარბენის შემოწმება",
  country_japan_cycling_1: "ავარიები და რემონტი",
  country_japan_cycling_2: "აუქციონის ისტორია",
  country_japan_cycling_3: "ექსპორტის ჩანაწერები",
  country_japan_description:
    "იაპონიის გარბენის შემოწმება — შეამოწმეთ ოდომეტრი, აუქციონის შეფასებები, ავარიები და ექსპორტის ისტორია ყიდვამდე ან იმპორტამდე.",
  footer_japan_heading: "იაპონია",
  demo_card_origin_japan: "იაპონია",
  compare_desc_japan:
    "მხოლოდ იაპონიის ხელსაწყოებს აკლია ექსპორტის ისტორია. verifykm ფარავს იაპონიას, კორეას, აშშ-ს და მეტს ერთ ანგარიშში.",
});

LOCALE.ar = cloneFromEnWithOverrides({
  home_stat_japan: "اليابان",
  home_country_japan_h0: "درجة المزاد وسجل التصدير",
  home_country_japan_h1: "العداد وسجلات الصيانة",
  home_country_japan_h2: "الحوادث وخطر الفيضان",
  country_japan_label: "اليابان",
  country_japan_name: "اليابان",
  country_japan_headline_verb: "اليابان",
  country_japan_headline_origin: "للسيارات اليابانية",
  country_japan_headline_origin_prefix: "لسيارات من ",
  country_japan_cycling_0: "فحص الكيلومترات",
  country_japan_cycling_1: "الحوادث والإصلاحات",
  country_japan_cycling_2: "سجل المزادات",
  country_japan_cycling_3: "سجلات التصدير",
  country_japan_description:
    "فحص كيلومترات اليابان — تحقق من العداد ودرجات المزاد والحوادث وسجل التصدير قبل الشراء أو الاستيراد.",
  footer_japan_heading: "اليابان",
  demo_card_origin_japan: "اليابان",
  compare_desc_japan:
    "أدوات اليابان فقط تفوّت سجل التصدير. يغطي verifykm اليابان وكوريا والولايات المتحدة والمزيد في تقرير واحد.",
});

LOCALE.uk = cloneFromEnWithOverrides({
  home_stat_japan: "Японія",
  country_japan_label: "Японія",
  country_japan_name: "Японія",
  country_japan_headline_verb: "Японія",
  country_japan_headline_origin: "для японських авто",
  country_japan_headline_origin_prefix: "для авто з ",
  country_japan_cycling_0: "перевірка пробігу",
  country_japan_cycling_1: "аварії та ремонт",
  country_japan_cycling_2: "історія аукціонів",
  country_japan_cycling_3: "записи експорту",
  country_japan_description:
    "Перевірка пробігу Японія — перевірте одометр, аукціонні оцінки, аварії та історію експорту перед купівлею чи імпортом.",
  footer_japan_heading: "Японія",
  demo_card_origin_japan: "Японія",
  compare_desc_japan:
    "Інструменти лише для Японії пропускають історію експорту. verifykm охоплює Японію, Корею, США та більше в одному звіті.",
});

LOCALE.ru = cloneFromEnWithOverrides({
  home_stat_japan: "Япония",
  country_japan_label: "Япония",
  country_japan_name: "Япония",
  country_japan_headline_verb: "Япония",
  country_japan_headline_origin: "для японских авто",
  country_japan_headline_origin_prefix: "для авто из ",
  country_japan_cycling_0: "проверка пробега",
  country_japan_cycling_1: "аварии и ремонт",
  country_japan_cycling_2: "история аукционов",
  country_japan_cycling_3: "записи экспорта",
  country_japan_description:
    "Проверка пробега Япония — проверьте одометр, аукционные оценки, аварии и историю экспорта перед покупкой или импортом.",
  footer_japan_heading: "Япония",
  demo_card_origin_japan: "Япония",
  compare_desc_japan:
    "Инструменты только для Японии пропускают историю экспорта. verifykm покрывает Японию, Корею, США и больше в одном отчёте.",
});

LOCALE.zh = cloneFromEnWithOverrides({
  home_stat_japan: "日本",
  home_country_japan_h0: "拍卖评级与出口历史",
  home_country_japan_h1: "里程与保养记录",
  home_country_japan_h2: "事故与水浸风险",
  country_japan_label: "日本",
  country_japan_name: "日本",
  country_japan_headline_verb: "日本",
  country_japan_headline_origin: "日系车",
  country_japan_headline_origin_prefix: "来自",
  country_japan_cycling_0: "里程核查",
  country_japan_cycling_1: "事故与维修",
  country_japan_cycling_2: "拍卖历史",
  country_japan_cycling_3: "出口记录",
  country_japan_description:
    "日本里程核查 — 在购买或进口前核实里程表、拍卖评级、事故与出口历史。",
  footer_japan_heading: "日本",
  demo_card_origin_japan: "日本",
  compare_desc_japan:
    "仅限日本的工具会漏掉出口与跨境历史。verifykm 一份报告覆盖日本、韩国、美国及更多市场。",
});

const KEYS = Object.keys(LOCALE.en);

for (const lang of Object.keys(LOCALE)) {
  const file = path.join(i18nDir, `${lang}.json`);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (data.country_japan_name) {
    console.log(`skip i18n ${lang} (already has japan)`);
    continue;
  }
  const block = LOCALE[lang];
  for (const k of KEYS) {
    if (!(k in block)) throw new Error(`Missing ${k} in ${lang}`);
    data[k] = block[k];
  }
  // Keep seo_home_markets mentioning Japan if present
  if (typeof data.seo_home_markets === "string" && !/Japan|Japon|Japón|Japoni|Japonia|Япон|იაპონ|اليابان|日本/i.test(data.seo_home_markets)) {
    data.seo_home_markets = data.seo_home_markets
      .replace(/China and Dubai/i, "China, Japan and Dubai")
      .replace(/China und Dubai/i, "China, Japan und Dubai")
      .replace(/China et Dubaï/i, "Chine, Japon et Dubaï")
      .replace(/China y Dubái/i, "China, Japón y Dubái");
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  console.log(`i18n ${lang}: +${KEYS.length} keys`);
}

// seo-data.json
const seoPath = path.join(root, "src", "lib", "seo-data.json");
const seo = JSON.parse(fs.readFileSync(seoPath, "utf8"));
if (!seo.country_japan) {
  seo.country_japan = {
    en: {
      title: "Japan Mileage Check — Japanese Cars | verifykm.com",
      description:
        "Japan mileage check for Japanese cars. Verify km, auction grades, accidents and salvage — Toyota, Honda, Nissan, Mazda, Subaru and Lexus.",
    },
    de: {
      title: "Japan-Kilometercheck — Japanische Autos | verifykm.com",
      description:
        "Japanische Fahrzeuge per VIN prüfen: Kilometerstand, Auktionsnoten, Unfälle und Salvage. Bericht für Toyota, Honda, Nissan, Mazda, Subaru und Lexus.",
    },
    es: {
      title: "Chequeo kilometraje Japón — coches japoneses | verifykm.com",
      description:
        "Verifique kilometraje, subastas, accidentes y salvamento en coches japoneses. Informe VIN para Toyota, Honda, Nissan, Mazda, Subaru y Lexus.",
    },
    fr: {
      title: "Contrôle kilométrique Japon — voitures japonaises | verifykm.com",
      description:
        "Vérifiez un véhicule japonais par VIN : kilométrage, enchères, accidents et épave. Rapport pour Toyota, Honda, Nissan, Mazda, Subaru et Lexus.",
    },
    sq: {
      title: "Kontroll kilometrash Japoni — makina japoneze | verifykm.com",
      description:
        "Kontrolloni kilometrazhin, ankandet, aksidentet dhe salvazhin për makina japoneze. Raport VIN për Toyota, Honda, Nissan, Mazda, Subaru dhe Lexus.",
    },
    pl: {
      title: "Sprawdzenie przebiegu Japonia — auta japońskie | verifykm.com",
      description:
        "Sprawdź auto z Japonii po VIN: przebieg, aukcje, wypadki i szkoda całkowita. Raport dla Toyota, Honda, Nissan, Mazda, Subaru i Lexus.",
    },
    ka: {
      title: "იაპონური მანქანები — გარბენი და ისტორია | verifykm.com",
      description:
        "შეამოწმეთ იაპონური მანქანის გარბენი, აუქციონი, ავარიები და სალვაჟი. VIN ანგარიში Toyota, Honda, Nissan, Mazda, Subaru და Lexus-ისთვის.",
    },
    ro: {
      title: "Verificare kilometraj Japonia — mașini japoneze | verifykm.com",
      description:
        "Verificați kilometrajul, licitațiile, accidentele și salvage pentru mașini japoneze. Raport VIN pentru Toyota, Honda, Nissan, Mazda, Subaru și Lexus.",
    },
    bg: {
      title: "Проверка на километраж Япония — японски коли | verifykm.com",
      description:
        "Проверете километража, аукционите, катастрофите и salvage за японски коли. VIN доклад за Toyota, Honda, Nissan, Mazda, Subaru и Lexus.",
    },
    ar: {
      title: "فحص كيلومترات اليابان — سيارات يابانية | verifykm.com",
      description:
        "تحقق من الكيلومترات والمزادات والحوادث والإتلاف للسيارات اليابانية. تقرير VIN لـ Toyota وHonda وNissan وMazda وSubaru وLexus.",
    },
    uk: {
      title: "Перевірка пробігу Японія — японські авто | verifykm.com",
      description:
        "Перевірте пробіг, аукціони, аварії та salvage японських авто. VIN-звіт для Toyota, Honda, Nissan, Mazda, Subaru і Lexus.",
    },
    ru: {
      title: "Проверка пробега Япония — японские авто | verifykm.com",
      description:
        "Проверьте пробег, аукционы, аварии и salvage японских авто. VIN-отчёт для Toyota, Honda, Nissan, Mazda, Subaru и Lexus.",
    },
    zh: {
      title: "日本里程核查 — 日系车 | verifykm.com",
      description:
        "核查日系车里程、拍卖评级、事故与报废记录。覆盖丰田、本田、日产、马自达、斯巴鲁与雷克萨斯的 VIN 报告。",
    },
  };
  fs.writeFileSync(seoPath, JSON.stringify(seo, null, 2) + "\n");
  console.log("seo-data.json: country_japan added");
} else {
  console.log("seo-data.json: country_japan already present");
}

// indexable paths
const idxPath = path.join(root, "src", "lib", "indexable-paths.json");
const idx = JSON.parse(fs.readFileSync(idxPath, "utf8"));
if (!idx.includes("/cars/japan")) {
  const i = idx.indexOf("/cars/uae");
  idx.splice(i >= 0 ? i + 1 : idx.length, 0, "/cars/japan");
  fs.writeFileSync(idxPath, JSON.stringify(idx, null, 2) + "\n");
  console.log("indexable-paths: /cars/japan");
}

console.log("done");
