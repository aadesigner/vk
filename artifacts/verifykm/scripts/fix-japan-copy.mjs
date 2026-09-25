/**
 * Soften Japan "auction grade" wording to match China/Korea page tone,
 * and rewrite Albanian (+ awkward calques) using the same vocabulary as country_china_*.
 * Run: node artifacts/verifykm/scripts/fix-japan-copy.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const i18nDir = path.join(__dirname, "..", "src", "i18n");

/** EN: drop "grades" — use same record/history wording as China */
const EN = {
  home_country_japan_h0: "Auction & export records",
  home_country_japan_h1: "Odometer & service history",
  home_country_japan_h2: "Accident & flood damage flags",
  country_japan_description:
    "Japan mileage check — verify odometer readings, auction history, accidents and export records on Japanese cars before you buy or import.",
  country_japan_issue_1: "Hidden auction damage — body repairs not disclosed overseas",
  country_japan_included_0: "Auction and marketplace listing records",
  country_japan_included_1: "Insurance claim and collision history",
  country_japan_included_2: "Registration and ownership transfer indicators",
  country_japan_included_3: "Salvage, write-off and rebuilt title flags",
  country_japan_included_4: "Odometer rollback detection across service records",
  country_japan_included_5: "Export/import and cross-border history signals",
  country_japan_included_sub:
    "Every report pulls auction, registration and marketplace signals across Japan's major markets and export channels.",
  country_japan_faq_0_a:
    "VINs starting with 'J' are assigned to vehicles manufactured in Japan. It confirms factory origin but does not guarantee a clean history — always check mileage, auction records and accidents.",
  country_japan_faq_2_a:
    "Yes. Run a VIN check before export to surface odometer fraud, auction damage and hidden accident repairs that may not appear in your destination country.",
  footer_japan_link_2: "Auction and export records",
};

/**
 * Albanian — mirror China page vocabulary (regjistra / manipulim / shenja / dëmtim total).
 * Avoid school-grade calques like "nota e ankandit".
 */
const SQ = {
  home_country_japan_h0: "Regjistra ankandesh dhe eksporti",
  home_country_japan_h1: "Kilometrazh dhe regjistra servisi",
  home_country_japan_h2: "Aksidente dhe rrezik përmbytjeje",
  country_japan_headline_origin: "për makina nga Japonia",
  country_japan_cycling_0: "kilometrash",
  country_japan_cycling_1: "aksidentesh",
  country_japan_cycling_2: "ankandesh",
  country_japan_cycling_3: "historinë e eksportit",
  country_japan_description:
    "Kontroll kilometrash makinash nga Japonia — manipulim km, dëmtime nga ankandet, aksidente të fshehura dhe histori eksporti. Kontrollo me shasi (VIN) para blerjes ose importit.",
  country_japan_issue_0:
    "Manipulim kilometrash — i zakonshëm te makinat vendase dhe të eksportuara me kilometra të lartë",
  country_japan_issue_1:
    "Dëmtime të fshehura nga ankandet — riparime karrocerie që shpesh nuk zbulohen jashtë vendit",
  country_japan_issue_2:
    "Automjete me dëmtime nga përmbytja ose tajfuni të rishitura pa zbulim të plotë",
  country_japan_issue_3:
    "Boshllëqe në regjistrat e eksportit — makina dërgohen jashtë me histori të paplotë",
  country_japan_included_0: "Regjistra ankandesh dhe listimesh në tregje",
  country_japan_included_1: "Histori kërkesash sigurimi dhe përplasjesh",
  country_japan_included_2: "Shenja regjistrimi dhe transferimi pronësie",
  country_japan_included_3: "Shenja dëmtim total, humbje totale dhe tituj rindërtimi",
  country_japan_included_4: "Zbulimi i manipulimit të kilometrave nëpër regjistra servisi",
  country_japan_included_5: "Shenja eksporti/importi dhe historie ndërkufitare",
  country_japan_issues_sub:
    "Shenjat më të zakonshme të rrezikut te makinat e përdorura japoneze — para se të paguani kapar.",
  country_japan_included_sub:
    "Çdo raport mbledh shenja ankandesh, regjistrimi dhe tregu në tregjet kryesore dhe kanalet e eksportit të Japonisë.",
  country_japan_included_note:
    "Të dhënat vijnë drejtpërdrejt nga ofruesit — nuk vlerësojmë apo fabrikojmë regjistra.",
  country_japan_faq_0_q: "Çfarë do të thotë një VIN japonez që fillon me «J»?",
  country_japan_faq_0_a:
    "VIN-et që fillojnë me «J» u caktohen automjeteve të prodhuara në Japoni. Konfirmon origjinën e fabrikës por nuk garanton histori të pastër — kontrolloni gjithmonë kilometrat, regjistrat e ankandeve dhe aksidentet.",
  country_japan_faq_1_q: "A mbulohen Toyota, Honda dhe Nissan?",
  country_japan_faq_1_a:
    "Po. Raportet tona mbulojnë markat kryesore japoneze përfshirë Toyota, Honda, Nissan, Mazda, Subaru, Lexus, Suzuki dhe Mitsubishi, si dhe automjete të importuara të regjistruara në Japoni.",
  country_japan_faq_2_q: "A mund të kontrolloj një makinë japoneze para importit?",
  country_japan_faq_2_a:
    "Po. Bëni kontroll VIN para eksportit për të zbuluar manipulim kilometrash, dëmtime nga ankandet dhe riparime të fshehura që mund të mos shfaqen në vendin tuaj.",
  country_japan_wwc_mileage_seo:
    "Krahasojmë leximet e kilometrave me shenja regjistrimi, regjistra servisi dhe të dhëna tregu në të gjithë Japoninë.",
  country_japan_wwc_accidents_seo:
    "Zbulojmë historinë e përplasjeve dhe kërkesave të sigurimit — përfshirë riparimet e fshehura të karrocerisë që shpesh mungojnë në shitje private dhe eksport.",
  country_japan_wwc_salvage_seo:
    "Shënojmë automjete me dëmtim total, humbje totale dhe rrezik përmbytjeje — përfshirë makina të rilistuara pas shpalljes së humbjes totale.",
  country_japan_wwc_theft_seo:
    "Kontrollojmë regjistra vjedhjesh, rikthimesh dhe shenja eksporti/importi që historia ndërkufitare të mos mbetet e fshehur.",
  country_japan_wwc_theft_stat_label: "regjistra vjedhjeje dhe eksporti të kontrolluar",
  footer_japan_link_1: "Histori makinash të përdorura japoneze",
  footer_japan_link_2: "Regjistra ankandesh dhe eksporti",
  footer_japan_link_3: "Kilometrazh dhe histori aksidentesh",
  footer_japan_link_4: "Histori Toyota Honda Nissan",
  compare_desc_japan:
    "Mjetet vetëm për Japoninë humbasin historinë e eksportit. verifykm mbulon Japoninë, Koreën, SHBA dhe më shumë në një raport.",
};

/** Soften other locales that calqued "grades/notat" awkwardly */
const EXTRA = {
  de: {
    home_country_japan_h0: "Auktion & Exportdaten",
    country_japan_description:
      "Japan-Kilometercheck — prüfen Sie Tachostand, Auktionshistorie, Unfälle und Exportdaten japanischer Autos vor Kauf oder Import.",
    country_japan_issue_1: "Versteckte Auktionsschäden — Blechreparaturen oft nicht ausgewiesen",
    country_japan_included_0: "Auktions- und Marktplatzdaten",
    country_japan_faq_0_a:
      "FIN mit „J“ stehen für Fahrzeuge aus japanischer Produktion. Das bestätigt den Herstellungsort, aber nicht eine saubere Historie — prüfen Sie immer Kilometer, Auktionsdaten und Unfälle.",
    country_japan_faq_2_a:
      "Ja. Prüfen Sie die FIN vor dem Export, um Tachomanipulation, Auktionsschäden und versteckte Reparaturen zu finden.",
  },
  es: {
    home_country_japan_h0: "Subastas e historial de exportación",
    country_japan_description:
      "Chequeo de kilometraje Japón — verifique odómetro, historial de subastas, accidentes e historial de exportación antes de comprar o importar.",
    country_japan_issue_1: "Daños de subasta ocultos — reparaciones de chapa no reveladas en el extranjero",
    country_japan_included_0: "Registros de subastas y listados de mercado",
    country_japan_cycling_2: "historial de subastas",
    country_japan_faq_0_a:
      "Los VIN con «J» se asignan a vehículos fabricados en Japón. Confirma el origen, no un historial limpio — revise siempre kilometraje, subastas y accidentes.",
    country_japan_faq_2_a:
      "Sí. Haga un chequeo VIN antes de la exportación para detectar fraude de odómetro, daños de subasta y reparaciones ocultas.",
    footer_japan_link_2: "Subastas y exportación",
  },
  fr: {
    home_country_japan_h0: "Enchères et historique d'export",
    country_japan_description:
      "Contrôle kilométrique Japon — vérifiez compteur, historique d'enchères, accidents et historique d'export avant achat ou import.",
    country_japan_issue_1: "Dommages d'enchères cachés — réparations de carrosserie non déclarées à l'étranger",
    country_japan_included_0: "Registres d'enchères et d'annonces marché",
    country_japan_faq_0_a:
      "Les VIN en « J » désignent des véhicules fabriqués au Japon. Cela confirme l'origine, pas un historique propre — vérifiez toujours kilométrage, enchères et accidents.",
    country_japan_faq_2_a:
      "Oui. Faites un contrôle VIN avant l'export pour détecter fraude au compteur, dommages d'enchères et réparations cachées.",
    footer_japan_link_2: "Enchères et export",
  },
  pl: {
    home_country_japan_h0: "Aukcje i historia eksportu",
    home_country_japan_h1: "Przebieg i serwis",
    home_country_japan_h2: "Wypadki i ryzyko powodzi",
    country_japan_description:
      "Sprawdzenie przebiegu Japonia — zweryfikuj licznik, historię aukcji, wypadki i eksport przed zakupem lub importem.",
    country_japan_issue_1: "Ukryte uszkodzenia z aukcji — naprawy blacharskie nieujawniane za granicą",
    country_japan_included_0: "Rejestry aukcji i ogłoszeń rynkowych",
    country_japan_faq_0_a:
      "VIN zaczynające się od „J” przypisuje się pojazdom wyprodukowanym w Japonii. Potwierdza to pochodzenie, nie czystą historię — zawsze sprawdź przebieg, aukcje i wypadki.",
    footer_japan_link_2: "Aukcje i eksport",
  },
  ro: {
    home_country_japan_h0: "Licitații și istoric de export",
    country_japan_description:
      "Verificare kilometraj Japonia — verificați odometrul, istoricul de licitații, accidentele și exportul înainte de cumpărare sau import.",
    country_japan_issue_1: "Daune de licitație ascunse — reparații de caroserie nedenunțate în străinătate",
    country_japan_included_0: "Registre de licitații și anunțuri pe piață",
    footer_japan_link_2: "Licitații și export",
  },
  bg: {
    home_country_japan_h0: "Аукциони и експортна история",
    country_japan_description:
      "Проверка на пробег Япония — проверете километража, аукционната история, катастрофите и експорта преди покупка или внос.",
    country_japan_issue_1: "Скрити аукционни щети — каросерийни ремонти, неразкрити в чужбина",
    country_japan_included_0: "Аукционни и пазарни записи",
    footer_japan_link_2: "Аукциони и експорт",
  },
  ru: {
    home_country_japan_h0: "Аукционы и история экспорта",
    country_japan_description:
      "Проверка пробега Япония — проверьте одометр, историю аукционов, аварии и экспорт перед покупкой или импортом.",
    country_japan_issue_1: "Скрытые повреждения с аукционов — кузовной ремонт не раскрыт за рубежом",
    country_japan_included_0: "Записи аукционов и рыночных объявлений",
    footer_japan_link_2: "Аукционы и экспорт",
  },
  uk: {
    home_country_japan_h0: "Аукціони та історія експорту",
    country_japan_description:
      "Перевірка пробігу Японія — перевірте одометр, історію аукціонів, ДТП та експорт перед покупкою або імпортом.",
    country_japan_issue_1: "Приховані пошкодження з аукціонів — кузовний ремонт не розкрито за кордоном",
    country_japan_included_0: "Записи аукціонів і ринкових оголошень",
    footer_japan_link_2: "Аукціони та експорт",
  },
  ka: {
    home_country_japan_h0: "აუქციონი და ექსპორტის ისტორია",
    country_japan_description:
      "გარბენის შემოწმება იაპონია — შეამოწმეთ ოდომეტრი, აუქციონის ისტორია, ავარიები და ექსპორტი ყიდვამდე ან იმპორტამდე.",
    country_japan_issue_1: "დაფარული აუქციონის დაზიანებები — კორპუსის რემონტი უცხოეთში არ ვლინდება",
    country_japan_included_0: "აუქციონისა და ბაზრის ჩანაწერები",
    footer_japan_link_2: "აუქციონი და ექსპორტი",
  },
  ar: {
    home_country_japan_h0: "سجلات المزاد والتصدير",
    country_japan_description:
      "فحص الكيلومترات اليابان — تحقق من العداد وسجل المزاد والحوادث والتصدير قبل الشراء أو الاستيراد.",
    country_japan_issue_1: "أضرار مزاد مخفية — إصلاحات هيكل غير مُفصح عنها في الخارج",
    country_japan_included_0: "سجلات المزادات وقوائم السوق",
    footer_japan_link_2: "المزاد والتصدير",
  },
  zh: {
    home_country_japan_h0: "拍卖与出口记录",
    country_japan_description:
      "日本里程核查 — 在购买或进口前核实里程表、拍卖历史、事故与出口记录。",
    country_japan_issue_1: "隐藏的拍卖损伤 — 钣金修复在海外常未披露",
    country_japan_included_0: "拍卖与市场挂牌记录",
    footer_japan_link_2: "拍卖与出口记录",
  },
};

function patch(lang, keys) {
  const file = path.join(i18nDir, `${lang}.json`);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  let n = 0;
  for (const [k, v] of Object.entries(keys)) {
    if (data[k] !== v) {
      data[k] = v;
      n++;
    }
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  console.log(`${lang}: ${n} keys`);
}

patch("en", EN);
patch("sq", SQ);
for (const [lang, keys] of Object.entries(EXTRA)) patch(lang, keys);

console.log("done");
