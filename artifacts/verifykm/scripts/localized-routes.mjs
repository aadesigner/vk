/**
 * Node mirror of src/lib/localized-routes.ts for sitemap / prerender scripts.
 * Keep in sync when adding languages or slugs.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SUPPORTED_LANGS } from "./languages.mjs";

const blogSeo = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "blog-seo.json"), "utf8"),
);
const BLOG_INDEX_SLUGS = new Set(Object.values(blogSeo.indexSlug));

const PAGE_SLUG = {
  en: {
    pricing: "pricing",
    how_it_works: "how-it-works",
    faq: "faq",
    free_vin_decoder: "free-vin-decoder",
    terms: "terms",
    privacy: "privacy",
    sign_in: "sign-in",
    sign_up: "sign-up",
    dashboard: "dashboard",
    purchases: "purchases",
    checkout: "checkout",
    forgot_password: "forgot-password",
    reset_password: "reset-password",
    set_password: "set-password",
    api_b2b: "api-b2b",
  },
  de: {
    pricing: "preise",
    how_it_works: "so-funktionierts",
    faq: "faq",
    free_vin_decoder: "kostenloser-vin-decoder",
    terms: "agb",
    privacy: "datenschutz",
    sign_in: "anmelden",
    sign_up: "registrieren",
    dashboard: "dashboard",
    purchases: "kaeufe",
    checkout: "kasse",
    forgot_password: "passwort-vergessen",
    reset_password: "passwort-zuruecksetzen",
    set_password: "passwort-setzen",
    api_b2b: "api-b2b",
  },
  es: {
    pricing: "precios",
    how_it_works: "como-funciona",
    faq: "preguntas-frecuentes",
    free_vin_decoder: "decodificador-vin-gratis",
    terms: "terminos",
    privacy: "privacidad",
    sign_in: "iniciar-sesion",
    sign_up: "registrarse",
    dashboard: "panel",
    purchases: "compras",
    checkout: "pago",
    forgot_password: "olvide-contrasena",
    reset_password: "restablecer-contrasena",
    set_password: "establecer-contrasena",
    api_b2b: "api-b2b",
  },
  fr: {
    pricing: "tarifs",
    how_it_works: "comment-ca-marche",
    faq: "faq",
    free_vin_decoder: "decodeur-vin-gratuit",
    terms: "conditions",
    privacy: "confidentialite",
    sign_in: "connexion",
    sign_up: "inscription",
    dashboard: "tableau-de-bord",
    purchases: "achats",
    checkout: "paiement",
    forgot_password: "mot-de-passe-oublie",
    reset_password: "reinitialiser-mot-de-passe",
    set_password: "definir-mot-de-passe",
    api_b2b: "api-b2b",
  },
  sq: {
    pricing: "ofertat",
    how_it_works: "si-funksionon",
    faq: "pyetje-te-shpeshta",
    free_vin_decoder: "dekoder-vin-falas",
    terms: "kushtet",
    privacy: "privatesia",
    sign_in: "hyrje",
    sign_up: "regjistrim",
    dashboard: "paneli",
    purchases: "blerjet",
    checkout: "pagesa",
    forgot_password: "fjalekalimi-i-harruar",
    reset_password: "rivendos-fjalekalimin",
    set_password: "vendos-fjalekalimin",
    api_b2b: "api-b2b",
  },
  pl: {
    pricing: "cennik",
    how_it_works: "jak-to-dziala",
    faq: "faq",
    free_vin_decoder: "darmowy-dekoder-vin",
    terms: "regulamin",
    privacy: "prywatnosc",
    sign_in: "logowanie",
    sign_up: "rejestracja",
    dashboard: "panel",
    purchases: "zakupy",
    checkout: "kasa",
    forgot_password: "zapomniane-haslo",
    reset_password: "resetuj-haslo",
    set_password: "ustaw-haslo",
    api_b2b: "api-b2b",
  },
  ro: {
    pricing: "preturi",
    how_it_works: "cum-functioneaza",
    faq: "intrebari-frecvente",
    free_vin_decoder: "decoder-vin-gratuit",
    terms: "termeni",
    privacy: "confidentialitate",
    sign_in: "autentificare",
    sign_up: "inregistrare",
    dashboard: "panou",
    purchases: "achizitii",
    checkout: "plata",
    forgot_password: "parola-uitata",
    reset_password: "resetare-parola",
    set_password: "setare-parola",
    api_b2b: "api-b2b",
  },
  bg: {
    pricing: "tseni",
    how_it_works: "kak-raboti",
    faq: "vaprosi",
    free_vin_decoder: "besplaten-vin-dekoder",
    terms: "usloviya",
    privacy: "poveritelnost",
    sign_in: "vhod",
    sign_up: "registratsiya",
    dashboard: "tablo",
    purchases: "pokupki",
    checkout: "plashtane",
    forgot_password: "zabravena-parola",
    reset_password: "nulirane-na-parola",
    set_password: "zadavane-na-parola",
    api_b2b: "api-b2b",
  },
  ka: {
    pricing: "fasebi",
    how_it_works: "rogor-mushaoibs",
    faq: "kitkhvebi",
    free_vin_decoder: "ufaso-vin-dekoderi",
    terms: "pirobebi",
    privacy: "konfidencialuroba",
    sign_in: "shesvla",
    sign_up: "registracia",
    dashboard: "panel",
    purchases: "sheqidvebi",
    checkout: "gadakhda",
    forgot_password: "parolis-dagitsqeba",
    reset_password: "parolis-aghdgena",
    set_password: "parolis-dayeneba",
    api_b2b: "api-b2b",
  },
  ar: {
    pricing: "al-aseaar",
    how_it_works: "kayfa-taamal",
    faq: "asela-shaea",
    free_vin_decoder: "fakk-vin-majani",
    terms: "al-shurut",
    privacy: "al-khususiya",
    sign_in: "tasjil-al-dukhul",
    sign_up: "insha-hisab",
    dashboard: "lawhat-al-tahakkum",
    purchases: "al-mushtrayat",
    checkout: "al-daf",
    forgot_password: "nisyan-kalimat-al-murur",
    reset_password: "iadat-tayin-kalimat-al-murur",
    set_password: "tayin-kalimat-al-murur",
    api_b2b: "api-b2b",
  },
  uk: {
    pricing: "tsiny",
    how_it_works: "yak-tse-pratsyuye",
    faq: "zapytannya",
    free_vin_decoder: "bezkoshtovnyy-vin-dekoder",
    terms: "umovy",
    privacy: "pryvatnist",
    sign_in: "vkhid",
    sign_up: "reyestratsiya",
    dashboard: "panel",
    purchases: "pokupky",
    checkout: "oplata",
    forgot_password: "zabuly-parol",
    reset_password: "skinuty-parol",
    set_password: "vstanovyty-parol",
    api_b2b: "api-b2b",
  },
  ru: {
    pricing: "tseny",
    how_it_works: "kak-eto-rabotaet",
    faq: "voprosy",
    free_vin_decoder: "besplatnyy-vin-dekoder",
    terms: "usloviya",
    privacy: "konfidencialnost",
    sign_in: "vkhod",
    sign_up: "registratsiya",
    dashboard: "panel",
    purchases: "pokupki",
    checkout: "oplata",
    forgot_password: "zabyli-parol",
    reset_password: "sbros-parolya",
    set_password: "ustanovit-parol",
    api_b2b: "api-b2b",
  },
  zh: {
    pricing: "jiage",
    how_it_works: "ruhe-yunzuo",
    faq: "changjian-wenti",
    free_vin_decoder: "mianfei-vin-jiema",
    terms: "tiaokuan",
    privacy: "yinsi",
    sign_in: "denglu",
    sign_up: "zhuce",
    dashboard: "kongzhitai",
    purchases: "goumai",
    checkout: "jiesuan",
    forgot_password: "wangji-mima",
    reset_password: "chongzhi-mima",
    set_password: "shezhi-mima",
    api_b2b: "api-b2b",
  },
};

export const CARS_SEGMENT = {
  en: "cars",
  de: "autos",
  es: "coches",
  fr: "voitures",
  sq: "makina",
  pl: "samochody",
  ro: "masini",
  bg: "avtomobili",
  ka: "manqanebi",
  ar: "sayarat",
  uk: "avto",
  ru: "avto",
  zh: "cheliang",
};

export const COUNTRY_IDS = ["usa", "korea", "canada", "china", "japan", "uae"];

export const COUNTRY_PAGE_SLUG = {
  en: {
    usa: "cars-from-usa",
    korea: "cars-from-korea",
    canada: "cars-from-canada",
    china: "cars-from-china",
    japan: "cars-from-japan",
    uae: "cars-from-uae",
  },
  de: {
    usa: "autos-aus-usa",
    korea: "autos-aus-korea",
    canada: "autos-aus-kanada",
    china: "autos-aus-china",
    japan: "autos-aus-japan",
    uae: "autos-aus-vae",
  },
  es: {
    usa: "coches-de-usa",
    korea: "coches-de-corea",
    canada: "coches-de-canada",
    china: "coches-de-china",
    japan: "coches-de-japon",
    uae: "coches-de-emiratos",
  },
  fr: {
    usa: "voitures-des-usa",
    korea: "voitures-de-coree",
    canada: "voitures-du-canada",
    china: "voitures-de-chine",
    japan: "voitures-du-japon",
    uae: "voitures-des-emirats",
  },
  sq: {
    usa: "makina-nga-usa",
    korea: "makina-nga-korea",
    canada: "makina-nga-kanada",
    china: "makina-nga-kina",
    japan: "makina-nga-japonia",
    uae: "makina-nga-emirates",
  },
  pl: {
    usa: "samochody-z-usa",
    korea: "samochody-z-korei",
    canada: "samochody-z-kanady",
    china: "samochody-z-chin",
    japan: "samochody-z-japonii",
    uae: "samochody-z-ze",
  },
  ro: {
    usa: "masini-din-usa",
    korea: "masini-din-coreea",
    canada: "masini-din-canada",
    china: "masini-din-china",
    japan: "masini-din-japonia",
    uae: "masini-din-emirate",
  },
  bg: {
    usa: "avtomobili-ot-usa",
    korea: "avtomobili-ot-koreya",
    canada: "avtomobili-ot-kanada",
    china: "avtomobili-ot-kitay",
    japan: "avtomobili-ot-yaponiya",
    uae: "avtomobili-ot-oae",
  },
  ka: {
    usa: "manqanebi-usa-dan",
    korea: "manqanebi-koreidan",
    canada: "manqanebi-kanadidan",
    china: "manqanebi-chinethidan",
    japan: "manqanebi-iaponiidan",
    uae: "manqanebi-oae-dan",
  },
  ar: {
    usa: "sayarat-min-usa",
    korea: "sayarat-min-korea",
    canada: "sayarat-min-canada",
    china: "sayarat-min-china",
    japan: "sayarat-min-japan",
    uae: "sayarat-min-uae",
  },
  uk: {
    usa: "avto-z-usa",
    korea: "avto-z-koreyi",
    canada: "avto-z-kanady",
    china: "avto-z-kytayu",
    japan: "avto-z-yaponiyi",
    uae: "avto-z-oae",
  },
  ru: {
    usa: "avto-iz-usa",
    korea: "avto-iz-korei",
    canada: "avto-iz-kanady",
    china: "avto-iz-kitaya",
    japan: "avto-iz-yaponii",
    uae: "avto-iz-oae",
  },
  zh: {
    usa: "laizi-usa-de-che",
    korea: "laizi-hanguo-de-che",
    canada: "laizi-jianada-de-che",
    china: "laizi-zhongguo-de-che",
    japan: "laizi-riben-de-che",
    uae: "laizi-alianqiu-de-che",
  },
};

const EN_SLUG_TO_PAGE = Object.fromEntries(
  Object.entries(PAGE_SLUG.en).map(([page, slug]) => [slug, page]),
);

/** Localize an English canonical rest (`/pricing`, `/cars/usa`) for a language. */
export function localizeCanonicalRest(lang, canonicalRest) {
  const clean = (canonicalRest || "").replace(/\/$/, "") || "";
  if (!clean) return "";

  if (clean === "/blog" || clean.startsWith("/blog/")) {
    const index = blogSeo.indexSlug[lang] || "blog";
    if (clean === "/blog") return `/${index}`;
    const id = clean.slice("/blog/".length).split("/")[0];
    const article = blogSeo.articles.find((item) => item.id === id);
    const slug = article?.slug?.[lang];
    return slug ? `/${index}/${slug}` : clean;
  }
  if (clean.startsWith("/cars/")) {
    const country = clean.slice("/cars/".length).split("/")[0];
    const slug = COUNTRY_PAGE_SLUG[lang]?.[country];
    return slug ? `/${slug}` : `/${CARS_SEGMENT[lang]}/${country}`;
  }
  if (clean === "/credits/checkout") {
    return `/credits/${PAGE_SLUG[lang].checkout}`;
  }
  if (clean === "/api-b2b" || clean.startsWith("/api-b2b/")) return clean;
  if (clean.startsWith("/vin/")) return clean;
  if (clean.startsWith("/dashboard")) {
    return `/${PAGE_SLUG[lang].dashboard}${clean.slice("/dashboard".length)}`;
  }

  const pageSeg = clean.replace(/^\//, "");
  const page = EN_SLUG_TO_PAGE[pageSeg];
  if (page && PAGE_SLUG[lang]?.[page]) {
    return `/${PAGE_SLUG[lang][page]}`;
  }
  return clean.startsWith("/") ? clean : `/${clean}`;
}

export function localizedPath(lang, canonicalRest) {
  const rest = localizeCanonicalRest(lang, canonicalRest);
  return rest ? `/${lang}${rest}` : `/${lang}`;
}

/** Reverse: any-language rest → English canonical rest. */
export function toCanonicalRest(rest) {
  const clean = (rest || "").replace(/\/$/, "") || "";
  if (!clean) return "";

  const parts = clean.replace(/^\//, "").split("/").filter(Boolean);
  if (parts.length === 0) return "";

  if (parts[0] === "credits" && parts[1]) {
    return "/credits/checkout";
  }
  if (parts[0] === "api-b2b") {
    return `/${parts.join("/")}`;
  }
  if (parts[0] === "vin") {
    return `/${parts.join("/")}`;
  }

  if (BLOG_INDEX_SLUGS.has(parts[0])) {
    if (parts.length === 1) return "/blog";
    const id = blogSeo.slugToId[parts[1]];
    if (id) return `/blog/${id}`;
  }

  const carSegs = new Set(Object.values(CARS_SEGMENT));
  if (parts.length === 2 && carSegs.has(parts[0])) {
    return `/cars/${parts[1]}`;
  }

  if (parts.length === 1) {
    const seg = parts[0];
    for (const lang of SUPPORTED_LANGS) {
      const map = COUNTRY_PAGE_SLUG[lang];
      if (!map) continue;
      for (const [country, slug] of Object.entries(map)) {
        if (slug === seg) return `/cars/${country}`;
      }
    }
    for (const lang of SUPPORTED_LANGS) {
      for (const [page, slug] of Object.entries(PAGE_SLUG[lang])) {
        if (slug === seg) return `/${PAGE_SLUG.en[page]}`;
      }
    }
  }

  if (parts.length >= 1) {
    for (const lang of SUPPORTED_LANGS) {
      if (parts[0] === PAGE_SLUG[lang].dashboard) {
        const sub = parts.slice(1).join("/");
        return sub ? `/dashboard/${sub}` : "/dashboard";
      }
    }
  }

  return clean.startsWith("/") ? clean : `/${clean}`;
}

export { PAGE_SLUG, SUPPORTED_LANGS };
