/**
 * Authentic wwc_preview_* copy — no English "rollback" loanwords in non-en locales.
 * Run: node artifacts/verifykm/scripts/patch-wwc-preview-i18n.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../src/i18n");

const PATCHES = {
  en: {
    wwc_preview_mileage_status: "Tampered mileage",
    wwc_preview_mileage_clear: "Verified",
    wwc_preview_accidents_status: "2 records found",
    wwc_preview_accidents_clear: "No records",
    wwc_preview_salvage_status: "Not flagged",
    wwc_preview_theft_status: "Not reported",
    wwc_demo_row_rollback: "Odometer rolled back vs prior record",
  },
  sq: {
    wwc_preview_mileage_status: "Kilometrazh i manipuluar",
    wwc_preview_mileage_clear: "I verifikuar",
    wwc_preview_accidents_status: "2 regjistrime",
    wwc_preview_accidents_clear: "Asnjë regjistrim",
    wwc_preview_salvage_status: "Nuk është shënuar",
    wwc_preview_theft_status: "Nuk është raportuar",
    wwc_demo_row_rollback: "Kilometrazh u ul krahasuar me regjistrin e mëparshëm",
  },
  de: {
    wwc_preview_mileage_status: "Kilometerstand manipuliert",
    wwc_preview_mileage_clear: "Verifiziert",
    wwc_preview_accidents_status: "2 Einträge",
    wwc_preview_accidents_clear: "Keine Einträge",
    wwc_preview_salvage_status: "Nicht markiert",
    wwc_preview_theft_status: "Nicht gemeldet",
    wwc_demo_row_rollback: "Kilometerstand gegenüber Vorherwert gesunken",
  },
  fr: {
    wwc_preview_mileage_status: "Compteur manipulé",
    wwc_preview_mileage_clear: "Vérifié",
    wwc_preview_accidents_status: "2 enregistrements",
    wwc_preview_accidents_clear: "Aucun enregistrement",
    wwc_preview_salvage_status: "Non signalé",
    wwc_preview_theft_status: "Non déclaré",
    wwc_demo_row_rollback: "Baisse du kilométrage vs enregistrement précédent",
  },
  bg: {
    wwc_preview_mileage_status: "Манипулиран пробег",
    wwc_preview_mileage_clear: "Потвърден",
    wwc_preview_accidents_status: "2 записа",
    wwc_preview_accidents_clear: "Няма записи",
    wwc_preview_salvage_status: "Без маркировка",
    wwc_preview_theft_status: "Не е докладван",
    wwc_demo_row_rollback: "Намаление на пробега спрямо предишен запис",
  },
  pl: {
    wwc_preview_mileage_status: "Manipulacja przebiegu",
    wwc_preview_mileage_clear: "Zweryfikowany",
    wwc_preview_accidents_status: "2 wpisy",
    wwc_preview_accidents_clear: "Brak wpisów",
    wwc_preview_salvage_status: "Bez flagi",
    wwc_preview_theft_status: "Nie zgłoszono",
    wwc_demo_row_rollback: "Spadek przebiegu względem wcześniejszego wpisu",
  },
  ro: {
    wwc_preview_mileage_status: "Kilometraj manipulat",
    wwc_preview_mileage_clear: "Verificat",
    wwc_preview_accidents_status: "2 înregistrări",
    wwc_preview_accidents_clear: "Fără înregistrări",
    wwc_preview_salvage_status: "Nemarcat",
    wwc_preview_theft_status: "Neraportat",
    wwc_demo_row_rollback: "Kilometraj scăzut față de înregistrarea anterioară",
  },
  ru: {
    wwc_preview_mileage_status: "Манипуляция пробегом",
    wwc_preview_mileage_clear: "Подтверждён",
    wwc_preview_accidents_status: "2 записи",
    wwc_preview_accidents_clear: "Записей нет",
    wwc_preview_salvage_status: "Не отмечен",
    wwc_preview_theft_status: "Не заявлен",
    wwc_demo_row_rollback: "Снижение пробега относительно прошлой записи",
  },
  uk: {
    wwc_preview_mileage_status: "Маніпуляція пробігом",
    wwc_preview_mileage_clear: "Підтверджено",
    wwc_preview_accidents_status: "2 записи",
    wwc_preview_accidents_clear: "Записів немає",
    wwc_preview_salvage_status: "Не позначено",
    wwc_preview_theft_status: "Не заявлено",
    wwc_demo_row_rollback: "Зниження пробігу щодо попереднього запису",
  },
  ka: {
    wwc_preview_mileage_status: "გაყალბებული გარბენი",
    wwc_preview_mileage_clear: "დადასტურებული",
    wwc_preview_accidents_status: "2 ჩანაწერი",
    wwc_preview_accidents_clear: "ჩანაწერები არ არის",
    wwc_preview_salvage_status: "მონიშნული არ არის",
    wwc_preview_theft_status: "არ არის მოხსენებული",
    wwc_demo_row_rollback: "გარბენი შემცირდა წინა ჩანაწერთან შედარებით",
  },
  ar: {
    wwc_preview_mileage_status: "عداد مسافات م manipulated",
    wwc_preview_mileage_clear: "تم التحقق",
    wwc_preview_accidents_status: "سجلان",
    wwc_preview_accidents_clear: "لا توجد سجلات",
    wwc_preview_salvage_status: "غير مُعلَّم",
    wwc_preview_theft_status: "غير مُبلَّغ",
    wwc_demo_row_rollback: "انخفاض المسافة المقطوعة عن السجل السابق",
  },
  zh: {
    wwc_preview_mileage_status: "里程被篡改",
    wwc_preview_mileage_clear: "已核实",
    wwc_preview_accidents_status: "2 条记录",
    wwc_preview_accidents_clear: "无记录",
    wwc_preview_salvage_status: "未标记",
    wwc_preview_theft_status: "未上报",
    wwc_demo_row_rollback: "里程较上一记录下降",
  },
  es: {
    wwc_preview_mileage_status: "Kilometraje manipulado",
    wwc_preview_mileage_clear: "Verificado",
    wwc_preview_accidents_status: "2 registros",
    wwc_preview_accidents_clear: "Sin registros",
    wwc_preview_salvage_status: "Sin marca",
    wwc_preview_theft_status: "Sin reporte",
    wwc_demo_row_rollback: "Kilometraje inferior al registro anterior",
  },
};

// Fix Arabic typo
PATCHES.ar.wwc_preview_mileage_status = "عداد مسافات مُلاعَب";

for (const [lang, patch] of Object.entries(PATCHES)) {
  const path = join(dir, `${lang}.json`);
  const json = JSON.parse(readFileSync(path, "utf8"));
  Object.assign(json, patch);
  writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`, "utf8");
  console.log(`patched ${lang}.json`);
}
