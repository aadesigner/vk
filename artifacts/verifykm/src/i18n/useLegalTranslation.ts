import { useEffect, useState } from "react";
import { useTranslation } from "./context";
import type { Language } from "@/lib/languages";

type LegalDict = Record<string, string>;

const loaders: Record<Language, () => Promise<{ default: LegalDict }>> = {
  en: () => import("./legal/en.json"),
  de: () => import("./legal/de.json"),
  es: () => import("./legal/es.json"),
  fr: () => import("./legal/fr.json"),
  sq: () => import("./legal/sq.json"),
  pl: () => import("./legal/pl.json"),
  ro: () => import("./legal/ro.json"),
  bg: () => import("./legal/bg.json"),
  ka: () => import("./legal/ka.json"),
  ar: () => import("./legal/ar.json"),
  uk: () => import("./legal/uk.json"),
  ru: () => import("./legal/ru.json"),
  zh: () => import("./legal/zh.json"),
};

export function useLegalTranslation() {
  const { language } = useTranslation();
  const [dict, setDict] = useState<LegalDict | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDict(null);
    const load = loaders[language] ?? loaders.en;
    load()
      .then((mod) => { if (!cancelled) setDict(mod.default); })
      .catch(() => loaders.en().then((mod) => { if (!cancelled) setDict(mod.default); }));
    return () => { cancelled = true; };
  }, [language]);

  const t = (key: string) => dict?.[key] ?? key;
  return { t, ready: dict !== null, language };
}
