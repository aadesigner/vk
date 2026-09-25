/**
 * Align Japan country i18n with authentic per-locale patterns used by China/USA/UAE pages.
 * Fixes broken H1s like Albanian "Japoni kilometrash" → "Kontroll kilometrash … nga Japonia".
 * Run: node artifacts/verifykm/scripts/fix-japan-authentic-i18n.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const i18nDir = path.join(__dirname, "..", "src", "i18n");

/** Full authentic Japan blocks — headline/cycling mirror China grammar per locale. */
const JP = {
  en: {
    home_stat_japan: "Japan",
    home_country_japan_h0: "Auction & export records",
    home_country_japan_h1: "Odometer & service history",
    home_country_japan_h2: "Accident & flood damage flags",
    country_japan_label: "Japan",
    country_japan_name: "Japan",
    country_japan_headline_verb: "Japan",
    country_japan_headline_origin: "for cars from Japan",
    country_japan_headline_origin_prefix: "for cars from ",
    country_japan_cycling_0: "mileage check",
    country_japan_cycling_1: "accidents & repairs",
    country_japan_cycling_2: "auction history",
    country_japan_cycling_3: "export history",
    country_japan_description:
      "Japan mileage check — verify odometer readings, auction history, accidents and export records on Japanese cars before you buy or import.",
    country_japan_issue_0: "Odometer rollback — common on high-mileage domestic and exported cars",
    country_japan_issue_1: "Hidden auction damage — body repairs not disclosed overseas",
    country_japan_issue_2: "Flood or typhoon damage vehicles relisted without full disclosure",
    country_japan_issue_3: "Export record gaps — cars shipped overseas with incomplete domestic history",
    country_japan_included_0: "Auction and marketplace listing records",
    country_japan_included_1: "Insurance claim and collision history",
    country_japan_included_2: "Registration and ownership transfer indicators",
    country_japan_included_3: "Salvage, write-off and rebuilt title flags",
    country_japan_included_4: "Odometer rollback detection across service records",
    country_japan_included_5: "Export/import and cross-border history signals",
    country_japan_issues_sub: "The most common red flags on Japanese used vehicles — before you hand over a deposit.",
    country_japan_included_sub:
      "Every report pulls auction, registration and marketplace signals across Japan's major markets and export channels.",
    country_japan_included_note: "Data is sourced directly from providers — we do not estimate or fabricate records.",
    country_japan_faq_0_q: "What does a Japanese VIN starting with 'J' mean?",
    country_japan_faq_0_a:
      "VINs starting with 'J' are assigned to vehicles manufactured in Japan. It confirms factory origin but does not guarantee a clean history — always check mileage, auction records and accidents.",
    country_japan_faq_1_q: "Are Toyota, Honda and Nissan vehicles covered?",
    country_japan_faq_1_a:
      "Yes. Our reports cover major Japanese brands including Toyota, Honda, Nissan, Mazda, Subaru, Lexus, Suzuki and Mitsubishi, as well as imported vehicles registered in Japan.",
    country_japan_faq_2_q: "Can I check a Japanese car before importing it?",
    country_japan_faq_2_a:
      "Yes. Run a VIN check before export to surface odometer fraud, auction damage and hidden accident repairs that may not appear in your destination country.",
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
    footer_japan_link_2: "Auction and export records",
    footer_japan_link_3: "Odometer & accident history",
    footer_japan_link_4: "Toyota Honda Nissan history",
    compare_desc_japan:
      "Japan-only tools miss export and cross-border history. verifykm covers Japanese vehicles, Korea, USA, and more in one report.",
    demo_card_origin_japan: "Japan",
    compare_row_japanese: "Japanese vehicle records",
  },
  sq: {
    home_stat_japan: "Japonia",
    home_country_japan_h0: "Regjistra ankandesh dhe eksporti",
    home_country_japan_h1: "Kilometrazh dhe regjistra servisi",
    home_country_japan_h2: "Aksidente dhe rrezik përmbytjeje",
    country_japan_label: "Japonia",
    country_japan_name: "Japonia",
    country_japan_headline_verb: "Kontroll",
    country_japan_headline_origin: "për makina nga Japonia",
    country_japan_headline_origin_prefix: "për makina nga ",
    country_japan_cycling_0: "kilometrash",
    country_japan_cycling_1: "aksidentesh",
    country_japan_cycling_2: "historinë e ankandit",
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
    footer_japan_heading: "Japonia",
    footer_japan_link_1: "Histori makinash të përdorura japoneze",
    footer_japan_link_2: "Regjistra ankandesh dhe eksporti",
    footer_japan_link_3: "Kilometrazh dhe histori aksidentesh",
    footer_japan_link_4: "Histori Toyota Honda Nissan",
    compare_desc_japan:
      "Mjetet vetëm për Japoninë humbasin historinë e eksportit. verifykm mbulon Japoninë, Koreën, SHBA dhe më shumë në një raport.",
    demo_card_origin_japan: "Japonia",
    compare_row_japanese: "Regjistra automjetesh japoneze",
  },
  de: {
    home_stat_japan: "Japan",
    home_country_japan_h0: "Auktion & Exportdaten",
    home_country_japan_h1: "Kilometerstand & Service",
    home_country_japan_h2: "Unfall- & Flutschäden",
    country_japan_label: "Japan",
    country_japan_name: "Japan",
    country_japan_headline_verb: "Prüfen Sie",
    country_japan_headline_origin: "von Autos aus Japan",
    country_japan_headline_origin_prefix: "von Autos aus ",
    country_japan_cycling_0: "Kilometerstand",
    country_japan_cycling_1: "Unfälle",
    country_japan_cycling_2: "Auktionshistorie",
    country_japan_cycling_3: "Exporthistorie",
    country_japan_description:
      "Japan-Kilometercheck — prüfen Sie Tachostand, Auktionshistorie, Unfälle und Exportdaten japanischer Autos vor Kauf oder Import.",
    country_japan_issue_0: "Tachomanipulation — häufig bei hochkilometrigen Inlands- und Exportfahrzeugen",
    country_japan_issue_1: "Versteckte Auktionsschäden — Blechreparaturen oft nicht ausgewiesen",
    country_japan_issue_2: "Flut-/Taifunschäden ohne vollständige Angabe erneut verkauft",
    country_japan_issue_3: "Lücken in Exportdaten — unvollständige Inlandshistorie beim Versand",
    country_japan_included_0: "Auktions- und Marktplatzdaten",
    country_japan_included_1: "Versicherungs- und Kollisionshistorie",
    country_japan_included_2: "Zulassungs- und Eigentumswechsel",
    country_japan_included_3: "Salvage-, Totalschaden- und Rebuild-Flags",
    country_japan_included_4: "Tachomanipulation über Servicedaten",
    country_japan_included_5: "Export- und grenzüberschreitende Signale",
    country_japan_issues_sub: "Die häufigsten Warnsignale bei gebrauchten japanischen Fahrzeugen — vor der Anzahlung.",
    country_japan_included_sub:
      "Jeder Bericht zieht Auktions-, Zulassungs- und Marktplatzsignale aus Japans wichtigsten Märkten und Exportkanälen.",
    country_japan_included_note: "Daten stammen direkt von Anbietern — wir schätzen oder erfinden keine Einträge.",
    country_japan_faq_0_q: "Was bedeutet eine japanische FIN mit „J“?",
    country_japan_faq_0_a:
      "FIN mit „J“ stehen für Fahrzeuge aus japanischer Produktion. Das bestätigt den Herstellungsort, aber nicht eine saubere Historie — prüfen Sie immer Kilometer, Auktionsdaten und Unfälle.",
    country_japan_faq_1_q: "Sind Toyota, Honda und Nissan abgedeckt?",
    country_japan_faq_1_a:
      "Ja. Unsere Berichte decken große japanische Marken wie Toyota, Honda, Nissan, Mazda, Subaru, Lexus, Suzuki und Mitsubishi ab sowie importierte, in Japan zugelassene Fahrzeuge.",
    country_japan_faq_2_q: "Kann ich ein japanisches Auto vor dem Import prüfen?",
    country_japan_faq_2_a:
      "Ja. Prüfen Sie die FIN vor dem Export, um Tachomanipulation, Auktionsschäden und versteckte Reparaturen zu finden.",
    country_japan_wwc_mileage_seo:
      "Wir gleichen Tachostände mit Zulassungssignalen, Servicenachweisen und Marktdaten in ganz Japan ab.",
    country_japan_wwc_accidents_seo:
      "Wir decken Kollisions- und Versicherungshistorie auf — einschließlich versteckter Karosseriearbeiten.",
    country_japan_wwc_salvage_seo:
      "Wir markieren Salvage-, Totalschaden- und Flutrisiko — einschließlich nach Totalschaden erneut inserierter Autos.",
    country_japan_wwc_theft_seo:
      "Wir prüfen Diebstahl-/Wiederauffindungs- und Export-/Importsignale.",
    country_japan_wwc_theft_stat_label: "Diebstahl- & Exportdaten geprüft",
    footer_japan_heading: "Japan",
    footer_japan_link_1: "Japanische Gebrauchtwagenhistorie",
    footer_japan_link_2: "Auktion & Exportdaten",
    footer_japan_link_3: "Kilometer & Unfallhistorie",
    footer_japan_link_4: "Toyota Honda Nissan Historie",
    compare_desc_japan:
      "Nur-Japan-Tools fehlen Export- und Grenzdaten. verifykm deckt japanische Fahrzeuge, Korea, USA und mehr in einem Bericht ab.",
    demo_card_origin_japan: "Japan",
    compare_row_japanese: "Japanische Fahrzeugdaten",
  },
  es: {
    home_stat_japan: "Japón",
    home_country_japan_h0: "Subastas e historial de exportación",
    home_country_japan_h1: "Odómetro y servicio",
    home_country_japan_h2: "Accidentes y riesgo de inundación",
    country_japan_label: "Japón",
    country_japan_name: "Japón",
    country_japan_headline_verb: "Verifique",
    country_japan_headline_origin: "de coches de Japón",
    country_japan_headline_origin_prefix: "de coches de ",
    country_japan_cycling_0: "kilometraje",
    country_japan_cycling_1: "accidentes",
    country_japan_cycling_2: "historial de subastas",
    country_japan_cycling_3: "historial de exportación",
    country_japan_description:
      "Chequeo de kilometraje de coches de Japón — verifique odómetro, subastas, accidentes e historial de exportación antes de comprar o importar.",
    country_japan_issue_0: "Retroceso del odómetro — frecuente en coches de alto kilometraje y exportación",
    country_japan_issue_1: "Daños de subasta ocultos — reparaciones de chapa no reveladas en el extranjero",
    country_japan_issue_2: "Daños por inundación o tifón revendidos sin divulgación completa",
    country_japan_issue_3: "Huecos en exportación — historial nacional incompleto al enviarse",
    country_japan_included_0: "Registros de subastas y listados de mercado",
    country_japan_included_1: "Historial de seguros y colisiones",
    country_japan_included_2: "Indicadores de matriculación y transferencia",
    country_japan_included_3: "Alertas de salvamento, siniestro total y reconstrucción",
    country_japan_included_4: "Detección de fraude de odómetro en servicio",
    country_japan_included_5: "Señales de exportación e historial transfronterizo",
    country_japan_issues_sub: "Las señales de alerta más comunes en usados japoneses — antes del depósito.",
    country_japan_included_sub:
      "Cada informe reúne señales de subasta, matriculación y mercado en los principales canales de Japón.",
    country_japan_included_note: "Los datos vienen directamente de proveedores — no estimamos ni inventamos registros.",
    country_japan_faq_0_q: "¿Qué significa un VIN japonés que empieza por «J»?",
    country_japan_faq_0_a:
      "Los VIN con «J» se asignan a vehículos fabricados en Japón. Confirma el origen, no un historial limpio — revise siempre kilometraje, subastas y accidentes.",
    country_japan_faq_1_q: "¿Están cubiertos Toyota, Honda y Nissan?",
    country_japan_faq_1_a:
      "Sí. Cubrimos marcas japonesas principales como Toyota, Honda, Nissan, Mazda, Subaru, Lexus, Suzuki y Mitsubishi, además de importados matriculados en Japón.",
    country_japan_faq_2_q: "¿Puedo revisar un coche japonés antes de importarlo?",
    country_japan_faq_2_a:
      "Sí. Haga un chequeo VIN antes de la exportación para detectar fraude de odómetro, daños de subasta y reparaciones ocultas.",
    country_japan_wwc_mileage_seo:
      "Cruzamos lecturas del odómetro con matriculación, servicio y datos de mercado en Japón.",
    country_japan_wwc_accidents_seo:
      "Mostramos historial de colisiones y seguros — incluidas reparaciones de carrocería ocultas.",
    country_japan_wwc_salvage_seo:
      "Marcamos salvamento, siniestro total y riesgo de inundación — incluidos coches revendidos tras pérdida total.",
    country_japan_wwc_theft_seo:
      "Revisamos robos/recuperaciones y señales de exportación/importación.",
    country_japan_wwc_theft_stat_label: "robos y exportaciones verificados",
    footer_japan_heading: "Japón",
    footer_japan_link_1: "Historial de usados japoneses",
    footer_japan_link_2: "Subastas y exportación",
    footer_japan_link_3: "Odómetro y accidentes",
    footer_japan_link_4: "Historial Toyota Honda Nissan",
    compare_desc_japan:
      "Las herramientas solo Japón omiten historial de exportación. verifykm cubre vehículos japoneses, Corea, EE. UU. y más en un informe.",
    demo_card_origin_japan: "Japón",
    compare_row_japanese: "Registros de vehículos japoneses",
  },
  fr: {
    home_stat_japan: "Japon",
    home_country_japan_h0: "Enchères et historique d'export",
    home_country_japan_h1: "Compteur et entretien",
    home_country_japan_h2: "Accidents et risque d'inondation",
    country_japan_label: "Japon",
    country_japan_name: "Japon",
    country_japan_headline_verb: "Vérifiez",
    country_japan_headline_origin: "des voitures du Japon",
    country_japan_headline_origin_prefix: "des voitures de ",
    country_japan_cycling_0: "le kilométrage",
    country_japan_cycling_1: "les accidents",
    country_japan_cycling_2: "l'historique d'enchères",
    country_japan_cycling_3: "l'historique d'export",
    country_japan_description:
      "Contrôle kilométrique des voitures du Japon — vérifiez compteur, enchères, accidents et historique d'export avant achat ou import.",
    country_japan_issue_0: "Fraude au compteur — fréquente sur les voitures à fort kilométrage et à l'export",
    country_japan_issue_1: "Dommages d'enchères cachés — réparations de carrosserie non déclarées à l'étranger",
    country_japan_issue_2: "Véhicules endommagés par inondation ou typhon revendus sans divulgation complète",
    country_japan_issue_3: "Lacunes d'export — historique national incomplet à l'expédition",
    country_japan_included_0: "Registres d'enchères et d'annonces marché",
    country_japan_included_1: "Historique d'assurances et de collisions",
    country_japan_included_2: "Indicateurs d'immatriculation et de transfert",
    country_japan_included_3: "Alertes salvage, perte totale et reconstruction",
    country_japan_included_4: "Détection de fraude au compteur via l'entretien",
    country_japan_included_5: "Signaux d'export et d'historique transfrontalier",
    country_japan_issues_sub: "Les signaux d'alerte les plus courants sur les occasions japonaises — avant l'acompte.",
    country_japan_included_sub:
      "Chaque rapport croise enchères, immatriculation et marché sur les principaux canaux d'export du Japon.",
    country_japan_included_note: "Les données viennent directement des fournisseurs — nous n'estimons ni n'inventons rien.",
    country_japan_faq_0_q: "Que signifie un VIN japonais commençant par « J » ?",
    country_japan_faq_0_a:
      "Les VIN en « J » désignent des véhicules fabriqués au Japon. Cela confirme l'origine, pas un historique propre — vérifiez toujours kilométrage, enchères et accidents.",
    country_japan_faq_1_q: "Toyota, Honda et Nissan sont-ils couverts ?",
    country_japan_faq_1_a:
      "Oui. Nos rapports couvrent Toyota, Honda, Nissan, Mazda, Subaru, Lexus, Suzuki et Mitsubishi, ainsi que les importés immatriculés au Japon.",
    country_japan_faq_2_q: "Puis-je vérifier une voiture japonaise avant de l'importer ?",
    country_japan_faq_2_a:
      "Oui. Faites un contrôle VIN avant l'export pour détecter fraude au compteur, dommages d'enchères et réparations cachées.",
    country_japan_wwc_mileage_seo:
      "Nous croisons les lectures du compteur avec immatriculation, entretien et données de marché au Japon.",
    country_japan_wwc_accidents_seo:
      "Nous montrons l'historique de collisions et d'assurances — y compris les réparations de carrosserie cachées.",
    country_japan_wwc_salvage_seo:
      "Nous signalons salvage, perte totale et risque d'inondation — y compris les voitures revendues après total.",
    country_japan_wwc_theft_seo:
      "Nous vérifions vols/récupérations et signaux d'export/import.",
    country_japan_wwc_theft_stat_label: "vols et exports vérifiés",
    footer_japan_heading: "Japon",
    footer_japan_link_1: "Historique d'occasions japonaises",
    footer_japan_link_2: "Enchères et export",
    footer_japan_link_3: "Kilométrage et accidents",
    footer_japan_link_4: "Historique Toyota Honda Nissan",
    compare_desc_japan:
      "Les outils Japon seuls manquent l'historique d'export. verifykm couvre le Japon, la Corée, les USA et plus dans un rapport.",
    demo_card_origin_japan: "Japon",
    compare_row_japanese: "Données véhicules japonais",
  },
  pl: {
    home_stat_japan: "Japonia",
    home_country_japan_h0: "Aukcje i historia eksportu",
    home_country_japan_h1: "Przebieg i serwis",
    home_country_japan_h2: "Wypadki i ryzyko powodzi",
    country_japan_label: "Japonia",
    country_japan_name: "Japonia",
    country_japan_headline_verb: "Sprawdź",
    country_japan_headline_origin: "samochodów z Japonii",
    country_japan_headline_origin_prefix: "samochodów z ",
    country_japan_cycling_0: "przebieg",
    country_japan_cycling_1: "wypadki",
    country_japan_cycling_2: "historię aukcji",
    country_japan_cycling_3: "historię eksportu",
    country_japan_description:
      "Sprawdzenie przebiegu samochodów z Japonii — zweryfikuj licznik, historię aukcji, wypadki i eksport przed zakupem lub importem.",
    country_japan_issue_0: "Cofanie licznika — częste przy autach z wysokim przebiegiem i eksportowanych",
    country_japan_issue_1: "Ukryte uszkodzenia z aukcji — naprawy blacharskie nieujawniane za granicą",
    country_japan_issue_2: "Pojazdy z uszkodzeniami powodziowymi lub tajfunowymi sprzedawane bez pełnego ujawnienia",
    country_japan_issue_3: "Luki w historii eksportu — wysyłka za granicę z niepełną historią krajową",
    country_japan_included_0: "Rejestry aukcji i ogłoszeń rynkowych",
    country_japan_included_1: "Historia ubezpieczeń i kolizji",
    country_japan_included_2: "Wskaźniki rejestracji i przeniesienia własności",
    country_japan_included_3: "Flagi szkody całkowitej, spisania i odbudowy",
    country_japan_included_4: "Wykrywanie cofania licznika w serwisie",
    country_japan_included_5: "Sygnały eksportu i historii transgranicznej",
    country_japan_issues_sub: "Najczęstsze czerwone flagi przy japońskich używanych autach — przed zaliczką.",
    country_japan_included_sub:
      "Każdy raport łączy sygnały aukcyjne, rejestracyjne i rynkowe z głównych kanałów eksportu Japonii.",
    country_japan_included_note: "Dane pochodzą bezpośrednio od dostawców — nie szacujemy ani nie wymyślamy rekordów.",
    country_japan_faq_0_q: "Co oznacza japoński VIN zaczynający się od „J”?",
    country_japan_faq_0_a:
      "VIN zaczynające się od „J” przypisuje się pojazdom wyprodukowanym w Japonii. Potwierdza to pochodzenie, nie czystą historię — zawsze sprawdź przebieg, aukcje i wypadki.",
    country_japan_faq_1_q: "Czy Toyota, Honda i Nissan są objęte?",
    country_japan_faq_1_a:
      "Tak. Obejmujemy główne japońskie marki: Toyota, Honda, Nissan, Mazda, Subaru, Lexus, Suzuki i Mitsubishi, a także import zarejestrowany w Japonii.",
    country_japan_faq_2_q: "Czy mogę sprawdzić japońskie auto przed importem?",
    country_japan_faq_2_a:
      "Tak. Uruchom sprawdzenie VIN przed eksportem, by wykryć oszustwa licznika, szkody aukcyjne i ukryte naprawy.",
    country_japan_wwc_mileage_seo:
      "Porównujemy odczyty licznika z rejestracją, serwisem i danymi rynkowymi w Japonii.",
    country_japan_wwc_accidents_seo:
      "Pokazujemy historię kolizji i ubezpieczeń — w tym ukryte naprawy blacharskie.",
    country_japan_wwc_salvage_seo:
      "Oznaczamy szkodę całkowitą, spisanie i ryzyko powodzi — w tym auta odsprzedane po totalu.",
    country_japan_wwc_theft_seo:
      "Sprawdzamy kradzieże/odzyskania oraz sygnały eksportu/importu.",
    country_japan_wwc_theft_stat_label: "sprawdzone kradzieże i eksport",
    footer_japan_heading: "Japonia",
    footer_japan_link_1: "Historia japońskich używanych aut",
    footer_japan_link_2: "Aukcje i eksport",
    footer_japan_link_3: "Przebieg i wypadki",
    footer_japan_link_4: "Historia Toyota Honda Nissan",
    compare_desc_japan:
      "Narzędzia tylko-Japonia pomijają historię eksportu. verifykm obejmuje Japonię, Koreę, USA i więcej w jednym raporcie.",
    demo_card_origin_japan: "Japonia",
    compare_row_japanese: "Dane pojazdów japońskich",
  },
  ro: {
    home_stat_japan: "Japonia",
    home_country_japan_h0: "Licitații și istoric de export",
    home_country_japan_h1: "Kilometraj și service",
    home_country_japan_h2: "Accidente și risc de inundație",
    country_japan_label: "Japonia",
    country_japan_name: "Japonia",
    country_japan_headline_verb: "Verificați",
    country_japan_headline_origin: "ale mașinilor din Japonia",
    country_japan_headline_origin_prefix: "ale mașinilor din ",
    country_japan_cycling_0: "kilometrajul",
    country_japan_cycling_1: "accidentele",
    country_japan_cycling_2: "istoricul de licitații",
    country_japan_cycling_3: "istoricul de export",
    country_japan_description:
      "Verificare kilometraj pentru mașini din Japonia — verificați odometrul, licitațiile, accidentele și exportul înainte de cumpărare sau import.",
    country_japan_issue_0: "Rulare înapoi a odometrului — frecventă la mașini cu kilometraj mare și la export",
    country_japan_issue_1: "Daune de licitație ascunse — reparații de caroserie nedenunțate în străinătate",
    country_japan_issue_2: "Vehicule cu daune de inundație sau taifun revândute fără dezvăluire completă",
    country_japan_issue_3: "Goluri în istoricul de export — expediate cu istoric intern incomplet",
    country_japan_included_0: "Registre de licitații și anunțuri pe piață",
    country_japan_included_1: "Istoric de asigurări și coliziuni",
    country_japan_included_2: "Indicatori de înregistrare și transfer de proprietate",
    country_japan_included_3: "Indicatoare de daună totală, radiere și reconstrucție",
    country_japan_included_4: "Detectarea fraudelor de odometru din service",
    country_japan_included_5: "Semnale de export și istoric transfrontalier",
    country_japan_issues_sub: "Cele mai comune semnale de alarmă la second-hand japonez — înainte de avans.",
    country_japan_included_sub:
      "Fiecare raport combină semnale de licitație, înregistrare și piață din canalele majore de export ale Japoniei.",
    country_japan_included_note: "Datele vin direct de la furnizori — nu estimăm și nu inventăm înregistrări.",
    country_japan_faq_0_q: "Ce înseamnă un VIN japonez care începe cu „J”?",
    country_japan_faq_0_a:
      "VIN-urile cu „J” sunt atribuite vehiculelor fabricate în Japonia. Confirmă originea, nu un istoric curat — verificați mereu kilometrajul, licitațiile și accidentele.",
    country_japan_faq_1_q: "Sunt acoperite Toyota, Honda și Nissan?",
    country_japan_faq_1_a:
      "Da. Acoperim mărci japoneze majore precum Toyota, Honda, Nissan, Mazda, Subaru, Lexus, Suzuki și Mitsubishi, plus importuri înregistrate în Japonia.",
    country_japan_faq_2_q: "Pot verifica o mașină japoneză înainte de import?",
    country_japan_faq_2_a:
      "Da. Rulați o verificare VIN înainte de export pentru a detecta frauda de odometru, daunele de licitație și reparațiile ascunse.",
    country_japan_wwc_mileage_seo:
      "Corelăm citirile odometrului cu înregistrarea, service-ul și datele de piață din Japonia.",
    country_japan_wwc_accidents_seo:
      "Afișăm istoricul de coliziuni și asigurări — inclusiv reparații de caroserie ascunse.",
    country_japan_wwc_salvage_seo:
      "Marcăm dauna totală, radierea și riscul de inundație — inclusiv mașini revândute după total.",
    country_japan_wwc_theft_seo:
      "Verificăm furturi/recuperări și semnale de export/import.",
    country_japan_wwc_theft_stat_label: "furturi și exporturi verificate",
    footer_japan_heading: "Japonia",
    footer_japan_link_1: "Istoric auto second-hand japonez",
    footer_japan_link_2: "Licitații și export",
    footer_japan_link_3: "Kilometraj și accidente",
    footer_japan_link_4: "Istoric Toyota Honda Nissan",
    compare_desc_japan:
      "Instrumentele doar-Japonia ratează istoricul de export. verifykm acoperă Japonia, Coreea, SUA și mai mult într-un raport.",
    demo_card_origin_japan: "Japonia",
    compare_row_japanese: "Înregistrări auto japoneze",
  },
  bg: {
    home_stat_japan: "Япония",
    home_country_japan_h0: "Аукциони и експортна история",
    home_country_japan_h1: "Километраж и сервиз",
    home_country_japan_h2: "Катастрофи и риск от наводнение",
    country_japan_label: "Япония",
    country_japan_name: "Япония",
    country_japan_headline_verb: "Проверете",
    country_japan_headline_origin: "на автомобили от Япония",
    country_japan_headline_origin_prefix: "на автомобили от ",
    country_japan_cycling_0: "пробега",
    country_japan_cycling_1: "катастрофите",
    country_japan_cycling_2: "аукционната история",
    country_japan_cycling_3: "експортната история",
    country_japan_description:
      "Проверка на пробег на автомобили от Япония — проверете километража, аукционната история, катастрофите и експорта преди покупка или внос.",
    country_japan_issue_0: "Пренавиване на километража — често при автомобили с висок пробег и за експорт",
    country_japan_issue_1: "Скрити аукционни щети — каросерийни ремонти, неразкрити в чужбина",
    country_japan_issue_2: "Автомобили с щети от наводнение или тайфун, препродадени без пълно разкриване",
    country_japan_issue_3: "Пропуски в експортната история — изпратени в чужбина с непълна вътрешна история",
    country_japan_included_0: "Аукционни и пазарни записи",
    country_japan_included_1: "История на застраховки и сблъсъци",
    country_japan_included_2: "Индикатори за регистрация и прехвърляне",
    country_japan_included_3: "Флагове за тотал, отписване и възстановяване",
    country_japan_included_4: "Откриване на пренавиване чрез сервиз",
    country_japan_included_5: "Сигнали за експорт и трансгранична история",
    country_japan_issues_sub: "Най-честите червени флагове при японски употребявани коли — преди депозита.",
    country_japan_included_sub:
      "Всеки доклад събира аукционни, регистрационни и пазарни сигнали от основните експортни канали на Япония.",
    country_japan_included_note: "Данните идват директно от доставчици — не оценяваме и не измисляме записи.",
    country_japan_faq_0_q: "Какво означава японски VIN, започващ с „J“?",
    country_japan_faq_0_a:
      "VIN с „J“ се присвояват на превозни средства, произведени в Япония. Това потвърждава произхода, не чистата история — винаги проверявайте километража, аукционите и катастрофите.",
    country_japan_faq_1_q: "Покрити ли са Toyota, Honda и Nissan?",
    country_japan_faq_1_a:
      "Да. Покриваме основни японски марки като Toyota, Honda, Nissan, Mazda, Subaru, Lexus, Suzuki и Mitsubishi, както и вносни, регистрирани в Япония.",
    country_japan_faq_2_q: "Мога ли да проверя японска кола преди внос?",
    country_japan_faq_2_a:
      "Да. Направете VIN проверка преди експорт, за да откриете измама с километража, аукционни щети и скрити ремонти.",
    country_japan_wwc_mileage_seo:
      "Сравняваме показанията на километража с регистрация, сервиз и пазарни данни в Япония.",
    country_japan_wwc_accidents_seo:
      "Показваме история на сблъсъци и застраховки — включително скрити каросерийни ремонти.",
    country_japan_wwc_salvage_seo:
      "Маркираме тотал, отписване и риск от наводнение — включително коли, препродадени след тотална щета.",
    country_japan_wwc_theft_seo:
      "Проверяваме кражби/възстановявания и сигнали за експорт/импорт.",
    country_japan_wwc_theft_stat_label: "проверени кражби и експорт",
    footer_japan_heading: "Япония",
    footer_japan_link_1: "История на японски употребявани коли",
    footer_japan_link_2: "Аукциони и експорт",
    footer_japan_link_3: "Километраж и катастрофи",
    footer_japan_link_4: "История Toyota Honda Nissan",
    compare_desc_japan:
      "Инструментите само за Япония пропускат експортната история. verifykm покрива Япония, Корея, САЩ и повече в един доклад.",
    demo_card_origin_japan: "Япония",
    compare_row_japanese: "Данни за японски автомобили",
  },
  ka: {
    home_stat_japan: "იაპონია",
    home_country_japan_h0: "აუქციონი და ექსპორტის ისტორია",
    home_country_japan_h1: "გარბენი და სერვისი",
    home_country_japan_h2: "ავარიები და წყალდიდობის რისკი",
    country_japan_label: "იაპონია",
    country_japan_name: "იაპონია",
    country_japan_headline_verb: "შეამოწმეთ",
    country_japan_headline_origin: "იაპონიიდან მანქანების",
    country_japan_headline_origin_prefix: "მანქანების ",
    country_japan_cycling_0: "გარბენი",
    country_japan_cycling_1: "ავარიები",
    country_japan_cycling_2: "აუქციონის ისტორია",
    country_japan_cycling_3: "ექსპორტის ისტორია",
    country_japan_description:
      "იაპონიიდან მანქანების გარბენის შემოწმება — შეამოწმეთ ოდომეტრი, აუქციონი, ავარიები და ექსპორტი ყიდვამდე ან იმპორტამდე.",
    country_japan_issue_0: "გარბენის გადახვევა — ხშირია მაღალგარბენიან და ექსპორტირებულ მანქანებში",
    country_japan_issue_1: "დაფარული აუქციონის დაზიანებები — კორპუსის რემონტი უცხოეთში არ ვლინდება",
    country_japan_issue_2: "წყალდიდობის ან ტაიფუნის ზიანი ხელახლა იყიდება სრული გამჟღავნების გარეშე",
    country_japan_issue_3: "ექსპორტის ჩანაწერების ხარვეზები — არასრული შიდა ისტორია გაგზავნისას",
    country_japan_included_0: "აუქციონისა და ბაზრის ჩანაწერები",
    country_japan_included_1: "დაზღვევისა და შეჯახების ისტორია",
    country_japan_included_2: "რეგისტრაციისა და საკუთრების გადაცემის სიგნალები",
    country_japan_included_3: "სალვაჟის, ჩამოწერისა და აღდგენის ნიშნები",
    country_japan_included_4: "გარბენის გადახვევის გამოვლენა სერვისით",
    country_japan_included_5: "ექსპორტისა და საზღვრისპირა ისტორიის სიგნალები",
    country_japan_issues_sub: "იაპონური მეორადი მანქანების ყველაზე გავრცელებული გაფრთხილებები — დეპოზიტამდე.",
    country_japan_included_sub:
      "ყოველი ანგარიში აერთიანებს აუქციონის, რეგისტრაციისა და ბაზრის სიგნალებს იაპონიის ექსპორტის არხებიდან.",
    country_japan_included_note: "მონაცემები პირდაპირ მომწოდებლებისგანაა — ჩანაწერებს არ ვაფასებთ და არ ვიგონებთ.",
    country_japan_faq_0_q: "რას ნიშნავს იაპონური VIN, რომელიც იწყება „J“-ით?",
    country_japan_faq_0_a:
      "„J“-ით დაწყებული VIN ენიჭება იაპონიაში წარმოებულ მანქანებს. ეს ადასტურებს წარმოშობას, არა სუფთა ისტორიას — ყოველთვის შეამოწმეთ გარბენი, აუქციონი და ავარიები.",
    country_japan_faq_1_q: "არის თუ არა Toyota, Honda და Nissan დაფარული?",
    country_japan_faq_1_a:
      "დიახ. ვფარავთ ძირითად იაპონურ ბრენდებს: Toyota, Honda, Nissan, Mazda, Subaru, Lexus, Suzuki და Mitsubishi, ასევე იაპონიაში რეგისტრირებულ იმპორტს.",
    country_japan_faq_2_q: "შემიძლია იაპონური მანქანის შემოწმება იმპორტამდე?",
    country_japan_faq_2_a:
      "დიახ. გაუშვით VIN შემოწმება ექსპორტამდე გარბენის თაღლითობის, აუქციონის ზიანისა და დამალული რემონტის გამოსავლენად.",
    country_japan_wwc_mileage_seo:
      "ვადარებთ გარბენის მაჩვენებლებს რეგისტრაციას, სერვისსა და ბაზრის მონაცემებს იაპონიაში.",
    country_japan_wwc_accidents_seo:
      "ვაჩვენებთ შეჯახებისა და დაზღვევის ისტორიას — მათ შორის დამალულ კორპუსის რემონტს.",
    country_japan_wwc_salvage_seo:
      "ვნიშნავთ სალვაჟს, ჩამოწერას და წყალდიდობის რისკს — მათ შორის ხელახლა გაყიდულ ტოტალებს.",
    country_japan_wwc_theft_seo:
      "ვამოწმებთ ქურდობის/აღდგენისა და ექსპორტის/იმპორტის სიგნალებს.",
    country_japan_wwc_theft_stat_label: "შემოწმებული ქურდობა და ექსპორტი",
    footer_japan_heading: "იაპონია",
    footer_japan_link_1: "იაპონური მეორადი მანქანების ისტორია",
    footer_japan_link_2: "აუქციონი და ექსპორტი",
    footer_japan_link_3: "გარბენი და ავარიები",
    footer_japan_link_4: "Toyota Honda Nissan ისტორია",
    compare_desc_japan:
      "მხოლოდ-იაპონიის ხელსაწყოებს აკლია ექსპორტის ისტორია. verifykm ფარავს იაპონიას, კორეას, აშშ-ს და მეტს ერთ ანგარიშში.",
    demo_card_origin_japan: "იაპონია",
    compare_row_japanese: "იაპონური მანქანების ჩანაწერები",
  },
  ar: {
    home_stat_japan: "اليابان",
    home_country_japan_h0: "سجلات المزاد والتصدير",
    home_country_japan_h1: "العداد والصيانة",
    home_country_japan_h2: "الحوادث وخطر الفيضان",
    country_japan_label: "اليابان",
    country_japan_name: "اليابان",
    country_japan_headline_verb: "تحقق من",
    country_japan_headline_origin: "لسيارات من اليابان",
    country_japan_headline_origin_prefix: "لسيارات من ",
    country_japan_cycling_0: "الكيلومترات",
    country_japan_cycling_1: "الحوادث",
    country_japan_cycling_2: "سجل المزادات",
    country_japan_cycling_3: "سجل التصدير",
    country_japan_description:
      "فحص كيلومترات سيارات من اليابان — تحقق من العداد وسجل المزاد والحوادث والتصدير قبل الشراء أو الاستيراد.",
    country_japan_issue_0: "تلاعب بعداد المسافة — شائع في السيارات عالية الكيلومترات المصدّرة والمحلية",
    country_japan_issue_1: "أضرار مزاد مخفية — إصلاحات هيكل غير مُفصح عنها في الخارج",
    country_japan_issue_2: "سيارات بأضرار فيضان أو إعصار تُعاد للبيع دون إفصاح كامل",
    country_japan_issue_3: "فجوات في سجل التصدير — شحن للخارج بتاريخ محلي ناقص",
    country_japan_included_0: "سجلات المزادات وقوائم السوق",
    country_japan_included_1: "سجل التأمين والاصطدام",
    country_japan_included_2: "إشارات التسجيل ونقل الملكية",
    country_japan_included_3: "علامات الخسارة الكلية والإعادة للبناء",
    country_japan_included_4: "كشف التلاعب بالعداد عبر سجلات الصيانة",
    country_japan_included_5: "إشارات التصدير والتاريخ عبر الحدود",
    country_japan_issues_sub: "أبرز علامات التحذير في السيارات اليابانية المستعملة — قبل دفع العربون.",
    country_japan_included_sub:
      "كل تقرير يجمع إشارات المزاد والتسجيل والسوق عبر قنوات التصدير الرئيسية في اليابان.",
    country_japan_included_note: "البيانات من مزوّدين مباشرين — لا نقدّر ولا نختلق السجلات.",
    country_japan_faq_0_q: "ماذا يعني VIN ياباني يبدأ بـ «J»؟",
    country_japan_faq_0_a:
      "أرقام VIN التي تبدأ بـ «J» تُخصص للمركبات المصنّعة في اليابان. يؤكد ذلك المنشأ لا السجل النظيف — تحقق دائماً من الكيلومترات والمزاد والحوادث.",
    country_japan_faq_1_q: "هل تُغطى تويوتا وهوندا ونيسان؟",
    country_japan_faq_1_a:
      "نعم. نغطي العلامات اليابانية الرئيسية مثل تويوتا وهوندا ونيسان ومازدا وسوبارو ولكزس وسوزوكي وميتسوبيشي، إضافةً إلى المستورد المسجّل في اليابان.",
    country_japan_faq_2_q: "هل يمكنني فحص سيارة يابانية قبل استيرادها؟",
    country_japan_faq_2_a:
      "نعم. نفّذ فحص VIN قبل التصدير لكشف تلاعب العداد وأضرار المزاد والإصلاحات المخفية.",
    country_japan_wwc_mileage_seo:
      "نطابق قراءات العداد مع التسجيل والصيانة وبيانات السوق في اليابان.",
    country_japan_wwc_accidents_seo:
      "نُظهر سجل الاصطدام والتأمين — بما في ذلك إصلاحات الهيكل المخفية.",
    country_japan_wwc_salvage_seo:
      "نُعلّم الخسارة الكلية وخطر الفيضان — بما في ذلك السيارات المُعادة للبيع بعد إعلان الخسارة.",
    country_japan_wwc_theft_seo:
      "نتحقق من سجلات السرقة والاسترداد وإشارات التصدير/الاستيراد.",
    country_japan_wwc_theft_stat_label: "سجلات السرقة والتصدير مُتحقَّق منها",
    footer_japan_heading: "اليابان",
    footer_japan_link_1: "سجل السيارات اليابانية المستعملة",
    footer_japan_link_2: "المزاد والتصدير",
    footer_japan_link_3: "العداد والحوادث",
    footer_japan_link_4: "سجل تويوتا هوندا نيسان",
    compare_desc_japan:
      "أدوات اليابان فقط تفوّت سجل التصدير. verifykm يغطي اليابان وكوريا والولايات المتحدة والمزيد في تقرير واحد.",
    demo_card_origin_japan: "اليابان",
    compare_row_japanese: "سجلات المركبات اليابانية",
  },
  uk: {
    home_stat_japan: "Японія",
    home_country_japan_h0: "Аукціони та історія експорту",
    home_country_japan_h1: "Пробіг і сервіс",
    home_country_japan_h2: "ДТП та ризик затоплення",
    country_japan_label: "Японія",
    country_japan_name: "Японія",
    country_japan_headline_verb: "Перевір",
    country_japan_headline_origin: "автомобілів з Японії",
    country_japan_headline_origin_prefix: "автомобілів з ",
    country_japan_cycling_0: "пробіг",
    country_japan_cycling_1: "аварії",
    country_japan_cycling_2: "історію аукціонів",
    country_japan_cycling_3: "історію експорту",
    country_japan_description:
      "Перевірка пробігу автомобілів з Японії — перевірте одометр, аукціони, ДТП та експорт перед покупкою або імпортом.",
    country_japan_issue_0: "Скручування пробігу — часто у авто з великим пробігом і на експорт",
    country_japan_issue_1: "Приховані пошкодження з аукціонів — кузовний ремонт не розкрито за кордоном",
    country_japan_issue_2: "Авто з пошкодженнями від повені чи тайфуну перепродають без повного розкриття",
    country_japan_issue_3: "Пробіли в експортній історії — відправка за кордон із неповною внутрішньою історією",
    country_japan_included_0: "Записи аукціонів і ринкових оголошень",
    country_japan_included_1: "Історія страхових випадків і зіткнень",
    country_japan_included_2: "Індикатори реєстрації та зміни власника",
    country_japan_included_3: "Прапорці тоталу, списання та відновлення",
    country_japan_included_4: "Виявлення скручування пробігу за сервісом",
    country_japan_included_5: "Сигнали експорту та транскордонної історії",
    country_japan_issues_sub: "Найчастіші червоні прапорці в японських б/в авто — до завдатку.",
    country_japan_included_sub:
      "Кожен звіт об’єднує аукціонні, реєстраційні та ринкові сигнали з основних експортних каналів Японії.",
    country_japan_included_note: "Дані напряму від постачальників — ми не оцінюємо й не вигадуємо записи.",
    country_japan_faq_0_q: "Що означає японський VIN, що починається з «J»?",
    country_japan_faq_0_a:
      "VIN з «J» присвоюють автомобілям, виготовленим у Японії. Це підтверджує походження, а не чисту історію — завжди перевіряйте пробіг, аукціони та ДТП.",
    country_japan_faq_1_q: "Чи покрито Toyota, Honda і Nissan?",
    country_japan_faq_1_a:
      "Так. Ми покриваємо основні японські бренди: Toyota, Honda, Nissan, Mazda, Subaru, Lexus, Suzuki і Mitsubishi, а також імпорт, зареєстрований у Японії.",
    country_japan_faq_2_q: "Чи можна перевірити японське авто перед імпортом?",
    country_japan_faq_2_a:
      "Так. Запустіть перевірку VIN до експорту, щоб виявити скрутку пробігу, аукціонні пошкодження та прихований ремонт.",
    country_japan_wwc_mileage_seo:
      "Звіряємо показники одометра з реєстрацією, сервісом і ринковими даними по Японії.",
    country_japan_wwc_accidents_seo:
      "Показуємо історію зіткнень і страхових випадків — включно з прихованим кузовним ремонтом.",
    country_japan_wwc_salvage_seo:
      "Позначаємо тотал, списання та ризик затоплення — включно з авто, перепроданими після тоталу.",
    country_japan_wwc_theft_seo:
      "Перевіряємо викрадення/повернення та сигнали експорту/імпорту.",
    country_japan_wwc_theft_stat_label: "перевірені викрадення та експорт",
    footer_japan_heading: "Японія",
    footer_japan_link_1: "Історія японських б/в авто",
    footer_japan_link_2: "Аукціони та експорт",
    footer_japan_link_3: "Пробіг і ДТП",
    footer_japan_link_4: "Історія Toyota Honda Nissan",
    compare_desc_japan:
      "Інструменти лише для Японії пропускають історію експорту. verifykm покриває Японію, Корею, США та більше в одному звіті.",
    demo_card_origin_japan: "Японія",
    compare_row_japanese: "Дані японських авто",
  },
  ru: {
    home_stat_japan: "Япония",
    home_country_japan_h0: "Аукционы и история экспорта",
    home_country_japan_h1: "Пробег и сервис",
    home_country_japan_h2: "Аварии и риск затопления",
    country_japan_label: "Япония",
    country_japan_name: "Япония",
    country_japan_headline_verb: "Проверь",
    country_japan_headline_origin: "автомобилей из Японии",
    country_japan_headline_origin_prefix: "автомобилей из ",
    country_japan_cycling_0: "пробег",
    country_japan_cycling_1: "аварии",
    country_japan_cycling_2: "историю аукционов",
    country_japan_cycling_3: "историю экспорта",
    country_japan_description:
      "Проверка пробега автомобилей из Японии — проверьте одометр, аукционы, аварии и экспорт перед покупкой или импортом.",
    country_japan_issue_0: "Скрутка пробега — часто у машин с большим пробегом и на экспорт",
    country_japan_issue_1: "Скрытые повреждения с аукционов — кузовной ремонт не раскрыт за рубежом",
    country_japan_issue_2: "Авто с повреждениями от наводнения или тайфуна перепродаются без полного раскрытия",
    country_japan_issue_3: "Пробелы в экспортной истории — отправка за рубеж с неполной внутренней историей",
    country_japan_included_0: "Записи аукционов и рыночных объявлений",
    country_japan_included_1: "История страховых случаев и столкновений",
    country_japan_included_2: "Индикаторы регистрации и смены собственника",
    country_japan_included_3: "Флаги тотала, списания и восстановления",
    country_japan_included_4: "Выявление скрутки пробега по сервису",
    country_japan_included_5: "Сигналы экспорта и трансграничной истории",
    country_japan_issues_sub: "Самые частые красные флаги у японских б/у авто — до задатка.",
    country_japan_included_sub:
      "Каждый отчёт объединяет аукционные, регистрационные и рыночные сигналы с основных экспортных каналов Японии.",
    country_japan_included_note: "Данные напрямую от поставщиков — мы не оцениваем и не выдумываем записи.",
    country_japan_faq_0_q: "Что значит японский VIN, начинающийся с «J»?",
    country_japan_faq_0_a:
      "VIN с «J» присваиваются автомобилям, произведённым в Японии. Это подтверждает происхождение, но не чистую историю — всегда проверяйте пробег, аукционы и аварии.",
    country_japan_faq_1_q: "Покрыты ли Toyota, Honda и Nissan?",
    country_japan_faq_1_a:
      "Да. Мы покрываем основные японские бренды: Toyota, Honda, Nissan, Mazda, Subaru, Lexus, Suzuki и Mitsubishi, а также импорт, зарегистрированный в Японии.",
    country_japan_faq_2_q: "Можно ли проверить японское авто до импорта?",
    country_japan_faq_2_a:
      "Да. Запустите проверку VIN до экспорта, чтобы выявить скрутку пробега, аукционные повреждения и скрытый ремонт.",
    country_japan_wwc_mileage_seo:
      "Сверяем показания одометра с регистрацией, сервисом и рыночными данными по Японии.",
    country_japan_wwc_accidents_seo:
      "Показываем историю столкновений и страховых случаев — включая скрытый кузовной ремонт.",
    country_japan_wwc_salvage_seo:
      "Отмечаем тотал, списание и риск затопления — включая авто, перепроданные после тотала.",
    country_japan_wwc_theft_seo:
      "Проверяем угоны/возвраты и сигналы экспорта/импорта.",
    country_japan_wwc_theft_stat_label: "проверены угоны и экспорт",
    footer_japan_heading: "Япония",
    footer_japan_link_1: "История японских б/у авто",
    footer_japan_link_2: "Аукционы и экспорт",
    footer_japan_link_3: "Пробег и аварии",
    footer_japan_link_4: "История Toyota Honda Nissan",
    compare_desc_japan:
      "Инструменты только для Японии пропускают историю экспорта. verifykm покрывает Японию, Корею, США и больше в одном отчёте.",
    demo_card_origin_japan: "Япония",
    compare_row_japanese: "Данные японских авто",
  },
  zh: {
    home_stat_japan: "日本",
    home_country_japan_h0: "拍卖与出口记录",
    home_country_japan_h1: "里程与保养",
    home_country_japan_h2: "事故与水浸风险",
    country_japan_label: "日本",
    country_japan_name: "日本",
    country_japan_headline_verb: "查询",
    country_japan_headline_origin: "来自日本的汽车",
    country_japan_headline_origin_prefix: "来自",
    country_japan_cycling_0: "里程",
    country_japan_cycling_1: "事故",
    country_japan_cycling_2: "拍卖历史",
    country_japan_cycling_3: "出口历史",
    country_japan_description:
      "日本汽车里程核查 — 在购买或进口前核实里程表、拍卖历史、事故与出口记录。",
    country_japan_issue_0: "里程表回拨 — 在高里程及出口车中很常见",
    country_japan_issue_1: "隐藏的拍卖损伤 — 钣金修复在海外常未披露",
    country_japan_issue_2: "水浸或台风损伤车辆在未充分披露的情况下重新上架",
    country_japan_issue_3: "出口记录缺口 — 运往海外时国内历史不完整",
    country_japan_included_0: "拍卖与市场挂牌记录",
    country_japan_included_1: "保险理赔与碰撞历史",
    country_japan_included_2: "注册与所有权转移信号",
    country_japan_included_3: "报废、注销与重建标记",
    country_japan_included_4: "通过保养记录检测里程回拨",
    country_japan_included_5: "出口与跨境历史信号",
    country_japan_issues_sub: "日系二手车最常见的风险信号 — 付定金前先看清。",
    country_japan_included_sub: "每份报告汇总日本主要出口渠道的拍卖、注册与市场信号。",
    country_japan_included_note: "数据直接来自供应商 — 我们不估算、不编造记录。",
    country_japan_faq_0_q: "以「J」开头的日本 VIN 是什么意思？",
    country_japan_faq_0_a:
      "以「J」开头的 VIN 分配给日本制造的车辆。这确认产地，不代表历史干净 — 务必核查里程、拍卖与事故。",
    country_japan_faq_1_q: "是否覆盖丰田、本田和日产？",
    country_japan_faq_1_a:
      "是。我们覆盖丰田、本田、日产、马自达、斯巴鲁、雷克萨斯、铃木、三菱等主要日系品牌，以及在日本注册的进口车。",
    country_japan_faq_2_q: "进口前可以检查日本车吗？",
    country_japan_faq_2_a:
      "可以。在出口前进行 VIN 核查，可发现里程欺诈、拍卖损伤和隐藏维修。",
    country_japan_wwc_mileage_seo: "我们将里程读数与日本的注册、保养与市场数据交叉核对。",
    country_japan_wwc_accidents_seo: "展示碰撞与保险理赔历史 — 包括私下与出口销售中常被省略的钣金修复。",
    country_japan_wwc_salvage_seo: "标记报废、注销与水浸风险 — 包括全损申报后重新上架的车辆。",
    country_japan_wwc_theft_seo: "核查失窃/找回记录以及进出口信号。",
    country_japan_wwc_theft_stat_label: "已核查失窃与出口记录",
    footer_japan_heading: "日本",
    footer_japan_link_1: "日本二手车历史",
    footer_japan_link_2: "拍卖与出口记录",
    footer_japan_link_3: "里程与事故历史",
    footer_japan_link_4: "丰田本田日产历史",
    compare_desc_japan: "仅限日本的工具会漏掉出口与跨境历史。verifykm 一份报告覆盖日本、韩国、美国及更多市场。",
    demo_card_origin_japan: "日本",
    compare_row_japanese: "日本车辆记录",
  },
};

const SEO_JP = {
  en: {
    title: "Japan Mileage Check — Japanese Cars | verifykm.com",
    description:
      "Japan mileage check for Japanese cars. Verify km, auction history, accidents and salvage — Toyota, Honda, Nissan, Mazda, Subaru and Lexus.",
  },
  de: {
    title: "Japan-Kilometercheck — Autos aus Japan | verifykm.com",
    description:
      "Japanische Fahrzeuge per VIN prüfen: Kilometerstand, Auktionshistorie, Unfälle und Salvage. Bericht für Toyota, Honda, Nissan, Mazda, Subaru und Lexus.",
  },
  es: {
    title: "Chequeo kilometraje Japón — coches de Japón | verifykm.com",
    description:
      "Verifique kilometraje, subastas, accidentes y salvamento en coches de Japón. Informe VIN para Toyota, Honda, Nissan, Mazda, Subaru y Lexus.",
  },
  fr: {
    title: "Contrôle kilométrique Japon — voitures du Japon | verifykm.com",
    description:
      "Vérifiez un véhicule du Japon par VIN : kilométrage, enchères, accidents et épave. Rapport pour Toyota, Honda, Nissan, Mazda, Subaru et Lexus.",
  },
  sq: {
    title: "Kontroll kilometrash Japoni — makina nga Japonia | verifykm.com",
    description:
      "Kontrolloni kilometrazhin, ankandet, aksidentet dhe dëmtimin total për makina nga Japonia. Raport VIN për Toyota, Honda, Nissan, Mazda, Subaru dhe Lexus.",
  },
  pl: {
    title: "Sprawdzenie przebiegu Japonia — auta z Japonii | verifykm.com",
    description:
      "Sprawdź auto z Japonii po VIN: przebieg, aukcje, wypadki i szkoda całkowita. Raport dla Toyota, Honda, Nissan, Mazda, Subaru i Lexus.",
  },
  ka: {
    title: "იაპონური მანქანები — გარბენი და ისტორია | verifykm.com",
    description:
      "შეამოწმეთ იაპონიიდან მანქანის გარბენი, აუქციონი, ავარიები და სალვაჟი. VIN ანგარიში Toyota, Honda, Nissan, Mazda, Subaru და Lexus-ისთვის.",
  },
  ro: {
    title: "Verificare kilometraj Japonia — mașini din Japonia | verifykm.com",
    description:
      "Verificați mașini din Japonia după VIN: kilometraj, licitații, accidente și daună totală. Raport pentru Toyota, Honda, Nissan, Mazda, Subaru și Lexus.",
  },
  bg: {
    title: "Проверка на пробег Япония — автомобили от Япония | verifykm.com",
    description:
      "Проверете автомобил от Япония по VIN: километраж, аукциони, катастрофи и тотал. Доклад за Toyota, Honda, Nissan, Mazda, Subaru и Lexus.",
  },
  ar: {
    title: "فحص كيلومترات اليابان — سيارات من اليابان | verifykm.com",
    description:
      "تحقق من سيارات اليابان عبر VIN: العداد والمزاد والحوادث والخسارة الكلية. تقرير لتويوتا وهوندا ونيسان ومازدا وسوبارو ولكزس.",
  },
  uk: {
    title: "Перевірка пробігу Японія — авто з Японії | verifykm.com",
    description:
      "Перевірте авто з Японії за VIN: пробіг, аукціони, ДТП і тотал. Звіт для Toyota, Honda, Nissan, Mazda, Subaru і Lexus.",
  },
  ru: {
    title: "Проверка пробега Япония — авто из Японии | verifykm.com",
    description:
      "Проверьте авто из Японии по VIN: пробег, аукционы, аварии и тотал. Отчёт для Toyota, Honda, Nissan, Mazda, Subaru и Lexus.",
  },
  zh: {
    title: "日本里程核查 — 日本汽车 | verifykm.com",
    description:
      "按 VIN 核查日本汽车：里程、拍卖、事故与报废。覆盖丰田、本田、日产、马自达、斯巴鲁与雷克萨斯。",
  },
};

for (const [lang, keys] of Object.entries(JP)) {
  const file = path.join(i18nDir, `${lang}.json`);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  Object.assign(data, keys);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  console.log("i18n", lang, Object.keys(keys).length, "keys →", data.country_japan_headline_verb, "+", data.country_japan_cycling_0);
}

const seoPath = path.join(__dirname, "..", "src", "lib", "seo-data.json");
const seo = JSON.parse(fs.readFileSync(seoPath, "utf8"));
seo.country_japan = seo.country_japan || {};
for (const [lang, entry] of Object.entries(SEO_JP)) {
  seo.country_japan[lang] = entry;
}
fs.writeFileSync(seoPath, JSON.stringify(seo, null, 2) + "\n");
console.log("seo-data country_japan updated");

const mseoPath = path.resolve(__dirname, "../../../lib/marketing-page-seo/marketing-seo-data.json");
if (fs.existsSync(mseoPath)) {
  const mseo = JSON.parse(fs.readFileSync(mseoPath, "utf8"));
  mseo.country_japan = seo.country_japan;
  fs.writeFileSync(mseoPath, JSON.stringify(mseo, null, 2) + "\n");
  console.log("marketing-seo-data synced");
}

console.log("done");
