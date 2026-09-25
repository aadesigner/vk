/**
 * Sync VerifyKM voice keys + SEO meta across all locales.
 */
import fs from "fs";
import path from "path";

const i18nDir = "C:/Users/Pc/Downloads/vk/artifacts/verifykm/src/i18n";
const seoPath = "C:/Users/Pc/Downloads/vk/artifacts/verifykm/src/lib/seo-data.json";

/** Per-language translations of the EN VerifyKM voice keys. */
const voice = {
  de: {
    hero_headline_1: "Öffnen Sie das VIN-Dossier.",
    hero_headline_2: "bevor der Verkäufer die Geschichte bestimmt",
    hero_subtext:
      "VerifyKM macht aus einer 17-stelligen Fahrgestellnummer eine Beweismappe — Auktionsverläufe, Versicherungstreffer, Kilometerhistorie und Kennzeichnungen — damit Importe und Privatkäufe mit Akten starten, nicht mit Versprechen.",
    how_it_works: "Der VerifyKM-Ablauf",
    how_it_works_desc: "Fahrgestellnummer eingeben. Akte freischalten. Lesen, was die Datenbanken bereits wissen.",
    countries_title: "Märkte, die wir prüfen",
    countries_subtitle: "Wählen Sie eine Marktspur. Jeder Leitfaden erklärt, wonach VerifyKM in diesem Herkunftsland sucht.",
    stats_countries_badge: "Abdeckung",
    cta_title: "Mit Dossier kaufen. Nicht nach Bauchgefühl.",
    cta_desc: "€19,99 schaltet eine vollständige VIN-Akte frei — oder sparen Sie mit Mehrfach-Paketen.",
    footer_tagline:
      "VerifyKM ist ein VIN-Ermittlungsdesk für Importeure und sorgfältige Käufer. Zuerst Beweise. Nie Rätselraten.",
    footer_data_source: "Auktion · Versicherung · Marktplatz · Zulassungssignale",
    footer_investigate_label: "Prüfen",
    footer_investigate_cta: "Kaufen Sie kein Auto im Zweifel. Kaufen Sie es sicher.",
    footer_explore: "Entdecken",
    footer_markets: "Marktspuren",
    footer_rights_line: "VIN-Ermittlung für ernsthafte Gebrauchtwagen-Entscheidungen.",
    check_vin: "Dossier öffnen",
    get_started: "Dossier starten",
    my_reports: "Meine Dossiers",
    view_report: "Dossier öffnen",
    view_dossier: "Dossier öffnen",
    dashboard_case_file: "Akte",
    vin_case_id_label: "Akten-ID · VIN",
    pricing_hero_title_1: "Einmal zahlen.",
    pricing_hero_title_2: "Eine vollständige Beweisakte.",
    pricing_hero_lead:
      "€19,99 pro Dossier (statt €29,99). Pakete: €16,99 je ×3 oder €12,99 je ×5.",
    pricing_subtitle: "Transparente Dossier-Preise — kein Abo, kein Reseller-Portal.",
    pricing_hero_eyebrow: "Einführungspreis · War €29,99",
    free_decoder_title: "Kostenloser Chassis-Decoder",
    free_decoder_title_highlight: "Chassis-Decoder",
    free_decoder_subtitle:
      "Lesen Sie Baujahr, Marke, Modell und Werk aus der VIN-Struktur — dann schalten Sie das volle VerifyKM-Dossier für Kilometer und Schadensnachweise frei.",
    faq: "Fragen",
    nav_how_it_works: "Ablauf",
    pricing: "Dossier-Preise",
    per_report: "pro vollständigem Dossier · war €29,99",
    countries_subtitle_fallback: true,
  },
  es: {
    hero_headline_1: "Abra el dossier VIN.",
    hero_headline_2: "antes de que el vendedor controle la historia",
    hero_subtext:
      "VerifyKM convierte un número de chasis de 17 caracteres en un expediente de evidencia: subastas, seguros, odómetros y títulos marcados — para que las importaciones y compras particulares empiecen con registros, no promesas.",
    how_it_works: "El flujo VerifyKM",
    how_it_works_desc: "Introduzca el chasis. Desbloquee el archivo. Lea lo que las bases de datos ya saben.",
    countries_title: "Mercados que investigamos",
    countries_subtitle: "Elija un mercado. Cada guía explica qué busca VerifyKM en ese origen.",
    stats_countries_badge: "Cobertura",
    cta_title: "Compre con un dossier. No con intuición.",
    cta_desc: "19,99 € desbloquea un archivo VIN completo — o ahorre con packs multi-informe.",
    footer_tagline:
      "VerifyKM es un escritorio de investigación VIN para importadores y compradores cuidadosos. Primero evidencia. Nunca conjeturas.",
    footer_data_source: "Subasta · seguro · marketplace · señales de registro",
    footer_investigate_label: "Investigar",
    footer_investigate_cta: "No compre un coche con dudas. Cómprelo seguro.",
    footer_explore: "Explorar",
    footer_markets: "Mercados",
    footer_rights_line: "Investigación VIN para decisiones serias de coche de ocasión.",
    check_vin: "Abrir dossier",
    get_started: "Empezar dossier",
    my_reports: "Mis dossiers",
    view_report: "Abrir dossier",
    view_dossier: "Abrir dossier",
    dashboard_case_file: "Expediente",
    vin_case_id_label: "ID de caso · VIN",
    pricing_hero_title_1: "Un solo pago.",
    pricing_hero_title_2: "Un archivo de evidencia completo.",
    pricing_hero_lead:
      "19,99 € por dossier (antes 29,99 €). Packs: 16,99 € cada uno ×3, o 12,99 € cada uno ×5.",
    pricing_subtitle: "Precios claros de dossier — sin suscripción ni portal revendedor.",
    pricing_hero_eyebrow: "Precio de lanzamiento · Era 29,99 €",
    free_decoder_title: "Decodificador de chasis gratis",
    free_decoder_title_highlight: "decodificador de chasis",
    free_decoder_subtitle:
      "Lea año, marca, modelo y planta de la estructura VIN — luego desbloquee el dossier VerifyKM completo para kilometraje y daños.",
    faq: "Preguntas",
    nav_how_it_works: "Flujo",
    pricing: "Precios del dossier",
    per_report: "por dossier completo · era 29,99 €",
  },
  fr: {
    hero_headline_1: "Ouvrez le dossier VIN.",
    hero_headline_2: "avant que le vendeur ne raconte l'histoire",
    hero_subtext:
      "VerifyKM transforme un numéro de châssis à 17 caractères en dossier de preuves — enchères, assurances, kilométrage et titres marqués — pour que les imports et achats privés commencent par des registres, pas des promesses.",
    how_it_works: "Le parcours VerifyKM",
    how_it_works_desc: "Saisissez le châssis. Débloquez le fichier. Lisez ce que les bases savent déjà.",
    countries_title: "Marchés que nous investiguons",
    countries_subtitle: "Choisissez une piste marché. Chaque guide explique ce que VerifyKM cherche pour cette origine.",
    stats_countries_badge: "Couverture",
    cta_title: "Achetez avec un dossier. Pas au feeling.",
    cta_desc: "19,99 € débloque un fichier VIN complet — ou économisez avec des packs multi-rapports.",
    footer_tagline:
      "VerifyKM est un bureau d'investigation VIN pour importateurs et acheteurs exigeants. Preuves d'abord. Jamais d'à-peu-près.",
    footer_data_source: "Enchères · assurance · marketplace · signaux d'immatriculation",
    footer_investigate_label: "Investiguer",
    footer_investigate_cta: "N'achetez pas une voiture dans le doute. Achetez-la en étant sûr.",
    footer_explore: "Explorer",
    footer_markets: "Marchés",
    footer_rights_line: "Investigation VIN pour des décisions d'occasion sérieuses.",
    check_vin: "Ouvrir le dossier",
    get_started: "Démarrer le dossier",
    my_reports: "Mes dossiers",
    view_report: "Ouvrir le dossier",
    view_dossier: "Ouvrir le dossier",
    dashboard_case_file: "Dossier",
    vin_case_id_label: "ID dossier · VIN",
    pricing_hero_title_1: "Un paiement.",
    pricing_hero_title_2: "Un fichier de preuves complet.",
    pricing_hero_lead:
      "19,99 € par dossier (au lieu de 29,99 €). Packs : 16,99 € chacun ×3, ou 12,99 € chacun ×5.",
    pricing_subtitle: "Tarifs dossier transparents — pas d'abonnement, pas de portail revendeur.",
    pricing_hero_eyebrow: "Prix de lancement · Était 29,99 €",
    free_decoder_title: "Décodeur de châssis gratuit",
    free_decoder_title_highlight: "décodeur de châssis",
    free_decoder_subtitle:
      "Lisez année, marque, modèle et usine depuis la structure VIN — puis débloquez le dossier VerifyKM complet pour kilométrage et dommages.",
    faq: "Questions",
    nav_how_it_works: "Parcours",
    pricing: "Tarifs dossier",
    per_report: "par dossier complet · était 29,99 €",
  },
  sq: {
    hero_headline_1: "Hapni dosjen VIN.",
    hero_headline_2: "para se shitësi të kontrollojë historinë",
    hero_subtext:
      "VerifyKM e kthen një numër shasie 17-karakterësh në dosje prove — ankande, siguracione, kilometrazh dhe tituj të shënuar — që importet dhe blerjet private të nisin me regjistra, jo premtime.",
    how_it_works: "Rrjedha VerifyKM",
    how_it_works_desc: "Futni shasinë. Hapni skedarin. Lexoni çfarë dinë tashmë databazat.",
    countries_title: "Tregjet që hetojmë",
    countries_subtitle: "Zgjidhni një treg. Çdo udhëzues shpjegon çfarë kërkon VerifyKM për atë origjinë.",
    stats_countries_badge: "Mbulimi",
    cta_title: "Blini me dosje. Jo me ndjenjë.",
    cta_desc: "€19.99 hap një skedar të plotë VIN — ose kurseni me paketa shumë-raporte.",
    footer_tagline:
      "VerifyKM është një tavolinë hetimi VIN për importues dhe blerës të kujdesshëm. Së pari prova. Kurrë hamendësime.",
    footer_data_source: "Ankand · sigurim · treg · sinjale regjistrimi",
    footer_investigate_label: "Heto",
    footer_investigate_cta: "Mos bli makinë në mëdyshje. Bleje i sigurt.",
    footer_explore: "Eksploro",
    footer_markets: "Tregjet",
    footer_rights_line: "Hetim VIN për vendime serioze të makinave të përdorura.",
    check_vin: "Hap dosjen",
    get_started: "Fillo dosjen",
    my_reports: "Dosjet e mia",
    view_report: "Hap dosjen",
    view_dossier: "Hap dosjen",
    dashboard_case_file: "Dosja",
    vin_case_id_label: "ID dosje · VIN",
    pricing_hero_title_1: "Një pagesë.",
    pricing_hero_title_2: "Një skedar i plotë prove.",
    pricing_hero_lead:
      "€19.99 për dosje (ishte €29.99). Paketa: €16.99 secila ×3, ose €12.99 secila ×5.",
    pricing_subtitle: "Çmime transparente dosjeje — pa abonim, pa portal rishitësi.",
    pricing_hero_eyebrow: "Çmim nisjeje · Ishte €29.99",
    free_decoder_title: "Dekodues falas i shasisë",
    free_decoder_title_highlight: "dekodues shasie",
    free_decoder_subtitle:
      "Lexoni vitin, markën, modelin dhe fabrikën nga struktura VIN — pastaj hapni dosjen e plotë VerifyKM për kilometrazh dhe dëmtime.",
    faq: "Pyetje",
    nav_how_it_works: "Rrjedha",
    pricing: "Çmimet e dosjes",
    per_report: "për dosje të plotë · ishte €29.99",
  },
  pl: {
    hero_headline_1: "Otwórz dossier VIN.",
    hero_headline_2: "zanim sprzedawca ułoży historię",
    hero_subtext:
      "VerifyKM zamienia 17-znakowy numer nadwozia w teczkę dowodów — aukcje, ubezpieczenia, przebieg i oznaczenia tytułu — by importy i zakupy prywatne zaczynały się od rejestrów, nie obietnic.",
    how_it_works: "Proces VerifyKM",
    how_it_works_desc: "Wpisz numer nadwozia. Odblokuj plik. Przeczytaj, co bazy już wiedzą.",
    countries_title: "Rynki, które badamy",
    countries_subtitle: "Wybierz rynek. Każdy przewodnik wyjaśnia, czego szuka VerifyKM dla tego pochodzenia.",
    stats_countries_badge: "Zasięg",
    cta_title: "Kupuj z dossier. Nie na wyczucie.",
    cta_desc: "19,99 € odblokowuje pełny plik VIN — lub oszczędzaj z pakietami wieloraportowymi.",
    footer_tagline:
      "VerifyKM to biurko dochodzeń VIN dla importerów i ostrożnych kupujących. Najpierw dowody. Nigdy domysły.",
    footer_data_source: "Aukcja · ubezpieczenie · marketplace · sygnały rejestracji",
    footer_investigate_label: "Sprawdź",
    footer_investigate_cta: "Nie kupuj auta, póki masz wątpliwości. Kup je, gdy jesteś pewien.",
    footer_explore: "Odkrywaj",
    footer_markets: "Rynki",
    footer_rights_line: "Dochodzenie VIN dla poważnych decyzji o autach używanych.",
    check_vin: "Otwórz dossier",
    get_started: "Zacznij dossier",
    my_reports: "Moje dossier",
    view_report: "Otwórz dossier",
    view_dossier: "Otwórz dossier",
    dashboard_case_file: "Teczka",
    vin_case_id_label: "ID sprawy · VIN",
    pricing_hero_title_1: "Jedna płatność.",
    pricing_hero_title_2: "Jedna pełna teczka dowodów.",
    pricing_hero_lead:
      "19,99 € za dossier (było 29,99 €). Pakiety: 16,99 € szt. ×3 lub 12,99 € szt. ×5.",
    pricing_subtitle: "Przejrzyste ceny dossier — bez subskrypcji i portalu resellerów.",
    pricing_hero_eyebrow: "Cena startowa · Było 29,99 €",
    free_decoder_title: "Darmowy dekoder nadwozia",
    free_decoder_title_highlight: "dekoder nadwozia",
    free_decoder_subtitle:
      "Odczytaj rok, markę, model i fabrykę ze struktury VIN — potem odblokuj pełne dossier VerifyKM dla przebiegu i szkód.",
    faq: "Pytania",
    nav_how_it_works: "Proces",
    pricing: "Cennik dossier",
    per_report: "za pełne dossier · było 29,99 €",
  },
  ro: {
    hero_headline_1: "Deschideți dosarul VIN.",
    hero_headline_2: "înainte ca vânzătorul să controleze povestea",
    hero_subtext:
      "VerifyKM transformă un număr de șasiu de 17 caractere într-un dosar de dovezi — licitații, asigurări, kilometraj și titluri marcate — ca importurile și cumpărăturile private să înceapă cu registre, nu promisiuni.",
    how_it_works: "Fluxul VerifyKM",
    how_it_works_desc: "Introduceți șasiul. Deblocați fișierul. Citiți ce știu deja bazele de date.",
    countries_title: "Piețele pe care le investigăm",
    countries_subtitle: "Alegeți o piață. Fiecare ghid explică ce caută VerifyKM pentru acea origine.",
    stats_countries_badge: "Acoperire",
    cta_title: "Cumpărați cu dosar. Nu după senzații.",
    cta_desc: "19,99 € deblochează un fișier VIN complet — sau economisiți cu pachete multi-raport.",
    footer_tagline:
      "VerifyKM este un birou de investigație VIN pentru importatori și cumpărători atenți. Mai întâi dovezi. Niciodată ghicituri.",
    footer_data_source: "Licitație · asigurare · marketplace · semnale de înregistrare",
    footer_investigate_label: "Investigați",
    footer_investigate_cta: "Nu cumpăra mașina pe îndoială. Cumpăr-o când ești sigur.",
    footer_explore: "Explorați",
    footer_markets: "Piețe",
    footer_rights_line: "Investigație VIN pentru decizii serioase la second-hand.",
    check_vin: "Deschideți dosarul",
    get_started: "Începeți dosarul",
    my_reports: "Dosarele mele",
    view_report: "Deschideți dosarul",
    view_dossier: "Deschideți dosarul",
    dashboard_case_file: "Dosar",
    vin_case_id_label: "ID caz · VIN",
    pricing_hero_title_1: "O singură plată.",
    pricing_hero_title_2: "Un fișier complet de dovezi.",
    pricing_hero_lead:
      "19,99 € pe dosar (era 29,99 €). Pachete: 16,99 € fiecare ×3, sau 12,99 € fiecare ×5.",
    pricing_subtitle: "Prețuri transparente pentru dosar — fără abonament, fără portal reseller.",
    pricing_hero_eyebrow: "Preț de lansare · Era 29,99 €",
    free_decoder_title: "Decodor gratuit de șasiu",
    free_decoder_title_highlight: "decodor de șasiu",
    free_decoder_subtitle:
      "Citiți anul, marca, modelul și fabrica din structura VIN — apoi deblocați dosarul VerifyKM complet pentru kilometraj și daune.",
    faq: "Întrebări",
    nav_how_it_works: "Flux",
    pricing: "Prețuri dosar",
    per_report: "per dosar complet · era 29,99 €",
  },
  bg: {
    hero_headline_1: "Отворете VIN досието.",
    hero_headline_2: "преди продавачът да контролира историята",
    hero_subtext:
      "VerifyKM превръща 17-символен номер на шаси в доказателствено досие — търгове, застраховки, пробег и маркирани титули — за да започват вносът и частните покупки с регистри, не с обещания.",
    how_it_works: "Процесът VerifyKM",
    how_it_works_desc: "Въведете шасито. Отключете файла. Прочетете какво вече знаят базите.",
    countries_title: "Пазари, които изследваме",
    countries_subtitle: "Изберете пазар. Всяко ръководство обяснява какво търси VerifyKM за този произход.",
    stats_countries_badge: "Покритие",
    cta_title: "Купувайте с досие. Не на усет.",
    cta_desc: "€19,99 отключва пълен VIN файл — или спестете с пакети за няколко отчета.",
    footer_tagline:
      "VerifyKM е бюро за VIN разследване за вносители и внимателни купувачи. Първо доказателства. Никога догадки.",
    footer_data_source: "Търг · застраховка · пазар · сигнали за регистрация",
    footer_investigate_label: "Разследвайте",
    footer_investigate_cta: "Не купувайте кола в съмнение. Купете я, когато сте сигурни.",
    footer_explore: "Разгледайте",
    footer_markets: "Пазари",
    footer_rights_line: "VIN разследване за сериозни решения при употребявани коли.",
    check_vin: "Отворете досието",
    get_started: "Започнете досие",
    my_reports: "Моите досиета",
    view_report: "Отворете досието",
    view_dossier: "Отворете досието",
    dashboard_case_file: "Досие",
    vin_case_id_label: "ID на дело · VIN",
    pricing_hero_title_1: "Едно плащане.",
    pricing_hero_title_2: "Един пълен доказателствен файл.",
    pricing_hero_lead:
      "€19,99 на досие (беше €29,99). Пакети: €16,99 всеки ×3, или €12,99 всеки ×5.",
    pricing_subtitle: "Прозрачни цени за досие — без абонамент, без реселър портал.",
    pricing_hero_eyebrow: "Начална цена · Беше €29,99",
    free_decoder_title: "Безплатен декодер на шаси",
    free_decoder_title_highlight: "декодер на шаси",
    free_decoder_subtitle:
      "Прочетете година, марка, модел и завод от VIN структурата — после отключете пълното VerifyKM досие за пробег и щети.",
    faq: "Въпроси",
    nav_how_it_works: "Процес",
    pricing: "Цени на досието",
    per_report: "на пълно досие · беше €29,99",
  },
  ka: {
    hero_headline_1: "გახსენით VIN დოსიე.",
    hero_headline_2: "სანამ გამყიდველი ისტორიას აკონტროლებს",
    hero_subtext:
      "VerifyKM 17-სიმბოლოიან შასის ნომერს მტკიცებულებების საქაღალდედ აქცევს — აუქციონები, დაზღვევა, გარბენი და მონიშნული ტიტულები — რომ იმპორტი და პირადი ყიდვა რეესტრებით დაიწყოს, არა დაპირებებით.",
    how_it_works: "VerifyKM პროცესი",
    how_it_works_desc: "შეიყვანეთ შასი. გახსენით ფაილი. წაიკითხეთ რა იციან უკვე ბაზებმა.",
    countries_title: "ბაზრები, რომლებსაც ვიკვლევთ",
    countries_subtitle: "აირჩიეთ ბაზარი. თითოეული გზამკვლევი ხსნის, რას ეძებს VerifyKM ამ წარმოშობისთვის.",
    stats_countries_badge: "დაფარვა",
    cta_title: "იყიდეთ დოსიეთი. არა შეგრძნებით.",
    cta_desc: "€19.99 ხსნის სრულ VIN ფაილს — ან დაზოგეთ მრავალრეპორტიანი პაკეტებით.",
    footer_tagline:
      "VerifyKM არის VIN გამოძიების მაგიდა იმპორტიორებისა და ფრთხილი მყიდველებისთვის. ჯერ მტკიცებულება. არასოდეს გამოცნობა.",
    footer_data_source: "აუქციონი · დაზღვევა · მარკეტპლეისი · რეგისტრაციის სიგნალები",
    footer_investigate_label: "გამოიძიეთ",
    footer_investigate_cta: "ნუ იყიდით მანქანას ეჭვით. იყიდეთ, როცა დარწმუნებული ხართ.",
    footer_explore: "გამოიკვლიეთ",
    footer_markets: "ბაზრები",
    footer_rights_line: "VIN გამოძიება სერიოზული მეორადი მანქანის გადაწყვეტილებებისთვის.",
    check_vin: "დოსიეს გახსნა",
    get_started: "დოსიეს დაწყება",
    my_reports: "ჩემი დოსიეები",
    view_report: "დოსიეს გახსნა",
    view_dossier: "დოსიეს გახსნა",
    dashboard_case_file: "საქმე",
    vin_case_id_label: "საქმის ID · VIN",
    pricing_hero_title_1: "ერთი გადახდა.",
    pricing_hero_title_2: "ერთი სრული მტკიცებულების ფაილი.",
    pricing_hero_lead:
      "€19.99 დოსიეზე (იყო €29.99). პაკეტები: €16.99 თითო ×3, ან €12.99 თითო ×5.",
    pricing_subtitle: "გამჭვირვალე დოსიეს ფასები — გამოწერის გარეშე, რესელერის პორტალის გარეშე.",
    pricing_hero_eyebrow: "გაშვების ფასი · იყო €29.99",
    free_decoder_title: "უფასო შასის დეკოდერი",
    free_decoder_title_highlight: "შასის დეკოდერი",
    free_decoder_subtitle:
      "წაიკითხეთ წელი, მარკა, მოდელი და ქარხანა VIN სტრუქტურიდან — შემდეგ გახსენით სრული VerifyKM დოსიე გარბენისა და დაზიანებებისთვის.",
    faq: "კითხვები",
    nav_how_it_works: "პროცესი",
    pricing: "დოსიეს ფასები",
    per_report: "სრულ დოსიეზე · იყო €29.99",
  },
  ar: {
    hero_headline_1: "افتح ملف VIN.",
    hero_headline_2: "قبل أن يسيطر البائع على القصة",
    hero_subtext:
      "Convert VerifyKM رقم الهيكل المكوّن من 17 حرفاً إلى ملف أدلة — مزادات وتأمين وعدّاد كيلومترات وعناوين معلّمة — حتى تبدأ الاستيرادات والمشتريات الخاصة بالسجلات لا بالوعود.",
    how_it_works: "مسار VerifyKM",
    how_it_works_desc: "أدخل رقم الهيكل. افتح الملف. اقرأ ما تعرفه قواعد البيانات بالفعل.",
    countries_title: "الأسواق التي نحقق فيها",
    countries_subtitle: "اختر سوقاً. يشرح كل دليل ما يبحث عنه VerifyKM لهذا المنشأ.",
    stats_countries_badge: "التغطية",
    cta_title: "اشترِ بملف. لا بالإحساس.",
    cta_desc: "19.99€ تفتح ملف VIN كاملاً — أو وفّر مع باقات التقارير المتعددة.",
    footer_tagline:
      "VerifyKM مكتب تحقيق VIN للمستوردين والمشترين الحذرين. الأدلة أولاً. لا تخمين أبداً.",
    footer_data_source: "مزاد · تأمين · سوق · إشارات تسجيل",
    footer_investigate_label: "حقّق",
    footer_investigate_cta: "لا تشترِ سيارة وأنت متردد. اشترها وأنت واثق.",
    footer_explore: "استكشف",
    footer_markets: "الأسواق",
    footer_rights_line: "تحقيق VIN لقرارات جادة بشأن السيارات المستعملة.",
    check_vin: "افتح الملف",
    get_started: "ابدأ الملف",
    my_reports: "ملفاتي",
    view_report: "افتح الملف",
    view_dossier: "افتح الملف",
    dashboard_case_file: "ملف القضية",
    vin_case_id_label: "معرّف القضية · VIN",
    pricing_hero_title_1: "دفعة واحدة.",
    pricing_hero_title_2: "ملف أدلة كامل.",
    pricing_hero_lead:
      "19.99€ للملف (كان 29.99€). الباقات: 16.99€ لكل ×3، أو 12.99€ لكل ×5.",
    pricing_subtitle: "أسعار ملفات شفافة — بلا اشتراك وبلا بوابة إعادة بيع.",
    pricing_hero_eyebrow: "سعر الإطلاق · كان 29.99€",
    free_decoder_title: "فكّ هيكل مجاني",
    free_decoder_title_highlight: "فكّ الهيكل",
    free_decoder_subtitle:
      "اقرأ السنة والماركة والطراز والمصنع من بنية VIN — ثم افتح ملف VerifyKM الكامل للكيلومترات والأضرار.",
    faq: "أسئلة",
    nav_how_it_works: "المسار",
    pricing: "أسعار الملف",
    per_report: "لكل ملف كامل · كان 29.99€",
  },
  uk: {
    hero_headline_1: "Відкрийте VIN-досьє.",
    hero_headline_2: "перш ніж продавець контролюватиме історію",
    hero_subtext:
      "VerifyKM перетворює 17-символьний номер шасі на досьє доказів — аукціони, страхування, пробіг і марковані титули — щоб імпорт і приватні покупки починалися з реєстрів, а не обіцянок.",
    how_it_works: "Процес VerifyKM",
    how_it_works_desc: "Введіть шасі. Відкрийте файл. Прочитайте, що бази вже знають.",
    countries_title: "Ринки, які ми досліджуємо",
    countries_subtitle: "Оберіть ринок. Кожен гід пояснює, що шукає VerifyKM для цього походження.",
    stats_countries_badge: "Покриття",
    cta_title: "Купуйте з досьє. Не на відчуттях.",
    cta_desc: "€19,99 відкриває повний VIN-файл — або заощаджуйте з пакетами з кількома звітами.",
    footer_tagline:
      "VerifyKM — стіл VIN-розслідувань для імпортерів і обережних покупців. Спочатку докази. Ніколи здогадки.",
    footer_data_source: "Аукціон · страхування · маркетплейс · сигнали реєстрації",
    footer_investigate_label: "Дослідити",
    footer_investigate_cta: "Не купуйте авто, поки сумніваєтесь. Купуйте, коли впевнені.",
    footer_explore: "Огляд",
    footer_markets: "Ринки",
    footer_rights_line: "VIN-розслідування для серйозних рішень щодо вживаних авто.",
    check_vin: "Відкрити досьє",
    get_started: "Почати досьє",
    my_reports: "Мої досьє",
    view_report: "Відкрити досьє",
    view_dossier: "Відкрити досьє",
    dashboard_case_file: "Справа",
    vin_case_id_label: "ID справи · VIN",
    pricing_hero_title_1: "Одна оплата.",
    pricing_hero_title_2: "Один повний файл доказів.",
    pricing_hero_lead:
      "€19,99 за досьє (було €29,99). Пакети: €16,99 кожне ×3, або €12,99 кожне ×5.",
    pricing_subtitle: "Прозорі ціни на досьє — без підписки й реселер-порталу.",
    pricing_hero_eyebrow: "Стартова ціна · Було €29,99",
    free_decoder_title: "Безкоштовний декодер шасі",
    free_decoder_title_highlight: "декодер шасі",
    free_decoder_subtitle:
      "Зчитайте рік, марку, модель і завод зі структури VIN — потім відкрийте повне VerifyKM-досьє для пробігу й пошкоджень.",
    faq: "Питання",
    nav_how_it_works: "Процес",
    pricing: "Ціни на досьє",
    per_report: "за повне досьє · було €29,99",
  },
  ru: {
    hero_headline_1: "Откройте VIN-досье.",
    hero_headline_2: "пока продавец не контролирует историю",
    hero_subtext:
      "VerifyKM превращает 17-символьный номер шасси в досье доказательств — аукционы, страховки, пробег и маркированные титулы — чтобы импорт и частные покупки начинались с реестров, а не обещаний.",
    how_it_works: "Процесс VerifyKM",
    how_it_works_desc: "Введите шасси. Откройте файл. Прочитайте, что базы уже знают.",
    countries_title: "Рынки, которые мы исследуем",
    countries_subtitle: "Выберите рынок. Каждый гид объясняет, что ищет VerifyKM для этого происхождения.",
    stats_countries_badge: "Покрытие",
    cta_title: "Покупайте с досье. Не на ощущениях.",
    cta_desc: "€19,99 открывает полный VIN-файл — или экономьте с пакетами на несколько отчётов.",
    footer_tagline:
      "VerifyKM — стол VIN-расследований для импортёров и осторожных покупателей. Сначала доказательства. Никогда догадки.",
    footer_data_source: "Аукцион · страховка · маркетплейс · сигналы регистрации",
    footer_investigate_label: "Расследовать",
    footer_investigate_cta: "Не покупайте машину, пока сомневаетесь. Покупайте, когда уверены.",
    footer_explore: "Обзор",
    footer_markets: "Рынки",
    footer_rights_line: "VIN-расследование для серьёзных решений по подержанным авто.",
    check_vin: "Открыть досье",
    get_started: "Начать досье",
    my_reports: "Мои досье",
    view_report: "Открыть досье",
    view_dossier: "Открыть досье",
    dashboard_case_file: "Дело",
    vin_case_id_label: "ID дела · VIN",
    pricing_hero_title_1: "Одна оплата.",
    pricing_hero_title_2: "Один полный файл доказательств.",
    pricing_hero_lead:
      "€19,99 за досье (было €29,99). Пакеты: €16,99 каждое ×3, или €12,99 каждое ×5.",
    pricing_subtitle: "Прозрачные цены на досье — без подписки и реселлер-портала.",
    pricing_hero_eyebrow: "Стартовая цена · Было €29,99",
    free_decoder_title: "Бесплатный декодер шасси",
    free_decoder_title_highlight: "декодер шасси",
    free_decoder_subtitle:
      "Считайте год, марку, модель и завод из структуры VIN — затем откройте полное VerifyKM-досье для пробега и повреждений.",
    faq: "Вопросы",
    nav_how_it_works: "Процесс",
    pricing: "Цены на досье",
    per_report: "за полное досье · было €29,99",
  },
  zh: {
    hero_headline_1: "打开 VIN 档案。",
    hero_headline_2: "别让卖家先定义故事",
    hero_subtext:
      "VerifyKM 将 17 位车架号变成证据档案——拍卖、保险、里程与标题标记——让进口与私人购车从记录开始，而不是口头承诺。",
    how_it_works: "VerifyKM 流程",
    how_it_works_desc: "输入车架号。解锁文件。阅读数据库已知的信息。",
    countries_title: "我们调查的市场",
    countries_subtitle: "选择一个市场。每份指南说明 VerifyKM 对该来源查什么。",
    stats_countries_badge: "覆盖范围",
    cta_title: "用档案买车。别凭感觉。",
    cta_desc: "€19.99 解锁完整 VIN 文件——或多份套餐更省。",
    footer_tagline:
      "VerifyKM 是面向进口商与谨慎买家的 VIN 调查台。证据优先。绝不猜测。",
    footer_data_source: "拍卖 · 保险 · 市场 · 登记信号",
    footer_investigate_label: "调查",
    footer_investigate_cta: "没把握就先别买。有把握再买。",
    footer_explore: "探索",
    footer_markets: "市场",
    footer_rights_line: "为严肃二手车决策提供的 VIN 调查。",
    check_vin: "打开档案",
    get_started: "开始档案",
    my_reports: "我的档案",
    view_report: "打开档案",
    view_dossier: "打开档案",
    dashboard_case_file: "案件",
    vin_case_id_label: "案件编号 · VIN",
    pricing_hero_title_1: "一次付款。",
    pricing_hero_title_2: "一份完整证据文件。",
    pricing_hero_lead:
      "每份档案 €19.99（原价 €29.99）。套餐：每份 €16.99 ×3，或每份 €12.99 ×5。",
    pricing_subtitle: "透明档案定价——无订阅，无经销商门户。",
    pricing_hero_eyebrow: "上线价 · 原价 €29.99",
    free_decoder_title: "免费车架号解码",
    free_decoder_title_highlight: "车架号解码",
    free_decoder_subtitle:
      "从 VIN 结构读取年份、品牌、车型与工厂——再解锁完整 VerifyKM 档案，查看里程与损伤证据。",
    faq: "问题",
    nav_how_it_works: "流程",
    pricing: "档案价格",
    per_report: "每份完整档案 · 原价 €29.99",
  },
};

// Fix Arabic subtext typo
voice.ar.hero_subtext =
  "VerifyKM يحوّل رقم الهيكل المكوّن من 17 حرفاً إلى ملف أدلة — مزادات وتأمين وعدّاد كيلومترات وعناوين معلّمة — حتى تبدأ الاستيرادات والمشتريات الخاصة بالسجلات لا بالوعود.";

const seoPatches = {
  home: {
    de: {
      title: "VIN-Dossier-Prüfung — Kilometer, Unfälle & Titelrisiko | VerifyKM",
      description:
        "Öffnen Sie ein VerifyKM VIN-Dossier. Kilometerverläufe, Auktionstreffer, Salvage-Markierungen und Diebstahlsignale für Autos aus den USA, Korea, Kanada, China, Japan und Dubai.",
    },
    es: {
      title: "Investigación de dossier VIN — Kilometraje, accidentes y riesgo de título | VerifyKM",
      description:
        "Abra un dossier VIN de VerifyKM. Trayectorias de odómetro, subastas, marcas de salvage y señales de robo para coches de EE. UU., Corea, Canadá, China, Japón y Dubái.",
    },
    fr: {
      title: "Dossier VIN — Kilométrage, accidents & risque de titre | VerifyKM",
      description:
        "Ouvrez un dossier VIN VerifyKM. Kilométrage, enchères, marques épave et signaux de vol pour voitures des USA, Corée, Canada, Chine, Japon et Dubaï.",
    },
    sq: {
      title: "Hetim dosjeje VIN — kilometrazh, aksidente & rrezik titulli | VerifyKM",
      description:
        "Hapni një dosje VIN VerifyKM. Gjurmë kilometrazhi, ankande, marka salvage dhe sinjale vjedhjeje për makina nga SHBA, Korea, Kanada, Kina, Japonia dhe Dubai.",
    },
    pl: {
      title: "Dochodzenie dossier VIN — przebieg, wypadki i ryzyko tytułu | VerifyKM",
      description:
        "Otwórz dossier VIN VerifyKM. Przebiegi, aukcje, oznaczenia salvage i sygnały kradzieży dla aut z USA, Korei, Kanady, Chin, Japonii i Dubaju.",
    },
    ro: {
      title: "Investigație dosar VIN — kilometraj, accidente și risc de titlu | VerifyKM",
      description:
        "Deschideți un dosar VIN VerifyKM. Trasee de kilometraj, licitații, mărci salvage și semnale de furt pentru mașini din SUA, Coreea, Canada, China, Japonia și Dubai.",
    },
    bg: {
      title: "VIN досие — пробег, катастрофи и риск за титул | VerifyKM",
      description:
        "Отворете VerifyKM VIN досие. Пробег, търгове, salvage марки и сигнали за кражба за коли от САЩ, Корея, Канада, Китай, Япония и Дубай.",
    },
    ka: {
      title: "VIN დოსიეს გამოძიება — გარბენი, ავარიები და ტიტულის რისკი | VerifyKM",
      description:
        "გახსენით VerifyKM VIN დოსიე. გარბენის კვალი, აუქციონები, salvage ნიშნები და ქურდობის სიგნალები აშშ, კორეა, კანადა, ჩინეთი, იაპონია და დუბაის მანქანებისთვის.",
    },
    ar: {
      title: "تحقيق ملف VIN — الكيلومترات والحوادث ومخاطر العنوان | VerifyKM",
      description:
        "افتح ملف VIN من VerifyKM. مسارات العداد والمزادات وعلامات الإتلاف وإشارات السرقة لسيارات من الولايات المتحدة وكوريا وكندا والصين واليابان ودبي.",
    },
    uk: {
      title: "VIN-досьє — пробіг, ДТП і ризик титулу | VerifyKM",
      description:
        "Відкрийте VIN-досьє VerifyKM. Пробіг, аукціони, salvage-мітки та сигнали крадіжки для авто зі США, Кореї, Канади, Китаю, Японії та Дубая.",
    },
    ru: {
      title: "VIN-досье — пробег, ДТП и риск титула | VerifyKM",
      description:
        "Откройте VIN-досье VerifyKM. Пробег, аукционы, salvage-метки и сигналы угона для авто из США, Кореи, Канады, Китая, Японии и Дубая.",
    },
    zh: {
      title: "VIN 档案调查 — 里程、事故与标题风险 | VerifyKM",
      description:
        "打开 VerifyKM VIN 档案。查看美国、韩国、加拿大、中国、日本与迪拜车辆的里程轨迹、拍卖、报废标记与盗抢信号。",
    },
  },
  pricing: {
    de: {
      title: "Dossier-Preise — €19,99 VIN-Akte | VerifyKM",
      description:
        "Eine Zahlung schaltet ein volles VIN-Dossier für €19,99 frei (Standard €29,99). Mehrfach-Pakete ab €12,99 pro Akte. Sofortlieferung. Kein Abo.",
    },
    es: {
      title: "Precios del dossier — archivo VIN 19,99 € | VerifyKM",
      description:
        "Un pago desbloquea un dossier VIN completo por 19,99 € (estándar 29,99 €). Packs multi-informe desde 12,99 € por archivo. Entrega instantánea. Sin suscripción.",
    },
    fr: {
      title: "Tarifs dossier — fichier VIN 19,99 € | VerifyKM",
      description:
        "Un paiement débloque un dossier VIN complet à 19,99 € (standard 29,99 €). Packs multi-rapports dès 12,99 € par fichier. Livraison instantanée. Sans abonnement.",
    },
    sq: {
      title: "Çmimet e dosjes — skedar VIN €19.99 | VerifyKM",
      description:
        "Një pagesë hap dosje të plotë VIN për €19.99 (standarde €29.99). Paketa shumë-raporte nga €12.99 për skedar. Dorëzim i menjëhershëm. Pa abonim.",
    },
    pl: {
      title: "Cennik dossier — plik VIN 19,99 € | VerifyKM",
      description:
        "Jedna płatność odblokowuje pełne dossier VIN za 19,99 € (standard 29,99 €). Pakiety wieloraportowe od 12,99 € za plik. Natychmiastowa dostawa. Bez subskrypcji.",
    },
    ro: {
      title: "Prețuri dosar — fișier VIN 19,99 € | VerifyKM",
      description:
        "O plată deblochează un dosar VIN complet la 19,99 € (standard 29,99 €). Pachete multi-raport de la 12,99 € per fișier. Livrare instantanee. Fără abonament.",
    },
    bg: {
      title: "Цени на досието — VIN файл €19,99 | VerifyKM",
      description:
        "Едно плащане отключва пълно VIN досие за €19,99 (стандарт €29,99). Пакети от €12,99 на файл. Мигновена доставка. Без абонамент.",
    },
    ka: {
      title: "დოსიეს ფასები — VIN ფაილი €19.99 | VerifyKM",
      description:
        "ერთი გადახდა ხსნის სრულ VIN დოსიეს €19.99-ად (სტანდარტი €29.99). მრავალრეპორტიანი პაკეტები €12.99-დან ფაილზე. მყისიერი მიწოდება. გამოწერის გარეშე.",
    },
    ar: {
      title: "أسعار الملف — ملف VIN بـ 19.99€ | VerifyKM",
      description:
        "دفعة واحدة تفتح ملف VIN كاملاً بـ 19.99€ (القياسي 29.99€). باقات متعددة من 12.99€ للملف. تسليم فوري. بلا اشتراك.",
    },
    uk: {
      title: "Ціни на досьє — VIN-файл €19,99 | VerifyKM",
      description:
        "Одна оплата відкриває повне VIN-досьє за €19,99 (стандарт €29,99). Пакети з кількома звітами від €12,99 за файл. Миттєва доставка. Без підписки.",
    },
    ru: {
      title: "Цены на досье — VIN-файл €19,99 | VerifyKM",
      description:
        "Одна оплата открывает полное VIN-досье за €19,99 (стандарт €29,99). Пакеты с несколькими отчётами от €12,99 за файл. Мгновенная доставка. Без подписки.",
    },
    zh: {
      title: "档案价格 — €19.99 VIN 文件 | VerifyKM",
      description:
        "一次付款以 €19.99 解锁完整 VIN 档案（标准价 €29.99）。多份套餐低至每份 €12.99。即时交付。无订阅。",
    },
  },
  how_it_works: {
    de: {
      title: "VerifyKM-Ablauf — VIN-Dossier in drei Schritten",
      description:
        "Fahrgestellnummer eingeben, Beweisakte freischalten, Kilometer, Unfälle und Titelflags lesen. Für Importeure und sorgfältige Käufer.",
    },
    es: {
      title: "Flujo VerifyKM — dossier VIN en tres pasos",
      description:
        "Introduzca el chasis, desbloquee el archivo de evidencia, lea kilometraje, accidentes y banderas de título. Para importadores y compradores cuidadosos.",
    },
    fr: {
      title: "Parcours VerifyKM — dossier VIN en trois étapes",
      description:
        "Saisissez le châssis, débloquez le fichier de preuves, lisez kilométrage, accidents et drapeaux de titre. Pour importateurs et acheteurs exigeants.",
    },
    sq: {
      title: "Rrjedha VerifyKM — dosje VIN në tre hapa",
      description:
        "Futni shasinë, hapni skedarin e provave, lexoni kilometrazhin, aksidentet dhe flamujt e titullit. Për importues dhe blerës të kujdesshëm.",
    },
    pl: {
      title: "Proces VerifyKM — dossier VIN w trzech krokach",
      description:
        "Wpisz numer nadwozia, odblokuj teczkę dowodów, przeczytaj przebieg, wypadki i flagi tytułu. Dla importerów i ostrożnych kupujących.",
    },
    ro: {
      title: "Fluxul VerifyKM — dosar VIN în trei pași",
      description:
        "Introduceți șasiul, deblocați fișierul de dovezi, citiți kilometrajul, accidentele și steagurile de titlu. Pentru importatori și cumpărători atenți.",
    },
    bg: {
      title: "Процесът VerifyKM — VIN досие в три стъпки",
      description:
        "Въведете шасито, отключете доказателствения файл, прочетете пробег, катастрофи и флагове за титул. За вносители и внимателни купувачи.",
    },
    ka: {
      title: "VerifyKM პროცესი — VIN დოსიე სამ ნაბიჯში",
      description:
        "შეიყვანეთ შასი, გახსენით მტკიცებულების ფაილი, წაიკითხეთ გარბენი, ავარიები და ტიტულის ალმები. იმპორტიორებისა და ფრთხილი მყიდველებისთვის.",
    },
    ar: {
      title: "مسار VerifyKM — ملف VIN في ثلاث خطوات",
      description:
        "أدخل الهيكل، افتح ملف الأدلة، اقرأ الكيلومترات والحوادث وأعلام العنوان. للمستوردين والمشترين الحذرين.",
    },
    uk: {
      title: "Процес VerifyKM — VIN-досьє за три кроки",
      description:
        "Введіть шасі, відкрийте файл доказів, прочитайте пробіг, ДТП і прапорці титулу. Для імпортерів і обережних покупців.",
    },
    ru: {
      title: "Процесс VerifyKM — VIN-досье за три шага",
      description:
        "Введите шасси, откройте файл доказательств, прочитайте пробег, ДТП и флаги титула. Для импортёров и осторожных покупателей.",
    },
    zh: {
      title: "VerifyKM 流程 — 三步打开 VIN 档案",
      description:
        "输入车架号，解锁证据文件，阅读里程、事故与标题标记。面向进口商与谨慎买家。",
    },
  },
  faq: {
    de: {
      title: "VerifyKM FAQ — VIN-Dossiers, Abdeckung & Lieferung",
      description:
        "Antworten zu Märkten, Berichtgeschwindigkeit, Rückerstattungen und dem Inhalt eines VerifyKM VIN-Dossiers.",
    },
    es: {
      title: "FAQ VerifyKM — dossiers VIN, cobertura y entrega",
      description:
        "Respuestas sobre mercados, velocidad del informe, reembolsos y qué incluye un dossier VIN de VerifyKM.",
    },
    fr: {
      title: "FAQ VerifyKM — dossiers VIN, couverture et livraison",
      description:
        "Réponses sur les marchés, la vitesse du rapport, les remboursements et le contenu d'un dossier VIN VerifyKM.",
    },
    sq: {
      title: "FAQ VerifyKM — dosje VIN, mbulim & dorëzim",
      description:
        "Përgjigje për tregjet, shpejtësinë e raportit, rimbursimet dhe çfarë përmban një dosje VIN VerifyKM.",
    },
    pl: {
      title: "FAQ VerifyKM — dossier VIN, zasięg i dostawa",
      description:
        "Odpowiedzi o rynkach, szybkości raportu, zwrotach i zawartości dossier VIN VerifyKM.",
    },
    ro: {
      title: "FAQ VerifyKM — dosare VIN, acoperire și livrare",
      description:
        "Răspunsuri despre piețe, viteza raportului, rambursări și ce conține un dosar VIN VerifyKM.",
    },
    bg: {
      title: "ЧЗВ VerifyKM — VIN досиета, покритие и доставка",
      description:
        "Отговори за пазари, скорост на отчета, възстановявания и какво съдържа VerifyKM VIN досие.",
    },
    ka: {
      title: "VerifyKM FAQ — VIN დოსიეები, დაფარვა და მიწოდება",
      description:
        "პასუხები ბაზრებზე, ანგარიშის სიჩქარეზე, დაბრუნებაზე და VerifyKM VIN დოსიეს შიგთავსზე.",
    },
    ar: {
      title: "أسئلة VerifyKM — ملفات VIN والتغطية والتسليم",
      description:
        "إجابات عن الأسواق وسرعة التقرير والاسترداد وما يحتويه ملف VIN من VerifyKM.",
    },
    uk: {
      title: "FAQ VerifyKM — VIN-досьє, покриття та доставка",
      description:
        "Відповіді про ринки, швидкість звіту, повернення коштів і вміст VIN-досьє VerifyKM.",
    },
    ru: {
      title: "FAQ VerifyKM — VIN-досье, покрытие и доставка",
      description:
        "Ответы о рынках, скорости отчёта, возвратах и содержимом VIN-досье VerifyKM.",
    },
    zh: {
      title: "VerifyKM 常见问题 — VIN 档案、覆盖与交付",
      description:
        "关于市场、报告速度、退款以及 VerifyKM VIN 档案内容的解答。",
    },
  },
  free_decoder: {
    de: {
      title: "Kostenloser Chassis-Decoder — Jahr, Marke, Modell | VerifyKM",
      description:
        "Dekodieren Sie jede 17-stellige VIN für Werksdaten kostenlos. Schalten Sie ein VerifyKM-Dossier für verifizierte Kilometer, Unfälle und Salvage-Status frei.",
    },
    es: {
      title: "Decodificador de chasis gratis — año, marca, modelo | VerifyKM",
      description:
        "Decodifique cualquier VIN de 17 caracteres para datos de fábrica gratis. Desbloquee un dossier VerifyKM para kilometraje, accidentes y estado salvage.",
    },
    fr: {
      title: "Décodeur de châssis gratuit — année, marque, modèle | VerifyKM",
      description:
        "Décodez tout VIN à 17 caractères pour les specs usine gratuitement. Débloquez un dossier VerifyKM pour kilométrage, accidents et statut épave.",
    },
    sq: {
      title: "Dekodues falas i shasisë — vit, markë, model | VerifyKM",
      description:
        "Dekodoni çdo VIN 17-karakterësh për të dhëna fabrike falas. Hapni një dosje VerifyKM për kilometrazh, aksidente dhe status salvage.",
    },
    pl: {
      title: "Darmowy dekoder nadwozia — rok, marka, model | VerifyKM",
      description:
        "Dekoduj dowolny 17-znakowy VIN dla danych fabrycznych za darmo. Odblokuj dossier VerifyKM dla przebiegu, wypadków i statusu salvage.",
    },
    ro: {
      title: "Decodor gratuit de șasiu — an, marcă, model | VerifyKM",
      description:
        "Decodați orice VIN de 17 caractere pentru date de fabrică gratuit. Deblocați un dosar VerifyKM pentru kilometraj, accidente și status salvage.",
    },
    bg: {
      title: "Безплатен декодер на шаси — година, марка, модел | VerifyKM",
      description:
        "Декодирайте всеки 17-символен VIN за заводски данни безплатно. Отключете VerifyKM досие за пробег, катастрофи и salvage статус.",
    },
    ka: {
      title: "უფასო შასის დეკოდერი — წელი, მარკა, მოდელი | VerifyKM",
      description:
        "გაშიფრეთ ნებისმიერი 17-სიმბოლოიანი VIN ქარხნული მონაცემებისთვის უფასოდ. გახსენით VerifyKM დოსიე გარბენის, ავარიებისა და salvage სტატუსისთვის.",
    },
    ar: {
      title: "فك هيكل مجاني — السنة والماركة والطراز | VerifyKM",
      description:
        "افكك أي VIN من 17 حرفاً لبيانات المصنع مجاناً. افتح ملف VerifyKM للكيلومترات والحوادث وحالة الإتلاف.",
    },
    uk: {
      title: "Безкоштовний декодер шасі — рік, марка, модель | VerifyKM",
      description:
        "Декодуйте будь-який 17-символьний VIN для заводських даних безкоштовно. Відкрийте VerifyKM-досьє для пробігу, ДТП і статусу salvage.",
    },
    ru: {
      title: "Бесплатный декодер шасси — год, марка, модель | VerifyKM",
      description:
        "Декодируйте любой 17-символьный VIN для заводских данных бесплатно. Откройте VerifyKM-досье для пробега, ДТП и статуса salvage.",
    },
    zh: {
      title: "免费车架号解码 — 年份、品牌、车型 | VerifyKM",
      description:
        "免费解码任意 17 位 VIN 获取出厂数据。解锁 VerifyKM 档案以查看已核实里程、事故与报废状态。",
    },
  },
};

let i18nUpdated = 0;
for (const [lang, keys] of Object.entries(voice)) {
  const p = path.join(i18nDir, `${lang}.json`);
  if (!fs.existsSync(p)) {
    console.warn("missing locale", lang);
    continue;
  }
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  // remove hero_badge usage importance — blank it so leftover UI shows nothing
  data.hero_badge = "";
  for (const [k, v] of Object.entries(keys)) {
    if (k === "countries_subtitle_fallback") continue;
    data[k] = v;
  }
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
  i18nUpdated++;
}
// EN: clear hero_badge
{
  const p = path.join(i18nDir, "en.json");
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  data.hero_badge = "";
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}

const seo = JSON.parse(fs.readFileSync(seoPath, "utf8"));
let seoN = 0;
for (const [page, langs] of Object.entries(seoPatches)) {
  if (!seo[page]) continue;
  for (const [lang, entry] of Object.entries(langs)) {
    if (!seo[page][lang]) continue;
    seo[page][lang].title = entry.title;
    seo[page][lang].description = entry.description;
    seoN++;
  }
}
fs.writeFileSync(seoPath, JSON.stringify(seo, null, 2) + "\n");
console.log("i18n locales", i18nUpdated, "seo entries", seoN);
