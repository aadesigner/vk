import type { ReactNode } from "react";
import type { Language } from "@/lib/languages";

const LANGS = [
  "en", "de", "es", "fr", "sq", "pl", "ro", "bg", "ka", "ar", "uk", "ru", "zh",
] as const satisfies readonly Language[];

function L(...values: string[]): Record<Language, string> {
  const out = {} as Record<Language, string>;
  LANGS.forEach((lang, i) => {
    out[lang] = values[i] ?? values[0] ?? "";
  });
  return out;
}

type Kind = "gap" | "vin" | "steps" | "miles" | "loss" | "stolen" | "bills";

const KIND: Record<string, Kind> = {
  "free-km": "gap",
  rollback: "gap",
  "odo-scam": "gap",
  korea: "gap",
  "korea-sheet": "gap",
  "read-vin": "vin",
  salvage: "loss",
  accidents: "loss",
  stolen: "stolen",
  usa: "miles",
  "before-pay": "steps",
  "import-scam": "steps",
  cost: "bills",
};

const GAPS: Record<string, { left: string; right: string; leftWidth: string; rightWidth: string }> = {
  "free-km": { left: "48 000", right: "141 000", leftWidth: "32%", rightWidth: "88%" },
  rollback: { left: "36 400", right: "97 800", leftWidth: "36%", rightWidth: "72%" },
  "odo-scam": { left: "82 000", right: "214 000", leftWidth: "28%", rightWidth: "94%" },
  korea: { left: "41 200", right: "126 500", leftWidth: "30%", rightWidth: "80%" },
  "korea-sheet": { left: "58 000", right: "163 000", leftWidth: "34%", rightWidth: "86%" },
};

const gapTitle = L(
  "Put the two readings next to each other",
  "Legen Sie die zwei Ablesungen nebeneinander",
  "Pon las dos lecturas una al lado de la otra",
  "Posez les deux relevés côte à côte",
  "Vëri dy leximet pranë njëri-tjetrit",
  "Połóż dwa odczyty obok siebie",
  "Pune cele două citiri una lângă alta",
  "Сложете двата записа един до друг",
  "ორი ჩვენება გვერდიგვერდ დაალაგეთ",
  "ضع القراءتين جنبًا إلى جنب",
  "Поставте два показники поруч",
  "Поставьте два показания рядом",
  "把两个读数放在一起看",
);
const dash = L("On the dash today", "Heute im Cockpit", "Hoy en el tablero", "Aujourd'hui au tableau", "Sot te paneli", "Dziś na liczniku", "Azi pe bord", "Днес на таблото", "დღეს დაფაზე", "اليوم على العداد", "Сьогодні на панелі", "Сегодня на панели", "今天仪表上");
const older = L("Older record", "Älterer Beleg", "Registro anterior", "Relevé plus ancien", "Regjistrim më i vjetër", "Starszy zapis", "Înregistrare mai veche", "По-стар запис", "უფრო ძველი ჩანაწერი", "سجل أقدم", "Старіший запис", "Более старая запись", "更早的记录");
const gapNote = L(
  "If the older number is higher, the dash was changed.",
  "Ist die ältere Zahl höher, wurde der Tacho geändert.",
  "Si el número viejo es mayor, el tablero se cambió.",
  "Si l'ancien chiffre est plus haut, le compteur a été changé.",
  "Nëse shifra e vjetër është më e madhe, paneli është ndryshuar.",
  "Jeśli starsza liczba jest wyższa, licznik zmieniono.",
  "Dacă numărul vechi e mai mare, bordul a fost schimbat.",
  "Ако старото число е по-голямо, таблото е сменено.",
  "თუ ძველი რიცხვი მეტია, დაფა შეცვლილია.",
  "إذا كان الرقم الأقدم أعلى، فالعداد تغيّر.",
  "Якщо старе число більше, панель змінили.",
  "Если старое число больше, панель меняли.",
  "如果更早的数字更大，仪表就被改过。",
);

const vinTitle = L(
  "The same 17 characters, in three places",
  "Dieselben 17 Zeichen, an drei Stellen",
  "Los mismos 17 caracteres, en tres sitios",
  "Les mêmes 17 caractères, à trois endroits",
  "Të njëjtat 17 shenja, në tri vende",
  "Te same 17 znaków, w trzech miejscach",
  "Aceleași 17 caractere, în trei locuri",
  "Същите 17 знака, на три места",
  "იგივე 17 ნიშანი, სამ ადგილას",
  "نفس 17 رمزًا، في ثلاثة مواضع",
  "Ті самі 17 знаків, у трьох місцях",
  "Те же 17 знаков, в трёх местах",
  "同样的 17 位，出现在三处",
);
const windscreen = L("Windscreen", "Windschutzscheibe", "Parabrisas", "Pare-brise", "Xhami", "Szyba", "Parbriz", "Стъкло", "მინა", "الزجاج", "Скло", "Стекло", "挡风玻璃");
const door = L("Door sticker", "Türsticker", "Pegatina de la puerta", "Étiquette de porte", "Ngjitësja e derës", "Naklejka w drzwiach", "Autocolantul ușii", "Стикер на вратата", "კარის სტიკერი", "ملصق الباب", "Наклейка на дверях", "Наклейка на двери", "车门贴纸");
const papers = L("Papers", "Papiere", "Papeles", "Papiers", "Letrat", "Papiery", "Acte", "Документи", "საბუთები", "الأوراق", "Папери", "Бумаги", "文件");

const stepTitle = L(
  "This is the order that saves the money",
  "So bleibt das Geld bei Ihnen",
  "Este es el orden que te guarda el dinero",
  "C'est l'ordre qui garde l'argent",
  "Kjo radhë të ruan paratë",
  "Ta kolejność zostawia pieniądze u ciebie",
  "Ordinea asta îți păstrează banii",
  "Този ред пази парите ви",
  "ეს რიგი ფულს გიტოვებთ",
  "هذا الترتيب يبقي المال معك",
  "Цей порядок лишає гроші у вас",
  "Этот порядок оставляет деньги у вас",
  "按这个顺序，钱还在你手里",
);
const stepVin = L("Get the VIN", "VIN holen", "Pide el VIN", "Obtenez le VIN", "Merr VIN-in", "Weź VIN", "Ia VIN-ul", "Вземете VIN", "აიღეთ VIN", "خذ رقم الهيكل", "Візьміть VIN", "Возьмите VIN", "先拿到车架号");
const stepRead = L("Read the report", "Bericht lesen", "Lee el informe", "Lisez le rapport", "Lexo raportin", "Przeczytaj raport", "Citește raportul", "Прочетете отчета", "წაიკითხეთ ანგარიში", "اقرأ التقرير", "Прочитайте звіт", "Прочитайте отчёт", "先看报告");
const stepPay = L("Then pay", "Dann zahlen", "Luego paga", "Ensuite payez", "Pastaj paguaj", "Potem zapłać", "Abia apoi plătește", "Чак после това платете", "მერე გადაიხადეთ", "ثم ادفع", "І лише тоді платіть", "И только потом платите", "然后再付钱");

const milesTitle = L(
  "80,000 miles is not 80,000 kilometres",
  "80.000 Meilen sind nicht 80.000 Kilometer",
  "80.000 millas no son 80.000 kilómetros",
  "80 000 miles ne font pas 80 000 kilomètres",
  "80.000 milje nuk janë 80.000 kilometra",
  "80 000 mil to nie 80 000 kilometrów",
  "80.000 de mile nu sunt 80.000 de kilometri",
  "80 000 мили не са 80 000 километра",
  "80 000 მილი 80 000 კილომეტრი არ არის",
  "80,000 ميل ليست 80,000 كيلومتر",
  "80 000 миль це не 80 000 кілометрів",
  "80 000 миль это не 80 000 километров",
  "8 万英里不是 8 万公里",
);
const milesFrom = L("On the US paper", "Auf dem US-Papier", "En el papel de EE. UU.", "Sur le papier américain", "Në letrën amerikane", "Na amerykańskim papierze", "Pe hârtia din SUA", "На американската хартия", "ამერიკულ ფურცელზე", "على الورق الأمريكي", "На американському папері", "На американской бумаге", "在美国记录上");
const milesTo = L("On the road", "Auf der Straße", "En la carretera", "Sur la route", "Në rrugë", "Na drodze", "Pe drum", "На пътя", "გზაზე", "على الطريق", "На дорозі", "На дороге", "在路上");

const lossTitle = L(
  "Tidy paint, written-off record",
  "Sauberer Lack, abgeschriebener Eintrag",
  "Pintura limpia, registro de pérdida total",
  "Peinture propre, trace d'épave",
  "Bojë e pastër, shënim i humbjes",
  "Czysty lakier, zapis szkody całkowitej",
  "Vopsea curată, daună totală în acte",
  "Чиста боя, запис за тотал",
  "სუფთა საღებავი, ჩამოწერის ჩანაწერი",
  "طلاء نظيف وسجل شطب",
  "Чиста фарба, запис про тотал",
  "Чистая краска, запись о тотале",
  "漆是新的，记录是全损",
);
const looks = L("What you see", "Was Sie sehen", "Lo que ves", "Ce que vous voyez", "Çfarë sheh", "Co widzisz", "Ce vezi", "Какво виждате", "რას ხედავთ", "ما تراه", "Що ви бачите", "Что вы видите", "你看到的");
const record = L("What the record says", "Was der Eintrag sagt", "Lo que dice el registro", "Ce que dit le dossier", "Çfarë thotë regjistri", "Co mówi zapis", "Ce spun actele", "Какво казва записът", "რას ამბობს ჩანაწერი", "ماذا يقول السجل", "Що каже запис", "Что говорит запись", "记录上写的");
const looksOk = L("Looks repaired", "Sieht repariert aus", "Parece reparado", "Semble réparé", "Duket e rregulluar", "Wygląda na naprawione", "Pare reparat", "Изглежда ремонтирана", "შეკეთებულად ჩანს", "تبدو مُصلَحة", "Виглядає відремонтованим", "Выглядит отремонтированной", "看起来修好了");
const wroteOff = L("Insurer wrote it off", "Versicherer hat abgeschrieben", "El seguro la dio por perdida", "L'assureur l'a déclarée perdue", "Sigurimi e ka nxjerrë jashtë", "Ubezpieczyciel spisał", "Asigurătorul a casat-o", "Застрахователят я е отписал", "მზღვეველმა ჩამოწერა", "المؤمن شطبها", "Страховик списав", "Страховщик списал", "保险公司已报废");
const claimTitle = L(
  "Straight paint, a claim still on file",
  "Gerader Lack, Schaden bleibt in der Akte",
  "Pintura recta, parte todavía en el archivo",
  "Peinture droite, un dossier encore là",
  "Bojë e drejtë, kërkesa ende në dosje",
  "Prosty lakier, szkoda nadal w aktach",
  "Vopsea dreaptă, dosar încă în fișă",
  "Права боя, щетата още е в досието",
  "სწორი საღებავი, საქმე ჯერ ჩანაწერშია",
  "طلاء مستقيم والمطالبة ما زالت في الملف",
  "Рівна фарба, справа ще в записі",
  "Ровная краска, дело ещё в записи",
  "漆是直的，理赔还在档案里",
);
const claimOnFile = L("Claim on file", "Schaden in der Akte", "Parte en el archivo", "Dossier encore là", "Kërkesa në dosje", "Szkoda w aktach", "Dosar în fișă", "Щета в досието", "საქმე ჩანაწერშია", "مطالبة في الملف", "Справа в записі", "Дело в записи", "理赔在档");
const billTitle = L(
  "The small bill sits in front of the large ones",
  "Die kleine Rechnung steht vor den großen",
  "La factura pequeña va delante de las grandes",
  "La petite facture passe avant les grandes",
  "Fatura e vogël qëndron para të mëdhave",
  "Mały rachunek stoi przed dużymi",
  "Factura mică stă înaintea celor mari",
  "Малката сметка стои пред големите",
  "პატარა ანგარიში დიდების წინ დგას",
  "الفاتورة الصغيرة تقف أمام الكبيرة",
  "Малий рахунок стоїть перед великими",
  "Маленький счёт стоит перед большими",
  "小账单排在大账单前面",
);
const billReport = L("History check", "Bericht", "Informe", "Rapport", "Raporti", "Raport", "Raport", "Отчет", "ანგარიში", "التقرير", "Звіт", "Отчёт", "历史核查");
const billFare = L("The trip", "Die Fahrt", "El viaje", "Le trajet", "Rruga", "Dojazd", "Drumul", "Пътят", "გზა", "المسافة", "Дорога", "Дорога", "去看车");
const billBox = L("A gearbox", "Ein Getriebe", "Una caja de cambios", "Une boîte de vitesses", "Një kambio", "Skrzynia biegów", "O cutie de viteze", "Скоростна кутия", "გადაცემათა კოლოფი", "علبة تروس", "Коробка передач", "Коробка передач", "一台变速箱");

const clearWord = L("Clear", "Sauber", "Limpio", "Aucune alerte", "Pastër", "Czysto", "Curat", "Чисто", "სუფთა", "سليم", "Чисто", "Чисто", "没有记录");
const listedWord = L("Listed", "Eingetragen", "Consta", "Signalé", "I shënuar", "Wpisany", "Înregistrat", "Вписан", "შეყვანილია", "مُدرج", "У списку", "В списке", "已登记");
const stolenTitle = L(
  "Plates here do not clear a flag elsewhere",
  "Kennzeichen hier löschen kein Diebstahl woanders",
  "Las placas de aquí no borran un robo en otro sitio",
  "Des plaques ici n'effacent pas un vol ailleurs",
  "Targat këtu nuk e fshijnë vjedhjen diku tjetër",
  "Tablice tutaj nie kasują kradzieży gdzie indziej",
  "Plăcuțele de aici nu șterg un furt în altă parte",
  "Номерата тук не трият кражба другаде",
  "ნომრები აქ სხვაგან ქურდობას არ შლის",
  "اللوحات هنا لا تمسح سرقة في مكان آخر",
  "Номери тут не знімають викрадення деінде",
  "Номера здесь не снимают угон в другом месте",
  "这里上了牌，不等于别处没有盗抢记录",
);
const plates = L("Local plates", "Hiesige Kennzeichen", "Placas locales", "Plaques locales", "Targa vendore", "Lokalne tablice", "Numere locale", "Местни номера", "ადგილობრივი ნომრები", "لوحات محلية", "Місцеві номери", "Местные номера", "本地牌照");
const flagged = L("Stolen register", "Diebstahlregister", "Registro de robos", "Fichier des vols", "Regjistri i vjedhjeve", "Rejestr kradzieży", "Registru de furturi", "Регистър на кражбите", "ქურდობის რეესტრი", "سجل السرقة", "Реєстр викрадень", "Реестр угонов", "盗抢登记");

function Shell({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <figure className="mt-8 overflow-hidden rounded-2xl border border-[#00a5fd]/20 bg-white">
      <figcaption className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-950 sm:px-5">
        {title}
      </figcaption>
      <div className="px-4 py-4 sm:px-5 sm:py-5">{children}</div>
      {note ? <p className="border-t border-slate-200 px-4 py-3 text-sm leading-relaxed text-slate-600 sm:px-5">{note}</p> : null}
    </figure>
  );
}

export function BlogDemo({ id, lang }: { id: string; lang: Language }) {
  const kind = KIND[id];
  if (!kind) return null;

  if (kind === "gap") {
    const gap = GAPS[id] ?? GAPS["free-km"];
    return (
      <Shell title={gapTitle[lang]} note={gapNote[lang]}>
        <div className="space-y-3">
          <Bar label={dash[lang]} value={gap.left} width={gap.leftWidth} tone="bg-amber-500" />
          <Bar label={older[lang]} value={gap.right} width={gap.rightWidth} tone="bg-[#00a5fd]" />
        </div>
      </Shell>
    );
  }

  if (kind === "bills") {
    return (
      <Shell title={billTitle[lang]}>
        <div className="space-y-3">
          <Bar label={billReport[lang]} value="" width="12%" tone="bg-[#00a5fd]" />
          <Bar label={billFare[lang]} value="" width="28%" tone="bg-amber-500" />
          <Bar label={billBox[lang]} value="" width="92%" tone="bg-slate-700" />
        </div>
      </Shell>
    );
  }

  if (kind === "miles") {
    return (
      <Shell title={milesTitle[lang]}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Pair label={milesFrom[lang]} value="80 000 mi" />
          <Pair label={milesTo[lang]} value="129 000 km" />
        </div>
      </Shell>
    );
  }

  if (kind === "vin") {
    const spots = [windscreen[lang], door[lang], papers[lang]];
    return (
      <Shell title={vinTitle[lang]}>
        <div className="grid gap-2 sm:grid-cols-3">
          {spots.map((label, i) => (
            <div
              key={label}
              className="blog-demo-spot rounded-xl border border-[#00a5fd]/25 bg-[#f4f8fb] px-3 py-3"
              style={{ animationDelay: `${i * 1.6}s` }}
            >
              <p className="font-mono text-[10px] font-bold text-[#0088d4]">0{i + 1}</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">{label}</p>
              {i < 2 ? (
                <img
                  src={i === 0 ? "/vin-help/windshield-vin.jpg" : "/vin-help/door-jamb-vin.jpg"}
                  alt={label}
                  className="mt-3 h-28 w-full rounded-lg object-cover"
                />
              ) : (
                <p className="mt-3 font-mono text-xs tracking-[0.12em] text-slate-700">WVWZZZ3CZWE123456</p>
              )}
            </div>
          ))}
        </div>
      </Shell>
    );
  }

  if (kind === "steps") {
    const steps = [
      { n: "01", label: stepVin[lang], on: true },
      { n: "02", label: stepRead[lang], on: true },
      { n: "03", label: stepPay[lang], on: false },
    ];
    return (
      <Shell title={stepTitle[lang]}>
        <ol className="grid gap-2 sm:grid-cols-3">
          {steps.map((step) => (
            <li
              key={step.n}
              className={
                step.on
                  ? "rounded-xl border border-[#00a5fd]/30 bg-[#eef8fd] px-3 py-3"
                  : "rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 opacity-60"
              }
            >
              <p className="font-mono text-[10px] font-bold text-[#0088d4]">{step.n}</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">{step.label}</p>
            </li>
          ))}
        </ol>
      </Shell>
    );
  }

  if (kind === "stolen") {
    return (
      <Shell title={stolenTitle[lang]}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Pair label={plates[lang]} value={clearWord[lang]} />
          <Pair label={flagged[lang]} value={listedWord[lang]} warn />
        </div>
      </Shell>
    );
  }

  if (id === "accidents") {
    return (
      <Shell title={claimTitle[lang]}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Pair label={looks[lang]} value={looksOk[lang]} />
          <Pair label={record[lang]} value={claimOnFile[lang]} warn />
        </div>
      </Shell>
    );
  }

  return (
    <Shell title={lossTitle[lang]}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Pair label={looks[lang]} value={looksOk[lang]} />
        <Pair label={record[lang]} value={wroteOff[lang]} warn />
      </div>
    </Shell>
  );
}

function Bar({ label, value, width, tone }: { label: string; value: string; width: string; tone: string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <p className="text-xs font-semibold text-slate-600">{label}</p>
        {value ? <p className="font-mono text-sm font-bold tabular-nums text-slate-950">{value}</p> : null}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`blog-demo-bar h-full rounded-full ${tone}`}
          style={{ width, ["--blog-bar" as string]: width }}
        />
      </div>
    </div>
  );
}

function Pair({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-3 ${warn ? "border-red-200 bg-red-50" : "border-slate-200 bg-[#f7fafc]"}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-bold ${warn ? "text-red-700" : "text-slate-950"}`}>{value}</p>
    </div>
  );
}
