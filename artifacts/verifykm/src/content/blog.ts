import type { Language } from "@/lib/languages";
import { BLOG_REST } from "@/content/blog-rest";
import { BLOG_MORE } from "@/content/blog-more";
import { BLOG_MARKET } from "@/content/blog-market";
import { BLOG_DEPTH } from "@/content/blog-depth";

const LANGS = [
  "en", "de", "es", "fr", "sq", "pl", "ro", "bg", "ka", "ar", "uk", "ru", "zh",
] as const satisfies readonly Language[];

export const BLOG_INDEX_SLUG: Record<Language, string> = {
  en: "blog",
  de: "ratgeber",
  es: "guias",
  fr: "conseils",
  sq: "blog",
  pl: "poradnik",
  ro: "ghid",
  bg: "saveti",
  ka: "blogi",
  ar: "maqalat",
  uk: "poradnyk",
  ru: "sovety",
  zh: "zhinan",
};

type L = Record<Language, string>;

export function L(...values: readonly string[]): L {
  const out = {} as L;
  LANGS.forEach((lang, i) => {
    out[lang] = values[i] ?? values[0] ?? "";
  });
  return out;
}

export type Section = { h: L; p: L; figure?: string };

export type BlogArticle = {
  id: string;
  minutes: number;
  slug: L;
  title: L;
  description: L;
  kicker: L;
  sections: Section[];
};

const BLOG_LEAD: BlogArticle[] = [
  {
    id: "free-km",
    minutes: 6,
    kicker: L("Mileage", "Kilometer", "Kilómetros", "Kilométrage", "Kilometrat", "Przebieg", "Kilometri", "Пробег", "კილომეტრები", "الكيلومترات", "Пробіг", "Пробег", "公里"),
    slug: L(
      "how-to-check-car-kilometres-for-free",
      "kilometerstand-kostenlos-pruefen",
      "comprobar-kilometros-coche-gratis",
      "verifier-kilometrage-gratuitement",
      "si-te-kontrollosh-kilometrat-e-makines-falas",
      "jak-sprawdzic-przebieg-za-darmo",
      "cum-verifici-kilometrii-gratuit",
      "kak-da-proverite-probeg-bezplatno",
      "rogor-sheamotsmot-kilometrebi-ufasod",
      "kayfa-tafhas-kilometrat-majjan",
      "yak-pereviryty-probig-bezkoshtovno",
      "kak-proverit-probeg-besplatno",
      "mianfei-cha-gonglishu",
    ),
    title: L(
      "How to check a car's kilometres for free",
      "Kilometerstand kostenlos prüfen: geht das wirklich?",
      "Cómo comprobar los kilómetros de un coche gratis",
      "Vérifier le kilométrage d'une voiture gratuitement",
      "Si të kontrollosh kilometrat e makinës falas?",
      "Jak sprawdzić przebieg auta za darmo",
      "Cum verifici kilometrii unei mașini gratis",
      "Как да проверите пробега на кола безплатно",
      "როგორ შეამოწმოთ მანქანის კილომეტრები უფასოდ",
      "كيف تفحص كيلومترات السيارة مجاناً",
      "Як перевірити пробіг авто безкоштовно",
      "Как проверить пробег машины бесплатно",
      "怎么免费查一辆车的公里数",
    ),
    description: L(
      "There is no reliable free way to see a car's real kilometres. A paid history report is cheaper than a bad buy.",
      "Einen echten Kilometerstand gibt es nicht zuverlässig umsonst. Ein Bericht ist günstiger als ein Fehlkauf.",
      "No hay una forma fiable y gratis de ver los kilómetros reales. Un informe sale más barato que un mal coche.",
      "Il n'existe pas de moyen fiable et gratuit de voir le vrai kilométrage. Un rapport coûte moins qu'une mauvaise affaire.",
      "Nuk ka një mënyrë të besueshme falas për të parë kilometrat e vërtetë. Një raport të kursen para dhe kohë.",
      "Nie ma pewnego i darmowego sposobu, by zobaczyć prawdziwy przebieg. Raport jest tańszy niż zła decyzja.",
      "Nu există o cale sigură și gratuită să vezi kilometrii reali. Un raport costă mai puțin decât o afacere proastă.",
      "Няма сигурен безплатен начин да видите реалния пробег. Отчетът излиза по-евтино от лоша покупка.",
      "საიმედო უფასო გზა რეალური კილომეტრების სანახავად არ არსებობს. ანგარიში ცუდ ყიდვაზე იაფია.",
      "لا توجد طريقة مجانية موثوقة لرؤية الكيلومترات الحقيقية. التقرير أوفر من صفقة سيئة.",
      "Надійного безкоштовного способу побачити реальний пробіг немає. Звіт дешевший за невдалу покупку.",
      "Надёжного бесплатного способа увидеть реальный пробег нет. Отчёт дешевле неудачной покупки.",
      "没有可靠的免费办法看清真实公里。一份报告比买错车便宜得多。",
    ),
    sections: [
      {
        h: L(
          "A free decoder does not show the kilometres",
          "Ein kostenloser Decoder zeigt keinen Kilometerstand",
          "Un decodificador gratis no enseña los kilómetros",
          "Un décodeur gratuit ne montre pas le kilométrage",
          "Kontrolli falas nuk i tregon kilometrat",
          "Darmowy dekoder nie pokazuje przebiegu",
          "Un decoder gratuit nu arată kilometrii",
          "Безплатният декодер не показва пробега",
          "უფასო დეკოდერი კილომეტრებს არ აჩვენებს",
          "فك التشفير المجاني لا يُظهر الكيلومترات",
          "Безкоштовний декодер не показує пробіг",
          "Бесплатный декодер не показывает пробег",
          "免费解码看不出公里数",
        ),
        p: L(
          "You can read a VIN for free and learn the year, the plant and the rough model. That is all a free tool is built to do. The kilometres live in auction sheets, insurer files and earlier listings, and those records are not handed out for nothing. If a website promises the full odometer trail with no payment, it is guessing or it is selling you something else.",
          "Die VIN lässt sich kostenlos lesen: Jahr, Werk, grobes Modell. Mehr macht ein kostenloses Werkzeug nicht. Der Kilometerstand steht in Auktionsbögen, Versicherungsakten und alten Inseraten, und diese Daten gibt es nicht umsonst. Eine Seite, die die ganze Tacho-Historie ohne Bezahlung verspricht, rät oder verkauft Ihnen etwas anderes.",
          "Puedes leer un VIN gratis y saber el año, la fábrica y el modelo aproximado. Eso es todo lo que hace una herramienta gratis. Los kilómetros están en fichas de subasta, archivos de seguros y anuncios viejos, y esos datos no se regalan. Si una web promete todo el historial del cuentakilómetros sin pagar, está adivinando o te está vendiendo otra cosa.",
          "On peut lire un VIN gratuitement et obtenir l'année, l'usine et le modèle approximatif. Un outil gratuit s'arrête là. Les kilomètres sont dans les fiches d'enchères, les dossiers d'assurance et les anciennes annonces, et ces données ne se donnent pas. Un site qui promet toute la trace du compteur sans paiement devine, ou vous vend autre chose.",
          "VIN-in mund ta lexosh falas dhe të mësosh vitin, fabrikën dhe modelin përafërsisht. Më shumë se kaq një faqe falas nuk bën. Kilometrat qëndrojnë në fletët e ankandit, në dosjet e sigurimit dhe në shpalljet e vjetra, dhe ato të dhëna nuk jepen falas. Nëse një faqe të premton gjithë historinë e kilometrave pa pagesë, ose po i hamendëson, ose po të shet diçka tjetër.",
          "VIN da się odczytać za darmo: rok, fabryka, przybliżony model. Na tym kończy się darmowe narzędzie. Przebieg siedzi w kartach aukcyjnych, aktach ubezpieczycieli i starych ogłoszeniach, a tych zapisów nikt nie rozdaje. Strona, która obiecuje całą historię licznika bez płatności, zgaduje albo sprzedaje ci coś innego.",
          "VIN-ul se citește gratis: anul, fabrica și modelul aproximativ. Atât face un instrument gratuit. Kilometrii stau în fișele de licitație, dosarele de asigurare și anunțurile vechi, iar acele date nu se dau degeaba. Un site care promite toată urma kilometrilor fără plată ghicește sau îți vinde altceva.",
          "VIN се чете безплатно: година, завод, приблизителен модел. Това е всичко, което прави безплатен инструмент. Пробегът стои в тръжни листове, застрахователни досиета и стари обяви, и тези записи не се раздават. Сайт, който обещава цялата история на километража без плащане, гадае или ви продава нещо друго.",
          "VIN უფასოდ იკითხება: წელი, ქარხანა, დაახლოებითი მოდელი. უფასო ხელსაწყო აქ ჩერდება. კილომეტრები აუქციონის ფურცლებში, სადაზღვევო საქმეებსა და ძველ განცხადებებშია და მათ უფასოდ არ გასცემენ. თუ საიტი გპირდებათ სრულ ისტორიას გადახდის გარეშე, ის გამოცნობს ან სხვა რამეს გყიდით.",
          "يمكنك قراءة رقم الهيكل مجاناً لمعرفة السنة والمصنع والموديل التقريبي. هذا كل ما يفعله الفحص المجاني. الكيلومترات توجد في أوراق المزاد وملفات التأمين والإعلانات القديمة، وهذه السجلات لا تُمنح بلا مقابل. إذا وعدك موقع بكامل أثر العداد دون دفع، فهو يخمّن أو يبيعك شيئاً آخر.",
          "VIN читається безкоштовно: рік, завод, приблизну модель. На цьому безкоштовний інструмент закінчується. Пробіг лежить в аукціонних листах, страхових справах і старих оголошеннях, і ці записи не роздають. Сайт, який обіцяє всю історію одометра без оплати, вгадує або продає вам інше.",
          "VIN читается бесплатно: год, завод, примерную модель. На этом бесплатный инструмент заканчивается. Пробег лежит в аукционных листах, страховых делах и старых объявлениях, и эти записи не раздают. Сайт, который обещает всю историю одометра без оплаты, угадывает или продаёт вам другое.",
          "VIN 可以免费读出年份、工厂和大致车型。免费工具就到这里。公里数在拍卖单、保险记录和旧出售信息里，这些不会白送。哪个网站承诺不付钱就给出全部里程轨迹，要么是在猜，要么是在卖别的东西。",
        ),
      },
      {
        h: L(
          "The advert and the seller are not a source",
          "Anzeige und Verkäufer sind keine Quelle",
          "El anuncio y el vendedor no son una fuente",
          "L'annonce et le vendeur ne sont pas une source",
          "Mos u beso vetëm shpalljes",
          "Ogłoszenie i sprzedawca nie są źródłem",
          "Anunțul și vânzătorul nu sunt o sursă",
          "Обявата и продавачът не са източник",
          "განცხადება და გამყიდველი წყარო არ არის",
          "الإعلان والبائع ليسا مصدراً",
          "Оголошення і продавець не є джерелом",
          "Объявление и продавец не источник",
          "广告和卖家不是来源",
        ),
        p: L(
          "A photo of the dashboard shows what the car says today. It does not show what it said at the last auction, or at the border, or after a repair. Sellers round the number down, and some cluster the digits so the car looks one owner younger. Asking in a Facebook group will get you opinions. It will not get you the logged readings.",
          "Ein Foto vom Tacho zeigt, was das Auto heute anzeigt. Nicht, was es bei der letzten Auktion, an der Grenze oder nach einer Reparatur angezeigt hat. Verkäufer runden ab, und manche setzen die Ziffern so, dass das Auto jünger wirkt. Eine Facebook-Gruppe liefert Meinungen, keine gespeicherten Ablesungen.",
          "Una foto del tablero muestra lo que el coche dice hoy. No lo que decía en la última subasta, en la frontera o después de una reparación. Los vendedores redondean hacia abajo. Un grupo de Facebook te da opiniones, no lecturas registradas.",
          "Une photo du tableau montre ce que la voiture affiche aujourd'hui. Pas ce qu'elle affichait à la dernière enchère, à la frontière ou après une réparation. Les vendeurs arrondissent à la baisse. Un groupe Facebook donne des avis, pas des relevés enregistrés.",
          "Një foto e panelit tregon çfarë thotë makina sot. Nuk tregon çfarë ka thënë në ankandin e fundit, në doganë, apo pas një riparimi. Shitësit i ulin shifrat, dhe disa i rregullojnë që makina të duket më e re. Një grup në Facebook të jep mendime, jo shifra të shkruara në ndonjë regjistër.",
          "Zdjęcie licznika pokazuje, co auto mówi dziś. Nie to, co mówił na ostatniej aukcji, na granicy albo po naprawie. Sprzedawcy zaokrąglają w dół. Grupa na Facebooku da ci opinie, nie zapisane odczyty.",
          "O poză a bordului arată ce spune mașina azi. Nu ce spunea la ultima licitație, la graniță sau după o reparație. Vânzătorii rotunjesc în jos. Un grup de Facebook îți dă păreri, nu citiri înregistrate.",
          "Снимка на таблото показва какво казва колата днес. Не какво е казала на последния търг, на границата или след ремонт. Продавачите закръглят надолу. Фейсбук групата дава мнения, не записани отчитания.",
          "დაფის ფოტო აჩვენებს, რას ამბობს მანქანა დღეს. არა იმას, რას ამბობდა ბოლო აუქციონზე, საზღვარზე ან რემონტის შემდეგ. გამყიდველები რიცხვს აქვეითებენ. ფეისბუკის ჯგუფი აზრებს გაძლევთ, არა ჩაწერილ წაკითხვებს.",
          "صورة العداد تُظهر ما تقوله السيارة اليوم. لا ما قالته في آخر مزاد أو عند الحدود أو بعد إصلاح. البائعون يقرّبون الرقم نزولاً. مجموعة فيسبوك تعطيك آراء، لا قراءات مسجّلة.",
          "Фото одометра показує, що авто каже сьогодні. Не те, що воно казало на останньому аукціоні, на кордоні чи після ремонту. Продавці округлюють вниз. Група у Facebook дасть думки, не записані показники.",
          "Фото одометра показывает, что машина говорит сегодня. Не то, что она говорила на последнем аукционе, на границе или после ремонта. Продавцы округляют вниз. Группа в Facebook даст мнения, не записанные показания.",
          "仪表盘照片只告诉你这辆车今天显示多少。它不会告诉你上次拍卖、过境或维修时的数字。卖家会把数字往下说。Facebook 群里只有看法，没有登记过的读数。",
        ),
      },
      {
        h: L(
          "A report saves the trip and the deposit",
          "Ein Bericht spart den Weg und die Anzahlung",
          "Un informe ahorra el viaje y la señal",
          "Un rapport économise le trajet et l'acompte",
          "Raporti të kursen rrugën dhe kaparin",
          "Raport oszczędza dojazd i zadatek",
          "Raportul îți economisește drumul și avansul",
          "Отчетът спестява пътя и капарото",
          "ანგარიში გიზოგავთ გზას და ავანსს",
          "التقرير يوفّر عليك المسافة والعربون",
          "Звіт економить дорогу і завдаток",
          "Отчёт экономит дорогу и задаток",
          "一份报告省下路程和定金",
        ),
        p: L(
          "One flat report costs less than a train ticket to see a car that is 80,000 km older than the advert, and far less than a gearbox bought for a rolled-back odometer. You open the file before you travel, before you leave a deposit, and before the seller starts explaining the service book. Mileage, accidents and title sit in the same place. That is the check. There is no honest free version of it.",
          "Ein einzelner Bericht kostet weniger als die Fahrt zu einem Auto, das 80.000 km älter ist als inseriert, und viel weniger als ein Getriebe für einen zurückgestellten Tacho. Sie lesen die Akte, bevor Sie fahren, bevor Sie Anzahlung leisten und bevor der Verkäufer das Serviceheft erklärt. Kilometer, Unfälle und Titel stehen an einem Ort. Das ist die Prüfung. Eine ehrliche Gratisversion davon gibt es nicht.",
          "Un informe cuesta menos que el viaje a ver un coche con 80.000 km más de los anunciados, y mucho menos que una caja de cambios por un cuentakilómetros atrasado. Lees el archivo antes de viajar, antes de dejar una señal y antes de que el vendedor explique el libro de servicio. Kilómetros, accidentes y título están en el mismo sitio. Esa es la comprobación. No existe una versión gratis y honesta.",
          "Un rapport coûte moins que le trajet pour voir une voiture qui a 80 000 km de plus que l'annonce, et bien moins qu'une boîte de vitesses pour un compteur reculé. Vous lisez le fichier avant de partir, avant de laisser des arrhes, et avant que le vendeur n'explique le carnet. Kilométrage, accidents et titre sont au même endroit. C'est le contrôle. Il n'en existe pas de version gratuite honnête.",
          "Një raport kushton më pak se bileta për të parë një makinë që ka 80.000 km më shumë se në shpallje, dhe shumë më pak se një kambio për kilometra të ulur me forcë. Hape raportin para se të nisësh rrugën, para se të lësh kapar, dhe para se shitësi të fillojë të shpjegojë servisin. Kilometrat, aksidentet dhe statusi i makinës janë në të njëjtin vend. Ky është kontrolli. Nuk ka version falas që të jetë edhe i sinqertë.",
          "Jeden raport kosztuje mniej niż bilet, żeby zobaczyć auto starsze o 80 000 km niż w ogłoszeniu, i dużo mniej niż skrzynia biegów do cofniętego licznika. Czytasz plik, zanim pojedziesz, zanim zostawisz zadatek i zanim sprzedawca zacznie tłumaczyć książkę serwisową. Przebieg, wypadki i tytuł są w jednym miejscu. To jest sprawdzenie. Uczciwej darmowej wersji nie ma.",
          "Un raport costă mai puțin decât biletul ca să vezi o mașină cu 80.000 km în plus față de anunț, și mult mai puțin decât o cutie de viteze pentru un kilometraj dat înapoi. Deschizi dosarul înainte să pleci, înainte să lași avans și înainte ca vânzătorul să explice cartea de service. Kilometrii, accidentele și titlul sunt în același loc. Asta e verificarea. Nu există o versiune gratuită și cinstită.",
          "Един отчет струва по-малко от билета до кола с 80 000 км повече от обявата и много по-малко от скоростна кутия за върнат километраж. Четете файла, преди да тръгнете, преди да оставите капаро и преди продавачът да обясни сервизната книжка. Пробег, катастрофи и титул са на едно място. Това е проверката. Честна безплатна версия няма.",
          "ერთი ანგარიში ნაკლები ღირს, ვიდრე ბილეთი მანქანამდე, რომელსაც განცხადებაზე 80 000 კმ მეტი აქვს, და გაცილებით ნაკლები, ვიდრე გადაცემათა კოლოფი უკან დაბრუნებული კილომეტრებისთვის. საქმეს კითხულობთ გამგზავრებამდე, ავანსამდე და სანამ გამყიდველი სერვისის წიგნს ახსნის. კილომეტრები, ავარია და ტიტული ერთ ადგილზეა. ეს არის შემოწმება. მისი პატიოსანი უფასო ვერსია არ არსებობს.",
          "تقرير واحد أرخص من تذكرة لرؤية سيارة تزيد 80 ألف كم عن الإعلان، وأرخص بكثير من علبة تروس بسبب عداد أُرجع للخلف. تقرأ الملف قبل أن تسافر، وقبل العربون، وقبل أن يبدأ البائع بشرح دفتر الصيانة. الكيلومترات والحوادث والملكية في مكان واحد. هذا هو الفحص. لا توجد نسخة مجانية صادقة منه.",
          "Один звіт коштує менше за квиток до авто, у якого на 80 000 км більше, ніж в оголошенні, і набагато менше за коробку передач через скручений пробіг. Ви читаєте файл до поїздки, до завдатку і до того, як продавець почне пояснювати сервісну книжку. Пробіг, ДТП і титул в одному місці. Це і є перевірка. Чесної безкоштовної версії немає.",
          "Один отчёт стоит меньше билета до машины, у которой на 80 000 км больше, чем в объявлении, и куда меньше коробки передач из-за скрученного пробега. Вы читаете файл до поездки, до задатка и до того, как продавец начнёт объяснять сервисную книжку. Пробег, ДТП и титул в одном месте. Это и есть проверка. Честной бесплатной версии нет.",
          "一份报告比跑去看一辆比广告多出 8 万公里的车便宜，更比一辆被回表的变速箱便宜。你在上路之前、在交定金之前、在卖家开始解释保养本之前就能打开这份记录。公里、事故和产权在同一个地方。这才是核查。没有一个诚实的免费版本。",
        ),
      },
    ],
  },
];

export const BLOG_ARTICLES: BlogArticle[] = [...BLOG_LEAD, ...BLOG_REST, ...BLOG_MORE, ...BLOG_MARKET].map(
  (article) => {
    const extra = BLOG_DEPTH[article.id];
    if (!extra?.length) return article;
    return {
      ...article,
      minutes: article.minutes + extra.length,
      sections: [...article.sections, ...extra],
    };
  },
);

export const BLOG_INDEX_META = {
  title: L(
    "Used car checks before you buy | VerifyKM",
    "Gebrauchtwagen prüfen, bevor Sie kaufen | VerifyKM",
    "Comprobar un coche usado antes de comprarlo | VerifyKM",
    "Vérifier une occasion avant de l'acheter | VerifyKM",
    "Kontrollo makinën para se ta blesh | VerifyKM",
    "Sprawdź auto, zanim je kupisz | VerifyKM",
    "Verifică mașina înainte să o cumperi | VerifyKM",
    "Проверете колата, преди да я купите | VerifyKM",
    "შეამოწმეთ მანქანა ყიდვამდე | VerifyKM",
    "افحص السيارة قبل أن تشتريها | VerifyKM",
    "Перевірте авто, перш ніж купити | VerifyKM",
    "Проверьте авто, прежде чем купить | VerifyKM",
    "买车之前先查这辆车 | VerifyKM",
  ),
  description: L(
    "Guides on kilometres, accident records, salvage titles and stolen cars. Read them before you travel or leave a deposit.",
    "Ratgeber zu Kilometern, Unfällen, Totalschaden und Diebstahl. Lesen Sie sie, bevor Sie fahren oder eine Anzahlung lassen.",
    "Guías sobre kilómetros, accidentes, pérdida total y coches robados. Léelas antes de viajar o dejar una señal.",
    "Guides sur les kilomètres, les accidents, les épaves et le vol. Lisez-les avant de vous déplacer ou de laisser des arrhes.",
    "Udhëzues për kilometrat, aksidentet, dëmtimin total dhe vjedhjen. Lexoji para se të nisësh rrugën ose të lësh kapar.",
    "Poradniki o przebiegu, wypadkach, szkodzie całkowitej i kradzieży. Przeczytaj je, zanim pojedziesz lub zostawisz zadatek.",
    "Ghiduri despre kilometri, accidente, daună totală și furt. Citește-le înainte să pleci sau să lași un avans.",
    "Ръководства за пробег, катастрофи, тотал и кражба. Прочетете ги, преди да пътувате или да оставите капаро.",
    "გზამკვლევი კილომეტრებზე, ავარიაზე, სალვაჟსა და ქურდობაზე. წაიკითხეთ გზამდე ან ავანსამდე.",
    "أدلة عن الكيلومترات والحوادث والخسارة الكاملة والسرقة. اقرأها قبل السفر أو ترك عربون.",
    "Поради про пробіг, ДТП, тотал і викрадення. Прочитайте їх до поїздки чи завдатку.",
    "Советы о пробеге, ДТП, тотале и угоне. Прочитайте их до поездки или задатка.",
    "关于公里、事故、全损和盗抢的说明。上路或交定金之前先看。",
  ),
};

export function articleSlug(lang: Language, id: string): string | null {
  return BLOG_ARTICLES.find((article) => article.id === id)?.slug[lang] ?? null;
}

export function articleIdFromSlug(slug: string): string | null {
  const needle = slug.toLowerCase();
  for (const article of BLOG_ARTICLES) {
    for (const value of Object.values(article.slug)) {
      if (value.toLowerCase() === needle) return article.id;
    }
  }
  return null;
}

export function blogIndexPath(lang: Language): string {
  return `/${lang}/${BLOG_INDEX_SLUG[lang]}`;
}

export function blogPostPath(lang: Language, id: string): string {
  const slug = articleSlug(lang, id);
  return slug ? `${blogIndexPath(lang)}/${slug}` : blogIndexPath(lang);
}

export function blogCover(id: string): string {
  return `/blog/${id}.jpg?v=3`;
}
