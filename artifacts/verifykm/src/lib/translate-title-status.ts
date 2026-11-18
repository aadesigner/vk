import { damageValueKey } from "./translate-damage-label";
import { translateKoreanProviderText } from "./korean-provider-text";

const TITLE_PHRASE_REPLACEMENTS: Array<{ pattern: RegExp; key: string }> = [
  { pattern: /\bsalvage\s+title\b/gi, key: "title_phrase_salvage_title" },
  { pattern: /\brebuilt\s+title\b/gi, key: "title_phrase_rebuilt_title" },
  { pattern: /\bclean\s+title\b/gi, key: "title_phrase_clean_title" },
  { pattern: /\bcertificate\s+of\s+title\b/gi, key: "title_phrase_certificate_of_title" },
  { pattern: /\bparts\s+only\b/gi, key: "title_phrase_parts_only" },
  { pattern: /\bsalvage\b/gi, key: "title_word_salvage" },
  { pattern: /\brebuilt\b/gi, key: "title_word_rebuilt" },
  { pattern: /\bjunk\b/gi, key: "title_word_junk" },
  { pattern: /\bclean\b/gi, key: "title_word_clean" },
  { pattern: /\binspection\b/gi, key: "provider_inspection" },
];

/** Translate Copart/IAAI title-status text when locale strings exist. */
export function translateTitleStatus(
  t: (key: string) => string,
  value: string | null | undefined,
): string | null {
  if (!value || value === "[object Object]") return null;

  const fullKey = `title_val_${damageValueKey(value)}`;
  const fullTranslated = t(fullKey);
  if (fullTranslated !== fullKey) return fullTranslated;

  const providerPhrase = translateKoreanProviderText(t, value);
  if (providerPhrase && providerPhrase.trim().toLowerCase() !== value.trim().toLowerCase()) {
    return providerPhrase;
  }

  let result = value;
  for (const { pattern, key } of TITLE_PHRASE_REPLACEMENTS) {
    const translated = t(key);
    if (translated !== key) {
      result = result.replace(pattern, translated);
    }
  }
  return result;
}
