/**
 * Add Georgian (ka) SEO entries to seo-data.json — mirrors en/pl patterns.
 * Inserts `ka` after `pl` when ordering object keys.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seoPath = path.join(__dirname, "../src/lib/seo-data.json");
const seoData = JSON.parse(fs.readFileSync(seoPath, "utf8"));

const KA = {
  "home": {
    "title": "მანქანის VIN შემოწმება — გარბენი, ავარიები და salvage | verifykm.com",
    "description": "შეამოწმეთ რეალური გარბენი, ფარული ავარიები, salvage სათაურები, ქურდობის ჩანაწერები და მანქანის სრული ისტორია თქვენი VIN-ით. მანქანის ისტორიის მყისიერი ანგარიში verifykm.com-ზე."
  },
  "pricing": {
    "title": "ფასი — VIN ისტორიის ანგარიში | verifykm.com",
    "description": "ერთი ხელმისაწვდომი VIN ანგარიში მოიცავს გარბენის შემოწმებას, ავარიებს, salvage სტატუსს და ქურდობას. მყისიერი მიწოდება. არ არის გამოწერა."
  },
  "auth": {
    "title": "შესვლა — verifykm.com",
    "description": "შედით ან შექმენით უფასო ანგარიში VIN-ის მყისიერი შემოწმების გასატარებლად და თქვენი მანქანის ისტორიის ანგარიშებზე წვდომისთვის."
  },
  "dashboard": {
    "title": "ჩემი ანგარიშები — VIN ისტორია | verifykm.com",
    "description": "იხილეთ თქვენი მანქანის ისტორიის ანგარიშები და გაუშვით ახალი VIN შემოწმებები."
  },
  "vin_result": {
    "title": "VIN ანგარიში | verifykm.com",
    "description": "შეამოწმეთ გარბენი, ავარიები და მანქანის სრული ისტორია. მყისიერი ანგარიში verifykm.com-ზე."
  },
  "country_usa": {
    "title": "შეამოწმეთ აშშ მანქანის გარბენი, ავარიები და ქურდობა | verifykm.com",
    "description": "შეამოწმეთ მანქანის გარბენი, ავარიები, ქურდობა და salvage ტიტულები ამერიკული მანქანებისთვის. მომენტალური VIN ანგარიში Ford-ისთვის, Toyota-სთვის, BMW-სთვის, Honda-სთვის და Chevrolet-ისთვის - ყველა 50 შტატისთვის."
  },
  "country_korea": {
    "title": "კორეული მანქანები — გარბენი, ავარიები და ისტორია | verifykm.com",
    "description": "შეამოწმეთ მანქანის გარბენი, ავარიები, იმპორტის ისტორია და კორეიდან მანქანების ფარული დაზიანება. მომენტალური VIN ანგარიში Hyundai, Kia, Genesis, BMW, Mercedes და Toyota-სთვის."
  },
  "country_canada": {
    "title": "კანადური მანქანები — გარბენი, ავარიები და ისტორია | verifykm.com",
    "description": "შეამოწმეთ მანქანის გარბენი, ავარიები, ბრენდირებული სათაურები და ქურდობა კანადური მანქანებისთვის. მომენტალური VIN ანგარიში Honda, Toyota, Ford, BMW და Mercedes - ყველა პროვინციისთვის."
  },
  "free_decoder": {
    "title": "უფასო VIN დეკოდერი — BMW, Audi, Mercedes & ყველა ბრენდი | verifykm.com",
    "description": "გაშიფრეთ ნებისმიერი 17-ნიშნა VIN უფასო. BMW VIN დეკოდერი, Audi VIN დეკოდერი, Toyota, Ford და სხვა. წელი, მარკა, მოდელი, ძრავა — რეგისტრაცია არ არის."
  },
  "how_it_works": {
    "title": "როგორ მუშაობს VIN შემოწმება — 3 ნაბიჯი | verifykm.com",
    "description": "მიიღეთ მანქანის ისტორიის ანგარიში თქვენი მანქანისთვის. შეიყვანეთ თქვენი VIN გარბენის, ავარიების, ქურდობის, salvage-ისა და საკუთრების შესამოწმებლად — შედეგები წამებში პროვაიდერის მონაცემთა ბაზებიდან."
  },
  "faq": {
    "title": "VIN შემოწმება FAQ | verifykm.com",
    "description": "პასუხები VIN შემოწმების, დაფარვის, მონაცემთა სიზუსტის, მიწოდების, გადახდების და თანხის დაბრუნების შესახებ."
  },
  "terms": {
    "title": "მომსახურების პირობები | verifykm.com",
    "description": "მომსახურების პირობები verifykm.com VIN ისტორიის ანგარიშების, გადახდების, თანხის დაბრუნებისა და მონაცემთა ხელმისაწვდომობისთვის."
  },
  "privacy": {
    "title": "კონფიდენციალურობის პოლიტიკა და ქუქიების პოლიტიკა | verifykm.com",
    "description": "როგორ აგროვებს, იყენებს და იცავს verifykm.com თქვენს მონაცემებს. მოიცავს ქუქიების პოლიტიკას."
  },
  "not_found": {
    "title": "გვერდი ვერ მოიძებნა | verifykm.com",
    "description": "გვერდი, რომელსაც ეძებთ, არ არსებობს ან შესაძლოა გადატანილი იყოს."
  },
  "sign_up": {
    "title": "შექმენით ანგარიში - verifykm.com",
    "description": "შექმენით უფასო verifykm ანგარიში, რომ ჩაატაროთ მყისიერი VIN შემოწმებები და მიიღოთ თქვენი მანქანის ისტორიის ანგარიშები."
  },
  "checkout": {
    "title": "შეკვეთა — verifykm.com",
    "description": "უსაფრთხოდ შეასრულეთ თქვენი VIN ისტორიის ანგარიში შესყიდვის შესახებ."
  },
  "purchases": {
    "title": "შესყიდვების ისტორია — verifykm.com",
    "description": "ნახეთ თქვენი VIN ანგარიშის შესყიდვები და ქვითრები."
  },
  "forgot_password": {
    "title": "დაგავიწყდათ პაროლი — verifykm.com",
    "description": "გადააყენეთ თქვენი verifykm ანგარიშის პაროლი."
  },
  "reset_password": {
    "title": "პაროლის აღდგენა — verifykm.com",
    "description": "აირჩიეთ ახალი პაროლი თქვენი verifykm ანგარიშისთვის."
  },
  "country_china": {
    "title": "ჩინური მანქანები — გარბენი, ავარიები და ისტორია | verifykm.com",
    "description": "შეამოწმეთ მანქანის გარბენი, ავარიები, ოდომეტრის გაყალბება და ჩინური მანქანების salvage. მომენტალური VIN ანგარიში BYD, Geely, NIO, BMW, Mercedes, Tesla და Toyota-სთვის."
  },
  "country_uae": {
    "title": "UAE მანქანები — გარბენი, ავარიები და იმპორტის ისტორია | verifykm.com",
    "description": "შეამოწმეთ მანქანის გარბენი, ავარიები, წყალდიდობის დაზიანება და იმპორტის ისტორია UAE მანქანებისთვის. მომენტალური VIN ანგარიში Toyota, Nissan, Mercedes, BMW და Lexus-ისთვის დუბაიში და GCC-ში."
  }
};

function insertKaAfterPl(pageObj, kaEntry) {
  const ordered = {};
  let inserted = false;
  for (const [lang, value] of Object.entries(pageObj)) {
    ordered[lang] = value;
    if (lang === "pl") {
      ordered.ka = kaEntry;
      inserted = true;
    }
  }
  if (!inserted) ordered.ka = kaEntry;
  return ordered;
}

for (const [pageKey, entry] of Object.entries(KA)) {
  if (!seoData[pageKey]) {
    console.error("Unknown page key:", pageKey);
    process.exit(1);
  }
  seoData[pageKey] = insertKaAfterPl(seoData[pageKey], entry);
}

const missing = Object.keys(seoData).filter((k) => !KA[k]);
if (missing.length) {
  console.error("Missing KA entries for pages:", missing.join(", "));
  process.exit(1);
}

fs.writeFileSync(seoPath, JSON.stringify(seoData, null, 2) + "\n", "utf8");
console.log("Added ka SEO for", Object.keys(KA).length, "pages");
