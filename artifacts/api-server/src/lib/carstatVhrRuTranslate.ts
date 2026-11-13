/**
 * Translate Russian / Korean VHR string leaves → English before normalize.
 * Carstat often ships RU labels (fuel, color, ownership, KR option packages)
 * and Korean inspection notes even when the report language is "en".
 * Structural JSON keys stay English.
 */

const CYRILLIC_RE = /[\u0400-\u04FF]/
const HANGUL_RE = /[\uAC00-\uD7A3]/

/** Longer Hangul phrases first — used-car inspection boilerplate + repair actions. */
const KO_PHRASE_MAP: Array<[string, string]> = [
  // Full common disclaimer (Carstat vehicle inspection conclusions.notes)
  [
    "비금속또는 탈부착 가능부품은 점검사항에서 제외되며 중고차특성상 부분판금도색부식은 있을수 있습니다",
    "Non-metal or detachable parts are excluded from inspection items; due to the nature of used cars, partial panel repair, paint, or corrosion may be present",
  ],
  [
    "비금속 또는 탈부착 가능부품은 점검사항에서 제외되며 중고차특성상 부분판금도색부식은 있을수 있습니다",
    "Non-metal or detachable parts are excluded from inspection items; due to the nature of used cars, partial panel repair, paint, or corrosion may be present",
  ],
  ["점검사항에서 제외되며", "are excluded from inspection items, and"],
  ["중고차특성상", "due to the nature of used cars,"],
  ["부분판금도색부식은 있을수 있습니다", "partial panel repair, paint, or corrosion may be present"],
  ["부분판금도색부식은 있을 수 있습니다", "partial panel repair, paint, or corrosion may be present"],
  ["탈부착 가능부품", "detachable parts"],
  ["탈부착가능부품", "detachable parts"],
  ["점검사항", "inspection items"],
  ["비금속", "Non-metal"],
  ["조수석휀다브라켓교환", "Passenger-side fender bracket replaced"],
  ["조수석 휀다 브라켓 교환", "Passenger-side fender bracket replaced"],
  ["운전석휀다브라켓교환", "Driver-side fender bracket replaced"],
  ["조수석휀다교환", "Passenger-side fender replaced"],
  ["운전석휀다교환", "Driver-side fender replaced"],
  ["앞범퍼교환", "Front bumper replaced"],
  ["뒷범퍼교환", "Rear bumper replaced"],
  ["본네트교환", "Bonnet replaced"],
  ["후드교환", "Hood replaced"],
  ["조수석휀다", "Passenger-side fender"],
  ["운전석휀다", "Driver-side fender"],
  ["휀다브라켓", "fender bracket"],
  ["브라켓교환", "bracket replaced"],
  ["판금도색", "panel repair and paint"],
  ["부분판금", "partial panel repair"],
  ["조수석", "Passenger-side"],
  ["운전석", "Driver-side"],
  ["앞범퍼", "Front bumper"],
  ["뒷범퍼", "Rear bumper"],
  ["본네트", "Bonnet"],
  ["트렁크", "Trunk"],
  ["도어", "Door"],
  ["휀다", "Fender"],
  ["펜더", "Fender"],
  ["브라켓", "bracket"],
  ["교환", "replaced"],
  ["교체", "replaced"],
  ["수리", "repaired"],
  ["도색", "painted"],
  ["판금", "panel repair"],
  ["용접", "welded"],
  ["부식", "corrosion"],
  ["양호", "Good"],
  ["없음", "None"],
  ["있음", "Present"],
  ["불량", "Poor"],
  ["정상", "Normal"],
  ["이상", "Issue"],
];

/** Longer phrases first — exact (case-insensitive) replacements. */
const PHRASE_MAP: Array<[string, string]> = [
  // Fuels / drivetrain
  ["неэтилированный бензин", "Unleaded gasoline"],
  ["этилированный бензин", "Leaded gasoline"],
  ["дизельное топливо", "Diesel"],
  ["электричество", "Electric"],
  ["гибридный", "Hybrid"],
  ["газ / бензин", "LPG / Gasoline"],
  ["бензин", "Gasoline"],
  ["дизель", "Diesel"],
  ["гибрид", "Hybrid"],
  ["электро", "Electric"],

  // Ownership / registry
  ["первичная регистрация", "Initial registration"],
  ["первоначальная регистрация", "Initial registration"],
  ["смена владельца", "Change of Owner"],
  ["изменение владельца", "Change of Owner"],
  ["прекращение предоставления информации", "Termination of information provision"],
  ["прекращение информирования", "Termination of information provision"],
  ["экспортная декларация", "Export declaration"],
  ["частное легковое", "Private passenger car"],
  ["легковой частный", "Private passenger car"],
  ["легковой автомобиль", "Passenger car"],
  ["коммерческое использование", "Commercial use"],
  ["служебный", "Government / official"],
  ["прокат / аренда", "Rental"],
  ["аренда", "Rental"],
  ["страховая компания", "Car insurance company"],
  ["компания автострахования", "Car insurance company"],
  ["страховщик", "Insurer"],
  ["полная гибель", "Total loss"],
  ["угон", "Theft"],
  ["затопление", "Flood"],
  ["потоп", "Flood"],
  ["без страхового периода", "Uninsured period"],
  ["период без страховки", "Uninsured period"],
  ["собственный ущерб", "Own damage"],
  ["ущерб третьих лиц", "Third-party damage"],

  // Body / damage parts
  ["4-дверный седан", "4-door sedan"],
  ["5-дверный хэтчбек", "5-door hatchback"],
  ["5-дверный универсал", "5-door wagon"],
  ["дверный седан", "door sedan"],
  ["седан", "Sedan"],
  ["хэтчбек", "Hatchback"],
  ["универсал", "Wagon"],
  ["кроссовер", "Crossover"],
  ["внедорожник", "SUV"],
  ["замена", "replacement"],
  ["окраска", "painting"],
  ["покраска", "painting"],
  ["ремонт", "repair"],
  ["рихтовка", "sheet metal"],
  ["съемный", "removable"],
  ["съемная", "removable"],
  ["разборка", "detachable"],
  ["передний бампер", "Front bumper"],
  ["задний бампер", "Rear bumper"],
  ["передняя дверь", "Front door"],
  ["задняя дверь", "Rear door"],
  ["капот", "Bonnet"],
  ["крышка багажника", "Trunk lid"],
  ["привод багажника", "trunk drive"],
  ["крыло", "Fender"],
  ["переднее крыло", "Front fender"],
  ["заднее крыло", "Rear fender"],
  ["радиаторная решетка", "Radiator grille"],
  ["фара", "Headlamp"],
  ["задний фонарь", "Rear combination lamp"],

  // Colors
  ["белый", "White"],
  ["чёрный", "Black"],
  ["черный", "Black"],
  ["серебристый", "Silver"],
  ["серый", "Gray"],
  ["синий", "Blue"],
  ["красный", "Red"],
  ["зелёный", "Green"],
  ["зеленый", "Green"],
  ["коричневый", "Brown"],
  ["бежевый", "Beige"],
  ["жёлтый", "Yellow"],
  ["желтый", "Yellow"],
  ["оранжевый", "Orange"],
  ["фиолетовый", "Purple"],
  ["золотой", "Gold"],

  // Option packages / equipment (Carstat KR→RU dumps)
  ["не подтверждено", "unconfirmed"],
  ["неподтверждено", "unconfirmed"],
  ["сиденья из искусственной кожи (включая отделку центральной части дверей из искусственной кожи)", "Artificial leather seats (including artificial leather door center trim)"],
  ["сиденья из искусственной кожи", "Artificial leather seats"],
  ["отделку центральной части дверей из искусственной кожи", "artificial leather door center trim"],
  ["искусственной кожи", "artificial leather"],
  ["пакет display audio", "Display Audio package"],
  ["дисплей аудиосистемы", "audio display"],
  ["дюймовый дисплей", "inch display"],
  ["дюймовая навигация", "inch navigation"],
  ["дюймовый", "inch"],
  ["задний монитор (с подключением к рулевому колесу)", "Rear monitor (steering-wheel connection)"],
  ["задний монитор", "Rear monitor"],
  ["подключением к рулевому колесу", "steering-wheel connection"],
  ["система обнаружения слепых зон (bsd)", "Blind-spot detection system (BSD)"],
  ["система обнаружения слепых зон", "Blind-spot detection system"],
  ["обнаружения слепых зон", "blind-spot detection"],
  ["смарт-ключ", "Smart key"],
  ["пакет hyundai smartsense i", "Hyundai SmartSense I package"],
  ["hyundai smartsense i", "Hyundai SmartSense I"],
  ["система предотвращения фронтальных столкновений (автомобиль)", "Forward collision-avoidance system (vehicle)"],
  ["система предотвращения фронтальных столкновений", "Forward collision-avoidance system"],
  ["предотвращения фронтальных столкновений", "forward collision avoidance"],
  ["система удержания полосы движения", "Lane-keeping system"],
  ["удержания полосы движения", "lane keeping"],
  ["система предупреждения о невнимательности водителя", "Driver attention warning system"],
  ["предупреждения о невнимательности водителя", "driver attention warning"],
  ["навигационный пакет i", "Navigation package I"],
  ["навигационный пакет", "Navigation package"],
  ["навигация (включая подключение телефона)", "navigation (including phone connectivity)"],
  ["подключение телефона", "phone connectivity"],
  ["двухзонный полностью автоматический кондиционер (включая режим очистки воздуха", "Dual-zone fully automatic air conditioning (including air-cleaning mode"],
  ["двухзонный полностью автоматический кондиционер", "Dual-zone fully automatic air conditioning"],
  ["режим очистки воздуха", "air-cleaning mode"],
  ["автоматическое размораживание", "Automatic defrost"],
  ["ионизатор кластера", "cluster ionizer"],
  ["система hi-pass", "Hi-Pass system"],
  ["зеркало заднего вида ecm", "ECM rearview mirror"],
  ["зеркало заднего вида", "Rearview mirror"],
  ["электрический привод багажника", "Power liftgate"],
  ["электропривод багажника", "Power liftgate"],
  ["привод багажника", "trunk drive"],
  ["навигация", "Navigation"],
  ["пакет", "package"],
  ["система", "system"],
  ["сиденья", "Seats"],
  ["ключ", "key"],
];

const WORD_MAP: Record<string, string> = Object.fromEntries(
  PHRASE_MAP.filter(([src]) => !src.includes(" ")).map(([src, dst]) => [src, dst]),
);

export function containsCyrillic(text: string): boolean {
  return CYRILLIC_RE.test(text);
}

export function containsHangul(text: string): boolean {
  return HANGUL_RE.test(text);
}

/** True if any string leaf in the payload still has Cyrillic. */
export function payloadContainsCyrillic(value: unknown, depth = 0): boolean {
  if (depth > 40) return false;
  if (typeof value === "string") return containsCyrillic(value);
  if (Array.isArray(value)) return value.some((v) => payloadContainsCyrillic(v, depth + 1));
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((v) =>
      payloadContainsCyrillic(v, depth + 1),
    );
  }
  return false;
}

/** True if any string leaf in the payload still has Hangul. */
export function payloadContainsHangul(value: unknown, depth = 0): boolean {
  if (depth > 40) return false;
  if (typeof value === "string") return containsHangul(value);
  if (Array.isArray(value)) return value.some((v) => payloadContainsHangul(v, depth + 1));
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((v) =>
      payloadContainsHangul(v, depth + 1),
    );
  }
  return false;
}

function translatePhraseExact(lower: string): string | null {
  for (const [src, dst] of PHRASE_MAP) {
    if (lower === src) return dst;
  }
  return null;
}

/** Translate a single RU (or mixed) string. Leaves non-Cyrillic text unchanged. */
export function translateRuToEn(text: string): string {
  if (!text || !containsCyrillic(text)) return text;

  // Fix glued Latin+Cyrillic tokens from Carstat ("Electricпривод")
  let trimmed = text.trim().replace(/([A-Za-z])([\u0400-\u04FF])/g, "$1 $2");

  const exact = translatePhraseExact(trimmed.toLowerCase());
  if (exact) return exact;

  // Multi-word / sentence: replace known phrases longest-first, then leftover words.
  let out = trimmed;
  const sorted = [...PHRASE_MAP].sort((a, b) => b[0].length - a[0].length);
  for (const [src, dst] of sorted) {
    const re = new RegExp(src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    out = out.replace(re, dst);
  }

  if (!containsCyrillic(out)) return cleanupTranslated(out);

  // Token pass for remaining Cyrillic words
  out = out.replace(/[\u0400-\u04FFЁё]+/g, (word) => {
    const mapped = WORD_MAP[word.toLowerCase()];
    if (mapped) return mapped;
    return word;
  });

  return cleanupTranslated(out);
}

/** Translate a single KO (or mixed) inspection/note string. Leaves non-Hangul text unchanged. */
export function translateKoToEn(text: string): string {
  if (!text || !containsHangul(text)) return text;

  let out = text.trim();
  // Carstat often glues the finding onto the disclaimer with no space/period.
  out = out.replace(/습니다\./g, "습니다. ").replace(/습니다([가-힣])/g, "습니다. $1");

  const sorted = [...KO_PHRASE_MAP].sort((a, b) => b[0].length - a[0].length);
  for (const [src, dst] of sorted) {
    const re = new RegExp(src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    out = out.replace(re, dst);
  }

  return cleanupTranslated(out)
    .replace(/\.\s*\./g, ".")
    .trim();
}

function cleanupTranslated(text: string): string {
  return text
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([),])/g, "$1")
    .replace(/\(\s+/g, "(")
    .trim();
}

export function translateVhrJsonRuToEn<T>(payload: T): T {
  return walk(payload) as T;
}

export function translateVhrJsonKoToEn<T>(payload: T): T {
  return walkKo(payload) as T;
}

/**
 * Last-mile pass for already-normalized reports (DB cache / local Carstat).
 * Translates human-facing string leaves; skips URLs and pure codes.
 */
export function translateNormalizedReportRuToEn<T extends Record<string, unknown>>(data: T): T {
  if (!payloadContainsCyrillic(data) && !payloadContainsHangul(data)) return data;
  return walkNormalized(data) as T;
}

function walk(value: unknown): unknown {
  if (typeof value === "string") return translateRuToEn(value);
  if (Array.isArray(value)) return value.map(walk);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = walk(v);
    }
    return out;
  }
  return value;
}

function walkKo(value: unknown): unknown {
  if (typeof value === "string") return translateKoToEn(value);
  if (Array.isArray(value)) return value.map(walkKo);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = walkKo(v);
    }
    return out;
  }
  return value;
}

function walkNormalized(value: unknown, keyHint = ""): unknown {
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) return value;
    let out = value;
    if (containsCyrillic(out)) out = translateRuToEn(out);
    if (containsHangul(out)) out = translateKoToEn(out);
    return out;
  }
  if (Array.isArray(value)) return value.map((v) => walkNormalized(v, keyHint));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // Keep raw provider blobs / CDN URLs untouched structurally.
      if (k === "vhrReports" || k === "vhrReport" || k === "photos" || k === "photosHd") {
        out[k] = v;
        continue;
      }
      out[k] = walkNormalized(v, k);
    }
    return out;
  }
  return value;
}
