export const HISTORY_PREVIEW_LIMIT = 5;

export function sliceForHistoryPreview<T>(items: T[], expanded: boolean): T[] {
  if (expanded || items.length <= HISTORY_PREVIEW_LIMIT) return items;
  return items.slice(0, HISTORY_PREVIEW_LIMIT);
}
