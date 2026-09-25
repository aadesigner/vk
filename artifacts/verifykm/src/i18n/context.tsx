import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import enTranslations from "./en.json";
import { SUPPORTED_LANGS, type Language } from "@/lib/languages";

export type { Language };
export { SUPPORTED_LANGS };

type Translations = Record<string, string>;

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  dir: "ltr" | "rtl";
  ready: boolean;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const dictCache: Partial<Record<Language, Translations>> = {
  en: enTranslations as Translations,
};

const loadPromises: Partial<Record<Language, Promise<Translations>>> = {};

/** Dev HMR: locale JSON is cached in memory — invalidate so t() does not keep returning raw keys. */
if (import.meta.hot) {
  import.meta.hot.accept("./en.json", () => {
    import.meta.hot?.invalidate();
  });
}

export function readDict(lang: Language): Translations | undefined {
  return dictCache[lang];
}

export async function loadDict(lang: Language): Promise<Translations> {
  const cached = readDict(lang);
  if (cached) return cached;

  if (!loadPromises[lang]) {
    const map: Record<Language, () => Promise<{ default: Translations }>> = {
      en: () => Promise.resolve({ default: enTranslations as Translations }),
      de: () => import("./de.json"),
      es: () => import("./es.json"),
      fr: () => import("./fr.json"),
      sq: () => import("./sq.json"),
      pl: () => import("./pl.json"),
      ro: () => import("./ro.json"),
      bg: () => import("./bg.json"),
      ka: () => import("./ka.json"),
      ar: () => import("./ar.json"),
      uk: () => import("./uk.json"),
      ru: () => import("./ru.json"),
      zh: () => import("./zh.json"),
    };
    loadPromises[lang] = map[lang]().then((mod) => {
      dictCache[lang] = mod.default as Translations;
      return dictCache[lang]!;
    });
  }

  return loadPromises[lang]!;
}

/**
 * Soften idle preload: only warm English fallback if browsing another locale.
 * Full 11-locale preload would overload bandwidth; each lang loads on demand.
 */
export function preloadOtherLocales(active: Language): void {
  if (active === "en") return;
  const run = () => {
    void loadDict("en");
  };
  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout: 45_000 });
  } else if (typeof window !== "undefined") {
    window.setTimeout(run, 20_000);
  }
}

/** Call before updating the URL so the next page mount has strings ready. */
export async function ensureDict(lang: Language): Promise<void> {
  await loadDict(lang);
}

function pickTranslation(dict: Translations | undefined, key: string): string | undefined {
  if (!dict || !Object.prototype.hasOwnProperty.call(dict, key)) return undefined;
  return dict[key];
}

function resolveTranslation(dict: Translations | null, language: Language, key: string): string {
  const fromActive = pickTranslation(dict ?? undefined, key);
  if (fromActive !== undefined) return fromActive;

  const fromLangCache = pickTranslation(readDict(language), key);
  if (fromLangCache !== undefined) return fromLangCache;

  const fromEn = pickTranslation(readDict("en"), key);
  if (fromEn !== undefined) return fromEn;

  return key;
}

export function I18nProvider({ children, initialLanguage = "en" }: { children: ReactNode; initialLanguage?: Language }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  // Never seed non-English locales with the English dict — that paints EN text before the locale loads.
  const [dict, setDict] = useState<Translations | null>(() => readDict(initialLanguage) ?? null);
  const [ready, setReady] = useState(() => !!readDict(initialLanguage));
  const activeLangRef = useRef(initialLanguage);

  useEffect(() => {
    activeLangRef.current = language;
  }, [language]);

  useEffect(() => {
    setLanguageState(initialLanguage);
    const cached = readDict(initialLanguage);
    if (cached) {
      setDict(cached);
      setReady(true);
      return;
    }
    setReady(false);
    let cancelled = false;
    loadDict(initialLanguage).then((d) => {
      if (!cancelled && activeLangRef.current === initialLanguage) {
        setDict(d);
        setReady(true);
      }
    }).catch(() => {
      if (!cancelled) setReady(true);
    });
    return () => { cancelled = true; };
  }, [initialLanguage]);

  useEffect(() => {
    preloadOtherLocales(initialLanguage);
  }, [initialLanguage]);

  useEffect(() => {
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    const cached = readDict(lang);
    if (cached) {
      setDict(cached);
      setReady(true);
      return;
    }
    void loadDict(lang).then((d) => {
      if (activeLangRef.current === lang) {
        setDict(d);
        setReady(true);
      }
    });
  }, []);

  const t = useCallback(
    (key: string) => resolveTranslation(dict, language, key),
    [dict, language],
  );

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, dir: language === "ar" ? "rtl" : "ltr", ready }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslation must be used within an I18nProvider");
  return ctx;
}
