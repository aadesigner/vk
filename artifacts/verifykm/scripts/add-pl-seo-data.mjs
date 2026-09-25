/**
 * Add Polish (pl) SEO entries to seo-data.json — mirrors en/ro patterns.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seoPath = path.join(__dirname, "../src/lib/seo-data.json");
const seoData = JSON.parse(fs.readFileSync(seoPath, "utf8"));

const PL = {
  home: {
    title: "Sprawdzenie VIN auta — przebieg, wypadki i szkoda całkowita | verifykm.com",
    description:
      "Natychmiastowe sprawdzenie VIN — zweryfikuj rzeczywisty przebieg, odkryj pełną historię wypadków i zapisy szkody całkowitej dowolnego auta.",
  },
  pricing: {
    title: "Cennik — raporty historii VIN | verifykm.com",
    description:
      "Jeden przystępny raport VIN obejmuje weryfikację przebiegu, wypadki, szkodę całkowitą i kradzież. Natychmiastowa dostawa. Bez subskrypcji.",
  },
  auth: {
    title: "Logowanie — verifykm.com",
    description:
      "Zaloguj się lub utwórz darmowe konto, aby wykonywać natychmiastowe sprawdzenia VIN i uzyskać dostęp do raportów historii pojazdu.",
  },
  dashboard: {
    title: "Moje raporty — historia VIN | verifykm.com",
    description: "Przeglądaj raporty historii pojazdów i wykonuj nowe sprawdzenia VIN.",
  },
  vin_result: {
    title: "Raport historii VIN — verifykm.com",
    description:
      "Pełny raport historii pojazdu: przebieg, wypadki, właściciele, ubezpieczenie i aukcje. Natychmiastowy dostęp po zakupie.",
  },
  country_usa: {
    title: "Auta z USA — sprawdzenie VIN, przebieg i historia wypadków | verifykm.com",
    description:
      "Sprawdź historię auta z USA po VIN: przebieg, wypadki, szkoda całkowita, kradzież i aukcje. Raport natychmiast na verifykm.com.",
  },
  country_korea: {
    title: "Auta z Korei — sprawdzenie VIN i historia pojazdu | verifykm.com",
    description:
      "Sprawdź auto z Korei po VIN: przebieg, wypadki, eksport i aukcje. Pełny raport historii na verifykm.com.",
  },
  country_canada: {
    title: "Auta z Kanady — sprawdzenie VIN i historia pojazdu | verifykm.com",
    description:
      "Sprawdź auto z Kanady po VIN: przebieg, wypadki, szkoda całkowita i kradzież. Natychmiastowy raport na verifykm.com.",
  },
  free_decoder: {
    title: "Darmowy dekoder VIN — dekoduj numer VIN | verifykm.com",
    description:
      "Darmowy dekoder VIN: rok, marka, model i specyfikacja. Sprawdź VIN i zamów pełny raport historii na verifykm.com.",
  },
  how_it_works: {
    title: "Jak to działa — sprawdzenie VIN krok po kroku | verifykm.com",
    description:
      "Wpisz VIN, zapłać bezpiecznie i otrzymaj pełny raport historii w kilka sekund. Przebieg, wypadki, szkoda całkowita i więcej.",
  },
  faq: {
    title: "FAQ — sprawdzenie VIN i raporty historii | verifykm.com",
    description:
      "Odpowiedzi na pytania o sprawdzanie VIN, przebieg, wypadki, szkodę całkowitą, płatności i raporty historii pojazdu na verifykm.com.",
  },
  terms: {
    title: "Regulamin — verifykm.com",
    description: "Regulamin korzystania z verifykm.com i usług raportów historii VIN.",
  },
  privacy: {
    title: "Polityka prywatności — verifykm.com",
    description: "Jak verifykm.com zbiera, wykorzystuje i chroni Twoje dane osobowe.",
  },
  not_found: {
    title: "Strona nie znaleziona — verifykm.com",
    description: "Żądana strona nie istnieje. Wróć na verifykm.com, aby sprawdzić VIN.",
  },
  sign_up: {
    title: "Rejestracja — verifykm.com",
    description:
      "Utwórz darmowe konto verifykm, aby zapisywać raporty VIN i szybciej sprawdzać historię pojazdów.",
  },
  checkout: {
    title: "Płatność — raport VIN | verifykm.com",
    description: "Bezpieczna płatność za raport historii VIN. Natychmiastowy dostęp po potwierdzeniu.",
  },
  purchases: {
    title: "Zakupy — verifykm.com",
    description: "Historia zakupów raportów VIN i dostęp do wcześniej wygenerowanych raportów.",
  },
  forgot_password: {
    title: "Przypomnienie hasła — verifykm.com",
    description: "Zresetuj hasło do konta verifykm, aby odzyskać dostęp do raportów VIN.",
  },
  reset_password: {
    title: "Reset hasła — verifykm.com",
    description: "Ustaw nowe hasło do konta verifykm.",
  },
};

for (const [pageKey, entry] of Object.entries(PL)) {
  if (!seoData[pageKey]) {
    console.error("Unknown page key:", pageKey);
    process.exit(1);
  }
  seoData[pageKey].pl = entry;
}

fs.writeFileSync(seoPath, JSON.stringify(seoData, null, 2) + "\n", "utf8");
console.log("Added pl SEO for", Object.keys(PL).length, "pages");
