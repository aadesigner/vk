/**
 * Per-language URL slugs for marketing (and common app) pages.
 * Canonical English keys stay stable for SEO maps; public URLs use localized slugs
 * e.g. /es/precios, /sq/ofertat, /de/preise.
 */
import { SUPPORTED_LANGS, type Language } from "@/lib/languages";
import { BLOG_INDEX_SLUG, articleIdFromSlug, articleSlug } from "@/content/blog";

/** Stable page ids — not URL segments. */
export type PageId =
  | "home"
  | "pricing"
  | "how_it_works"
  | "faq"
  | "blog"
  | "free_vin_decoder"
  | "terms"
  | "privacy"
  | "sign_in"
  | "sign_up"
  | "dashboard"
  | "purchases"
  | "checkout"
  | "credits_checkout"
  | "forgot_password"
  | "reset_password"
  | "set_password";

export type CountryId = "usa" | "korea" | "canada" | "china" | "japan" | "uae";

/** Single-segment pages (no nested path). */
const PAGE_SLUG: Record<Language, Record<Exclude<PageId, "home" | "credits_checkout">, string>> = {
  en: {
    pricing: "pricing",
    how_it_works: "how-it-works",
    faq: "faq",
    blog: BLOG_INDEX_SLUG.en,
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
  },
  de: {
    pricing: "preise",
    how_it_works: "so-funktionierts",
    faq: "faq",
    blog: BLOG_INDEX_SLUG.de,
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
  },
  es: {
    pricing: "precios",
    how_it_works: "como-funciona",
    faq: "preguntas-frecuentes",
    blog: BLOG_INDEX_SLUG.es,
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
  },
  fr: {
    pricing: "tarifs",
    how_it_works: "comment-ca-marche",
    faq: "faq",
    blog: BLOG_INDEX_SLUG.fr,
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
  },
  sq: {
    pricing: "ofertat",
    how_it_works: "si-funksionon",
    faq: "pyetje-te-shpeshta",
    blog: BLOG_INDEX_SLUG.sq,
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
  },
  pl: {
    pricing: "cennik",
    how_it_works: "jak-to-dziala",
    faq: "faq",
    blog: BLOG_INDEX_SLUG.pl,
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
  },
  ro: {
    pricing: "preturi",
    how_it_works: "cum-functioneaza",
    faq: "intrebari-frecvente",
    blog: BLOG_INDEX_SLUG.ro,
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
  },
  bg: {
    pricing: "tseni",
    how_it_works: "kak-raboti",
    faq: "vaprosi",
    blog: BLOG_INDEX_SLUG.bg,
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
  },
  ka: {
    pricing: "fasebi",
    how_it_works: "rogor-mushaoibs",
    faq: "kitkhvebi",
    blog: BLOG_INDEX_SLUG.ka,
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
  },
  ar: {
    pricing: "al-aseaar",
    how_it_works: "kayfa-taamal",
    faq: "asela-shaea",
    blog: BLOG_INDEX_SLUG.ar,
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
  },
  uk: {
    pricing: "tsiny",
    how_it_works: "yak-tse-pratsyuye",
    faq: "zapytannya",
    blog: BLOG_INDEX_SLUG.uk,
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
  },
  ru: {
    pricing: "tseny",
    how_it_works: "kak-eto-rabotaet",
    faq: "voprosy",
    blog: BLOG_INDEX_SLUG.ru,
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
  },
  zh: {
    pricing: "jiage",
    how_it_works: "ruhe-yunzuo",
    faq: "changjian-wenti",
    blog: BLOG_INDEX_SLUG.zh,
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
  },
};

/**
 * Legacy nested parent segment (`/sq/makina/usa`) — kept for redirects/resolve only.
 * Public URLs use single-segment COUNTRY_PAGE_SLUG (`/sq/makina-nga-usa`).
 */
export const CARS_SEGMENT: Record<Language, string> = {
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

export const COUNTRY_IDS: readonly CountryId[] = [
  "usa",
  "korea",
  "canada",
  "china",
  "japan",
  "uae",
] as const;

/** Single-segment country guide slugs: `/en/cars-from-usa`, `/sq/makina-nga-korea`. */
export const COUNTRY_PAGE_SLUG: Record<Language, Record<CountryId, string>> = {
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

type SimplePageId = Exclude<
  PageId,
  "home" | "credits_checkout"
>;

const SIMPLE_PAGE_IDS = Object.keys(PAGE_SLUG.en) as SimplePageId[];

/** English canonical rest path used by SEO_DATA / indexable-paths (e.g. `/pricing`). */
export function canonicalRestForPage(page: PageId): string {
  switch (page) {
    case "home":
      return "";
    case "credits_checkout":
      return "/credits/checkout";
    default:
      return `/${PAGE_SLUG.en[page as SimplePageId]}`;
  }
}

/** Build localized path for a page: `/es/precios`, `/sq/ofertat`. */
export function pathFor(
  lang: Language,
  page: PageId,
  opts?: { query?: string; hash?: string },
): string {
  let path: string;
  if (page === "home") {
    path = `/${lang}`;
  } else if (page === "credits_checkout") {
    path = `/${lang}/credits/${PAGE_SLUG[lang].checkout}`;
  } else {
    path = `/${lang}/${PAGE_SLUG[lang][page as SimplePageId]}`;
  }
  if (opts?.query) path += opts.query.startsWith("?") ? opts.query : `?${opts.query}`;
  if (opts?.hash) path += opts.hash.startsWith("#") ? opts.hash : `#${opts.hash}`;
  return path;
}

/** Country guide: `/es/coches-de-usa`, `/sq/makina-nga-korea`. */
export function pathForCountry(lang: Language, country: CountryId | string): string {
  const id = String(country).toLowerCase() as CountryId;
  const slug = COUNTRY_PAGE_SLUG[lang]?.[id] ?? COUNTRY_PAGE_SLUG.en[id];
  return `/${lang}/${slug}`;
}

/** Resolve a single-segment country slug (any language) → country id. */
export function countryIdFromSlug(slug: string): CountryId | null {
  const s = slug.toLowerCase();
  for (const lang of SUPPORTED_LANGS) {
    for (const id of COUNTRY_IDS) {
      if (COUNTRY_PAGE_SLUG[lang][id] === s) return id;
    }
  }
  return null;
}

/** All unique single-segment country guide slugs (for wouter routes). */
export function allCountrySlugs(): string[] {
  const set = new Set<string>();
  for (const lang of SUPPORTED_LANGS) {
    for (const id of COUNTRY_IDS) {
      set.add(COUNTRY_PAGE_SLUG[lang][id]);
    }
  }
  return [...set];
}

/** All unique URL segments that map to a simple page (for wouter regex). */
export function allSlugsFor(page: SimplePageId): string[] {
  const set = new Set<string>();
  for (const lang of SUPPORTED_LANGS) {
    set.add(PAGE_SLUG[lang][page]);
    // Always accept English alias for backwards compatibility / redirects
    set.add(PAGE_SLUG.en[page]);
  }
  return [...set];
}

export function allCarsSegments(): string[] {
  return [...new Set(SUPPORTED_LANGS.map((l) => CARS_SEGMENT[l]))];
}

export function slugRegex(page: SimplePageId): string {
  return allSlugsFor(page).join("|");
}

export function carsSegmentRegex(): string {
  return allCarsSegments().join("|");
}

export function countrySlugRegex(): string {
  return allCountrySlugs().join("|");
}

type Resolved =
  | { kind: "page"; page: PageId }
  | { kind: "country"; country: CountryId }
  | { kind: "vin"; vinRest: string }
  | { kind: "blog_post"; id: string }
  | { kind: "unknown" };

/**
 * Resolve a path rest (no lang prefix), optionally knowing the URL lang,
 * into a stable page/country id. Accepts any language's slug + English aliases.
 */
export function resolveRest(rest: string, langHint?: Language): Resolved {
  const clean = (rest || "").replace(/\/$/, "") || "";
  if (!clean || clean === "/") return { kind: "page", page: "home" };

  const parts = clean.replace(/^\//, "").split("/").filter(Boolean);
  if (parts.length === 0) return { kind: "page", page: "home" };

  // credits/{checkout-slug}
  if (parts[0] === "credits" && parts[1]) {
    const checkoutSlugs = new Set(allSlugsFor("checkout"));
    if (checkoutSlugs.has(parts[1]) && parts.length === 2) {
      return { kind: "page", page: "credits_checkout" };
    }
  }

  // Legacy nested: cars|coches|makina|… / countryId
  if (parts.length === 2 && allCarsSegments().includes(parts[0])) {
    const c = parts[1].toLowerCase() as CountryId;
    if ((COUNTRY_IDS as readonly string[]).includes(c)) {
      return { kind: "country", country: c };
    }
  }

  // vin/…
  if (parts[0] === "vin") {
    return { kind: "vin", vinRest: `/${parts.join("/")}` };
  }

  if ((Object.values(BLOG_INDEX_SLUG) as string[]).includes(parts[0])) {
    if (parts.length === 1) return { kind: "page", page: "blog" };
    if (parts.length === 2) {
      const id = articleIdFromSlug(parts[1]);
      if (id) return { kind: "blog_post", id };
    }
  }

  // single-segment pages + country guides
  if (parts.length === 1) {
    const seg = parts[0];
    const fromCountry = countryIdFromSlug(seg);
    if (fromCountry) return { kind: "country", country: fromCountry };

    // Prefer matching the URL language's slug first
    if (langHint) {
      for (const page of SIMPLE_PAGE_IDS) {
        if (PAGE_SLUG[langHint][page] === seg) return { kind: "page", page };
      }
    }
    for (const page of SIMPLE_PAGE_IDS) {
      for (const lang of SUPPORTED_LANGS) {
        if (PAGE_SLUG[lang][page] === seg) return { kind: "page", page };
      }
    }
  }

  // dashboard subpaths stay under dashboard slug
  if (parts.length >= 1) {
    for (const lang of SUPPORTED_LANGS) {
      if (parts[0] === PAGE_SLUG[lang].dashboard) {
        return { kind: "page", page: "dashboard" };
      }
    }
  }

  return { kind: "unknown" };
}

/** Canonical English rest used by PATH_TO_SEO_KEY / sitemap keys. */
export function toCanonicalRest(rest: string, langHint?: Language): string {
  const r = resolveRest(rest, langHint);
  if (r.kind === "page") {
    if (r.page === "home") return "";
    if (r.page === "credits_checkout") return "/credits/checkout";
    if (r.page === "dashboard") {
      const sub = rest.replace(/^\//, "").split("/").filter(Boolean)[1];
      if (sub === "account" || sub === "help") return `/dashboard/${sub}`;
      return "/dashboard";
    }
    return `/${PAGE_SLUG.en[r.page as SimplePageId]}`;
  }
  if (r.kind === "blog_post") return `/blog/${r.id}`;
  if (r.kind === "country") return `/cars/${r.country}`;
  if (r.kind === "vin") return r.vinRest;
  return rest.replace(/\/$/, "") || "";
}

/** Localized rest for a language from a canonical English rest (e.g. `/pricing` → `/ofertat`). */
export function localizeCanonicalRest(lang: Language, canonicalRest: string): string {
  const clean = (canonicalRest || "").replace(/\/$/, "") || "";
  if (!clean) return "";

  if (clean.startsWith("/cars/")) {
    const country = clean.slice("/cars/".length).split("/")[0] as CountryId;
    if ((COUNTRY_IDS as readonly string[]).includes(country)) {
      return `/${COUNTRY_PAGE_SLUG[lang][country]}`;
    }
  }

  if (clean === "/credits/checkout") {
    return `/credits/${PAGE_SLUG[lang].checkout}`;
  }


  if (clean === "/blog" || clean.startsWith("/blog/")) {
    if (clean === "/blog") return `/${BLOG_INDEX_SLUG[lang]}`;
    const id = clean.slice("/blog/".length).split("/")[0] ?? "";
    const slug = articleSlug(lang, id);
    if (slug) return `/${BLOG_INDEX_SLUG[lang]}/${slug}`;
  }

  if (clean.startsWith("/vin/")) return clean;

  if (clean.startsWith("/dashboard")) {
    const sub = clean.slice("/dashboard".length);
    return `/${PAGE_SLUG[lang].dashboard}${sub}`;
  }

  const pageSeg = clean.replace(/^\//, "");
  for (const page of SIMPLE_PAGE_IDS) {
    if (PAGE_SLUG.en[page] === pageSeg) {
      return `/${PAGE_SLUG[lang][page]}`;
    }
  }

  return clean.startsWith("/") ? clean : `/${clean}`;
}

/** Full localized URL path from canonical rest. */
export function localizedPathFromCanonical(lang: Language, canonicalRest: string): string {
  const rest = localizeCanonicalRest(lang, canonicalRest);
  return rest ? `/${lang}${rest}` : `/${lang}`;
}

/**
 * When switching languages, remap the slug to the target language's equivalent.
 */
export function remapPathForLang(
  pathname: string,
  fromLang: Language,
  toLang: Language,
): string {
  const qIdx = pathname.indexOf("?");
  const hIdx = pathname.indexOf("#");
  let cut = pathname.length;
  if (qIdx >= 0) cut = Math.min(cut, qIdx);
  if (hIdx >= 0) cut = Math.min(cut, hIdx);
  const pathOnly = pathname.slice(0, cut);
  const suffix = pathname.slice(cut);

  const m = pathOnly.match(new RegExp(`^/${fromLang}(/.*)?$`));
  if (!m) return `/${toLang}${suffix}`;
  const rest = m[1] || "";
  const canonical = toCanonicalRest(rest, fromLang);
  return `${localizedPathFromCanonical(toLang, canonical)}${suffix}`;
}

/** True when the URL uses a non-canonical slug for this language (should redirect). */
export function needsCanonicalSlugRedirect(
  lang: Language,
  rest: string,
): string | null {
  const clean = (rest || "").replace(/\/$/, "") || "";
  if (!clean) return null;
  const canonical = toCanonicalRest(clean, lang);
  const expected = localizeCanonicalRest(lang, canonical);
  const normalized = clean.startsWith("/") ? clean : `/${clean}`;
  if (normalized === expected) return null;
  // Only redirect when we successfully mapped to a known page
  const resolved = resolveRest(clean, lang);
  if (resolved.kind === "unknown") return null;
  if (resolved.kind === "vin") return null;
  return expected ? `/${lang}${expected}` : `/${lang}`;
}

export function pageSlug(lang: Language, page: SimplePageId): string {
  return PAGE_SLUG[lang][page];
}

export { PAGE_SLUG, SIMPLE_PAGE_IDS };
export type { SimplePageId };
