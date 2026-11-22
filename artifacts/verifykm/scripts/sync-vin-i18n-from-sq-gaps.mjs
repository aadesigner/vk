/**
 * Fill VIN/report i18n keys that Albanian (sq) translated (or en added)
 * but other locales still miss / leave in English.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const i18nDir = path.join(__dirname, "../src/i18n");

/** @type {Record<string, Record<string, string>>} */
const patches = {
  ar: {
    error_chunk_title: "يرجى تحديث هذه الصفحة",
    error_chunk_desc:
      "تم تحديث الموقع أثناء فتح هذه العلامة. حدّث الصفحة لتحميل أحدث إصدار والمتابعة.",
    report_no_accidents_header: "لم يتم العثور على حوادث",
    report_not_flooded_header: "لا يوجد سجل فيضان",
    report_events_history: "الأحداث",
    report_events_history_note:
      "أحداث أخرى مسجّلة للمركبة ليست ملكية أو فحوصات أو مطالبات تأمين.",
    report_timeline_events: "حدث",
    report_recall_history_note_generic:
      "استدعاءات أمان من الشركة المصنّعة لنطاقات إنتاج وسنوات طراز محددة، بما في ذلك حالة كل استدعاء.",
    provider_no: "لا",
    provider_usage_taxi: "تاكسي",
    provider_flag_dealer: "تاجر",
    registry_field_contact: "جهة اتصال",
    mileage_description: "الوصف",
    mileage_services: "الوصف",
    mileage_km_miles: "{km} كم ({miles} ميل)",
    mileage_miles_in_parens: "({miles} ميل)",
    accidents_count: "{count} حوادث",
    accident_count_one: "{count} حادث",
    live_feed_ping_accident: "حادث",
    mock_label_accidents: "الحوادث",
    vin_segment_model: "الطراز",
    service_history_default_title: "صيانة",
    accident_type: "النوع",
    title_word_salvage: "خسارة كلية",
    title_word_rebuilt: "معاد بناؤه",
    title_word_junk: "خردة",
    title_word_clean: "نظيف",
    title_phrase_salvage_title: "سند خسارة كلية",
    title_phrase_rebuilt_title: "سند معاد بناؤه",
    title_phrase_clean_title: "سند نظيف",
    title_phrase_certificate_of_title: "شهادة ملكية",
    title_phrase_parts_only: "قطع فقط",
    title_val_ab_bos_salvage: "Ab - Bos - خسارة كلية",
    title_val_bv_salvage_title: "Bv - سند خسارة كلية",
    report_timeline_accident: "حادث",
    report_timeline_service: "صيانة",
    report_details: "التفاصيل",
    wwc_demo_fuel_diesel: "ديزل",
    wwc_demo_fuel_electric: "كهربائي",
    wwc_demo_fuel_hybrid: "هجين",
    wwc_demo_col_date: "التاريخ",
    wwc_demo_col_source: "المصدر",
    wwc_demo_col_status: "الحالة",
    vin_360_exterior: "خارجي",
    vin_360_interior: "داخلي",
  },
  bg: {
    error_chunk_title: "Моля, презаредете тази страница",
    error_chunk_desc:
      "Сайтът беше обновен, докато този раздел беше отворен. Презаредете, за да заредите най-новата версия и да продължите.",
    report_no_accidents_header: "Няма намерени катастрофи",
    report_not_flooded_header: "Няма запис за наводнение",
    report_events_history: "Събития",
    report_events_history_note:
      "Други записани събития за автомобила, които не са собственост, прегледи или застрахователни претенции.",
    report_timeline_events: "Събитие",
    report_recall_history_note_generic:
      "Сервизни извиквания за безопасност от производителя за конкретни производствени серии и години на модела, включително статуса на всяко извикване.",
    provider_usage_taxi: "Такси",
    provider_flag_dealer: "Дилър",
    title_word_salvage: "Тотална щета",
    title_val_ab_bos_salvage: "Ab - Bos - Тотална щета",
    title_val_bv_salvage_title: "Bv - Документ за тотална щета",
    service_history_default_title: "Сервиз",
    report_timeline_service: "Сервиз",
    wwc_demo_fuel_diesel: "Дизел",
    wwc_demo_col_status: "Статус",
  },
  de: {
    error_chunk_title: "Bitte aktualisieren Sie diese Seite",
    error_chunk_desc:
      "Die Website wurde aktualisiert, während dieser Tab geöffnet war. Aktualisieren Sie die Seite, um die neueste Version zu laden und fortzufahren.",
    report_no_accidents_header: "Keine Unfälle gefunden",
    report_not_flooded_header: "Kein Hochwassereintrag gefunden",
    report_events_history: "Ereignisse",
    report_events_history_note:
      "Weitere erfasste Fahrzeugereignisse, die weder Besitz, Inspektionen noch Versicherungsansprüche sind.",
    report_timeline_events: "Ereignis",
    report_recall_history_note_generic:
      "Hersteller-Sicherheitsrückrufe für bestimmte Produktionsbereiche und Modelljahre, einschließlich des Status jedes Rückrufs.",
    service_history_default_title: "Wartung",
    title_word_salvage: "Totalschaden",
    title_word_rebuilt: "Wiederaufgebaut",
    title_word_junk: "Schrott",
    title_word_clean: "Sauber",
    title_phrase_salvage_title: "Totalschaden-Titel",
    title_phrase_rebuilt_title: "Wiederaufgebauter Titel",
    title_phrase_clean_title: "Sauberer Titel",
    title_phrase_certificate_of_title: "Zulassungsbescheinigung",
    title_phrase_parts_only: "Nur Teile",
    title_val_ab_bos_salvage: "Ab - Bos - Totalschaden",
    title_val_bv_salvage_title: "Bv - Totalschaden-Titel",
    report_timeline_service: "Wartung",
    report_details: "Einzelheiten",
    wwc_demo_fuel_diesel: "Dieselkraftstoff",
    wwc_demo_fuel_hybrid: "Hybridantrieb",
    wwc_demo_col_status: "Zustand",
    provider_usage_taxi: "Taxi",
  },
  es: {
    error_chunk_title: "Actualice esta página",
    error_chunk_desc:
      "El sitio se actualizó mientras esta pestaña estaba abierta. Actualice para cargar la última versión y continuar.",
    report_no_accidents_header: "No se encontraron accidentes",
    report_not_flooded_header: "No se encontró registro de inundación",
    report_events_history: "Eventos",
    report_events_history_note:
      "Otros eventos registrados del vehículo que no son propiedad, inspecciones ni reclamaciones de seguro.",
    report_timeline_events: "Evento",
    report_recall_history_note_generic:
      "Retiros de seguridad del fabricante para rangos de producción y años de modelo específicos, incluido el estado de cada retiro.",
    provider_no: "No",
    provider_usage_taxi: "Taxi",
    vin_360_exterior: "Exterior",
    vin_360_interior: "Interior",
  },
  fr: {
    error_chunk_title: "Veuillez actualiser cette page",
    error_chunk_desc:
      "Le site a été mis à jour pendant que cet onglet était ouvert. Actualisez pour charger la dernière version et continuer.",
    report_no_accidents_header: "Aucun accident trouvé",
    report_not_flooded_header: "Aucun enregistrement d'inondation trouvé",
    report_events_history: "Événements",
    report_events_history_note:
      "Autres événements enregistrés du véhicule qui ne sont ni propriété, ni inspections, ni sinistres d'assurance.",
    report_timeline_events: "Événement",
    report_recall_history_note_generic:
      "Rappels de sécurité du fabricant pour des plages de production et années modèles spécifiques, y compris le statut de chaque rappel.",
    accidents_count: "{count} accidents",
    accident_count_one: "{count} accident",
    live_feed_ping_accident: "Accident",
    mock_label_accidents: "Accidents",
    mileage_km_miles: "{km} km ({miles} miles)",
    mileage_miles_in_parens: "({miles} miles)",
    mileage_services: "Description",
    mileage_description: "Description",
    service_history_default_title: "Entretien",
    accident_type: "Type",
    title_word_salvage: "Perte totale",
    title_val_ab_bos_salvage: "Ab - Bos - Perte totale",
    report_timeline_accident: "Accident",
    registry_field_contact: "Contact",
    provider_usage_taxi: "Taxi",
    wwc_demo_fuel_diesel: "Diesel",
    wwc_demo_col_date: "Date",
    wwc_demo_col_source: "Source",
  },
  ka: {
    report_no_accidents_header: "ავარიები არ მოიძებნა",
    report_not_flooded_header: "წყალდიდობის ჩანაწერი არ მოიძებნა",
    report_events_history: "მოვლენები",
    report_events_history_note:
      "ავტომობილის სხვა დაფიქსირებული მოვლენები, რომლებიც არ არის საკუთრება, ინსპექტირება ან სადაზღვევო მოთხოვნები.",
    report_timeline_events: "მოვლენა",
    report_recall_history_note_generic:
      "მწარმოებლის უსაფრთხოების გამოხმობები კონკრეტული წარმოების დიაპაზონებისა და მოდელის წლებისთვის, მათ შორის თითოეული გამოხმობის სტატუსი.",
  },
  pl: {
    error_chunk_title: "Odśwież tę stronę",
    error_chunk_desc:
      "Witryna została zaktualizowana, gdy ta karta była otwarta. Odśwież, aby wczytać najnowszą wersję i kontynuować.",
    report_no_accidents_header: "Nie znaleziono wypadków",
    report_not_flooded_header: "Nie znaleziono wpisu o zalaniu",
    report_events_history: "Zdarzenia",
    report_events_history_note:
      "Inne zarejestrowane zdarzenia pojazdu, które nie są własnością, przeglądami ani roszczeniami ubezpieczeniowymi.",
    report_timeline_events: "Zdarzenie",
    report_recall_history_note_generic:
      "Wezwania serwisowe producenta dotyczące bezpieczeństwa dla określonych zakresów produkcji i lat modelu, w tym status każdego wezwania.",
    vin_segment_model: "Model",
    title_word_salvage: "Szkoda całkowita",
    title_val_ab_bos_salvage: "Ab - Bos - Szkoda całkowita",
    provider_flag_dealer: "Dealer",
    wwc_demo_fuel_diesel: "Olej napędowy",
    wwc_demo_col_status: "Status",
  },
  ro: {
    error_chunk_title: "Reîmprospătați această pagină",
    error_chunk_desc:
      "Site-ul a fost actualizat în timp ce această filă era deschisă. Reîmprospătați pentru a încărca cea mai recentă versiune și continuați.",
    report_no_accidents_header: "Nu s-au găsit accidente",
    report_not_flooded_header: "Nu s-a găsit nicio înregistrare de inundație",
    report_events_history: "Evenimente",
    report_events_history_note:
      "Alte evenimente înregistrate ale vehiculului care nu sunt proprietate, inspecții sau daune de asigurare.",
    report_timeline_events: "Eveniment",
    report_recall_history_note_generic:
      "Rechemări de siguranță ale producătorului pentru intervale de producție și ani de model specifice, inclusiv starea fiecărei rechemări.",
    accident_count_one: "{count} accident",
    live_feed_ping_accident: "Accident",
    vin_segment_model: "Model",
    service_history_default_title: "Service",
    report_timeline_accident: "Accident",
    report_timeline_service: "Service",
    registry_field_contact: "Contact",
    provider_flag_dealer: "Dealer",
    provider_usage_taxi: "Taxi",
    wwc_demo_fuel_diesel: "Motorină",
    wwc_demo_fuel_electric: "Electric",
    wwc_demo_col_status: "Status",
    vin_360_exterior: "Exterior",
    vin_360_interior: "Interior",
  },
  ru: {
    error_chunk_title: "Пожалуйста, обновите эту страницу",
    error_chunk_desc:
      "Сайт обновился, пока эта вкладка была открыта. Обновите страницу, чтобы загрузить последнюю версию и продолжить.",
    report_no_accidents_header: "Аварии не найдены",
    report_not_flooded_header: "Записей о затоплении не найдено",
    report_events_history: "События",
    report_events_history_note:
      "Другие зафиксированные события автомобиля, которые не являются сменой владельца, осмотрами или страховыми случаями.",
    report_timeline_events: "Событие",
    report_recall_history_note_generic:
      "Отзывные кампании производителя по безопасности для конкретных производственных партий и модельных годов, включая статус каждого отзыва.",
  },
  uk: {
    error_chunk_title: "Будь ласка, оновіть цю сторінку",
    error_chunk_desc:
      "Сайт оновився, поки ця вкладка була відкрита. Оновіть сторінку, щоб завантажити останню версію та продовжити.",
    report_no_accidents_header: "Аварій не знайдено",
    report_not_flooded_header: "Записів про затоплення не знайдено",
    report_events_history: "Події",
    report_events_history_note:
      "Інші зафіксовані події автомобіля, які не є власністю, оглядами чи страховими випадками.",
    report_timeline_events: "Подія",
    report_recall_history_note_generic:
      "Відкликання виробника з питань безпеки для конкретних виробничих діапазонів і років моделі, включно зі статусом кожного відкликання.",
  },
  zh: {
    error_chunk_title: "请刷新此页面",
    error_chunk_desc: "此标签页打开期间网站已更新。请刷新以加载最新版本并继续。",
    report_no_accidents_header: "未发现事故记录",
    report_not_flooded_header: "未发现水浸记录",
    report_events_history: "事件",
    report_events_history_note: "其他已记录的车辆事件，不属于所有权变更、检测或保险理赔。",
    report_timeline_events: "事件",
    report_recall_history_note_generic:
      "制造商针对特定生产批次和车型年份的安全召回，包括每项召回的状态。",
    title_val_ab_bos_salvage: "Ab - Bos - 报废",
    title_val_bv_salvage_title: "Bv - 报废标题",
  },
  sq: {
    report_events_history: "Ngjarjet",
    report_events_history_note:
      "Ngjarje të tjera të regjistruara të automjetit që nuk janë pronësi, inspeksione ose pretendime sigurimi.",
    report_timeline_events: "Ngjarje",
    report_recall_history_note_generic:
      "Tërheqje sigurie nga prodhuesi për intervale prodhimi dhe vite modeli specifike, duke përfshirë statusin e çdo tërheqjeje.",
  },
};

const en = JSON.parse(fs.readFileSync(path.join(i18nDir, "en.json"), "utf8"));
const enKeys = Object.keys(en);

let total = 0;
for (const [loc, map] of Object.entries(patches)) {
  const filePath = path.join(i18nDir, `${loc}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  let n = 0;
  for (const [k, v] of Object.entries(map)) {
    if (!(k in en)) {
      console.warn(`[${loc}] skip unknown key ${k}`);
      continue;
    }
    if (data[k] !== v) {
      data[k] = v;
      n += 1;
    }
  }
  const ordered = {};
  for (const k of enKeys) {
    if (k in data) ordered[k] = data[k];
  }
  for (const k of Object.keys(data)) {
    if (!(k in ordered)) ordered[k] = data[k];
  }
  fs.writeFileSync(filePath, `${JSON.stringify(ordered, null, 2)}\n`, "utf8");
  console.log(`${loc}: ${n} keys updated`);
  total += n;
}
console.log(`done, ${total} total updates`);
