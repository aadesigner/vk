import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  DAMAGE_SEVERITY_META,
  normalizeDamagePartLabel,
  type DamageSeverity,
} from "@/lib/car-damage-zones";
import { HistoryShowAllButton } from "@/components/history-show-all-button";
import { HISTORY_PREVIEW_LIMIT } from "@/lib/history-section-limit";
import { translateBodyPanelLabel } from "@/lib/translate-damage-label";

type DisplayRow = { label: string; value: string; observedAt: string | null };

type Props = {
  rows: DisplayRow[];
  t: (key: string) => string;
};

type WorkBucketId = DamageSeverity | "other";

const BUCKET_ORDER: WorkBucketId[] = ["paint", "repair", "replace", "sheet_metal", "other"];

const BUCKET_TITLE_KEY: Record<WorkBucketId, string> = {
  paint: "damage_severity_paint",
  repair: "damage_severity_repair",
  replace: "damage_severity_replace",
  sheet_metal: "damage_severity_sheet_metal",
  other: "repair_parts_other_work",
};

function bucketFromRow(label: string): WorkBucketId {
  const blob = label.toLowerCase();
  if (/sheet\s*metal|판금|kr_parts_sheet/.test(blob)) return "sheet_metal";
  if (/replac|교환|교체|kr_parts_replace/.test(blob)) return "replace";
  if (/paint|도장|kr_parts_paint/.test(blob)) return "paint";
  if (/repair|overhaul|detach|탈착|수리|kr_parts_repair|kr_parts_other|kr_parts_detach/.test(blob)) {
    return "repair";
  }
  return "other";
}

function splitParts(value: string): string[] {
  return value
    .split(/;|\n|\|\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/\s*\(\+\d+\s*more\)\s*$/i, "").trim())
    .filter(Boolean);
}

function shortName(name: string): string {
  return normalizeDamagePartLabel(name)
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseGroups(rows: DisplayRow[]): Array<{ id: WorkBucketId; labels: string[] }> {
  const map = new Map<WorkBucketId, string[]>();
  const seen = new Set<string>();

  for (const row of rows) {
    if (/all repaired/i.test(row.label) && rows.length > 1) continue;
    const bucket = bucketFromRow(row.label);
    const list = map.get(bucket) ?? [];
    for (const raw of splitParts(row.value)) {
      const name = shortName(raw);
      if (!name) continue;
      const key = `${bucket}|${name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(name);
    }
    if (list.length) map.set(bucket, list);
  }

  return BUCKET_ORDER
    .filter((id) => (map.get(id)?.length ?? 0) > 0)
    .map((id) => ({ id, labels: map.get(id)! }));
}

/** Limit total chips across groups (not per group) so Show all actually reveals more. */
function limitGroups(
  groups: Array<{ id: WorkBucketId; labels: string[] }>,
  expanded: boolean,
): Array<{ id: WorkBucketId; labels: string[] }> {
  if (expanded) return groups;
  let left = HISTORY_PREVIEW_LIMIT;
  const out: Array<{ id: WorkBucketId; labels: string[] }> = [];
  for (const group of groups) {
    if (left <= 0) break;
    const labels = group.labels.slice(0, left);
    left -= labels.length;
    if (labels.length) out.push({ id: group.id, labels });
  }
  return out;
}

/** Same layout language as equipment extras: category label + muted chips. */
export function KoreanRepairPartsList({ rows, t }: Props) {
  const groups = useMemo(() => parseGroups(rows), [rows]);
  const [expanded, setExpanded] = useState(false);

  if (!groups.length) return null;

  const flatCount = groups.reduce((n, g) => n + g.labels.length, 0);
  const visibleGroups = limitGroups(groups, expanded);

  return (
    <div className="px-4 py-3 space-y-2.5">
      {visibleGroups.map((group) => {
        const style = group.id === "other"
          ? { stroke: "rgba(100,116,139,0.7)" }
          : DAMAGE_SEVERITY_META[group.id];
        return (
          <div
            key={group.id}
            className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-4 rounded-lg border border-border/50 bg-muted/15 px-3 py-2.5"
          >
            <div className="sm:w-28 shrink-0 pt-0.5 flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ background: style.stroke }}
              />
              {t(BUCKET_TITLE_KEY[group.id])}
            </div>
            <div className={cn("min-w-0 flex-1 flex flex-wrap gap-1.5 sm:justify-end")}>
              {group.labels.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center rounded-md border border-border/70 bg-muted/40 px-2 py-1 text-[11px] font-medium text-foreground"
                >
                  {translateBodyPanelLabel(t, label) ?? label}
                </span>
              ))}
            </div>
          </div>
        );
      })}
      <HistoryShowAllButton
        total={flatCount}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        t={t}
      />
    </div>
  );
}
