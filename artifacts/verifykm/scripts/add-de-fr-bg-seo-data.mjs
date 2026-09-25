/**
 * Authentic DE / FR / BG SEO entries for seo-data.json — mirrors add-pl-seo-data.mjs.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seoPath = path.join(__dirname, "../src/lib/seo-data.json");
const seoData = JSON.parse(fs.readFileSync(seoPath, "utf8"));

const DE = {
    home: {
      title: "Kilometerstand prüfen — Unfälle & Totalschaden | verifykm.com",
      description:
        "Sofortiger VIN-Check: echten Kilometerstand prüfen, Unfallhistorie und Totalschaden-Einträge für jedes Auto aufdecken.",
    },
    pricing: {
      title: "Preise — Fahrzeughistorie & VIN-Bericht | verifykm.com",
      description:
        "Ein günstiger VIN-Bericht: Kilometerstand, Unfälle, Totalschaden und Diebstahl. Sofortige Lieferung. Kein Abo.",
    },
  auth: {
    title: "Anmelden — verifykm.com",
    description:
      "Melden Sie sich an oder erstellen Sie ein kostenloses Konto für sofortige VIN-Checks und Zugriff auf Fahrzeughistorien.",
  },
  dashboard: {
    title: "Meine Berichte — VIN-Historie | verifykm.com",
    description: "Ihre Fahrzeughistorienberichte ansehen und neue VIN-Checks durchführen.",
  },
  vin_result: {
    title: "VIN-Historienbericht — verifykm.com",
    description:
      "Vollständiger Fahrzeughistorienbericht: Kilometerstand, Unfälle, Halter, Versicherung und Auktionen. Sofortiger Zugriff nach Kauf.",
  },
  country_usa: {
    title: "USA-Importe — VIN-Check, Kilometerstand & Unfallhistorie | verifykm.com",
    description:
      "US-Importe per VIN prüfen: Kilometerstand, Unfälle, Totalschaden, Diebstahl und Auktionen. Sofortbericht auf verifykm.com.",
  },
  country_korea: {
    title: "Korea-Importe — VIN-Check & Fahrzeughistorie | verifykm.com",
    description:
      "Koreanisches Importfahrzeug per VIN prüfen: Kilometerstand, Unfälle, Export und Auktionen. Vollständiger Historienbericht auf verifykm.com.",
  },
  country_canada: {
    title: "Kanada-Importe — VIN-Check & Fahrzeughistorie | verifykm.com",
    description:
      "Kanadische Fahrzeuge per VIN prüfen: Kilometerstand, Unfälle, Totalschaden und Diebstahl. Sofortbericht auf verifykm.com.",
  },
  free_decoder: {
    title: "Kostenloser VIN-Decoder — VIN-Nummer dekodieren | verifykm.com",
    description:
      "Kostenloser VIN-Decoder: Baujahr, Marke, Modell und Ausstattung. VIN prüfen und vollständigen Historienbericht auf verifykm.com bestellen.",
  },
  how_it_works: {
    title: "So funktioniert's — VIN-Check Schritt für Schritt | verifykm.com",
    description:
      "VIN eingeben, sicher bezahlen und in Sekunden den vollständigen Historienbericht erhalten. Kilometerstand, Unfälle, Totalschaden und mehr.",
  },
  faq: {
    title: "FAQ — VIN-Check & Historienberichte | verifykm.com",
    description:
      "Antworten zu VIN-Checks, Kilometerstand, Unfällen, Totalschaden, Zahlung und Fahrzeughistorienberichten auf verifykm.com.",
  },
  terms: {
    title: "Nutzungsbedingungen — verifykm.com",
    description: "Nutzungsbedingungen für verifykm.com und VIN-Historienberichte.",
  },
  privacy: {
    title: "Datenschutz — verifykm.com",
    description: "Wie verifykm.com Ihre personenbezogenen Daten erhebt, nutzt und schützt.",
  },
  not_found: {
    title: "Seite nicht gefunden — verifykm.com",
    description: "Die angeforderte Seite existiert nicht. Zurück zu verifykm.com für Ihren VIN-Check.",
  },
  sign_up: {
    title: "Registrieren — verifykm.com",
    description:
      "Kostenloses verifykm-Konto erstellen, um VIN-Berichte zu speichern und schneller Fahrzeughistorien zu prüfen.",
  },
  checkout: {
    title: "Kasse — VIN-Bericht | verifykm.com",
    description: "Sichere Zahlung für Ihren VIN-Historienbericht. Sofortiger Zugriff nach Bestätigung.",
  },
  purchases: {
    title: "Käufe — verifykm.com",
    description: "Übersicht Ihrer VIN-Berichtkäufe und Zugriff auf frühere Berichte.",
  },
  forgot_password: {
    title: "Passwort vergessen — verifykm.com",
    description: "Passwort für Ihr verifykm-Konto zurücksetzen und wieder Zugriff auf VIN-Berichte erhalten.",
  },
  reset_password: {
    title: "Passwort zurücksetzen — verifykm.com",
    description: "Neues Passwort für Ihr verifykm-Konto festlegen.",
  },
};

const FR = {
  home: {
    title: "Vérifier le kilométrage — accidents & épave | verifykm.com",
    description:
      "Contrôle VIN instantané : vérifiez le kilométrage réel, l'historique des accidents et le statut épave de tout véhicule.",
  },
  pricing: {
    title: "Tarifs — rapports historique VIN | verifykm.com",
    description:
      "Un rapport VIN abordable : kilométrage, accidents, statut épave et vol. Livraison instantanée. Sans abonnement.",
  },
  auth: {
    title: "Connexion — verifykm.com",
    description:
      "Connectez-vous ou créez un compte gratuit pour des contrôles VIN instantanés et l'accès aux rapports d'historique.",
  },
  dashboard: {
    title: "Mes rapports — historique VIN | verifykm.com",
    description: "Consultez vos rapports d'historique véhicule et lancez de nouveaux contrôles VIN.",
  },
  vin_result: {
    title: "Rapport historique VIN — verifykm.com",
    description:
      "Rapport complet : kilométrage, accidents, propriétaires, assurance et enchères. Accès instantané après achat.",
  },
  country_usa: {
    title: "Voitures des USA — contrôle VIN, kilométrage et accidents | verifykm.com",
    description:
      "Vérifiez l'historique d'un import USA par VIN : kilométrage, accidents, épave, vol et enchères. Rapport instantané sur verifykm.com.",
  },
  country_korea: {
    title: "Voitures de Corée — contrôle VIN et historique | verifykm.com",
    description:
      "Vérifiez un import coréen par VIN : kilométrage, accidents, export et enchères. Rapport complet sur verifykm.com.",
  },
  country_canada: {
    title: "Voitures du Canada — contrôle VIN et historique | verifykm.com",
    description:
      "Vérifiez un véhicule canadien par VIN : kilométrage, accidents, épave et vol. Rapport instantané sur verifykm.com.",
  },
  free_decoder: {
    title: "Décodeur VIN gratuit — décoder un numéro VIN | verifykm.com",
    description:
      "Décodeur VIN gratuit : année, marque, modèle et équipement. Vérifiez le VIN et commandez le rapport complet sur verifykm.com.",
  },
  how_it_works: {
    title: "Comment ça marche — contrôle VIN étape par étape | verifykm.com",
    description:
      "Saisissez le VIN, payez en toute sécurité et recevez le rapport complet en quelques secondes. Kilométrage, accidents, épave et plus.",
  },
  faq: {
    title: "FAQ — contrôle VIN et rapports historique | verifykm.com",
    description:
      "Réponses sur les contrôles VIN, le kilométrage, les accidents, le statut épave, les paiements et les rapports sur verifykm.com.",
  },
  terms: {
    title: "Conditions d'utilisation — verifykm.com",
    description: "Conditions d'utilisation de verifykm.com et des rapports historique VIN.",
  },
  privacy: {
    title: "Confidentialité — verifykm.com",
    description: "Comment verifykm.com collecte, utilise et protège vos données personnelles.",
  },
  not_found: {
    title: "Page introuvable — verifykm.com",
    description: "La page demandée n'existe pas. Retournez sur verifykm.com pour votre contrôle VIN.",
  },
  sign_up: {
    title: "Inscription — verifykm.com",
    description:
      "Créez un compte verifykm gratuit pour enregistrer vos rapports VIN et vérifier l'historique plus rapidement.",
  },
  checkout: {
    title: "Paiement — rapport VIN | verifykm.com",
    description: "Paiement sécurisé pour votre rapport historique VIN. Accès instantané après confirmation.",
  },
  purchases: {
    title: "Achats — verifykm.com",
    description: "Historique de vos achats de rapports VIN et accès aux rapports précédents.",
  },
  forgot_password: {
    title: "Mot de passe oublié — verifykm.com",
    description: "Réinitialisez le mot de passe de votre compte verifykm pour retrouver l'accès aux rapports VIN.",
  },
  reset_password: {
    title: "Réinitialiser le mot de passe — verifykm.com",
    description: "Définissez un nouveau mot de passe pour votre compte verifykm.",
  },
};

const BG = {
  home: {
    title: "Проверка VIN на автомобил — пробег, катастрофи и тотална щета | verifykm.com",
    description:
      "Мигновена проверка на VIN — потвърдете реалния пробег, разкрийте пълната история на катастрофи и записи за тотална щета за всеки автомобил.",
  },
  pricing: {
    title: "Цени — отчети за история на VIN | verifykm.com",
    description:
      "Един достъпен VIN отчет: пробег, катастрофи, тотална щета и кражба. Мигновена доставка. Без абонамент.",
  },
  auth: {
    title: "Вход — verifykm.com",
    description:
      "Влезте или създайте безплатен акаунт за мигновени VIN проверки и достъп до отчети за история.",
  },
  dashboard: {
    title: "Моите отчети — история VIN | verifykm.com",
    description: "Прегледайте отчетите за история на автомобили и направете нови VIN проверки.",
  },
  vin_result: {
    title: "Отчет за история на VIN — verifykm.com",
    description:
      "Пълен отчет: пробег, катастрофи, собственици, застраховка и търгове. Мигновен достъп след покупка.",
  },
  country_usa: {
    title: "Автомобили от САЩ — VIN проверка, пробег и катастрофи | verifykm.com",
    description:
      "Проверете история на внос от САЩ по VIN: пробег, катастрофи, тотална щета, кражба и търгове. Мигновен отчет на verifykm.com.",
  },
  country_korea: {
    title: "Автомобили от Корея — VIN проверка и история | verifykm.com",
    description:
      "Проверете корейски внос по VIN: пробег, катастрофи, експорт и търгове. Пълен отчет на verifykm.com.",
  },
  country_canada: {
    title: "Автомобили от Канада — VIN проверка и история | verifykm.com",
    description:
      "Проверете канадски автомобил по VIN: пробег, катастрофи, тотална щета и кражба. Мигновен отчет на verifykm.com.",
  },
  free_decoder: {
    title: "Безплатен VIN декодер — декодиране на VIN номер | verifykm.com",
    description:
      "Безплатен VIN декодер: година, марка, модел и комплектация. Проверете VIN и поръчайте пълен отчет на verifykm.com.",
  },
  how_it_works: {
    title: "Как работи — VIN проверка стъпка по стъпка | verifykm.com",
    description:
      "Въведете VIN, платете сигурно и получете пълния отчет за секунди. Пробег, катастрофи, тотална щета и още.",
  },
  faq: {
    title: "ЧЗВ — VIN проверка и отчети за история | verifykm.com",
    description:
      "Отговори за VIN проверки, пробег, катастрофи, тотална щета, плащания и отчети за история на verifykm.com.",
  },
  terms: {
    title: "Общи условия — verifykm.com",
    description: "Общи условия за verifykm.com и услугите за VIN отчети.",
  },
  privacy: {
    title: "Поверителност — verifykm.com",
    description: "Как verifykm.com събира, използва и защитава вашите лични данни.",
  },
  not_found: {
    title: "Страницата не е намерена — verifykm.com",
    description: "Заявената страница не съществува. Върнете се на verifykm.com за VIN проверка.",
  },
  sign_up: {
    title: "Регистрация — verifykm.com",
    description:
      "Създайте безплатен verifykm акаунт, за да запазвате VIN отчети и по-бързо да проверявате история.",
  },
  checkout: {
    title: "Плащане — VIN отчет | verifykm.com",
    description: "Сигурно плащане за VIN отчет. Мигновен достъп след потвърждение.",
  },
  purchases: {
    title: "Покупки — verifykm.com",
    description: "История на покупките на VIN отчети и достъп до предишни отчети.",
  },
  forgot_password: {
    title: "Забравена парола — verifykm.com",
    description: "Нулирайте паролата на verifykm акаунта си, за да възстановите достъп до VIN отчети.",
  },
  reset_password: {
    title: "Нова парола — verifykm.com",
    description: "Задайте нова парола за verifykm акаунта си.",
  },
};

for (const [pageKey, entry] of Object.entries(DE)) {
  if (!seoData[pageKey]) {
    console.error("Unknown page key:", pageKey);
    process.exit(1);
  }
  seoData[pageKey].de = entry;
}

for (const [pageKey, entry] of Object.entries(FR)) {
  seoData[pageKey].fr = entry;
}

for (const [pageKey, entry] of Object.entries(BG)) {
  seoData[pageKey].bg = entry;
}

fs.writeFileSync(seoPath, JSON.stringify(seoData, null, 2) + "\n", "utf8");
console.log("Updated de/fr/bg SEO for", Object.keys(DE).length, "pages each");
