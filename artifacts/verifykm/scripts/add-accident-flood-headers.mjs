import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const i18nDir = path.join(__dirname, "../src/i18n");

const add = {
  en: {
    report_no_accidents_header: "No accidents found",
    report_not_flooded_header: "No flood record found",
  },
  sq: {
    report_no_accidents_header: "Nuk u gjetën aksidente",
    report_not_flooded_header: "Asnjë regjistrim përmbytje",
  },
  ar: {
    report_no_accidents_header: "لم يتم العثور على حوادث",
    report_not_flooded_header: "لا يوجد سجل فيضان",
  },
  bg: {
    report_no_accidents_header: "Няма намерени катастрофи",
    report_not_flooded_header: "Няма запис за наводнение",
  },
  de: {
    report_no_accidents_header: "Keine Unfälle gefunden",
    report_not_flooded_header: "Kein Hochwassereintrag gefunden",
  },
  es: {
    report_no_accidents_header: "No se encontraron accidentes",
    report_not_flooded_header: "No se encontró registro de inundación",
  },
  fr: {
    report_no_accidents_header: "Aucun accident trouvé",
    report_not_flooded_header: "Aucun enregistrement d'inondation trouvé",
  },
  ka: {
    report_no_accidents_header: "ავარიები არ მოიძებნა",
    report_not_flooded_header: "წყალდიდობის ჩანაწერი არ მოიძებნა",
  },
  pl: {
    report_no_accidents_header: "Nie znaleziono wypadków",
    report_not_flooded_header: "Nie znaleziono wpisu o zalaniu",
  },
  ro: {
    report_no_accidents_header: "Nu s-au găsit accidente",
    report_not_flooded_header: "Nu s-a găsit nicio înregistrare de inundație",
  },
  ru: {
    report_no_accidents_header: "Аварии не найдены",
    report_not_flooded_header: "Записей о затоплении не найдено",
  },
  uk: {
    report_no_accidents_header: "Аварій не знайдено",
    report_not_flooded_header: "Записів про затоплення не знайдено",
  },
  zh: {
    report_no_accidents_header: "未发现事故记录",
    report_not_flooded_header: "未发现水浸记录",
  },
};

const enPath = path.join(i18nDir, "en.json");
const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
Object.assign(en, add.en);
fs.writeFileSync(enPath, `${JSON.stringify(en, null, 2)}\n`);

for (const [loc, map] of Object.entries(add)) {
  if (loc === "en") continue;
  const filePath = path.join(i18nDir, `${loc}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  Object.assign(data, map);
  const ordered = {};
  for (const k of Object.keys(en)) {
    if (k in data) ordered[k] = data[k];
  }
  for (const k of Object.keys(data)) {
    if (!(k in ordered)) ordered[k] = data[k];
  }
  fs.writeFileSync(filePath, `${JSON.stringify(ordered, null, 2)}\n`);
  console.log(loc, "headers added");
}
console.log("done");
