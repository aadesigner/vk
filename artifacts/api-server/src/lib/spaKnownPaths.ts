/**
 * Paths the SPA can legitimately render. Unknown HTML routes should get a real 404
 * instead of the English home soft-404 shell.
 *
 * Keep aligned with App.tsx public/admin routes + seo-inject PATH_TO_SEO_KEY.
 */

const LANG_ALT =
  "en|de|es|fr|sq|pl|ro|bg|ka|ar|uk|ru|zh";

/** Exact English rest segments under /:lang (no leading slash on empty home). */
const KNOWN_LANG_RESTS = new Set([
  "",
  "pricing",
  "free-vin-decoder",
  "how-it-works",
  "faq",
  "terms",
  "privacy",
  "sign-in",
  "sign-up",
  "forgot-password",
  "reset-password",
  "set-password",
  "dashboard",
  "dashboard/account",
  "dashboard/help",
  "checkout",
  "purchases",
  "maintenance",
  "vin/processing",
]);

/**
 * Localized marketing / app page slugs (any language) — keep in sync with
 * verifykm `localized-routes` PAGE_SLUG.
 */
const LOCALIZED_PAGE_SLUGS = new Set([
  // pricing
  "pricing", "preise", "precios", "tarifs", "ofertat", "cennik", "preturi",
  "tseni", "fasebi", "al-aseaar", "tsiny", "tseny", "jiage",
  // how-it-works
  "how-it-works", "so-funktionierts", "como-funciona", "comment-ca-marche",
  "si-funksionon", "jak-to-dziala", "cum-functioneaza", "kak-raboti",
  "rogor-mushaoibs", "kayfa-taamal", "yak-tse-pratsyuye", "kak-eto-rabotaet",
  "ruhe-yunzuo",
  // faq
  "faq", "preguntas-frecuentes", "pyetje-te-shpeshta", "intrebari-frecvente",
  "vaprosi", "kitkhvebi", "asela-shaea", "zapytannya", "voprosy", "changjian-wenti",
  // free decoder
  "free-vin-decoder", "kostenloser-vin-decoder", "decodificador-vin-gratis",
  "decodeur-vin-gratuit", "dekoder-vin-falas", "darmowy-dekoder-vin",
  "decoder-vin-gratuit", "besplaten-vin-dekoder", "ufaso-vin-dekoderi",
  "fakk-vin-majani", "bezkoshtovnyy-vin-dekoder", "besplatnyy-vin-dekoder",
  "mianfei-vin-jiema",
  // terms / privacy
  "terms", "agb", "terminos", "conditions", "kushtet", "regulamin", "termeni",
  "usloviya", "pirobebi", "al-shurut", "umovy", "tiaokuan",
  "privacy", "datenschutz", "privacidad", "confidentialite", "privatesia",
  "prywatnosc", "confidentialitate", "poveritelnost", "konfidencialuroba",
  "al-khususiya", "pryvatnist", "konfidencialnost", "yinsi",
  // auth
  "sign-in", "anmelden", "iniciar-sesion", "connexion", "hyrje", "logowanie",
  "autentificare", "vhod", "shesvla", "tasjil-al-dukhul", "vkhid", "vkhod", "denglu",
  "sign-up", "registrieren", "registrarse", "inscription", "regjistrim", "rejestracja",
  "inregistrare", "registratsiya", "registracia", "insha-hisab", "reyestratsiya", "zhuce",
  "forgot-password", "passwort-vergessen", "olvide-contrasena", "mot-de-passe-oublie",
  "fjalekalimi-i-harruar", "zapomniane-haslo", "parola-uitata", "zabravena-parola",
  "parolis-dagitsqeba", "nisyan-kalimat-al-murur", "zabuly-parol", "zabyli-parol",
  "wangji-mima",
  "reset-password", "passwort-zuruecksetzen", "restablecer-contrasena",
  "reinitialiser-mot-de-passe", "rivendos-fjalekalimin", "resetuj-haslo",
  "resetare-parola", "nulirane-na-parola", "parolis-aghdgena",
  "iadat-tayin-kalimat-al-murur", "skinuty-parol", "sbros-parolya", "chongzhi-mima",
  "set-password", "passwort-setzen", "establecer-contrasena", "definir-mot-de-passe",
  "vendos-fjalekalimin", "ustaw-haslo", "setare-parola", "zadavane-na-parola",
  "parolis-dayeneba", "tayin-kalimat-al-murur", "vstanovyty-parol", "ustanovit-parol",
  "shezhi-mima",
  // dashboard / purchases / checkout
  "dashboard", "panel", "tableau-de-bord", "paneli", "panou", "tablo",
  "lawhat-al-tahakkum", "kongzhitai",
  "purchases", "kaeufe", "compras", "achats", "blerjet", "zakupy", "achizitii",
  "pokupki", "sheqidvebi", "al-mushtrayat", "pokupky", "goumai",
  "checkout", "kasse", "pago", "paiement", "pagesa", "kasa", "plata", "plashtane",
  "gadakhda", "al-daf", "oplata", "jiesuan",
]);

/** Dashboard sub-views — English + localized dashboard slug + /account|/help. */
const DASHBOARD_SLUGS = [
  "dashboard", "panel", "tableau-de-bord", "paneli", "panou", "tablo",
  "lawhat-al-tahakkum", "kongzhitai",
];

/** Single-segment country guide slugs — keep in sync with verifykm COUNTRY_PAGE_SLUG. */
const COUNTRY_PAGE_SLUGS = new Set([
  // en
  "cars-from-usa", "cars-from-korea", "cars-from-canada", "cars-from-china",
  "cars-from-japan", "cars-from-uae",
  // de
  "autos-aus-usa", "autos-aus-korea", "autos-aus-kanada", "autos-aus-china",
  "autos-aus-japan", "autos-aus-vae",
  // es
  "coches-de-usa", "coches-de-corea", "coches-de-canada", "coches-de-china",
  "coches-de-japon", "coches-de-emiratos",
  // fr
  "voitures-des-usa", "voitures-de-coree", "voitures-du-canada", "voitures-de-chine",
  "voitures-du-japon", "voitures-des-emirats",
  // sq
  "makina-nga-usa", "makina-nga-korea", "makina-nga-kanada", "makina-nga-kina",
  "makina-nga-japonia", "makina-nga-emirates",
  // pl
  "samochody-z-usa", "samochody-z-korei", "samochody-z-kanady", "samochody-z-chin",
  "samochody-z-japonii", "samochody-z-ze",
  // ro
  "masini-din-usa", "masini-din-coreea", "masini-din-canada", "masini-din-china",
  "masini-din-japonia", "masini-din-emirate",
  // bg
  "avtomobili-ot-usa", "avtomobili-ot-koreya", "avtomobili-ot-kanada",
  "avtomobili-ot-kitay", "avtomobili-ot-yaponiya", "avtomobili-ot-oae",
  // ka
  "manqanebi-usa-dan", "manqanebi-koreidan", "manqanebi-kanadidan",
  "manqanebi-chinethidan", "manqanebi-iaponiidan", "manqanebi-oae-dan",
  // ar
  "sayarat-min-usa", "sayarat-min-korea", "sayarat-min-canada",
  "sayarat-min-china", "sayarat-min-japan", "sayarat-min-uae",
  // uk
  "avto-z-usa", "avto-z-koreyi", "avto-z-kanady", "avto-z-kytayu",
  "avto-z-yaponiyi", "avto-z-oae",
  // ru
  "avto-iz-usa", "avto-iz-korei", "avto-iz-kanady", "avto-iz-kitaya",
  "avto-iz-yaponii", "avto-iz-oae",
  // zh
  "laizi-usa-de-che", "laizi-hanguo-de-che", "laizi-jianada-de-che",
  "laizi-zhongguo-de-che", "laizi-riben-de-che", "laizi-alianqiu-de-che",
]);

/** Legacy nested parent segments (`/sq/makina/usa`). */
const LEGACY_CARS_SEGMENTS = new Set([
  "cars", "autos", "coches", "voitures", "makina", "samochody", "masini",
  "avtomobili", "manqanebi", "sayarat", "avto", "cheliang",
]);

const VALID_COUNTRY = new Set(["usa", "korea", "canada", "china", "japan", "uae"]);

const LEGACY_COUNTRY_RE = /^\/(usa|korea|canada)-cars\/?$/i;
const VIN_17_RE = /^[A-HJ-NPR-Z0-9]{17}$/i;
const LOOKUP_ID_RE = /^\d{1,12}$/;

function stripQuery(pathname: string): string {
  return (pathname.split("?")[0] ?? pathname).replace(/\/+$/, "") || "/";
}

function isKnownRest(rest: string): boolean {
  if (KNOWN_LANG_RESTS.has(rest)) return true;
  if (LOCALIZED_PAGE_SLUGS.has(rest)) return true;
  if (COUNTRY_PAGE_SLUGS.has(rest)) return true;

  for (const dash of DASHBOARD_SLUGS) {
    if (rest === dash) return true;
    if (rest === `${dash}/account` || rest === `${dash}/help`) return true;
  }

  const car = rest.match(/^([^/]+)\/([a-z]+)$/);
  if (car && LEGACY_CARS_SEGMENTS.has(car[1]!) && VALID_COUNTRY.has(car[2]!)) {
    return true;
  }

  return false;
}

/**
 * True when the request path should fall through to the SPA (200).
 * False → respond with HTTP 404 (do not serve English home as soft-404).
 */
export function isKnownSpaPath(pathname: string): boolean {
  const p = stripQuery(pathname);

  if (p === "/" || p === "/index.html") return true;

  if (p === "/adminx" || p.startsWith("/adminx/")) return true;

  if (LEGACY_COUNTRY_RE.test(p)) return true;

  const langHome = p.match(new RegExp(`^/(${LANG_ALT})$`, "i"));
  if (langHome) return true;

  const withLang = p.match(new RegExp(`^/(${LANG_ALT})/(.+)$`, "i"));
  if (withLang) {
    const rest = withLang[2]!.toLowerCase();
    if (isKnownRest(rest)) return true;

    // Auth catch-all from wouter: /:lang/sign-in/*? (English + common localized)
    if (
      /^(sign-in|sign-up|anmelden|registrieren|iniciar-sesion|registrarse|connexion|inscription|hyrje|regjistrim|logowanie|rejestracja|autentificare|inregistrare|vhod|registratsiya|shesvla|registracia|tasjil-al-dukhul|insha-hisab|vkhid|reyestratsiya|vkhod|denglu|zhuce)\//.test(
        rest,
      )
    ) {
      return true;
    }

    const vin = rest.match(/^vin\/([^/]+)$/);
    if (vin) {
      const id = vin[1]!;
      if (id === "processing") return true;
      if (VIN_17_RE.test(id)) return true;
      if (LOOKUP_ID_RE.test(id)) return true;
    }

    // credits/{checkout-slug}
    if (rest.startsWith("credits/")) {
      const checkout = rest.slice("credits/".length);
      if (checkout === "checkout" || LOCALIZED_PAGE_SLUGS.has(checkout)) {
        return true;
      }
    }

    return false;
  }

  // Unprefixed paths that the client redirects to /:lang/...
  const unprefixed = p.replace(/^\//, "").toLowerCase();
  if (isKnownRest(unprefixed)) return true;
  const unprefixedVin = unprefixed.match(/^vin\/([^/]+)$/);
  if (unprefixedVin) {
    const id = unprefixedVin[1]!;
    if (id === "processing") return true;
    if (VIN_17_RE.test(id)) return true;
    if (LOOKUP_ID_RE.test(id)) return true;
  }

  return false;
}
