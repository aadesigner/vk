/** Read a named auth field from the live DOM (works with iOS password autofill). */
export function readAuthFieldValue(
  form: HTMLFormElement,
  name: string,
  fallback = "",
): string {
  const el = form.elements.namedItem(name);
  if (el instanceof HTMLInputElement) return el.value;
  if (el instanceof RadioNodeList) {
    const selected = Array.from(el).find((node) => node instanceof HTMLInputElement && node.checked);
    if (selected instanceof HTMLInputElement) return selected.value;
  }
  return fallback;
}
