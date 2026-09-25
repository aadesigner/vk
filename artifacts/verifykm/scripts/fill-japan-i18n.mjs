/**
 * Fill remaining Japan i18n + home SEO market mentions (all locales).
 * Run: node artifacts/verifykm/scripts/fill-japan-i18n.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const i18nDir = path.join(root, "src", "i18n");

/** Shared body keys that were left as EN clones in secondary locales */
const BODY = {
  ar: {
    home_country_japan_h0: "درجة المزاد وسجل التصدير",
    home_country_japan_h1: "عداد المسافة وسجلات الصيانة",
    home_country_japan_h2: "حوادث وخطر الفيضان",
    country_japan_issue_0: "تلاعب بعداد المسافة — شائع في السيارات عالية الكيلومترات المصدّرة والمحلية",
    country_japan_issue_1: "درجات أضرار مزاد مخفية — إصلاحات هيكل غير مُفصح عنها في الخارج",
    country_japan_issue_2: "سيارات بأضرار فيضان أو إعصار تُعاد للبيع دون إفصاح كامل",
    country_japan_issue_3: "فجوات في سجل التصدير — شحن للخارج بتاريخ محلي ناقص",
    country_japan_included_0: "درجات المزاد وإشارات قوائم السوق",
    country_japan_included_1: "مؤشرات مطالبات التأمين والاصطدام",
    country_japan_included_2: "إشارات التسجيل ونقل الملكية",
    country_japan_included_3: "علامات الخسارة الكلية والإعادة للبناء عند التوفر",
    country_japan_included_4: "كشف التلاعب بالعداد عبر سجلات الصيانة",
    country_japan_included_5: "إشارات التصدير والتاريخ عبر الحدود",
    country_japan_issues_sub: "أبرز علامات التحذير في السيارات اليابانية المستعملة — قبل دفع العربون.",
    country_japan_included_sub:
      "كل تقرير يجمع إشارات المزاد والتسجيل والصيانة عبر أسواق اليابان الرئيسية وقنوات التصدير.",
    country_japan_included_note: "البيانات من مزوّدين مباشرين — لا نقدّر ولا نختلق السجلات.",
    country_japan_faq_0_q: "ماذا يعني VIN ياباني يبدأ بـ «J»؟",
    country_japan_faq_0_a:
      "أرقام VIN التي تبدأ بـ «J» تُخصص للمركبات المصنّعة في اليابان. يؤكد ذلك المنشأ لا السجل النظيف — تحقق دائماً من الكيلومترات ودرجات المزاد والحوادث.",
    country_japan_faq_1_q: "هل تُغطى تويوتا وهوندا ونيسان؟",
    country_japan_faq_1_a:
      "نعم. نغطي العلامات اليابانية الرئيسية مثل تويوتا وهوندا ونيسان ومازدا وسوبارو ولكزس وسوزوكي وميتسوبيشي، إضافةً إلى المستورد المسجّل في اليابان.",
    country_japan_faq_2_q: "هل يمكنني فحص سيارة يابانية قبل استيرادها؟",
    country_japan_faq_2_a:
      "نعم. نفّذ فحص VIN قبل التصدير لكشف تلاعب العداد ودرجات أضرار المزاد والإصلاحات المخفية التي قد لا تظهر في بلد الوجهة.",
    country_japan_wwc_mileage_seo:
      "نطابق قراءات العداد مع إشارات التسجيل والصيانة وبيانات السوق في اليابان.",
    country_japan_wwc_accidents_seo:
      "نُظهر سجل الاصطدام ومطالبات التأمين — بما في ذلك إصلاحات الهيكل المخفية.",
    country_japan_wwc_salvage_seo:
      "نُعلّم الخسارة الكلية وخطر الفيضان — بما في ذلك السيارات المُعادة للبيع بعد إعلان الخسارة.",
    country_japan_wwc_theft_seo:
      "نتحقق من سجلات السرقة والاسترداد وإشارات التصدير/الاستيراد حتى لا يبقى التاريخ عبر الحدود مخفياً.",
    country_japan_wwc_theft_stat_label: "سجلات السرقة والتصدير مُتحقَّق منها",
    footer_japan_link_1: "سجل السيارات اليابانية المستعملة",
    footer_japan_link_2: "المزاد وسجلات التصدير",
    footer_japan_link_3: "العداد وسجل الحوادث",
    footer_japan_link_4: "سجل تويوتا هوندا نيسان",
  },
  bg: {
    home_country_japan_h0: "Аукционна оценка и експортна история",
    home_country_japan_h1: "Километраж и сервизни записи",
    home_country_japan_h2: "Катастрофи и риск от наводнение",
    country_japan_issue_0: "Пренавиване на километража — често при автомобили с висок пробег и за експорт",
    country_japan_issue_1: "Скрити аукционни оценки за щети — каросерийни ремонти, неразкрити в чужбина",
    country_japan_issue_2: "Автомобили с щети от наводнение или тайфун, препродадени без пълно разкриване",
    country_japan_issue_3: "Пропуски в експортната история — изпратени в чужбина с непълна вътрешна история",
    country_japan_included_0: "Аукционни оценки и пазарни сигнали",
    country_japan_included_1: "Индикатори за застраховки и сблъсъци",
    country_japan_included_2: "Регистрация и прехвърляне на собственост",
    country_japan_included_3: "Флагове за тотал, отписване и възстановяване",
    country_japan_included_4: "Откриване на пренавиване чрез сервизни записи",
    country_japan_included_5: "Сигнали за експорт и трансгранична история",
    country_japan_issues_sub: "Най-честите червени флагове при японски употребявани коли — преди депозита.",
    country_japan_included_sub:
      "Всеки доклад събира аукционни, регистрационни и сервизни сигнали от основните японски пазари и експортни канали.",
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
    footer_japan_link_1: "История на японски употребявани коли",
    footer_japan_link_2: "Аукцион и експортни записи",
    footer_japan_link_3: "Километраж и катастрофи",
    footer_japan_link_4: "История Toyota Honda Nissan",
  },
  ka: {
    home_country_japan_h0: "აუქციონის შეფასება და ექსპორტის ისტორია",
    home_country_japan_h1: "გარბენი და სერვისის ჩანაწერები",
    home_country_japan_h2: "ავარიები და წყალდიდობის რისკი",
    country_japan_issue_0: "გარბენის გადახვევა — ხშირია მაღალგარბენიან და ექსპორტირებულ მანქანებში",
    country_japan_issue_1: "დაფარული აუქციონის ზიანის შეფასებები — კორპუსის რემონტი უცხოეთში არ ვლინდება",
    country_japan_issue_2: "წყალდიდობის ან ტაიფუნის ზიანი ხელახლა იყიდება სრული გამჟღავნების გარეშე",
    country_japan_issue_3: "ექსპორტის ჩანაწერების ხარვეზები — არასრული შიდა ისტორია გაგზავნისას",
    country_japan_included_0: "აუქციონის შეფასებები და ბაზრის სიგნალები",
    country_japan_included_1: "დაზღვევისა და შეჯახების ინდიკატორები",
    country_japan_included_2: "რეგისტრაცია და საკუთრების გადაცემა",
    country_japan_included_3: "სალვაჟის, ჩამოწერისა და აღდგენის ნიშნები",
    country_japan_included_4: "გარბენის გადახვევის გამოვლენა სერვისის ჩანაწერებით",
    country_japan_included_5: "ექსპორტისა და საზღვრისპირა ისტორიის სიგნალები",
    country_japan_issues_sub: "იაპონური მეორადი მანქანების ყველაზე გავრცელებული გაფრთხილებები — დეპოზიტამდე.",
    country_japan_included_sub:
      "ყოველი ანგარიში აერთიანებს აუქციონის, რეგისტრაციისა და სერვისის სიგნალებს იაპონიის ძირითადი ბაზრებიდან და ექსპორტის არხებიდან.",
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
    footer_japan_link_1: "იაპონური მეორადი მანქანების ისტორია",
    footer_japan_link_2: "აუქციონი და ექსპორტის ჩანაწერები",
    footer_japan_link_3: "გარბენი და ავარიები",
    footer_japan_link_4: "Toyota Honda Nissan ისტორია",
  },
  pl: {
    home_country_japan_h0: "Ocena aukcyjna i historia eksportu",
    home_country_japan_h1: "Przebieg i serwis",
    home_country_japan_h2: "Wypadki i ryzyko powodzi",
    country_japan_issue_0: "Cofanie licznika — częste przy autach z wysokim przebiegiem i eksportowanych",
    country_japan_issue_1: "Ukryte oceny szkód aukcyjnych — naprawy blacharskie nieujawniane za granicą",
    country_japan_issue_2: "Pojazdy z uszkodzeniami powodziowymi lub tajfunowymi sprzedawane bez pełnego ujawnienia",
    country_japan_issue_3: "Luki w historii eksportu — wysyłka za granicę z niepełną historią krajową",
    country_japan_included_0: "Oceny aukcyjne i sygnały rynkowe",
    country_japan_included_1: "Wskaźniki ubezpieczeń i kolizji",
    country_japan_included_2: "Rejestracja i przeniesienie własności",
    country_japan_included_3: "Flagi szkody całkowitej, spisania i odbudowy",
    country_japan_included_4: "Wykrywanie cofania licznika w serwisie",
    country_japan_included_5: "Sygnały eksportu i historii transgranicznej",
    country_japan_issues_sub: "Najczęstsze czerwone flagi przy japońskich używanych autach — przed zaliczką.",
    country_japan_included_sub:
      "Każdy raport łączy sygnały aukcyjne, rejestracyjne i serwisowe z głównych rynków Japonii i kanałów eksportu.",
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
    footer_japan_link_1: "Historia japońskich używanych aut",
    footer_japan_link_2: "Aukcja i eksport",
    footer_japan_link_3: "Przebieg i wypadki",
    footer_japan_link_4: "Historia Toyota Honda Nissan",
  },
  ro: {
    home_country_japan_h0: "Notă de licitație și istoric de export",
    home_country_japan_h1: "Kilometraj și service",
    home_country_japan_h2: "Accidente și risc de inundație",
    country_japan_issue_0: "Rulare înapoi a odometrului — frecventă la mașini cu kilometraj mare și la export",
    country_japan_issue_1: "Note de daune de licitație ascunse — reparații de caroserie nedenunțate în străinătate",
    country_japan_issue_2: "Vehicule cu daune de inundație sau taifun revândute fără dezvăluire completă",
    country_japan_issue_3: "Goluri în istoricul de export — expediate cu istoric intern incomplet",
    country_japan_included_0: "Note de licitație și semnale de piață",
    country_japan_included_1: "Indicatori de asigurări și coliziuni",
    country_japan_included_2: "Înregistrare și transfer de proprietate",
    country_japan_included_3: "Indicatoare de daună totală, radiere și reconstrucție",
    country_japan_included_4: "Detectarea fraudelor de odometru din service",
    country_japan_included_5: "Semnale de export și istoric transfrontalier",
    country_japan_issues_sub: "Cele mai comune semnale de alarmă la second-hand japonez — înainte de avans.",
    country_japan_included_sub:
      "Fiecare raport combină semnale de licitație, înregistrare și service din piețele majore ale Japoniei și canalele de export.",
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
    footer_japan_link_1: "Istoric auto second-hand japonez",
    footer_japan_link_2: "Licitație și export",
    footer_japan_link_3: "Kilometraj și accidente",
    footer_japan_link_4: "Istoric Toyota Honda Nissan",
  },
  ru: {
    home_country_japan_h0: "Аукционная оценка и история экспорта",
    home_country_japan_h1: "Пробег и сервисные записи",
    home_country_japan_h2: "Аварии и риск затопления",
    country_japan_issue_0: "Скрутка пробега — часто у машин с большим пробегом и на экспорт",
    country_japan_issue_1: "Скрытые аукционные оценки повреждений — кузовной ремонт не раскрыт за рубежом",
    country_japan_issue_2: "Авто с повреждениями от наводнения или тайфуна перепродаются без полного раскрытия",
    country_japan_issue_3: "Пробелы в экспортной истории — отправка за рубеж с неполной внутренней историей",
    country_japan_included_0: "Аукционные оценки и рыночные сигналы",
    country_japan_included_1: "Индикаторы страховых случаев и столкновений",
    country_japan_included_2: "Регистрация и смена собственника",
    country_japan_included_3: "Флаги тотала, списания и восстановления",
    country_japan_included_4: "Выявление скрутки пробега по сервису",
    country_japan_included_5: "Сигналы экспорта и трансграничной истории",
    country_japan_issues_sub: "Самые частые красные флаги у японских б/у авто — до задатка.",
    country_japan_included_sub:
      "Каждый отчёт объединяет аукционные, регистрационные и сервисные сигналы с основных рынков Японии и каналов экспорта.",
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
    footer_japan_link_1: "История японских б/у авто",
    footer_japan_link_2: "Аукцион и экспорт",
    footer_japan_link_3: "Пробег и аварии",
    footer_japan_link_4: "История Toyota Honda Nissan",
  },
  sq: {
    home_country_japan_h0: "Nota e ankandit dhe historia e eksportit",
    home_country_japan_h1: "Kilometrazhi dhe shërbimi",
    home_country_japan_h2: "Aksidente dhe rreziku i përmbytjes",
    country_japan_issue_0: "Kthim i kilometrazhit — i shpeshtë te makinat me kilometra të larta dhe për eksport",
    country_japan_issue_1: "Nota të fshehura dëmtimi nga ankandi — riparime karrocerie të pazbuluara jashtë vendit",
    country_japan_issue_2: "Makina me dëmtime nga përmbytja ose tajfuni të rishitura pa zbulim të plotë",
    country_japan_issue_3: "Boshllëqe në historinë e eksportit — dërgohen jashtë me histori të brendshme jo të plotë",
    country_japan_included_0: "Nota ankandi dhe sinjale tregu",
    country_japan_included_1: "Tregues të sigurimeve dhe përplasjeve",
    country_japan_included_2: "Regjistrimi dhe transferimi i pronësisë",
    country_japan_included_3: "Flamuj salvazhi, çregjistrimi dhe rindërtimi",
    country_japan_included_4: "Zbulimi i mashtrimit të kilometrazhit nga shërbimi",
    country_japan_included_5: "Sinjale eksporti dhe historie ndërkufitare",
    country_japan_issues_sub: "Flamujt e kuq më të zakonshëm te makinat japoneze të përdorura — para depozitës.",
    country_japan_included_sub:
      "Çdo raport bashkon sinjale ankandi, regjistrimi dhe shërbimi nga tregjet kryesore të Japonisë dhe kanalet e eksportit.",
    country_japan_included_note: "Të dhënat vijnë direkt nga ofruesit — nuk vlerësojmë as inventojmë rekorde.",
    country_japan_faq_0_q: "Çfarë do të thotë një VIN japonez që fillon me «J»?",
    country_japan_faq_0_a:
      "VIN-et me «J» u caktohen automjeteve të prodhuara në Japoni. Konfirmon origjinën, jo historinë e pastër — kontrolloni gjithmonë kilometrazhin, ankandet dhe aksidentet.",
    country_japan_faq_1_q: "A mbulohen Toyota, Honda dhe Nissan?",
    country_japan_faq_1_a:
      "Po. Mbulojmë markat kryesore japoneze si Toyota, Honda, Nissan, Mazda, Subaru, Lexus, Suzuki dhe Mitsubishi, plus importet e regjistruara në Japoni.",
    country_japan_faq_2_q: "A mund të kontrolloj një makinë japoneze para importit?",
    country_japan_faq_2_a:
      "Po. Bëni kontroll VIN para eksportit për të zbuluar mashtrimin e kilometrazhit, dëmtimet e ankandit dhe riparimet e fshehura.",
    country_japan_wwc_mileage_seo:
      "Krahasojmë leximet e odometrit me regjistrimin, shërbimin dhe të dhënat e tregut në Japoni.",
    country_japan_wwc_accidents_seo:
      "Shfaqim historinë e përplasjeve dhe sigurimeve — përfshirë riparimet e fshehura të karrocerisë.",
    country_japan_wwc_salvage_seo:
      "Shënojmë salvazhin, çregjistrimin dhe rrezikun e përmbytjes — përfshirë makinat e rishitura pas dëmtimit total.",
    country_japan_wwc_theft_seo:
      "Kontrollojmë vjedhjet/rikuperimet dhe sinjalet e eksportit/importit.",
    country_japan_wwc_theft_stat_label: "vjedhje dhe eksporte të verifikuara",
    footer_japan_link_1: "Historia e makinave japoneze të përdorura",
    footer_japan_link_2: "Ankandi dhe eksporti",
    footer_japan_link_3: "Kilometrazhi dhe aksidentet",
    footer_japan_link_4: "Historia Toyota Honda Nissan",
  },
  uk: {
    home_country_japan_h0: "Аукціонна оцінка та історія експорту",
    home_country_japan_h1: "Пробіг і сервісні записи",
    home_country_japan_h2: "ДТП та ризик затоплення",
    country_japan_issue_0: "Скручування пробігу — часто у авто з великим пробігом і на експорт",
    country_japan_issue_1: "Приховані аукціонні оцінки пошкоджень — кузовний ремонт не розкрито за кордоном",
    country_japan_issue_2: "Авто з пошкодженнями від повені чи тайфуну перепродають без повного розкриття",
    country_japan_issue_3: "Пробіли в експортній історії — відправка за кордон із неповною внутрішньою історією",
    country_japan_included_0: "Аукціонні оцінки та ринкові сигнали",
    country_japan_included_1: "Індикатори страхових випадків і зіткнень",
    country_japan_included_2: "Реєстрація та зміна власника",
    country_japan_included_3: "Прапорці тоталу, списання та відновлення",
    country_japan_included_4: "Виявлення скручування пробігу за сервісом",
    country_japan_included_5: "Сигнали експорту та транскордонної історії",
    country_japan_issues_sub: "Найчастіші червоні прапорці в японських б/в авто — до завдатку.",
    country_japan_included_sub:
      "Кожен звіт об’єднує аукціонні, реєстраційні та сервісні сигнали з основних ринків Японії та каналів експорту.",
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
    footer_japan_link_1: "Історія японських б/в авто",
    footer_japan_link_2: "Аукціон і експорт",
    footer_japan_link_3: "Пробіг і ДТП",
    footer_japan_link_4: "Історія Toyota Honda Nissan",
  },
  zh: {
    country_japan_issue_0: "里程表回拨 — 在高里程及出口车中很常见",
    country_japan_issue_1: "隐藏的拍卖损伤评级 — 钣金修复在海外常未披露",
    country_japan_issue_2: "水浸或台风损伤车辆在未充分披露的情况下重新上架",
    country_japan_issue_3: "出口记录缺口 — 运往海外时国内历史不完整",
    country_japan_included_0: "拍卖评级与市场挂牌信号",
    country_japan_included_1: "保险理赔与碰撞历史指标",
    country_japan_included_2: "注册与所有权转移信号",
    country_japan_included_3: "报废、注销与重建标记（如有）",
    country_japan_included_4: "通过保养记录检测里程回拨",
    country_japan_included_5: "出口与跨境历史信号",
    country_japan_issues_sub: "日系二手车最常见的风险信号 — 付定金前先看清。",
    country_japan_included_sub: "每份报告汇总日本主要市场与出口渠道的拍卖、注册与保养信号。",
    country_japan_included_note: "数据直接来自供应商 — 我们不估算、不编造记录。",
    country_japan_faq_0_q: "以「J」开头的日本 VIN 是什么意思？",
    country_japan_faq_0_a:
      "以「J」开头的 VIN 分配给日本制造的车辆。这确认产地，不代表历史干净 — 务必核查里程、拍卖评级与事故。",
    country_japan_faq_1_q: "是否覆盖丰田、本田和日产？",
    country_japan_faq_1_a:
      "是。我们覆盖丰田、本田、日产、马自达、斯巴鲁、雷克萨斯、铃木、三菱等主要日系品牌，以及在日本注册的进口车。",
    country_japan_faq_2_q: "进口前可以检查日本车吗？",
    country_japan_faq_2_a:
      "可以。在出口前进行 VIN 核查，可发现里程欺诈、拍卖损伤评级和目的国可能看不到的隐藏维修。",
    country_japan_wwc_mileage_seo: "我们将里程读数与日本的注册、保养与市场数据交叉核对。",
    country_japan_wwc_accidents_seo: "展示碰撞与保险理赔历史 — 包括私下与出口销售中常被省略的钣金修复。",
    country_japan_wwc_salvage_seo: "标记报废、注销与水浸风险 — 包括全损申报后重新上架的车辆。",
    country_japan_wwc_theft_seo: "核查失窃/找回记录以及进出口信号，避免跨境历史被隐藏。",
    country_japan_wwc_theft_stat_label: "已核查失窃与出口记录",
    footer_japan_link_1: "日本二手车历史",
    footer_japan_link_2: "拍卖与出口记录",
    footer_japan_link_3: "里程与事故历史",
    footer_japan_link_4: "丰田本田日产历史",
  },
};

/** Home market list strings — insert Japan where still missing */
const HOME_MARKETS = {
  en: {
    hero_subtext:
      "Instant car mileage check by VIN — spot odometer rollbacks, hidden accidents, salvage titles and theft. Vehicle history for cars from the USA, Korea, Canada, China, Japan and Dubai.",
    seo_home_body:
      "verifykm.com is a car mileage check and vehicle history report service. Enter a 17-character VIN to verify real odometer readings, uncover hidden accidents, salvage titles and theft records. We cover cars from the USA, Korea, Canada, China, Japan and Dubai — so you can buy used cars with clearer data before you pay.",
    seo_home_markets:
      "Vehicle history for cars from the USA, Korea, Canada, China, Japan and Dubai — mileage, accidents, salvage and theft in one report.",
  },
};

const SEO_HOME_DESC = {
  en: "Car mileage check by VIN — verify real km, accidents, salvage and theft. Vehicle history for cars from the USA, Korea, Canada, China, Japan and Dubai.",
  de: "VIN-Check: Kilometerstand, Unfälle und Totalschaden prüfen. Fahrzeughistorie für Autos aus den USA, Korea, Kanada, China, Japan und Dubai.",
  es: "Informe VIN: kilometraje, accidentes y siniestro total. Historial para coches de EE. UU., Corea del Sur, Canadá, China, Japón y Dubái.",
  fr: "Contrôle VIN : kilométrage, accidents et épave. Historique pour les voitures des États-Unis, de Corée, du Canada, de Chine, du Japon et de Dubaï.",
  sq: "Kontroll kilometrash me numrin e shasisë — verifikoni km origjinale, aksidente dhe historikun e makinës. Historia e automjeteve nga SHBA, Koreja, Kanadaja, Kina, Japonia dhe Dubai.",
  pl: "Sprawdzenie VIN: przebieg, wypadki i szkoda całkowita. Historia pojazdów z USA, Korei Południowej, Kanady, Chin, Japonii i Dubaju.",
  ro: "Verificare VIN: kilometraj, accidente și daună totală. Istoric pentru mașini din SUA, Coreea de Sud, Canada, China, Japonia și Dubai.",
  bg: "VIN проверка: пробег, катастрофи и тотал. История за автомобили от САЩ, Южна Корея, Канада, Китай, Япония и Дубай.",
  ka: "VIN შემოწმება: გარბენი, ავარიები და სალვაჟი. მანქანების ისტორია აშშ-დან, სამხრეთ კორეიდან, კანადიდან, ჩინეთიდან, იაპონიიდან და დუბაიდან.",
  ar: "فحص VIN: الكيلومترات والحوادث والإتلاف. سجل سيارات من الولايات المتحدة وكوريا الجنوبية وكندا والصين واليابان ودبي.",
  uk: "Перевірка VIN: пробіг, ДТП і тоталі. Історія для авто зі США, Південної Кореї, Канади, Китаю, Японії та Дубая.",
  ru: "Проверка VIN: пробег, ДТП и тоталы. История для автомобилей из США, Южной Кореи, Канады, Китая, Японии и Дубая.",
  zh: "VIN 查询：核实里程、事故与报废。美国、韩国、加拿大、中国、日本与迪拜车辆的历史报告。",
};

const HERO_PATCH = {
  de: [/China und Dubai/i, "China, Japan und Dubai"],
  es: [/China y Dubái/i, "China, Japón y Dubái"],
  fr: [/Chine et Dubaï|China et Dubaï/i, "Chine, Japon et Dubaï"],
  sq: [/Kinës dhe Dubait|Kina dhe Dubai|Kinës, Japonisë dhe Dubait/i, "Kina, Japonia dhe Dubai"],
  pl: [/Chin i Dubaju/i, "Chin, Japonii i Dubaju"],
  ro: [/China și Dubai/i, "China, Japonia și Dubai"],
  bg: [/Китай и Дубай/i, "Китай, Япония и Дубай"],
  ka: [/ჩინეთიდან და დუბაიდან/i, "ჩინეთიდან, იაპონიიდან და დუბაიდან"],
  ar: [/الصين ودبي/i, "الصين واليابان ودبي"],
  uk: [/Китаю та Дубая/i, "Китаю, Японії та Дубая"],
  ru: [/Китая и Дубая/i, "Китая, Японии и Дубая"],
  zh: [/中国与迪拜/i, "中国、日本与迪拜"],
};

let patched = 0;

for (const [lang, keys] of Object.entries(BODY)) {
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
  console.log(`i18n ${lang}: patched ${n} body keys`);
  patched += n;
}

// EN home keys
{
  const file = path.join(i18nDir, "en.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  Object.assign(data, HOME_MARKETS.en);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  console.log("i18n en: home market strings");
}

// Other locales: patch hero_subtext / seo_home_body / seo_home_markets via replacements
for (const [lang, [re, repl]] of Object.entries(HERO_PATCH)) {
  const file = path.join(i18nDir, `${lang}.json`);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const key of ["hero_subtext", "seo_home_body", "seo_home_markets"]) {
    if (typeof data[key] === "string" && !/Japan|Japon|Japón|Japoni|Japonia|Япон|იაპონ|اليابان|日本/i.test(data[key])) {
      const next = data[key].replace(re, repl);
      if (next !== data[key]) {
        data[key] = next;
        console.log(`i18n ${lang}: ${key} +Japan`);
      } else {
        console.log(`WARN ${lang} ${key}: no match for Japan insert`);
      }
    }
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

// seo-data home descriptions
const seoPath = path.join(root, "src", "lib", "seo-data.json");
const seo = JSON.parse(fs.readFileSync(seoPath, "utf8"));
for (const [lang, desc] of Object.entries(SEO_HOME_DESC)) {
  if (seo.home?.[lang]) {
    seo.home[lang].description = desc;
  }
}
fs.writeFileSync(seoPath, JSON.stringify(seo, null, 2) + "\n");
console.log("seo-data: home descriptions include Japan");

// Sync marketing-seo-data if present
const mseoPath = path.resolve(root, "../../lib/marketing-page-seo/marketing-seo-data.json");
if (fs.existsSync(mseoPath)) {
  const mseo = JSON.parse(fs.readFileSync(mseoPath, "utf8"));
  mseo.country_japan = seo.country_japan;
  if (mseo.home) {
    for (const [lang, desc] of Object.entries(SEO_HOME_DESC)) {
      if (mseo.home[lang]) mseo.home[lang].description = desc;
    }
  }
  fs.writeFileSync(mseoPath, JSON.stringify(mseo, null, 2) + "\n");
  console.log("marketing-seo-data synced");
}

console.log("done, body patches:", patched);
