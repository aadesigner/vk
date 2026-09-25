import { cleanDisplayText, sanitizeRegistryDetailRows } from "@/lib/report-display";

export type HistoryDetailRow = { label: string; value: string };

/**
 * Split provider titles like "License plate: 12가3456" or
 * "First registration: 2014" into a clean title + detail row.
 */
export function splitColonTitle(
  title: string | null | undefined,
): { title: string; label: string; value: string } | null {
  const raw = cleanDisplayText(title);
  if (!raw) return null;
  // Avoid URLs / clock-style strings with many colons.
  if (/https?:\/\//i.test(raw)) return null;
  const m = raw.match(/^(.{2,48}?)\s*:\s*(.+)$/);
  if (!m) return null;
  const label = m[1]!.trim();
  const value = m[2]!.trim();
  if (!label || !value) return null;
  if (label.includes(":")) return null;
  return { title: label, label, value };
}

/**
 * Ensure Events / service cards can expand like First registration:
 * reuse provider details when present, otherwise synthesize from
 * colon-titles and secondary fields (date, subtitle, mileage, …).
 */
export function ensureExpandableDetails(input: {
  title?: string | null;
  details?: HistoryDetailRow[] | null;
  date?: string | null;
  subtitle?: string | null;
  description?: string | null;
  mileage?: number | null;
  location?: string | null;
  amount?: string | null;
}): { title: string | null; details: HistoryDetailRow[] } {
  let title = cleanDisplayText(input.title);
  let details = sanitizeRegistryDetailRows(input.details);

  const split = splitColonTitle(title);
  if (split) {
    title = split.title;
    if (!details.some((d) => d.label.toLowerCase() === split.label.toLowerCase())) {
      details = [{ label: split.label, value: split.value }, ...details];
    }
  }

  if (details.length > 0) return { title, details };

  const rows: HistoryDetailRow[] = [];
  const date = cleanDisplayText(input.date);
  if (date) rows.push({ label: "Date", value: date });

  const body = cleanDisplayText(input.subtitle) ?? cleanDisplayText(input.description);
  if (body && body.toLowerCase() !== (title ?? "").toLowerCase()) {
    rows.push({ label: "Details", value: body });
  }

  if (input.mileage != null && Number.isFinite(input.mileage) && input.mileage > 0) {
    rows.push({ label: "Mileage", value: `${Number(input.mileage).toLocaleString()} km` });
  }

  const location = cleanDisplayText(input.location);
  if (location) rows.push({ label: "Location", value: location });

  const amount = cleanDisplayText(input.amount);
  if (amount) rows.push({ label: "Amount", value: amount });

  return { title, details: rows };
}
