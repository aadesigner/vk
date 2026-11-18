/** Normalize API damage text to an i18n key suffix (e.g. "Front End" → "front_end"). */
export function damageValueKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function normalizePanelPhrase(value: string): string {
  return value
    .toLowerCase()
    .replace(/[()[\],./·|_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * English provider / auction / Korea-repair panel names → damage_zone_* keys.
 * Covers common word orders: "Front fender left", "Front fender (left)", "Left front fender".
 */
const BODY_PANEL_PHRASE_KEYS: Record<string, string> = {
  // Front bumper
  "front bumper": "damage_zone_front_bumper",
  "front bumper cover": "damage_zone_front_bumper",
  "bumper front": "damage_zone_front_bumper",
  // Rear bumper
  "rear bumper": "damage_zone_rear_bumper",
  "rear bumper cover": "damage_zone_rear_bumper",
  "bumper rear": "damage_zone_rear_bumper",
  // Grille / hood / roof / glass / trunk
  grille: "damage_zone_grille",
  "radiator grille": "damage_zone_grille",
  hood: "damage_zone_hood",
  bonnet: "damage_zone_hood",
  roof: "damage_zone_roof",
  glass: "damage_zone_glass",
  windshield: "damage_zone_glass",
  windscreen: "damage_zone_glass",
  "rear window": "damage_zone_glass",
  trunk: "damage_zone_trunk",
  "trunk lid": "damage_zone_trunk",
  boot: "damage_zone_trunk",
  tailgate: "damage_zone_trunk",
  "tail gate": "damage_zone_trunk",
  "trunk / tailgate": "damage_zone_trunk",
  // Front fender
  "front fender left": "damage_zone_front_fender_l",
  "front fender right": "damage_zone_front_fender_r",
  "front fender l": "damage_zone_front_fender_l",
  "front fender r": "damage_zone_front_fender_r",
  "left front fender": "damage_zone_front_fender_l",
  "right front fender": "damage_zone_front_fender_r",
  "front left fender": "damage_zone_front_fender_l",
  "front right fender": "damage_zone_front_fender_r",
  "front wing left": "damage_zone_front_fender_l",
  "front wing right": "damage_zone_front_fender_r",
  "left front wing": "damage_zone_front_fender_l",
  "right front wing": "damage_zone_front_fender_r",
  // Rear fender / quarter
  "rear fender left": "damage_zone_rear_fender_l",
  "rear fender right": "damage_zone_rear_fender_r",
  "left rear fender": "damage_zone_rear_fender_l",
  "right rear fender": "damage_zone_rear_fender_r",
  "rear left fender": "damage_zone_rear_fender_l",
  "rear right fender": "damage_zone_rear_fender_r",
  "rear quarter left": "damage_zone_rear_fender_l",
  "rear quarter right": "damage_zone_rear_fender_r",
  "left rear quarter": "damage_zone_rear_fender_l",
  "right rear quarter": "damage_zone_rear_fender_r",
  "quarter panel left": "damage_zone_rear_fender_l",
  "quarter panel right": "damage_zone_rear_fender_r",
  // Doors
  "front door left": "damage_zone_front_door_l",
  "front door right": "damage_zone_front_door_r",
  "left front door": "damage_zone_front_door_l",
  "right front door": "damage_zone_front_door_r",
  "front left door": "damage_zone_front_door_l",
  "front right door": "damage_zone_front_door_r",
  "rear door left": "damage_zone_rear_door_l",
  "rear door right": "damage_zone_rear_door_r",
  "left rear door": "damage_zone_rear_door_l",
  "right rear door": "damage_zone_rear_door_r",
  "rear left door": "damage_zone_rear_door_l",
  "rear right door": "damage_zone_rear_door_r",
  // Side sill / rocker
  "side sill left": "damage_zone_side_sill_l",
  "side sill right": "damage_zone_side_sill_r",
  "left side sill": "damage_zone_side_sill_l",
  "right side sill": "damage_zone_side_sill_r",
  "rocker panel left": "damage_zone_side_sill_l",
  "rocker panel right": "damage_zone_side_sill_r",
  "left rocker": "damage_zone_side_sill_l",
  "right rocker": "damage_zone_side_sill_r",
  "side step left": "damage_zone_side_sill_l",
  "side step right": "damage_zone_side_sill_r",
};

/** Repair-action values that appear in extras tables (Replaced, Painted, …). */
const REPAIR_ACTION_PHRASE_KEYS: Record<string, string> = {
  replaced: "damage_severity_replace",
  replacement: "damage_severity_replace",
  replace: "damage_severity_replace",
  repaired: "damage_severity_repair",
  repair: "damage_severity_repair",
  overhauled: "damage_severity_repair",
  overhaul: "damage_severity_repair",
  painted: "damage_severity_paint",
  paint: "damage_severity_paint",
  painting: "damage_severity_paint",
  repainted: "damage_severity_paint",
  "sheet metal": "damage_severity_sheet_metal",
  "sheet-metal": "damage_severity_sheet_metal",
  detach: "damage_severity_repair",
  detached: "damage_severity_repair",
  removable: "damage_severity_repair",
};

const OTHER_FIELD_PHRASE_KEYS: Record<string, string> = {
  odometer: "provider_odometer",
  "odometer reading": "provider_odometer",
  "odometer status": "provider_odometer_status",
};

function lookupPhraseKey(
  map: Record<string, string>,
  text: string,
): string | null {
  const key = normalizePanelPhrase(text);
  return map[key] ?? null;
}

/** Translate a body-panel name when a damage_zone_* locale string exists. */
export function translateBodyPanelLabel(
  t: (key: string) => string,
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const i18nKey = lookupPhraseKey(BODY_PANEL_PHRASE_KEYS, value);
  if (!i18nKey) return null;
  const translated = t(i18nKey);
  return translated !== i18nKey ? translated : null;
}

/** Translate repair-action words (Replaced / Painted / …). */
export function translateRepairActionLabel(
  t: (key: string) => string,
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const i18nKey = lookupPhraseKey(REPAIR_ACTION_PHRASE_KEYS, value);
  if (!i18nKey) return null;
  const translated = t(i18nKey);
  return translated !== i18nKey ? translated : null;
}

/**
 * Translate provider extras field text: odometer, body panels, repair actions.
 * Returns null when unchanged / unknown.
 */
export function translateBodyRepairExtrasText(
  t: (key: string) => string,
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const otherKey = lookupPhraseKey(OTHER_FIELD_PHRASE_KEYS, trimmed);
  if (otherKey) {
    const translated = t(otherKey);
    if (translated !== otherKey) return translated;
  }

  const action = translateRepairActionLabel(t, trimmed);
  if (action) return action;

  const panel = translateBodyPanelLabel(t, trimmed);
  if (panel) return panel;

  // Multi-part values: "Hood; Front bumper" / "Hood · Front bumper"
  if (/[;|·,]/.test(trimmed) || /\n/.test(trimmed)) {
    const parts = trimmed.split(/[;|·,\n]+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      const mapped = parts.map((part) => {
        const a = translateRepairActionLabel(t, part);
        if (a) return a;
        const b = translateBodyPanelLabel(t, part);
        if (b) return b;
        return part;
      });
      if (mapped.some((m, i) => normalizePanelPhrase(m) !== normalizePanelPhrase(parts[i]!))) {
        return mapped.join("; ");
      }
    }
  }

  return null;
}

/** Translate a Copart/IAAI damage label when a locale string exists; otherwise title-case the raw value. */
export function translateDamageLabel(
  t: (key: string) => string,
  value: string | null | undefined,
): string | null {
  if (!value || value === "[object Object]") return null;
  const panel = translateBodyPanelLabel(t, value);
  if (panel) return panel;
  const action = translateRepairActionLabel(t, value);
  if (action) return action;
  const i18nKey = `damage_val_${damageValueKey(value)}`;
  const translated = t(i18nKey);
  if (translated !== i18nKey) return translated;
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
