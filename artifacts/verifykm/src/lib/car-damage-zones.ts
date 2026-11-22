/**
 * Map Korea repair-part / accident text onto body zones for the damage diagram.
 */

export type DamageSeverity = "paint" | "repair" | "replace" | "sheet_metal";

export type CarDamageZoneId =
  | "front_bumper"
  | "grille"
  | "hood"
  | "front_fender_l"
  | "front_fender_r"
  | "front_door_l"
  | "front_door_r"
  | "rear_door_l"
  | "rear_door_r"
  | "rear_fender_l"
  | "rear_fender_r"
  | "side_sill_l"
  | "side_sill_r"
  | "rear_bumper"
  | "trunk"
  | "roof"
  | "glass";

export type CarDamageHit = {
  zone: CarDamageZoneId;
  severity: DamageSeverity;
  labels: string[];
};

const SEVERITY_RANK: Record<DamageSeverity, number> = {
  paint: 1,
  repair: 2,
  replace: 3,
  sheet_metal: 4,
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function severityFromBlob(blob: string, categoryHint?: string | null): DamageSeverity {
  const c = norm(categoryHint ?? "");
  const b = `${c} ${blob}`;
  if (/sheet\s*metal|판금/.test(b)) return "sheet_metal";
  if (/replac|교환|교체/.test(b)) return "replace";
  if (/overhaul|수리|repair\b/.test(b) && !/surface repair|painting|도장/.test(b)) return "repair";
  if (/paint|도장|painted|primer/.test(b)) return "paint";
  if (/detach|removable|탈착/.test(b)) return "repair";
  if (c.includes("sheet")) return "sheet_metal";
  if (c.includes("replace")) return "replace";
  if (c.includes("repair")) return "repair";
  if (c.includes("paint")) return "paint";
  return "repair";
}

function sideFromBlob(blob: string): "l" | "r" | "both" {
  if (/\b(left|lh|driver.?side|좌)\b/.test(blob)) return "l";
  if (/\b(right|rh|passenger.?side|우)\b/.test(blob)) return "r";
  return "both";
}

function zonesForPart(text: string): CarDamageZoneId[] {
  const b = norm(text);
  // Skip tiny non-body bits that clutter the diagram
  if (
    /tpms|sensor|handle|trim(?! options)|molding|wheel|tire|lamp|light|glass \(left\)|glass \(right\)|quarter glass|number light|reflector|wiper/.test(
      b,
    )
    && !/door|bumper|fender|quarter|trunk|hood|bonnet|grille|side step|bumper cover/.test(b)
  ) {
    // lamps still map if clearly body-adjacent
    if (/head\s*lamp|headlight/.test(b)) {
      const side = sideFromBlob(b);
      if (side === "l") return ["front_fender_l"];
      if (side === "r") return ["front_fender_r"];
      return ["front_fender_l", "front_fender_r"];
    }
    if (/rear combination|tail\s*lamp|rear lamp/.test(b)) {
      const side = sideFromBlob(b);
      if (side === "l") return ["rear_fender_l"];
      if (side === "r") return ["rear_fender_r"];
      return ["rear_fender_l", "rear_fender_r"];
    }
    return [];
  }

  if (/front bumper|전면 범퍼|프론트 범퍼/.test(b)) return ["front_bumper"];
  if (/rear bumper|후면 범퍼|리어 범퍼/.test(b)) return ["rear_bumper"];
  if (/radiator grille|grille|그릴/.test(b)) return ["grille"];
  if (/bonnet|hood|후드|본넷/.test(b)) return ["hood"];
  if (/trunk|boot|트렁크/.test(b)) return ["trunk"];
  if (/back\s*panel|backdoor|테일게이트|테일 게이트/.test(b)) return ["trunk"];
  if (/roof|루프|sunroof/.test(b)) return ["roof"];
  if (/windshield|windscreen|rear window|유리/.test(b) && !/door glass/.test(b)) return ["glass"];

  const side = sideFromBlob(b);

  if (/side step|사이드.?스텝|sill|rocker/.test(b)) {
    if (side === "l") return ["side_sill_l"];
    if (side === "r") return ["side_sill_r"];
    return ["side_sill_l", "side_sill_r"];
  }

  if (/front door|프론트 도어|앞문/.test(b)) {
    if (side === "l") return ["front_door_l"];
    if (side === "r") return ["front_door_r"];
    return ["front_door_l", "front_door_r"];
  }

  if (/rear door|리어 도어|뒷문/.test(b)) {
    if (side === "l") return ["rear_door_l"];
    if (side === "r") return ["rear_door_r"];
    return ["rear_door_l", "rear_door_r"];
  }

  if (/front fender|프론트 펜더|앞 펜더/.test(b)) {
    if (side === "l") return ["front_fender_l"];
    if (side === "r") return ["front_fender_r"];
    return ["front_fender_l", "front_fender_r"];
  }

  if (/rear fender|quarter|리어 펜더|쿼터|rear quarter/.test(b)) {
    if (side === "l") return ["rear_fender_l"];
    if (side === "r") return ["rear_fender_r"];
    return ["rear_fender_l", "rear_fender_r"];
  }

  if (/\bdoor\b/.test(b)) {
    if (side === "l") return ["front_door_l"];
    if (side === "r") return ["front_door_r"];
    return ["front_door_l", "front_door_r"];
  }

  if (/\bfender\b/.test(b)) {
    if (side === "l") return ["front_fender_l"];
    if (side === "r") return ["front_fender_r"];
    return ["front_fender_l", "front_fender_r"];
  }

  return [];
}

function categoryHintFromKeyOrLabel(key?: string | null, label?: string | null): string | null {
  const blob = `${key ?? ""} ${label ?? ""}`.toLowerCase();
  if (/sheet_metal|sheet metal/.test(blob)) return "sheet_metal";
  if (/replace/.test(blob)) return "replace";
  if (/paint/.test(blob)) return "paint";
  if (/repair|detach|other/.test(blob)) return "repair";
  return null;
}

function splitPartItems(value: string): string[] {
  return value
    .split(/;|\n|\|\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/\s*\(\+\d+\s*more\)\s*$/i, "").trim())
    .filter(Boolean);
}

/**
 * Display + dedupe key for repair-part chips on the body diagram.
 * Carstat often repeats the same panel across paint/repair/replace rows
 * ("Trunk interior (repair)" ×3) and glues actions ("tailgateRepaired").
 */
export function normalizeDamagePartLabel(raw: string): string {
  let s = raw.trim();
  s = s.replace(
    /([a-zA-Z/])(Repaired|Replaced|Painted|Overhauled|Repainted|Replacement)\b/g,
    "$1 $2",
  );
  s = s.replace(
    /\s*\((?:replace(?:ment)?|repair(?:ed)?|painting|paint|sheet\s*metal|overhaul|detach(?:able)?|removable)\)\s*/gi,
    " ",
  );
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function partDedupeKey(label: string): string {
  return normalizeDamagePartLabel(label).toLowerCase();
}

export function parseCarDamageFromRepairExtras(
  extras: Array<{ key?: string | null; label?: string | null; value?: string | null }>,
): CarDamageHit[] {
  const byZone = new Map<CarDamageZoneId, CarDamageHit>();

  const bump = (zone: CarDamageZoneId, severity: DamageSeverity, label: string) => {
    const display = normalizeDamagePartLabel(label);
    if (!display) return;
    const key = partDedupeKey(display);
    const existing = byZone.get(zone);
    if (!existing) {
      byZone.set(zone, { zone, severity, labels: [display] });
      return;
    }
    if (SEVERITY_RANK[severity] > SEVERITY_RANK[existing.severity]) {
      existing.severity = severity;
    }
    if (!existing.labels.some((l) => partDedupeKey(l) === key)) {
      existing.labels.push(display);
    }
  };

  for (const row of extras) {
    const key = row.key ?? "";
    const label = row.label ?? "";
    if (!/kr_parts_|repair parts|all repaired/i.test(`${key} ${label}`)) continue;
    if (/kr_parts_all|all repaired/i.test(`${key} ${label}`)) continue; // prefer category rows
    const hint = categoryHintFromKeyOrLabel(key, label);
    for (const item of splitPartItems(row.value ?? "")) {
      const severity = severityFromBlob(item, hint);
      for (const zone of zonesForPart(item)) {
        bump(zone, severity, item);
      }
    }
  }

  return [...byZone.values()].sort((a, b) => a.zone.localeCompare(b.zone));
}

export const DAMAGE_SEVERITY_META: Record<
  DamageSeverity,
  { titleKey: string; fill: string; stroke: string; glow: string; hatch: string }
> = {
  paint: {
    titleKey: "damage_severity_paint",
    fill: "rgba(253, 230, 138, 0.85)",
    stroke: "rgba(217, 119, 6, 1)",
    glow: "rgba(251, 191, 36, 0.35)",
    hatch: "#d97706",
  },
  repair: {
    titleKey: "damage_severity_repair",
    fill: "rgba(254, 202, 202, 0.9)",
    stroke: "rgba(239, 68, 68, 1)",
    glow: "rgba(248, 113, 113, 0.35)",
    hatch: "#ef4444",
  },
  replace: {
    titleKey: "damage_severity_replace",
    fill: "rgba(228, 228, 231, 0.95)",
    stroke: "rgba(113, 113, 122, 1)",
    glow: "rgba(161, 161, 170, 0.35)",
    hatch: "#71717a",
  },
  sheet_metal: {
    titleKey: "damage_severity_sheet_metal",
    fill: "rgba(254, 205, 211, 0.9)",
    stroke: "rgba(225, 29, 72, 1)",
    glow: "rgba(251, 113, 133, 0.35)",
    hatch: "#e11d48",
  },
};
