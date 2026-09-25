/** Normalize API damage text to an i18n key suffix (e.g. "Front End" → "front_end"). */
export function damageValueKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

/** Translate a Copart/IAAI damage label when a locale string exists; otherwise title-case the raw value. */
export function translateDamageLabel(
  t: (key: string) => string,
  value: string | null | undefined,
): string | null {
  if (!value || value === "[object Object]") return null;
  const i18nKey = `damage_val_${damageValueKey(value)}`;
  const translated = t(i18nKey);
  if (translated !== i18nKey) return translated;
  return value.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
